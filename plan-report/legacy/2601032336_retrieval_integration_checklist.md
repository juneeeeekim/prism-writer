# 리트리벌 파이프라인 v2 통합 - 구현 체크리스트

**작성일**: 2026-01-03 23:36  
**작성자**: Tech Lead (15년차)  
**설계 문서**: `implementation_plan.md`  
**상태**: 🔵 구현 대기

---

## Phase 1: Chat API 통합 (P0 - 핵심)

**Before Start:**

- ⚠️ **회귀 주의**: `ragPromise` 내부의 기존 `hybridSearch()` 호출 로직 절대 삭제 금지 (else 분기로 보존)
- ⚠️ **레거시 보존**: `enableQueryExpansion` 분기 로직 유지 (ENABLE_CRITERIA_PACK과 독립적)
- ⚠️ **성능**: TTFT 2초 이내 유지 확인 필요 (기존 로그 `[Chat API] TTFT:` 활용)

---

### Implementation Items:

- [x] **I-01**: Import 문 추가 ✅

  - `Target`: `app/api/chat/route.ts` > 상단 import 영역
  - `Logic (Pseudo)`:
    ```
    import { buildSearchQueries } from '@/lib/rag/queryBuilder'
    import { checkSufficiency } from '@/lib/rag/sufficiencyGate'
    ```
  - `Key Variables`: N/A
  - `Safety`: ✅ 단순 import, 부작용 없음

---

- [x] **I-02**: 중복 제거 헬퍼 함수 추가 ✅

  - `Target`: `app/api/chat/route.ts` > `ragPromise` 상단 (함수 외부)
  - `Logic (Pseudo)`:
    ```typescript
    function deduplicateByChunkId(results: SearchResult[]): SearchResult[] {
      const seen = new Set<string>();
      return results.filter((r) => {
        if (seen.has(r.chunkId)) return false;
        seen.add(r.chunkId);
        return true;
      });
    }
    ```
  - `Key Variables`:
    - `seen: Set<string>` - 이미 본 chunkId 집합
  - `Safety`: ✅ 순수 함수, 부작용 없음

---

- [x] **I-03**: ENABLE_CRITERIA_PACK 분기 추가 ✅

  - `Target`: `app/api/chat/route.ts` > `ragPromise` 내부 > `try` 블록 최상단
  - `Logic (Pseudo)`:

    ```
    if FEATURE_FLAGS.ENABLE_CRITERIA_PACK:
      // [NEW] Query Builder를 통한 3개 쿼리 생성
      queries = buildSearchQueries({
        criteria_id: 'chat-query',
        name: query,
        definition: query,
        category: 'general'
      })

      log('[Chat API] Criteria Pack mode - 3 queries generated')

      // 3개 쿼리 병렬 검색 (각각 topK=3)
      searchOptions = { userId, topK: 3, projectId, minScore: 0.35 }

      [ruleResults, exampleResults, patternResults] = await Promise.all([
        hybridSearch(queries.rule_query, searchOptions).catch(() => []),
        hybridSearch(queries.example_query, searchOptions).catch(() => []),
        hybridSearch(queries.pattern_query, searchOptions).catch(() => []),
      ])

      allResults = [...ruleResults, ...exampleResults, ...patternResults]
      uniqueResults = deduplicateByChunkId(allResults)
        .sort((a, b) => b.score - a.score)
        .slice(0, 5)

      // Sufficiency Gate
      sufficiency = checkSufficiency(uniqueResults)
      log(`[Chat API] Sufficiency: ${sufficiency.sufficient}, ${sufficiency.reason}`)

      if uniqueResults.length > 0:
        context = uniqueResults.map((r, i) =>
          `[참고 자료 ${i+1}: ${r.metadata?.title || 'Untitled'}]\n${r.content}`
        ).join('\n\n')
        return { context, hasRetrievedDocs: true, uniqueResults }

      // 폴백: 결과 없으면 기존 로직으로

    // [EXISTING] 기존 로직 유지 (else 없이 fall-through)
    ```

  - `Key Variables`:
    - `queries: QueryBuilderOutput` - 생성된 3개 쿼리
    - `ruleResults, exampleResults, patternResults: SearchResult[]` - 각 검색 결과
    - `allResults: SearchResult[]` - 병합된 결과
    - `uniqueResults: SearchResult[]` - 중복 제거된 최종 결과
    - `sufficiency: SufficiencyResult` - 충분성 검사 결과
  - `Safety`:
    - ✅ `hybridSearch` 각각에 `.catch(() => [])` 필수 (개별 실패 허용)
    - ✅ `uniqueResults.length > 0` 체크 후 반환
    - ✅ 결과 없으면 기존 로직으로 fall-through

---

- [x] **I-04**: 로그 프리픽스 통일 ✅

  - `Target`: `app/api/chat/route.ts` > 새로 추가된 로그
  - `Logic (Pseudo)`:
    ```
    // 모든 로그는 [Chat API] 프리픽스 사용
    console.log(`[Chat API] Criteria Pack mode - 3 queries generated`)
    console.log(`[Chat API] Sufficiency: ${...}`)
    ```
  - `Key Variables`: N/A
  - `Safety`: ✅ 디버깅용 로그, 프로덕션에서 유지

---

## Definition of Done (검증)

### 기능 테스트

- [~] **Test I-01**: 환경 변수 `NEXT_PUBLIC_ENABLE_CRITERIA_PACK=true` 설정 후 채팅 ⏳ (수동 확인 필요)

  - 예상 로그: `[Chat API] Criteria Pack mode - 3 queries generated`
  - 예상 로그: `[Chat API] Sufficiency: true, 근거 충분` (문서 있을 때)

- [x] **Test I-02**: 채팅 기본 기능 테스트 ✅ (AI 응답 정상)

  - 기존 로직 동작 확인 (Query Expansion 또는 Legacy Mode)

- [~] **Test I-03**: 문서 없는 사용자로 채팅 ⏳ (수동 확인 필요)
  - 예상 로그: `[Chat API] Sufficiency: false, 검색 결과 없음`

### 회귀 테스트

- [x] **Regression 1**: 로그인 없이 접근 → 401 반환 ✅ (curl 테스트 확인)
- [x] **Regression 2**: 세션 ID 있을 때 메시지 저장 정상 ✅ (브라우저 테스트 확인)
- [x] **Regression 3**: TTFT < 2000ms 유지 ✅ (콘솔 로그 확인 - 워믄업 후 정상)

### 코드 품질

- [x] **Review 1**: `[Retrieval]` 또는 `[Chat API]` 프리픽스 로그만 유지 ✅
- [x] **Review 2**: 불필요한 `console.log` 제거 ✅ (디버그 로그 제거됨)
- [x] **Review 3**: 새 코드에 주석 추가 (`// [I-03] ENABLE_CRITERIA_PACK 분기`) ✅

---

## Phase 2: Evaluation API 통합 (P2 - 선택)

**Before Start:**

- ⚠️ Phase 1 완료 및 검증 후 진행
- ⚠️ `AlignJudge` 로직 변경 없이 입력 데이터만 확장

---

### Implementation Items:

- [x] **I-05**: evaluate-holistic에 Sufficiency 결과 포함 ✅
  - `Target`: `app/api/rag/evaluate-holistic/route.ts`
  - `Logic (Pseudo)`:
    ```
    // 기존 평가 후 sufficiency 정보 추가
    response.metadata.retrieval_sufficiency = sufficiencyResult
    ```
  - `Safety`: ✅ 기존 응답 구조에 메타데이터만 추가

---

## Phase 3: UI 통합 (P3 - 선택)

**Before Start:**

- ⚠️ Phase 1, 2 완료 후 진행
- ⚠️ `ReferenceTab.tsx` 기존 검색 결과 표시 로직 유지

---

### Implementation Items:

- [x] **I-06**: Pin/Unpin 상태 관리 추가 ✅
  - `Target`: `components/Assistant/ReferenceTab.tsx`
  - `Key Variables`:
    - `pinnedChunkIds: string[]` - useState로 관리
  - `Safety`: ✅ 최대 5개 핀 제한 로직 필수

---

## 변경 파일 요약

| 파일                                     | 변경 유형 | 변경 줄 수 |
| ---------------------------------------- | --------- | ---------- |
| `app/api/chat/route.ts`                  | 수정      | ~40줄 추가 |
| `app/api/rag/evaluate-holistic/route.ts` | 수정 (P2) | ~10줄 추가 |
| `components/Assistant/ReferenceTab.tsx`  | 수정 (P3) | ~50줄 추가 |

---

## 예상 공수

| Phase    | 항목                        | 공수        |
| -------- | --------------------------- | ----------- |
| P1       | Chat API 통합 (I-01 ~ I-04) | 1시간       |
| P2       | Eval API 통합 (I-05)        | 30분        |
| P3       | UI 통합 (I-06)              | 2시간       |
| **합계** |                             | **3.5시간** |

---

**끝.**
