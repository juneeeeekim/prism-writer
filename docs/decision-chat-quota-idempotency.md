# Chat Quota And Idempotency Decision

## 배경/문제 정의

`/api/chat`은 quota 차감, LLM 비용 발생, 사용자/assistant 메시지 저장을 한 요청 안에서 처리한다. 현재는 LLM 호출 전에 `check_and_increment_monthly_questions` RPC를 실행하고, `Idempotency-Key`나 request hash 저장소가 없어 중복 클릭, 네트워크 재시도, 스트림 실패에서 중복 차감 또는 중복 LLM 비용이 발생할 수 있다.

## 옵션 A: 현행 유지 + UI 중복 제출 방어만 강화

- 비용: Low
- 리스크: Medium-High. 서버 재시도와 cross-tab 중복을 막지 못한다.
- 소요 시간: 0.5~1일
- 롤백 난이도: Low

## 옵션 B: 성공 후 차감 모델

- 비용: Medium
- 리스크: Medium. LLM 성공 후 저장/차감 순서 실패 케이스를 새로 정의해야 한다.
- 소요 시간: 2~4일
- 롤백 난이도: Medium

## 옵션 C: reservation/commit idempotency 모델

- 비용: High
- 리스크: Low-Medium. 설계는 복잡하지만 비용/사용량 정합성이 가장 좋다.
- 소요 시간: 5~8일
- 롤백 난이도: Medium-High

## 추천안과 근거

추천은 옵션 C다. chat은 비용과 사용량을 동시에 다루는 side effect API이므로 `Idempotency-Key`, `request_hash`, `reservation`, `commit/rollback`, TTL을 가진 서버 저장소가 필요하다. 단, DB schema와 RPC 계약이 바뀌므로 자동 실행하지 않는다.

## 결정 시 실행 체크리스트

- Phase 0 API 계약 작성: endpoint, request header, duplicate response, body mismatch 409, error code.
- DB migration 작성: `chat_idempotency_keys` 또는 동등 테이블, unique key, TTL, response snapshot.
- RPC 보안 보강: `auth.uid()` 강제, 다른 user_id 차감 금지.
- quota race 보강: conditional update, transaction, lock 중 하나 선택.
- `/api/chat` Provider 구현: reserve -> LLM -> message save -> commit.
- Caller 구현: client-generated idempotency key 전송, 중복 submit guard 유지.
- Contract/unit/integration test 추가: duplicate, mismatch, timeout, retry, LLM fail, save fail.
- Rollback script 준비: 새 table disable, route에서 idempotency guard bypass.

## 영향 범위

- `frontend/src/app/api/chat/route.ts`
- `frontend/src/hooks/useChat.ts`
- `supabase/migrations/*`
- `chat_messages`, usage limit RPC, assistant session 저장 흐름

## 롤백 계획

새 idempotency 경로를 feature flag로 감싼다. 문제가 생기면 flag를 끄고 기존 quota RPC 경로로 되돌린다. DB migration은 테이블 추가형으로 설계하고 기존 테이블을 변경하지 않는다.
