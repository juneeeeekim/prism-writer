-- =============================================================================
-- PRISM Writer - 회원등급관리시스템 RLS 정책
-- =============================================================================
-- 파일: backend/migrations/004_profiles_rls.sql
-- 역할: profiles, role_history, llm_usage 테이블의 Row Level Security 정책
-- 실행: Supabase SQL Editor에서 003_profiles_schema.sql 실행 후 실행
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. profiles 테이블 RLS
-- -----------------------------------------------------------------------------
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- 본인 프로필 조회
CREATE POLICY "Users can view own profile"
    ON profiles FOR SELECT
    USING (auth.uid() = id);

-- 본인 프로필 수정 (역할 제외 - 관리자만 가능)
CREATE POLICY "Users can update own profile (except role)"
    ON profiles FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (
        auth.uid() = id
        -- role 변경은 별도 관리자 정책으로 처리
    );

-- 관리자 전체 조회
CREATE POLICY "Admins can view all profiles"
    ON profiles FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- 관리자 전체 수정 (역할 변경 포함)
CREATE POLICY "Admins can update all profiles"
    ON profiles FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- 관리자 삭제 권한
CREATE POLICY "Admins can delete profiles"
    ON profiles FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- -----------------------------------------------------------------------------
-- 2. role_history 테이블 RLS (관리자 전용)
-- -----------------------------------------------------------------------------
ALTER TABLE role_history ENABLE ROW LEVEL SECURITY;

-- 관리자만 조회 가능
CREATE POLICY "Admins can view role_history"
    ON role_history FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- 시스템(트리거)에서 INSERT - SECURITY DEFINER로 처리됨
-- 수동 INSERT는 관리자만
CREATE POLICY "Admins can insert role_history"
    ON role_history FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- -----------------------------------------------------------------------------
-- 3. llm_usage 테이블 RLS
-- -----------------------------------------------------------------------------
ALTER TABLE llm_usage ENABLE ROW LEVEL SECURITY;

-- 본인 사용량만 조회 가능
CREATE POLICY "Users can view own llm_usage"
    ON llm_usage FOR SELECT
    USING (auth.uid() = user_id);

-- 시스템에서만 INSERT (SECURITY DEFINER RPC 함수 사용)
-- 사용자 직접 INSERT 불가

-- 관리자 전체 조회
CREATE POLICY "Admins can view all llm_usage"
    ON llm_usage FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- -----------------------------------------------------------------------------
-- 4. llm_daily_usage 테이블 RLS
-- -----------------------------------------------------------------------------
ALTER TABLE llm_daily_usage ENABLE ROW LEVEL SECURITY;

-- 본인 일일 사용량만 조회 가능
CREATE POLICY "Users can view own llm_daily_usage"
    ON llm_daily_usage FOR SELECT
    USING (auth.uid() = user_id);

-- 관리자 전체 조회
CREATE POLICY "Admins can view all llm_daily_usage"
    ON llm_daily_usage FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- -----------------------------------------------------------------------------
-- 5. llm_usage_summary 테이블 RLS
-- -----------------------------------------------------------------------------
ALTER TABLE llm_usage_summary ENABLE ROW LEVEL SECURITY;

-- 본인 사용량 요약만 조회 가능
CREATE POLICY "Users can view own llm_usage_summary"
    ON llm_usage_summary FOR SELECT
    USING (auth.uid() = user_id);

-- 관리자 전체 조회
CREATE POLICY "Admins can view all llm_usage_summary"
    ON llm_usage_summary FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- =============================================================================
-- RLS 정책 적용 완료
-- =============================================================================
-- 확인 쿼리:
-- SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
-- FROM pg_policies WHERE tablename LIKE '%profile%' OR tablename LIKE '%llm%';
