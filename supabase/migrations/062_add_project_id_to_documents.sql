-- =============================================================================
-- Phase RAG-01: Add project_id to user_documents
-- =============================================================================
-- 목적: 문서를 프로젝트별로 격리하여 RAG 검색 시 프로젝트 내 문서만 조회
-- 생성일: 2026-01-02
-- =============================================================================

-- 1. user_documents에 project_id 컬럼 추가
-- ON DELETE SET NULL: 프로젝트 삭제 시 문서는 유지 (고아 문서로 전환)
ALTER TABLE public.user_documents 
ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL;

-- 2. 성능 최적화를 위한 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_user_documents_project_id 
ON public.user_documents(project_id);

-- 3. 복합 인덱스: user_id + project_id (자주 사용되는 쿼리 최적화)
CREATE INDEX IF NOT EXISTS idx_user_documents_user_project 
ON public.user_documents(user_id, project_id);

-- 4. 스키마 리로드 (PostgREST 캐시 갱신)
NOTIFY pgrst, 'reload schema';
