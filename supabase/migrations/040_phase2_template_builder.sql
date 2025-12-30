-- =============================================================================
-- Migration: 040_phase2_template_builder.sql
-- Phase 2: Template Builder Schema
-- Date: 2025-12-29
-- Description: Phase 2 테이블 생성 (rag_rules, rag_examples, rag_templates)
-- =============================================================================

-- =============================================================================
-- 1. rag_rules 테이블 (P2-01)
-- 설명: 문서에서 추출된 원자적 규칙(원칙/지침) 저장
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.rag_rules (
  -- -------------------------------------------------------------------------
  -- Primary Key
  -- -------------------------------------------------------------------------
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- -------------------------------------------------------------------------
  -- Foreign Keys
  -- -------------------------------------------------------------------------
  document_id UUID REFERENCES public.user_documents(id) ON DELETE CASCADE,
  chunk_id UUID REFERENCES public.rag_chunks(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- -------------------------------------------------------------------------
  -- Rule Content
  -- -------------------------------------------------------------------------
  rule_text TEXT NOT NULL,                  -- 규칙 텍스트 (예: "~해야 한다")
  category TEXT NOT NULL,                   -- structure | expression | tone | prohibition
  confidence FLOAT DEFAULT 1.0,             -- 추출 신뢰도 (0.0 ~ 1.0)
  
  -- -------------------------------------------------------------------------
  -- Source/Lineage
  -- -------------------------------------------------------------------------
  source_quote TEXT,                        -- 원문 인용
  extraction_method TEXT DEFAULT 'llm',     -- llm | manual | rule-based
  
  -- -------------------------------------------------------------------------
  -- Metadata
  -- -------------------------------------------------------------------------
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for rag_rules
CREATE INDEX IF NOT EXISTS idx_rag_rules_user_id ON public.rag_rules(user_id);
CREATE INDEX IF NOT EXISTS idx_rag_rules_document_id ON public.rag_rules(document_id);
CREATE INDEX IF NOT EXISTS idx_rag_rules_category ON public.rag_rules(category);

-- RLS for rag_rules
ALTER TABLE public.rag_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own rules" ON public.rag_rules 
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own rules" ON public.rag_rules 
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own rules" ON public.rag_rules 
FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own rules" ON public.rag_rules 
FOR DELETE USING (auth.uid() = user_id);

-- =============================================================================
-- 2. rag_examples 테이블 (P2-02)
-- 설명: 좋은 예시/나쁜 예시 저장
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.rag_examples (
  -- -------------------------------------------------------------------------
  -- Primary Key
  -- -------------------------------------------------------------------------
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- -------------------------------------------------------------------------
  -- Foreign Keys
  -- -------------------------------------------------------------------------
  rule_id UUID REFERENCES public.rag_rules(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- -------------------------------------------------------------------------
  -- Example Content
  -- -------------------------------------------------------------------------
  example_type TEXT NOT NULL CHECK (example_type IN ('positive', 'negative')),
  example_text TEXT NOT NULL,               -- 예시 텍스트 (3~6문장)
  diff_hint TEXT,                           -- 나쁜 예 → 좋은 예 힌트
  
  -- -------------------------------------------------------------------------
  -- Source
  -- -------------------------------------------------------------------------
  source_type TEXT DEFAULT 'mined' CHECK (source_type IN ('mined', 'generated', 'manual')),
  source_chunk_id UUID REFERENCES public.rag_chunks(id) ON DELETE SET NULL,
  confidence FLOAT DEFAULT 1.0,
  
  -- -------------------------------------------------------------------------
  -- Metadata
  -- -------------------------------------------------------------------------
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for rag_examples
CREATE INDEX IF NOT EXISTS idx_rag_examples_rule_id ON public.rag_examples(rule_id);
CREATE INDEX IF NOT EXISTS idx_rag_examples_user_id ON public.rag_examples(user_id);
CREATE INDEX IF NOT EXISTS idx_rag_examples_type ON public.rag_examples(example_type);

-- RLS for rag_examples
ALTER TABLE public.rag_examples ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own examples" ON public.rag_examples 
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own examples" ON public.rag_examples 
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own examples" ON public.rag_examples 
FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own examples" ON public.rag_examples 
FOR DELETE USING (auth.uid() = user_id);

-- =============================================================================
-- 3. rag_templates 테이블 (P2-03)
-- 설명: 규칙 + 예시가 결합된 최종 평가 템플릿 저장
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.rag_templates (
  -- -------------------------------------------------------------------------
  -- Primary Key
  -- -------------------------------------------------------------------------
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- -------------------------------------------------------------------------
  -- Ownership
  -- -------------------------------------------------------------------------
  tenant_id UUID,                          -- 테넌트 ID (멀티테넌시 지원)
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  document_id UUID REFERENCES public.user_documents(id) ON DELETE SET NULL,
  
  -- -------------------------------------------------------------------------
  -- Template Info
  -- -------------------------------------------------------------------------
  name TEXT NOT NULL,
  description TEXT,
  version INT DEFAULT 1,
  
  -- -------------------------------------------------------------------------
  -- Status & Workflow
  -- -------------------------------------------------------------------------
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'pending', 'approved', 'rejected')),
  is_public BOOLEAN DEFAULT false,
  
  -- -------------------------------------------------------------------------
  -- Template Content (JSONB로 TemplateSchema[] 저장)
  -- -------------------------------------------------------------------------
  criteria_json JSONB NOT NULL DEFAULT '[]',
  
  -- -------------------------------------------------------------------------
  -- Approval Workflow
  -- -------------------------------------------------------------------------
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES auth.users(id),
  rejection_reason TEXT,
  
  -- -------------------------------------------------------------------------
  -- Metadata
  -- -------------------------------------------------------------------------
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for rag_templates
CREATE INDEX IF NOT EXISTS idx_rag_templates_user_id ON public.rag_templates(user_id);
CREATE INDEX IF NOT EXISTS idx_rag_templates_status ON public.rag_templates(status);
CREATE INDEX IF NOT EXISTS idx_rag_templates_document_id ON public.rag_templates(document_id);

-- RLS for rag_templates
ALTER TABLE public.rag_templates ENABLE ROW LEVEL SECURITY;

-- 본인 템플릿 또는 공개 템플릿 조회 가능
CREATE POLICY "Users can select own or public templates" ON public.rag_templates 
FOR SELECT USING (auth.uid() = user_id OR is_public = true);

CREATE POLICY "Users can insert own templates" ON public.rag_templates 
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own templates" ON public.rag_templates 
FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own templates" ON public.rag_templates 
FOR DELETE USING (auth.uid() = user_id);

-- =============================================================================
-- 4. Table Comments (문서화)
-- =============================================================================

COMMENT ON TABLE public.rag_rules IS 'Phase 2: 문서에서 추출된 원자적 규칙 (v1.0)';
COMMENT ON TABLE public.rag_examples IS 'Phase 2: 좋은/나쁜 예시 저장 (v1.0)';
COMMENT ON TABLE public.rag_templates IS 'Phase 2: 최종 평가 템플릿 (v1.0)';

COMMENT ON COLUMN public.rag_rules.rule_text IS '규칙 텍스트 (예: "~해야 한다")';
COMMENT ON COLUMN public.rag_rules.category IS '카테고리: structure, expression, tone, prohibition';
COMMENT ON COLUMN public.rag_rules.confidence IS '추출 신뢰도 (0.0 ~ 1.0)';

COMMENT ON COLUMN public.rag_examples.example_type IS '예시 유형: positive(좋은 예), negative(나쁜 예)';
COMMENT ON COLUMN public.rag_examples.diff_hint IS '나쁜 예 → 좋은 예 변환 힌트';

COMMENT ON COLUMN public.rag_templates.criteria_json IS 'TemplateSchema[] JSONB 배열';
COMMENT ON COLUMN public.rag_templates.status IS '상태: draft, pending, approved, rejected';

-- =============================================================================
-- 5. Schema Cache Reload (PostgREST)
-- =============================================================================

NOTIFY pgrst, 'reload schema';

-- =============================================================================
-- Migration Complete
-- Phase 2: Template Builder Schema
-- Tables: rag_rules, rag_examples, rag_templates
-- =============================================================================
