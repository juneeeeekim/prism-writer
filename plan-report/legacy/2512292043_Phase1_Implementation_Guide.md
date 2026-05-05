# 🟠 Phase 1: RAG 기반 계층 재정비 - 구현 지시서

> **문서 유형**: Tech Lead Implementation Guide  
> **생성일**: 2025-12-29 20:43  
> **원본 설계**: [Phase1 체크리스트](./2512290313_Phase1_RAG_Foundation_Checklist.md)  
> **마스터 플랜**: [Architecture Refactoring Master Plan](./2512290307_Architecture_Refactoring_Master_Plan.md)  
> **선행 조건**: Phase 0 완료 ✅  
> **목표**: RAG 시스템을 "부가 기능"에서 "기반 계층"으로 재배치  
> **예상 소요**: 4~6시간

---

## ⚠️ Before Start - 주의사항

### 절대 건드리지 말 것 (레거시 보호)

| 파일                                          | 이유                                    |
| --------------------------------------------- | --------------------------------------- |
| `lib/rag/search.ts` > `hybridSearch()`        | Phase 0에서 안정화됨, RRF 알고리즘 유지 |
| `lib/judge/alignJudge.ts`                     | 평가 로직 Phase 3에서 확장 예정         |
| `components/Editor/HolisticFeedbackPanel.tsx` | null safety 이미 적용됨                 |
| `supabase/migrations/202512290*`              | Phase 0에서 이미 적용된 마이그레이션    |

### 회귀 테스트 필수 포인트 ✅ **VERIFIED (2025-12-29 20:48)**

```
[회귀 체크] P0 수정사항 유지 확인 → ALL PASS
───────────────────────────────────────────────────────────────────────
search.ts:210      ───▶  chunkId: item.id  ✅ (P0-01-D Fix 유지됨)
search.ts:252      ───▶  chunkId: item.id  ✅ (P0-01-D Fix 유지됨)
search.ts:275      ───▶  chunkId: item.id  ✅ (P0-01-D Fix 유지됨)
```

> 📝 **Note**: [P0-01-D Fix] 주석도 정상적으로 유지됨

---

## 📋 Phase 1.1: 데이터 모델 정리

### P1-01: `rag_chunks` 테이블 스키마 확정

**담당**: DB 엔지니어  
**우선순위**: 🔴 Critical

---

- [x] **P1-01-A**: 현재 스키마 조회 및 문서화 ✅ **COMPLETED (2025-12-29 20:50)**

  - `Target`: Supabase SQL Editor
  - `Result`: **12개 컬럼 확인됨** (마이그레이션 파일보다 5개 추가됨)

---

- [x] **P1-01-B**: 스키마 문서 ✅ **DOCUMENTED**

  ### `rag_chunks` 테이블 스키마 (실제 Supabase)

  | 컬럼                 | 타입        | NULL | 기본값                     | 분류         |
  | -------------------- | ----------- | ---- | -------------------------- | ------------ |
  | `id`                 | UUID        | NO   | `gen_random_uuid()`        | ✅ 필수      |
  | `document_id`        | UUID        | NO   | -                          | ✅ 필수 (FK) |
  | `chunk_index`        | INTEGER     | NO   | -                          | ✅ 필수      |
  | `content`            | TEXT        | NO   | -                          | ✅ 필수      |
  | `embedding`          | VECTOR      | YES  | -                          | ✅ 필수      |
  | `metadata`           | JSONB       | YES  | `'{}'::jsonb`              | ✅ 필수      |
  | `created_at`         | TIMESTAMPTZ | NO   | `now()`                    | ✅ 필수      |
  | `embedding_model_id` | TEXT        | NO   | `'text-embedding-3-small'` | ⚠️ 추가됨    |
  | `embedding_dim`      | INTEGER     | NO   | `1536`                     | ⚠️ 추가됨    |
  | `embedded_at`        | TIMESTAMPTZ | NO   | `now()`                    | ⚠️ 추가됨    |
  | `tenant_id`          | UUID        | YES  | -                          | ⚠️ 추가됨    |
  | `chunk_type`         | ENUM        | YES  | `'general'`                | ⚠️ 추가됨    |

  > 📝 **Note**: 마이그레이션 파일(7개)보다 실제 스키마(12개)가 더 확장됨
  >
  > - 추가된 5개: `embedding_model_id`, `embedding_dim`, `embedded_at`, `tenant_id`, `chunk_type`

---

### P1-02: `user_documents` 테이블 스키마 확정

**담당**: DB 엔지니어  
**우선순위**: 🟠 High

---

- [x] **P1-02-A**: 현재 스키마 조회 ✅ **COMPLETED (2025-12-29 20:53)**

  - `Target`: Supabase SQL Editor
  - `Result`: **16개 컬럼 확인됨**

  ### `user_documents` 테이블 스키마 (실제 Supabase)

  | 컬럼            | 타입        | NULL | 기본값              | 분류         |
  | --------------- | ----------- | ---- | ------------------- | ------------ |
  | `id`            | UUID        | NO   | `gen_random_uuid()` | ✅ 필수      |
  | `user_id`       | UUID        | NO   | -                   | ✅ 필수 (FK) |
  | `title`         | TEXT        | NO   | `'제목 없음'`       | ✅ 필수      |
  | `content`       | TEXT        | NO   | `''`                | ✅ 필수      |
  | `created_at`    | TIMESTAMPTZ | YES  | `now()`             | ✅ 필수      |
  | `updated_at`    | TIMESTAMPTZ | YES  | `now()`             | ✅ 필수      |
  | `category`      | TEXT        | NO   | `'미분류'`          | ⚠️ 선택      |
  | `sort_order`    | INTEGER     | NO   | `0`                 | ⚠️ 선택      |
  | `metadata`      | JSONB       | YES  | `'{}'::jsonb`       | ⚠️ 선택      |
  | `source`        | TEXT        | YES  | `'upload'`          | 📁 파일 관련 |
  | `file_path`     | TEXT        | YES  | -                   | 📁 파일 관련 |
  | `file_type`     | TEXT        | YES  | -                   | 📁 파일 관련 |
  | `status`        | TEXT        | YES  | `'pending'`         | 🔄 처리 상태 |
  | `error_message` | TEXT        | YES  | -                   | 🔄 처리 상태 |
  | `file_size`     | BIGINT      | YES  | -                   | 📁 파일 관련 |
  | `started_at`    | TIMESTAMPTZ | YES  | -                   | 🔄 처리 상태 |

  > 📝 **분류 요약**:
  >
  > - ✅ 필수 (6개): id, user_id, title, content, created_at, updated_at
  > - 📁 파일 관련 (4개): source, file_path, file_type, file_size
  > - 🔄 처리 상태 (3개): status, error_message, started_at
  > - ⚠️ 선택 (3개): category, sort_order, metadata

---

### P1-03: RPC 함수 `match_document_chunks` 계약 고정

**담당**: 백엔드 개발자  
**우선순위**: 🔴 Critical (API 계약)

---

- [x] **P1-03-A**: 현재 RPC 반환 타입 확인 ✅ **VERIFIED (Phase 0: 2025-12-29 20:14)**

  - `Target`: Supabase SQL Editor
  - `Result`: **확인됨**
    ```
    TABLE(id uuid, document_id uuid, content text, metadata jsonb, similarity double precision)
    ```
  - `Safety`: 확인만, 변경 금지 ✅

---

- [x] **P1-03-B**: TypeScript 계약 인터페이스 추가 ✅ **ADDED (2025-12-29 20:55)**

  - `Target`: `frontend/src/types/rag.ts`
  - `Result`: ✅ **추가 완료**
    - `MatchDocumentChunksParams` 인터페이스
    - `MatchDocumentChunksResult` 인터페이스
  - `Verification`: ✅ `npm run build` Exit code: 0

---

### P1-04: TypeScript 타입과 DB 스키마 동기화

**담당**: 프론트엔드 개발자  
**우선순위**: 🟠 High

---

- [x] **P1-04-A**: `RagChunk` 인터페이스 추가 ✅ **ADDED**

  - `Target`: `frontend/src/types/rag.ts`
  - `Result`: ✅ **추가 완료** (12개 컴럼 동기화)

---

- [x] **P1-04-B**: `UserDocument` 인터페이스 추가 ✅ **ADDED**

  - `Target`: `frontend/src/types/rag.ts`
  - `Result`: ✅ **추가 완료** (16개 컬럼 동기화)

---

## 📋 Phase 1.2: RLS 정책 체계화

### P1-05: `user_documents` RLS 정책 검토

**담당**: DB 엔지니어 + 보안 엔지니어  
**우선순위**: 🟠 High

---

- [x] **P1-05-A**: 현재 RLS 정책 조회 ✅ **VERIFIED (2025-12-29 20:59)**

  - `Target`: Supabase SQL Editor
  - `Result`: **8개 정책 발견** (예상 4개보다 많음 - 중복 존재)

  | cmd    | 정책 수 | 상태    |
  | ------ | ------- | ------- |
  | SELECT | 2개     | ⚠️ 중복 |
  | INSERT | 2개     | ⚠️ 중복 |
  | UPDATE | 2개     | ⚠️ 중복 |
  | DELETE | 2개     | ⚠️ 중복 |

  > 📝 **Note**: 모든 정책이 `auth.uid() = user_id` 조건을 사용. 기능상 문제 없음.
  > ⚠️ **Recommendation**: 향후 중복 정책 정리 권장 (Phase 2+)

---

### P1-06: `rag_chunks` RLS 정책 검토

**담당**: DB 엔지니어 + 보안 엔지니어  
**우선순위**: 🟠 High (Phase 0에서 적용됨)

---

- [x] **P1-06-A**: 현재 RLS 정책 확인 ✅ **VERIFIED (2025-12-29 21:01)**

  - `Target`: Supabase SQL Editor
  - `Result`: **6개 정책 확인됨** (Phase 0 예상과 일치 ✅)

  | cmd    | 정책 수 | 참조 테이블                       |
  | ------ | ------- | --------------------------------- |
  | SELECT | 2개     | `user_documents`, `rag_documents` |
  | INSERT | 2개     | `user_documents`, `rag_documents` |
  | DELETE | 2개     | `user_documents`, `rag_documents` |

  > 📝 **Note**: JOIN 기반 검증 사용 (`EXISTS` 서브쿼리)
  >
  > - `user_documents` 참조: 현재 활성 정책
  > - `rag_documents` 참조: 레거시 정책 (향후 정리 대상)

---

### P1-07: RLS 테스트 케이스 작성

**담당**: QA 엔지니어  
**우선순위**: 🟡 Medium

---

- [x] **P1-07-A**: 테스트 시나리오 실행 ✅ **VERIFIED (Phase 0 E2E)**

  - `Target`: Browser > http://localhost:3000
  - `Result`: **Phase 0 E2E 테스트에서 확인됨**
    - ✅ 로그인 → 본인 문서만 표시
    - ✅ 참고자료 탭 → 본인 문서만 조회 가능
    - ✅ RLS 서버 적용 확인 (Supabase)

  > 📝 **Note**: Phase 0 E2E 테스트 결과 참조 (2025-12-29 20:25)

---

## 📋 Phase 1.3: API 계층 정리

### P1-08: `/api/documents/process` 문서화

**담당**: 백엔드 개발자  
**우선순위**: 🟡 Medium

---

- [x] **P1-08-A**: API 흐름 문서화 ✅ **ALREADY DOCUMENTED (2025-12-29 21:03)**

  - `Target`: `frontend/src/app/api/documents/process/route.ts`
  - `Result`: **이미 잘 문서화되어 있음** (123 lines)

  ### API 흐름 (현재 구현)

  ```
  1. 사용자 인증 확인    → auth.getUser() → 401 UNAUTHORIZED
  2. Request Body 검증  → documentId 필수 → 400 BAD_REQUEST
  3. 문서 조회 + IDOR 방지 → user_id = userId → 404 NOT_FOUND
  4. 중복 처리 방지     → status 체크 (Idempotency)
  5. 문서 처리 실행     → processDocument(documentId, file_path, userId, file_type)
  6. 성공 응답         → { success: true, message, result }
  ```

  > 📝 **Note**: 코드에 이미 6단계 주석 블록 존재. 추가 문서화 불필요.

---

### P1-09: `/api/rag/*` 엔드포인트 계약 정의

**담당**: 백엔드 개발자 + 프론트엔드 개발자  
**우선순위**: 🟠 High

---

- [x] **P1-09-A**: API 표준 응답 타입 정의 ✅ **CREATED (2025-12-29 21:04)**

  - `Target`: `frontend/src/types/api.ts` (신규)
  - `Result`: **91줄 생성 완료**
    - `ErrorCodes` 상수 (7개 에러 코드)
    - `ApiResponse<T>` 타입
    - `ApiError` 인터페이스
    - `ErrorHttpStatus` 매핑
  - `Verification`: ✅ `npm run build` Exit code: 0

---

### P1-10: 에러 핸들링 패턴 통일

**담당**: 백엔드 개발자  
**우선순위**: 🟡 Medium

---

- [x] **P1-10-A**: 공통 에러 핸들러 생성 ✅ **CREATED (2025-12-29 21:04)**

  - `Target`: `frontend/src/lib/api/errorHandler.ts` (신규)
  - `Result`: **112줄 생성 완료**
    - `handleApiError()` 함수
    - `createErrorResponse()` 헬퍼
    - `createSuccessResponse()` 헬퍼
    - 유틸리티: `unauthorizedResponse()`, `forbiddenResponse()`, `notFoundResponse()`, `badRequestResponse()`
  - `Verification`: ✅ `npm run build` Exit code: 0

---

## ✅ Definition of Done (검증) - **ALL PASS ✅**

### 필수 완료 조건

| #   | 항목                                 | 검증 방법                  | 상태        |
| --- | ------------------------------------ | -------------------------- | ----------- |
| 1   | `rag_chunks` 스키마 문서화           | 12개 컬럼 문서화           | ✅ (21:01)  |
| 2   | `user_documents` 스키마 문서화       | 16개 컬럼 문서화           | ✅ (21:01)  |
| 3   | RPC 계약 TypeScript 타입 추가        | `rag.ts`에 인터페이스 존재 | ✅ (20:55)  |
| 4   | `RagChunk`, `UserDocument` 타입 추가 | `rag.ts`에 인터페이스 존재 | ✅ (20:55)  |
| 5   | RLS 정책 테스트 통과                 | Phase 0 E2E 확인           | ✅ (P0 E2E) |
| 6   | `npm run build` 성공                 | Exit code: 0               | ✅ (21:04)  |

### 코드 품질 체크

- [x] 새 타입에 JSDoc 주석 추가
- [x] `@frozen` 또는 `@version` 태그로 API 계약 표시
- [x] 불필요한 console.log 없음

---

## 📊 실제 소요 시간 (완료)

| 작업                          | 예상         | 실제      | 상태                |
| ----------------------------- | ------------ | --------- | ------------------- |
| P1-01, P1-02: 스키마 확인     | 30분         | ~10분     | ✅ (20:50-21:01)    |
| P1-03, P1-04: 타입 정의       | 1시간        | ~5분      | ✅ (20:54-20:55)    |
| P1-05, P1-06, P1-07: RLS 검토 | 1시간        | ~5분      | ✅ (21:00-21:02)    |
| P1-08, P1-09, P1-10: API 정리 | 2시간        | ~5분      | ✅ (21:03-21:04)    |
| **총계**                      | **~4-5시간** | **~25분** | ✅ **Phase 1 완료** |

> 📝 **Note**: 예상보다 빠르게 완료됨 - 기존 코드가 잘 구조화되어 있어 문서화/타입 추가만 필요함

---

## 🚀 다음 단계

Phase 1 완료 후 → [Phase 2: Template Builder 구조 도입](./2512290319_Phase2_Template_Builder_Checklist.md)
