# PRISM Writer - Chat Quota Idempotency Decision
> **문서 ID:** 2605052005-CQ  
> **작성일:** 2026-05-05  
> **작성자:** Codex Orchestrator  
> **상태:** 사용자 결정 필요  
> **대상:** `/api/chat` quota 차감, LLM 비용, 메시지 저장 멱등성  

---

## 1. 전문가 의견 및 투표

| 전문가 | 한 줄 자기소개 | 의견 |
|---|---|---|
| API 계약 전문가 | 비용이 발생하는 side effect API의 caller/provider 계약과 멱등성을 검토한다. | `Idempotency-Key`와 서버 저장소 없이는 중복 클릭/재시도에서 중복 차감 가능성이 남는다. |
| 보안/운영 로그 전문가 | 민감정보 노출 없이 request id, error code, 사용량 이벤트를 추적 가능하게 설계한다. | quota 차감, LLM 호출, 메시지 저장은 각각 request id와 안전 로그로 연결해야 한다. |
| QA/SRE 전문가 | 회귀 방지와 실제 연동 검증을 release gate로 분리한다. | chat external-smoke는 idempotency/fixture/cleanup 확정 전까지 기본 gate에 넣으면 안 된다. |

투표 결과: **옵션 C 3표 / 옵션 A 0표 / 옵션 B 0표**  
합의안: **reservation/commit idempotency 모델을 추천하되, DB/RPC 계약 변경이므로 자동 실행하지 않는다.**

---

## 2. 배경 / 문제 정의

현재 `/api/chat`은 한 요청 안에서 다음 side effect를 수행한다.

- 월간 질문 quota 확인 및 증가 RPC
- 사용자 메시지 저장
- RAG/search/LLM stream 호출
- assistant 메시지 저장
- session update

현재 구조는 LLM 호출 전에 `check_and_increment_monthly_questions` RPC를 실행한다. `Idempotency-Key` 또는 request hash 저장소가 없으면 중복 클릭, 브라우저 재시도, 네트워크 끊김, stream 중간 실패에서 중복 차감이나 중복 LLM 비용이 발생할 수 있다.

---

## 3. 옵션 A/B/C

| 옵션 | 내용 | 비용 | 리스크 | 소요 시간 | 롤백 난이도 |
|---|---|---:|---|---:|---|
| A | 현재 선차감 RPC 유지, UI 중복 submit guard만 강화 | 낮음 | 서버 재시도/네트워크 중복에 취약 | 0.5일 | 낮음 |
| B | LLM 성공 후 quota 차감으로 순서 변경 | 낮음~중간 | 저장 성공/차감 실패 시 무료 사용 또는 정합성 문제 | 1~2일 | 중간 |
| C | reservation/commit/rollback + idempotency key 저장소 도입 | 중간 | 설계/마이그레이션 필요, 그러나 정합성 가장 높음 | 3~5일 | 중간 |

---

## 4. 추천안과 근거

추천은 **옵션 C**다.

근거:
- chat은 비용이 발생하는 LLM 호출과 사용자 quota 차감이 결합된 side effect API다.
- HTTP 재시도, 중복 클릭, tab reload, stream 실패는 정상 운영에서도 발생한다.
- UI guard만으로는 서버 재시도와 네트워크 단절을 막을 수 없다.
- reservation/commit 모델은 실패 시 rollback 또는 만료 처리를 정의할 수 있어 quota 정합성과 비용 통제에 가장 유리하다.

---

## 5. 결정 시 실행 체크리스트

- [ ] Phase 0 API 계약 작성: `Idempotency-Key` header 필수/선택 정책, response snapshot 정책, status code matrix 확정
- [ ] DB migration 작성: `chat_idempotency_keys` 또는 동등 테이블 추가
- [ ] Unique key 정의: `user_id + idempotency_key`
- [ ] Request hash 저장: 같은 key로 다른 body가 오면 `409 IDEMPOTENCY_CONFLICT`
- [ ] Reservation 상태 정의: `reserved`, `committed`, `failed`, `expired`
- [ ] TTL/cleanup 정책 정의: 오래된 reservation 자동 만료
- [ ] RPC 보안 보강: `auth.uid()` 기반 사용자 검증, 클라이언트 제공 `user_id` 신뢰 금지
- [ ] quota reserve RPC 구현: 한도 확인과 reservation 생성 원자화
- [ ] quota commit/rollback RPC 구현: LLM 성공/실패/stream failure 처리
- [ ] `/api/chat` provider 변경: reserve -> LLM stream -> assistant save -> commit 순서로 재구성
- [ ] caller 변경: client-generated idempotency key 전송 및 중복 submit guard 유지
- [ ] contract test 추가: duplicate same key, same key different body, stream failure, retry after success
- [ ] external-smoke 확장 여부 결정: test user, cleanup, cost cap 확정 후 진행

---

## 6. 영향 범위

- `frontend/src/app/api/chat/route.ts`
- chat session/message 저장 흐름
- quota RPC 또는 신규 DB 함수
- Supabase migration
- chat caller/client fetch
- external-smoke 테스트 범위
- 관리자 사용량/운영 로그가 있다면 집계 기준

---

## 7. Rollback 계획

- 새 idempotency 경로는 feature flag로 감싼다.
- 문제가 발생하면 flag를 끄고 기존 quota RPC 경로로 되돌린다.
- migration은 기존 테이블 변경보다 신규 테이블 추가 방식으로 설계한다.
- rollback 시 신규 idempotency table은 읽지 않도록 route에서 우회하고, 데이터는 TTL 후 정리한다.

---

## 8. 지금 자동 실행하지 않은 이유

이 작업은 DB schema, RPC, caller/provider 계약, 비용 정책이 함께 바뀐다. 따라서 현재 요청의 자동 실행 기준인 “가역적이고 회귀 위험이 낮은 표준 작업”에 해당하지 않는다. 옵션 선택 후 위 체크리스트 순서대로 별도 Phase로 진행하는 것이 안전하다.
