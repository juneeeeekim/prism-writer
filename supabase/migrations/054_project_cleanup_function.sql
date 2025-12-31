-- =============================================================================
-- Phase 7.5: 프로젝트 자동 정리 함수
-- =============================================================================
-- 파일: supabase/migrations/054_project_cleanup_function.sql
-- 생성일: 2026-01-01
-- 담당: Tech Lead
--
-- [P7-05-A] 30일 지난 삭제 프로젝트 자동 영구 삭제 함수
-- 
-- 사용법:
--   - Supabase Pro: pg_cron으로 매일 자동 실행
--   - Supabase Free: Edge Function 또는 수동 호출
-- =============================================================================

-- =============================================================================
-- [Step 1] 정리 함수 생성/업데이트
-- =============================================================================
-- 설명: 30일 이상 휴지통에 있는 프로젝트를 영구 삭제합니다.
-- CASCADE 삭제로 연관 데이터(문서, 평가, 채팅)도 함께 삭제됩니다.

CREATE OR REPLACE FUNCTION cleanup_deleted_projects()
RETURNS void AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- 30일 이상 지난 프로젝트 삭제
  DELETE FROM public.projects
  WHERE deleted_at IS NOT NULL
  AND deleted_at < now() - INTERVAL '30 days';
  
  -- 삭제된 행 수 가져오기
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  -- 로그 출력 (디버깅용)
  RAISE NOTICE '[P7-05-A] cleanup_deleted_projects: % 프로젝트 영구 삭제됨', deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 함수 코멘트
COMMENT ON FUNCTION cleanup_deleted_projects() IS '30일 이상 휴지통에 있는 프로젝트 영구 삭제';

-- =============================================================================
-- [Step 2] 수동 호출용 Wrapper RPC (Optional)
-- =============================================================================
-- 설명: Edge Function 또는 API에서 호출할 수 있는 RPC 엔드포인트

CREATE OR REPLACE FUNCTION run_project_cleanup()
RETURNS JSON AS $$
DECLARE
  deleted_count INTEGER;
  result JSON;
BEGIN
  -- 30일 이상 지난 프로젝트 삭제
  DELETE FROM public.projects
  WHERE deleted_at IS NOT NULL
  AND deleted_at < now() - INTERVAL '30 days';
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  -- JSON 결과 반환
  result := json_build_object(
    'success', true,
    'deleted_count', deleted_count,
    'executed_at', now()
  );
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION run_project_cleanup() IS 'API/Edge Function용 프로젝트 정리 RPC';

-- =============================================================================
-- [Step 3] pg_cron 설정 (Supabase Pro 플랜 전용)
-- =============================================================================
-- 참고: Free 플랜에서는 pg_cron 사용 불가
-- Pro 플랜에서는 아래 주석을 해제하고 실행

-- SELECT cron.schedule(
--   'cleanup-deleted-projects',  -- Job 이름
--   '0 3 * * *',                  -- 매일 오전 3시 (KST 기준 오후 12시)
--   $$SELECT cleanup_deleted_projects()$$
-- );

-- =============================================================================
-- 마이그레이션 완료 로그
-- =============================================================================

DO $$
BEGIN
  RAISE NOTICE '[Phase7.5] 054_project_cleanup_function.sql 마이그레이션 완료';
  RAISE NOTICE '  - cleanup_deleted_projects() 함수 생성';
  RAISE NOTICE '  - run_project_cleanup() RPC 생성';
  RAISE NOTICE '  - pg_cron은 Pro 플랜에서 별도 설정 필요';
END $$;
