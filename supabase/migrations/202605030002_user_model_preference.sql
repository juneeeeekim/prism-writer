-- =============================================================================
-- PRISM Writer - User Model Preference (Phase 5)
-- =============================================================================
-- 작성: 2026-05-03
-- 설계 의도(왜 이 구조인가):
--   1) profiles 테이블에 컬럼만 추가하여 기존 RLS·관계는 변경하지 않는다.
--      ALTER TABLE ADD COLUMN IF NOT EXISTS는 idempotent하여 재실행 안전.
--   2) 허용 모델 ID 목록은 CHECK 제약으로 보호한다. 잘못된 값은 DB 단계에서
--      차단되어 신뢰도가 올라간다.
--   3) 추가 모델이 등장할 때 본 마이그레이션 파일을 이어 받는 새 마이그레이션을
--      생성하면 된다(기존 파일 수정 금지 — 멱등성/재현성 보장).
-- =============================================================================

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS preferred_model TEXT;

-- 기존 제약을 안전하게 갱신: 있으면 제거 후 다시 생성
ALTER TABLE profiles
  DROP CONSTRAINT IF EXISTS valid_preferred_model;

ALTER TABLE profiles
  ADD CONSTRAINT valid_preferred_model CHECK (
    preferred_model IS NULL
    OR preferred_model IN (
      'gemini-3-flash-preview',
      'gemini-3-pro-preview',
      'gemma-3-27b-it',
      'gpt-5-mini',
      'gpt-5.2-2025-12-11',
      'claude-sonnet-4-5-20250929'
    )
  );

COMMENT ON COLUMN profiles.preferred_model IS 'Premium 사용자 선호 모델 ID. 검증된 모델만 허용.';
