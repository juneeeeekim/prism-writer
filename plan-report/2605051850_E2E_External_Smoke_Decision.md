# PRISM Writer - External Smoke 결정 문서
> **문서 ID:** 2605051850-ES  
> **작성일:** 2026-05-05  
> **작성자:** Codex Orchestrator  
> **상태:** 사용자 결정 필요  
> **대상:** Supabase, LLM, 검색 API, Storage, chat usage를 실제 호출하는 smoke 범위 결정  

---

## 1. 배경/문제 정의

사용자는 mock 기반 E2E를 제거하고 실제 작동을 검증하기를 원한다. 방향은 맞지만, Supabase/LLM/검색/Storage/chat 사용량 차감은 비용, rate limit, 테스트 데이터 오염, quota 오염 위험이 있다.

이번 자동 실행에서는 `external-smoke` 그룹과 preflight guard만 만들었다. 실제 외부 비용 또는 데이터 변경이 있는 호출은 사용자 결정 전에는 실행하지 않는다.

---

## 2. 옵션 A/B/C

| 옵션 | 내용 | 비용 | 리스크 | 소요 시간 | 롤백 난이도 |
|---|---|---:|---|---:|---|
| A | 외부 smoke를 홈페이지/robots/sitemap 같은 비파괴 검사로 제한 | 낮음 | LLM/Supabase 실제 장애를 못 잡음 | 0.5일 | 낮음 |
| B | staging URL에서 Supabase read/auth + LLM 1회 최소 호출만 허용 | 중간 | 비용/rate limit 발생 | 1~3일 | 중간 |
| C | upload/process/chat quota까지 실제 end-to-end 실행 | 높음 | 데이터/사용량 오염, cleanup 실패 가능 | 3~7일 | 높음 |

---

## 3. 추천안과 근거

추천은 **옵션 B를 release candidate 또는 nightly에서만 실행**하는 방식이다.

근거:
- 모든 PR에서 실제 LLM/Storage/chat을 호출하면 테스트가 회귀 검증이 아니라 외부 상태 검증으로 변한다.
- chat quota/idempotency 리팩토링이 완료되기 전에는 `/api/chat` smoke가 사용량을 오염시킬 수 있다.
- `frontend/scripts/e2e-preflight-external.mjs`는 `E2E_EXTERNAL_SMOKE=1`, `E2E_COST_LIMIT_USD`, `E2E_MAX_TOKENS` 없이는 실행을 차단한다.

참조:
- `frontend/e2e/external-smoke.external.spec.ts`
- `frontend/scripts/e2e-preflight-external.mjs`
- `docs/decision-chat-quota-idempotency.md`
- `docs/decision-e2e-external-verification.md`

---

## 4. 결정 시 실행 체크리스트

- [ ] `E2E_EXTERNAL_BASE_URL`을 production이 아닌 staging URL로 지정한다.
- [ ] `E2E_EXTERNAL_SMOKE=1` 또는 `ALLOW_EXTERNAL_SMOKE=true`를 수동/nightly job에만 설정한다.
- [ ] `E2E_COST_LIMIT_USD`와 `E2E_MAX_TOKENS`를 설정한다.
- [ ] 실제 LLM 호출은 짧은 prompt 1회, max token 제한, retry 0~1회로 제한한다.
- [ ] Supabase는 전용 test user/project prefix를 사용한다.
- [ ] Storage upload smoke를 포함하려면 cleanup 검증까지 같은 테스트에서 수행한다.
- [ ] `/api/chat` smoke는 quota/idempotency Phase 0 확정 전에는 제외한다.
- [ ] 실패 시 release candidate 보류 여부와 재시도 정책을 문서화한다.

---

## 5. 영향 범위

- staging Supabase project
- LLM provider 비용/쿼터
- 검색 API 비용/쿼터
- Storage bucket test object
- chat quota/test user usage
- CI/nightly/release workflow

---

## 6. 롤백 계획

- external smoke job의 `E2E_EXTERNAL_SMOKE` 값을 제거한다.
- `test:e2e:external-smoke` 단계를 release gate에서 제외한다.
- 생성된 test user/project/document/storage object를 cleanup script로 삭제한다.
- 외부 호출 실패는 unit/build/backend-required gate와 분리해 release 판정을 되돌린다.
