-- =============================================================================
-- Fix: match_document_chunks function missing document_id column
-- Date: 2026-01-01
-- Issue: search.ts expects document_id but RPC does not return it
-- =============================================================================

-- Drop and recreate the function with correct return columns
CREATE OR REPLACE FUNCTION match_document_chunks (
  query_embedding vector(1536),
  match_threshold float,
  match_count int,
  user_id_param uuid,
  category_param text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  document_id uuid,  -- Added: required by search.ts
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

-- Reload schema cache
NOTIFY pgrst, 'reload schema';
