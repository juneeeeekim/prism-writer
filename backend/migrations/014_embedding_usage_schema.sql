-- =============================================================================
-- PRISM Writer - Embedding Usage Tracking Schema
-- =============================================================================
-- 파일: backend/migrations/014_embedding_usage_schema.sql
-- 역할: 임베딩 사용량 추적 테이블 생성 (비용 관리)
-- 버전: v1.0
-- =============================================================================

-- =============================================================================
-- 1. 테이블 생성: embedding_usage
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.embedding_usage (
    -- -------------------------------------------------------------------------
    -- 기본 ID
    -- -------------------------------------------------------------------------
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- -------------------------------------------------------------------------
    -- 사용자 정보
    -- -------------------------------------------------------------------------
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- -------------------------------------------------------------------------
    -- 사용량 정보
    -- -------------------------------------------------------------------------
    tokens_used INTEGER NOT NULL CHECK (tokens_used > 0),
    
    -- -------------------------------------------------------------------------
    -- 메타데이터 (JSONB)
    -- -------------------------------------------------------------------------
    -- 예시: { "document_id": "...", "timestamp": "..." }
    metadata JSONB DEFAULT '{}'::jsonb,
    
    -- -------------------------------------------------------------------------
    -- 타임스탬프
    -- -------------------------------------------------------------------------
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- 2. 인덱스 생성
-- =============================================================================

-- 사용자별 사용량 조회
CREATE INDEX IF NOT EXISTS idx_embedding_usage_user_id 
    ON public.embedding_usage(user_id);

-- 날짜별 사용량 조회 (일일 한도 확인용)
CREATE INDEX IF NOT EXISTS idx_embedding_usage_created_at 
    ON public.embedding_usage(created_at);

-- 사용자 + 날짜 복합 인덱스 (일일 사용량 집계)
CREATE INDEX IF NOT EXISTS idx_embedding_usage_user_date 
    ON public.embedding_usage(user_id, created_at);

-- =============================================================================
-- 3. RLS (Row Level Security) 활성화
-- =============================================================================

ALTER TABLE public.embedding_usage ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- 4. RLS 정책 정의
-- =============================================================================

-- 사용자는 본인의 사용 기록만 조회 가능
CREATE POLICY "Users can view own usage"
    ON public.embedding_usage
    FOR SELECT
    USING (auth.uid() = user_id);

-- 사용량 기록은 시스템에서만 삽입 (서버측 코드)
-- 클라이언트에서는 직접 삽입 불가능하도록 제한 (보안)
CREATE POLICY "System can insert usage"
    ON public.embedding_usage
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- =============================================================================
-- 5. 기본 코멘트 (문서화)
-- =============================================================================

COMMENT ON TABLE public.embedding_usage IS 
    '임베딩 생성 사용량 추적 테이블 (비용 관리용, v1.0)';

COMMENT ON COLUMN public.embedding_usage.id IS 
    '사용 기록 고유 ID (UUID)';

COMMENT ON COLUMN public.embedding_usage.user_id IS 
    '사용자 ID (auth.users 참조)';

COMMENT ON COLUMN public.embedding_usage.tokens_used IS 
    '사용한 토큰 수';

COMMENT ON COLUMN public.embedding_usage.metadata IS 
    '추가 메타데이터 (JSONB): document_id, timestamp 등';

-- =============================================================================
-- 마이그레이션 완료
-- =============================================================================
