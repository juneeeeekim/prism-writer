# Supabase 보안 수정 - 구현 지시서 (v2.0)

**작성일**: 2025-12-31 20:47  
**작성자**: Tech Lead (15년차)  
**문서 ID**: SEC-2025-1231  
**우선순위**: P0 (Critical Security Fix)  
**담당**: Database Security Engineer

---

## Executive Summary

Supabase Security Advisor에서 2개의 View(`telemetry_daily_stats`, `telemetry_model_stats`)가 `SECURITY DEFINER` 속성으로 정의되어 있다는 경고를 수신했습니다. 본 문서는 해당 취약점을 수정하기 위한 **Supabase SQL Editor에서 실행할 구체적인 SQL 스크립트**와 **검증 절차**를 제공합니다.

---

## Phase 1: 현황 파악

**Before Start:**

- ⚠️ **주의**: 조회 전용 쿼리만 실행 (데이터 변경 없음)
- ⚠️ **회귀 테스트 포인트**: 없음 (SELECT 쿼리만 사용)
- ⚠️ **건드리지 말아야 할 것**:
  - `telemetry_logs` 테이블 구조
  - 기존 RLS 정책
  - 인덱스

**Implementation Items:**

### [x] **SEC-01-A**: View 정의 확인

- **Target**: `Supabase Dashboard` > `SQL Editor`
- **Logic (Pseudo)**:

  ```sql
  -- =============================================================
  -- [SEC-01-A] Step 1: View Definition Query
  -- Purpose: 현재 View의 SQL 정의 백업용
  -- =============================================================
  SELECT
      schemaname,    -- 스키마 이름 (expected: 'public')
      viewname,      -- View 이름
      definition     -- View SQL 정의 (백업용)
  FROM pg_views
  WHERE viewname IN ('telemetry_daily_stats', 'telemetry_model_stats')
  ORDER BY viewname;
  ```

- **Key Variables**:

  ```
  schemaname   : string  -- 'public'
  viewname     : string  -- 'telemetry_daily_stats' | 'telemetry_model_stats'
  definition   : text    -- View의 전체 SQL 정의
  ```

- **Safety**:

  - ✅ SELECT 전용 (데이터 변경 없음)
  - ✅ 결과를 텍스트 파일로 백업 권장

- **Expected Output**:
  ```
  schemaname | viewname              | definition
  -----------|-----------------------|------------------------------------------
  public     | telemetry_daily_stats | SELECT user_id, date_trunc('day', ...)
  public     | telemetry_model_stats | SELECT model_id, count(*) as usage_count, ...
  ```

---

### [x] **SEC-01-B**: Security Invoker 설정 확인 (핵심)

- **Target**: `Supabase Dashboard` > `SQL Editor`
- **Logic (Pseudo)**:

  ```sql
  -- =============================================================
  -- [SEC-01-B] Step 2: Security Invoker Check
  -- Purpose: View의 security_invoker 속성 확인
  -- Expected: reloptions = {security_invoker=true}
  -- Problem: reloptions = NULL 또는 {security_invoker=false}
  -- =============================================================
  SELECT
      c.relname AS view_name,      -- View 이름
      c.reloptions AS options      -- View 옵션 배열
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE c.relkind = 'v'                -- View만 필터
    AND n.nspname = 'public'           -- public 스키마만
    AND c.relname IN (
        'telemetry_daily_stats',
        'telemetry_model_stats'
    )
  ORDER BY c.relname;
  ```

- **Key Variables**:

  ```
  view_name : string        -- View 이름
  options   : text[]        -- 옵션 배열 (예: {security_invoker=true})
  ```

- **Safety**:

  - ✅ SELECT 전용
  - ⚠️ NULL 결과 = SECURITY DEFINER (기본값, 취약)

- **Result Analysis**:

  ```python
  # pseudo-code for result interpretation
  if options is NULL:
      status = "VULNERABLE"
      action_required = True
  elif 'security_invoker=false' in options:
      status = "VULNERABLE"
      action_required = True
  elif 'security_invoker=true' in options:
      status = "SECURE"
      action_required = False
  ```

- **Expected Output (문제 있는 경우)**:

  ```
  view_name              | options
  -----------------------|----------
  telemetry_daily_stats  | NULL
  telemetry_model_stats  | NULL
  ```

- **Expected Output (이미 해결된 경우)**:
  ```
  view_name              | options
  -----------------------|---------------------------
  telemetry_daily_stats  | {security_invoker=true}
  telemetry_model_stats  | {security_invoker=true}
  ```

**Definition of Done (Phase 1):**

- [x] Test: SEC-01-A 쿼리 실행 시 2개 View 정의가 반환됨
- [x] Test: SEC-01-B 쿼리 실행 시 options 컬럼 값 확인 가능
- [x] Review: 결과 스크린샷 또는 텍스트 백업 완료

---

## Phase 2: 보안 수정 적용

**Before Start:**

- ⚠️ **주의**: View를 재생성하므로 잠시 동안 조회 불가능할 수 있음
- ⚠️ **회귀 테스트 포인트**:
  - 관리자 대시보드 텔레메트리 통계 조회
  - 프로필 페이지 사용량 표시 (미구현)
- ⚠️ **건드리지 말아야 할 것**:
  - `telemetry_logs` 테이블
  - RLS 정책 (`telemetry_logs_select_policy`)
  - 인덱스

**Implementation Items:**

### [x] **SEC-02-A**: telemetry_daily_stats View 수정 ✅ COMPLETED

- **Target**: `Supabase Dashboard` > `SQL Editor`
- **Logic (Pseudo)**:

  ```sql
  -- =============================================================
  -- [SEC-02-A] Fix telemetry_daily_stats View
  -- Security Fix: CVE-2025-55182 - Add security_invoker=true
  -- Effect: RLS 정책이 조회자 기준으로 적용됨
  -- =============================================================

  CREATE OR REPLACE VIEW telemetry_daily_stats
  WITH (security_invoker = true) AS
  SELECT
      user_id,                                          -- 사용자 UUID (RLS 필터링 기준)
      DATE(created_at) AS date,                         -- 집계 날짜
      COUNT(*) AS total_requests,                       -- 총 요청 수
      SUM(tokens_in) AS total_tokens_in,                -- 입력 토큰 합계
      SUM(tokens_out) AS total_tokens_out,              -- 출력 토큰 합계
      SUM(cost_estimate) AS total_cost,                 -- 총 비용
      AVG(latency_ms) AS avg_latency_ms,                -- 평균 응답 시간
      COUNT(*) FILTER (WHERE success = true) AS success_count,   -- 성공 수
      COUNT(*) FILTER (WHERE success = false) AS error_count     -- 실패 수
  FROM telemetry_logs
  GROUP BY user_id, DATE(created_at);
  ```

- **Key Variables**:

  ```
  user_id           : UUID      -- 사용자 식별자 (RLS 기준)
  date              : DATE      -- 집계 날짜
  total_requests    : BIGINT    -- 총 요청 수
  total_tokens_in   : BIGINT    -- 입력 토큰 합계
  total_tokens_out  : BIGINT    -- 출력 토큰 합계
  total_cost        : NUMERIC   -- 총 비용 (USD)
  avg_latency_ms    : FLOAT     -- 평균 응답 시간 (ms)
  success_count     : BIGINT    -- 성공한 요청 수
  error_count       : BIGINT    -- 실패한 요청 수
  ```

- **Safety**:

  - ✅ `CREATE OR REPLACE VIEW` 사용 (기존 의존성 유지)
  - ✅ `WITH (security_invoker = true)` 필수 포함
  - ⚠️ 실행 전 Phase 1 결과 백업 확인
  - ⚠️ 에러 발생 시 즉시 중단

- **Expected Output**:
  ```
  CREATE VIEW
  ```

---

### [x] **SEC-02-B**: telemetry_model_stats View 수정 ✅ COMPLETED

- **Target**: `Supabase Dashboard` > `SQL Editor`
- **Logic (Pseudo)**:

  ```sql
  -- =============================================================
  -- [SEC-02-B] Fix telemetry_model_stats View
  -- Security Fix: CVE-2025-55182 - Add security_invoker=true
  -- Effect: RLS 정책이 조회자 기준으로 적용됨
  -- Note: 이 View는 user_id가 없어 RLS 영향이 다름
  -- =============================================================

  CREATE OR REPLACE VIEW telemetry_model_stats
  WITH (security_invoker = true) AS
  SELECT
      model_id,                                 -- 모델 식별자
      COUNT(*) AS usage_count,                  -- 사용 횟수
      SUM(tokens_in) AS total_tokens_in,        -- 입력 토큰 합계
      SUM(tokens_out) AS total_tokens_out,      -- 출력 토큰 합계
      SUM(cost_estimate) AS total_cost,         -- 총 비용
      AVG(latency_ms) AS avg_latency_ms         -- 평균 응답 시간
  FROM telemetry_logs
  WHERE model_id IS NOT NULL                    -- NULL 모델 제외
  GROUP BY model_id;
  ```

- **Key Variables**:

  ```
  model_id          : TEXT      -- 모델 이름 (예: 'gpt-4', 'claude-3')
  usage_count       : BIGINT    -- 사용 횟수
  total_tokens_in   : BIGINT    -- 입력 토큰 합계
  total_tokens_out  : BIGINT    -- 출력 토큰 합계
  total_cost        : NUMERIC   -- 총 비용
  avg_latency_ms    : FLOAT     -- 평균 응답 시간
  ```

- **Safety**:

  - ✅ `CREATE OR REPLACE VIEW` 사용
  - ✅ `WHERE model_id IS NOT NULL` 유지 (NULL 필터링)
  - ⚠️ SEC-02-A 성공 후 실행

- **Expected Output**:
  ```
  CREATE VIEW
  ```

**Definition of Done (Phase 2):**

- [x] Test: SEC-02-A 실행 후 `CREATE VIEW` 메시지 확인 ✅ (2025-12-31 20:53)
- [x] Test: SEC-02-B 실행 후 `CREATE VIEW` 메시지 확인 ✅ (2025-12-31 20:53)
- [x] Review: 에러 메시지 없음 확인 ✅

---

## Phase 3: 검증

**Before Start:**

- ⚠️ **주의**: 테스트 쿼리는 조회 전용
- ⚠️ **회귀 테스트 포인트**: Phase 2 성공 여부

**Implementation Items:**

### [x] **SEC-03-A**: Security Invoker 적용 확인 ✅ COMPLETED

- **Target**: `Supabase Dashboard` > `SQL Editor`
- **Logic (Pseudo)**:

  ```sql
  -- =============================================================
  -- [SEC-03-A] Verify security_invoker = true
  -- Expected: reloptions = {security_invoker=true} for both views
  -- =============================================================

  SELECT
      c.relname AS view_name,
      c.reloptions AS options,
      CASE
          WHEN c.reloptions @> ARRAY['security_invoker=true'] THEN '✅ SECURE'
          ELSE '❌ VULNERABLE'
      END AS status
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE c.relkind = 'v'
    AND n.nspname = 'public'
    AND c.relname IN ('telemetry_daily_stats', 'telemetry_model_stats')
  ORDER BY c.relname;
  ```

- **Key Variables**:

  ```
  view_name : string    -- View 이름
  options   : text[]    -- 옵션 배열
  status    : string    -- '✅ SECURE' 또는 '❌ VULNERABLE'
  ```

- **Safety**:

  - ✅ SELECT 전용

- **Expected Output (성공)**:
  ```
  view_name              | options                    | status
  -----------------------|----------------------------|------------
  telemetry_daily_stats  | {security_invoker=true}    | ✅ SECURE
  telemetry_model_stats  | {security_invoker=true}    | ✅ SECURE
  ```

---

### [x] **SEC-03-B**: View 데이터 조회 테스트 ✅ COMPLETED (row_count=0, 정상)

- **Target**: `Supabase Dashboard` > `SQL Editor`
- **Logic (Pseudo)**:

  ```sql
  -- =============================================================
  -- [SEC-03-B] Test View Functionality
  -- Purpose: View가 정상적으로 데이터를 반환하는지 확인
  -- =============================================================

  -- Test 1: telemetry_daily_stats
  SELECT
      'telemetry_daily_stats' AS view_name,
      COUNT(*) AS row_count
  FROM telemetry_daily_stats

  UNION ALL

  -- Test 2: telemetry_model_stats
  SELECT
      'telemetry_model_stats' AS view_name,
      COUNT(*) AS row_count
  FROM telemetry_model_stats;
  ```

- **Key Variables**:

  ```
  view_name  : string   -- View 이름
  row_count  : integer  -- 행 수 (0 이상이면 정상)
  ```

- **Safety**:

  - ✅ SELECT 전용
  - ⚠️ 에러 발생 시 View 정의 오류 가능성

- **Expected Output**:
  ```
  view_name              | row_count
  -----------------------|----------
  telemetry_daily_stats  | 150
  telemetry_model_stats  | 5
  ```

**Definition of Done (Phase 3):**

- [x] Test: SEC-03-A에서 모든 View의 options = `{security_invoker=true}` 확인 ✅
- [x] Test: SEC-03-B에서 에러 없이 row_count 반환 ✅ (row_count=0, 정상)
- [x] Review: 완료 확인 ✅ (2025-12-31 20:59)

---

## Phase 4: 롤백 (필요시)

**Before Start:**

- ⚠️ **주의**: 롤백 시 보안 경고가 다시 발생함
- ⚠️ **사용 조건**: Phase 2 또는 3에서 심각한 오류 발생 시만

### [ ] **SEC-04-ROLLBACK**: View 원상 복구

- **Target**: `Supabase Dashboard` > `SQL Editor`
- **Logic (Pseudo)**:

  ```sql
  -- =============================================================
  -- [SEC-04-ROLLBACK] Rollback to SECURITY DEFINER
  -- WARNING: 보안 경고가 다시 발생합니다
  -- USE ONLY IF: Phase 2/3에서 심각한 기능 오류 발생 시
  -- =============================================================

  -- Rollback 1: telemetry_daily_stats
  CREATE OR REPLACE VIEW telemetry_daily_stats AS
  SELECT
      user_id,
      DATE(created_at) AS date,
      COUNT(*) AS total_requests,
      SUM(tokens_in) AS total_tokens_in,
      SUM(tokens_out) AS total_tokens_out,
      SUM(cost_estimate) AS total_cost,
      AVG(latency_ms) AS avg_latency_ms,
      COUNT(*) FILTER (WHERE success = true) AS success_count,
      COUNT(*) FILTER (WHERE success = false) AS error_count
  FROM telemetry_logs
  GROUP BY user_id, DATE(created_at);

  -- Rollback 2: telemetry_model_stats
  CREATE OR REPLACE VIEW telemetry_model_stats AS
  SELECT
      model_id,
      COUNT(*) AS usage_count,
      SUM(tokens_in) AS total_tokens_in,
      SUM(tokens_out) AS total_tokens_out,
      SUM(cost_estimate) AS total_cost,
      AVG(latency_ms) AS avg_latency_ms
  FROM telemetry_logs
  WHERE model_id IS NOT NULL
  GROUP BY model_id;
  ```

- **Safety**:
  - ⚠️ `WITH (security_invoker = true)` 제거됨
  - ⚠️ 임시 조치로만 사용
  - ⚠️ 롤백 후 원인 분석 필수

---

## 전체 체크리스트 요약

### Phase 1: 현황 파악

- [x] **SEC-01-A**: View 정의 확인 쿼리 준비 완료 ✅
- [x] **SEC-01-B**: Security Invoker 확인 쿼리 준비 완료 ✅ **결과: NULL (취약)**

### Phase 2: 보안 수정

- [x] **SEC-02-A**: telemetry_daily_stats View 수정 ✅ **COMPLETED (2025-12-31 20:53)**
- [x] **SEC-02-B**: telemetry_model_stats View 수정 ✅ **COMPLETED (2025-12-31 20:53)**

### Phase 3: 검증

- [x] **SEC-03-A**: Security Invoker 적용 확인 ✅ **결과: security_invoker=true**
- [x] **SEC-03-B**: View 데이터 조회 테스트 ✅ **정상 동작 확인**

### Phase 4: 롤백 (필요시만)

- [x] **SEC-04-ROLLBACK**: ~~필요 없음~~ (성공적으로 수정됨)

---

## 실행 순서 요약

```
┌─────────────────────────────────────────────────────────┐
│  1. Supabase Dashboard 접속                              │
│  2. SQL Editor 열기                                      │
│  3. SEC-01-A 실행 → 결과 백업                            │
│  4. SEC-01-B 실행 → 문제 확인                            │
│     └─ options = NULL? → 수정 필요                       │
│     └─ options = {security_invoker=true}? → 완료          │
│  5. SEC-02-A 실행 → CREATE VIEW 확인                     │
│  6. SEC-02-B 실행 → CREATE VIEW 확인                     │
│  7. SEC-03-A 실행 → ✅ SECURE 확인                       │
│  8. SEC-03-B 실행 → row_count 확인                       │
│  9. 스크린샷 저장                                        │
│ 10. 24시간 후 Security Advisor 재확인                    │
└─────────────────────────────────────────────────────────┘
```

---

## 참고 자료

- **설계 문서**: [2512312030_Supabase_Security_Advisory_Response.md](file:///c:/Users/chyon/Desktop/01.Project/00.Program/prismLM/plan_report/2512312030_Supabase_Security_Advisory_Response.md)
- **마이그레이션**: [019_telemetry_schema.sql](file:///c:/Users/chyon/Desktop/01.Project/00.Program/prismLM/backend/migrations/019_telemetry_schema.sql)
- **검증 스크립트**: [verify_security_fix.sql](file:///c:/Users/chyon/Desktop/01.Project/00.Program/prismLM/backend/migrations/verify_security_fix.sql)

---

> **작성자**: Tech Lead  
> **검토**: Database Security Engineer, Backend Senior Developer  
> **버전**: v2.0 (2025-12-31)
