-- =============================================================================
-- PRISM Writer - Telemetry Schema
-- =============================================================================
-- 파일: backend/migrations/019_telemetry_schema.sql
-- 역할: Telemetry 로그 테이블 생성
-- P1 Phase 3.4
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Telemetry Logs 테이블
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS telemetry_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- 실행 추적
    run_id TEXT NOT NULL,
    user_id UUID REFERENCES auth.users(id),
    
    -- 단계 정보
    step TEXT NOT NULL,
    
    -- 시간 측정
    start_time BIGINT NOT NULL,
    end_time BIGINT NOT NULL,
    latency_ms INT NOT NULL,
    
    -- 모델 정보
    model_id TEXT,
    tokens_in INT DEFAULT 0,
    tokens_out INT DEFAULT 0,
    
    -- 비용
    cost_estimate DECIMAL(10, 6) DEFAULT 0,
    
    -- 상태
    success BOOLEAN NOT NULL,
    error_code TEXT,
    
    -- 메타데이터
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- 인덱스
-- ---------------------------------------------------------------------------

-- Run ID로 전체 플로우 조회
CREATE INDEX IF NOT EXISTS idx_telemetry_run_id 
    ON telemetry_logs(run_id);

-- User ID로 사용자별 조회
CREATE INDEX IF NOT EXISTS idx_telemetry_user_id 
    ON telemetry_logs(user_id);

-- Step으로 단계별 분석
CREATE INDEX IF NOT EXISTS idx_telemetry_step 
    ON telemetry_logs(step);

-- 생성 시간으로 시계열 분석
CREATE INDEX IF NOT EXISTS idx_telemetry_created_at 
    ON telemetry_logs(created_at);

-- 복합 인덱스: 사용자 + 시간
CREATE INDEX IF NOT EXISTS idx_telemetry_user_time 
    ON telemetry_logs(user_id, created_at);

-- ---------------------------------------------------------------------------
-- RLS (Row Level Security)
-- ---------------------------------------------------------------------------

ALTER TABLE telemetry_logs ENABLE ROW LEVEL SECURITY;

-- 사용자는 자신의 로그만 조회 가능
CREATE POLICY telemetry_logs_select_policy 
    ON telemetry_logs 
    FOR SELECT 
    USING (auth.uid() = user_id);

-- 인증된 사용자만 삽입 가능
CREATE POLICY telemetry_logs_insert_policy 
    ON telemetry_logs 
    FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 분석용 뷰
-- ---------------------------------------------------------------------------

-- 일별 사용량 집계
CREATE OR REPLACE VIEW telemetry_daily_stats AS
SELECT 
    user_id,
    DATE(created_at) AS date,
    COUNT(*) AS total_requests,
    SUM(tokens_in) AS total_tokens_in,
    SUM(tokens_out) AS total_tokens_out,
    SUM(cost_estimate) AS total_cost,
    AVG(latency_ms) AS avg_latency_ms,
    COUNT(*) FILTER (WHERE success = true) AS success_count,
    COUNT(*) FILTER (WHERE success = false) AS error_count
FROM telemetry_logs
GROUP BY user_id, DATE(created_at);

-- 모델별 사용량 집계
CREATE OR REPLACE VIEW telemetry_model_stats AS
SELECT 
    model_id,
    COUNT(*) AS usage_count,
    SUM(tokens_in) AS total_tokens_in,
    SUM(tokens_out) AS total_tokens_out,
    SUM(cost_estimate) AS total_cost,
    AVG(latency_ms) AS avg_latency_ms
FROM telemetry_logs
WHERE model_id IS NOT NULL
GROUP BY model_id;

-- ---------------------------------------------------------------------------
-- 주석
-- ---------------------------------------------------------------------------
COMMENT ON TABLE telemetry_logs IS 'RAG 파이프라인 실행 로그 (P1 Phase 3)';
COMMENT ON COLUMN telemetry_logs.run_id IS '실행 고유 ID (모든 단계 연결)';
COMMENT ON COLUMN telemetry_logs.step IS '파이프라인 단계 (search, rerank, answer, review, citation)';
COMMENT ON COLUMN telemetry_logs.cost_estimate IS '추정 비용 (USD)';
