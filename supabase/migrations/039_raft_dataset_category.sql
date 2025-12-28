-- Migration: Add category column to raft_dataset
-- Description: Supports Category Data Isolation for RAFT synthetic data
-- Author: Tech Lead
-- Date: 2025-12-28

-- 1. Add category column with default value '미분류' (Uncategorized)
--    Uses IF NOT EXISTS to prevent errors on re-run
ALTER TABLE public.raft_dataset
ADD COLUMN IF NOT EXISTS category TEXT DEFAULT '미분류';

-- 2. Create index for fast filtering by category
--    Essential for isolating data in the UI and API
CREATE INDEX IF NOT EXISTS idx_raft_dataset_category
ON public.raft_dataset(category);

-- 3. Create composite index for 'source' + 'category' filtering
--    Optimizes queries that filter by both source (e.g. 'synthetic') and category
CREATE INDEX IF NOT EXISTS idx_raft_dataset_source_category
ON public.raft_dataset(source, category);

-- 4. Comment on column for documentation
COMMENT ON COLUMN public.raft_dataset.category IS 'Category of the knowledge domain (e.g. Marketing, Tech). Used for data isolation.';
