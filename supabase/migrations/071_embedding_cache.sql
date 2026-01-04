-- =============================================================================
-- Migration: 071_embedding_cache.sql
-- =============================================================================
-- 작성일: 2026-01-04
-- 목적: 임베딩 캐시 테이블 생성 (P-C01-01)
-- 설명:
--   - 검색 쿼리의 임베딩 벡터를 캐싱하여 API 호출 비용 절감
--   - SHA256 해시로 쿼리 식별, TTL 기반 만료 관리
--   - 히트 카운트로 캐시 효율성 모니터링
-- =============================================================================

-- =============================================================================
-- [SECTION 1] 테이블 생성
-- =============================================================================
-- embedding_cache: 쿼리 임베딩 캐시 저장
-- - query_hash: 쿼리 텍스트의 SHA256 해시 (UNIQUE 제약)
-- - embedding: 1536차원 Gemini 임베딩 벡터
-- - expires_at: TTL 기반 만료 시점
-- - hit_count: 캐시 적중 횟수 (모니터링용)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.embedding_cache (
    -- 기본 키
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- 캐시 키 (쿼리 해시)
    query_hash TEXT NOT NULL,

    -- 임베딩 벡터 (Gemini 1536차원)
    embedding vector(1536) NOT NULL,

    -- 타임스탬프
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL,

    -- 통계
    hit_count INTEGER NOT NULL DEFAULT 0,

    -- 사용자 격리 (선택적 - NULL이면 전역 캐시)
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,

    -- 유니크 제약 (사용자별 또는 전역)
    CONSTRAINT embedding_cache_query_hash_user_unique
        UNIQUE (query_hash, user_id)
);

-- 테이블 설명
COMMENT ON TABLE public.embedding_cache IS
    '쿼리 임베딩 캐시 - API 호출 비용 절감 및 응답 속도 향상';
COMMENT ON COLUMN public.embedding_cache.query_hash IS
    '쿼리 텍스트의 SHA256 해시값';
COMMENT ON COLUMN public.embedding_cache.embedding IS
    '1536차원 Gemini 임베딩 벡터';
COMMENT ON COLUMN public.embedding_cache.expires_at IS
    'TTL 기반 만료 시점 (기본 24시간)';
COMMENT ON COLUMN public.embedding_cache.hit_count IS
    '캐시 적중 횟수 (모니터링용)';


-- =============================================================================
-- [SECTION 2] 인덱스 생성
-- =============================================================================
-- idx_embedding_cache_lookup: 캐시 조회 최적화 (해시 + 만료시점)
-- idx_embedding_cache_expires: 만료된 캐시 정리 최적화
-- idx_embedding_cache_user: 사용자별 캐시 조회
-- =============================================================================

-- 캐시 조회용 복합 인덱스 (가장 자주 사용)
CREATE INDEX IF NOT EXISTS idx_embedding_cache_lookup
    ON public.embedding_cache (query_hash, expires_at)
    WHERE expires_at > now();

-- 만료된 캐시 정리용 인덱스
CREATE INDEX IF NOT EXISTS idx_embedding_cache_expires
    ON public.embedding_cache (expires_at);

-- 사용자별 캐시 조회 인덱스
CREATE INDEX IF NOT EXISTS idx_embedding_cache_user
    ON public.embedding_cache (user_id, query_hash)
    WHERE user_id IS NOT NULL;

-- 히트 카운트 통계용 인덱스 (선택)
CREATE INDEX IF NOT EXISTS idx_embedding_cache_hits
    ON public.embedding_cache (hit_count DESC)
    WHERE hit_count > 0;


-- =============================================================================
-- [SECTION 3] RLS (Row Level Security) 정책
-- =============================================================================
-- 캐시 데이터 보안:
-- - 사용자는 자신의 캐시만 조회/수정 가능
-- - 전역 캐시(user_id IS NULL)는 모든 사용자가 읽기 가능
-- =============================================================================

-- RLS 활성화
ALTER TABLE public.embedding_cache ENABLE ROW LEVEL SECURITY;

-- 정책 1: 읽기 - 자신의 캐시 또는 전역 캐시
CREATE POLICY "Users can read own or global cache"
    ON public.embedding_cache
    FOR SELECT
    USING (
        user_id IS NULL  -- 전역 캐시
        OR user_id = auth.uid()  -- 자신의 캐시
    );

-- 정책 2: 삽입 - 자신의 캐시만
CREATE POLICY "Users can insert own cache"
    ON public.embedding_cache
    FOR INSERT
    WITH CHECK (
        user_id IS NULL  -- 전역 캐시 (서비스 역할에서만)
        OR user_id = auth.uid()  -- 자신의 캐시
    );

-- 정책 3: 업데이트 - 자신의 캐시만 (hit_count 증가용)
CREATE POLICY "Users can update own cache"
    ON public.embedding_cache
    FOR UPDATE
    USING (
        user_id IS NULL
        OR user_id = auth.uid()
    )
    WITH CHECK (
        user_id IS NULL
        OR user_id = auth.uid()
    );

-- 정책 4: 삭제 - 자신의 캐시만
CREATE POLICY "Users can delete own cache"
    ON public.embedding_cache
    FOR DELETE
    USING (
        user_id = auth.uid()
    );


-- =============================================================================
-- [SECTION 4] 유틸리티 함수
-- =============================================================================
-- cleanup_expired_embedding_cache: 만료된 캐시 정리 함수
-- - Cron Job 또는 수동 실행용
-- - 반환값: 삭제된 행 수
-- =============================================================================

CREATE OR REPLACE FUNCTION public.cleanup_expired_embedding_cache()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- 만료된 캐시 삭제
    WITH deleted AS (
        DELETE FROM public.embedding_cache
        WHERE expires_at < now()
        RETURNING id
    )
    SELECT COUNT(*) INTO deleted_count FROM deleted;

    -- 로그 출력 (디버깅용)
    RAISE NOTICE '[embedding_cache] Cleaned up % expired entries', deleted_count;

    RETURN deleted_count;
END;
$$;

COMMENT ON FUNCTION public.cleanup_expired_embedding_cache() IS
    '만료된 임베딩 캐시 정리 함수 - Cron Job 또는 수동 실행';


-- =============================================================================
-- [SECTION 5] 캐시 통계 조회 함수
-- =============================================================================
-- get_embedding_cache_stats: 캐시 효율성 모니터링용
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_embedding_cache_stats()
RETURNS TABLE (
    total_entries BIGINT,
    valid_entries BIGINT,
    expired_entries BIGINT,
    total_hits BIGINT,
    avg_hits_per_entry NUMERIC,
    oldest_entry TIMESTAMPTZ,
    newest_entry TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
    SELECT
        COUNT(*) AS total_entries,
        COUNT(*) FILTER (WHERE expires_at > now()) AS valid_entries,
        COUNT(*) FILTER (WHERE expires_at <= now()) AS expired_entries,
        COALESCE(SUM(hit_count), 0) AS total_hits,
        COALESCE(AVG(hit_count), 0) AS avg_hits_per_entry,
        MIN(created_at) AS oldest_entry,
        MAX(created_at) AS newest_entry
    FROM public.embedding_cache;
$$;

COMMENT ON FUNCTION public.get_embedding_cache_stats() IS
    '임베딩 캐시 통계 조회 함수 - 모니터링용';


-- =============================================================================
-- [SECTION 6] 그랜트 권한
-- =============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON public.embedding_cache TO authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_embedding_cache() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_embedding_cache_stats() TO authenticated;


-- =============================================================================
-- [END] Migration 071_embedding_cache.sql
-- =============================================================================
