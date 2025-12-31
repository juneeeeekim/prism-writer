# Supabase 보안 수정 구현 체크리스트

**작성일**: 2025-12-31  
**담당**: Database Security Engineer, Backend Senior Developer  
**우선순위**: P0 (긴급)  
**예상 소요 시간**: 30분

---

## Phase 1: 사전 준비 및 현황 파악

**Before Start:**

- ⚠️ **주의**: 이 작업은 프로덕션 데이터베이스에 직접 영향을 미칩니다
- ⚠️ **회귀 테스트 포인트**:
  - 관리자 대시보드에서 텔레메트리 통계 조회 기능
  - 사용자 프로필 페이지의 사용량 표시 기능 (미구현 상태)
- ⚠️ **건드리지 말아야 할 것**:
  - `telemetry_logs` 테이블 구조
  - RLS 정책 (`telemetry_logs_select_policy`, `telemetry_logs_insert_policy`)
  - 인덱스 구조

**Implementation Items:**

### [ ] **SEC-01**: Supabase 프로덕션 DB 접속 및 현황 확인

- **Target**: Supabase Dashboard > SQL Editor
- **Logic (Pseudo)**:

  ```sql
  -- Step 1: 현재 View 정의 확인
  query = "SELECT schemaname, viewname, definition FROM pg_views WHERE viewname IN ('telemetry_daily_stats', 'telemetry_model_stats')"
  execute(query)

  -- Step 2: security_invoker 설정 확인
  query = "SELECT c.relname AS view_name, c.reloptions FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relkind = 'v' AND n.nspname = 'public' AND c.relname IN ('telemetry_daily_stats', 'telemetry_model_stats')"
  result = execute(query)

  -- Step 3: 결과 분석
  if result.reloptions is NULL or result.reloptions contains 'security_invoker=false':
      status = "SECURITY DEFINER (문제 확인)"
  else if result.reloptions contains 'security_invoker=true':
      status = "이미 해결됨 (추가 조치 불필요)"
  ```

- **Key Variables**:

  - `view_name`: View 이름 ('telemetry_daily_stats', 'telemetry_model_stats')
  - `reloptions`: View 옵션 배열 (예: `{security_invoker=true}`)
  - `definition`: View SQL 정의

- **Safety**:

  - ✅ 조회 전용 쿼리이므로 데이터 변경 없음
  - ✅ 결과를 스크린샷으로 저장하여 백업

- **Expected Output**:
  ```
  view_name              | reloptions
  -----------------------|------------------
  telemetry_daily_stats  | NULL (또는 {security_invoker=false})
  telemetry_model_stats  | NULL (또는 {security_invoker=false})
  ```

---

## Phase 2: 보안 수정 적용

**Before Start:**

- ⚠️ **백업**: 현재 View 정의를 텍스트 파일로 저장
- ⚠️ **타이밍**: 사용량이 적은 시간대 권장 (새벽 2-4시 또는 점심시간)
- ⚠️ **롤백 준비**: `rollback_security_fix.sql` 파일 준비

**Implementation Items:**

### [ ] **SEC-02**: telemetry_daily_stats View 수정

- **Target**: Supabase SQL Editor
- **Logic (Pseudo)**:

  ```sql
  -- Step 1: 기존 View 삭제 (선택적)
  -- DROP VIEW IF EXISTS telemetry_daily_stats;

  -- Step 2: security_invoker = true로 재생성
  CREATE OR REPLACE VIEW telemetry_daily_stats
  WITH (security_invoker = true) AS
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
  ```

- **Key Variables**:

  - `user_id`: 사용자 UUID (RLS 필터링 기준)
  - `date`: 집계 날짜 (DATE 타입)
  - `total_requests`: 총 요청 수 (INT)
  - `total_tokens_in`: 입력 토큰 합계 (INT)
  - `total_tokens_out`: 출력 토큰 합계 (INT)
  - `total_cost`: 총 비용 (DECIMAL)
  - `avg_latency_ms`: 평균 응답 시간 (FLOAT)
  - `success_count`: 성공 요청 수 (INT)
  - `error_count`: 실패 요청 수 (INT)

- **Safety**:

  - ✅ `CREATE OR REPLACE`를 사용하여 기존 View 의존성 유지
  - ✅ 트랜잭션 없이 실행 가능 (View는 DDL)
  - ⚠️ 실행 중 에러 발생 시 즉시 중단하고 롤백

- **Expected Output**:
  ```
  CREATE VIEW
  ```

### [ ] **SEC-03**: telemetry_model_stats View 수정

- **Target**: Supabase SQL Editor
- **Logic (Pseudo)**:

  ```sql
  CREATE OR REPLACE VIEW telemetry_model_stats
  WITH (security_invoker = true) AS
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

- **Key Variables**:

  - `model_id`: 모델 식별자 (TEXT, 예: 'gpt-4', 'claude-3')
  - `usage_count`: 사용 횟수 (INT)
  - `total_tokens_in`: 입력 토큰 합계 (INT)
  - `total_tokens_out`: 출력 토큰 합계 (INT)
  - `total_cost`: 총 비용 (DECIMAL)
  - `avg_latency_ms`: 평균 응답 시간 (FLOAT)

- **Safety**:

  - ✅ `WHERE model_id IS NOT NULL` 조건으로 NULL 값 필터링
  - ✅ `CREATE OR REPLACE` 사용
  - ⚠️ SEC-02와 동일한 안전 조치 적용

- **Expected Output**:
  ```
  CREATE VIEW
  ```

---

## Phase 3: 검증 및 테스트

**Before Start:**

- ⚠️ **테스트 계정 준비**:
  - 관리자 계정 (Service Role Key)
  - 일반 사용자 계정 A (UUID: 실제 사용자 ID)
  - 일반 사용자 계정 B (UUID: 다른 사용자 ID)

**Implementation Items:**

### [ ] **SEC-04**: security_invoker 설정 재확인

- **Target**: Supabase SQL Editor
- **Logic (Pseudo)**:

  ```sql
  -- Step 1: reloptions 확인
  query = "SELECT c.relname AS view_name, c.reloptions FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relkind = 'v' AND n.nspname = 'public' AND c.relname IN ('telemetry_daily_stats', 'telemetry_model_stats')"
  result = execute(query)

  -- Step 2: 검증
  for each row in result:
      if row.reloptions != '{security_invoker=true}':
          raise Error("security_invoker 설정 실패")

  return "검증 성공"
  ```

- **Key Variables**:

  - `view_name`: View 이름
  - `reloptions`: 옵션 배열

- **Safety**:

  - ✅ 조회 전용 쿼리
  - ✅ 예상 결과와 다르면 즉시 롤백

- **Expected Output**:
  ```
  view_name              | reloptions
  -----------------------|---------------------------
  telemetry_daily_stats  | {security_invoker=true}
  telemetry_model_stats  | {security_invoker=true}
  ```

### [ ] **SEC-05**: RLS 정책 동작 테스트

- **Target**: Supabase SQL Editor
- **Logic (Pseudo)**:

  ```sql
  -- Test Case 1: 관리자 (Service Role)
  -- 모든 사용자의 데이터 조회 가능
  SELECT 'Admin View' as test_case,
         COUNT(*) as total_rows,
         COUNT(DISTINCT user_id) as unique_users
  FROM telemetry_daily_stats;
  -- Expected: total_rows > 0, unique_users >= 1

  -- Test Case 2: 일반 사용자 A
  -- 자신의 데이터만 조회
  SET LOCAL ROLE authenticated;
  SET LOCAL request.jwt.claims.sub TO '<USER_A_UUID>';
  SELECT 'User A View' as test_case,
         COUNT(*) as my_rows,
         COUNT(DISTINCT user_id) as unique_users
  FROM telemetry_daily_stats;
  -- Expected: my_rows >= 0, unique_users = 1 (본인만)
  RESET ROLE;

  -- Test Case 3: 일반 사용자 B
  -- 자신의 데이터만 조회 (User A와 다른 결과)
  SET LOCAL ROLE authenticated;
  SET LOCAL request.jwt.claims.sub TO '<USER_B_UUID>';
  SELECT 'User B View' as test_case,
         COUNT(*) as my_rows,
         COUNT(DISTINCT user_id) as unique_users
  FROM telemetry_daily_stats;
  -- Expected: my_rows >= 0, unique_users = 1 (본인만)
  RESET ROLE;
  ```

- **Key Variables**:

  - `<USER_A_UUID>`: 실제 사용자 A의 UUID (예: '123e4567-e89b-12d3-a456-426614174000')
  - `<USER_B_UUID>`: 실제 사용자 B의 UUID
  - `test_case`: 테스트 케이스 이름
  - `total_rows`: 조회된 행 수
  - `unique_users`: 고유 사용자 수

- **Safety**:

  - ✅ `SET LOCAL`을 사용하여 세션 격리
  - ✅ 테스트 후 `RESET ROLE`로 권한 복구
  - ⚠️ 실제 사용자 UUID를 사용하여 테스트 (더미 데이터 필요 시 먼저 삽입)

- **Expected Output**:
  ```
  test_case   | total_rows | unique_users
  ------------|------------|-------------
  Admin View  | 100        | 5
  User A View | 20         | 1
  User B View | 15         | 1
  ```

### [ ] **SEC-06**: 애플리케이션 레벨 테스트

- **Target**: Frontend API 호출
- **Logic (Pseudo)**:

  ```typescript
  // Step 1: 로그인한 사용자로 텔레메트리 조회
  async function testTelemetryAccess() {
    try {
      // Supabase 클라이언트로 View 조회
      const { data, error } = await supabase
        .from("telemetry_daily_stats")
        .select("*")
        .limit(10);

      if (error) throw error;

      // Step 2: 결과 검증
      if (data.length === 0) {
        console.log("✅ 데이터 없음 (정상)");
      } else {
        // 모든 행의 user_id가 현재 사용자 ID와 일치하는지 확인
        const currentUserId = (await supabase.auth.getUser()).data.user?.id;
        const allOwnData = data.every((row) => row.user_id === currentUserId);

        if (allOwnData) {
          console.log("✅ RLS 정상 동작: 본인 데이터만 조회됨");
        } else {
          console.error("❌ RLS 오류: 타인 데이터 노출");
        }
      }
    } catch (err) {
      console.error("API 호출 실패:", err);
    }
  }

  testTelemetryAccess();
  ```

- **Key Variables**:

  - `supabase`: Supabase 클라이언트 인스턴스
  - `data`: 조회 결과 배열
  - `error`: 에러 객체
  - `currentUserId`: 현재 로그인한 사용자 UUID
  - `allOwnData`: 모든 데이터가 본인 것인지 여부 (boolean)

- **Safety**:

  - ✅ Try-Catch로 에러 처리
  - ✅ `limit(10)`으로 대량 조회 방지
  - ⚠️ 프로덕션 환경에서 테스트 시 주의

- **Expected Output**:
  ```
  ✅ RLS 정상 동작: 본인 데이터만 조회됨
  ```

---

## Phase 4: 모니터링 및 최종 확인

**Implementation Items:**

### [ ] **SEC-07**: Supabase Security Advisor 재확인

- **Target**: Supabase Dashboard > Security Advisor
- **Logic (Pseudo)**:

  ```
  // Step 1: 24시간 대기
  wait(24 hours)

  // Step 2: Security Advisor 접속
  navigate_to("https://supabase.com/dashboard/project/audrryyklmighhtdssoi/security")

  // Step 3: 경고 상태 확인
  if warnings.count == 0:
      status = "✅ 모든 경고 해결됨"
  else if warnings contains "telemetry_daily_stats" or "telemetry_model_stats":
      status = "❌ 여전히 경고 존재 - 재확인 필요"
  else:
      status = "⚠️ 다른 경고 존재 - 별도 대응 필요"
  ```

- **Key Variables**:

  - `warnings`: 경고 목록 배열
  - `warnings.count`: 경고 개수 (INT)
  - `status`: 최종 상태 문자열

- **Safety**:

  - ✅ 수동 확인 작업 (자동화 불필요)
  - ✅ 스크린샷 저장

- **Expected Output**:
  ```
  Security Advisor: 0 warnings
  Status: All clear ✅
  ```

### [ ] **SEC-08**: 텔레메트리 로그 정상 기록 확인

- **Target**: Supabase SQL Editor
- **Logic (Pseudo)**:

  ```sql
  -- Step 1: 최근 1시간 로그 확인
  SELECT
      COUNT(*) as total_logs,
      COUNT(DISTINCT user_id) as unique_users,
      COUNT(DISTINCT run_id) as unique_runs,
      MAX(created_at) as latest_log,
      MIN(created_at) as earliest_log
  FROM telemetry_logs
  WHERE created_at > NOW() - INTERVAL '1 hour';

  -- Step 2: 검증
  if total_logs == 0:
      status = "⚠️ 로그 기록 안됨 - 애플리케이션 확인 필요"
  else if latest_log < NOW() - INTERVAL '10 minutes':
      status = "⚠️ 최근 로그 없음 - 실시간 기록 확인 필요"
  else:
      status = "✅ 정상 기록 중"
  ```

- **Key Variables**:

  - `total_logs`: 총 로그 수 (INT)
  - `unique_users`: 고유 사용자 수 (INT)
  - `unique_runs`: 고유 실행 수 (INT)
  - `latest_log`: 최신 로그 시간 (TIMESTAMPTZ)
  - `earliest_log`: 가장 오래된 로그 시간 (TIMESTAMPTZ)

- **Safety**:

  - ✅ 조회 전용 쿼리
  - ✅ 1시간 범위로 제한하여 성능 보장

- **Expected Output**:
  ```
  total_logs | unique_users | unique_runs | latest_log           | earliest_log
  -----------|--------------|-------------|----------------------|---------------------
  150        | 12           | 45          | 2025-12-31 20:35:00  | 2025-12-31 19:35:00
  ```

---

## Definition of Done (검증 체크리스트)

### 기능 검증

- [ ] **SEC-01**: Supabase에서 현재 View 설정 확인 완료
- [ ] **SEC-02**: `telemetry_daily_stats` View에 `security_invoker = true` 적용 완료
- [ ] **SEC-03**: `telemetry_model_stats` View에 `security_invoker = true` 적용 완료
- [ ] **SEC-04**: `reloptions = {security_invoker=true}` 확인 완료

### 보안 검증

- [ ] **SEC-05**: RLS 정책 동작 테스트 통과
  - [ ] 관리자: 모든 사용자 데이터 조회 가능
  - [ ] 일반 사용자 A: 본인 데이터만 조회
  - [ ] 일반 사용자 B: 본인 데이터만 조회 (A와 다른 결과)
- [ ] **SEC-06**: 프론트엔드 API 호출 테스트 통과
  - [ ] 본인 데이터만 조회되는지 확인
  - [ ] 타인 데이터 노출 없음 확인

### 모니터링 검증

- [ ] **SEC-07**: Supabase Security Advisor 경고 해결 확인 (24시간 후)
- [ ] **SEC-08**: 텔레메트리 로그 정상 기록 확인

### 문서화

- [ ] 작업 내용을 `2512312030_Supabase_Security_Advisory_Response.md`에 기록
- [ ] 실행한 SQL 쿼리를 백업 파일로 저장
- [ ] 테스트 결과 스크린샷 저장

### 코드 품질

- [ ] 불필요한 콘솔 로그 제거
- [ ] SQL 쿼리에 주석 추가 (목적, 예상 결과)
- [ ] 롤백 스크립트 준비 완료

---

## 롤백 계획

만약 문제가 발생하면 다음 순서로 롤백:

### [ ] **ROLLBACK-01**: View를 SECURITY DEFINER로 복구

- **Target**: Supabase SQL Editor
- **Logic (Pseudo)**:

  ```sql
  -- telemetry_daily_stats 롤백
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

  -- telemetry_model_stats 롤백
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
  - ⚠️ 롤백 시 보안 경고가 다시 발생함
  - ⚠️ 임시 조치로만 사용, 근본 원인 파악 후 재시도 필요

---

## 예상 소요 시간

| Phase    | 작업                       | 예상 시간                    |
| -------- | -------------------------- | ---------------------------- |
| 1        | 현황 파악 (SEC-01)         | 5분                          |
| 2        | View 수정 (SEC-02, SEC-03) | 5분                          |
| 3        | 검증 및 테스트 (SEC-04~06) | 15분                         |
| 4        | 모니터링 (SEC-07~08)       | 5분 (+ 24시간 대기)          |
| **총계** |                            | **30분** (+ 24시간 모니터링) |

---

## 참고 자료

- **원본 마이그레이션**: [019_telemetry_schema.sql](file:///c:/Users/chyon/Desktop/01.Project/00.Program/prismLM/backend/migrations/019_telemetry_schema.sql)
- **검증 스크립트**: [verify_security_fix.sql](file:///c:/Users/chyon/Desktop/01.Project/00.Program/prismLM/backend/migrations/verify_security_fix.sql)
- **롤백 스크립트**: [rollback_security_fix.sql](file:///c:/Users/chyon/Desktop/01.Project/00.Program/prismLM/backend/migrations/rollback_security_fix.sql)
- **설계 문서**: [2512312030_Supabase_Security_Advisory_Response.md](file:///c:/Users/chyon/Desktop/01.Project/00.Program/prismLM/plan_report/2512312030_Supabase_Security_Advisory_Response.md)

---

> **작성자**: Tech Lead  
> **검토자**: Database Security Engineer, Backend Senior Developer  
> **승인 필요**: DevOps Engineer (프로덕션 배포 시)
