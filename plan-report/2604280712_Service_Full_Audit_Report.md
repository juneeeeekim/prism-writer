# PRISM Writer - 서비스 전체 분석 및 운영 안정화 리포트

> **문서 ID:** 2604280712
> **작성일:** 2026-04-28
> **작성자:** Codex (기술 리더)
> **상태:** 검토 대기
> **분석 범위:** Frontend (Next.js App Router), Backend (FastAPI), Supabase/RLS, RAG Pipeline, LLM Gateway, API Security, Deployment, Test Suite
> **검증 상태:** `frontend` 기준 `npm.cmd run build` 성공, `npm.cmd run test` 실패, E2E 미실행
> **핵심 판단:** 빌드는 통과하지만 운영 안정도는 베타/내부 운영 수준. API 권한, AI 비용 통제, Cron, RAG 데이터 계약, 테스트 신뢰도를 먼저 고정해야 한다.

---

## 1. 개요

본 문서는 PRISM Writer 서비스를 기술 리더 관점에서 전체 점검한 결과를 정리한 리포트입니다.
분석 목적은 현재 서비스가 운영 환경에서 안정적으로 동작할 수 있는지 판단하고, 즉시 수정해야 할 위험 영역과 후속 개발 우선순위를 명확히 하는 것입니다.

이번 점검은 단순 코드 스타일 리뷰가 아니라 다음 범위를 포함한 서비스 운영성 감사입니다.

1. 사용자-facing 기능과 실제 아키텍처의 연결 상태
2. API 권한, 관리자 기능, LLM 비용 통제
3. RAG 검색/평가 데이터 계약의 일관성
4. 배포 방식과 백엔드 역할의 명확성
5. 빌드, 테스트, 성능, 문서 신뢰도

### 1.1 핵심 결론

현재 서비스는 기능 자산과 제품 방향이 충분히 쌓여 있습니다.
Next.js 기반의 메인 앱, Supabase 기반 인증/데이터 저장, RAG 검색, AI 평가, 채팅, 관리자 화면까지 주요 제품 골격은 이미 존재합니다.

다만 운영 서비스로 보기에는 아직 위험한 지점이 남아 있습니다.

- 일부 LLM/API route가 인증 없이 호출될 수 있어 비용과 보안 리스크가 큽니다.
- Cron route가 `CRON_SECRET` 미설정 시 fail-open 형태이며, 동시에 anon client 사용으로 실제 작업 성공도 불확실합니다.
- RAG/evaluation 쪽에서 `criteria_json`, `schema`, `chunk_type`, `projectId` 계약이 일부 어긋나 검색/평가 품질이 조용히 깨질 수 있습니다.
- 테스트가 실패하고 E2E 기대값 일부가 현재 UI와 맞지 않아 CI를 신뢰하기 어렵습니다.
- Docker 프로덕션 경로와 Next 설정이 불일치합니다.

따라서 현 시점의 우선순위는 신규 기능 추가가 아니라 **운영 안정화**입니다.

### 1.2 발견 이슈 요약

| 심각도 | 건수 | 핵심 항목 |
|--------|------|-----------|
| **P0** | 3건 | API 권한/AI 비용 통제, Cron 보안/실행성, RAG 데이터 계약 불일치 |
| **P1** | 5건 | 테스트 실패, Docker 배포 불일치, Backend 스텁/문서 불일치, 성능/번들 과대, 클라이언트 런타임 churn |
| **P2** | 4건 | 문서 드리프트, 환경변수 관리, console logging 과다, 레거시/중복 구조 정리 |

### 1.3 현재 서비스 규모

| 영역 | 현재 상태 |
|------|-----------|
| Frontend | Next.js 14 App Router 기반 메인 서비스 |
| API Routes | 약 57개 route 파일 |
| Pages | 약 18개 page 파일 |
| Source Files | 약 297개 TypeScript/TSX 파일 |
| Database | Supabase migration 약 65개 |
| Backend | FastAPI 존재, 현재는 스텁/프로토타입 성격 |
| Build | 성공 |
| Unit Test | 실패 |
| E2E | 이번 점검 범위에서는 미실행 |

---

## 2. 현재 아키텍처 평가

### 2.1 실제 메인 서비스 경로

현재 운영 관점에서 실제 메인 서비스는 `frontend`입니다.
`backend`도 존재하지만 RAG/LLM 핵심 흐름은 대부분 Next.js API route 안에서 처리됩니다.

```text
Browser
  -> Next.js App Router
  -> Next.js API Routes
  -> Supabase Auth / PostgreSQL / pgvector
  -> OpenAI / Anthropic / Gemini
```

FastAPI backend는 `/health`와 일부 outline/reference API를 제공하지만, 실제 구현은 더미 또는 TODO가 많습니다.
따라서 신규 개발자나 운영자가 문서를 읽을 때 "어느 쪽이 진짜 서비스 경계인가"가 혼동될 가능성이 큽니다.

### 2.2 잘 연결되어 있는 영역

다음 영역은 제품 골격이 비교적 잘 잡혀 있습니다.

- 프로젝트 기반 문서, 채팅, RAG, 평가 흐름
- Supabase Auth와 RLS를 활용하려는 데이터 격리 설계
- LLM gateway와 model registry 기반의 provider 추상화
- 사용자 문서 업로드, 청킹, 임베딩, 검색, 평가로 이어지는 RAG 흐름
- 관리자 페이지, 사용량, 피드백, 모델 설정 등 운영 기능의 초기 구조

특히 기능 단위의 코드 자산은 적지 않습니다.
문제는 기능 부재보다 **운영 경계와 데이터 계약의 느슨함**입니다.

### 2.3 운영 관점에서 약한 영역

운영자가 서비스를 안정적으로 관리하려면 다음 질문에 명확히 답할 수 있어야 합니다.

- 누가 어떤 LLM 모델을 호출할 수 있는가
- 비로그인 사용자가 비용이 발생하는 API를 호출할 수 없는가
- Cron이 실패하면 어떻게 감지하고 재처리하는가
- RAG 검색과 평가가 같은 데이터 계약을 바라보는가
- CI가 깨졌을 때 실제 사용자 기능 위험을 빠르게 알 수 있는가
- 배포 대상이 Vercel인지 Docker인지 명확한가

현재 코드베이스는 위 질문에 일관되게 답하기 어렵습니다.

---

## 3. 주요 발견 상세 분석

### 3.1 P0 - API 권한과 AI 비용 통제 공백

#### 현황

다음 API route는 인증 또는 관리자 권한 검증이 약하거나 누락되어 있습니다.

- `frontend/src/app/api/llm/judge/route.ts`
- `frontend/src/app/api/llm/test/route.ts`
- `frontend/src/app/api/admin/migrate/route.ts`
- `frontend/src/app/api/chat/route.ts`

특히 LLM 호출 route가 인증 없이 열려 있거나, 사용자가 요청한 모델을 서버에서 plan/tier 기준으로 충분히 제한하지 않는 구조가 확인되었습니다.
UI에는 모델 선택기가 존재하고, API도 모델 override를 받을 수 있으므로 비용이 높은 모델 호출을 서버에서 강제 차단해야 합니다.

#### 영향

- 비인가 사용자의 LLM 비용 발생 가능성
- 일반 사용자의 premium/developer 모델 호출 가능성
- 관리자성 migration 또는 re-embedding 작업의 노출 가능성
- 사용량 제한은 질문 수 기준인데 실제 비용은 모델/토큰 기준이라 비용 통제력이 약함

#### 개발 방향

1. 모든 API route를 인증 정책 기준으로 분류합니다.
   - public
   - authenticated
   - admin
   - cron
   - internal
2. `withAuth`, `requireAdmin`, `requireCron` 계열 공통 헬퍼를 강제 적용합니다.
3. LLM 모델 호출 전 서버에서 사용자 role/plan/tier와 모델 allowlist를 검증합니다.
4. `x-prism-model-id` 또는 request body의 model override는 서버 정책을 통과한 경우에만 허용합니다.
5. 사용량 제한을 질문 수뿐 아니라 provider/model/token/cost 추정 기준으로 확장합니다.

#### 완료 기준

- 비로그인 사용자가 LLM 비용 발생 route를 호출하면 401로 차단됩니다.
- 비관리자가 `/api/admin/*` route를 호출하면 403으로 차단됩니다.
- 무료/일반 사용자가 premium/developer 모델을 직접 지정해도 서버에서 거절됩니다.
- API route 전수 점검표에서 권한 미분류 route가 0건입니다.

---

### 3.2 P0 - Cron route 보안과 실행성 문제

#### 현황

Cron 계열 route는 `CRON_SECRET`을 확인하지만, secret이 설정되지 않은 경우 허용되는 fail-open 패턴이 있습니다.
또한 정기 작업에서 일반 Supabase client를 사용하면 사용자 세션이 없는 Cron 요청에서는 RLS 때문에 조회/삭제/처리가 실패하거나 빈 결과가 나올 수 있습니다.

주요 대상은 다음과 같습니다.

- `frontend/src/app/api/cron/process-documents/route.ts`
- `frontend/src/app/api/cron/cleanup-orphans/route.ts`
- `frontend/src/app/api/cron/cleanup-embedding-cache/route.ts`

#### 영향

- 운영 환경에서 `CRON_SECRET` 누락 시 public endpoint가 될 수 있음
- secret을 설정해도 anon/RLS 문제로 실제 background job이 작동하지 않을 수 있음
- 문서 처리, orphan cleanup, embedding cache cleanup의 신뢰도가 낮아짐

#### 개발 방향

1. production에서는 `CRON_SECRET`이 없으면 route가 즉시 500 또는 403으로 실패하도록 fail-closed로 변경합니다.
2. Cron 작업은 service-role client 또는 security definer RPC를 통해 실행합니다.
3. 각 Cron route에 실행 결과, 처리 건수, 실패 건수, request id를 표준 응답으로 남깁니다.
4. Cron 실행 로그를 DB 또는 observability sink에 저장합니다.

#### 완료 기준

- `CRON_SECRET` 미설정 production 환경에서 Cron route가 열리지 않습니다.
- 사용자 세션 없이도 정상적으로 필요한 DB 작업이 수행됩니다.
- Cron 처리 결과가 관리자 화면 또는 로그에서 추적 가능합니다.

---

### 3.3 P0 - RAG/evaluation 데이터 계약 불일치

#### 현황

RAG와 평가 파이프라인에서 같은 개념을 서로 다른 컬럼/계약으로 다루는 부분이 확인되었습니다.

대표 사례는 다음과 같습니다.

- template builder와 migration은 `criteria_json`을 사용하지만, 일부 평가 API는 `schema`를 조회합니다.
- chunking 로직은 `metadata.chunkType`을 생성하지만, 검색 SQL은 top-level `chunk_type`을 기대합니다.
- migration 일부는 `document_chunks`를 수정하고, 실제 코드 경로는 `rag_chunks`를 바라보는 흐름이 섞여 있습니다.
- strict project isolation이 도입되었지만 legacy evaluation/search 경로에서는 `projectId`가 빠지는 호출이 남아 있습니다.

#### 영향

- 사용자 정의 평가 템플릿이 무시되거나 실패할 수 있음
- RAG 검색에서 chunk type boost/filter가 기대대로 작동하지 않을 수 있음
- 프로젝트 격리 강화 이후 legacy search가 빈 결과를 반환할 수 있음
- 검색 품질 저하가 에러가 아니라 "품질 저하"로 나타나 발견이 늦어질 수 있음

#### 개발 방향

1. RAG 데이터 계약 문서를 하나로 고정합니다.
   - template: `criteria_json`
   - chunk table: `rag_chunks`
   - chunk type: top-level `chunk_type`
   - project scope: `project_id` 필수 여부
2. `evaluate`, `evaluate-single`, template builder, migration, RPC를 같은 계약으로 맞춥니다.
3. `saveChunks` 단계에서 `metadata.chunkType`뿐 아니라 top-level `chunk_type`도 저장합니다.
4. legacy search/evaluation 경로에도 `projectId` 전달을 강제하거나 제거합니다.
5. RAG contract test를 추가합니다.

#### 완료 기준

- approved custom template으로 평가 API가 정상 동작합니다.
- 새로 업로드한 문서의 chunk에 `chunk_type`이 저장됩니다.
- projectId 없는 legacy 호출이 운영 경로에서 제거되거나 명시적으로 차단됩니다.
- RAG/evaluation contract test가 CI에서 통과합니다.

---

### 3.4 P1 - 테스트와 CI 신뢰도 저하

#### 현황

`frontend` 기준 빌드는 성공하지만 테스트는 실패합니다.

확인된 실패 유형은 다음과 같습니다.

- `@/types/rag` import 해석 실패
- `src/types/rag.ts`와 `src/types/rag/` 디렉터리의 alias 충돌 가능성
- LLM gateway 테스트에서 현재 구현과 mock 기대값이 불일치
- E2E 일부가 현재 UI에서 비활성화된 outline tab을 아직 기대하는 것으로 보임

#### 영향

- CI가 제품 안정성을 보증하지 못함
- 실제 regression과 낡은 테스트 실패를 구분하기 어려움
- 리팩토링 속도가 느려지고 배포 판단이 감에 의존하게 됨

#### 개발 방향

1. `@/types/rag` import 경로를 명확히 정리합니다.
2. LLM gateway 테스트를 현재 gateway 정책에 맞게 갱신합니다.
3. UI에서 제거/비활성화된 기능에 맞춰 E2E 기대값을 수정하거나 테스트를 제거합니다.
4. API auth contract test와 RAG contract test를 추가합니다.

#### 완료 기준

- `npm.cmd run test`가 통과합니다.
- 핵심 E2E smoke test가 현재 UI 기준으로 통과합니다.
- API 권한과 RAG 계약은 테스트로 회귀 방지됩니다.

---

### 3.5 P1 - Docker 배포 경로와 Next 설정 불일치

#### 현황

`frontend/next.config.js`에서는 Vercel 호환을 위해 standalone output이 제거되어 있습니다.
반면 `frontend/Dockerfile`은 `.next/standalone`을 복사하는 production stage를 가지고 있습니다.

#### 영향

- Vercel 배포는 가능하지만 Docker production build는 실패할 가능성이 큼
- 운영자가 어떤 배포 경로를 신뢰해야 하는지 혼동됨
- 장애 대응 문서와 실제 배포 산출물이 달라질 수 있음

#### 개발 방향

1. Vercel-only 전략이면 Dockerfile production stage를 제거하거나 dev 전용으로 명시합니다.
2. Docker도 지원해야 하면 `output: 'standalone'` 복구 여부와 Vercel 호환성을 재검토합니다.
3. 배포 문서에서 canonical deployment path를 하나로 지정합니다.

#### 완료 기준

- Vercel과 Docker 중 공식 운영 경로가 문서와 설정에서 일치합니다.
- 공식 배포 명령이 CI에서 검증됩니다.

---

### 3.6 P1 - Backend 스텁과 문서 불일치

#### 현황

`backend`는 FastAPI 앱으로 존재하지만 핵심 RAG/LLM 기능은 아직 스텁에 가깝습니다.
반면 일부 문서는 backend가 실제 RAG/LLM API의 주요 실행 경로인 것처럼 설명합니다.

#### 영향

- 신규 개발자가 잘못된 경로를 수정할 수 있음
- 운영 문서와 실제 장애 지점이 달라짐
- 중복 아키텍처가 유지보수 비용을 증가시킴

#### 개발 방향

1. backend를 유지할지, 폐기할지, worker 전용으로 재정의할지 결정합니다.
2. 유지한다면 Next API와 책임 경계를 명확히 나눕니다.
3. 폐기 또는 보류라면 문서와 docker-compose에서 현재 상태를 명확히 표시합니다.

#### 완료 기준

- README와 architecture 문서에서 실제 요청 경로가 명확히 설명됩니다.
- backend의 스텁 API가 production critical path로 오해되지 않습니다.

---

### 3.7 P1 - 성능과 클라이언트 런타임 부담

#### 현황

빌드 결과에서 `/editor` first-load JS가 약 443kB, `/analytics` first-load JS가 약 265kB로 확인되었습니다.
middleware도 약 162kB로 가볍지 않습니다.

추가로 `useAuth` 계열에서 Supabase client가 hook body에서 생성되는 흐름이 있어 effect dependency와 subscription churn이 발생할 수 있습니다.
프론트엔드 소스 전반에는 `console.*` 사용도 많아 운영 로그 품질과 노출 위험을 관리해야 합니다.

#### 영향

- 에디터 첫 진입 속도 저하
- 저사양 디바이스에서 인터랙션 지연 가능성
- auth/profile polling 또는 subscription 중복 가능성
- 운영 로그에서 민감 정보 노출 가능성

#### 개발 방향

1. 에디터의 무거운 tab과 분석 컴포넌트를 dynamic import로 분리합니다.
2. middleware에서 필요한 코드만 남기고 서버 전용 로직 유입을 줄입니다.
3. Supabase browser client를 singleton 또는 memoized 구조로 정리합니다.
4. `console.*`를 환경 기반 logger로 치환하고 민감 정보 로깅을 금지합니다.

#### 완료 기준

- `/editor` first-load JS가 의미 있게 감소합니다.
- auth 관련 effect/subscription 중복이 제거됩니다.
- production build에서 불필요한 console logging이 제한됩니다.

---

## 4. 유지해야 할 강점

이번 점검은 문제만 찾기 위한 것이 아닙니다.
다음 구조는 계속 유지하고 강화할 가치가 있습니다.

1. **Next.js 중심의 단일 제품 경로**
   - UI와 API가 가까워 빠른 제품 개발에 적합합니다.

2. **Supabase Auth/RLS 기반의 데이터 격리 방향**
   - 프로젝트 기반 서비스에 맞는 선택입니다.

3. **LLM gateway와 model registry**
   - provider 교체, fallback, 모델 정책 관리의 기반이 됩니다.

4. **RAG pipeline 자산**
   - chunking, embedding, search, evaluation, template builder까지 기능 자산이 이미 큽니다.

5. **문서와 plan-report 문화**
   - 의사결정과 구현 계획이 파일로 남아 있어 장기 유지보수에 유리합니다.

---

## 5. 실행 로드맵

### Phase 0: 운영 차단선 구축 - P0 보안/비용

목표 기간: 1-2일

- [ ] API route 권한 분류표 작성
- [ ] `requireAdmin` 공통 헬퍼 도입
- [ ] `requireCron` 공통 헬퍼 도입
- [ ] `llm/judge`, `llm/test`를 인증 또는 관리자 전용으로 전환
- [ ] `admin/migrate` RBAC 적용
- [ ] chat model override 서버 정책 검증 추가
- [ ] plan/tier별 model allowlist 적용

### Phase 1: RAG/Cron 데이터 계약 안정화

목표 기간: 2-4일

- [ ] Cron route fail-closed 처리
- [ ] Cron 작업 service-role client 또는 RPC 전환
- [ ] evaluation template 컬럼을 `criteria_json`으로 통일
- [ ] `saveChunks`에서 top-level `chunk_type` 저장
- [ ] `rag_chunks`와 `document_chunks` migration 관계 정리
- [ ] legacy search/evaluation의 projectId 누락 제거
- [ ] RAG contract test 추가

### Phase 2: CI 신뢰도 복구

목표 기간: 2-3일

- [ ] `@/types/rag` alias 충돌 정리
- [ ] LLM gateway unit test 갱신
- [ ] 현재 UI 기준으로 E2E 테스트 수정
- [ ] auth contract test 추가
- [ ] `npm.cmd run build`, `npm.cmd run test`, 핵심 E2E smoke를 CI 기준으로 고정

### Phase 3: 배포와 성능 정리

목표 기간: 3-5일

- [ ] Vercel-only 또는 Docker-supported 전략 결정
- [ ] Dockerfile과 `next.config.js` 불일치 제거
- [ ] `/editor` 무거운 tab dynamic import 적용
- [ ] middleware bundle 축소
- [ ] Supabase browser client lifecycle 정리
- [ ] production logger 정책 도입

### Phase 4: 문서/운영 관측성 정리

목표 기간: 지속 개선

- [ ] architecture 문서에서 실제 메인 실행 경로 갱신
- [ ] backend의 현재 역할을 명확히 표시
- [ ] 환경변수 문서와 실제 배포 환경 매핑
- [ ] 관리자 화면에 Cron/LLM/RAG 실패율 관측 지표 추가
- [ ] 운영 runbook 작성

---

## 6. 최종 완료 기준

다음 조건을 만족하면 현재 서비스는 내부 베타 수준에서 운영 가능 수준으로 올라갈 수 있습니다.

- [ ] 인증 없는 LLM 비용 발생 route가 0건
- [ ] `/api/admin/*` route 전부 admin RBAC 적용
- [ ] Cron route가 production에서 fail-closed로 동작
- [ ] Cron 작업이 RLS에 막히지 않고 정상 수행
- [ ] RAG/evaluation 데이터 계약이 `criteria_json`, `rag_chunks`, `chunk_type`, `projectId` 기준으로 통일
- [ ] `npm.cmd run build` 성공
- [ ] `npm.cmd run test` 성공
- [ ] 핵심 E2E smoke test 성공
- [ ] 공식 배포 경로가 Vercel 또는 Docker 중 하나로 명확히 고정
- [ ] 신규 기능 개발 전 P0 항목 전부 완료

---

## 7. 기술 리더 판단

PRISM Writer는 기능 자체가 부족한 프로젝트가 아닙니다.
오히려 기능은 많이 쌓였고, 제품 방향도 분명합니다.

현재 병목은 기능 확장이 아니라 운영 경계입니다.
지금 신규 기능을 계속 얹으면 권한, 비용, RAG 품질, 테스트 신뢰도 문제가 누적되어 이후 수정 비용이 커질 가능성이 높습니다.

따라서 다음 개발 순서는 명확합니다.

1. API 보안과 AI 비용 통제를 먼저 잠근다.
2. Cron과 RAG 데이터 계약을 고정한다.
3. 테스트를 녹색으로 돌려 CI를 신뢰 가능한 상태로 만든다.
4. 그 다음 성능, 배포, 관측성을 정리한다.

이 순서로 진행하면 기존 기능 자산을 버리지 않고 운영 가능한 서비스로 끌어올릴 수 있습니다.
