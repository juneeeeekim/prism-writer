# API Error Format Standardization Decision

## 배경/문제 정의

현재 API error 응답은 `{ error }`, `{ success:false, error, message }`, `{ success:false, error:{ code, message, requestId } }`가 섞여 있다. Caller가 endpoint별로 다른 파서를 가져야 하며, contract test와 운영 추적성이 약해진다.

## 옵션 A: 신규/관리자 API부터 점진 적용

- 비용: Low-Medium
- 리스크: Low. 기존 public caller 영향이 작다.
- 소요 시간: 1~2일
- 롤백 난이도: Low

## 옵션 B: 모든 API 일괄 표준화

- 비용: High
- 리스크: High. 기존 UI caller와 테스트가 동시에 깨질 수 있다.
- 소요 시간: 5~10일
- 롤백 난이도: High

## 옵션 C: v1 유지 + 공통 parser/adapter 도입

- 비용: Medium
- 리스크: Medium. Provider 표준화는 늦어지지만 Caller 회복력이 좋아진다.
- 소요 시간: 2~4일
- 롤백 난이도: Low-Medium

## 추천안과 근거

추천은 옵션 A와 C의 조합이다. Provider는 신규/관리자/고위험 API부터 `{ success:false, error:{ code, message, request_id, details? } }`로 맞추고, Caller에는 legacy shape를 읽는 parser를 먼저 둔다. 기존 API를 한 번에 바꾸면 breaking change가 크다.

## 결정 시 실행 체크리스트

- Phase 0 계약 작성: canonical error schema, status code matrix, error code enum.
- Phase F 영향 분석: 기존 caller inventory와 breaking change 후보 분류.
- `frontend/src/lib/api/error.ts` 공통 helper 작성.
- Caller parser 작성: canonical + legacy shape 모두 수용.
- 고위험 route부터 적용: admin, LLM, chat, documents save/upload.
- Contract test 추가: 400/401/403/404/409/422/429/500.
- API 문서 갱신: `doc/api-specification.md`.

## 영향 범위

- `frontend/src/app/api/**/route.ts`
- `frontend/src/lib/api/*`
- fetch caller가 있는 hooks/components
- API 문서와 E2E error assertion

## 롤백 계획

Provider 변경은 endpoint 단위로 커밋한다. 문제가 생긴 endpoint만 기존 response shape로 되돌리고, Caller parser는 legacy 호환을 유지한다.
