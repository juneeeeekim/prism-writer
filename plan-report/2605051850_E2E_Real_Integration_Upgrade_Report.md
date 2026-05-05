# PRISM Writer - E2E 실제 연동 업그레이드 실행 보고서
> **문서 ID:** 2605051850-RP  
> **작성일:** 2026-05-05  
> **작성자:** Codex Orchestrator  
> **상태:** 자동 실행 완료 + 사용자 결정 대기  
> **목표:** mock E2E 제거, backend-required 기본화, external-smoke 안전 분리  

---

## 1. 전문가 초빙 및 아이디어

| 전문가 | 한 줄 자기소개 | 하위 에이전트 | 핵심 아이디어 |
|---|---|---|---|
| 시니어 아키텍트/API 계약 전문가 | API 계약과 Caller/Provider 동기화를 우선하는 설계 검토자 | Contract Mapper, Quota Auditor, Caller Sync Reviewer | mock은 release gate에서 제거하되, 기본 gate는 통제 가능한 backend-required로 제한 |
| 보안/관측성 전문가 | 비용, 민감정보, 데이터 오염, request 추적성을 차단하는 운영 검토자 | secret_cost_guard, safe_logging_reviewer, ops_recovery_reviewer | external-smoke는 명시 승인, 비용 상한, fixture cleanup 없이는 실행 금지 |
| DevOps/SRE/QA 전문가 | E2E 실패가 릴리스 의사결정으로 바로 이어지게 만드는 QA 릴리스 검토자 | e2e_architect, release_gate_reviewer, external_dependency_sre | Playwright project와 npm scripts를 분리하고 preflight를 필수화 |

---

## 2. 토론 및 투표

| 안 | 내용 | 투표 |
|---|---|---|
| A | 기존 `npm run test:e2e`를 그대로 필수 gate화 | 0 |
| B+ | mock 제거 + backend-required 기본 gate + external-smoke 수동/nightly | 3 |
| C | 모든 외부 Supabase/LLM/Storage/chat까지 PR 필수 실행 | 0 |

**합의안:** B+로 진행한다. mock 기반 E2E는 제거하고, 실제 외부 비용/데이터 변경이 있는 테스트는 별도 결정과 명시 승인 없이 자동 실행하지 않는다.

---

## 3. 자동 실행 완료 항목

| 항목 | 변경 요약 | 근거 |
|---|---|---|
| E2E project 분리 | `backend-required`, `external-smoke`, `ui-smoke` Playwright project 추가 | 실패 원인을 backend/API/external/UI로 분리 |
| mock E2E 제거 | `rag-status.spec.ts` 삭제 | `page.route().fulfill()` 기반 false green 제거 |
| backend-required 추가 | `/health`, `/v1/outline/generate` 실제 FastAPI contract 테스트 추가 | 비용 없는 실제 백엔드 연결 검증 |
| external-smoke guard | external smoke spec과 preflight 추가 | 명시 승인/비용 가드 없이는 실행 차단 |
| UI smoke 정리 | 현재 인증 보호 흐름 기준 unauth smoke 추가 | `/editor` 보호 흐름을 실제 UI로 확인 |
| npm scripts 분리 | `test:e2e:backend-required`, `test:e2e:external-smoke`, `test:e2e:ui-smoke`, `test:e2e:list` 추가 | 실행 목적을 명확히 분리 |
| env 문서화 | E2E 관련 env key를 `.env.example`에 추가 | secret 값 출력 없이 실행 조건 명시 |

---

## 4. 검증 결과

| 명령 | 결과 | 비고 |
|---|---|---|
| `npm run test:e2e:list` | Pass | 3개 project, 6개 테스트 발견 |
| `npm run lint` | Pass | ESLint warning/error 없음 |
| `npm exec tsc -- --noEmit` | Pass | TypeScript 통과 |
| `npm run test` | Pass | 13 files, 112 passed, 1 skipped |
| `npm run build` | Pass | production build 통과, `.next/standalone` 존재 |
| `npm run test:e2e:backend-required` | Pass | 임시 FastAPI backend 기동 후 2 passed |
| `npm run test:e2e:ui-smoke` | Pass | 2 passed |
| `external-smoke` 직접 실행 | Pass | 승인 env 미설정 상태에서 2 skipped |

---

## 5. 수정 파일 목록

- `frontend/package.json`
- `frontend/playwright.config.ts`
- `frontend/e2e/backend-required.backend.spec.ts`
- `frontend/e2e/external-smoke.external.spec.ts`
- `frontend/e2e/ui-smoke.ui.spec.ts`
- `frontend/e2e/rag-status.spec.ts` 삭제
- `frontend/e2e/writer-flow.spec.ts` 삭제 후 현재 UI smoke로 대체
- `frontend/scripts/e2e-preflight-backend.mjs`
- `frontend/scripts/e2e-preflight-external.mjs`
- `frontend/scripts/run-e2e-project.mjs`
- `frontend/.env.example`

---

## 6. 결정 문서 목록

| 파일 | 핵심 트레이드오프 |
|---|---|
| `plan-report/2605051850_E2E_Backend_Gate_Decision.md` | backend-required를 CI 필수 gate로 올리면 회귀 보호는 강해지지만 CI backend 기동 책임이 생김 |
| `plan-report/2605051850_E2E_External_Smoke_Decision.md` | 실제 외부 연동은 신뢰도를 높이지만 비용/rate limit/데이터 오염 위험이 있음 |
| `plan-report/2605051850_E2E_Auth_Data_Fixture_Decision.md` | 로그인 후 실제 UI 흐름을 검증하려면 test user/role/storage cleanup 정책이 필요 |

---

## 7. 우선순위

| 시점 | 작업 | 이유 |
|---|---|---|
| 즉시 | `backend-required`를 로컬에서 안정 실행하고 CI 필수화 여부 결정 | 현재 mock 없이 가장 안전한 실제 검증 |
| 단기 | staging test user와 `ui-smoke` login fixture 결정 | 에디터/대시보드 실제 회귀 보호 강화 |
| 중기 | external-smoke에 Supabase read/auth + LLM 1회 최소 호출 추가 | 운영 외부 의존성 확인 |
| 장기 | upload/process/chat quota까지 실제 E2E 확장 | cleanup/idempotency 정책 확정 후 진행해야 안전 |

---

## 8. 남은 리스크

- 실제 LLM/Supabase/Storage 호출은 아직 자동 실행하지 않았다.
- `/api/chat`은 quota/idempotency 결정 전까지 external-smoke 기본 대상에서 제외해야 한다.
- CI에서 backend를 어떻게 기동할지는 사용자 결정 문서에 남겼다.
- UI authenticated flow는 test user/role fixture 결정 후 추가해야 한다.
