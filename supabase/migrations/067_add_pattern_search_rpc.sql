-- =============================================================================
-- [PATTERN] Add Pattern-Based Search RPC
-- =============================================================================
-- 목적: pattern_type 필터를 지원하는 벡터 검색 RPC
-- 날짜: 2026-01-03
-- 영향: 신규 RPC 추가 (기존 match_document_chunks 유지)
-- =============================================================================

-- [STEP 1] 기존 함수가 있으면 삭제 (재생성용)
DROP FUNCTION IF EXISTS match_document_chunks_by_pattern(
  vector(1536), text, uuid, uuid, float, int
);

-- [STEP 2] 패턴 기반 검색 RPC 생성
CREATE OR REPLACE FUNCTION match_document_chunks_by_pattern (
  query_embedding vector(1536),
  pattern_type_param text,
  project_id_param uuid,
  user_id_param uuid,
  match_threshold float DEFAULT 0.5,
  match_count int DEFAULT 10
)
RETURNS TABLE (
  id uuid,
  document_id uuid,
  content text,
  metadata jsonb,
  similarity float,
  document_title text,
  pattern_type text
)
LANGUAGE plpgsql
AS $$
BEGIN
  -- [SECURITY] 프로젝트 ID가 없으면 검색 결과를 반환하지 않음 (격리 강화)
  IF project_id_param IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    rc.id,
    rc.document_id,
    rc.content,
    rc.metadata,
    1 - (rc.embedding <=> query_embedding) as similarity,
    ud.title as document_title,
    rc.pattern_type
  FROM rag_chunks rc
  JOIN user_documents ud ON rc.document_id = ud.id
  WHERE 
    -- 벡터 유사도 필터
    1 - (rc.embedding <=> query_embedding) > match_threshold
    -- 사용자 필터
    AND ud.user_id = user_id_param
    -- 프로젝트 격리 (필수)
    AND ud.project_id = project_id_param
    -- 패턴 타입 필터 (선택적: NULL이면 전체)
    AND (pattern_type_param IS NULL OR rc.pattern_type = pattern_type_param)
  ORDER BY rc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- [STEP 3] RPC 권한 설정
GRANT EXECUTE ON FUNCTION match_document_chunks_by_pattern(
  vector(1536), text, uuid, uuid, float, int
) TO authenticated;

-- [STEP 4] 스키마 리로드
NOTIFY pgrst, 'reload schema';

-- =============================================================================
-- 사용 예시:
-- SELECT * FROM match_document_chunks_by_pattern(
--   '[0.1, 0.2, ...]'::vector(1536),  -- query_embedding
--   'hook',                            -- pattern_type (또는 NULL)
--   'project-uuid',                    -- project_id
--   'user-uuid',                       -- user_id
--   0.5,                               -- match_threshold
--   10                                 -- match_count
-- );
-- =============================================================================
