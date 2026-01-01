-- =============================================================================
-- PRISM Writer RPC Function Fixes
-- =============================================================================
-- 목적: 
-- 1. match_user_preferences: 'value' 컬럼 참조 오류 수정 (preferred_answer 사용)
-- 2. match_document_chunks: rag_chunks 테이블 및 JOIN 명시적 수정
-- =============================================================================

-- 1. match_user_preferences 수정
CREATE OR REPLACE FUNCTION match_user_preferences (
  query_embedding vector(1536),
  match_threshold float,
  match_count int,
  user_id_param uuid,
  category_param text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  question text,
  preferred_answer text,
  category text,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    up.id,
    up.question,
    up.preferred_answer,
    up.category,
    1 - (up.embedding <=> query_embedding) as similarity
  FROM public.user_preferences up
  WHERE up.user_id = user_id_param
    AND (category_param IS NULL OR up.category = category_param)
    AND 1 - (up.embedding <=> query_embedding) > match_threshold
  ORDER BY up.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- 2. match_document_chunks 수정
CREATE OR REPLACE FUNCTION match_document_chunks (
  query_embedding vector(1536),
  match_threshold float,
  match_count int,
  user_id_param uuid,
  category_param text DEFAULT NULL
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
  ORDER BY rc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- 스키마 리로드 (PostgREST 캐시 갱신)
NOTIFY pgrst, 'reload schema';
