-- =============================================================================
-- PRISM Writer - 누락된 프로필 데이터 자동 생성
-- =============================================================================
-- 파일: backend/migrations/021_insert_missing_profiles.sql
-- 목표: 계정은(auth.users) 있는데 프로필(public.profiles)이 없는 유저 복구
-- =============================================================================

-- auth.users에는 있지만 profiles에는 없는 유저를 찾아 기본값으로 생성
INSERT INTO public.profiles (
    id, 
    role, 
    is_approved, 
    tier, 
    monthly_token_limit, 
    daily_request_limit,
    created_at,
    updated_at
)
SELECT 
    id, 
    'pending', -- 기본 역할: 대기
    FALSE,     -- 미승인
    0,         -- Tier 0
    0,         -- 한도 0
    0,         -- 한도 0
    NOW(),
    NOW()
FROM auth.users
WHERE id NOT IN (SELECT id FROM public.profiles);

-- 확인용: 복구된 프로필 수 출력
-- (Supabase SQL Editor에서는 INSERT 0 10 과 같이 표시됨)

-- 복구 후 RLS 정책 재확인 (안전장치)
-- 020번이 실행 안되었을 경우를 대비해 다시 한 번 실행해도 무방
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
