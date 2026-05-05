# API Error Format Standardization — Phase 0~3 실행 리포트

> **문서 ID:** 2605052300
> **작성일:** 2026-05-05
> **작성자:** 기술 리더 + API 계약 설계 엔지니어
> **상태:** Phase 0~3 완료, Phase 4 (legacy route 마이그레이션)는 별도 세션 필요
> **연관 결정 문서:** `docs/decision-api-error-format-standardization.md` (옵션 A+C 채택)

---

## 1. 인벤토리 결과 (현재 상태)

총 **약 60개** API route 분석 결과:

| Shape | 개수 | 비율 |
|---|---|---|
| A: `{ error: '...' }` | 10 | 16% |
| A+: `{ error: 'CODE', message: '...' }` | 9 | 15% |
| B: `{ success: false, error: '...', message? }` | 25 | 41% |
| **C (canonical): `{ success: false, error: { code, message, requestId, details? } }`** | **6** | **10%** |
| D: `{ success: false, message }` (error 키 없음) | 5 | 8% |
| 혼합 (한 파일에 여러 shape) | 6 | 10% |

기존 Shape C 6개는 `createRequestId()`와 `errorResponse()` 헬퍼를 각자 중복 정의하고 있었음.

---

## 2. 본 세션에서 적용한 변경

### 신규 파일

- **`frontend/src/lib/api/error.ts`** — Provider 측 canonical helper
  - `ErrorCode` enum (10개): UNAUTHORIZED, FORBIDDEN, BAD_REQUEST, NOT_FOUND, CONFLICT, UNPROCESSABLE, RATE_LIMITED, PROCESSING_FAILED, INTERNAL_ERROR, SERVICE_UNAVAILABLE
  - `ErrorBody<TDetails>` 타입
  - `createRequestId(prefix)` — prefix 커스터마이즈 가능
  - `getRequestId(request, prefix)` — `x-request-id` 헤더 우선 사용
  - `errorResponse(status, code, message, requestId, details?)` — NextResponse 래퍼

- **`frontend/src/lib/api/parseError.ts`** — Caller 측 통합 parser
  - `parseApiError(body, status)` — Shape A/A+/B/C/D 모두 파싱 후 통일된 `ParsedApiError` 반환
  - `looksLikeCode()` 헬퍼로 `'CODE_NAME'` vs `'사람용 메시지'` 자동 분기

- **`frontend/src/lib/api/__tests__/parseError.test.ts`** — 11개 단위 테스트

### 통합 대상 (5개 route, breaking change 0)

각 파일에서 중복 정의되어 있던 `interface ErrorBody` + `createRequestId()` + `errorResponse()`를 `@/lib/api/error` import로 교체:

- `frontend/src/app/api/admin/error-log/route.ts`
- `frontend/src/app/api/admin/llm-costs/route.ts`
- `frontend/src/app/api/admin/llm-experiments/route.ts`
- `frontend/src/app/api/admin/llm-performance/route.ts`
- `frontend/src/app/api/user/model-preference/route.ts`

요청별 prefix는 유지 (`errlog`, `costs`, `expr`, `perf`, `mpref`).

### 통합 제외 대상

- `frontend/src/app/api/documents/process/handler.ts` — flat shape `{ success, error: 'CODE', message, requestId }` 사용 중. 단위 테스트가 이 shape를 assertion으로 잡고 있어 통합 시 breaking change 발생. **다른 wire shape이라 별도 마이그레이션 필요**.

---

## 3. 검증 결과

| 검증 | 결과 |
|---|---|
| `npx tsc --noEmit` | ✅ Pass |
| `npm run lint` | ✅ No warnings or errors |
| `npm run test` | ✅ 16 files / 132 passed / 1 skipped (이전 121 → +11 새 테스트) |

---

## 4. 다음 단계 (별도 세션)

| Phase | 작업 | 이유로 본 세션 제외 |
|---|---|---|
| **4** | `documents/process/handler.ts`를 canonical shape으로 마이그레이션 | 기존 caller(`useDocuments`)와 테스트가 flat shape 가정 — 동시 변경 필요 |
| **5** | Shape D 5개 route를 canonical로 마이그레이션 | breaking change 위험. caller inventory 후 진행 |
| **6** | Shape A/A+/B 다수 route 점진 마이그레이션 | endpoint 단위로 commit, contract test 추가 후 진행 |
| **7** | `useChat`, `useDocuments` 등 hook에 `parseApiError` 도입 | 모든 hook의 fetch error 처리 통일 |
| **8** | `doc/api-specification.md`에 canonical shape 명문화 + status code matrix | |

---

## 5. canonical schema 명문화

### Wire Format

```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED" | "FORBIDDEN" | "BAD_REQUEST" | "NOT_FOUND" | "CONFLICT" | "UNPROCESSABLE" | "RATE_LIMITED" | "PROCESSING_FAILED" | "INTERNAL_ERROR" | "SERVICE_UNAVAILABLE",
    "message": "사용자에게 노출 가능한 메시지",
    "requestId": "errlog_1730821234567_abc123de",
    "details": { ... }   // optional, 추가 컨텍스트
  }
}
```

### Status Code Matrix

| Code | HTTP | 의미 |
|---|---|---|
| `UNAUTHORIZED` | 401 | 미인증 |
| `FORBIDDEN` | 403 | 권한 부족 (admin/tier 미달) |
| `BAD_REQUEST` | 400 | 입력 검증 실패 |
| `NOT_FOUND` | 404 | 리소스 없음 |
| `CONFLICT` | 409 | 동시성/중복 충돌 (idempotency body mismatch 등) |
| `UNPROCESSABLE` | 422 | 의미적 검증 실패 |
| `RATE_LIMITED` | 429 | quota 초과 |
| `PROCESSING_FAILED` | 500 | 외부 처리 실패 (LLM/parser 등) |
| `INTERNAL_ERROR` | 500 | 일반 서버 오류 |
| `SERVICE_UNAVAILABLE` | 503 | 외부 의존성 장애 |

### 사용 예 (Provider)

```ts
import { createRequestId, errorResponse } from '@/lib/api/error'

export async function GET(request: NextRequest) {
  const requestId = createRequestId('chat')
  // ...
  if (!user) return errorResponse(401, 'UNAUTHORIZED', '로그인이 필요합니다.', requestId)
  // ...
}
```

### 사용 예 (Caller)

```ts
import { parseApiError } from '@/lib/api/parseError'

const response = await fetch('/api/...')
if (!response.ok) {
  const body = await response.json().catch(() => null)
  const err = parseApiError(body, response.status)
  // err.code, err.message, err.requestId 사용
}
```
