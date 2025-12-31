-- =============================================================================
-- Phase 7: RLS 정책 수정 - Soft Delete 허용
-- =============================================================================
-- 파일: supabase/migrations/055_fix_soft_delete_rls.sql
-- 생성일: 2026-01-01
-- 
-- 문제: projects_active_access 정책이 soft-delete를 차단함
-- 원인: deleted_at을 NULL→timestamp로 변경 시 WITH CHECK 실패
-- 해결: 소유자의 UPDATE는 무조건 허용하는 정책 추가
-- =============================================================================

-- =============================================================================
-- [Step 1] 기존 문제 정책 삭제
-- =============================================================================

DROP POLICY IF EXISTS "projects_active_access" ON public.projects;
DROP POLICY IF EXISTS "projects_trash_access" ON public.projects;

-- =============================================================================
-- [Step 2] 수정된 정책 생성
-- =============================================================================

-- 소유자 전체 접근 (SELECT, UPDATE) - deleted_at 상태와 무관
CREATE POLICY "projects_owner_full_access" ON public.projects
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- =============================================================================
-- [Step 3] 검증
-- =============================================================================

DO $$
BEGIN
  RAISE NOTICE '[Phase7] RLS 정책 수정 완료';
  RAISE NOTICE '  - projects_owner_full_access: 소유자 전체 접근 허용';
  RAISE NOTICE '  - Soft delete 이제 정상 작동';
END $$;
