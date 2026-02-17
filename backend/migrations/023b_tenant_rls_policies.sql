-- =============================================================================
-- PRISM Writer - Tenant RLS Policies Strengthening
-- =============================================================================
-- 파일: backend/migrations/023_tenant_rls_policies.sql
-- 역할: Tenant별 데이터 격리 강화 및 관리자 예외 처리 (is_admin)
-- Phase: Pipeline v3 Phase 4 - Task 4.1
-- =============================================================================

-- =============================================================================
-- 1. 관리자 확인 함수 (is_admin)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'admin'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- 2. rag_documents RLS 정책 강화
-- =============================================================================
-- 기존 정책 삭제
DROP POLICY IF EXISTS "Users can view own documents" ON public.rag_documents;
DROP POLICY IF EXISTS "Users can insert own documents" ON public.rag_documents;
DROP POLICY IF EXISTS "Users can update own documents" ON public.rag_documents;
DROP POLICY IF EXISTS "Users can delete own documents" ON public.rag_documents;

-- 신규 정책 (tenant_id 기반)
CREATE POLICY "rls_rag_documents_select" ON public.rag_documents
    FOR SELECT USING (tenant_id = auth.uid() OR is_admin());

CREATE POLICY "rls_rag_documents_insert" ON public.rag_documents
    FOR INSERT WITH CHECK (tenant_id = auth.uid());

CREATE POLICY "rls_rag_documents_update" ON public.rag_documents
    FOR UPDATE USING (tenant_id = auth.uid() OR is_admin());

CREATE POLICY "rls_rag_documents_delete" ON public.rag_documents
    FOR DELETE USING (tenant_id = auth.uid() OR is_admin());

-- =============================================================================
-- 3. rag_rules RLS 정책 강화 (is_admin 함수 활용)
-- =============================================================================
DROP POLICY IF EXISTS "rls_rag_rules_tenant_select" ON public.rag_rules;
DROP POLICY IF EXISTS "rls_rag_rules_tenant_insert" ON public.rag_rules;
DROP POLICY IF EXISTS "rls_rag_rules_tenant_update" ON public.rag_rules;
DROP POLICY IF EXISTS "rls_rag_rules_tenant_delete" ON public.rag_rules;

CREATE POLICY "rls_rag_rules_select" ON public.rag_rules
    FOR SELECT USING (tenant_id = auth.uid() OR is_admin());

CREATE POLICY "rls_rag_rules_insert" ON public.rag_rules
    FOR INSERT WITH CHECK (tenant_id = auth.uid());

CREATE POLICY "rls_rag_rules_update" ON public.rag_rules
    FOR UPDATE USING (tenant_id = auth.uid() OR is_admin());

CREATE POLICY "rls_rag_rules_delete" ON public.rag_rules
    FOR DELETE USING (tenant_id = auth.uid() OR is_admin());

-- =============================================================================
-- 4. rag_examples RLS 정책 강화
-- =============================================================================
DROP POLICY IF EXISTS "rls_rag_examples_tenant_select" ON public.rag_examples;
DROP POLICY IF EXISTS "rls_rag_examples_tenant_insert" ON public.rag_examples;
DROP POLICY IF EXISTS "rls_rag_examples_tenant_update" ON public.rag_examples;
DROP POLICY IF EXISTS "rls_rag_examples_tenant_delete" ON public.rag_examples;

CREATE POLICY "rls_rag_examples_select" ON public.rag_examples
    FOR SELECT USING (tenant_id = auth.uid() OR is_admin());

CREATE POLICY "rls_rag_examples_insert" ON public.rag_examples
    FOR INSERT WITH CHECK (tenant_id = auth.uid());

CREATE POLICY "rls_rag_examples_update" ON public.rag_examples
    FOR UPDATE USING (tenant_id = auth.uid() OR is_admin());

CREATE POLICY "rls_rag_examples_delete" ON public.rag_examples
    FOR DELETE USING (tenant_id = auth.uid() OR is_admin());

-- =============================================================================
-- 5. rag_templates RLS 정책 강화 (Public Template 지원)
-- =============================================================================
DROP POLICY IF EXISTS "rls_rag_templates_tenant_select" ON public.rag_templates;
DROP POLICY IF EXISTS "rls_rag_templates_tenant_insert" ON public.rag_templates;
DROP POLICY IF EXISTS "rls_rag_templates_tenant_update" ON public.rag_templates;
DROP POLICY IF EXISTS "rls_rag_templates_tenant_delete" ON public.rag_templates;

CREATE POLICY "rls_rag_templates_select" ON public.rag_templates
    FOR SELECT USING (tenant_id = auth.uid() OR is_public = true OR is_admin());

CREATE POLICY "rls_rag_templates_insert" ON public.rag_templates
    FOR INSERT WITH CHECK (tenant_id = auth.uid());

CREATE POLICY "rls_rag_templates_update" ON public.rag_templates
    FOR UPDATE USING (tenant_id = auth.uid() OR is_admin());

CREATE POLICY "rls_rag_templates_delete" ON public.rag_templates
    FOR DELETE USING (tenant_id = auth.uid() OR is_admin());

-- =============================================================================
-- 6. 주석 추가
-- =============================================================================
COMMENT ON FUNCTION public.is_admin() IS '사용자가 관리자(admin)인지 확인하는 함수';
