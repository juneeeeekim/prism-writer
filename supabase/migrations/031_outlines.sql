-- =============================================================================
-- PRISM Writer - Outlines Table Migration
-- =============================================================================
-- 파일: supabase/migrations/031_outlines.sql
-- 역할: 목차 제안 결과 영구 저장
-- 생성일: 2025-12-27
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. 테이블 생성
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.outlines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- 목차 데이터
  topic TEXT NOT NULL,
  outline_data JSONB NOT NULL DEFAULT '[]'::jsonb,
  sources_used INTEGER DEFAULT 0,
  
  -- 타임스탬프
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- 2. 인덱스
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_outlines_user_id ON public.outlines(user_id);
CREATE INDEX IF NOT EXISTS idx_outlines_created_at ON public.outlines(created_at DESC);

-- -----------------------------------------------------------------------------
-- 3. RLS (Row Level Security)
-- -----------------------------------------------------------------------------
ALTER TABLE public.outlines ENABLE ROW LEVEL SECURITY;

-- 사용자 본인 데이터만 접근 가능
CREATE POLICY "Users can manage own outlines"
  ON public.outlines
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Service Role은 모든 데이터 접근 가능
CREATE POLICY "Service role full access on outlines"
  ON public.outlines
  FOR ALL
  USING (auth.role() = 'service_role');

-- -----------------------------------------------------------------------------
-- 4. 코멘트
-- -----------------------------------------------------------------------------
COMMENT ON TABLE public.outlines IS '사용자가 생성한 목차 제안 이력';
COMMENT ON COLUMN public.outlines.topic IS '목차 생성 시 입력한 주제';
COMMENT ON COLUMN public.outlines.outline_data IS '생성된 목차 항목 배열 (JSONB)';
COMMENT ON COLUMN public.outlines.sources_used IS '참고자료 활용 개수';
