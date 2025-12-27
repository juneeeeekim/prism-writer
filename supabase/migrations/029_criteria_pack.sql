-- =========================================================
-- Phase P1-D: Criteria Pack 테이블
-- =========================================================

CREATE TABLE IF NOT EXISTS public.criteria_pack (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  version INTEGER DEFAULT 1,

  -- 기준 정의
  criteria_definition JSONB NOT NULL,
  -- 구조: { "rules": [...], "do_examples": [...], "dont_examples": [...] }

  -- 공통 함정
  common_pitfalls TEXT[],

  -- 관련 청크 ID (근거)
  evidence_chunk_ids UUID[],

  -- 메타데이터
  category TEXT CHECK (category IN ('logic', 'grammar', 'expression', 'tone', 'format')),
  difficulty TEXT CHECK (difficulty IN ('high', 'medium', 'low')),

  -- 활성화 상태
  is_active BOOLEAN DEFAULT TRUE,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_criteria_pack_category ON public.criteria_pack(category);
CREATE INDEX IF NOT EXISTS idx_criteria_pack_active ON public.criteria_pack(is_active);

-- RLS
ALTER TABLE public.criteria_pack ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON public.criteria_pack
  FOR ALL USING (auth.role() = 'service_role');
