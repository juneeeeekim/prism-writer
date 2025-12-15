-- =============================================================================
-- PRISM Writer - 신규 가입자 자동 프로필 생성 트리거
-- =============================================================================
-- 파일: 007_auto_create_profile_trigger.sql
-- 역할: 새 사용자 가입 시 자동으로 profiles 레코드 생성
-- 실행: Supabase SQL Editor에서 실행 (3번째로 실행)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. 트리거 함수 생성
-- -----------------------------------------------------------------------------
-- 새 사용자가 auth.users에 등록되면 자동으로 profiles 생성
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (
        id,
        role,
        is_approved,
        daily_request_limit,
        monthly_token_limit,
        created_at,
        updated_at
    )
    VALUES (
        NEW.id,
        'pending',    -- 기본값: 승인 대기
        false,        -- 승인 필요
        0,            -- 할당량 0 (승인 전)
        0,            -- 할당량 0 (승인 전)
        NOW(),
        NOW()
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- -----------------------------------------------------------------------------
-- 2. 기존 트리거 삭제 (있을 경우)
-- -----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- -----------------------------------------------------------------------------
-- 3. 트리거 연결
-- -----------------------------------------------------------------------------
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW 
    EXECUTE FUNCTION public.handle_new_user();

-- -----------------------------------------------------------------------------
-- 4. 트리거 확인
-- -----------------------------------------------------------------------------
SELECT 
    trigger_name,
    event_manipulation,
    event_object_table,
    action_statement
FROM information_schema.triggers
WHERE trigger_name = 'on_auth_user_created';
