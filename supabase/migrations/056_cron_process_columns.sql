-- =============================================================================
-- [P9-CRON] Cron 처리를 위한 user_documents 컬럼 추가
-- =============================================================================
-- 파일: supabase/migrations/056_cron_process_columns.sql
-- 생성일: 2026-01-01
-- 역할: Vercel Cron Job이 pending 문서를 처리할 때 필요한 컬럼 추가
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. retry_count: 재시도 횟수 추적 (최대 3회)
-- ---------------------------------------------------------------------------
ALTER TABLE user_documents
ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0;

COMMENT ON COLUMN user_documents.retry_count IS
  '[P9-CRON] 문서 처리 재시도 횟수. 3회 초과 시 failed 처리.';

-- ---------------------------------------------------------------------------
-- 2. started_at: 처리 시작 시간 (Stuck 문서 감지용)
-- ---------------------------------------------------------------------------
ALTER TABLE user_documents
ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ DEFAULT NULL;

COMMENT ON COLUMN user_documents.started_at IS
  '[P9-CRON] 문서 처리 시작 시간. 30분 이상 처리 중이면 Stuck으로 간주.';

-- ---------------------------------------------------------------------------
-- 3. 인덱스 추가 (Cron 쿼리 최적화)
-- ---------------------------------------------------------------------------
-- pending/failed 상태 + 생성일 정렬 쿼리 최적화
CREATE INDEX IF NOT EXISTS idx_user_documents_status_created
ON user_documents (status, created_at)
WHERE status IN ('pending', 'failed');

COMMENT ON INDEX idx_user_documents_status_created IS
  '[P9-CRON] Cron Job이 pending 문서를 조회할 때 사용하는 부분 인덱스';

-- ---------------------------------------------------------------------------
-- Schema Cache 갱신
-- ---------------------------------------------------------------------------
NOTIFY pgrst, 'reload schema';
