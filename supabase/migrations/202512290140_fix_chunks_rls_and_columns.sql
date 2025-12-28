-- =============================================================================
-- Final Schema Fix: rag_chunks RLS & User Documents Columns
-- Date: 2025-12-29
-- =============================================================================

-- 1. Add missing column 'started_at' to user_documents
-- (Required for documentProcessor log)
ALTER TABLE user_documents ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ;
ALTER TABLE user_documents ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- 2. Enable RLS on rag_chunks (Critical for Security)
ALTER TABLE rag_chunks ENABLE ROW LEVEL SECURITY;

-- 3. Define RLS Policies for rag_chunks
-- Note: rag_chunks does not have user_id, so we verify ownership via user_documents JOIN.

DROP POLICY IF EXISTS "Users can insert own chunks" ON rag_chunks;
DROP POLICY IF EXISTS "Users can select own chunks" ON rag_chunks;
DROP POLICY IF EXISTS "Users can delete own chunks" ON rag_chunks;

-- Insert: Check if the parent document belongs to the user
CREATE POLICY "Users can insert own chunks" 
ON rag_chunks FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_documents 
    WHERE id = rag_chunks.document_id 
    AND user_id = auth.uid()
  )
);

-- Select: Check if the parent document belongs to the user
CREATE POLICY "Users can select own chunks" 
ON rag_chunks FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM user_documents 
    WHERE id = rag_chunks.document_id 
    AND user_id = auth.uid()
  )
);

-- Delete: Check if the parent document belongs to the user
CREATE POLICY "Users can delete own chunks" 
ON rag_chunks FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM user_documents 
    WHERE id = rag_chunks.document_id 
    AND user_id = auth.uid()
  )
);

-- 4. Reload Schema Cache
NOTIFY pgrst, 'reload schema';
