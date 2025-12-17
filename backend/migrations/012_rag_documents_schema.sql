-- =============================================================================
-- PRISM Writer - RAG Documents Schema
-- =============================================================================
-- 파일: backend/migrations/012_rag_documents_schema.sql
-- 역할: RAG 시스템을 위한 문서 업로드 및 관리 테이블 생성
-- 목적: 사용자가 업로드한 강의/자료 파일 메타데이터 저장
-- 버전: v1.0
-- =============================================================================

-- =============================================================================
-- 1. 테이블 생성: rag_documents
-- =============================================================================
-- 설명: 업로드된 문서의 메타데이터와 처리 상태를 관리하는 테이블

CREATE TABLE IF NOT EXISTS public.rag_documents (
    -- -------------------------------------------------------------------------
    -- 기본 ID 및 소유권
    -- -------------------------------------------------------------------------
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- -------------------------------------------------------------------------
    -- 문서 정보
    -- -------------------------------------------------------------------------
    title TEXT NOT NULL,
    file_path TEXT NOT NULL,  -- Supabase Storage 경로
    file_type TEXT NOT NULL,  -- MIME type (application/pdf, text/plain, etc.)
    file_size BIGINT NOT NULL CHECK (file_size > 0),
    
    -- -------------------------------------------------------------------------
    -- 처리 상태
    -- -------------------------------------------------------------------------
    status TEXT NOT NULL DEFAULT 'pending' CHECK (
        status IN ('pending', 'processing', 'ready', 'error')
    ),
    
    -- -------------------------------------------------------------------------
    -- 확장 메타데이터 (JSONB)
    -- -------------------------------------------------------------------------
    -- 예시: { "page_count": 10, "language": "ko", "error_message": "..." }
    metadata JSONB DEFAULT '{}'::jsonb,
    
    -- -------------------------------------------------------------------------
    -- 버전 관리
    -- -------------------------------------------------------------------------
    version INTEGER NOT NULL DEFAULT 1,
    
    -- -------------------------------------------------------------------------
    -- 타임스탬프
    -- -------------------------------------------------------------------------
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- 2. 인덱스 생성 (성능 최적화)
-- =============================================================================

-- user_id로 문서 조회 (가장 빈번한 쿼리)
CREATE INDEX IF NOT EXISTS idx_rag_documents_user_id 
    ON public.rag_documents(user_id);

-- 상태별 필터링 (대시보드, 관리 페이지)
CREATE INDEX IF NOT EXISTS idx_rag_documents_status 
    ON public.rag_documents(status);

-- 생성일 기준 정렬 (최신순 조회)
CREATE INDEX IF NOT EXISTS idx_rag_documents_created_at 
    ON public.rag_documents(created_at DESC);

-- 복합 인덱스: user_id + status (사용자별 상태 필터링)
CREATE INDEX IF NOT EXISTS idx_rag_documents_user_status 
    ON public.rag_documents(user_id, status);

-- =============================================================================
-- 3. RLS (Row Level Security) 활성화
-- =============================================================================

-- RLS 활성화
ALTER TABLE public.rag_documents ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- 4. RLS 정책 정의
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 정책 1: 사용자는 본인의 문서만 조회 가능
-- -----------------------------------------------------------------------------
CREATE POLICY "Users can view own documents"
    ON public.rag_documents
    FOR SELECT
    USING (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- 정책 2: 사용자는 본인 명의로 문서 삽입 가능
-- -----------------------------------------------------------------------------
CREATE POLICY "Users can insert own documents"
    ON public.rag_documents
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- 정책 3: 사용자는 본인의 문서만 수정 가능
-- -----------------------------------------------------------------------------
CREATE POLICY "Users can update own documents"
    ON public.rag_documents
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- 정책 4: 사용자는 본인의 문서만 삭제 가능
-- -----------------------------------------------------------------------------
CREATE POLICY "Users can delete own documents"
    ON public.rag_documents
    FOR DELETE
    USING (auth.uid() = user_id);

-- =============================================================================
-- 5. 자동 updated_at 업데이트 트리거
-- =============================================================================

-- 트리거 함수: updated_at 자동 갱신
CREATE OR REPLACE FUNCTION public.update_rag_documents_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 트리거 생성
CREATE TRIGGER trigger_update_rag_documents_updated_at
    BEFORE UPDATE ON public.rag_documents
    FOR EACH ROW
    EXECUTE FUNCTION public.update_rag_documents_updated_at();

-- =============================================================================
-- 6. 기본 코멘트 (문서화)
-- =============================================================================

COMMENT ON TABLE public.rag_documents IS 
    'RAG 시스템용 업로드 문서 메타데이터 테이블 (v1.0)';

COMMENT ON COLUMN public.rag_documents.id IS 
    '문서 고유 ID (UUID)';

COMMENT ON COLUMN public.rag_documents.user_id IS 
    '문서 소유자 (auth.users 참조)';

COMMENT ON COLUMN public.rag_documents.title IS 
    '문서 제목 (사용자 지정 또는 파일명)';

COMMENT ON COLUMN public.rag_documents.file_path IS 
    'Supabase Storage 내 파일 경로';

COMMENT ON COLUMN public.rag_documents.file_type IS 
    'MIME type (예: application/pdf, text/plain)';

COMMENT ON COLUMN public.rag_documents.file_size IS 
    '파일 크기 (bytes)';

COMMENT ON COLUMN public.rag_documents.status IS 
    '처리 상태: pending(대기), processing(처리중), ready(완료), error(오류)';

COMMENT ON COLUMN public.rag_documents.metadata IS 
    '확장 메타데이터 (JSONB): 페이지 수, 언어, 오류 메시지 등';

COMMENT ON COLUMN public.rag_documents.version IS 
    '문서 버전 번호 (기본값: 1)';

-- =============================================================================
-- 7. 마이그레이션 완료 확인 쿼리
-- =============================================================================
-- 아래 쿼리로 테이블 생성 확인 (수동 실행용)
-- SELECT table_name, column_name, data_type
-- FROM information_schema.columns
-- WHERE table_schema = 'public' AND table_name = 'rag_documents'
-- ORDER BY ordinal_position;

-- =============================================================================
-- 마이그레이션 완료
-- =============================================================================
