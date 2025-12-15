-- =============================================================================
-- PRISM Writer - 긴급 진단 SQL
-- =============================================================================
-- 파일: 010_emergency_diagnosis.sql
-- 역할: 현재 프로필 상태 확인 및 데이터 복구
-- 실행: Supabase SQL Editor에서 순서대로 실행
-- =============================================================================

-- =============================================================================
-- Step 1: 현재 상태 확인
-- =============================================================================

-- 1.1 auth.users 테이블 확인 (가입된 사용자 목록)
SELECT id, email, created_at FROM auth.users ORDER BY created_at;

-- 1.2 profiles 테이블 확인 (프로필 데이터)
SELECT 
    p.id,
    u.email,
    p.role,
    p.tier,
    p.is_approved,
    p.daily_request_limit,
    p.monthly_token_limit
FROM profiles p
LEFT JOIN auth.users u ON p.id = u.id;

-- 1.3 RLS 정책 확인
SELECT schemaname, tablename, policyname, cmd
FROM pg_policies
WHERE tablename = 'profiles';

-- =============================================================================
-- Step 2: 프로필 데이터 복구 (필요한 경우만 실행)
-- =============================================================================

-- 2.1 모든 auth.users에 대해 profiles 생성 (없는 경우만)
INSERT INTO profiles (id, role, tier, is_approved, daily_request_limit, monthly_token_limit, created_at, updated_at)
SELECT 
    id,
    'free',
    1,
    true,
    5,
    10000,
    NOW(),
    NOW()
FROM auth.users
WHERE id NOT IN (SELECT id FROM profiles);

-- =============================================================================
-- Step 3: 관리자 설정
-- =============================================================================

-- 3.1 juneeee.kim@gmail.com을 admin으로 설정
UPDATE profiles
SET 
    role = 'admin',
    tier = 4,
    is_approved = true,
    daily_request_limit = 999999,
    monthly_token_limit = 999999,
    updated_at = NOW()
WHERE id = (SELECT id FROM auth.users WHERE email = 'juneeee.kim@gmail.com');

-- =============================================================================
-- Step 4: 최종 확인
-- =============================================================================

SELECT 
    p.id,
    u.email,
    p.role,
    p.tier,
    p.is_approved,
    p.daily_request_limit,
    p.monthly_token_limit
FROM profiles p
LEFT JOIN auth.users u ON p.id = u.id
ORDER BY p.tier DESC;
