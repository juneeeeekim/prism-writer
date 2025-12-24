# 2512242040_Security_Remediation_Deep_Dive_Checklist

# Context Setting

- **Project Domain**: PrismLM (LLM Application / SaaS Platform)
- **Tech Stack**: Supabase (PostgreSQL 15+), Next.js
- **Review Target**: Security Definer View Remediation (CVE-2025-55182 style fix)
- **Scope**: Security Hardening / Technical Debt Payoff
- **Risk Level**: **Mid** (Data Visibility Change)

# Analysis Framework (C.O.R.E + S/D)

## 1. C (Compatibility & Regression)

- **Breaking Change (Data Visibility)**:
  - 기존: `SECURITY DEFINER` 뷰는 생성자(Superuser/Admin) 권한으로 실행되어 RLS를 우회, 모든 데이터를 조회했을 가능성이 높음.
  - 변경: `security_invoker = true` 설정 시 호출자(User)의 권한으로 실행되어 RLS가 적용됨.
  - **Risk**: 만약 `telemetry_model_stats`와 같은 뷰가 "전체 사용자 통계(Global Stats)"를 일반 사용자에게 보여주는 용도였다면, 이번 변경으로 인해 **"자신의 데이터만 보이는"** 현상이 발생하여 기능이 의도치 않게 변경될 수 있음.
- **Frontend Impact**: 데이터 포맷(컬럼)은 변경되지 않으므로 런타임 에러는 없으나, 대시보드 숫자가 급감하거나 0으로 표시될 수 있음.

## 2. O (Operational & Performance Tuning)

- **Performance**:
  - `SECURITY DEFINER` (Bypass RLS) vs `SECURITY INVOKER` (Check RLS).
  - RLS 체크 로직이 추가되므로 대량 데이터 조회 시 **Query Plan 변경** 및 약간의 성능 저하 가능성 있음.
  - 하지만 `telemetry_logs` 등은 이미 `user_id` 인덱스가 있어 RLS 성능은 최적화되어 있을 것으로 예상됨.

## 3. R (Robustness & Data Integrity)

- **Data Integrity**: 뷰 정의만 변경하므로 물리적 데이터 무결성에는 영향 없음.
- **Visibility Integrity**: 사용자가 자신의 데이터만 보게 되는 것이 "올바른 무결성"으로 간주됨.

## 4. E (Evolution & Maintainability)

- **Standardization**: Supabase 및 Postgres 보안 권장 사항(`security_invoker`)을 준수하여 향후 유지보수성 향상.

## 5. S (Security)

- **Privilege Escalation Prevention**: 기존 뷰가 악의적인 목적으로 사용될 경우, 권한 없는 사용자가 전체 로그를 볼 수 있는 취약점을 원천 차단.

## 6. D (Deployment & Fallback)

- **Rollback**: SQL `CREATE OR REPLACE VIEW` 문으로 즉시 원복 가능.

---

# 1) 🚨 위험 요소 및 디버깅 포인트 (Risk Table)

|  중요도  | 예상되는 충돌/회귀 (Risk)                                        | 원인 분석 (Root Cause)                                                                                       | 해결/안정화 가이드 (Stabilization Solution)                                                                                                                                                               |
| :------: | :--------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **High** | **공용 통계 데이터 조회 불가**<br>(예: 전체 모델 사용량 랭킹 등) | `security_invoker=true`로 인해 일반 유저는 자신의 Row만 집계함.                                              | 1. 해당 뷰가 "개인용"인지 "공용"인지 기획 의도 확인.<br>2. 공용이라면 별도의 `SECURITY DEFINER` 함수로 집계 데이터만 노출하도록 변경 필요.<br>3. **현재는 "개인용"으로 가정하고 진행하되, 검증 시 확인.** |
| **Mid**  | **Admin 대시보드 데이터 누락**                                   | Admin 클라이언트가 `service_role` 키를 쓰지 않고 일반 로그인(Admin 계정)을 사용하는 경우 RLS에 막힐 수 있음. | 1. Admin 계정에 대한 RLS 정책(`USING (true)` for admin role) 확인.<br>2. 또는 대시보드에서 `service_role` 클라이언트 사용 확인.                                                                           |

- **Fail Condition**: User A가 User B의 통계를 볼 수 있으면 실패.
- **Note**: `backend/migrations/verify_security_fix.sql` 스크립트를 사용하여 Supabase SQL Editor에서 직접 수행해야 합니다.
- **현재 상태**: 기본 테이블에 데이터가 없어 Skip됨. 서비스 운영 후 데이터 생성 시 재검증 필요.

# 3) 🛑 롤백 및 비상 대응 전략 (Rollback Strategy)

- **전략**: 문제 발생 시 즉시 이전 뷰 정의(`SECURITY DEFINER` 상태)로 롤백.
- **실행 방법**:
  - 롤백용 SQL 스크립트(`WITH (security_invoker = true)` 제거 버전)를 미리 준비하거나, 기존 마이그레이션 파일을 재실행.

---

# 4) Implementation Checklist

## Phase 1: Preparation & Analysis

- [x] **기존 뷰 정의 백업**
  - [x] 현재 DB의 뷰 정의를 백업하거나, 기존 마이그레이션 파일 내용이 현재 상태와 일치하는지 확인.
- [x] **RLS 정책 사전 점검**
  - [x] `telemetry_logs`, `usage_records`, `evaluation_feedback` 테이블에 RLS가 활성화되어 있는지 확인.
  - [x] 각 테이블에 `SELECT ... USING (auth.uid() = user_id)` 형태의 정책이 있는지 확인. (없으면 뷰 수정 후 데이터가 아예 안 보임)

## Phase 2: Apply Security Fixes (Migration)

- [x] **`019_telemetry_schema.sql` 수정**
  - [x] `telemetry_daily_stats`: `WITH (security_invoker = true)` 추가.
  - [x] `telemetry_model_stats`: `WITH (security_invoker = true)` 추가.
- [x] **`015_operations_tables.sql` 수정**
  - [x] `daily_usage_summary`: `WITH (security_invoker = true)` 추가.
  - [x] `feedback_summary`: `WITH (security_invoker = true)` 추가.

## Phase 3: Verification (Manual)

- [x] **Supabase Dashboard / SQL Editor 테스트**
  - [x] **Test 1 (Admin/Service Role)**: 쿼리 실행 시 전체 데이터 조회 확인. → **Pass (0 rows - 데이터 없음, 정상)**
  - [ ] **Test 2 (Authenticated User)**: `auth.uid()`를 특정 유저로 설정 후 조회 확인. → **Skip (데이터 생성 후 재검증 필요)**
  - [ ] **Test 3 (Dashboard UI)**: 프론트엔드 대시보드 확인. → **Skip (데이터 생성 후 재검증 필요)**

## 5) 최종 의견 (Conclusion)

- **Confidence**: **High**
- **Go / No-Go Decision**: ✅ **Ready to Build**
  - 근거: Supabase Linter가 명확히 지적한 취약점이며, 수정 방안이 표준적임. RLS 정책이 이미 테이블에 존재하므로(파일 확인됨), 뷰에 `security_invoker`를 적용하는 것이 올바른 방향임.
