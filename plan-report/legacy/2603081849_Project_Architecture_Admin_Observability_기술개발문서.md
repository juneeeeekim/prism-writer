# PRISM Writer - 프로젝트 구조 및 관리자 관측성 감사 기술 개발 문서

> **문서 ID:** 2603081849
> **작성일:** 2026-03-08
> **작성자:** Codex (기술 리더)
> **상태:** 검토 대기
> **분석 범위:** Frontend (Next.js App Router), Admin API, Analytics/Observability, Test Suite, Legacy Backend
> **검증 상태:** `npm.cmd run build` 성공, `npm.cmd run test` 실패, E2E 미실행

---

## 1. 개요

본 문서는 현재 PrismLM 프로젝트를 기술 리더 관점에서 재점검한 결과를 바탕으로 작성한 기술 개발 문서입니다.
목표는 세 가지입니다.

1. 코드베이스 전반에서 즉시 리팩토링이 필요한 영역을 식별한다.
2. 사용자 기능들이 프로젝트 단위로 유기적으로 연결되어 있는지 평가한다.
3. 관리자 입장에서 사용자 행동을 추적하고 운영 상태를 분석할 수 있는지 점검하고, 부족한 부분에 대한 개발 방향을 제시한다.

이번 점검은 단순 코드 스타일 리뷰가 아니라, 운영 안정성, 권한 제어, 데이터 관측성, 테스트 신뢰성, 확장성까지 포함한 구조 감사(Audit) 성격으로 수행하였다.

### 1.1 핵심 결론

현재 코드베이스는 사용자 핵심 흐름만 놓고 보면 생각보다 잘 연결되어 있다.
`ProjectProvider`를 중심으로 문서, 검색, 채팅, RAG 흐름이 `projectId` 단위로 묶여 있어 기본 골격은 안정적이다.

반면 운영자 관점에서는 두 가지 한계가 뚜렷하다.

1. 관리자 API와 관리자 UI 일부가 운영 수준의 안정성을 갖추지 못했다.
2. 운영 분석에 필요한 이벤트 수집과 대시보드 체계가 부족하여, 관리자가 실제 사용자 행동을 깊이 있게 파악하기 어렵다.

### 1.2 발견 이슈 요약

| 심각도 | 건수 | 비고 |
|--------|------|------|
| **HIGH** | 3건 | 관리자 RBAC 누락, RAFT 관리자 기능 단절, 환각 이벤트 누락 저장 |
| **MEDIUM** | 5건 | 테스트 스위트 실패, 관리자 분석 체계 부족, 상태/플래그 분산, 번들 과대, 레거시 구조 중복 |
| **LOW** | 2건 | 빌드 경고, 일부 Hook dependency/a11y 경고 |

### 1.3 검증 기준

이번 문서의 기술 판단은 다음 검증 결과를 포함한다.

- `frontend` 기준 `npm.cmd run build` 성공
- 빌드 경고 존재
- `/editor` 첫 로드 JS 435kB
- `npm.cmd run test` 실패
- 실패 내역: `gateway.test.ts` 2개 assertion 실패, `@/types/rag` import 해석 실패 2건
- E2E 및 운영 데이터 실측은 이번 범위에 포함하지 않음

---

## 2. 현재 구조 평가

### 2.1 유기적으로 연결이 잘 되어 있는 영역

핵심 사용자 흐름은 `projectId`를 기준으로 상당히 일관되게 연결되어 있다.

- `frontend/src/app/(main)/layout.tsx`
  - 메인 영역을 `ProjectProvider`로 감싼다.
- `frontend/src/contexts/ProjectContext.tsx`
  - 현재 프로젝트 선택, 프로젝트 목록 갱신, 활성 프로젝트 상태를 담당한다.
- `frontend/src/hooks/useDocuments.ts`
  - 문서 조회, 저장, 재정렬이 모두 `projectId`를 기준으로 동작한다.
- `frontend/src/app/(main)/editor/page.tsx`
  - 현재 프로젝트를 기준으로 문서, 평가, 어시스턴트 패널을 결합한다.
- `frontend/src/app/api/chat/route.ts`
  - 채팅 API가 `projectId`를 받아 RAG 검색 흐름에 전달한다.
- `frontend/src/app/api/rag/search/route.ts`
  - 검색 단계에서 `project_id_param`으로 프로젝트 범위를 반영한다.

즉, 다음 사용자 흐름은 기본적으로 하나의 축 위에 놓여 있다.

```text
ProjectProvider
  -> 문서 업로드/목록
  -> 검색/Research
  -> 채팅
  -> RAG 검색
  -> 평가/피드백
```

이 구조 덕분에 기능 간 맥락 공유는 비교적 자연스럽다.
사용자가 프로젝트를 바꾸면 문서, 검색, 대화 문맥이 함께 바뀌는 방향으로 설계되어 있어 "유기적 연결" 자체는 합격점이다.

### 2.2 구조가 분산되어 있는 영역

핵심 흐름이 연결되어 있는 것과 별개로, 운영/확장 관점에서는 상태 관리와 시스템 경계가 분산된 부분이 보인다.

#### 2.2.1 검색 히스토리 저장 방식 이원화

- `frontend/src/hooks/useSearchHistory.ts`
  - Smart Search 기록을 브라우저 `localStorage`에 저장
- `frontend/src/hooks/useResearchHistory.ts`
  - Research 기록을 서버 API와 DB에 저장

결과적으로 "사용자가 무엇을 검색했는가"라는 같은 범주의 데이터가 서로 다른 저장소에 존재한다.
이 구조에서는 관리자 입장에서 통합 분석이 어렵고, 사용자 입장에서도 기기 교체나 브라우저 초기화 시 일부 이력이 유실된다.

#### 2.2.2 Feature Flag 체계 이중화

- `frontend/src/config/featureFlags.ts`
- `frontend/src/lib/features.ts`

두 체계가 동시에 존재하여, 어떤 기능이 어떤 플래그에 의해 제어되는지 한 번에 파악하기 어렵다.
운영 중 기능 토글 정책이 커질수록 누락, 중복, 잘못된 가드가 발생할 가능성이 높다.

#### 2.2.3 레거시 Backend와 Next API 이중 구조

- `backend/`
- `frontend/src/app/api/`

현재 프로젝트는 실질적으로 Next.js API Route 중심으로 운영되지만, `backend/` 디렉토리도 여전히 남아 있다.
일부 파일은 더 이상 주 경로가 아니거나 스텁 성격이 강하다.
이중 구조는 신규 개발자 온보딩 비용과 운영 혼선을 키운다.

### 2.3 관리자 입장에서의 구조 평가

현재 관리자 기능은 "관리자 페이지가 존재한다" 수준에는 도달했지만, "운영자가 제품을 분석할 수 있다" 수준에는 못 미친다.

| 평가 항목 | 현재 수준 | 판단 |
|----------|-----------|------|
| 사용자 관리 | 기본 가능 | 승인, 역할, 한도 조정은 가능 |
| 피드백 검토 | 부분 가능 | 수동 피드백은 보이나 자동 감지는 누락 |
| 사용량 분석 | 부족 | 개인별/기능별/세션별 분석 미흡 |
| 기능 채택률 분석 | 부족 | 기능별 이벤트 수집 부재 |
| 검색 행동 분석 | 부족 | 로컬 저장과 서버 저장이 분산됨 |
| 실패율/이탈 분석 | 부족 | 에러, 타임아웃, 중단 지점 추적 체계 미흡 |

운영자가 실제로 알고 싶어하는 질문은 보통 다음과 같다.

- 어떤 사용자가 어떤 기능을 가장 많이 쓰는가
- 검색 후 채팅으로 이어지는 전환율은 얼마인가
- 자동 감지된 환각이 얼마나 발생하는가
- 어떤 모델, 어떤 프로젝트, 어떤 화면에서 실패율이 높은가
- 어떤 기능이 켜져 있으나 실제로는 거의 사용되지 않는가

현재 구조만으로는 위 질문에 체계적으로 답하기 어렵다.

---

## 3. 주요 발견 상세 분석

### 3.1 HIGH - `/api/admin/migrate` 관리자 RBAC 누락

#### 현황

- 대상 파일: `frontend/src/app/api/admin/migrate/route.ts`
- 관련 지점: GET 핸들러 시작부 59행, POST 핸들러 시작부 164행
- 비교 기준: `frontend/src/app/api/admin/users/route.ts`는 세션 및 `admin` 역할 검증이 존재
- 보조 근거: `frontend/src/middleware.ts`는 `/admin/:path*`는 보호하지만 `/api/admin/*` 전체를 보호하지 않음

#### 문제

`/api/admin/migrate`는 관리자 전용 API인데도 세션 확인과 관리자 역할 확인이 없다.
현재는 Supabase RLS나 내부 쿼리 조건에 우연히 기대는 상태로 보이며, API 레벨에서 차단되어야 할 요청이 라우트 초입에서 걸러지지 않는다.

#### 영향

- 비인가 사용자의 관리자성 작업 호출 가능성
- 운영 환경에서 마이그레이션/관리 동작이 직접 노출될 위험
- 향후 유사한 `/api/admin/*` 라우트 확장 시 보안 공백 반복

#### 개발 방향

1. `frontend/src/lib/api/requireAdmin.ts` 또는 동급 헬퍼를 신설한다.
2. 모든 `/api/admin/*` 라우트는 동일한 방식으로 세션 검증, 역할 검증, 표준 에러 응답을 사용하도록 통일한다.
3. `middleware.ts`는 UI 보호용으로 유지하되, API 보호는 라우트 내부 공통 헬퍼로 강제한다.

#### 완료 기준

- `/api/admin/migrate` 접근 시 비로그인/비관리자 요청이 401 또는 403으로 일관되게 차단된다.
- `/api/admin/*` 전수 점검 결과 RBAC 누락 라우트가 0건이다.

---

### 3.2 HIGH - 관리자 피드백 화면의 RAFT 기능이 실제 백엔드와 분리됨

#### 현황

- 대상 파일: `frontend/src/app/(main)/admin/feedback/page.tsx`
- 관련 지점: 316행 부근 `handleSaveToRAFT`
- 호출 대상: `/api/raft/dataset`
- 확인 결과: 해당 API 라우트 구현 파일이 저장소 내에 없음
- 관련 플래그: `frontend/src/config/featureFlags.ts` 121행 부근 `ENABLE_RAFT_FEATURES`

#### 문제

관리자 화면에는 RAFT 저장 액션이 존재하지만, 실제 요청을 처리할 서버 라우트가 없다.
또한 RAFT 기능은 플래그 기반으로 관리되도록 설계되어 있음에도, 관리자 피드백 UI는 플래그로 가드되지 않는다.

즉 현재 상태는 다음 중 어느 것도 완성되지 않은 중간 상태다.

1. 실제 동작하는 RAFT 저장 기능
2. 비활성 기능을 안전하게 숨기는 UI

#### 영향

- 관리자 버튼 클릭 시 404 또는 실패 응답
- 기능 신뢰도 저하
- 운영 도구에 대한 신뢰 상실
- 플래그 체계가 있어도 화면 가드 누락으로 실제 운영과 문서가 어긋남

#### 개발 방향

둘 중 하나를 명확히 선택해야 한다.

1. RAFT 기능을 계속 유지할 경우
   - `/api/raft/dataset` 라우트를 구현한다.
   - 관리자 UI에서 `ENABLE_RAFT_FEATURES` 기반 가드를 추가한다.
   - 성공/실패/중복 저장 응답 형식을 정의한다.
2. RAFT 기능을 보류할 경우
   - 관리자 피드백 화면의 저장 버튼을 제거한다.
   - 숨김 처리 대신 "비활성화됨" 상태를 명확히 표현한다.

#### 완료 기준

- 관리자 UI에서 보이는 기능은 모두 실제 API와 연결된다.
- 미구현 기능은 버튼이 아니라 비활성 안내 상태로 표기된다.

---

### 3.3 HIGH - 자동 감지 환각이 DB에 저장되지 않아 관리자 통계가 실제보다 낮음

#### 현황

- 관리자 대시보드 조회 파일: `frontend/src/app/(main)/admin/feedback/page.tsx`
- 관련 지점: 79행, 103행 부근
- 관리자 통계 소스: `hallucination_feedback` 테이블
- 자동 감지 처리 파일: `frontend/src/app/api/feedback/hallucination/route.ts`
- 관련 지점: 98행 부근 `autoDetected` 처리 분기

#### 문제

관리자 대시보드는 `hallucination_feedback` 테이블만 조회한다.
하지만 자동 감지된 환각 이벤트는 DB에 insert되지 않고 콘솔 로그만 남긴 뒤 성공 응답을 반환한다.

따라서 수동 피드백과 자동 감지 피드백이 한 데이터 모델에 통합되지 않는다.

#### 영향

- 관리자 대시보드의 환각 빈도 수치가 실제보다 작게 집계됨
- 어떤 모델/문서/질문 유형에서 자동 감지가 많이 발생하는지 분석 불가
- 향후 환각 완화 품질 개선 사이클이 데이터 없이 추정 위주로 흐를 가능성

#### 개발 방향

1. 자동 감지 이벤트도 `hallucination_feedback` 또는 별도 정규화된 이벤트 테이블에 저장한다.
2. `source` 필드로 `manual`, `auto_detected`, `reviewed` 등을 구분한다.
3. 관리자 화면에서는 수동/자동/확정 상태를 분리해서 조회할 수 있어야 한다.

#### 완료 기준

- 자동 감지 환각 이벤트가 영속 저장된다.
- 관리자 화면에서 자동 감지 포함 통계와 수동 피드백 통계를 모두 볼 수 있다.
- 콘솔 로그만 남고 데이터가 사라지는 경로가 제거된다.

---

### 3.4 MEDIUM - 테스트 스위트가 현재 코드 구조를 제대로 보호하지 못함

#### 현황

- 실패 파일:
  - `frontend/src/lib/llm/__tests__/gateway.test.ts`
  - `frontend/src/lib/rag/documentProcessor.test.ts`
  - `frontend/src/lib/rag/__tests__/p1_verification.test.ts`
- 관련 구현:
  - `frontend/src/lib/llm/gateway.ts`
  - `frontend/src/types/rag.ts`
  - `frontend/src/types/rag/index.ts`
  - `frontend/vitest.config.ts`

#### 문제

현재 테스트 실패는 두 종류다.

1. `gateway.ts` 구현이 바뀌었는데 테스트 기대값이 현행 동작을 따라오지 못함
2. `@/types/rag` 경로 해석 문제가 Vitest 환경에서 깨짐

이 상태는 "코드가 완전히 깨졌다"기보다, 리팩토링 이후 테스트 유지보수가 뒤처진 상태에 가깝다.
문제는 이런 상태가 계속되면 이후 회귀를 잡을 수 있는 방어선이 약해진다는 점이다.

#### 영향

- 개발자가 테스트 실패를 무시하는 문화로 고착될 위험
- LLM 게이트웨이와 RAG 처리 계층의 회귀 탐지 실패
- 실제 장애 전 조기 감지가 어려워짐

#### 개발 방향

1. `gateway.test.ts`를 현행 `gateway.ts` 정책에 맞게 수정한다.
2. `@/types/rag`의 re-export 구조를 단순화하거나, Vitest alias 해석을 명시적으로 맞춘다.
3. CI에서 `build`와 `test`를 분리 보고하되 둘 다 필수 상태로 복구한다.

#### 완료 기준

- `npm.cmd run test` 전체 성공
- 타입 경로 해석 오류 0건
- 게이트웨이 테스트가 실제 기본 모델 선택 정책을 반영

---

### 3.5 MEDIUM - 관리자 분석 체계가 Page Analytics 수준에 머물러 있음

#### 현황

- `frontend/src/components/analytics/AnalyticsProvider.tsx`
  - Vercel Analytics만 마운트
- `frontend/src/app/layout.tsx`
  - 전역에서 AnalyticsProvider 사용
- `frontend/src/hooks/useLLMUsage.ts`
  - 본인 사용자 기준 사용량 조회
- `frontend/src/app/(main)/admin/users/page.tsx`
  - 관리자 화면에서 사용량/활동성 지표 노출 거의 없음
- `frontend/src/lib/rag/projectPreferences.ts`
  - `learning_events` 저장
- `frontend/src/app/api/chat/sessions/[id]/route.ts`
  - `learning_events` 일부를 세션 복원에 사용

#### 문제

현재 전역 분석 계층은 사실상 Vercel page analytics에 가깝다.
페이지 단위 유입은 어느 정도 보이겠지만, 제품 운영에 필요한 행동 데이터는 거의 없다.

특히 아래가 부족하다.

- 기능별 클릭/사용 시작/완료 이벤트
- 검색 -> 문서 열람 -> 채팅 전환 이벤트
- 모델별 사용량과 실패율
- 사용자/프로젝트 단위 활동 요약
- 자동 감지 이벤트와 관리자 검토 이벤트 연결

#### 영향

- 운영자가 사용자 행동을 데이터로 이해하지 못함
- 기능 개선 우선순위를 감으로 정하게 됨
- 고객 대응 시 근거 자료 부족
- 비정상 사용 패턴이나 기능 고장 탐지가 늦어짐

#### 개발 방향

관리자 분석 체계를 "페이지 분석"에서 "제품 분석"으로 올려야 한다.

최소 단위 권장 설계는 다음과 같다.

| 영역 | 권장 산출물 |
|------|-------------|
| 이벤트 저장 | `product_events` 테이블 |
| 집계 뷰 | `daily_product_metrics`, `user_activity_summary`, `feature_adoption_summary` |
| 수집 API | 서버 액션 또는 `/api/analytics/events` |
| 관리자 UI | 사용자 활동, 검색 전환, 모델 사용량, 실패율, 환각 탐지 현황 대시보드 |

#### 완료 기준

- 운영자가 특정 사용자/기능/기간 기준으로 사용 패턴을 조회할 수 있다.
- 검색 행동, 채팅 사용, 모델 사용, 오류 이벤트가 하나의 이벤트 체계에 들어온다.

---

### 3.6 MEDIUM - 상태와 기능 토글이 분산되어 운영 일관성이 약함

#### 현황

- 검색 히스토리:
  - `frontend/src/hooks/useSearchHistory.ts`
  - `frontend/src/hooks/useResearchHistory.ts`
- 기능 토글:
  - `frontend/src/config/featureFlags.ts`
  - `frontend/src/lib/features.ts`
- 소비 지점:
  - `frontend/src/components/Assistant/AssistantPanel.tsx`

#### 문제

같은 범주의 기능이 두 가지 다른 방식으로 유지된다.

- 검색 이력은 로컬/서버 저장이 혼재
- 기능 토글은 별도 상수 체계가 공존

초기 개발 단계에서는 빠르게 움직일 수 있지만, 운영이 길어질수록 전체 상태를 추론하기 어려워진다.

#### 영향

- 관리자/개발자 모두 어떤 데이터가 신뢰 가능한 원천인지 알기 어려움
- 기능 비활성화 정책이 UI와 API에 균일하게 적용되지 않음
- 사용자 행동 분석과 세션 복원이 일관되지 않음

#### 개발 방향

1. 검색 이력은 목적별로 나누되 저장 기준을 명확히 문서화한다.
2. 분석 대상이 되는 사용 기록은 서버 저장으로 통일한다.
3. Feature Flag는 단일 파일 혹은 단일 서비스 계층으로 합친다.

#### 완료 기준

- 기능 플래그 조회 경로가 하나로 정리된다.
- 운영상 중요한 사용자 행동 기록은 서버 기준으로 조회 가능하다.

---

### 3.7 MEDIUM - `/editor` 번들이 과대하여 성능 리팩토링 우선순위가 높음

#### 현황

- 빌드 결과 `/editor` 첫 로드 JS 435kB
- 관련 파일:
  - `frontend/src/components/Assistant/AssistantPanel.tsx`
  - `frontend/src/app/(main)/editor/page.tsx`

#### 문제

무거운 탭 컴포넌트를 정적으로 모두 import하고, 화면에서 보이지 않는 상태에서도 계속 마운트하는 구조가 보인다.
이 방식은 초기 로드 비용과 메모리 점유를 동시에 높인다.

#### 영향

- 에디터 진입 체감 속도 저하
- 저사양 기기에서 반응성 저하 가능
- 향후 탭 기능 추가 시 성능 악화 가속

#### 개발 방향

1. 무거운 탭 컴포넌트를 `next/dynamic`으로 분리한다.
2. 현재 선택된 탭만 마운트하고 비활성 탭은 언마운트한다.
3. 빌드 예산을 문서화한다. 예: `/editor` first load 300kB 이하 목표

#### 완료 기준

- `/editor` first load JS가 유의미하게 감소한다.
- 비활성 탭이 초기 렌더에 포함되지 않는다.

---

### 3.8 MEDIUM - 레거시 `backend/`와 현재 `frontend/src/app/api`의 이중 구조 정리가 필요함

#### 현황

- Next.js API Route가 실질 운영 경로
- `backend/`에는 과거 FastAPI 기반 구조가 잔존
- 일부 파일은 주 경로가 아니거나 스텁 성격

#### 문제

새로 합류한 개발자가 보면, 어떤 경로가 실제 서비스 경로인지 바로 판단하기 어렵다.
문서와 코드가 분리되면 운영 중 오판 가능성이 높아진다.

#### 영향

- 유지보수 비용 증가
- 중복 기능 구현 가능성
- 불필요한 의존성/마이그레이션/배포 경로 혼란

#### 개발 방향

1. `backend/`를 유지할 이유가 있다면 역할을 문서화한다.
2. 유지하지 않는다면 보관 디렉토리로 이동하거나 제거 계획을 세운다.
3. 현재 생산 경로를 README와 기술 문서에 명시한다.

#### 완료 기준

- 운영 API의 단일 진입 경로가 문서와 코드에서 일치한다.

---

## 4. 관리자 관측성 설계 제안

### 4.1 운영자가 반드시 볼 수 있어야 하는 데이터

현재 시스템이 운영 도구로 발전하려면 최소한 아래 항목은 중앙에서 조회 가능해야 한다.

| 카테고리 | 필요한 질문 | 현재 상태 |
|----------|-------------|-----------|
| 사용자 활동 | 최근 7일 활성 사용자 수는? | 부족 |
| 프로젝트 사용 | 프로젝트별 문서/채팅/검색 사용량은? | 부족 |
| 검색 행동 | 어떤 검색어가 많고, 어떤 검색이 채팅으로 이어졌는가? | 부족 |
| 모델 사용 | 어떤 모델이 가장 많이 쓰였고 실패율은 어떤가? | 부족 |
| 품질 이벤트 | 환각, 낮은 만족도, 재시도 비율은? | 부분 |
| 기능 채택률 | Smart Search, Research, Self-RAG, AI Structurer 사용률은? | 부족 |

### 4.2 권장 이벤트 모델

권장 이벤트 저장 테이블 예시는 다음과 같다.

| 컬럼 | 설명 |
|------|------|
| `id` | 이벤트 ID |
| `user_id` | 사용자 ID |
| `project_id` | 프로젝트 ID |
| `session_id` | 채팅 또는 기능 세션 ID |
| `event_name` | 이벤트 이름 |
| `event_category` | `search`, `chat`, `editor`, `feedback`, `admin`, `system` |
| `source` | `web`, `api`, `auto_detector`, `admin_review` |
| `payload` | JSON 메타데이터 |
| `created_at` | 발생 시각 |

이벤트 이름 예시는 다음 정도가 최소선이다.

- `search.executed`
- `search.result_clicked`
- `chat.started`
- `chat.completed`
- `chat.failed`
- `model.used`
- `feedback.submitted`
- `hallucination.auto_detected`
- `hallucination.user_reported`
- `editor.document_saved`
- `feature.tab_opened`

### 4.3 관리자 대시보드 최소 구성

관리자 페이지는 단순 목록 페이지를 넘어 아래 4개 패널을 갖는 것이 좋다.

#### Panel 1. 사용자 활동 대시보드

- 일간 활성 사용자 수
- 주간 활성 프로젝트 수
- 최근 로그인 및 마지막 활동 시각
- 사용자별 월간 사용량과 한도 초과 여부

#### Panel 2. 검색/채팅 전환 대시보드

- 검색 실행 수
- 검색 후 채팅 전환율
- 검색 실패율
- 자주 검색되는 키워드

#### Panel 3. 모델/비용 대시보드

- 모델별 호출 수
- 평균 응답 시간
- 실패율
- 추정 토큰 사용량

#### Panel 4. 품질/환각 대시보드

- 자동 감지 환각 수
- 사용자 신고 환각 수
- 검토 완료/미완료 비율
- 프로젝트별 환각 집중도

### 4.4 운영 보안 원칙

분석 체계를 도입할 때는 권한과 개인정보 노출 범위를 함께 관리해야 한다.

- 관리자 대시보드의 이벤트 조회는 관리자 권한으로만 제한
- 민감 정보는 `payload`에 저장하지 않음
- 이메일, 전문 텍스트 원문 등은 요약 또는 마스킹 후 노출
- 관리자 조회 행위 자체도 감사 로그로 남김

---

## 5. 단계별 개발 계획

본 리팩토링은 **4단계**로 추진하는 것이 적절하다.
1단계는 보안과 깨진 관리자 기능을 우선 복구하고, 2단계에서 데이터 관측성을 확보한 뒤, 3단계에서 테스트와 구조 일관성을 복구하고, 4단계에서 성능과 레거시 구조를 정리한다.

---

### Phase 1: 관리자 안정성 복구

#### Task 1-1. `/api/admin/*` RBAC 공통 헬퍼 도입

- 대상:
  - `frontend/src/app/api/admin/migrate/route.ts`
  - `frontend/src/app/api/admin/users/route.ts`
  - 기타 `/api/admin/*`
- 작업:
  - 세션 조회
  - `profiles.role === 'admin'` 검증
  - 표준 `401/403/500` 응답 유틸 통합
- 기대 효과:
  - 관리자 API 인증 정책 일원화
  - 라우트별 보안 누락 방지

#### Task 1-2. 관리자 피드백 RAFT 기능 정리

- 대상:
  - `frontend/src/app/(main)/admin/feedback/page.tsx`
  - RAFT API 구현 경로 또는 플래그 가드
- 작업:
  - 실제 구현 여부 결정
  - 미구현이면 버튼 제거 또는 비활성 표시
  - 구현 시 `ENABLE_RAFT_FEATURES`와 동기화
- 기대 효과:
  - 관리자 UI 신뢰도 회복

#### Task 1-3. 관리자 API 전수 점검

- 대상:
  - `/api/admin/*` 전체
- 작업:
  - 인증 누락
  - 역할 검증 누락
  - 서비스 롤 사용 여부
  - RLS 우회 경로 점검
- 기대 효과:
  - 운영 API 보안 기준 확보

---

### Phase 2: 관리자 관측성 및 데이터 영속성 확보

#### Task 2-1. 자동 감지 환각 이벤트 영속 저장

- 대상:
  - `frontend/src/app/api/feedback/hallucination/route.ts`
  - 관리자 피드백 조회 쿼리
- 작업:
  - `autoDetected`도 DB insert
  - `source/status/review_state` 컬럼 정리
  - 관리자 필터 UI 보완
- 기대 효과:
  - 대시보드 수치 신뢰성 확보

#### Task 2-2. 제품 이벤트 수집 계층 도입

- 권장 신규 구성:
  - `frontend/src/lib/analytics/events.ts`
  - `frontend/src/app/api/analytics/events/route.ts`
  - DB 테이블 `product_events`
- 작업:
  - 검색, 채팅, 모델 사용, 오류, 환각, 탭 전환 이벤트 정의
  - 서버 저장 방식 통일
- 기대 효과:
  - 관리자 분석 체계 기반 마련

#### Task 2-3. 관리자 분석 대시보드 1차 구축

- 대상:
  - `frontend/src/app/(main)/admin/*`
- 작업:
  - 사용자 활동 패널
  - 검색/채팅 전환 패널
  - 모델 사용량 패널
  - 품질/환각 패널
- 기대 효과:
  - 운영자 관점 가시성 확보

---

### Phase 3: 구조 일관성 및 테스트 복구

#### Task 3-1. 테스트 스위트 복구

- 대상:
  - `frontend/src/lib/llm/__tests__/gateway.test.ts`
  - `frontend/src/lib/rag/documentProcessor.test.ts`
  - `frontend/src/lib/rag/__tests__/p1_verification.test.ts`
  - `frontend/vitest.config.ts`
- 작업:
  - 구현과 테스트 기대값 정렬
  - alias 해석 문제 정리
  - CI 기준 복원
- 기대 효과:
  - 회귀 방어선 복구

#### Task 3-2. 검색 히스토리 저장 정책 통합

- 대상:
  - `useSearchHistory.ts`
  - `useResearchHistory.ts`
  - 관련 API/컴포넌트
- 작업:
  - 로컬 저장과 서버 저장 역할 구분
  - 분석 대상 기록은 서버 저장으로 통일
- 기대 효과:
  - 사용자 행동 분석 일관성 확보

#### Task 3-3. Feature Flag 단일화

- 대상:
  - `frontend/src/config/featureFlags.ts`
  - `frontend/src/lib/features.ts`
  - 소비 컴포넌트 전반
- 작업:
  - 단일 source of truth 정의
  - UI/API 가드 일관성 복구
- 기대 효과:
  - 기능 노출 정책 예측 가능성 향상

---

### Phase 4: 성능 및 레거시 구조 정리

#### Task 4-1. `/editor` 탭 지연 로딩 및 조건부 마운트

- 대상:
  - `frontend/src/components/Assistant/AssistantPanel.tsx`
  - `frontend/src/app/(main)/editor/page.tsx`
- 작업:
  - `next/dynamic` 도입
  - 비활성 탭 언마운트
  - 초기 번들 분해
- 기대 효과:
  - 첫 로드 성능 개선

#### Task 4-2. 레거시 `backend/` 역할 정리

- 대상:
  - `backend/`
  - README 및 기술 문서
- 작업:
  - 유지/폐기 결정
  - 현재 생산 경로 문서화
- 기대 효과:
  - 아키텍처 인지 부하 감소

---

## 6. 우선순위 제안

| 우선순위 | 작업 | 이유 |
|----------|------|------|
| 1 | 관리자 RBAC 공통화 | 보안 문제는 가장 먼저 차단해야 함 |
| 2 | RAFT 관리자 기능 정리 | 현재 관리자 기능이 실제로 깨져 있음 |
| 3 | 자동 감지 환각 저장 | 관리자 통계 왜곡을 즉시 줄여야 함 |
| 4 | 제품 이벤트 수집 계층 구축 | 관리자 분석 역량 확보의 출발점 |
| 5 | 테스트 스위트 복구 | 이후 리팩토링 안전장치 필요 |
| 6 | 상태/플래그 단일화 | 운영 일관성 확보 |
| 7 | `/editor` 번들 최적화 | 사용자 체감 성능 개선 |
| 8 | 레거시 구조 정리 | 중장기 유지보수 효율 개선 |

---

## 7. 완료 판단 기준

다음 조건을 만족하면 이번 감사 기반 리팩토링이 1차 완료 상태라고 볼 수 있다.

### 7.1 보안/운영

- `/api/admin/*`에 RBAC 누락이 없다.
- 관리자 UI에서 노출되는 액션은 모두 실제 API와 연결된다.

### 7.2 데이터/관측성

- 자동 감지 환각이 저장된다.
- 검색/채팅/모델/오류 이벤트가 중앙 이벤트 테이블에 적재된다.
- 관리자 페이지에서 사용자 활동과 품질 지표를 기간별로 조회할 수 있다.

### 7.3 품질/테스트

- `npm.cmd run build` 성공
- `npm.cmd run test` 성공
- 주요 관리자 플로우 E2E 통과

### 7.4 성능

- `/editor` 초기 번들 크기가 현 수준 대비 유의미하게 감소
- 비활성 탭이 초기 렌더 비용을 만들지 않음

---

## 8. 최종 판단

PrismLM의 사용자 핵심 플로우는 이미 프로젝트 중심 구조로 잘 묶여 있어, 서비스 기능 연결 자체는 충분히 경쟁력이 있다.
문제는 관리자/운영 계층이 그 수준을 따라오지 못하고 있다는 점이다.

현재 상태를 한 문장으로 정리하면 다음과 같다.

**사용자 경험의 기본 골격은 갖추었지만, 운영자가 서비스를 통제하고 분석하는 능력은 아직 부족하다.**

따라서 다음 개발 사이클에서는 새로운 기능 추가보다 아래 두 축을 우선해야 한다.

1. 관리자 API와 관리자 UI의 안정성 복구
2. 운영 분석이 가능한 제품 이벤트 체계 구축

이 두 축이 정리되면 이후의 리팩토링, 성능 최적화, 기능 확장은 훨씬 예측 가능하고 안전하게 진행할 수 있다.
