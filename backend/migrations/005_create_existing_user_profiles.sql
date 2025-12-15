-- =============================================================================
-- PRISM Writer - 기존 사용자 프로필 생성
-- =============================================================================
-- 파일: 005_create_existing_user_profiles.sql
-- 역할: 기존 auth.users에 있는 사용자들의 profiles 레코드 생성
-- 실행: Supabase SQL Editor에서 실행 (1번째로 실행)
-- =============================================================================

-- 기존 auth.users에 있는 모든 사용자의 profiles 생성
-- (이미 profiles에 있는 사용자는 제외)
INSERT INTO profiles (id, role, is_approved, daily_request_limit, monthly_token_limit, created_at, updated_at)
SELECT 
    id,
    'free',           -- 기본 등급: 무료
    true,             -- 승인됨
    5,                -- 일일 5회 요청
    10000,            -- 월간 10,000 토큰
    NOW(),
    NOW()
FROM auth.users
WHERE id NOT IN (SELECT id FROM profiles);

-- 실행 결과 확인
SELECT 
    p.id,
    u.email,
    p.role,
    p.is_approved,
    p.daily_request_limit,
    p.monthly_token_limit
FROM profiles p
JOIN auth.users u ON p.id = u.id;
