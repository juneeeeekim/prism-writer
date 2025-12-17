-- =============================================================================
-- PRISM Writer - Phase 8 Operations Tables Migration
-- =============================================================================
-- 파일: backend/migrations/015_operations_tables.sql
-- 역할: 로그 추적, 비용 모니터링, 사용자 피드백 테이블 생성
-- =============================================================================

-- =============================================================================
-- 1. evaluation_logs 테이블 (평가 실행 로그)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.evaluation_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  level TEXT NOT NULL CHECK (level IN ('info', 'warn', 'error', 'debug')),
  event_type TEXT NOT NULL CHECK (event_type IN (
    'evaluation_started',
    'evaluation_completed',
    'evaluation_failed',
    'rubric_applied',
    'search_completed',
    'llm_called',
    'usage_limit_reached'
  )),
  message TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_evaluation_logs_user_id ON public.evaluation_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_evaluation_logs_event_type ON public.evaluation_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_evaluation_logs_created_at ON public.evaluation_logs(created_at DESC);

-- RLS 설정
ALTER TABLE public.evaluation_logs ENABLE ROW LEVEL SECURITY;

-- 사용자는 자신의 로그만 조회 가능
CREATE POLICY "Users can view own evaluation logs"
  ON public.evaluation_logs FOR SELECT
  USING (auth.uid() = user_id);

-- 서비스 역할로 로그 삽입 가능 (서버사이드에서만)
CREATE POLICY "Service can insert evaluation logs"
  ON public.evaluation_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- =============================================================================
-- 2. usage_records 테이블 (사용량 추적)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.usage_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  usage_type TEXT NOT NULL CHECK (usage_type IN (
    'embedding',
    'llm_evaluation',
    'llm_chat',
    'search'
  )),
  tokens_used INTEGER NOT NULL DEFAULT 0,
  estimated_cost DECIMAL(10, 6) NOT NULL DEFAULT 0,
  model TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_usage_records_user_id ON public.usage_records(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_records_usage_type ON public.usage_records(usage_type);
CREATE INDEX IF NOT EXISTS idx_usage_records_created_at ON public.usage_records(created_at DESC);

-- 일일/월간 집계를 위한 복합 인덱스
CREATE INDEX IF NOT EXISTS idx_usage_records_user_date 
  ON public.usage_records(user_id, created_at);

-- RLS 설정
ALTER TABLE public.usage_records ENABLE ROW LEVEL SECURITY;

-- 사용자는 자신의 사용량만 조회 가능
CREATE POLICY "Users can view own usage records"
  ON public.usage_records FOR SELECT
  USING (auth.uid() = user_id);

-- 서비스 역할로 사용량 삽입 가능
CREATE POLICY "Service can insert usage records"
  ON public.usage_records FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- =============================================================================
-- 3. evaluation_feedback 테이블 (사용자 피드백)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.evaluation_feedback (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  evaluation_id TEXT NOT NULL,
  feedback_type TEXT NOT NULL CHECK (feedback_type IN ('like', 'dislike')),
  comment TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, evaluation_id)  -- 사용자당 평가별 하나의 피드백만
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_evaluation_feedback_user_id ON public.evaluation_feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_evaluation_feedback_feedback_type ON public.evaluation_feedback(feedback_type);
CREATE INDEX IF NOT EXISTS idx_evaluation_feedback_created_at ON public.evaluation_feedback(created_at DESC);

-- RLS 설정
ALTER TABLE public.evaluation_feedback ENABLE ROW LEVEL SECURITY;

-- 사용자는 자신의 피드백만 조회/수정 가능
CREATE POLICY "Users can view own feedback"
  ON public.evaluation_feedback FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own feedback"
  ON public.evaluation_feedback FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own feedback"
  ON public.evaluation_feedback FOR UPDATE
  USING (auth.uid() = user_id);

-- =============================================================================
-- 4. 일일 사용량 집계 뷰 (선택)
-- =============================================================================

CREATE OR REPLACE VIEW public.daily_usage_summary AS
SELECT 
  user_id,
  DATE(created_at) as usage_date,
  usage_type,
  SUM(tokens_used) as total_tokens,
  SUM(estimated_cost) as total_cost,
  COUNT(*) as request_count
FROM public.usage_records
GROUP BY user_id, DATE(created_at), usage_type;

-- =============================================================================
-- 5. 피드백 통계 뷰 (선택)
-- =============================================================================

CREATE OR REPLACE VIEW public.feedback_summary AS
SELECT 
  DATE_TRUNC('day', created_at) as feedback_date,
  feedback_type,
  COUNT(*) as count
FROM public.evaluation_feedback
GROUP BY DATE_TRUNC('day', created_at), feedback_type;

-- =============================================================================
-- 완료 메시지
-- =============================================================================
-- Phase 8 운영 테이블 마이그레이션 완료
