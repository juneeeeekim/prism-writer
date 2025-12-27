-- =============================================================================
-- Phase 11: User Documents Table
-- =============================================================================
-- 파일: supabase/migrations/033_user_documents.sql
-- 역할: 사용자별 문서 저장 기능
-- 생성일: 2025-12-28
-- =============================================================================

-- -----------------------------------------------------------------------------
-- P1-01: user_documents 테이블 생성
-- -----------------------------------------------------------------------------
CREATE TABLE public.user_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT '제목 없음',
  content TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 성능 인덱스 (JeDebug 권장)
CREATE INDEX idx_user_documents_user_id ON public.user_documents(user_id);
CREATE INDEX idx_user_documents_updated_at ON public.user_documents(updated_at DESC);

-- -----------------------------------------------------------------------------
-- P1-02: RLS 정책 설정
-- -----------------------------------------------------------------------------
ALTER TABLE public.user_documents ENABLE ROW LEVEL SECURITY;

-- SELECT: 본인 문서만 조회
CREATE POLICY "Users can view own documents"
  ON public.user_documents FOR SELECT
  USING (auth.uid() = user_id);

-- INSERT: 본인 문서만 생성
CREATE POLICY "Users can insert own documents"
  ON public.user_documents FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- UPDATE: 본인 문서만 수정
CREATE POLICY "Users can update own documents"
  ON public.user_documents FOR UPDATE
  USING (auth.uid() = user_id);

-- DELETE: 본인 문서만 삭제
CREATE POLICY "Users can delete own documents"
  ON public.user_documents FOR DELETE
  USING (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- P1-03: updated_at 자동 갱신 트리거
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_user_documents_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_documents_updated_at
  BEFORE UPDATE ON public.user_documents
  FOR EACH ROW EXECUTE FUNCTION update_user_documents_updated_at();

-- -----------------------------------------------------------------------------
-- 완료 로그
-- -----------------------------------------------------------------------------
COMMENT ON TABLE public.user_documents IS 'Phase 11: 사용자별 문서 저장 테이블';
