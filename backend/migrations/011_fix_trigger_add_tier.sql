-- =============================================================================
-- PRISM Writer - 트리거 수정 (tier 컬럼 추가)
-- =============================================================================
-- 파일: 011_fix_trigger_add_tier.sql
-- 역할: 신규 가입자 자동 프로필 생성 트리거에 tier 컬럼 추가
-- 실행: Supabase SQL Editor에서 실행
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. 트리거 함수 수정 (tier 추가)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (
        id,
        role,
        tier,              -- ✅ 추가됨
        is_approved,
        daily_request_limit,
        monthly_token_limit,
        created_at,
        updated_at
    )
    VALUES (
        NEW.id,
        'pending',         -- 기본값: 승인 대기
        0,                 -- ✅ tier = 0 (pending)
        false,             -- 승인 필요
        0,                 -- 할당량 0 (승인 전)
        0,                 -- 할당량 0 (승인 전)
        NOW(),
        NOW()
    );
    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    -- 오류 발생해도 사용자 생성은 진행 (로그만 남김)
    RAISE WARNING '프로필 자동 생성 실패: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- -----------------------------------------------------------------------------
-- 2. 트리거 재연결
-- -----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW 
    EXECUTE FUNCTION public.handle_new_user();

-- -----------------------------------------------------------------------------
-- 3. 트리거 확인
-- -----------------------------------------------------------------------------
SELECT 
    trigger_name,
    event_manipulation,
    event_object_table,
    action_statement
FROM information_schema.triggers
WHERE trigger_name = 'on_auth_user_created';

-- -----------------------------------------------------------------------------
-- 4. 기존 profiles에 tier NULL 수정
-- -----------------------------------------------------------------------------
UPDATE profiles SET tier = 0 WHERE tier IS NULL AND role = 'pending';
UPDATE profiles SET tier = 1 WHERE tier IS NULL AND role = 'free';
UPDATE profiles SET tier = 2 WHERE tier IS NULL AND role = 'premium';
UPDATE profiles SET tier = 3 WHERE tier IS NULL AND role = 'special';
UPDATE profiles SET tier = 4 WHERE tier IS NULL AND role = 'admin';

-- -----------------------------------------------------------------------------
-- 5. 최종 확인
-- -----------------------------------------------------------------------------
SELECT 
    p.id,
    u.email,
    p.role,
    p.tier,
    p.is_approved
FROM profiles p
LEFT JOIN auth.users u ON p.id = u.id;
