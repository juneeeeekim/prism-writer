-- =============================================================================
-- Phase 5: 멀티 프로젝트 시스템 - 마이그레이션
-- =============================================================================
-- 파일: supabase/migrations/050_phase5_projects.sql
-- 생성일: 2025-12-31
-- 담당: Tech Lead
-- 
-- 주석(시니어 개발자): 이 마이그레이션은 멀티 프로젝트 시스템을 위한 
-- 기반 테이블을 생성하고 기존 테이블들에 project_id 컬럼을 추가합니다.
-- 모든 변경은 IF NOT EXISTS로 멱등성을 보장합니다.
-- =============================================================================

-- =============================================================================
-- [P5-01-A] projects 테이블 생성
-- =============================================================================

-- 프로젝트 테이블 생성
CREATE TABLE IF NOT EXISTS public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT DEFAULT '📁',
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 테이블 코멘트
COMMENT ON TABLE public.projects IS '멀티 프로젝트 시스템 - 사용자별 프로젝트 관리';
COMMENT ON COLUMN public.projects.id IS '프로젝트 고유 ID (UUID)';
COMMENT ON COLUMN public.projects.user_id IS '소유자 ID (auth.users 참조)';
COMMENT ON COLUMN public.projects.name IS '프로젝트 이름';
COMMENT ON COLUMN public.projects.description IS '프로젝트 설명';
COMMENT ON COLUMN public.projects.icon IS '아이콘 (이모지)';
COMMENT ON COLUMN public.projects.status IS '상태: active(활성) | archived(보관됨)';

-- RLS 활성화
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- RLS 정책: 사용자 본인 프로젝트만 CRUD
DROP POLICY IF EXISTS "projects_user_crud" ON public.projects;
CREATE POLICY "projects_user_crud" ON public.projects
  FOR ALL USING (auth.uid() = user_id);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_projects_user ON public.projects(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON public.projects(user_id, status);
CREATE INDEX IF NOT EXISTS idx_projects_updated ON public.projects(user_id, updated_at DESC);

-- =============================================================================
-- [P5-01-B] user_documents에 project_id 컬럼 추가
-- =============================================================================

-- project_id 컬럼 추가 (존재하지 않는 경우에만)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'user_documents' 
    AND column_name = 'project_id'
  ) THEN
    ALTER TABLE public.user_documents 
      ADD COLUMN project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE;
  END IF;
END $$;

-- 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_user_documents_project 
  ON public.user_documents(project_id);

COMMENT ON COLUMN public.user_documents.project_id IS '소속 프로젝트 ID';

-- =============================================================================
-- [P5-01-C] evaluation_logs에 project_id 컬럼 추가
-- =============================================================================

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'evaluation_logs' 
    AND column_name = 'project_id'
  ) THEN
    ALTER TABLE public.evaluation_logs 
      ADD COLUMN project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_evaluation_logs_project 
  ON public.evaluation_logs(project_id);

COMMENT ON COLUMN public.evaluation_logs.project_id IS '소속 프로젝트 ID';

-- =============================================================================
-- [P5-01-D] chat_sessions에 project_id 컬럼 추가
-- =============================================================================

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'chat_sessions' 
    AND column_name = 'project_id'
  ) THEN
    ALTER TABLE public.chat_sessions 
      ADD COLUMN project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_chat_sessions_project 
  ON public.chat_sessions(project_id);

COMMENT ON COLUMN public.chat_sessions.project_id IS '소속 프로젝트 ID';

-- =============================================================================
-- [P5-01-D-2] rag_templates에 project_id 컬럼 추가 (Phase 2에서 생성된 테이블)
-- =============================================================================

DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'rag_templates'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'rag_templates' 
      AND column_name = 'project_id'
    ) THEN
      ALTER TABLE public.rag_templates 
        ADD COLUMN project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE;
      CREATE INDEX IF NOT EXISTS idx_rag_templates_project 
        ON public.rag_templates(project_id);
    END IF;
  END IF;
END $$;

-- =============================================================================
-- 마이그레이션 완료 로그
-- =============================================================================

DO $$
BEGIN
  RAISE NOTICE '[Phase5] 050_phase5_projects.sql 마이그레이션 완료';
  RAISE NOTICE '  - projects 테이블 생성';
  RAISE NOTICE '  - user_documents.project_id 추가';
  RAISE NOTICE '  - evaluation_logs.project_id 추가';
  RAISE NOTICE '  - chat_sessions.project_id 추가';
  RAISE NOTICE '  - rag_templates.project_id 추가 (존재 시)';
END $$;
