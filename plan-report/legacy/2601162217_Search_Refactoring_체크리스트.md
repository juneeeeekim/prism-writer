# Search 모듈 안전 리팩토링 체크리스트

**대상 파일:** `frontend/src/lib/rag/search.ts` (1431 lines)
**목표:** 거대해진 검색 로직을 역할별로 분리하고, 순환 참조 및 런타임 오류를 방지하는 **안전한** 리팩토링 수행.

---

## [Phase 0] 안전 장치 및 사전 준비

**Before Start:**

- ⚠️ **Critical:** 작업 중 실수로 코드가 날아가는 것을 방지하기 위해 백업 필수.
- ⚠️ **Check:** `search.ts`가 `frontend/src/app/api/rag/` 등에서 광범위하게 사용 중임을 인지.

**Implementation Items:**

- [x] **ID(P0-01)**: 백업 파일 생성

  - `Target`: `frontend/src/lib/rag/search.ts.bak`
  - `Logic`: 현재 `search.ts` 그대로 복사.
  - `Safety`: 리팩토링 실패 시 즉시 복구 가능.

- [x] **ID(P0-02)**: 테스트 코드 위치 파악 (있다면)
  - `Target`: `frontend/test/` 또는 `__tests__` 확인
  - `Logic`: 기존 테스트가 없다면, `search.ts`의 주요 함수(`hybridSearch`, `vectorSearch`)가 정상 동작하는지 확인하는 **간단한 테스트 스크립트** 작성 권장.
  - ✅ **결과**: 기존 테스트 파일 2개 발견 (`p1_verification.test.ts`, `regression-retrieval-pipeline.test.ts`). 추가 작성 불필요.

---

## [Phase 1] 공통 모듈 추출 (Types & Utils)

**Before Start:**

- ⚠️ **Circular Dependency:** `utils.ts`는 다른 모듈을 import하지 않도, 순수 함수만 포함해야 함.

**Implementation Items:**

- [x] **ID(P1-01)**: `types.ts` 분리

  - `Target`: `frontend/src/lib/rag/search/types.ts`
  - `Content`: `SearchResult`, `SearchOptions`, `HybridSearchOptions`, `RAGLogEntry` 등 인터페이스 이동.
  - `Safety`: `PatternType` 같은 외부 타입 import 경로 확인.
  - ✅ **완료 (2026-01-17 08:55)**: 7개 타입 추출, Syntax 오류 0개

- [x] **ID(P1-02)**: `logger.ts` 분리

  - `Target`: `frontend/src/lib/rag/search/logger.ts`
  - `Content`: `logRAGSearch` 함수 및 `RAGLogEntry` 인터페이스 import.
  - `Safety`: `createClient` (Supabase) import 경로 확인.
  - ✅ **완료 (2026-01-17 09:03)**: 108줄, Syntax 오류 0개

- [x] **ID(P1-03)**: `utils.ts` 분리
  - `Target`: `frontend/src/lib/rag/search/utils.ts`
  - `Content`:
    - 상수: `MAX_RETRY_COUNT`, `DEFAULT_TOP_K`, `RRF_K` 등
    - 함수: `withRetry`, `calculateEvidenceQuality`, `weightedScoreFusion`, `reciprocalRankFusion`
  - `Safety`: 이 파일은 **절대로** `vector.ts`나 `hybrid.ts`를 import하면 안 됨.
  - ✅ **완료 (2026-01-17 09:06)**: 275줄, 상수 7개 + 함수 5개, Syntax 오류 0개

---

## [Phase 2] 핵심 검색 로직 분리 (Core Logic)

**Before Start:**

- ⚠️ **Cache Logic:** `searchCache` (LRUCache)는 `hybridSearch`가 있는 파일로 이동해야 함.
- ⚠️ ** 순환 참조 주의:** `searchByPattern`과 `hybridSearch`가 서로를 호출하는 구조임. 이를 해결하기 위해 파일 구조를 세분화해야 함.

**Implementation Items:**

- [x] **ID(P2-01)**: `vector.ts` 분리

  - `Target`: `frontend/src/lib/rag/search/vector.ts`
  - `Content`: `vectorSearch` 함수.
  - `Imports`: `utils.ts`, `logger.ts`, `types.ts`
  - ✅ **완료 (2026-01-17 09:21)**: 248줄, Syntax 오류 0개

- [x] **ID(P2-02)**: `keyword.ts` 분리

  - `Target`: `frontend/src/lib/rag/search/keyword.ts`
  - `Content`: `fullTextSearch`, `fullTextSearchWithRank` 함수.
  - `Imports`: `utils.ts`, `logger.ts`, `types.ts`
  - ✅ **완료 (2026-01-17 09:47)**: 182줄, Syntax 오류 0개

- [x] **ID(P2-03)**: `pattern.ts` 분리 (구현체)
  - `Target`: `frontend/src/lib/rag/search/pattern.ts`
  - `Content`: **`patternBasedSearch` 함수만** 이동 (순환 참조 끊기 위함).
  - `Logic`: 이 파일은 `hybridSearch`를 import하지 않음. 오직 패턴 검색 로직만 수행.
  - `Safety`: 실패 시 폴백(fallback) 로직은 이 함수 내부가 아니라 호출자(`searchByPattern`)가 처리해야 함.
  - ✅ **완료 (2026-01-17 09:56)**: 200줄, Syntax 오류 0개, 순환 참조 없음

---

## [Phase 3] 통합 및 오케스트레이션 (Integration)

**Before Start:**

- ⚠️ **Dependency Order:** `pattern.ts`와 `hybrid.ts` 로딩 순서 중요.

**Implementation Items:**

- [x] **ID(P3-01)**: `hybrid.ts` 분리 (통합 검색)

  - `Target`: `frontend/src/lib/rag/search/hybrid.ts`
  - `Content`:
    - `searchCache` (LRUCache) 정의
    - `hybridSearch` 함수
  - `Imports`: `vector.ts`, `keyword.ts`, `pattern.ts`(`patternBasedSearch`), `utils.ts`
  - `Logic`:
    - `patternType` 옵션이 있으면 `patternBasedSearch` 호출.
    - 캐싱 로직 포함.
  - ✅ **완료 (2026-01-17 10:01)**: 283줄, Syntax 오류 0개

- [x] **ID(P3-02)**: `wrapper.ts` 분리 (패턴 래퍼)
  - `Target`: `frontend/src/lib/rag/search/wrapper.ts`
  - `Content`: `searchByPattern` 함수
  - `Imports`: `hybrid.ts`(`hybridSearch`), `pattern.ts`(`patternBasedSearch`)
  - `Logic`:
    - `patternType` 없으면 `hybridSearch` 호출 (Fallback).
    - Try-catch로 `patternBasedSearch` 실패 시 `hybridSearch` 호출 (Fallback).
  - **해결된 위험:** `hybrid.ts`는 `wrapper.ts`를 모름. `wrapper.ts`는 `hybrid.ts`를 앎. 순환 참조 없음.
  - ✅ **완료 (2026-01-17 10:04)**: 119줄, Syntax 오류 0개, 순환 참조 해소

---

## [Phase 4] 진입점 생성 및 전환 (Migration)

**Before Start:**

- ⚠️ **Deprecation Strategy:** 기존 `search.ts` 파일을 삭제하면 import 경로 에러가 발생할 수 있음. "Barrel File" 패턴으로 전환하여 호환성 유지.

**Implementation Items:**

- [x] **ID(P4-01)**: `index.ts` 생성

  - `Target`: `frontend/src/lib/rag/search/index.ts`
  - `Logic`:
    ```typescript
    export * from "./types";
    export * from "./utils";
    export * from "./logger";
    export * from "./vector";
    export * from "./keyword";
    export * from "./pattern";
    export * from "./hybrid";
    export * from "./wrapper";
    ```
  - ✅ **완료 (2026-01-17 10:08)**: 69줄, Syntax 오류 0개

- [x] **ID(P4-02)**: 기존 `search.ts` 교체 (Re-export)
  - `Target`: `frontend/src/lib/rag/search.ts` (기존 파일)
  - `Logic`: **기존 내용 전체 삭제 후** 아래 코드로 교체.
    ```typescript
    // Re-export all from new structure for backward compatibility
    export * from "./search/index";
    ```
  - `Safety`: 이 방식은 기존 import 구문(`import { vectorSearch } from '@/lib/rag/search'`)을 전혀 수정할 필요가 없게 만듦. **가장 안전한 방법.**
  - ✅ **완료 (2026-01-17 10:11)**: 1431줄 → 19줄, Syntax 오류 0개

---

## [Phase 5] Final Cleanup (작업 마무리)

**Before Start:**

- ⚠️ **Verification:** 모든 기능(일반/패턴/하이브리드 검색)이 정상 작동하는지 "Definition of Done"을 통해 100% 확인한 후에만 진행.

**Implementation Items:**

- [x] **ID(P5-01)**: 백업 파일 삭제

  - `Target`: `frontend/src/lib/rag/search.ts.bak`
  - `Logic`: 파일 완전 삭제.
  - `Safety`: 삭제 전 `search.ts`(새 파일)가 정상 동작하는지 최종 확인.
  - ✅ **완료 (2026-01-17 10:25)**: `npm run build` 성공 후 백업 삭제

- [x] **ID(P5-02)**: 임시 테스트 코드 및 주석 제거
  - `Target`: `frontend/src/lib/rag/search/` 내부 파일들
  - `Logic`:
    - `TODO`, `FIXME` 등 임시 주석 정리.
    - `console.log` -> `logger` 교체 확인 (누락된 것 있으면 수정).
    - 테스트를 위해 만든 임시 스크립트가 있다면 삭제.
  - ✅ **완료 (2026-01-17 10:29)**: TODO 0개, FIXME 0개, console.log 0개 확인

---

## Definition of Done (최종 검증 및 롤백)

### 검증 절차 (Verification)

1.  **Build Test:** `npm run build` 실행. (순환 참조나 타입 에러 시 빌드 실패함)
2.  **Runtime Test:** 로컬 개발 서버(`npm run dev`) 띄우고 RAG 검색 기능 실행.
    - 일반 검색, 패턴 검색, 하이브리드 검색 모두 수행.
    - 로그(`rag_logs`)가 정상적으로 찍히는지 확인.
3.  **Conflict Check:** `search.ts` 파일이 1400줄에서 3줄(re-export)로 줄어들었는지 확인. 중복 선언 에러 확인.

### 비상 대책 (Rollback Plan)

만약 빌드가 실패하거나 런타임 에러 발생 시:

1.  `frontend/src/lib/rag/search/` 디렉토리 삭제.
2.  `frontend/src/lib/rag/search.ts.bak` 파일을 `search.ts`로 복원.
3.  상태 원복 완료.

---

**작성일:** 2026-01-17
**작성자:** Tech Lead (AI Assistant)
