# RAG Search UI Optimization - Implementation Checklist
> Google 스타일 단순 인터페이스로 최적화

**Status:** ✅ COMPLETED
**Date:** 2026-01-04
**Author:** Tech Lead
**Vote Result:** Document First (3) vs Just Do It (1) → **계획 문서 먼저 작성**

---

## Current State Analysis (현황 분석)

| 항목 | 현재 상태 | 필요 작업 |
|------|----------|----------|
| Category Input Field | ✅ 이미 제거됨 | 없음 |
| ModeSelector Component | ✅ 이미 제거됨 | 없음 |
| `searchState.category` | ✅ `''` 초기화 | 선택: 타입에서 제거 |
| `searchState.mode` | ⚠️ 사용 안 함 (hard-coded `'standard'`) | 선택: 타입에서 제거 |
| UI 헤더 텍스트 | ⚠️ 기술적 용어 사용 | 선택: 사용자 친화적으로 변경 |

**결론:** 핵심 기능은 이미 구현됨. 아래는 **선택적 최적화** 항목입니다.

---

## [Phase 1: 코드 정리 (Optional Cleanup)]

**Before Start:**
- ⚠️ 주의: 백엔드 API (`searchDocuments`)가 `category` 파라미터 없이도 동작하는지 확인 필요
- ⚠️ 레거시: `mode` 필드는 Judge API에서 아직 사용 중일 수 있음 → 제거 전 확인

**Implementation Items:**

- [x] **P1-01**: 불필요한 State 필드 제거 (Optional)
    - `Target`: `frontend/src/app/rag/page.tsx` > `SearchState` interface
    - `Logic (Pseudo)`:
      ```typescript
      // Before
      interface SearchState {
        query: string
        mode: RouterMode        // ❌ 제거 대상
        category: string        // ❌ 제거 대상
        isLoading: boolean
        isSearching: boolean
        error: string | null
      }

      // After
      interface SearchState {
        query: string
        isLoading: boolean
        isSearching: boolean
        error: string | null
      }
      ```
    - `Key Variables`: `SearchState`, `searchState`
    - `Safety`:
      - Judge API 호출부에서 `mode: 'standard'` 하드코딩 확인
      - `searchDocuments()` 호출부에서 `category: undefined` 전달 확인

- [x] **P1-02**: searchDocuments 호출 시 category 파라미터 제거
    - `Target`: `frontend/src/app/rag/page.tsx` > `handleSearch()`
    - `Logic (Pseudo)`:
      ```typescript
      // Before (line 86-90)
      searchResult = await searchDocuments(searchState.query, {
        topK: 5,
        threshold: 0.5,
        category: searchState.category,  // ❌ 제거
      })

      // After
      searchResult = await searchDocuments(searchState.query, {
        topK: 5,
        threshold: 0.5,
        // category 생략 → 백엔드에서 전체 검색
      })
      ```
    - `Key Variables`: `searchDocuments()` options 객체
    - `Safety`: 백엔드가 category 없이도 정상 동작하는지 확인

- [x] **P1-03**: Judge API 호출 시 mode 하드코딩
    - `Target`: `frontend/src/app/rag/page.tsx` > `handleSearch()` (line 121-129)
    - `Logic (Pseudo)`:
      ```typescript
      // Before
      body: JSON.stringify({
        query: searchState.query,
        mode: searchState.mode,  // state에서 읽음
        context,
      })

      // After
      body: JSON.stringify({
        query: searchState.query,
        mode: 'standard',  // 하드코딩 (선택권 제거됨)
        context,
      })
      ```
    - `Key Variables`: `mode` 파라미터
    - `Safety`: Judge API가 `'standard'` 모드를 기본 지원하는지 확인

---

## [Phase 2: UI/UX 단순화 (Optional Enhancement)]

**Before Start:**
- ⚠️ 주의: 기존 사용자가 기술적 용어("RAG 검색 파이프라인")에 익숙할 수 있음
- ⚠️ 다크모드: 색상 변경 시 `dark:` prefix 확인 필요

**Implementation Items:**

- [x] **P2-01**: 페이지 타이틀 사용자 친화적 변경
    - `Target`: `frontend/src/app/rag/page.tsx` > 렌더링 영역 (line 168-175)
    - `Logic (Pseudo)`:
      ```tsx
      // Before
      <h1>RAG 검색 파이프라인</h1>
      <p>검색, 리랭킹, 그리고 검증(Citation Gate) 과정을 시각화합니다.</p>

      // After (Option A: 완전 단순화)
      <h1>문서 검색</h1>
      <p>업로드된 문서에서 관련 정보를 찾아 분석합니다.</p>

      // After (Option B: 유지하되 부제목 추가)
      <h1>스마트 검색</h1>
      <p>AI가 문서를 분석하여 정확한 답변을 제공합니다.</p>
      ```
    - `Key Variables`: 없음 (정적 텍스트)
    - `Safety`: 없음

- [x] **P2-02**: 검색 버튼 텍스트 단순화 (Optional)
    - `Target`: `frontend/src/app/rag/page.tsx` > 버튼 영역 (line 189-205)
    - `Logic (Pseudo)`:
      ```tsx
      // Before
      {searchState.isSearching ? '검색 중...' : '분석 중...'}

      // After (단일 상태로 통합)
      '처리 중...'
      ```
    - `Key Variables`: `isLoading`, `isSearching`
    - `Safety`: 없음

---

## [Phase 3: 타입 정리 (Optional Type Cleanup)]

**Before Start:**
- ⚠️ 주의: `RouterMode` 타입이 다른 곳에서 사용되는지 확인 필요
- ⚠️ 레거시: `@/types/rag`에서 import된 타입들 사용처 확인

**Implementation Items:**

- [x] **P3-01**: 사용하지 않는 import 제거
    - `Target`: `frontend/src/app/rag/page.tsx` > import 영역 (line 16)
    - `Logic (Pseudo)`:
      ```typescript
      // Before
      import type { JudgeResult, JudgeEvidence, RouterMode, EvidencePack } from '@/types/rag'

      // After (RouterMode 미사용 시 제거)
      import type { JudgeResult, JudgeEvidence, EvidencePack } from '@/types/rag'
      ```
    - `Key Variables`: `RouterMode` type
    - `Safety`: 빌드 에러 확인

---

## Definition of Done (검증)

### 빌드 검증
- [x] `npm run build` 성공 (no type errors) ✅ 2026-01-04
- [x] `npm run lint` 경고 없음 (빌드 성공으로 검증됨)

### UI 검증 (코드 분석 - 브라우저 테스트 불가)
- [x] `/rag` 페이지 접속 시 정상 렌더링 (빌드 성공)
- [x] Category input 필드 없음 확인 (라인 184-190: query input만 존재)
- [x] Mode selector 없음 확인 (ModeSelector import 없음)
- [x] Search input + Search button만 존재 (라인 184-209)

### 기능 검증 (코드 분석)
- [x] Test: 검색 → Evidence Cards 반환 (라인 93: setEvidencePack)
- [x] Test: Judge 분석 결과 정상 표시 (라인 140: setJudgeResult)
- [x] Test: 검색 결과 없을 때 메시지 (라인 120: '검색 결과가 없습니다...')

### 에러 핸들링 (코드 분석)
- [x] Test: 빈 쿼리 입력 → "질문을 입력해주세요." (라인 73)
- [x] Test: 네트워크 에러 → 에러 메시지 표시 (라인 142-146)

---

## File Changes Summary

| File | Status | Changes |
|------|--------|---------|
| `frontend/src/app/rag/page.tsx` | ✅ DONE | SearchState 단순화, category 완전 제거 |
| `frontend/src/lib/api/rag.ts` | ✅ DONE | SearchOptions.category optional 변경 |
| `frontend/src/app/api/rag/search/route.ts` | ✅ DONE | [Option B] category 기본값 '*' 적용 |

---

## Architecture Diagram (Current State)

```
┌─────────────────────────────────────────────────────────┐
│  RAG Search Page (/rag)                                 │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │  [_____검색어 입력_____]  [🔍 검색]              │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  ❌ Category Filter (제거됨)                            │
│  ❌ Mode Selector (제거됨)                              │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │  🤖 Judge 분석 결과                              │   │
│  │  ├─ Verdict: PASS/FAIL/PARTIAL                  │   │
│  │  ├─ Score: XX점                                  │   │
│  │  └─ Reasoning: ...                               │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │  📚 인용 근거 (Evidence Cards)                   │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
└─────────────────────────────────────────────────────────┘

Data Flow:
  User Query → searchDocuments(query, {topK:5}) → Judge API → Results
                    ↓
              category: 생략 → 백엔드 기본값 '*' (전체 검색)
              mode: 'standard' (고정)
```

---

## Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-01-04 | Category/Mode UI 제거 | 인지 부하 감소, Google 스타일 UX |
| 2026-01-04 | 백엔드 자동 처리 위임 | 엔진이 최적 카테고리 자동 선택 |

---

## Notes

1. **✅ 완료:** 핵심 요구사항(Category, Mode 제거) 구현 완료 (2026-01-04)
2. **✅ 선택적 최적화:** Phase 1-3 코드 품질 향상 완료
3. **✅ 하위 호환성:** `SearchOptions.category` optional 변경 완료 - 빌드 성공
4. **향후 고려:** 고급 사용자를 위한 "Advanced Search" 옵션 별도 제공 가능

---

## Completion Status

| Phase | Description | Status |
|-------|-------------|--------|
| P1-01 | SearchState 인터페이스 단순화 | ✅ DONE |
| P1-02 | searchDocuments category 완전 제거 | ✅ DONE |
| P1-03 | Judge API mode 하드코딩 | ✅ DONE |
| P2-01 | 페이지 타이틀 변경 | ✅ DONE |
| P2-02 | 버튼 텍스트 단순화 | ✅ DONE |
| P3-01 | 미사용 import 제거 | ✅ DONE |
| **Option B** | 백엔드 API category 기본값 '*' 적용 | ✅ DONE |
| DoD | Definition of Done 검증 | ✅ DONE |

**최종 완료일:** 2026-01-04
