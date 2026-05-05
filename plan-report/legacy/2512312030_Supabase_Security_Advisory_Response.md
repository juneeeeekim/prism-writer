# Supabase 보안 경고 대응 계획서

**작성일**: 2025-12-31  
**경고 ID**: CVE-2025-55182 관련  
**심각도**: Medium (즉시 조치 필요)  
**참여자**: Database Security Engineer, Backend Senior Developer, Tech Lead

---

## 📋 Executive Summary

Supabase Security Advisor로부터 2개의 View(`telemetry_daily_stats`, `telemetry_model_stats`)가 `SECURITY DEFINER` 속성으로 정의되어 있다는 경고를 받았습니다.

**결론**: 로컬 마이그레이션 파일에는 이미 올바르게 `security_invoker = true`로 설정되어 있으나, **Supabase 프로덕션 데이터베이스에 마이그레이션이 적용되지 않은 상태**입니다.

---

## 🔍 Database Security Engineer 분석

### 현재 상태 진단

#### ✅ 로컬 마이그레이션 파일 (정상)

**파일**: `backend/migrations/019_telemetry_schema.sql`

```sql
-- [Security Fix] CVE-2025-55182: Enforce RLS by adding security_invoker = true
CREATE OR REPLACE VIEW telemetry_daily_stats WITH (security_invoker = true) AS
SELECT
    user_id,
    DATE(created_at) AS date,
    COUNT(*) AS total_requests,
    ...
FROM telemetry_logs
GROUP BY user_id, DATE(created_at);

CREATE OR REPLACE VIEW telemetry_model_stats WITH (security_invoker = true) AS
SELECT
    model_id,
    COUNT(*) AS usage_count,
    ...
FROM telemetry_logs
WHERE model_id IS NOT NULL
GROUP BY model_id;
```

**주석 분석**:

- `[Security Fix] CVE-2025-55182`: 이미 보안 취약점을 인지하고 수정함
- `[Scope] Personal Data Only`: 사용자는 자신의 데이터만 조회
- `[Admin Access] Admins must use the Service Role`: 관리자는 Service Role 사용 필요

#### ❌ Supabase 프로덕션 (문제)

Supabase에서 경고를 보낸 것은 **해당 마이그레이션이 적용되지 않았기 때문**입니다.

**추정 원인**:

1. 마이그레이션 파일이 Supabase에 수동 실행되지 않음
2. 자동 마이그레이션 파이프라인이 없음
3. 이전 버전의 View가 여전히 프로덕션에 존재

---

## 💼 Backend Senior Developer 의견

### RLS 정책 검증

**테이블**: `telemetry_logs`

```sql
-- RLS 활성화 확인
ALTER TABLE telemetry_logs ENABLE ROW LEVEL SECURITY;

-- 정책 1: SELECT (사용자는 자신의 로그만 조회)
CREATE POLICY telemetry_logs_select_policy
    ON telemetry_logs
    FOR SELECT
    USING (auth.uid() = user_id);

-- 정책 2: INSERT (인증된 사용자만 삽입)
CREATE POLICY telemetry_logs_insert_policy
    ON telemetry_logs
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);
```

**검증 결과**:

- ✅ RLS가 올바르게 설정됨
- ✅ `security_invoker = true`와 함께 사용하면 완벽한 보안

### View 사용처 확인

**검색 결과**:

```
backend/migrations/019_telemetry_schema.sql (정의)
backend/migrations/verify_security_fix.sql (테스트)
backend/migrations/rollback_security_fix.sql (롤백용)
```

**프론트엔드 사용**: 검색 결과 없음 (아직 UI에서 사용하지 않음)

**결론**: View 변경 시 **프론트엔드 영향 없음**, 안전하게 적용 가능

---

## 🎯 Tech Lead 권장 조치 사항

### Phase 1: 즉시 조치 (긴급)

#### 1-1. Supabase SQL Editor에서 현재 상태 확인

```sql
-- View 정의 확인
SELECT
    schemaname,
    viewname,
    definition
FROM pg_views
WHERE viewname IN ('telemetry_daily_stats', 'telemetry_model_stats');

-- security_invoker 설정 확인
SELECT
    c.relname AS view_name,
    c.reloptions
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relkind = 'v'
  AND n.nspname = 'public'
  AND c.relname IN ('telemetry_daily_stats', 'telemetry_model_stats');
```

**예상 결과**:

- `reloptions`가 `NULL` 또는 `{security_invoker=false}` → **문제 확인**
- `reloptions`가 `{security_invoker=true}` → **이미 해결됨**

#### 1-2. 마이그레이션 적용

**방법 A: Supabase Dashboard에서 수동 실행** (권장)

1. Supabase Dashboard → SQL Editor 접속
2. `019_telemetry_schema.sql` 파일 내용 복사
3. 96-108줄 (telemetry_daily_stats) 실행
4. 114-124줄 (telemetry_model_stats) 실행

**방법 B: Supabase CLI 사용**

```bash
# Supabase CLI 설치 확인
supabase --version

# 프로젝트 링크
supabase link --project-ref audrryyklmighhtdssoi

# 마이그레이션 적용
supabase db push
```

### Phase 2: 검증 (적용 후 즉시)

#### 2-1. 보안 설정 재확인

```sql
-- security_invoker 확인
SELECT
    c.relname AS view_name,
    c.reloptions
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relkind = 'v'
  AND n.nspname = 'public'
  AND c.relname IN ('telemetry_daily_stats', 'telemetry_model_stats');

-- 예상 결과: {security_invoker=true}
```

#### 2-2. RLS 동작 테스트

**테스트 스크립트**: `backend/migrations/verify_security_fix.sql` 사용

```sql
-- 관리자로 전체 데이터 조회 (Service Role)
SELECT 'Admin View' as test_case, COUNT(*) as total_rows
FROM telemetry_daily_stats;

-- 일반 사용자 A로 조회 (자신의 데이터만 보임)
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims.sub TO 'user-a-uuid';
SELECT 'User A View' as test_case, * FROM telemetry_daily_stats;

-- 일반 사용자 B로 조회 (자신의 데이터만 보임)
SET LOCAL request.jwt.claims.sub TO 'user-b-uuid';
SELECT 'User B View' as test_case, * FROM telemetry_daily_stats;
```

**예상 결과**:

- Admin: 모든 사용자의 데이터 조회
- User A: User A의 데이터만 조회
- User B: User B의 데이터만 조회

### Phase 3: 모니터링 (적용 후 24시간)

#### 3-1. Supabase Security Advisor 재확인

- 24시간 후 Supabase에서 경고가 사라졌는지 확인
- Security Advisor 대시보드에서 "Resolved" 상태 확인

#### 3-2. 애플리케이션 로그 모니터링

```sql
-- 텔레메트리 로그가 정상적으로 기록되는지 확인
SELECT
    COUNT(*) as total_logs,
    COUNT(DISTINCT user_id) as unique_users,
    MAX(created_at) as latest_log
FROM telemetry_logs
WHERE created_at > NOW() - INTERVAL '1 hour';
```

---

## 🚨 위험도 평가

### 현재 위험 수준: **Medium**

| 항목             | 평가   | 설명                                                  |
| ---------------- | ------ | ----------------------------------------------------- |
| 데이터 노출 위험 | Medium | 사용자가 다른 사용자의 텔레메트리 데이터를 볼 수 있음 |
| 개인정보 침해    | Low    | 텔레메트리 데이터는 민감한 개인정보 미포함            |
| 비즈니스 영향    | Low    | 사용량 통계만 노출, 실제 콘텐츠는 노출 안됨           |
| 악용 가능성      | Medium | 다른 사용자의 API 사용 패턴 파악 가능                 |

### 조치 후 위험 수준: **None**

`security_invoker = true` 적용 시 RLS 정책이 완벽하게 작동하여 위험 제거

---

## 📝 체크리스트

### 즉시 조치 (담당: Database Security Engineer)

- [ ] Supabase SQL Editor에서 현재 View 설정 확인
- [ ] `019_telemetry_schema.sql` 96-108줄 실행 (telemetry_daily_stats)
- [ ] `019_telemetry_schema.sql` 114-124줄 실행 (telemetry_model_stats)
- [ ] `security_invoker = true` 적용 확인

### 검증 (담당: Backend Senior Developer)

- [ ] `verify_security_fix.sql` 테스트 스크립트 실행
- [ ] 관리자/일반 사용자 권한 분리 확인
- [ ] RLS 정책 정상 동작 확인

### 모니터링 (담당: Tech Lead)

- [ ] 24시간 후 Supabase Security Advisor 재확인
- [ ] 애플리케이션 로그 정상 기록 확인
- [ ] 경고 해결 여부 최종 확인

---

## 🔄 롤백 계획

만약 문제가 발생하면 `rollback_security_fix.sql` 사용:

```sql
-- SECURITY DEFINER로 되돌리기 (권장하지 않음)
CREATE OR REPLACE VIEW telemetry_daily_stats AS
SELECT ...
FROM telemetry_logs
GROUP BY user_id, DATE(created_at);
```

**주의**: 롤백 시 보안 경고가 다시 발생하므로 **임시 조치로만 사용**

---

## 📚 참고 자료

### PostgreSQL 공식 문서

- [CREATE VIEW - Security Invoker](https://www.postgresql.org/docs/current/sql-createview.html)
- [Row Level Security](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)

### Supabase 문서

- [Row Level Security](https://supabase.com/docs/guides/auth/row-level-security)
- [Database Views](https://supabase.com/docs/guides/database/views)

### 관련 마이그레이션 파일

- [019_telemetry_schema.sql](file:///c:/Users/chyon/Desktop/01.Project/00.Program/prismLM/backend/migrations/019_telemetry_schema.sql)
- [verify_security_fix.sql](file:///c:/Users/chyon/Desktop/01.Project/00.Program/prismLM/backend/migrations/verify_security_fix.sql)
- [rollback_security_fix.sql](file:///c:/Users/chyon/Desktop/01.Project/00.Program/prismLM/backend/migrations/rollback_security_fix.sql)

---

## 🎯 결론 및 권장사항

### 핵심 요약

1. **문제**: Supabase 프로덕션 DB에 `security_invoker = true` 마이그레이션이 적용되지 않음
2. **원인**: 수동 마이그레이션 프로세스 누락
3. **해결**: Supabase SQL Editor에서 마이그레이션 수동 실행
4. **예상 소요 시간**: 10분 (실행 + 검증)

### 장기 개선 사항

1. **자동 마이그레이션 파이프라인 구축**

   - Supabase CLI를 CI/CD에 통합
   - GitHub Actions에서 자동 마이그레이션 실행

2. **보안 감사 자동화**

   - 주간 보안 체크 스크립트 작성
   - `security_invoker` 설정 자동 검증

3. **문서화 강화**
   - 마이그레이션 적용 절차 문서화
   - 보안 체크리스트 작성

---

> **작성**: Tech Lead, Database Security Engineer, Backend Senior Developer  
> **검토 필요**: DevOps Engineer (CI/CD 파이프라인 구축 시)  
> **다음 단계**: Supabase SQL Editor에서 마이그레이션 즉시 실행
