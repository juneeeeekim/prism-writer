-- =============================================================================
-- Final Schema Fix: Embedding Usage RLS
-- Date: 2025-12-29
-- Issue: 'embedding_usage' table RLS violation (42501)
-- =============================================================================

-- Enable RLS on embedding_usage (if not already)
ALTER TABLE embedding_usage ENABLE ROW LEVEL SECURITY;

-- Drop old policies to avoid conflicts
DROP POLICY IF EXISTS "Users can insert own usage" ON embedding_usage;
DROP POLICY IF EXISTS "Users can select own usage" ON embedding_usage;

-- 1. Insert Policy
CREATE POLICY "Users can insert own usage" 
ON embedding_usage FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- 2. Select Policy
CREATE POLICY "Users can select own usage" 
ON embedding_usage FOR SELECT 
USING (auth.uid() = user_id);

-- Reload Schema Cache
NOTIFY pgrst, 'reload schema';
