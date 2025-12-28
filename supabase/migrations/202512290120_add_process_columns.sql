-- =============================================================================
-- Fix: Add processing columns to user_documents
-- Date: 2025-12-29
-- Issue: 'rag_documents' vs 'user_documents' mismatch causing PGRST116 & List Empty
-- =============================================================================

-- Add columns required for document processing and listing
ALTER TABLE user_documents 
ADD COLUMN IF NOT EXISTS file_path TEXT,
ADD COLUMN IF NOT EXISTS file_type TEXT,
ADD COLUMN IF NOT EXISTS file_size BIGINT,
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS error_message TEXT;

-- Reload Schema Cache
NOTIFY pgrst, 'reload schema';
