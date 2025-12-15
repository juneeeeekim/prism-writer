-- =============================================================================
-- PRISM Writer - 프로필 tier 컬럼 수정
-- =============================================================================
-- 파일: 008_fix_profile_tier.sql
-- 역할: NULL인 tier 컬럼에 기본값 설정
-- 실행: Supabase SQL Editor에서 실행
-- 문제: tier가 NULL이면 프론트엔드에서 프로필 조회 오류 발생
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. tier 컬럼 기본값 설정
-- -----------------------------------------------------------------------------

-- 관리자(admin) → tier = 4
UPDATE profiles 
SET tier = 4 
WHERE tier IS NULL AND role = 'admin';

-- 스페셜(special) → tier = 3
UPDATE profiles 
SET tier = 3 
WHERE tier IS NULL AND role = 'special';

-- 프리미엄(premium) → tier = 2
UPDATE profiles 
SET tier = 2 
WHERE tier IS NULL AND role = 'premium';

-- 무료(free) → tier = 1
UPDATE profiles 
SET tier = 1 
WHERE tier IS NULL AND role = 'free';

-- 대기(pending) → tier = 0
UPDATE profiles 
SET tier = 0 
WHERE tier IS NULL AND role = 'pending';

-- -----------------------------------------------------------------------------
-- 2. 결과 확인
-- -----------------------------------------------------------------------------
SELECT 
    p.id,
    u.email,
    p.role,
    p.tier,
    p.is_approved,
    p.daily_request_limit,
    p.monthly_token_limit
FROM profiles p
JOIN auth.users u ON p.id = u.id
ORDER BY p.tier DESC;
