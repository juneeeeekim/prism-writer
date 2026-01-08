-- =============================================================================
-- Migration: 084_structure_suggestions.sql
-- Description: AI Structurer 분석 결과 저장 테이블
-- Created: 2026-01-09
-- Related: 2601090024_Structure_Feedback_Integration_Spec.md (P1-01)
-- =============================================================================
--
-- [시니어 개발자 주석]
-- 이 테이블은 AI Structurer가 생성한 분석 결과를 영구 저장합니다.
-- Adaptive RAG 시스템과 연동하여 사용자의 선택이 RAG 임계값에 반영됩니다.
--
-- 주요 컬럼:
-- - suggested_order: AI가 제안한 문서 순서 (JSONB)
-- - is_applied: 사용자가 "적용" 버튼을 눌렀는지 여부
-- - is_modified: 사용자가 드래그로 순서를 변경했는지 여부
-- =============================================================================

-- =============================================================================
-- [P1-01-A] 테이블 생성
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.structure_suggestions (
  -- PK
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- ==========================================================================
  -- 관계 (FK)
  -- ==========================================================================
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  template_id UUID REFERENCES public.rag_templates(id) ON DELETE SET NULL,
  
  -- ==========================================================================
  -- 분석 컨텍스트
  -- ==========================================================================
  /** 선택 분석 시 대상 문서 ID 배열 */
  target_doc_ids UUID[] DEFAULT '{}',
  /** 선택 분석 모드 여부 */
  is_selective_mode BOOLEAN DEFAULT FALSE,
  
  -- ==========================================================================
  -- AI 분석 결과 (JSONB)
  -- ==========================================================================
  /** AI가 제안한 순서: [{docId, order, assignedTag, reason}, ...] */
  suggested_order JSONB NOT NULL,
  /** 발견된 구조적 갭: [{gapType, description, suggestedSolution}, ...] */
  gaps JSONB DEFAULT '[]',
  /** 전체 요약 */
  overall_summary TEXT,
  
  -- ==========================================================================
  -- 메타데이터
  -- ==========================================================================
  /** 분석된 문서 수 */
  doc_count INTEGER NOT NULL,
  /** 분석 시각 */
  analyzed_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- ==========================================================================
  -- 사용자 행동 추적 (Adaptive RAG 연동용)
  -- ==========================================================================
  /** 사용자가 "적용" 버튼을 눌렀는지 */
  is_applied BOOLEAN DEFAULT FALSE,
  /** 적용 시각 */
  applied_at TIMESTAMPTZ,
  /** 드래그로 순서를 변경했는지 */
  is_modified BOOLEAN DEFAULT FALSE,
  
  -- ==========================================================================
  -- 타임스탬프
  -- ==========================================================================
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- [P1-01-A] 인덱스 생성
-- =============================================================================
-- 프로젝트별 조회 최적화
CREATE INDEX IF NOT EXISTS idx_structure_suggestions_project 
  ON public.structure_suggestions(project_id);

-- 사용자별 조회 최적화
CREATE INDEX IF NOT EXISTS idx_structure_suggestions_user 
  ON public.structure_suggestions(user_id);

-- 분석 시각 기준 정렬 최적화
CREATE INDEX IF NOT EXISTS idx_structure_suggestions_analyzed 
  ON public.structure_suggestions(analyzed_at DESC);

-- =============================================================================
-- [P1-01-A] RLS (Row Level Security) 설정
-- =============================================================================
ALTER TABLE public.structure_suggestions ENABLE ROW LEVEL SECURITY;

-- SELECT: 본인 데이터만 조회 가능
CREATE POLICY "structure_suggestions_select_own"
  ON public.structure_suggestions
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- INSERT: 본인 데이터만 삽입 가능
CREATE POLICY "structure_suggestions_insert_own"
  ON public.structure_suggestions
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- UPDATE: 본인 데이터만 수정 가능
CREATE POLICY "structure_suggestions_update_own"
  ON public.structure_suggestions
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

-- DELETE: 본인 데이터만 삭제 가능
CREATE POLICY "structure_suggestions_delete_own"
  ON public.structure_suggestions
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- =============================================================================
-- [P1-01-A] 테이블 및 컬럼 주석
-- =============================================================================
COMMENT ON TABLE public.structure_suggestions IS 
  'AI Structurer 분석 결과 저장 테이블. Adaptive RAG 피드백 연동.';

COMMENT ON COLUMN public.structure_suggestions.suggested_order IS 
  'AI 제안 순서: [{docId, order, assignedTag, reason}, ...]';

COMMENT ON COLUMN public.structure_suggestions.is_applied IS 
  '사용자가 적용 버튼을 눌렀는지 (피드백 연동용)';

COMMENT ON COLUMN public.structure_suggestions.is_modified IS 
  '사용자가 드래그로 순서를 변경했는지 (피드백 연동용)';
