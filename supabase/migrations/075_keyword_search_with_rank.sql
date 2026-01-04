-- =============================================================================
-- PRISM Writer - Keyword Search with Rank RPC
-- =============================================================================
-- 파일: supabase/migrations/075_keyword_search_with_rank.sql
-- 역할: PostgreSQL ts_rank를 사용한 키워드 검색 RPC 함수
-- 생성일: 2026-01-05
-- 
-- [P2-01-01] 체크리스트 구현:
-- - ts_rank()로 키워드 매칭 점수 정량화
-- - user_id, project_id 필터 지원
-- - 한글 검색을 위해 'simple' config 사용
-- =============================================================================

-- =============================================================================
-- [P2-01-01] search_chunks_with_rank RPC 함수
-- =============================================================================
-- 
-- 설명: PostgreSQL의 ts_rank() 함수를 활용하여 키워드 검색 결과에 점수 부여
-- 
-- 매개변수:
--   search_query: 검색 쿼리 텍스트
--   user_id_param: 사용자 ID (RLS 필터)
--   project_id_param: 프로젝트 ID (선택적, NULL이면 전체 검색)
--   match_count: 반환할 최대 결과 수 (기본 20)
-- 
-- 반환: id, document_id, content, metadata, rank
-- =============================================================================

CREATE OR REPLACE FUNCTION search_chunks_with_rank(
  search_query TEXT,
  user_id_param UUID,
  project_id_param UUID DEFAULT NULL,
  match_count INT DEFAULT 20
) 
RETURNS TABLE (
  id UUID,
  document_id UUID,
  content TEXT,
  metadata JSONB,
  rank FLOAT
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- =========================================================================
  -- [Safety] 빈 쿼리 검증
  -- =========================================================================
  IF search_query IS NULL OR TRIM(search_query) = '' THEN
    RETURN;  -- 빈 결과 반환
  END IF;

  -- =========================================================================
  -- [Core] ts_rank 기반 키워드 검색
  -- =========================================================================
  -- 'simple' config: 언어 불문 기본 토큰화 (한글 호환)
  -- plainto_tsquery: 사용자 입력을 안전하게 tsquery로 변환
  -- =========================================================================
  RETURN QUERY
  SELECT
    rc.id,
    rc.document_id,
    rc.content,
    rc.metadata,
    ts_rank(
      to_tsvector('simple', rc.content),
      plainto_tsquery('simple', TRIM(search_query))
    )::FLOAT AS rank
  FROM rag_chunks rc
  JOIN user_documents ud ON rc.document_id = ud.id
  WHERE 
    -- [RLS] 사용자 소유 문서만
    ud.user_id = user_id_param
    -- [Filter] 프로젝트 필터 (NULL이면 전체)
    AND (project_id_param IS NULL OR ud.project_id = project_id_param)
    -- [Match] Full Text Search 조건
    AND to_tsvector('simple', rc.content) @@ plainto_tsquery('simple', TRIM(search_query))
  ORDER BY rank DESC
  LIMIT match_count;
END;
$$;

-- =============================================================================
-- [P2-01-01] 함수 설명 추가
-- =============================================================================
COMMENT ON FUNCTION search_chunks_with_rank IS 
'[P2-01-01] PostgreSQL ts_rank 기반 키워드 검색. 
hybridSearch의 가중 점수 합산(Weighted Score Fusion)을 위해 사용됨.
한글 검색을 위해 "simple" config 사용 (형태소 분석 없음).';

-- =============================================================================
-- [Index] 성능 최적화용 GIN 인덱스 (이미 존재하면 skip)
-- =============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE indexname = 'idx_rag_chunks_content_tsvector'
  ) THEN
    CREATE INDEX idx_rag_chunks_content_tsvector 
    ON rag_chunks 
    USING GIN (to_tsvector('simple', content));
    RAISE NOTICE 'Created GIN index for full-text search';
  ELSE
    RAISE NOTICE 'GIN index already exists, skipping';
  END IF;
END $$;
