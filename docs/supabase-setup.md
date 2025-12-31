# Supabase 설정 가이드

> **문서 버전:** 1.1
> **최종 업데이트:** 2026-01-01
> **대상:** PRISM Writer 개발팀

---

## 1. Supabase 프로젝트 생성

### 1.1 프로젝트 생성 단계

1. [Supabase Dashboard](https://supabase.com/dashboard) 접속
2. **"New Project"** 클릭
3. 프로젝트 정보 입력:
   - **Name:** `prism-writer`
   - **Database Password:** 강력한 비밀번호 설정 (저장 필수!)
   - **Region:** `Northeast Asia (Seoul)` 권장
4. **"Create new project"** 클릭
5. 프로젝트 생성 완료까지 약 2분 대기

---

## 2. 연결 정보 확인

### 2.1 API 키 확인 경로

`Project Settings > API`

| 키 종류           | 용도                   | 환경변수                        |
| :---------------- | :--------------------- | :------------------------------ |
| **Project URL**   | API 엔드포인트         | `SUPABASE_URL`                  |
| **anon (public)** | 프론트엔드 클라이언트  | `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| **service_role**  | 백엔드 서버 (RLS 우회) | `SUPABASE_SERVICE_ROLE_KEY`     |

> ⚠️ **보안 주의:** `service_role` 키는 절대 클라이언트에 노출하지 마세요!

### 2.2 Database 연결 정보 (선택)

`Project Settings > Database`

- **Host:** `db.[project-ref].supabase.co`
- **Port:** `5432`
- **Database:** `postgres`
- **User:** `postgres`

---

## 3. pgvector 익스텐션 활성화

### 3.1 SQL Editor에서 실행

1. Supabase Dashboard > **SQL Editor** 이동
2. 아래 SQL 실행:

```sql
-- =============================================================================
-- PRISM Writer - pgvector Extension Activation
-- =============================================================================
-- 벡터 검색 기능을 위한 확장 프로그램 활성화
-- 이 명령은 프로젝트당 1회만 실행하면 됩니다.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS vector;

-- 확인
SELECT * FROM pg_extension WHERE extname = 'vector';
```

### 3.2 확인 결과

```
extname | extversion
--------|------------
vector  | 0.5.1
```

---

## 4. 스키마 마이그레이션 실행

### 4.1 마이그레이션 파일 실행 순서

마이그레이션 파일은 `supabase/migrations/` 디렉토리에 순서대로 위치합니다:

1. 테이블 생성 SQL
2. RLS 정책 SQL
3. 프로젝트 관련 SQL (Phase 5+)

### 4.2 실행 방법

1. SQL Editor에서 각 파일 내용을 순서대로 붙여넣고 실행
2. 또는 Supabase CLI 사용:
   ```bash
   supabase db push
   ```

---

## 5. 환경변수 설정

### 5.1 Frontend (.env.local)

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://[project-ref].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=[anon-key]

# LLM API Keys (서버 전용)
GOOGLE_API_KEY=[google-api-key]
OPENAI_API_KEY=[openai-api-key]
```

---

## 6. 연결 테스트

### 6.1 브라우저 콘솔 테스트

개발 서버 실행 후 브라우저 콘솔에서:

```javascript
// Supabase 연결 확인
const { data, error } = await supabase.from('projects').select('*').limit(1)
console.log('Connection:', data, error)
```

### 6.2 예상 결과

```
Connection: [] null  // 빈 배열 + 에러 없음 = 연결 성공
```

---

## 7. 트러블슈팅

| 문제                      | 원인          | 해결책                         |
| :------------------------ | :------------ | :----------------------------- |
| `relation does not exist` | 테이블 미생성 | 마이그레이션 SQL 실행          |
| `permission denied`       | RLS 정책 차단 | anon 키 대신 service_role 사용 |
| `invalid api key`         | 키 오타       | Dashboard에서 키 복사 재확인   |

---

**문서 끝. Supabase 설정 완료 후 Phase 1.2 체크리스트를 업데이트하세요.**

---

## 8. 보안 및 개발 표준 (Security Standards)

### 8.1 View 생성 규칙 (Security Definer vs Invoker)

Supabase(PostgreSQL)에서 View 생성 시, 기본적으로 View는 **생성자(Owner)의 권한**으로 실행됩니다. 이는 RLS(Row Level Security) 정책을 우회하여 데이터 누출 사고로 이어질 수 있습니다 (CVE-2025-55182 유형).

따라서, **모든 View 생성 시 반드시 `security_invoker = true` 옵션을 사용해야 합니다.**

**❌ 잘못된 예시 (Do Not Use):**

```sql
CREATE VIEW my_view AS SELECT * FROM sensitive_table;
-- 생성자의 권한으로 실행되어 RLS가 무시됨
```

**✅ 올바른 예시 (Standard):**

```sql
CREATE VIEW my_view WITH (security_invoker = true) AS SELECT * FROM sensitive_table;
-- 호출자(User)의 권한으로 실행되어 RLS가 정상 적용됨
```

### 8.2 RLS 정책 의존성 명시

View가 특정 RLS 정책에 의존하는 경우, SQL 파일 내에 주석으로 이를 명시하여 유지보수성을 확보하세요.

```sql
-- [Integrity] Enforced by my_view (security_invoker=true)
CREATE POLICY "Users can view own data" ...
```
