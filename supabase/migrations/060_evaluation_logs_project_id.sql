-- =============================================================================
-- PRISM Writer - Add project_id and document_id to evaluation_logs
-- =============================================================================
-- 파일: supabase/migrations/060_evaluation_logs_project_id.sql
-- 역할: evaluation_logs 테이블에 project_id, document_id 컬럼 추가
-- 생성일: 2026-01-02
-- 문제: API가 이 컬럼들을 사용하지만 테이블에 없어서 INSERT 실패
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. project_id 컬럼 추가 (NULL 허용 - 기존 데이터 호환)
-- -----------------------------------------------------------------------------
ALTER TABLE public.evaluation_logs
ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL;

-- -----------------------------------------------------------------------------
-- 2. document_id 컬럼 추가 (NULL 허용 - 기존 데이터 호환)
-- -----------------------------------------------------------------------------
ALTER TABLE public.evaluation_logs
ADD COLUMN IF NOT EXISTS document_id UUID REFERENCES public.user_documents(id) ON DELETE SET NULL;

-- -----------------------------------------------------------------------------
-- 3. 인덱스 추가 (프로젝트별 조회 최적화)
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_evaluation_logs_project_id ON public.evaluation_logs(project_id);
CREATE INDEX IF NOT EXISTS idx_evaluation_logs_document_id ON public.evaluation_logs(document_id);

-- -----------------------------------------------------------------------------
-- 4. 코멘트
-- -----------------------------------------------------------------------------
COMMENT ON COLUMN public.evaluation_logs.project_id IS '평가가 속한 프로젝트 ID';
COMMENT ON COLUMN public.evaluation_logs.document_id IS '평가 대상 문서 ID';

-- 스키마 리로드 (PostgREST 캐시 갱신)
NOTIFY pgrst, 'reload schema';
