-- =============================================================================
-- Final Schema Fix: Foreign Key Constraint
-- Date: 2025-12-29
-- Issue: rag_chunks still references 'rag_documents', but we act on 'user_documents'
-- Error: violates foreign key constraint "rag_chunks_document_id_fkey"
-- =============================================================================

-- 1. Drop old foreign key constraint (referencing rag_documents)
ALTER TABLE rag_chunks 
DROP CONSTRAINT IF EXISTS rag_chunks_document_id_fkey;

-- 2. Add new foreign key constraint (referencing user_documents)
-- This ensures that when a document in user_documents is deleted, 
-- its chunks in rag_chunks are also deleted (Cascade).
ALTER TABLE rag_chunks
ADD CONSTRAINT rag_chunks_document_id_fkey
FOREIGN KEY (document_id)
REFERENCES user_documents(id)
ON DELETE CASCADE;

-- 3. Reload Schema Cache
NOTIFY pgrst, 'reload schema';
