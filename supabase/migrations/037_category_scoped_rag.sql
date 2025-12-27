-- =============================================================================
-- Migration: 037_category_scoped_rag.sql
-- Description: Add category column to document_chunks for category-scoped RAG
-- Created: 2025-12-28 (Phase 14.5)
-- =============================================================================

-- =============================================================================
-- 1. Add category column to document_chunks (Denormalization for performance)
-- =============================================================================
ALTER TABLE public.document_chunks 
ADD COLUMN IF NOT EXISTS category TEXT DEFAULT '미분류';

-- =============================================================================
-- 2. Migrate existing data: Copy category from user_documents
-- =============================================================================
UPDATE public.document_chunks dc
SET category = COALESCE(ud.category, '미분류')
FROM public.user_documents ud
WHERE dc.document_id = ud.id
  AND dc.category IS NULL;

-- Ensure no NULLs remain
UPDATE public.document_chunks 
SET category = '미분류' 
WHERE category IS NULL;

-- =============================================================================
-- 3. Create composite index for category-scoped search
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_document_chunks_user_category 
ON public.document_chunks(user_id, category);

-- =============================================================================
-- 4. Update match_document_chunks RPC function (v2 - Category Support)
-- =============================================================================
-- Description: Finds similar document chunks with optional category filter
-- If category_param is NULL, searches across all categories
-- =============================================================================
CREATE OR REPLACE FUNCTION match_document_chunks (
  query_embedding vector(1536),
  match_threshold float,
  match_count int,
  user_id_param uuid,
  category_param text DEFAULT NULL  -- NULL = search all categories
) RETURNS TABLE (
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
    dc.id,
    dc.document_id,
    dc.content,
    dc.metadata,
    1 - (dc.embedding <=> query_embedding) as similarity
  FROM public.document_chunks dc
  WHERE dc.user_id = user_id_param
    -- Category filter: NULL means all categories
    AND (category_param IS NULL OR dc.category = category_param)
    AND 1 - (dc.embedding <=> query_embedding) > match_threshold
  ORDER BY dc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- =============================================================================
-- 5. Trigger to sync category on chunk insert/update
-- =============================================================================
-- Ensure new chunks inherit category from their parent document
CREATE OR REPLACE FUNCTION sync_chunk_category()
RETURNS TRIGGER AS $$
BEGIN
  -- Get category from parent document
  SELECT category INTO NEW.category
  FROM public.user_documents
  WHERE id = NEW.document_id;
  
  -- Fallback if not found
  IF NEW.category IS NULL THEN
    NEW.category := '미분류';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger (only if not exists)
DROP TRIGGER IF EXISTS sync_chunk_category_trigger ON public.document_chunks;
CREATE TRIGGER sync_chunk_category_trigger
  BEFORE INSERT ON public.document_chunks
  FOR EACH ROW
  EXECUTE FUNCTION sync_chunk_category();
