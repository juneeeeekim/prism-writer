-- =============================================================================
-- Migration: 038_document_evaluations.sql
-- Description: Add document_id column to evaluation_logs for document-scoped evaluations
-- Created: 2025-12-28 (Phase 15)
-- =============================================================================

-- =============================================================================
-- 1. Add document_id column to evaluation_logs
-- =============================================================================
-- NULL 허용으로 기존 데이터 호환성 유지
ALTER TABLE public.evaluation_logs 
ADD COLUMN IF NOT EXISTS document_id UUID REFERENCES public.user_documents(id) ON DELETE CASCADE;

-- =============================================================================
-- 2. Create indexes for performance optimization
-- =============================================================================
-- 단일 컬럼 인덱스 (document_id 기준 조회)
CREATE INDEX IF NOT EXISTS idx_evaluation_logs_document_id 
ON public.evaluation_logs(document_id);

-- 복합 인덱스 (user_id + document_id 기준 조회 - 가장 흔한 쿼리 패턴)
CREATE INDEX IF NOT EXISTS idx_evaluation_logs_user_document 
ON public.evaluation_logs(user_id, document_id);

-- =============================================================================
-- 3. Add comment for documentation
-- =============================================================================
COMMENT ON COLUMN public.evaluation_logs.document_id IS 'Phase 15: 평가가 속한 문서 ID (NULL = 미연결 또는 삭제됨)';
