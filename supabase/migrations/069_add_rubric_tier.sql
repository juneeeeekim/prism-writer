-- =============================================================================
-- [P4-03] rag_rule_candidates 테이블에 tier 컬럼 추가
-- 실행 위치: Supabase SQL Editor
-- 작성일: 2026-01-03
-- =============================================================================

-- Step 1: tier 컬럼 추가 (NULL 허용 - 마이그레이션 기간 동안)
ALTER TABLE rag_rule_candidates
ADD COLUMN IF NOT EXISTS tier TEXT;

-- Step 2: CHECK 제약조건 추가 (유효값 제한)
-- 기존 제약조건이 있을 수 있으므로 DROP 후 ADD 권장
ALTER TABLE rag_rule_candidates
DROP CONSTRAINT IF EXISTS rag_rule_candidates_tier_check;

ALTER TABLE rag_rule_candidates
ADD CONSTRAINT rag_rule_candidates_tier_check
CHECK (tier IS NULL OR tier IN ('core', 'style', 'detail'));

-- Step 3: 인덱스 추가 (티어별 필터링 성능 향상)
CREATE INDEX IF NOT EXISTS idx_rag_rule_candidates_tier
ON rag_rule_candidates(tier)
WHERE tier IS NOT NULL;

-- Step 4: 컬럼 설명 추가
COMMENT ON COLUMN rag_rule_candidates.tier IS
'루브릭 티어: core(핵심 5개), style(스타일 4개), detail(세부 3개). NULL=미분류';

-- Step 5: (Optional) 기존 데이터 자동 분류
-- 필요한 경우 주석 해제하여 실행
/*
UPDATE rag_rule_candidates
SET tier = CASE
  WHEN pattern_type IN ('hook', 'problem', 'cause', 'solution', 'evidence') THEN 'core'
  WHEN pattern_type IN ('metaphor', 'contrast', 'question', 'repetition', 'story', 'analogy') THEN 'style'
  ELSE 'detail'
END
WHERE tier IS NULL;
*/
