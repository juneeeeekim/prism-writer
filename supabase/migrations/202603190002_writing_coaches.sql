-- =============================================================================
-- Phase C Track 1: P3-01 - writing_coaches 테이블 생성
-- =============================================================================
-- 역할: AI 글쓰기 코치 페르소나 저장
-- 생성일: 2026-03-19
-- =============================================================================

-- =============================================================================
-- writing_coaches 테이블 생성
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.writing_coaches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT DEFAULT '🎓',
  style_profile JSONB DEFAULT '{}',
  source_document_ids UUID[] DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 테이블 코멘트
COMMENT ON TABLE public.writing_coaches IS 'AI 글쓰기 코치 페르소나 - 사용자별 스타일 프로필 관리';

-- =============================================================================
-- 인덱스
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_writing_coaches_user_id
  ON public.writing_coaches(user_id);

CREATE INDEX IF NOT EXISTS idx_writing_coaches_user_project
  ON public.writing_coaches(user_id, project_id);

-- =============================================================================
-- updated_at 트리거 (update_updated_at_column 함수는 이미 존재)
-- =============================================================================
CREATE TRIGGER writing_coaches_updated_at
  BEFORE UPDATE ON public.writing_coaches
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================================================
-- RLS 활성화 및 정책
-- =============================================================================
ALTER TABLE public.writing_coaches ENABLE ROW LEVEL SECURITY;

-- 사용자는 자신의 코치만 관리 가능
CREATE POLICY "writing_coaches_select_own"
  ON public.writing_coaches FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "writing_coaches_insert_own"
  ON public.writing_coaches FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "writing_coaches_update_own"
  ON public.writing_coaches FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "writing_coaches_delete_own"
  ON public.writing_coaches FOR DELETE
  USING (auth.uid() = user_id);
