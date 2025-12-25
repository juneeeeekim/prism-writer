-- =============================================================================
-- PRISM Writer - Pipeline v4 Telemetry Run Type Migration
-- =============================================================================
-- 파일: backend/migrations/032_telemetry_run_type.sql
-- 역할: telemetry_logs 테이블에 run_type 컬럼 추가
-- Phase: Pipeline v4 업그레이드 - JeDebug Risk 3 해결
-- =============================================================================

-- =============================================================================
-- 1. run_type ENUM 타입 생성
-- =============================================================================
-- 주석(시니어 개발자): Pipeline v4에서 build/judge 분리 추적용
-- 'build': 템플릿 빌드 과정 (Phase A)
-- 'judge': 사용자 텍스트 평가 과정 (Phase B)

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'telemetry_run_type') THEN
        CREATE TYPE telemetry_run_type AS ENUM ('build', 'judge');
    END IF;
END$$;

-- =============================================================================
-- 2. telemetry_logs 테이블에 run_type 컬럼 추가
-- =============================================================================
-- 주석(주니어 개발자): 기존 데이터는 'judge'로 기본값 설정하여 하위 호환성 유지

ALTER TABLE telemetry_logs 
ADD COLUMN IF NOT EXISTS run_type telemetry_run_type DEFAULT 'judge';

-- 기존 데이터에 기본값 적용 (NULL 방지)
UPDATE telemetry_logs 
SET run_type = 'judge' 
WHERE run_type IS NULL;

-- =============================================================================
-- 3. run_type별 인덱스 생성
-- =============================================================================
-- 주석(시니어 개발자): build/judge 분리 조회 시 성능 최적화

CREATE INDEX IF NOT EXISTS idx_telemetry_run_type 
ON telemetry_logs (run_type);

-- 복합 인덱스: user_id + run_type + created_at
CREATE INDEX IF NOT EXISTS idx_telemetry_user_run_type_time 
ON telemetry_logs (user_id, run_type, created_at);

-- =============================================================================
-- 4. 분석용 뷰 업데이트: run_type별 통계
-- =============================================================================
-- 주석(UX/UI 개발자 리뷰): 대시보드에서 build/judge 분리 모니터링용

CREATE OR REPLACE VIEW telemetry_run_type_stats WITH (security_invoker = true) AS
SELECT 
    user_id,
    run_type,
    DATE(created_at) AS date,
    COUNT(*) AS total_runs,
    SUM(tokens_in) AS total_tokens_in,
    SUM(tokens_out) AS total_tokens_out,
    SUM(cost_estimate) AS total_cost,
    AVG(latency_ms) AS avg_latency_ms,
    COUNT(*) FILTER (WHERE success = true) AS success_count,
    COUNT(*) FILTER (WHERE success = false) AS error_count
FROM telemetry_logs
GROUP BY user_id, run_type, DATE(created_at);

COMMENT ON VIEW telemetry_run_type_stats IS 'Pipeline v4: run_type (build/judge) 별 일일 통계';

-- =============================================================================
-- 5. 테이블 주석 업데이트
-- =============================================================================

COMMENT ON COLUMN telemetry_logs.run_type IS 'Pipeline v4: 실행 유형 (build=템플릿 빌드, judge=텍스트 평가)';

-- =============================================================================
-- ==================== 롤백 스크립트 (ROLLBACK SECTION) =======================
-- =============================================================================
/*
-- 롤백 절차:
-- 1. 뷰 삭제
DROP VIEW IF EXISTS telemetry_run_type_stats;

-- 2. 인덱스 삭제
DROP INDEX IF EXISTS idx_telemetry_user_run_type_time;
DROP INDEX IF EXISTS idx_telemetry_run_type;

-- 3. 컬럼 삭제
ALTER TABLE telemetry_logs DROP COLUMN IF EXISTS run_type;

-- 4. ENUM 타입 삭제
DROP TYPE IF EXISTS telemetry_run_type;
*/
