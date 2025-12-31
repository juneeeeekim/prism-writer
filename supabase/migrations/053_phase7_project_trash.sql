-- =============================================================================
-- Phase 7: 프로젝트 휴지통 시스템 - DB 마이그레이션
-- =============================================================================
-- 파일: supabase/migrations/053_phase7_project_trash.sql
-- 생성일: 2026-01-01
-- 담당: Tech Lead + JeDebug 패치 적용
--
-- [P7-01-A] 프로젝트 소프트 삭제를 위한 deleted_at 컬럼 및 RLS 정책 추가
-- 
-- 변경 사항:
--   1. deleted_at 컬럼 추가 (NULL = 활성, 값 있음 = 휴지통)
--   2. 활성 프로젝트 RLS 정책 (deleted_at IS NULL)
--   3. 휴지통 프로젝트 RLS 정책 (deleted_at IS NOT NULL) 
--   4. 인덱스 추가 (조회 성능 최적화)
-- =============================================================================

-- =============================================================================
-- [Step 1] deleted_at 컬럼 추가
-- =============================================================================
-- 설명: 소프트 삭제를 위한 타임스탬프 컬럼
-- NULL = 활성 프로젝트 (삭제되지 않음)
-- 값 있음 = 휴지통에 있음 (삭제 시간 기록)

ALTER TABLE public.projects 
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

COMMENT ON COLUMN public.projects.deleted_at IS '소프트 삭제 시간 (NULL=활성, 값=휴지통)';

-- =============================================================================
-- [Step 2] 기존 RLS 정책 삭제
-- =============================================================================
-- 설명: 새 정책 적용 전 기존 정책 제거 (멱등성 보장)

DROP POLICY IF EXISTS "projects_user_crud" ON public.projects;
DROP POLICY IF EXISTS "projects_user_active" ON public.projects;
DROP POLICY IF EXISTS "projects_user_trash" ON public.projects;
DROP POLICY IF EXISTS "projects_active_access" ON public.projects;
DROP POLICY IF EXISTS "projects_trash_access" ON public.projects;

-- =============================================================================
-- [Step 3] 활성 프로젝트 RLS 정책
-- =============================================================================
-- 설명: deleted_at이 NULL인 프로젝트만 일반 CRUD 허용
-- 적용 대상: SELECT, INSERT, UPDATE (DELETE 제외 - 휴지통 경유 필수)

CREATE POLICY "projects_active_access" ON public.projects
  FOR ALL USING (
    auth.uid() = user_id 
    AND deleted_at IS NULL
  );

-- =============================================================================
-- [Step 4] 휴지통 프로젝트 RLS 정책 (JeDebug 패치 #1)
-- =============================================================================
-- 설명: deleted_at이 NOT NULL인 프로젝트 접근 허용
-- 적용 대상: SELECT(목록 조회), UPDATE(복구), DELETE(영구 삭제)
-- ⭐ DELETE 권한 포함 - 영구 삭제 가능하도록!

CREATE POLICY "projects_trash_access" ON public.projects
  FOR ALL USING (
    auth.uid() = user_id 
    AND deleted_at IS NOT NULL
  );

-- =============================================================================
-- [Step 5] 인덱스 추가
-- =============================================================================
-- 설명: deleted_at 기반 조회 성능 최적화

CREATE INDEX IF NOT EXISTS idx_projects_deleted 
  ON public.projects(user_id, deleted_at);

-- =============================================================================
-- 마이그레이션 완료 로그
-- =============================================================================

DO $$
BEGIN
  RAISE NOTICE '[Phase7] 053_phase7_project_trash.sql 마이그레이션 완료';
  RAISE NOTICE '  - projects.deleted_at 컬럼 추가';
  RAISE NOTICE '  - projects_active_access 정책 생성';
  RAISE NOTICE '  - projects_trash_access 정책 생성 (DELETE 포함)';
  RAISE NOTICE '  - idx_projects_deleted 인덱스 생성';
END $$;
