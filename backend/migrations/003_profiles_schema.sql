-- =============================================================================
-- PRISM Writer - 회원등급관리시스템 스키마 (v2.0 하이브리드 모델)
-- =============================================================================
-- 파일: backend/migrations/003_profiles_schema.sql
-- 역할: 사용자 프로필, 등급, LLM 사용량 추적 테이블 생성
-- 실행: Supabase SQL Editor에서 실행
-- 버전: v2.0 (일일 요청 + 월간 토큰 하이브리드)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. profiles 테이블 - 사용자 등급 및 할당량 관리
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- 등급 정보
    role TEXT DEFAULT 'pending' CHECK (role IN ('pending', 'free', 'premium', 'special', 'admin')),
    tier INTEGER DEFAULT 0,
    is_approved BOOLEAN DEFAULT FALSE,
    approved_at TIMESTAMPTZ,
    approved_by UUID REFERENCES auth.users(id),
    
    -- 구독 정보
    subscription_expires_at TIMESTAMPTZ,
    
    -- v2.0: 하이브리드 모델 할당량
    monthly_token_limit INTEGER DEFAULT 0,      -- 월간 토큰 한도
    daily_request_limit INTEGER DEFAULT 0,      -- 일일 요청 제한
    
    -- 타임스탬프
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- profiles 인덱스
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_is_approved ON profiles(is_approved);

-- -----------------------------------------------------------------------------
-- 2. role_history 테이블 - 등급 변경 이력 추적
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS role_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- 변경 정보
    previous_role TEXT,
    new_role TEXT,
    changed_by UUID REFERENCES auth.users(id),
    reason TEXT,
    
    -- 타임스탬프
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- role_history 인덱스
CREATE INDEX IF NOT EXISTS idx_role_history_user_id ON role_history(user_id);
CREATE INDEX IF NOT EXISTS idx_role_history_created_at ON role_history(created_at DESC);

-- -----------------------------------------------------------------------------
-- 3. llm_usage 테이블 - LLM API 사용 상세 기록
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS llm_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- 사용량 상세
    request_type TEXT NOT NULL,           -- 'chat', 'summarize', 'generate', 'edit'
    model_name TEXT NOT NULL,             -- 'gpt-4', 'gpt-3.5-turbo', 'gemini-pro'
    input_tokens INTEGER NOT NULL,        -- 입력 토큰 수
    output_tokens INTEGER NOT NULL,       -- 출력 토큰 수
    total_tokens INTEGER GENERATED ALWAYS AS (input_tokens + output_tokens) STORED,
    
    -- 비용 계산
    estimated_cost_usd DECIMAL(10, 6),
    
    -- 메타데이터
    request_id TEXT,
    response_time_ms INTEGER,
    is_cached BOOLEAN DEFAULT FALSE,
    
    -- 타임스탬프
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- llm_usage 인덱스
CREATE INDEX IF NOT EXISTS idx_llm_usage_user_id ON llm_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_llm_usage_created_at ON llm_usage(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_llm_usage_user_date ON llm_usage(user_id, created_at);

-- -----------------------------------------------------------------------------
-- 4. llm_daily_usage 테이블 - 일일 요청 횟수 빠른 조회용 (v2.0)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS llm_daily_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    usage_date DATE NOT NULL DEFAULT CURRENT_DATE,
    
    -- 일일 집계
    request_count INTEGER DEFAULT 0,
    
    -- 복합 유니크 제약 (UPSERT용)
    UNIQUE(user_id, usage_date)
);

-- llm_daily_usage 인덱스
CREATE INDEX IF NOT EXISTS idx_llm_daily_usage_lookup ON llm_daily_usage(user_id, usage_date);

-- -----------------------------------------------------------------------------
-- 5. llm_usage_summary 테이블 - 월간 집계 캐시
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS llm_usage_summary (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- 기간 정보
    period_type TEXT NOT NULL CHECK (period_type IN ('daily', 'monthly')),
    period_start DATE NOT NULL,
    
    -- 집계 데이터
    total_tokens INTEGER DEFAULT 0,
    total_requests INTEGER DEFAULT 0,
    total_cost_usd DECIMAL(10, 4) DEFAULT 0,
    
    -- 남은 할당량
    tokens_remaining INTEGER,
    requests_remaining INTEGER,
    
    -- 타임스탬프
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- 복합 유니크 제약
    UNIQUE(user_id, period_type, period_start)
);

-- llm_usage_summary 인덱스
CREATE INDEX IF NOT EXISTS idx_llm_usage_summary_lookup ON llm_usage_summary(user_id, period_type, period_start);

-- -----------------------------------------------------------------------------
-- 6. 트리거 함수: 신규 사용자 프로필 자동 생성
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO profiles (
        id, role,
        monthly_token_limit, daily_request_limit
    )
    VALUES (
        NEW.id, 'pending',
        0, 0  -- pending 상태에서는 사용 불가
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 트리거 생성
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION handle_new_user();

-- -----------------------------------------------------------------------------
-- 7. 트리거 함수: 역할 변경 시 할당량 자동 업데이트 (v2.0)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_role_limits()
RETURNS TRIGGER AS $$
BEGIN
    -- 역할이 변경되었을 때만 실행
    IF OLD.role IS DISTINCT FROM NEW.role THEN
        CASE NEW.role
            WHEN 'free' THEN
                NEW.monthly_token_limit := 10000;
                NEW.daily_request_limit := 5;     -- 디렉터 지정
            WHEN 'premium' THEN
                NEW.monthly_token_limit := 30000;
                NEW.daily_request_limit := 50;    -- 디렉터 지정
            WHEN 'special' THEN
                NEW.monthly_token_limit := 200000;
                NEW.daily_request_limit := 999999;  -- 무제한
            WHEN 'admin' THEN
                NEW.monthly_token_limit := 999999999;
                NEW.daily_request_limit := 999999;  -- 무제한
            ELSE
                NEW.monthly_token_limit := 0;
                NEW.daily_request_limit := 0;
        END CASE;
        
        -- 역할 변경 이력 기록
        INSERT INTO role_history (user_id, previous_role, new_role)
        VALUES (NEW.id, OLD.role, NEW.role);
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 트리거 생성
DROP TRIGGER IF EXISTS on_role_change ON profiles;
CREATE TRIGGER on_role_change
    BEFORE UPDATE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_role_limits();

-- -----------------------------------------------------------------------------
-- 8. RPC 함수: 일일 사용량 증가 (UPSERT)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION increment_daily_usage(
    p_user_id UUID,
    p_date DATE DEFAULT CURRENT_DATE
)
RETURNS VOID AS $$
BEGIN
    INSERT INTO llm_daily_usage (user_id, usage_date, request_count)
    VALUES (p_user_id, p_date, 1)
    ON CONFLICT (user_id, usage_date)
    DO UPDATE SET request_count = llm_daily_usage.request_count + 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- -----------------------------------------------------------------------------
-- 9. RPC 함수: 월간 사용량 업데이트
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_monthly_summary(
    p_user_id UUID,
    p_tokens INTEGER,
    p_cost DECIMAL DEFAULT 0
)
RETURNS VOID AS $$
DECLARE
    v_month_start DATE;
BEGIN
    v_month_start := DATE_TRUNC('month', CURRENT_DATE)::DATE;
    
    INSERT INTO llm_usage_summary (user_id, period_type, period_start, total_tokens, total_requests, total_cost_usd)
    VALUES (p_user_id, 'monthly', v_month_start, p_tokens, 1, p_cost)
    ON CONFLICT (user_id, period_type, period_start)
    DO UPDATE SET 
        total_tokens = llm_usage_summary.total_tokens + p_tokens,
        total_requests = llm_usage_summary.total_requests + 1,
        total_cost_usd = llm_usage_summary.total_cost_usd + p_cost,
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- -----------------------------------------------------------------------------
-- 10. updated_at 자동 갱신 함수 정의
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- -----------------------------------------------------------------------------
-- 11. updated_at 자동 갱신 트리거 적용
-- -----------------------------------------------------------------------------
-- profiles 테이블
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- llm_usage_summary 테이블
CREATE TRIGGER update_llm_usage_summary_updated_at
    BEFORE UPDATE ON llm_usage_summary
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- 마이그레이션 완료
-- =============================================================================
-- 확인 쿼리:
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name LIKE '%profile%' OR table_name LIKE '%llm%';
