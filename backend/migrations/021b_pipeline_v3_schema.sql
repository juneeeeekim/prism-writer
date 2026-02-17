-- =============================================================================
-- PRISM Writer - Pipeline v3 Schema Migration
-- =============================================================================
-- 파일: backend/migrations/021_pipeline_v3_schema.sql
-- 역할: Rule/Example/Template 저장을 위한 테이블 및 RLS 정책 생성
-- Phase: Pipeline v3 Phase 1 - Task 1.1
-- =============================================================================

-- =============================================================================
-- 1. Tenant Namespace 컬럼 추가 (기존 테이블 확장)
-- =============================================================================
-- 주석: 기존 rag_documents, rag_chunks 테이블에 tenant_id 컬럼 추가
-- 이를 통해 강사/코스별 데이터 격리 가능

ALTER TABLE rag_documents 
ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES auth.users(id);

ALTER TABLE rag_chunks 
ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES auth.users(id);

-- 기존 데이터에 대한 기본값 설정 (user_id를 tenant_id로 복사)
UPDATE rag_documents SET tenant_id = user_id WHERE tenant_id IS NULL;
UPDATE rag_chunks SET tenant_id = rag_documents.user_id 
FROM rag_documents 
WHERE rag_chunks.document_id = rag_documents.id AND rag_chunks.tenant_id IS NULL;

-- =============================================================================
-- 2. rag_rules 테이블 생성 - 원문에서 추출된 원자적 규칙 저장
-- =============================================================================
CREATE TABLE IF NOT EXISTS rag_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- 관계
    document_id UUID NOT NULL REFERENCES rag_documents(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES auth.users(id),
    source_chunk_id UUID REFERENCES rag_chunks(id),
    
    -- 규칙 내용
    content TEXT NOT NULL,
    type VARCHAR(50) NOT NULL DEFAULT 'general', -- 'rule', 'principle', 'guideline', 'general'
    category VARCHAR(50), -- 'tone', 'structure', 'expression', 'prohibition' (Pipeline v3 Refined)
    keywords TSVECTOR, -- BM25 검색 최적화용
    
    -- 메타데이터 (JSONB로 유연하게 저장)
    metadata JSONB DEFAULT '{}'::jsonb,
    
    -- 임베딩 벡터 (768차원, Gemini용)
    embedding vector(768),
    
    -- 타임스탬프
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_rag_rules_document_id ON rag_rules(document_id);
CREATE INDEX IF NOT EXISTS idx_rag_rules_tenant_id ON rag_rules(tenant_id);
CREATE INDEX IF NOT EXISTS idx_rag_rules_type ON rag_rules(type);
CREATE INDEX IF NOT EXISTS idx_rag_rules_category ON rag_rules(category);
CREATE INDEX IF NOT EXISTS idx_rag_rules_document_category ON rag_rules(document_id, category);
CREATE INDEX IF NOT EXISTS idx_rag_rules_keywords ON rag_rules USING GIN(keywords);
CREATE INDEX IF NOT EXISTS idx_rag_rules_document_type ON rag_rules(document_id, type);

-- =============================================================================
-- 3. rag_examples 테이블 생성 - 원문 추출 사례 + LLM 생성 사례 저장
-- =============================================================================
CREATE TABLE IF NOT EXISTS rag_examples (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- 관계
    rule_id UUID NOT NULL REFERENCES rag_rules(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES auth.users(id),
    source_chunk_id UUID REFERENCES rag_chunks(id),
    
    -- 예시 내용
    content TEXT NOT NULL,
    is_positive BOOLEAN NOT NULL DEFAULT true, -- true: 좋은 예시, false: 나쁜 예시
    is_generated BOOLEAN NOT NULL DEFAULT false, -- true: LLM 생성, false: 원문 추출
    
    -- 신뢰도 점수 (0.0 ~ 1.0)
    confidence_score FLOAT DEFAULT 0.8,
    
    -- 메타데이터
    metadata JSONB DEFAULT '{}'::jsonb,
    
    -- 타임스탬프
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_rag_examples_rule_id ON rag_examples(rule_id);
CREATE INDEX IF NOT EXISTS idx_rag_examples_tenant_id ON rag_examples(tenant_id);
CREATE INDEX IF NOT EXISTS idx_rag_examples_is_positive ON rag_examples(is_positive);
CREATE INDEX IF NOT EXISTS idx_rag_examples_rule_positive ON rag_examples(rule_id, is_positive);

-- =============================================================================
-- 4. rag_templates 테이블 생성 - 규칙과 사례가 결합된 최종 평가 세트
-- =============================================================================
CREATE TABLE IF NOT EXISTS rag_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- 관계
    document_id UUID REFERENCES rag_documents(id) ON DELETE SET NULL,
    tenant_id UUID NOT NULL REFERENCES auth.users(id),
    
    -- 템플릿 정보
    name VARCHAR(255) NOT NULL,
    description TEXT,
    version INTEGER NOT NULL DEFAULT 1,
    
    -- 상태 관리
    status VARCHAR(50) NOT NULL DEFAULT 'draft', -- 'draft', 'pending', 'approved', 'rejected'
    is_public BOOLEAN DEFAULT false, -- Public Template 여부
    
    -- 평가 기준 JSON (TemplateSchema 배열)
    criteria_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    
    -- 승인 정보
    approved_at TIMESTAMPTZ,
    approved_by UUID REFERENCES auth.users(id),
    rejection_reason TEXT,
    
    -- 타임스탬프
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_rag_templates_tenant_id ON rag_templates(tenant_id);
CREATE INDEX IF NOT EXISTS idx_rag_templates_status ON rag_templates(status);
CREATE INDEX IF NOT EXISTS idx_rag_templates_tenant_status ON rag_templates(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_rag_templates_is_public ON rag_templates(is_public);

-- =============================================================================
-- 5. template_feedback 테이블 생성 - 사용자 피드백 수집
-- =============================================================================
CREATE TABLE IF NOT EXISTS template_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- 관계
    template_id UUID NOT NULL REFERENCES rag_templates(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id),
    
    -- 피드백 내용
    helpful BOOLEAN NOT NULL,
    comment TEXT,
    
    -- 타임스탬프
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_template_feedback_template_id ON template_feedback(template_id);
CREATE INDEX IF NOT EXISTS idx_template_feedback_user_id ON template_feedback(user_id);

-- =============================================================================
-- 6. RLS (Row Level Security) 정책 설정
-- =============================================================================

-- rag_rules RLS
ALTER TABLE rag_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rls_rag_rules_tenant_select" ON rag_rules
    FOR SELECT USING (
        tenant_id = auth.uid() OR 
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

CREATE POLICY "rls_rag_rules_tenant_insert" ON rag_rules
    FOR INSERT WITH CHECK (tenant_id = auth.uid());

CREATE POLICY "rls_rag_rules_tenant_update" ON rag_rules
    FOR UPDATE USING (tenant_id = auth.uid());

CREATE POLICY "rls_rag_rules_tenant_delete" ON rag_rules
    FOR DELETE USING (tenant_id = auth.uid());

-- rag_examples RLS
ALTER TABLE rag_examples ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rls_rag_examples_tenant_select" ON rag_examples
    FOR SELECT USING (
        tenant_id = auth.uid() OR 
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

CREATE POLICY "rls_rag_examples_tenant_insert" ON rag_examples
    FOR INSERT WITH CHECK (tenant_id = auth.uid());

CREATE POLICY "rls_rag_examples_tenant_update" ON rag_examples
    FOR UPDATE USING (tenant_id = auth.uid());

CREATE POLICY "rls_rag_examples_tenant_delete" ON rag_examples
    FOR DELETE USING (tenant_id = auth.uid());

-- rag_templates RLS
ALTER TABLE rag_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rls_rag_templates_tenant_select" ON rag_templates
    FOR SELECT USING (
        tenant_id = auth.uid() OR 
        is_public = true OR
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

CREATE POLICY "rls_rag_templates_tenant_insert" ON rag_templates
    FOR INSERT WITH CHECK (tenant_id = auth.uid());

CREATE POLICY "rls_rag_templates_tenant_update" ON rag_templates
    FOR UPDATE USING (
        tenant_id = auth.uid() OR
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

CREATE POLICY "rls_rag_templates_tenant_delete" ON rag_templates
    FOR DELETE USING (tenant_id = auth.uid());

-- template_feedback RLS
ALTER TABLE template_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rls_template_feedback_select" ON template_feedback
    FOR SELECT USING (
        user_id = auth.uid() OR 
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

CREATE POLICY "rls_template_feedback_insert" ON template_feedback
    FOR INSERT WITH CHECK (user_id = auth.uid());

-- =============================================================================
-- 7. Updated_at 트리거 함수 및 트리거 생성
-- =============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- rag_rules 트리거
DROP TRIGGER IF EXISTS set_rag_rules_updated_at ON rag_rules;
CREATE TRIGGER set_rag_rules_updated_at
    BEFORE UPDATE ON rag_rules
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- rag_templates 트리거
DROP TRIGGER IF EXISTS set_rag_templates_updated_at ON rag_templates;
CREATE TRIGGER set_rag_templates_updated_at
    BEFORE UPDATE ON rag_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- 8. 주석 추가
-- =============================================================================
COMMENT ON TABLE rag_rules IS 'Pipeline v3: 원문에서 추출된 글쓰기 규칙/원칙';
COMMENT ON TABLE rag_examples IS 'Pipeline v3: 좋은/나쁜 예시 (추출 또는 생성)';
COMMENT ON TABLE rag_templates IS 'Pipeline v3: 규칙과 예시를 결합한 평가 템플릿';
COMMENT ON TABLE template_feedback IS 'Pipeline v3: 템플릿에 대한 사용자 피드백';

COMMENT ON COLUMN rag_rules.type IS '규칙 유형: rule, principle, guideline, general';
COMMENT ON COLUMN rag_examples.is_positive IS 'true: 좋은 예시, false: 나쁜 예시';
COMMENT ON COLUMN rag_examples.is_generated IS 'true: LLM 생성, false: 원문 추출';
COMMENT ON COLUMN rag_examples.confidence_score IS '신뢰도 점수 (0.0 ~ 1.0)';
COMMENT ON COLUMN rag_templates.status IS '상태: draft, pending, approved, rejected';
COMMENT ON COLUMN rag_templates.is_public IS 'Public Template 여부 (모든 사용자 접근 가능)';
