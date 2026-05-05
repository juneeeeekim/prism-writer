# Codebase Structure Refactor Decision

## 배경/문제 정의

프로젝트는 App Router API, Supabase server/client helper, LLM/RAG service, admin UI가 섞여 있다. 최근 빌드 차단 원인은 client component가 server-only 모듈을 import한 구조였다. 전면 구조 정리는 생산성을 높일 수 있지만 대규모 이동은 import 경로와 RSC 경계를 깨뜨릴 수 있다.

## 옵션 A: 경계 규칙만 문서화하고 신규 파일에 적용

- 비용: Low
- 리스크: Low
- 소요 시간: 0.5~1일
- 롤백 난이도: Low

## 옵션 B: server-only/client-safe 유틸을 점진 분리

- 비용: Medium
- 리스크: Low-Medium
- 소요 시간: 3~6일
- 롤백 난이도: Medium

## 옵션 C: 디렉터리 전면 재배치

- 비용: High
- 리스크: High. import, tests, route ownership이 크게 흔들린다.
- 소요 시간: 1~3주
- 롤백 난이도: High

## 추천안과 근거

추천은 옵션 B다. 이번에 `resultMetadata`처럼 client-safe 타입/순수 유틸을 분리한 패턴을 반복 적용한다. 전면 재배치는 새 기능 보호보다 리스크가 크다.

## 결정 시 실행 체크리스트

- server-only 후보 목록 작성: `next/headers`, Supabase server, LLM gateway, file system.
- client-safe 후보 목록 작성: type, pure formatter, URL/domain helper.
- import boundary lint 또는 test 추가 검토.
- 모듈별 1개씩 점진 이동.
- 각 이동 후 `tsc`, `lint`, `test`, `build`.
- 문서화: client component import 금지 목록.

## 영향 범위

- `frontend/src/lib/**`
- `frontend/src/components/**`
- `frontend/src/hooks/**`
- build/RSC 경계

## 롤백 계획

모듈 단위 이동만 허용한다. 문제가 생기면 해당 모듈 import만 이전 경로로 되돌린다. 대규모 rename/move는 별도 승인 전까지 하지 않는다.
