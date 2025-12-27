-- =============================================================================
-- PRISM Writer - Evaluation Logs Table Migration
-- =============================================================================
-- 파일: supabase/migrations/032_evaluation_logs.sql
-- 역할: 글 평가 결과 영구 저장
-- 생성일: 2025-12-27
-- 수정: 기존 테이블 DROP 후 재생성 (마이그레이션 재실행 대응)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 0. 기존 테이블 삭제 (재실행 시 충돌 방지)
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS public.evaluation_logs CASCADE;

-- -----------------------------------------------------------------------------
-- 1. 테이블 생성
-- -----------------------------------------------------------------------------
CREATE TABLE public.evaluation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- 평가 대상 식별 (글 해시로 동일 글 재평가 히스토리 추적)
  document_text_hash TEXT,
  
  -- 평가 결과 데이터
  result_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  overall_score NUMERIC(5,2),
  
  -- 타임스탬프
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- 2. 인덱스
-- -----------------------------------------------------------------------------
CREATE INDEX idx_evaluation_logs_user_id ON public.evaluation_logs(user_id);
CREATE INDEX idx_evaluation_logs_created_at ON public.evaluation_logs(created_at DESC);
CREATE INDEX idx_evaluation_logs_hash ON public.evaluation_logs(document_text_hash);

-- -----------------------------------------------------------------------------
-- 3. RLS (Row Level Security)
-- -----------------------------------------------------------------------------
ALTER TABLE public.evaluation_logs ENABLE ROW LEVEL SECURITY;

-- 사용자 본인 데이터만 접근 가능
CREATE POLICY "Users can manage own evaluation_logs"
  ON public.evaluation_logs
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Service Role은 모든 데이터 접근 가능
CREATE POLICY "Service role full access on evaluation_logs"
  ON public.evaluation_logs
  FOR ALL
  USING (auth.role() = 'service_role');

-- -----------------------------------------------------------------------------
-- 4. 코멘트
-- -----------------------------------------------------------------------------
COMMENT ON TABLE public.evaluation_logs IS '사용자의 글 평가 이력';
COMMENT ON COLUMN public.evaluation_logs.document_text_hash IS '평가 대상 글의 해시 (동일 글 추적용)';
COMMENT ON COLUMN public.evaluation_logs.result_data IS '전체 평가 결과 (JSONB)';
COMMENT ON COLUMN public.evaluation_logs.overall_score IS '전체 점수 (0-100)';
