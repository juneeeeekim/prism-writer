-- =============================================================================
-- Migration: 070_add_chunk_type.sql
-- Description: [R-09] Add chunk_type column to document_chunks table
-- Created: 2026-01-03
-- =============================================================================
-- [R-09] Retrieval Pipeline v2 - 청크 타입 필드 추가
-- 
-- Purpose:
-- - chunk_type으로 청크를 분류하여 검색 성능 향상
-- - 타입: 'rule' | 'example' | 'pattern' | 'general'
-- - DEFAULT 값으로 기존 데이터 하위 호환 보장
-- =============================================================================

-- =============================================================================
-- 1. Add chunk_type column
-- =============================================================================
-- Safety: DEFAULT 'general'로 기존 데이터 호환
ALTER TABLE public.document_chunks
ADD COLUMN IF NOT EXISTS chunk_type TEXT DEFAULT 'general';

-- =============================================================================
-- 2. Add comment for documentation
-- =============================================================================
COMMENT ON COLUMN public.document_chunks.chunk_type IS 
    '[R-09] 청크 타입: rule | example | pattern | general';

-- =============================================================================
-- 3. Create index for chunk_type queries
-- =============================================================================
-- Safety: CREATE INDEX IF NOT EXISTS로 중복 방지
CREATE INDEX IF NOT EXISTS idx_chunks_type 
    ON public.document_chunks(chunk_type);

-- =============================================================================
-- 4. Create composite index for user + chunk_type (optional optimization)
-- =============================================================================
-- Note: 사용자별 특정 타입 청크 검색 시 성능 향상
CREATE INDEX IF NOT EXISTS idx_chunks_user_type 
    ON public.document_chunks(user_id, chunk_type);

-- =============================================================================
-- 5. Verify column exists (optional check)
-- =============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'document_chunks' 
    AND column_name = 'chunk_type'
  ) THEN
    RAISE EXCEPTION 'chunk_type column was not created successfully';
  END IF;
END $$;

-- =============================================================================
-- Migration Complete
-- =============================================================================
