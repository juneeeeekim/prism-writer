-- =============================================================================
-- VERIFICATION SCRIPT: Security Fix & RLS Testing
-- =============================================================================
-- Use this script in the Supabase SQL Editor to verify the security fix.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Schema & Type Check (Regression Test)
-- -----------------------------------------------------------------------------
-- Ensure the views still exist and return the expected columns.
-- If these queries run without error, the schema is valid.

SELECT user_id, date, total_requests, total_cost 
FROM telemetry_daily_stats 
LIMIT 1;

SELECT model_id, usage_count, total_cost 
FROM telemetry_model_stats 
LIMIT 1;

-- -----------------------------------------------------------------------------
-- 2. Admin/Service Role Check (Regression Test)
-- -----------------------------------------------------------------------------
-- The SQL Editor runs as 'postgres' (superuser) or 'service_role' by default.
-- Running this WITHOUT setting a local role should return GLOBAL stats (all users).

SELECT 'Admin View' as test_case, COUNT(*) as total_rows FROM telemetry_daily_stats;

-- -----------------------------------------------------------------------------
-- 3. User Isolation Test (Security Test)
-- -----------------------------------------------------------------------------
-- Replace 'USER_UUID_A' and 'USER_UUID_B' with actual User IDs from your auth.users table.

-- [TEST CASE A] Simulate User A
BEGIN;
  SET LOCAL ROLE authenticated;
  SET LOCAL "request.jwt.claim.sub" = 'USER_UUID_A'; -- ⚠️ REPLACE THIS
  
  SELECT 'User A View' as test_case, * FROM telemetry_daily_stats;
ROLLBACK;

-- [TEST CASE B] Simulate User B
BEGIN;
  SET LOCAL ROLE authenticated;
  SET LOCAL "request.jwt.claim.sub" = 'USER_UUID_B'; -- ⚠️ REPLACE THIS
  
  SELECT 'User B View' as test_case, * FROM telemetry_daily_stats;
ROLLBACK;

-- =============================================================================
-- Expected Results:
-- 1. Admin View: Should show rows for ALL users.
-- 2. User A View: Should ONLY show rows where user_id = USER_UUID_A.
-- 3. User B View: Should ONLY show rows where user_id = USER_UUID_B.
-- =============================================================================
