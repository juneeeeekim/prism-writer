-- =============================================================================
-- Fix: Reset and Enforce RLS Policies for user_documents
-- Date: 2025-12-29
-- Issue: Upload fails with PGRST116 (0 rows) due to missing SELECT permission on INSERT
-- =============================================================================

-- 1. Enable RLS (Ensure it's on)
ALTER TABLE user_documents ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing policies to avoid conflicts and ensure clean state
DROP POLICY IF EXISTS "Users can insert their own documents" ON user_documents;
DROP POLICY IF EXISTS "Users can view their own documents" ON user_documents;
DROP POLICY IF EXISTS "Users can update their own documents" ON user_documents;
DROP POLICY IF EXISTS "Users can delete their own documents" ON user_documents;

-- 3. Re-create Policies covering all CRUD operations
-- INSERT
CREATE POLICY "Users can insert their own documents" 
ON user_documents FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- SELECT
CREATE POLICY "Users can view their own documents" 
ON user_documents FOR SELECT 
USING (auth.uid() = user_id);

-- UPDATE
CREATE POLICY "Users can update their own documents" 
ON user_documents FOR UPDATE
USING (auth.uid() = user_id);

-- DELETE
CREATE POLICY "Users can delete their own documents" 
ON user_documents FOR DELETE
USING (auth.uid() = user_id);

-- 4. Reload Schema Cache (Good practice)
NOTIFY pgrst, 'reload schema';
