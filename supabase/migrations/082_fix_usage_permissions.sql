-- =============================================================================
-- Migration: 082_fix_usage_permissions.sql
-- =============================================================================
-- 작성일: 2026-01-07
-- 목적: 사용량 쿼리 권한(RLS) 문제 해결 (유료 서비스 필수 기능)
-- 설명:
--   - Frontend에서 'llm_daily_usage', 'llm_usage_summary'를 직접 조회할 때 권한 에러 발생
--   - 해당 테이블에 대해 '내 데이터만 조회 가능'한 RLS 정책 명시적 적용
--   - GRANT SELECT 권한 부여
-- =============================================================================

BEGIN;

-- =============================================================================
-- [SECTION 1] llm_daily_usage 권한 설정
-- =============================================================================

-- 1. RLS 활성화 (이미 되어있어도 안전)
ALTER TABLE IF EXISTS public.llm_daily_usage ENABLE ROW LEVEL SECURITY;

-- 2. 기본 권한 부여
GRANT SELECT ON public.llm_daily_usage TO authenticated;

-- 3. 기존 정책 정리 (충돌 방지)
DROP POLICY IF EXISTS "Users can view own daily usage" ON public.llm_daily_usage;
DROP POLICY IF EXISTS "Users can insert own daily usage" ON public.llm_daily_usage; -- RPC가 하지만 혹시 모를 직접 접근 대비

-- 4. 조회 정책 생성
CREATE POLICY "Users can view own daily usage"
ON public.llm_daily_usage
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- =============================================================================
-- [SECTION 2] llm_usage_summary 권한 설정
-- =============================================================================

-- 1. RLS 활성화
ALTER TABLE IF EXISTS public.llm_usage_summary ENABLE ROW LEVEL SECURITY;

-- 2. 기본 권한 부여
GRANT SELECT ON public.llm_usage_summary TO authenticated;

-- 3. 기존 정책 정리
DROP POLICY IF EXISTS "Users can view own usage summary" ON public.llm_usage_summary;

-- 4. 조회 정책 생성
CREATE POLICY "Users can view own usage summary"
ON public.llm_usage_summary
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- =============================================================================
-- [SECTION 3] 확인용 코멘트
-- =============================================================================

COMMENT ON TABLE public.llm_daily_usage IS '사용자 일일 LLM 사용량 (RLS: 본인 데이터만 조회)';
COMMENT ON TABLE public.llm_usage_summary IS '사용자 월간 사용량 요약 (RLS: 본인 데이터만 조회)';

COMMIT;
