-- =============================================================================
-- PRISM Writer - Telemetry & Feedback Infrastructure
-- =============================================================================
-- 파일: backend/migrations/024_telemetry_template_metrics.sql
-- 역할: 템플릿 성능 지표 및 실험(A/B Test) 관리를 위한 테이블 생성
-- Phase: Pipeline v3 Phase 4 - Task 4.2
-- =============================================================================

-- =============================================================================
-- 1. template_metrics 테이블 - 템플릿별 성능 지표 집계
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.template_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID NOT NULL REFERENCES public.rag_templates(id) ON DELETE CASCADE,
    
    -- 집계 지표
    usage_count INTEGER DEFAULT 0,          -- 총 사용 횟수
    avg_score FLOAT DEFAULT 0,              -- 평균 평가 점수
    pass_rate FLOAT DEFAULT 0,              -- Pass 비율
    avg_latency_ms FLOAT DEFAULT 0,         -- 평균 처리 시간
    
    -- 피드백 통계
    helpful_count INTEGER DEFAULT 0,        -- "도움됨" 횟수
    unhelpful_count INTEGER DEFAULT 0,      -- "도움안됨" 횟수
    
    -- 타임스탬프
    last_updated_at TIMESTAMPTZ DEFAULT now(),
    
    UNIQUE(template_id)
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_template_metrics_template_id ON public.template_metrics(template_id);

-- =============================================================================
-- 2. experiment_assignments 테이블 - A/B 테스트 사용자 할당
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.experiment_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    experiment_name VARCHAR(100) NOT NULL,  -- 실험 명칭 (예: 'template_v3_rollout')
    variant VARCHAR(50) NOT NULL,           -- 할당된 버전 (예: 'control', 'test')
    
    -- 메타데이터
    metadata JSONB DEFAULT '{}'::jsonb,
    
    -- 타임스탬프
    assigned_at TIMESTAMPTZ DEFAULT now(),
    
    UNIQUE(user_id, experiment_name)
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_experiment_assignments_user_id ON public.experiment_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_experiment_assignments_name ON public.experiment_assignments(experiment_name);

-- =============================================================================
-- 3. RLS 정책 설정
-- =============================================================================

-- template_metrics RLS (관리자만 수정 가능, 모든 사용자 읽기 가능)
ALTER TABLE public.template_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rls_template_metrics_select" ON public.template_metrics
    FOR SELECT USING (true); -- 모든 사용자 조회 가능 (통계용)

CREATE POLICY "rls_template_metrics_admin_all" ON public.template_metrics
    FOR ALL USING (is_admin());

-- experiment_assignments RLS (본인 것만 조회 가능, 관리자 전체)
ALTER TABLE public.experiment_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rls_experiment_assignments_select" ON public.experiment_assignments
    FOR SELECT USING (user_id = auth.uid() OR is_admin());

CREATE POLICY "rls_experiment_assignments_admin_all" ON public.experiment_assignments
    FOR ALL USING (is_admin());

-- =============================================================================
-- 4. 주석 추가
-- =============================================================================
COMMENT ON TABLE public.template_metrics IS '템플릿별 사용 통계 및 성능 지표 집계 테이블';
COMMENT ON TABLE public.experiment_assignments IS 'A/B 테스트를 위한 사용자별 실험군/대조군 할당 기록';
