-- =============================================================================
-- Migration: 085_structure_user_adjustments.sql
-- Description: AI Structurer 사용자 순서 조정 이력 테이블
-- Created: 2026-01-09
-- Related: 2601090024_Structure_Feedback_Integration_Spec.md (P1-02)
-- =============================================================================
--
-- [시니어 개발자 주석]
-- 이 테이블은 사용자가 AI 제안을 수정한 이력을 저장합니다.
-- 드래그로 순서를 변경한 경우, 원본 순서와 변경된 순서를 모두 기록합니다.
-- 이 데이터는 향후 AI 모델 개선 및 개인화에 활용될 수 있습니다.
-- =============================================================================

-- =============================================================================
-- [P1-02-A] 테이블 생성
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.structure_user_adjustments (
  -- PK
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- ==========================================================================
  -- 관계 (FK)
  -- ==========================================================================
  /** 원본 AI 제안 ID */
  suggestion_id UUID NOT NULL REFERENCES public.structure_suggestions(id) ON DELETE CASCADE,
  /** 조정한 사용자 ID */
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- ==========================================================================
  -- 변경 내용
  -- ==========================================================================
  /** 변경 전 순서 (AI 제안 원본) */
  original_order JSONB NOT NULL,
  /** 변경 후 순서 (사용자 조정 결과) */
  adjusted_order JSONB NOT NULL,
  /** 조정 유형: 'drag_reorder' | 'manual_edit' */
  adjustment_type TEXT NOT NULL CHECK (adjustment_type IN ('drag_reorder', 'manual_edit')),
  
  -- ==========================================================================
  -- 타임스탬프
  -- ==========================================================================
  adjusted_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- [P1-02-A] 인덱스 생성
-- =============================================================================
-- 제안별 조정 이력 조회 최적화
CREATE INDEX IF NOT EXISTS idx_structure_adjustments_suggestion 
  ON public.structure_user_adjustments(suggestion_id);

-- 사용자별 조정 이력 조회 최적화
CREATE INDEX IF NOT EXISTS idx_structure_adjustments_user 
  ON public.structure_user_adjustments(user_id);

-- =============================================================================
-- [P1-02-A] RLS (Row Level Security) 설정
-- =============================================================================
ALTER TABLE public.structure_user_adjustments ENABLE ROW LEVEL SECURITY;

-- 본인 데이터만 CRUD 가능
CREATE POLICY "structure_adjustments_all_own"
  ON public.structure_user_adjustments
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- =============================================================================
-- [P1-02-A] 테이블 및 컬럼 주석
-- =============================================================================
COMMENT ON TABLE public.structure_user_adjustments IS 
  '사용자가 AI 구조 제안을 수정한 이력. 원본 vs 변경 후 순서 비교 가능.';

COMMENT ON COLUMN public.structure_user_adjustments.original_order IS 
  '변경 전 순서 (AI 제안 원본)';

COMMENT ON COLUMN public.structure_user_adjustments.adjusted_order IS 
  '변경 후 순서 (사용자 드래그 결과)';

COMMENT ON COLUMN public.structure_user_adjustments.adjustment_type IS 
  '조정 유형: drag_reorder (드래그) 또는 manual_edit (수동)';
