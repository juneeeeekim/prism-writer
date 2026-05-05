# Error Log Schema V2 Decision

## 배경/문제 정의

현재 error-log는 파일 기반 JSONL로 동작하며 `category/severity/domain/operation/requestId/userIdHash` 중심이다. AGENTS 기준은 `timestamp`, `level`, `source`, `feature`, `event`, `request_id`, `user_id_hash`, `error_code`, `external_provider`를 요구한다. 기존 로그와 조회 API 호환성을 유지하면서 운영 검색성을 높일 설계가 필요하다.

## 옵션 A: v1 유지 + 부족 필드만 optional 추가

- 비용: Low
- 리스크: Low
- 소요 시간: 1~2일
- 롤백 난이도: Low

## 옵션 B: v2 schema 병행 저장

- 비용: Medium
- 리스크: Medium
- 소요 시간: 3~5일
- 롤백 난이도: Medium

## 옵션 C: DB/외부 로그 수집기로 이전

- 비용: High
- 리스크: Medium-High. 외부 의존성과 비용이 생긴다.
- 소요 시간: 1~2주
- 롤백 난이도: High

## 추천안과 근거

추천은 옵션 A 후 B다. 파일 저장은 best-effort fallback이 이미 있어 안정적이다. 먼저 `error_code`, `feature`, `event`, `external_provider`를 optional로 추가해 호환성을 유지하고, 충분히 수집된 뒤 v2 contract를 고정한다.

## 결정 시 실행 체크리스트

- 로그 v2 contract 확정: 필수/선택 필드, level/source enum.
- `ErrorLogInput`과 `ErrorLogEntry`에 optional v2 필드 추가.
- `/api/admin/error-log` query에 date range, feature, error_code 필터 추가.
- 성공 조회 audit log 유지.
- 기존 v1 JSONL read 호환 테스트 추가.
- 운영 문서에 로그 저장 실패 fallback과 보존 기간 명시.

## 영향 범위

- `frontend/src/lib/error-log/**`
- `frontend/src/app/api/admin/error-log/route.ts`
- 로그 조회 UI 또는 운영 스크립트

## 롤백 계획

필드 추가형으로만 진행한다. 문제가 있으면 v2 필드 write만 중단하고 v1 read/write는 그대로 유지한다.
