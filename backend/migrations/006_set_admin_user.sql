-- =============================================================================
-- PRISM Writer - 관리자 계정 설정
-- =============================================================================
-- 파일: 006_set_admin_user.sql
-- 역할: 특정 사용자를 관리자(admin)로 승격
-- 실행: Supabase SQL Editor에서 실행 (2번째로 실행)
-- 주의: 이메일 주소를 실제 관리자 이메일로 변경하세요!
-- =============================================================================

-- ⚠️ 이메일 주소를 수정하세요!
-- 디렉터님(juneeee.kim@gmail.com)을 관리자로 설정
UPDATE profiles
SET 
    role = 'admin',
    is_approved = true,
    approved_at = NOW(),
    daily_request_limit = 999999,    -- 무제한
    monthly_token_limit = 999999,    -- 무제한
    updated_at = NOW()
WHERE id = (
    SELECT id FROM auth.users 
    WHERE email = 'juneeee.kim@gmail.com'  -- ⚠️ 실제 이메일로 변경하세요
);

-- 실행 결과 확인
SELECT 
    p.id,
    u.email,
    p.role,
    p.is_approved,
    p.daily_request_limit,
    p.monthly_token_limit
FROM profiles p
JOIN auth.users u ON p.id = u.id
WHERE p.role = 'admin';
