-- =============================================================================
-- Phase A Track 1: P1-01 - document_versions 테이블 생성
-- =============================================================================
-- 역할: 문서 버전 이력 저장 (자동 스냅샷 + 수동 스냅샷)
-- 생성일: 2026-03-19
-- =============================================================================

-- 스냅샷 타입 ENUM
CREATE TYPE snapshot_type AS ENUM ('auto', 'manual');

-- document_versions 테이블
CREATE TABLE IF NOT EXISTS document_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES user_documents(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL DEFAULT '',
  version_number INTEGER NOT NULL DEFAULT 1,
  content_hash TEXT NOT NULL,           -- SHA256 앞 16자리 (중복 스냅샷 방지)
  byte_size INTEGER NOT NULL DEFAULT 0, -- 콘텐츠 바이트 크기
  snapshot_type snapshot_type NOT NULL DEFAULT 'auto',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 인덱스
CREATE INDEX idx_document_versions_document_id
  ON document_versions (document_id);

CREATE INDEX idx_document_versions_user_document
  ON document_versions (user_id, document_id);

CREATE INDEX idx_document_versions_document_created
  ON document_versions (document_id, created_at DESC);

-- 유니크 제약: 동일 문서에 같은 버전 번호 중복 방지
CREATE UNIQUE INDEX idx_document_versions_doc_version
  ON document_versions (document_id, version_number);

-- =============================================================================
-- RLS (Row Level Security)
-- =============================================================================
ALTER TABLE document_versions ENABLE ROW LEVEL SECURITY;

-- SELECT: 본인 버전만 조회 가능
CREATE POLICY "Users can select own versions"
  ON document_versions
  FOR SELECT
  USING (auth.uid() = user_id);

-- INSERT: 본인 버전만 생성 가능
CREATE POLICY "Users can insert own versions"
  ON document_versions
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- DELETE: 본인 버전만 삭제 가능 (정리용)
CREATE POLICY "Users can delete own versions"
  ON document_versions
  FOR DELETE
  USING (auth.uid() = user_id);

-- 코멘트
COMMENT ON TABLE document_versions IS '문서 버전 이력 (Phase A Track 1)';
COMMENT ON COLUMN document_versions.content_hash IS 'SHA256 해시 앞 16자리 - 중복 스냅샷 방지용';
COMMENT ON COLUMN document_versions.snapshot_type IS 'auto: 자동 저장 스냅샷, manual: 사용자 수동 저장';
