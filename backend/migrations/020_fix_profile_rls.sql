-- =============================================================================
-- PRISM Writer - 프로필 RLS 정책 수정 및 데이터 복구
-- =============================================================================
-- 파일: backend/migrations/020_fix_profile_rls.sql
-- 목표: 사용자가 자신의 프로필을 보지 못하는 권한 문제 해결 + 0으로 설정된 할당량 복구
-- =============================================================================

-- 1. 기존 정책 정리 (혹시 모를 중복 방지)
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;

-- 2. "본인 프로필 조회" 정책 강력 적용
-- (auth.uid() = id 조건만 있으면 됨)
CREATE POLICY "Users can view own profile"
    ON profiles FOR SELECT
    USING (auth.uid() = id);

-- 3. 데이터 복구: 등급은 있는데 할당량이 0인 유저 복구
-- (과거 트리거 오류나 관리자 수동 승인 시 누락된 케이스)

-- Free 등급 복구
UPDATE profiles
SET 
    daily_request_limit = 5,
    monthly_token_limit = 10000
WHERE 
    role = 'free' 
    AND (daily_request_limit = 0 OR daily_request_limit IS NULL);

-- Premium 등급 복구
UPDATE profiles
SET 
    daily_request_limit = 50,
    monthly_token_limit = 30000
WHERE 
    role = 'premium' 
    AND (daily_request_limit = 0 OR daily_request_limit IS NULL);

-- RLS 활성화 확인 (이미 되어있겠지만 안전장치)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- 4. 확인용 주석 (Supabase SQL Editor 결과창용)
SELECT count(*) as fixed_users FROM profiles WHERE role IN ('free', 'premium') AND daily_request_limit > 0;
