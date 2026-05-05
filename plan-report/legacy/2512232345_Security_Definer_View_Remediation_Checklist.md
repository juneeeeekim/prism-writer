# 2512242035_Security_Definer_View_Remediation_Checklist

## 1. 파일 구성 및 근거

- **파일 구성**: 단일 파일 (`2512242035_Security_Definer_View_Remediation_Checklist.md`)
- **근거**:
  - 본 작업은 백엔드 SQL 마이그레이션 파일 2개(`019_telemetry_schema.sql`, `015_operations_tables.sql`)의 뷰 정의만 수정하는 작업입니다.
  - 프론트엔드 변경이나 복잡한 로직 변경이 없으므로, 단일 체크리스트로 관리하는 것이 유지보수 및 진행 상황 파악에 가장 효율적입니다.

---

## Phase 1: Telemetry Schema 보안 설정 업데이트

**목표**: `019_telemetry_schema.sql` 파일 내의 뷰들이 RLS 정책을 따르도록 수정합니다.

### 1.1 영향받을 수 있는 기존 기능

- **Telemetry Dashboard**: 관리자 대시보드에서 전체 통계를 볼 때 영향 없음 (관리자는 모든 권한 보유 가정).
- **User Stats**: 일반 사용자가 자신의 통계를 조회하는 기능 (RLS가 적용되어 본인 데이터만 보여야 함).

### 1.2 작업 항목

- [ ] **`telemetry_daily_stats` 뷰 수정**
  - **파일**: `backend/migrations/019_telemetry_schema.sql`
  - **위치**: `CREATE OR REPLACE VIEW telemetry_daily_stats` (약 90번째 줄)
  - **내용**: `CREATE OR REPLACE VIEW ...` 다음에 `WITH (security_invoker = true)` 옵션 추가.
  - **품질 체크**:
    - [ ] SQL 문법 정확성 확인 (`WITH` 절 위치).
    - [ ] 뷰 이름 및 컬럼 변경 없음 확인.
- [ ] **`telemetry_model_stats` 뷰 수정**
  - **파일**: `backend/migrations/019_telemetry_schema.sql`
  - **위치**: `CREATE OR REPLACE VIEW telemetry_model_stats` (약 105번째 줄)
  - **내용**: `CREATE OR REPLACE VIEW ...` 다음에 `WITH (security_invoker = true)` 옵션 추가.
  - **품질 체크**:
    - [ ] SQL 문법 정확성 확인.

### 1.3 Phase 1 검증

- [ ] **Syntax 오류 확인**: SQL 파일 내 문법 오류가 없는지 육안 검사 (IDE 린터 활용).
- [ ] **기존 기능 정상 동작 확인**: 수정된 SQL이 기존 테이블 구조를 해치지 않는지 확인 (뷰 정의만 변경).

---

## Phase 2: Operations Tables 보안 설정 업데이트

**목표**: `015_operations_tables.sql` 파일 내의 뷰들이 RLS 정책을 따르도록 수정합니다.

### 2.1 영향받을 수 있는 기존 기능

- **Usage Reports**: 사용량 리포트 조회 기능.
- **Feedback Analysis**: 피드백 통계 조회 기능.

### 2.2 작업 항목

- [ ] **`daily_usage_summary` 뷰 수정**
  - **파일**: `backend/migrations/015_operations_tables.sql`
  - **위치**: `CREATE OR REPLACE VIEW public.daily_usage_summary` (약 129번째 줄)
  - **내용**: `CREATE OR REPLACE VIEW ...` 다음에 `WITH (security_invoker = true)` 옵션 추가.
  - **품질 체크**:
    - [ ] SQL 문법 정확성 확인.
- [ ] **`feedback_summary` 뷰 수정**
  - **파일**: `backend/migrations/015_operations_tables.sql`
  - **위치**: `CREATE OR REPLACE VIEW public.feedback_summary` (약 144번째 줄)
  - **내용**: `CREATE OR REPLACE VIEW ...` 다음에 `WITH (security_invoker = true)` 옵션 추가.
  - **품질 체크**:
    - [ ] SQL 문법 정확성 확인.

### 2.3 Phase 2 검증

- [ ] **Syntax 오류 확인**: SQL 파일 내 문법 오류가 없는지 육안 검사.
- [ ] **기존 기능 정상 동작 확인**: 뷰 정의 변경 외 다른 영향 없음 확인.

---

## Phase 3: 최종 배포 및 통합 검증

**목표**: 변경 사항을 Supabase에 적용하고 실제 RLS 동작을 검증합니다.

### 3.1 배포 (User Action)

- [ ] **Migration 적용**: 변경된 SQL 파일 내용을 Supabase SQL Editor 등을 통해 실행하여 뷰를 갱신합니다.
  - _주의_: 기존 뷰를 `CREATE OR REPLACE` 하므로 데이터 손실은 없으나, 뷰 의존성이 있는 경우 주의 필요 (현재 단순 조회용 뷰라 문제 없음 예상).

### 3.2 통합 검증

- [ ] **RLS 동작 확인 (User Action)**
  - **시나리오**: 일반 사용자 계정으로 로그인.
  - **테스트**: `telemetry_daily_stats` 조회.
  - **기대 결과**: 본인의 `user_id`에 해당하는 데이터만 반환되거나, 데이터가 없으면 빈 결과 반환 (모든 사용자의 데이터가 보이면 실패).
- [ ] **관리자 기능 확인**
  - **시나리오**: 서비스 롤(Service Role) 또는 관리자 계정으로 조회.
  - **기대 결과**: 전체 데이터 조회 가능 (RLS 정책에 따라 다름, 보통 Service Role은 Bypass RLS).

### 3.3 완료 보고

- [ ] 모든 Phase 완료 후 보안 이슈 해결 보고.
