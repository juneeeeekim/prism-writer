-- =============================================================================
-- PRISM Writer - RAFT Dataset Migration
-- =============================================================================
-- 파일명: supabase/migrations/028_raft_dataset.sql
-- 작성일: 2025-12-27
-- 설명: RAFT 파인튜닝용 데이터셋 테이블 생성
-- 
-- [목차]
-- 1. raft_dataset 테이블 생성
-- 2. 인덱스 생성
-- 3. RLS 정책 설정 (Service Role 전용)
-- 4. 업데이트 트리거 설정
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. raft_dataset 테이블 생성
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.raft_dataset (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- 데이터 필드
    user_query TEXT NOT NULL,          -- 사용자 질문
    context TEXT NOT NULL,             -- 참고 자료 (Context)
    gold_answer TEXT NOT NULL,         -- 정답 (Gold Answer)
    bad_answer TEXT,                   -- 오답 (Bad Answer, 선택)
    
    -- 메타데이터
    source TEXT NOT NULL CHECK (source IN ('synthetic', 'user_feedback', 'manual', 'ab_test')),
    verified BOOLEAN NOT NULL DEFAULT FALSE,
    model_id TEXT,                     -- 생성에 사용된 모델 ID
    
    -- 추적 정보
    original_feedback_id UUID REFERENCES public.hallucination_feedback(id),
    
    -- 제약 조건
    CONSTRAINT check_user_query_length CHECK (length(user_query) >= 10),
    CONSTRAINT check_gold_answer_length CHECK (length(gold_answer) >= 10)
);

-- -----------------------------------------------------------------------------
-- 2. 인덱스 생성
-- -----------------------------------------------------------------------------
-- 최신순 조회용
CREATE INDEX IF NOT EXISTS idx_raft_dataset_created_at ON public.raft_dataset(created_at DESC);
-- 소스별 필터링용
CREATE INDEX IF NOT EXISTS idx_raft_dataset_source ON public.raft_dataset(source);
-- 원본 피드백 중복 방지용
CREATE UNIQUE INDEX IF NOT EXISTS idx_raft_dataset_feedback_id ON public.raft_dataset(original_feedback_id) 
WHERE original_feedback_id IS NOT NULL;

-- -----------------------------------------------------------------------------
-- 3. RLS 정책 설정
-- -----------------------------------------------------------------------------
ALTER TABLE public.raft_dataset ENABLE ROW LEVEL SECURITY;

-- Service Role (백엔드 API) 및 관리자만 접근 가능
CREATE POLICY "Enable all access for service role only" ON public.raft_dataset
    FOR ALL
    USING (auth.role() = 'service_role');

-- -----------------------------------------------------------------------------
-- 4. 업데이트 트리거 설정
-- -----------------------------------------------------------------------------
CREATE TRIGGER update_raft_dataset_updated_at
    BEFORE UPDATE ON public.raft_dataset
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
