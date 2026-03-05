-- =============================================================================
-- Migration: 087_simplify_usage_limits.sql
-- =============================================================================
-- 작성일: 2026-03-06
-- 목적: 일일 요청 + 월간 토큰 하이브리드 모델 → 월간 질문 횟수 단일 지표로 단순화
-- 등급별 한도: pending=0, free=30, premium=300, special/admin=999999
-- =============================================================================

BEGIN;

-- =============================================================================
-- [SECTION 1] profiles 테이블에 monthly_question_limit 컬럼 추가
-- =============================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS monthly_question_limit INT DEFAULT 30;

-- 기존 역할별 값 설정
UPDATE public.profiles SET monthly_question_limit = 0 WHERE role = 'pending';
UPDATE public.profiles SET monthly_question_limit = 30 WHERE role = 'free';
UPDATE public.profiles SET monthly_question_limit = 300 WHERE role = 'premium';
UPDATE public.profiles SET monthly_question_limit = 999999 WHERE role IN ('special', 'admin');

-- =============================================================================
-- [SECTION 2] update_role_limits() 트리거 함수 수정
-- 역할 변경 시 monthly_question_limit 자동 설정
-- =============================================================================

CREATE OR REPLACE FUNCTION public.update_role_limits()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- 역할이 변경된 경우에만 한도 업데이트
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    CASE NEW.role
      WHEN 'pending' THEN
        NEW.daily_request_limit := 0;
        NEW.monthly_token_limit := 0;
        NEW.monthly_question_limit := 0;
      WHEN 'free' THEN
        NEW.daily_request_limit := 5;
        NEW.monthly_token_limit := 10000;
        NEW.monthly_question_limit := 30;
      WHEN 'premium' THEN
        NEW.daily_request_limit := 50;
        NEW.monthly_token_limit := 30000;
        NEW.monthly_question_limit := 300;
      WHEN 'special' THEN
        NEW.daily_request_limit := 999999;
        NEW.monthly_token_limit := 200000;
        NEW.monthly_question_limit := 999999;
      WHEN 'admin' THEN
        NEW.daily_request_limit := 999999;
        NEW.monthly_token_limit := 999999999;
        NEW.monthly_question_limit := 999999;
      ELSE
        NULL;
    END CASE;
  END IF;

  RETURN NEW;
END;
$$;

-- =============================================================================
-- [SECTION 3] 원자적 RPC: check_and_increment_monthly_questions
-- 단일 트랜잭션으로 한도 체크 + 카운트 증가 (race condition 방지)
-- llm_usage_summary의 total_requests를 월간 질문 카운터로 활용
-- =============================================================================

CREATE OR REPLACE FUNCTION public.check_and_increment_monthly_questions(
  p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_limit INT;
  v_current INT;
  v_period_start DATE;
BEGIN
  -- 현재 월 시작일
  v_period_start := date_trunc('month', CURRENT_DATE)::DATE;

  -- 사용자의 월간 질문 한도 조회
  SELECT monthly_question_limit INTO v_limit
  FROM profiles
  WHERE id = p_user_id;

  IF v_limit IS NULL THEN
    v_limit := 0;
  END IF;

  -- 현재 월 사용량 조회 (없으면 0)
  SELECT COALESCE(total_requests, 0) INTO v_current
  FROM llm_usage_summary
  WHERE user_id = p_user_id
    AND period_type = 'monthly'
    AND period_start = v_period_start;

  -- 한도 체크
  IF v_current >= v_limit THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'current_count', v_current,
      'limit', v_limit
    );
  END IF;

  -- 사용량 증가 (UPSERT)
  INSERT INTO llm_usage_summary (user_id, period_type, period_start, total_requests, total_tokens)
  VALUES (p_user_id, 'monthly', v_period_start, 1, 0)
  ON CONFLICT (user_id, period_type, period_start)
  DO UPDATE SET
    total_requests = llm_usage_summary.total_requests + 1,
    updated_at = NOW();

  RETURN jsonb_build_object(
    'allowed', true,
    'current_count', v_current + 1,
    'limit', v_limit
  );
END;
$$;

-- RPC 실행 권한 부여
GRANT EXECUTE ON FUNCTION public.check_and_increment_monthly_questions(UUID) TO authenticated;

COMMENT ON FUNCTION public.check_and_increment_monthly_questions IS '월간 질문 한도 체크 + 카운트 증가 (원자적 처리)';

COMMIT;
