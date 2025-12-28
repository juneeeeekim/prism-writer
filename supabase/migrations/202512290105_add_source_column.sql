-- =============================================================================
-- Fix: Add missing 'source' and 'metadata' columns to user_documents
-- Date: 2025-12-29
-- Issue: File upload fails due to missing columns (PGRST204)
-- =============================================================================

-- 1. Add 'metadata' column (if missed previously)
ALTER TABLE user_documents 
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- 2. Add 'source' column (new error fix)
ALTER TABLE user_documents 
ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'upload';

-- 3. Comment on columns
COMMENT ON COLUMN user_documents.metadata IS 'Stores additional file metadata';
COMMENT ON COLUMN user_documents.source IS 'Source of the document (upload, web, etc.)';

-- 4. Reload PostgREST Schema Cache (Crucial for API to recognize new columns)
NOTIFY pgrst, 'reload schema';
