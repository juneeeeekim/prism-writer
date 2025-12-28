-- =============================================================================
-- Final Fix: Update RPC functions and Enforce RLS
-- Date: 2025-12-29
-- Issue: 
-- 1. Chat fails with PGRST202 (match_user_preferences signature mismatch)
-- 2. Upload fails with PGRST116 (RLS/Table mismatch)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Fix match_user_preferences (Add category_param)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION match_user_preferences (
  query_embedding vector(1536),
  match_threshold float,
  match_count int,
  user_id_param uuid,
  category_param text DEFAULT 'default' -- Added to match API call
)
RETURNS TABLE (
  id uuid,
  content text,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    up.id,
    up.value as content,
    1 - (up.embedding <=> query_embedding) as similarity
  FROM user_preferences up
  WHERE 1 - (up.embedding <=> query_embedding) > match_threshold
  AND up.user_id = user_id_param
  -- Note: We accept category_param to prevent API errors, 
  -- but current user_preferences schema might not strictly enforce category yet.
  ORDER BY up.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- -----------------------------------------------------------------------------
-- 2. Fix match_document_chunks (Add category filtering & Join user_documents)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION match_document_chunks (
  query_embedding vector(1536),
  match_threshold float,
  match_count int,
  user_id_param uuid,
  category_param text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
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

-- -----------------------------------------------------------------------------
-- 3. Re-enforce RLS for user_documents (To fix PGRST116)
-- -----------------------------------------------------------------------------
ALTER TABLE user_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert their own documents" ON user_documents;
DROP POLICY IF EXISTS "Users can view their own documents" ON user_documents;
DROP POLICY IF EXISTS "Users can update their own documents" ON user_documents;
DROP POLICY IF EXISTS "Users can delete their own documents" ON user_documents;

CREATE POLICY "Users can insert their own documents" 
ON user_documents FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own documents" 
ON user_documents FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own documents" 
ON user_documents FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own documents" 
ON user_documents FOR DELETE USING (auth.uid() = user_id);

-- 4. Reload Schema Cache
NOTIFY pgrst, 'reload schema';
