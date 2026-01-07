-- =============================================================================
-- Migration: 079_fix_security_definer_view.sql
-- =============================================================================
-- 작성일: 2026-01-07
-- 목적: SECURITY DEFINER 뷰 보안 취약점 수정
-- 설명:
--   - Supabase 보안 경고 해결: public.rag_logs_daily_stats
--   - SECURITY DEFINER → SECURITY INVOKER 변경
--   - 관리자(service_role)만 접근 가능하도록 제한
--
-- [보안 취약점]
-- - SECURITY DEFINER 뷰는 뷰 생성자의 권한으로 실행됨
-- - RLS(Row Level Security) 정책이 우회될 수 있음
-- - 일반 사용자가 전체 시스템 통계에 접근 가능한 위험
--
-- [해결 방법]
-- - SECURITY INVOKER로 변경하여 조회 사용자 권한 적용
-- - authenticated 사용자 접근 권한 제거
-- - service_role만 접근 가능하도록 설정
-- =============================================================================

BEGIN;

-- =============================================================================
-- [SECTION 1] 기존 뷰 삭제
-- =============================================================================
-- 기존 SECURITY DEFINER 뷰를 삭제합니다
-- =============================================================================

DROP VIEW IF EXISTS public.rag_logs_daily_stats;


-- =============================================================================
-- [SECTION 2] SECURITY INVOKER로 뷰 재생성
-- =============================================================================
-- security_invoker = true 옵션으로 뷰 생성
-- 이제 조회하는 사용자의 RLS 정책이 적용됩니다
-- =============================================================================

CREATE VIEW public.rag_logs_daily_stats 
WITH (security_invoker = true) 
AS
SELECT
    DATE(created_at) AS date,
    COUNT(*) AS total_requests,
    COUNT(*) FILTER (WHERE error IS NULL) AS success_count,
    COUNT(*) FILTER (WHERE cache_hit = true) AS cache_hit_count,
    ROUND(AVG(latency_ms), 2) AS avg_latency_ms,
    MAX(latency_ms) AS max_latency_ms,
    ROUND(AVG(result_count), 2) AS avg_result_count
FROM public.rag_logs
WHERE created_at >= now() - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- 뷰 설명 추가
COMMENT ON VIEW public.rag_logs_daily_stats IS
    '[P-C03-01] RAG 검색 일별 통계 뷰 (관리자 전용, SECURITY INVOKER)';


-- =============================================================================
-- [SECTION 3] 권한 설정 변경
-- =============================================================================
-- 일반 authenticated 사용자 접근 제거
-- service_role만 접근 가능하도록 설정
-- =============================================================================

-- 기존 권한 제거 (안전하게 진행)
REVOKE ALL ON public.rag_logs_daily_stats FROM authenticated;
REVOKE ALL ON public.rag_logs_daily_stats FROM anon;

-- service_role에만 SELECT 권한 부여
-- (service_role은 백엔드/관리자 API에서 사용)
GRANT SELECT ON public.rag_logs_daily_stats TO service_role;


-- =============================================================================
-- [SECTION 4] 관리자용 통계 함수 (선택사항)
-- =============================================================================
-- 프론트엔드 관리자 대시보드에서 사용할 수 있는 함수
-- 관리자 권한 체크 후 통계 반환
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_rag_daily_stats_admin()
RETURNS TABLE (
    date DATE,
    total_requests BIGINT,
    success_count BIGINT,
    cache_hit_count BIGINT,
    avg_latency_ms NUMERIC,
    max_latency_ms INTEGER,
    avg_result_count NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
    v_user_role TEXT;
BEGIN
    -- 현재 사용자의 역할 확인
    SELECT role INTO v_user_role
    FROM public.profiles
    WHERE id = auth.uid();
    
    -- 관리자가 아니면 에러 반환
    IF v_user_role != 'admin' THEN
        RAISE EXCEPTION 'Access denied: Admin role required';
    END IF;
    
    -- 관리자인 경우 통계 반환
    RETURN QUERY
    SELECT
        DATE(r.created_at) AS date,
        COUNT(*)::BIGINT AS total_requests,
        COUNT(*) FILTER (WHERE r.error IS NULL)::BIGINT AS success_count,
        COUNT(*) FILTER (WHERE r.cache_hit = true)::BIGINT AS cache_hit_count,
        ROUND(AVG(r.latency_ms), 2) AS avg_latency_ms,
        MAX(r.latency_ms) AS max_latency_ms,
        ROUND(AVG(r.result_count), 2) AS avg_result_count
    FROM public.rag_logs r
    WHERE r.created_at >= now() - INTERVAL '30 days'
    GROUP BY DATE(r.created_at)
    ORDER BY date DESC;
END;
$$;

COMMENT ON FUNCTION public.get_rag_daily_stats_admin() IS
    '[Security Fix] 관리자 전용 RAG 일별 통계 조회 함수';

-- 함수 실행 권한 부여
GRANT EXECUTE ON FUNCTION public.get_rag_daily_stats_admin() TO authenticated;


COMMIT;

-- =============================================================================
-- [END] Migration 079_fix_security_definer_view.sql
-- =============================================================================
-- 적용 후 확인:
-- 1. Supabase Dashboard > Database > Views에서 rag_logs_daily_stats 확인
-- 2. Security Advisor에서 경고가 사라졌는지 확인
-- 3. 관리자 API에서 get_rag_daily_stats_admin() 함수 테스트
-- =============================================================================
