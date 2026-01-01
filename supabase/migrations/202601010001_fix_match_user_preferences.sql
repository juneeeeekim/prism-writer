-- =============================================================================
-- Fix: match_user_preferences function uses non-existent column
-- Date: 2026-01-01
-- Issue: column up.value does not exist (should be up.question, up.preferred_answer)
-- =============================================================================

-- Drop and recreate the function with correct column references
CREATE OR REPLACE FUNCTION match_user_preferences (
  query_embedding vector(1536),
  match_threshold float,
  match_count int,
  user_id_param uuid,
  category_param text DEFAULT NULL  -- NULL = search all categories
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

-- Reload schema cache
NOTIFY pgrst, 'reload schema';
