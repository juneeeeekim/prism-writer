-- =============================================================================
-- Migration: 036_user_preferences.sql
-- Description: Create user_preferences table for Feedback-to-Memory system
-- Created: 2025-12-28
-- Updated: 2025-12-28 - Phase 14.5 Category-Scoped Personalization
-- =============================================================================

-- 1. Create table with category support
CREATE TABLE IF NOT EXISTS public.user_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question TEXT NOT NULL,         -- The user's query
  preferred_answer TEXT NOT NULL, -- The answer the user marked as helpful
  category TEXT DEFAULT '미분류', -- Category for scoped personalization
  embedding vector(1536) NOT NULL, -- Logical embedding of the question/context
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Enable RLS
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

-- 3. Create RLS Policies
-- Policy: Select (Users can read their own preferences)
CREATE POLICY "Users can view own preferences"
  ON public.user_preferences FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Insert (Users can insert their own preferences)
CREATE POLICY "Users can insert own preferences"
  ON public.user_preferences FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: Delete (Users can delete their own preferences)
CREATE POLICY "Users can delete own preferences"
  ON public.user_preferences FOR DELETE
  USING (auth.uid() = user_id);

-- 4. Create Indexes
-- Standard index on user_id for filtering
CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id ON public.user_preferences(user_id);

-- Composite index for category-scoped queries
CREATE INDEX IF NOT EXISTS idx_user_preferences_user_category 
ON public.user_preferences(user_id, category);

-- Vector index for similarity search
-- lists = 100 is a good default for up to ~10k rows.
CREATE INDEX IF NOT EXISTS idx_user_preferences_embedding 
ON public.user_preferences 
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- =============================================================================
-- 5. RPC Function: match_user_preferences (v2 - Category Support)
-- =============================================================================
-- Description: Finds similar user preferences based on vector similarity
-- Updated: Added category_param for category-scoped search
-- If category_param is NULL, searches across all categories (全体 option)
-- =============================================================================
CREATE OR REPLACE FUNCTION match_user_preferences (
  query_embedding vector(1536),
  match_threshold float,
  match_count int,
  user_id_param uuid,
  category_param text DEFAULT NULL  -- NULL = search all categories
) RETURNS TABLE (
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
    -- Calculate similarity (1 - cosine distance)
    1 - (up.embedding <=> query_embedding) as similarity
  FROM public.user_preferences up
  WHERE up.user_id = user_id_param
    -- Category filter: NULL means all categories
    AND (category_param IS NULL OR up.category = category_param)
    AND 1 - (up.embedding <=> query_embedding) > match_threshold
  ORDER BY up.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
