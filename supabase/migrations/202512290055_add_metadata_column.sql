-- =============================================================================
-- Fix: Add missing 'metadata' column to user_documents
-- Date: 2025-12-29
-- Issue: File upload fails with PGRST204 (column not found)
-- =============================================================================

-- 1. Add metadata column (JSONB type for flexibility)
ALTER TABLE user_documents 
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- 2. Add comment
COMMENT ON COLUMN user_documents.metadata IS 'Stores additional file metadata like size, type, or custom tags';

-- 3. (Optional) Refresh schema cache is handled automatically by DDL execution,
-- but explicit reload can be done via Supabase Dashboard if needed.
