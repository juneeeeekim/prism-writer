-- =============================================================================
-- ROLLBACK SCRIPT: Revert Security Definer View Changes
-- =============================================================================
-- Use this script ONLY if the security fix causes critical issues.
-- It reverts the views to their previous state (SECURITY DEFINER behavior).
-- =============================================================================

-- 1. Revert Telemetry Views (backend/migrations/019_telemetry_schema.sql)
-- -----------------------------------------------------------------------------

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

-- 2. Revert Operations Views (backend/migrations/015_operations_tables.sql)
-- -----------------------------------------------------------------------------

CREATE OR REPLACE VIEW public.daily_usage_summary AS
SELECT 
  user_id,
  DATE(created_at) as usage_date,
  usage_type,
  SUM(tokens_used) as total_tokens,
  SUM(estimated_cost) as total_cost,
  COUNT(*) as request_count
FROM public.usage_records
GROUP BY user_id, DATE(created_at), usage_type;

CREATE OR REPLACE VIEW public.feedback_summary AS
SELECT 
  DATE_TRUNC('day', created_at) as feedback_date,
  feedback_type,
  COUNT(*) as count
FROM public.evaluation_feedback
GROUP BY DATE_TRUNC('day', created_at), feedback_type;

-- =============================================================================
-- Rollback Complete
-- =============================================================================
