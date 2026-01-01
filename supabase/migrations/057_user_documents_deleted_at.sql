-- =============================================================================
-- Phase 7 Fix: user_documents 테이블에 deleted_at 컬럼 추가
-- =============================================================================
-- 파일: supabase/migrations/057_user_documents_deleted_at.sql
-- 생성일: 2026-01-01
-- 담당: Tech Lead
--
-- [P7-FIX] user_documents 테이블에도 deleted_at 컬럼 추가
-- 코드에서 deleted_at을 사용하고 있으나 DB에 컬럼이 없어 에러 발생
-- =============================================================================

-- =============================================================================
-- [Step 1] deleted_at 컬럼 추가
-- =============================================================================

ALTER TABLE public.user_documents 
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

COMMENT ON COLUMN public.user_documents.deleted_at IS '소프트 삭제 시간 (NULL=활성, 값=휴지통)';

-- =============================================================================
-- [Step 2] 인덱스 추가 (조회 성능 최적화)
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_user_documents_deleted 
  ON public.user_documents(user_id, deleted_at);

-- =============================================================================
-- 마이그레이션 완료 로그
-- =============================================================================

DO $$
BEGIN
  RAISE NOTICE '[P7-FIX] 057_user_documents_deleted_at.sql 마이그레이션 완료';
  RAISE NOTICE '  - user_documents.deleted_at 컬럼 추가';
  RAISE NOTICE '  - idx_user_documents_deleted 인덱스 생성';
END $$;
