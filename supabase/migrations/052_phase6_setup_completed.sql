-- =============================================================================
-- Phase 6.3: 프로젝트 온보딩 완료 상태 추가
-- =============================================================================
-- 파일: supabase/migrations/052_phase6_setup_completed.sql
-- 생성일: 2026-01-01
-- 담당: Tech Lead
--
-- 주석(시니어 개발자): 이 마이그레이션은 프로젝트에 온보딩 완료 상태를 추가합니다.
-- 새 프로젝트는 setup_completed = false로 시작하고, 참고자료 업로드 후 true로 변경됩니다.
-- 기존 프로젝트는 모두 true로 설정합니다 (이미 사용 중이므로).
-- =============================================================================

-- =============================================================================
-- [P6-03-A] projects 테이블에 setup_completed 컬럼 추가
-- =============================================================================

-- setup_completed 컬럼 추가 (존재하지 않는 경우에만)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'projects'
    AND column_name = 'setup_completed'
  ) THEN
    -- 새 컬럼 추가 (기본값 false - 새 프로젝트는 온보딩 필요)
    ALTER TABLE public.projects
      ADD COLUMN setup_completed BOOLEAN DEFAULT false;

    -- 기존 프로젝트는 모두 true로 설정 (이미 사용 중)
    UPDATE public.projects SET setup_completed = true WHERE setup_completed IS NULL;

    RAISE NOTICE '[Phase6.3] projects.setup_completed 컬럼 추가 완료';
  ELSE
    RAISE NOTICE '[Phase6.3] projects.setup_completed 컬럼이 이미 존재합니다';
  END IF;
END $$;

-- 컬럼 코멘트
COMMENT ON COLUMN public.projects.setup_completed IS '온보딩 완료 여부: false(참고자료 설정 필요) | true(설정 완료)';

-- 인덱스 추가 (온보딩 미완료 프로젝트 조회 최적화)
CREATE INDEX IF NOT EXISTS idx_projects_setup_completed
  ON public.projects(user_id, setup_completed);

-- =============================================================================
-- 마이그레이션 완료 로그
-- =============================================================================

DO $$
BEGIN
  RAISE NOTICE '[Phase6.3] 052_phase6_setup_completed.sql 마이그레이션 완료';
  RAISE NOTICE '  - projects.setup_completed 컬럼 추가';
  RAISE NOTICE '  - 기존 프로젝트는 true로 설정';
END $$;
