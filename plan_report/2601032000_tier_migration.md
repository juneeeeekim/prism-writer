# DB 마이그레이션: tier 컬럼 추가

**작성일**: 2026-01-03 20:00
**대상 테이블**: `rag_rule_candidates`
**작업자**: Tech Lead

---

## 1. 개요

루브릭 후보에 **티어(Tier)** 개념을 도입하여 중요도별 분류를 지원합니다.

| 티어 | 레이블 | 권장 개수 | 설명 |
|------|--------|----------|------|
| `core` | 🟢 Core | 5개 | 글의 본질적 성패를 가르는 핵심 기준 |
| `style` | 🔵 Style | 4개 | 글의 매력도와 가독성 |
| `detail` | ⚪ Detail | 3개 | 완성도를 높이는 미세 조정 |

**최적 조합**: Core(5) + Style(4) + Detail(3) = **12개**

---

## 2. 마이그레이션 SQL

### 2.1 tier 컬럼 추가 (실행 필수)

```sql
-- =============================================================================
-- [P4-03] rag_rule_candidates 테이블에 tier 컬럼 추가
-- 실행 위치: Supabase SQL Editor
-- 작성일: 2026-01-03
-- =============================================================================

-- Step 1: tier 컬럼 추가 (NULL 허용 - 마이그레이션 기간)
ALTER TABLE rag_rule_candidates
ADD COLUMN IF NOT EXISTS tier TEXT;

-- Step 2: CHECK 제약조건 추가 (유효값 제한)
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
```

### 2.2 확인 쿼리

```sql
-- 마이그레이션 결과 확인
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'rag_rule_candidates'
  AND column_name = 'tier';

-- 제약조건 확인
SELECT
  constraint_name,
  check_clause
FROM information_schema.check_constraints
WHERE constraint_name LIKE '%tier%';

-- 티어별 통계 확인
SELECT
  tier,
  COUNT(*) as count
FROM rag_rule_candidates
GROUP BY tier
ORDER BY tier NULLS LAST;
```

---

## 3. 롤백 SQL (필요 시)

```sql
-- =============================================================================
-- [ROLLBACK] tier 컬럼 제거 (문제 발생 시에만 실행)
-- =============================================================================

-- Step 1: 인덱스 제거
DROP INDEX IF EXISTS idx_rag_rule_candidates_tier;

-- Step 2: 제약조건 제거
ALTER TABLE rag_rule_candidates
DROP CONSTRAINT IF EXISTS rag_rule_candidates_tier_check;

-- Step 3: 컬럼 제거
ALTER TABLE rag_rule_candidates
DROP COLUMN IF EXISTS tier;
```

---

## 4. 데이터 마이그레이션 (선택)

기존 데이터에 tier를 자동 분류하려면 아래 쿼리를 사용합니다.

```sql
-- =============================================================================
-- [OPTIONAL] 기존 데이터 자동 분류 (pattern_type 기반)
-- 주의: 비즈니스 로직에 맞게 수정 필요
-- =============================================================================

-- pattern_type별 기본 티어 매핑 예시
UPDATE rag_rule_candidates
SET tier = CASE
  -- Core (핵심): 주제, 논리, 근거
  WHEN pattern_type IN ('hook', 'problem', 'cause', 'solution', 'evidence') THEN 'core'
  -- Style (스타일): 표현, 리듬
  WHEN pattern_type IN ('metaphor', 'contrast', 'question', 'repetition') THEN 'style'
  -- Detail (세부): CTA, 통계
  WHEN pattern_type IN ('cta', 'statistics', 'rebuttal') THEN 'detail'
  ELSE NULL  -- 미분류
END
WHERE tier IS NULL;

-- 결과 확인
SELECT
  tier,
  pattern_type,
  COUNT(*) as count
FROM rag_rule_candidates
GROUP BY tier, pattern_type
ORDER BY tier, pattern_type;
```

---

## 5. 체크리스트

### 마이그레이션 전
- [ ] 현재 테이블 백업 확인
- [ ] 개발 환경에서 먼저 테스트

### 마이그레이션 실행 ✅ 완료 (2026-01-03)
- [x] Step 1: tier 컬럼 추가 실행
- [x] Step 2: CHECK 제약조건 추가 실행
- [x] Step 3: 인덱스 추가 실행
- [x] Step 4: 컬럼 설명 추가 실행

### 마이그레이션 후 ✅ 완료 (2026-01-03)
- [x] 확인 쿼리로 결과 검증
- [ ] 애플리케이션 정상 동작 확인
- [x] 기존 데이터 자동 분류 실행 (P4-03-B)
  - Core: 25개, Style: 14개, Detail: 14개 (총 53개)

---

## 6. 관련 코드 변경

| 파일 | 변경 내용 | 상태 |
|------|----------|------|
| `lib/rag/rubrics.ts` | `RubricTier` 타입, `TIER_CONFIG` 상수 추가 | ✅ 완료 |
| `PatternAnalysisSection.tsx` | `RuleCandidate.tier` 옵셔널 필드 추가 | ✅ 완료 |
| `rag_rule_candidates` 테이블 | `tier` 컬럼 추가 | ✅ 완료 |
| `PatternAnalysisSection.tsx` | 티어별 필터 UI 추가 | ✅ 완료 |

---

## 7. 참고: Supabase SQL Editor 접속 방법

1. [Supabase Dashboard](https://supabase.com/dashboard) 접속
2. 프로젝트 선택
3. 좌측 메뉴 **SQL Editor** 클릭
4. 위 SQL 붙여넣기 후 **Run** 클릭

---

**끝.**
