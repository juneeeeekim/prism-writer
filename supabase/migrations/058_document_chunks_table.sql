-- =============================================================================
-- Migration: 058_document_chunks_table.sql
-- Description: Create document_chunks table for RAG pipeline
-- Created: 2026-01-01
-- =============================================================================
-- This migration creates the document_chunks table that is required by the
-- match_document_chunks RPC function and RAFT context API.
-- =============================================================================

-- =============================================================================
-- 1. Enable pgvector extension (if not already enabled)
-- =============================================================================
CREATE EXTENSION IF NOT EXISTS vector;

-- =============================================================================
-- 2. Create document_chunks table
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.document_chunks (
    -- -------------------------------------------------------------------------
    -- Primary key
    -- -------------------------------------------------------------------------
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- -------------------------------------------------------------------------
    -- Foreign keys
    -- -------------------------------------------------------------------------
    document_id UUID NOT NULL REFERENCES public.user_documents(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- -------------------------------------------------------------------------
    -- Chunk content and index
    -- -------------------------------------------------------------------------
    chunk_index INTEGER NOT NULL CHECK (chunk_index >= 0),
    content TEXT NOT NULL,
    
    -- -------------------------------------------------------------------------
    -- Vector embedding (OpenAI text-embedding-3-small: 1536 dimensions)
    -- -------------------------------------------------------------------------
    embedding vector(1536),
    
    -- -------------------------------------------------------------------------
    -- Metadata (JSONB for flexibility)
    -- -------------------------------------------------------------------------
    metadata JSONB DEFAULT '{}'::jsonb,
    
    -- -------------------------------------------------------------------------
    -- Category (for category-scoped RAG)
    -- -------------------------------------------------------------------------
    category TEXT DEFAULT '미분류',
    
    -- -------------------------------------------------------------------------
    -- Embedding version tracking
    -- -------------------------------------------------------------------------
    embedding_model_id TEXT DEFAULT 'text-embedding-3-small',
    embedding_dim INTEGER DEFAULT 1536,
    embedded_at TIMESTAMPTZ,
    
    -- -------------------------------------------------------------------------
    -- Timestamps
    -- -------------------------------------------------------------------------
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- -------------------------------------------------------------------------
    -- Constraint: unique chunk index per document
    -- -------------------------------------------------------------------------
    CONSTRAINT unique_chunk_per_user_document UNIQUE(document_id, chunk_index)
);

-- =============================================================================
-- 3. Create indexes for performance
-- =============================================================================

-- Index for document lookup
CREATE INDEX IF NOT EXISTS idx_document_chunks_document_id 
    ON public.document_chunks(document_id);

-- Index for user lookup
CREATE INDEX IF NOT EXISTS idx_document_chunks_user_id 
    ON public.document_chunks(user_id);

-- Composite index for user + category (category-scoped search)
CREATE INDEX IF NOT EXISTS idx_document_chunks_user_category 
    ON public.document_chunks(user_id, category);

-- Index for ordering chunks within a document
CREATE INDEX IF NOT EXISTS idx_document_chunks_document_index 
    ON public.document_chunks(document_id, chunk_index);

-- HNSW index for vector similarity search
CREATE INDEX IF NOT EXISTS idx_document_chunks_embedding 
    ON public.document_chunks 
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);

-- =============================================================================
-- 4. Enable RLS (Row Level Security)
-- =============================================================================
ALTER TABLE public.document_chunks ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- 5. RLS Policies
-- =============================================================================

-- Policy: Users can view own chunks
CREATE POLICY "Users can view own document chunks"
    ON public.document_chunks
    FOR SELECT
    USING (user_id = auth.uid());

-- Policy: Users can insert own chunks
CREATE POLICY "Users can insert own document chunks"
    ON public.document_chunks
    FOR INSERT
    WITH CHECK (user_id = auth.uid());

-- Policy: Users can update own chunks
CREATE POLICY "Users can update own document chunks"
    ON public.document_chunks
    FOR UPDATE
    USING (user_id = auth.uid());

-- Policy: Users can delete own chunks
CREATE POLICY "Users can delete own document chunks"
    ON public.document_chunks
    FOR DELETE
    USING (user_id = auth.uid());

-- Policy: Allow server/service role full access
CREATE POLICY "Allow server read document chunks"
    ON public.document_chunks
    FOR SELECT
    USING (true);

-- =============================================================================
-- 6. Create/Update match_document_chunks RPC function
-- =============================================================================
CREATE OR REPLACE FUNCTION match_document_chunks (
  query_embedding vector(1536),
  match_threshold float,
  match_count int,
  user_id_param uuid,
  category_param text DEFAULT NULL
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
    AND (category_param IS NULL OR dc.category = category_param)
    AND 1 - (dc.embedding <=> query_embedding) > match_threshold
  ORDER BY dc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- =============================================================================
-- 7. Trigger to sync category from parent document
-- =============================================================================
CREATE OR REPLACE FUNCTION sync_chunk_category()
RETURNS TRIGGER AS $$
BEGIN
  SELECT category INTO NEW.category
  FROM public.user_documents
  WHERE id = NEW.document_id;
  
  IF NEW.category IS NULL THEN
    NEW.category := '미분류';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS sync_chunk_category_trigger ON public.document_chunks;
CREATE TRIGGER sync_chunk_category_trigger
  BEFORE INSERT ON public.document_chunks
  FOR EACH ROW
  EXECUTE FUNCTION sync_chunk_category();

-- =============================================================================
-- 8. Comments
-- =============================================================================
COMMENT ON TABLE public.document_chunks IS 
    'RAG 시스템용 문서 청크 및 임베딩 저장 테이블';

COMMENT ON COLUMN public.document_chunks.embedding IS 
    '벡터 임베딩 (1536 차원, OpenAI text-embedding-3-small)';

-- =============================================================================
-- Migration Complete
-- =============================================================================
