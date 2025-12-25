-- =============================================================================
-- PRISM Writer - Pipeline v4 Template Validation Samples Migration
-- =============================================================================
-- 파일: backend/migrations/033_template_validation_samples.sql
-- 역할: template_validation_samples 테이블 생성 및 RLS 정책 설정
-- Phase: Pipeline v4 업그레이드 - JeDebug Risk 9 해결
-- =============================================================================

-- =============================================================================
-- 1. template_validation_samples 테이블 생성
-- =============================================================================
-- 주석(시니어 개발자): Regression Gate 검증용 샘플 저장 테이블
-- tenant_id 기반 RLS로 멀티테넌트 데이터 격리 보장

CREATE TABLE IF NOT EXISTS template_validation_samples (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- 템플릿 연결
    template_id UUID NOT NULL REFERENCES rag_templates(id) ON DELETE CASCADE,
    
    -- 테넌트 격리
    tenant_id UUID NOT NULL,
    
    -- 샘플 데이터
    input_text TEXT NOT NULL,
    expected_score DECIMAL(3, 2) NOT NULL DEFAULT 0.8,
    category TEXT,
    sample_index INT DEFAULT 0,
    
    -- 메타데이터
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================================================
-- 2. 인덱스 생성
-- =============================================================================
-- 주석(주니어 개발자): template_id와 tenant_id로 빠른 조회 지원

CREATE INDEX IF NOT EXISTS idx_validation_samples_template_id 
ON template_validation_samples (template_id);

CREATE INDEX IF NOT EXISTS idx_validation_samples_tenant_id 
ON template_validation_samples (tenant_id);

-- 복합 인덱스: tenant + template
CREATE INDEX IF NOT EXISTS idx_validation_samples_tenant_template 
ON template_validation_samples (tenant_id, template_id);

-- =============================================================================
-- 3. RLS (Row Level Security) 활성화
-- =============================================================================

ALTER TABLE template_validation_samples ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- 4. RLS 정책 4종 생성 (SELECT, INSERT, UPDATE, DELETE)
-- =============================================================================
-- 주석(시니어 개발자): tenant_id 기반 격리로 다른 테넌트 샘플 접근 차단
-- CVE-2025-55182 예방: 모든 CRUD 작업에 RLS 정책 적용

-- 4-1. SELECT 정책: 동일 테넌트의 샘플만 조회 가능
CREATE POLICY validation_samples_select_policy 
    ON template_validation_samples 
    FOR SELECT 
    USING (
        tenant_id IN (
            SELECT tenant_id FROM profiles WHERE id = auth.uid()
        )
    );

-- 4-2. INSERT 정책: 동일 테넌트만 샘플 생성 가능
CREATE POLICY validation_samples_insert_policy 
    ON template_validation_samples 
    FOR INSERT 
    WITH CHECK (
        tenant_id IN (
            SELECT tenant_id FROM profiles WHERE id = auth.uid()
        )
    );

-- 4-3. UPDATE 정책: 동일 테넌트의 샘플만 수정 가능
CREATE POLICY validation_samples_update_policy 
    ON template_validation_samples 
    FOR UPDATE 
    USING (
        tenant_id IN (
            SELECT tenant_id FROM profiles WHERE id = auth.uid()
        )
    )
    WITH CHECK (
        tenant_id IN (
            SELECT tenant_id FROM profiles WHERE id = auth.uid()
        )
    );

-- 4-4. DELETE 정책: 동일 테넌트의 샘플만 삭제 가능
CREATE POLICY validation_samples_delete_policy 
    ON template_validation_samples 
    FOR DELETE 
    USING (
        tenant_id IN (
            SELECT tenant_id FROM profiles WHERE id = auth.uid()
        )
    );

-- =============================================================================
-- 5. 테이블 주석
-- =============================================================================

COMMENT ON TABLE template_validation_samples IS 'Pipeline v4: Regression Gate 검증용 템플릿 샘플';
COMMENT ON COLUMN template_validation_samples.template_id IS '연결된 템플릿 ID';
COMMENT ON COLUMN template_validation_samples.tenant_id IS '테넌트 ID (RLS 격리 키)';
COMMENT ON COLUMN template_validation_samples.input_text IS '검증용 입력 텍스트';
COMMENT ON COLUMN template_validation_samples.expected_score IS '기대 점수 (0.00~1.00)';
COMMENT ON COLUMN template_validation_samples.category IS '규칙 카테고리 (tone, structure, expression, prohibition)';
COMMENT ON COLUMN template_validation_samples.sample_index IS '샘플 순서 인덱스';

-- =============================================================================
-- ==================== 롤백 스크립트 (ROLLBACK SECTION) =======================
-- =============================================================================
/*
-- 롤백 절차:
-- 1. RLS 정책 삭제
DROP POLICY IF EXISTS validation_samples_select_policy ON template_validation_samples;
DROP POLICY IF EXISTS validation_samples_insert_policy ON template_validation_samples;
DROP POLICY IF EXISTS validation_samples_update_policy ON template_validation_samples;
DROP POLICY IF EXISTS validation_samples_delete_policy ON template_validation_samples;

-- 2. 인덱스 삭제
DROP INDEX IF EXISTS idx_validation_samples_tenant_template;
DROP INDEX IF EXISTS idx_validation_samples_tenant_id;
DROP INDEX IF EXISTS idx_validation_samples_template_id;

-- 3. 테이블 삭제
DROP TABLE IF EXISTS template_validation_samples;
*/
