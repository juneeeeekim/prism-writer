-- =============================================================================
-- Fix: Differentiate editor-saved documents from uploaded reference materials
-- Date: 2026-01-02
-- Issue: Both editor and upload have source='upload', need to distinguish them
-- =============================================================================

-- 1. 업로드된 파일은 file_path가 있음, 에디터 저장은 file_path가 NULL
-- 이 조건을 이용해 기존 데이터 수정
UPDATE user_documents
SET source = 'editor'
WHERE file_path IS NULL
  AND source = 'upload';

-- 2. 향후 구분을 위해 source 컬럼의 기본값을 NULL로 변경 (명시적 설정 강제)
ALTER TABLE user_documents
ALTER COLUMN source SET DEFAULT NULL;

-- 3. Reload PostgREST Schema Cache
NOTIFY pgrst, 'reload schema';

-- =============================================================================
-- 참고: 이 마이그레이션 후
-- - 업로드한 파일: source = 'upload', file_path IS NOT NULL
-- - 에디터 저장: source = 'editor', file_path IS NULL
-- =============================================================================
