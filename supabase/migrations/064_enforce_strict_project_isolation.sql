-- [RAG-ISOLATION] Enforce Strict Project Isolation
-- 기존의 유연한 필터링(OR project_id_param IS NULL)을 제거하고,
-- 프로젝트 ID가 반드시 일치해야만 검색되도록 변경합니다.

CREATE OR REPLACE FUNCTION match_document_chunks (
  query_embedding vector(1536),
  match_threshold float,
  match_count int,
  user_id_param uuid,
  category_param text DEFAULT NULL,
  project_id_param uuid DEFAULT NULL
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
  -- [SECURITY] 프로젝트 ID가 없으면 검색 결과를 반환하지 않음 (격리 강화)
  -- Frontend에서 실수로 project_id를 보내지 않아도 다른 프로젝트 데이터가 노출되지 않도록 함
  IF project_id_param IS NULL THEN
    RETURN;
  END IF;

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
    AND ud.project_id = project_id_param -- [STRICT] 반드시 프로젝트가 일치해야 함
  ORDER BY rc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

NOTIFY pgrst, 'reload schema';
