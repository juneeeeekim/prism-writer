-- =============================================================================
-- Phase RAG-02: Update match_document_chunks RPC for project filtering
-- =============================================================================
-- 목적: RAG 검색 시 프로젝트별 문서만 조회하도록 필터 추가
-- 생성일: 2026-01-02
-- =============================================================================

-- match_document_chunks 함수 업데이트
-- 변경사항: project_id_param 파라미터 추가 (기본값 NULL = 전체 검색)
CREATE OR REPLACE FUNCTION match_document_chunks (
  query_embedding vector(1536),
  match_threshold float,
  match_count int,
  user_id_param uuid,
  category_param text DEFAULT NULL,
  project_id_param uuid DEFAULT NULL  -- [NEW] 프로젝트 필터
)
RETURNS TABLE (
  id uuid,
  document_id uuid,
  content text,
  metadata jsonb,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    rc.id,
    rc.document_id,
    rc.content,
    rc.metadata,
    1 - (rc.embedding <=> query_embedding) as similarity
  FROM rag_chunks rc
  JOIN user_documents ud ON rc.document_id = ud.id
  WHERE 1 - (rc.embedding <=> query_embedding) > match_threshold
    AND ud.user_id = user_id_param
    AND (category_param IS NULL OR ud.category = category_param)
    -- [NEW] 프로젝트 필터: NULL이면 전체, 값이 있으면 해당 프로젝트만
    AND (project_id_param IS NULL OR ud.project_id = project_id_param)
  ORDER BY rc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- 스키마 리로드 (PostgREST 캐시 갱신)
NOTIFY pgrst, 'reload schema';
