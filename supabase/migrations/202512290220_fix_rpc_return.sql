-- =============================================================================
-- Final Fix: RPC Return Columns (with DROP)
-- Date: 2025-12-29
-- Issue: match_document_chunks return type change requires DROP first
-- result: Resolve '42P13: cannot change return type of existing function'
-- =============================================================================

-- 1. Drop existing function first (Required when changing return type)
DROP FUNCTION IF EXISTS match_document_chunks(vector, float, int, uuid, text);

-- 2. Re-create function with 'document_id' column
CREATE OR REPLACE FUNCTION match_document_chunks (
  query_embedding vector(1536),
  match_threshold float,
  match_count int,
  user_id_param uuid,
  category_param text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  document_id uuid, -- Added
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
    rc.document_id, -- Added
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

-- Reload Schema Cache
NOTIFY pgrst, 'reload schema';
