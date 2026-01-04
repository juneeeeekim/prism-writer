-- =============================================================================
-- Migration: 074_rag_logs.sql
-- =============================================================================
-- 작성일: 2026-01-04
-- 목적: RAG 검색 메트릭 로깅 테이블 생성 (P-C03-01)
-- 설명:
--   - RAG 검색 요청의 성능 및 사용 패턴 추적
--   - 캐시 히트율, 응답 시간, 에러율 분석
--   - 서비스 품질 모니터링 및 최적화 근거 확보
--
-- [개인정보 보호]
-- - 쿼리 텍스트는 최대 100자로 제한 (마스킹)
-- - 사용자 식별은 user_id만 사용 (이름, 이메일 저장 안함)
-- - 오래된 로그는 주기적으로 삭제 권장 (30일)
-- =============================================================================

-- =============================================================================
-- [SECTION 1] 테이블 생성
-- =============================================================================
-- rag_logs: RAG 검색 메트릭 저장
-- - user_id: 요청한 사용자 (선택)
-- - query: 검색 쿼리 (100자 제한)
-- - search_method: 검색 방법 (vector, keyword, hybrid)
-- - result_count: 반환된 결과 수
-- - latency_ms: 응답 시간 (밀리초)
-- - cache_hit: 캐시 사용 여부
-- - error: 에러 메시지 (있는 경우)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.rag_logs (
    -- 기본 키
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- 사용자 정보 (선택 - NULL 허용)
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,

    -- 프로젝트 정보 (선택 - 프로젝트별 분석용)
    project_id UUID,

    -- 검색 요청 정보
    query TEXT,  -- 최대 100자로 제한하여 저장 (프론트엔드에서 처리)
    search_method TEXT NOT NULL DEFAULT 'hybrid',  -- 'vector', 'keyword', 'hybrid'

    -- 검색 결과 정보
    result_count INTEGER NOT NULL DEFAULT 0,
    top_score FLOAT,  -- 최고 유사도 점수 (0.0 ~ 1.0)

    -- 성능 메트릭
    latency_ms INTEGER NOT NULL DEFAULT 0,  -- 응답 시간 (밀리초)
    embedding_latency_ms INTEGER,  -- 임베딩 생성 시간
    search_latency_ms INTEGER,  -- DB 검색 시간

    -- 캐시 정보
    cache_hit BOOLEAN NOT NULL DEFAULT false,  -- 캐시 사용 여부
    cache_key TEXT,  -- 캐시 키 (디버깅용)

    -- 에러 정보
    error TEXT,  -- 에러 메시지 (NULL이면 성공)
    error_code TEXT,  -- 에러 코드 (분류용)

    -- 메타데이터
    metadata JSONB DEFAULT '{}',  -- 추가 정보 (필터, 옵션 등)

    -- 타임스탬프
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 테이블 설명
COMMENT ON TABLE public.rag_logs IS
    '[P-C03-01] RAG 검색 메트릭 로깅 - 성능 모니터링 및 분석용';
COMMENT ON COLUMN public.rag_logs.query IS
    '검색 쿼리 (개인정보 보호를 위해 100자 제한 권장)';
COMMENT ON COLUMN public.rag_logs.latency_ms IS
    '총 응답 시간 (밀리초)';
COMMENT ON COLUMN public.rag_logs.cache_hit IS
    '임베딩 캐시 사용 여부';


-- =============================================================================
-- [SECTION 2] 인덱스 생성
-- =============================================================================
-- idx_rag_logs_user: 사용자별 로그 조회
-- idx_rag_logs_created: 시간순 조회 (최신 우선)
-- idx_rag_logs_project: 프로젝트별 로그 조회
-- idx_rag_logs_method: 검색 방법별 분석
-- =============================================================================

-- 사용자별 로그 조회 인덱스
CREATE INDEX IF NOT EXISTS idx_rag_logs_user
    ON public.rag_logs (user_id, created_at DESC)
    WHERE user_id IS NOT NULL;

-- 시간순 조회 인덱스 (최신 우선)
CREATE INDEX IF NOT EXISTS idx_rag_logs_created
    ON public.rag_logs (created_at DESC);

-- 프로젝트별 로그 조회 인덱스
CREATE INDEX IF NOT EXISTS idx_rag_logs_project
    ON public.rag_logs (project_id, created_at DESC)
    WHERE project_id IS NOT NULL;

-- 검색 방법별 분석 인덱스
CREATE INDEX IF NOT EXISTS idx_rag_logs_method
    ON public.rag_logs (search_method, created_at DESC);

-- 에러 로그 조회 인덱스
CREATE INDEX IF NOT EXISTS idx_rag_logs_errors
    ON public.rag_logs (created_at DESC)
    WHERE error IS NOT NULL;

-- 캐시 히트 분석 인덱스
CREATE INDEX IF NOT EXISTS idx_rag_logs_cache
    ON public.rag_logs (cache_hit, created_at DESC);


-- =============================================================================
-- [SECTION 3] RLS (Row Level Security) 정책
-- =============================================================================
-- 로그 데이터 보안:
-- - 사용자는 자신의 로그만 조회 가능
-- - 관리자는 모든 로그 조회 가능
-- - 삽입은 모든 인증된 사용자 가능
-- =============================================================================

-- RLS 활성화
ALTER TABLE public.rag_logs ENABLE ROW LEVEL SECURITY;

-- 정책 1: 읽기 - 자신의 로그만
CREATE POLICY "Users can read own logs"
    ON public.rag_logs
    FOR SELECT
    USING (user_id = auth.uid());

-- 정책 2: 삽입 - 인증된 사용자
CREATE POLICY "Authenticated users can insert logs"
    ON public.rag_logs
    FOR INSERT
    WITH CHECK (true);  -- 서비스 레벨에서 user_id 설정

-- 정책 3: 삭제 - 자신의 로그만 (선택)
CREATE POLICY "Users can delete own logs"
    ON public.rag_logs
    FOR DELETE
    USING (user_id = auth.uid());


-- =============================================================================
-- [SECTION 4] 통계 조회 함수
-- =============================================================================
-- get_rag_stats: RAG 검색 통계 조회
-- - 일별/주별/월별 통계
-- - 캐시 히트율
-- - 평균 응답 시간
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_rag_stats(
    p_user_id UUID DEFAULT NULL,
    p_days INTEGER DEFAULT 7
)
RETURNS TABLE (
    total_requests BIGINT,
    success_count BIGINT,
    error_count BIGINT,
    cache_hit_count BIGINT,
    cache_hit_rate NUMERIC,
    avg_latency_ms NUMERIC,
    avg_result_count NUMERIC,
    p50_latency_ms NUMERIC,
    p95_latency_ms NUMERIC
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
    SELECT
        COUNT(*) AS total_requests,
        COUNT(*) FILTER (WHERE error IS NULL) AS success_count,
        COUNT(*) FILTER (WHERE error IS NOT NULL) AS error_count,
        COUNT(*) FILTER (WHERE cache_hit = true) AS cache_hit_count,
        ROUND(
            COUNT(*) FILTER (WHERE cache_hit = true)::NUMERIC / NULLIF(COUNT(*), 0) * 100,
            2
        ) AS cache_hit_rate,
        ROUND(AVG(latency_ms), 2) AS avg_latency_ms,
        ROUND(AVG(result_count), 2) AS avg_result_count,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY latency_ms) AS p50_latency_ms,
        PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY latency_ms) AS p95_latency_ms
    FROM public.rag_logs
    WHERE created_at >= now() - (p_days || ' days')::INTERVAL
      AND (p_user_id IS NULL OR user_id = p_user_id);
$$;

COMMENT ON FUNCTION public.get_rag_stats(UUID, INTEGER) IS
    '[P-C03-01] RAG 검색 통계 조회 - 캐시 히트율, 응답 시간 등';


-- =============================================================================
-- [SECTION 5] 오래된 로그 정리 함수
-- =============================================================================
-- cleanup_old_rag_logs: 지정된 일수보다 오래된 로그 삭제
-- - 기본 30일
-- - Cron Job으로 주기적 실행 권장
-- =============================================================================

CREATE OR REPLACE FUNCTION public.cleanup_old_rag_logs(
    p_days INTEGER DEFAULT 30
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    WITH deleted AS (
        DELETE FROM public.rag_logs
        WHERE created_at < now() - (p_days || ' days')::INTERVAL
        RETURNING id
    )
    SELECT COUNT(*) INTO deleted_count FROM deleted;

    RAISE NOTICE '[rag_logs] Cleaned up % logs older than % days', deleted_count, p_days;

    RETURN deleted_count;
END;
$$;

COMMENT ON FUNCTION public.cleanup_old_rag_logs(INTEGER) IS
    '[P-C03-01] 오래된 RAG 로그 정리 - 기본 30일';


-- =============================================================================
-- [SECTION 6] 일별 통계 뷰 (선택)
-- =============================================================================
-- 대시보드용 일별 통계 뷰
-- =============================================================================

CREATE OR REPLACE VIEW public.rag_logs_daily_stats AS
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

COMMENT ON VIEW public.rag_logs_daily_stats IS
    '[P-C03-01] RAG 검색 일별 통계 뷰';


-- =============================================================================
-- [SECTION 7] 권한 설정
-- =============================================================================

GRANT SELECT, INSERT, DELETE ON public.rag_logs TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_rag_stats(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_old_rag_logs(INTEGER) TO authenticated;
GRANT SELECT ON public.rag_logs_daily_stats TO authenticated;


-- =============================================================================
-- [END] Migration 074_rag_logs.sql
-- =============================================================================
