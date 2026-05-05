# PRISM Writer - Service Stability Auto Upgrade Report
> **문서 ID:** 2605052005-SU  
> **작성일:** 2026-05-05  
> **작성자:** Codex Orchestrator  
> **상태:** 자동 실행 완료  
> **범위:** 배포 제외, 로컬 서비스 안정성 개선  

---

## 1. 목표

배포/CI 변경은 제외하고, 기존 기능 보호를 우선하면서 회귀 위험이 낮은 서비스 안정성 개선만 적용했다.

우선 처리한 대상:
- 문서 처리 API의 중복 처리 방지와 안전한 에러 응답
- Chat API의 quota 차감 전 요청 검증
- 관련 테스트 보강

---

## 2. 자동 실행 완료 항목

| 항목 | 변경 요약 | 이유 |
|---|---|---|
| `/api/documents/process` handler 분리 | route entrypoint와 처리 로직을 분리하고 테스트 가능한 handler를 추가 | Next.js route export 계약을 지키면서 API 로직을 단위 검증 가능하게 함 |
| 문서 처리 idempotency claim | `pending/queued/failed` 상태만 `processing_parsing`으로 조건부 claim 후 처리 | 동시 요청이 같은 문서를 중복 처리할 가능성을 줄임 |
| 문서 처리 안전 응답 | 내부 provider/error message를 응답에 노출하지 않고 request id를 포함 | 운영 추적성은 유지하면서 내부 오류 노출을 차단 |
| Chat 요청 검증 | `messages`, 최신 메시지, optional id 필드를 quota RPC 전 검증 | 잘못된 요청이 사용량 차감이나 LLM 호출로 이어지는 위험을 줄임 |
| 테스트 보강 | document process route 4건, chat request validation 5건 추가 | 회귀 위험이 있는 API 입력/상태 분기를 자동 검증 |

---

## 3. 수정 파일

- `frontend/src/app/api/documents/process/route.ts`
- `frontend/src/app/api/documents/process/handler.ts`
- `frontend/src/app/api/documents/process/route.test.ts`
- `frontend/src/app/api/chat/route.ts`
- `frontend/src/app/api/chat/requestValidation.ts`
- `frontend/src/app/api/chat/requestValidation.test.ts`

---

## 4. API 계약 / 외부 의존성 / 멱등성 검수

| 영역 | 결과 |
|---|---|
| API response shape | 기존 `success/message/error` 계열을 유지하고 `requestId/status`만 안전하게 추가 |
| Breaking change | 없음. 정상 성공 경로는 유지 |
| 문서 처리 멱등성 | active/done 상태는 성공 응답으로 흡수, claim 가능한 상태만 처리 시작 |
| Chat quota | 구조 변경 없음. 다만 invalid request는 quota RPC 전에 400으로 종료 |
| 외부 의존성 | Supabase/LLM 호출 방식 변경 없음 |
| 민감정보 | 내부 processing error 원문을 응답에 포함하지 않음 |

---

## 5. 검증 결과

| 명령 | 결과 |
|---|---|
| `npm exec vitest -- run src/app/api/chat/requestValidation.test.ts src/app/api/documents/process/route.test.ts` | Pass, 2 files / 9 tests |
| `npm exec tsc -- --noEmit` | Pass |
| `npm run lint` | Pass |
| `npm run test` | Pass, 15 files / 121 passed / 1 skipped |
| `npm run build` | Pass, `.next/standalone` 생성 확인 |

빌드 중 `/login`, `/editor` client-side rendering deopt 경고는 남아 있다. 이번 변경 범위 밖이며, 배포 관련 작업은 사용자 요청에 따라 제외했다.

---

## 6. 보류/결정 필요 항목

| 항목 | 처리 방식 | 이유 |
|---|---|---|
| `/api/chat` quota/idempotency 전체 리팩토링 | 결정 문서 분리 | DB schema/RPC/API caller 계약이 바뀌는 고위험 작업 |
| 실제 Supabase/LLM/chat external smoke | 결정 문서 분리 | 비용, rate limit, 테스트 데이터 cleanup, quota 오염 가능성 |
| 공통 API error format 전체 표준화 | 단계적 적용 권장 | 전체 API 응답 계약 변경 가능성이 있어 일괄 변경 금지 |

---

## 7. 다음 우선순위

| 시점 | 작업 | 이유 |
|---|---|---|
| 즉시 | 문서 처리 API 변경분 전체 테스트/build 재검증 | 현재 자동 실행 변경의 회귀 확인 |
| 단기 | chat quota/idempotency 옵션 선택 후 Phase 0 작성 | 비용/사용량 side effect API의 중복 차감 방지 |
| 중기 | 공통 API error helper를 신규/수정 API부터 점진 적용 | 기존 caller를 깨지 않고 표준화 |
| 장기 | 실제 Supabase/LLM external smoke 확대 | idempotency/fixture/cleanup 정책 확정 후 안전하게 확장 |

---

## 8. Rollback

- Chat 요청 검증 문제 발생 시 `frontend/src/app/api/chat/route.ts`의 validation 분기와 `requestValidation.ts` import를 제거한다.
- 문서 처리 claim 문제가 발생하면 `handler.ts`의 conditional claim 경로를 기존 direct `processDocument` 호출로 되돌린다.
- 새 테스트 파일은 기능 코드와 독립적이므로 삭제해도 런타임 영향은 없다.
