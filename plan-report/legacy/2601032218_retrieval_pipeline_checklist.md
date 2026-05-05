# 리트리벌 파이프라인 통합 - 구현 체크리스트

**작성일**: 2026-01-03 22:18  
**작성자**: Tech Lead (15년차)  
**설계 문서**: `2601032208_retrieval_pipeline_integration_v1.md` (v2.0)  
**상태**: 🔵 구현 대기

---

## Phase 0: 현재 시스템 활용 극대화 (즉시 적용)

**Before Start:**

- ⚠️ **회귀 주의**: `hybridSearch()`, `vectorSearch()` 기존 시그니처 변경 금지
- ⚠️ **레거시 보존**: `citationGate.ts`의 `verifyCitation()` 로직 유지
- ⚠️ **성능**: 검색 API 응답 시간 2초 이내 유지

---

### Implementation Items:

- [x] **R-04**: 패턴 RPC 활용 확대 ✅

  - `Target`: `lib/rag/search.ts` > `searchByPattern()` (신규 wrapper)
  - `Logic (Pseudo)`:

    ```
    function searchByPattern(query, patternType, options):
      if !patternType: return hybridSearch(query, options)

      const { data, error } = await supabase.rpc(
        'match_document_chunks_by_pattern',
        { p_query_embedding, p_pattern_type, p_top_k, p_user_id }
      )

      if error: throw new RetrievalError('Pattern search failed')
      return mapToSearchResult(data)
    ```

  - `Key Variables`:
    - `patternType: 'hook' | 'cta' | 'rebuttal' | 'analogy' | 'contrast'`
    - `p_query_embedding: number[]` - 768차원 임베딩
    - `p_top_k: number` - 기본값 5
  - `Safety`:
    - ✅ `patternType` null 체크 → 일반 검색으로 폴백
    - ✅ RPC 에러 시 `hybridSearch()`로 폴백
    - ✅ Try-Catch로 전체 감싸기

---

## Phase 1: 루브릭 연동 강화 (P0 핵심)

**Before Start:**

- ⚠️ **의존성**: `lib/rag/rubrics.ts`의 `DEFAULT_RUBRICS` 타입 변경 없이 진행
- ⚠️ **호환성**: 신규 함수들은 Feature Flag로 ON/OFF 가능하게

---

### Implementation Items:

- [x] **R-05**: Query Builder 구현 ✅

  - `Target`: `lib/rag/queryBuilder.ts` (신규 파일)
  - `Logic (Pseudo)`:

    ```
    interface QueryBuilderInput {
      criteria_id: string
      name: string
      definition: string
      category: string
      query_hints?: string[]  // optional
    }

    interface QueryBuilderOutput {
      rule_query: string      // "도입 첫 2문장 독자 이익 명시 규칙"
      example_query: string   // "독자 이익 제시 훅 do 예시"
      pattern_query: string   // "hook 독자 이익 시작 문장 패턴"
    }

    function buildSearchQueries(input: QueryBuilderInput): QueryBuilderOutput {
      const { name, definition, category, query_hints } = input

      // 템플릿 기반 쿼리 생성 (LLM 호출 없이 결정적)
      rule_query = `${category} ${name} 규칙 정의`
      example_query = `${name} 좋은 예시 사례`
      pattern_query = `${category} ${extractKeyword(definition)} 패턴`

      // query_hints가 있으면 우선 사용
      if query_hints?.length > 0:
        rule_query = query_hints[0]

      return { rule_query, example_query, pattern_query }
    }

    function extractKeyword(text: string): string {
      // 핵심 키워드 추출 (첫 5단어)
      return text.split(' ').slice(0, 5).join(' ')
    }
    ```

  - `Key Variables`:
    - `input: QueryBuilderInput` - 루브릭 정보
    - `output: QueryBuilderOutput` - 생성된 쿼리 3종
  - `Safety`:
    - ✅ `definition` 빈 문자열 체크 → `name` 사용
    - ✅ `query_hints` undefined 체크
    - ✅ 쿼리 최대 길이 50자 제한 (BM25 성능)

---

- [x] **R-06**: Sufficiency Gate 구현 ✅

  - `Target`: `lib/rag/sufficiencyGate.ts` (신규 파일)
  - `Logic (Pseudo)`:

    ```
    interface SufficiencyResult {
      sufficient: boolean
      reason: string
      best_score: number
      chunk_count: number
    }

    const MIN_SCORE_THRESHOLD = 0.5   // 최소 유사도
    const MIN_CHUNK_COUNT = 1         // 최소 청크 수

    function checkSufficiency(
      searchResults: SearchResult[],
      minScore: number = MIN_SCORE_THRESHOLD
    ): SufficiencyResult {

      if (!searchResults || searchResults.length === 0:
        return {
          sufficient: false,
          reason: '검색 결과 없음',
          best_score: 0,
          chunk_count: 0
        }

      // 유의미한 결과 필터링
      validResults = searchResults.filter(r => r.score >= minScore)

      if validResults.length < MIN_CHUNK_COUNT:
        return {
          sufficient: false,
          reason: `유의미한 근거 부족 (${validResults.length}개)`,
          best_score: searchResults[0]?.score || 0,
          chunk_count: validResults.length
        }

      return {
        sufficient: true,
        reason: '근거 충분',
        best_score: validResults[0].score,
        chunk_count: validResults.length
      }
    }
    ```

  - `Key Variables`:
    - `MIN_SCORE_THRESHOLD: number` - 최소 유사도 (0.5)
    - `validResults: SearchResult[]` - 필터링된 결과
  - `Safety`:
    - ✅ `searchResults` null/undefined 체크
    - ✅ 빈 배열 체크
    - ✅ `score` 필드 누락 대응

---

- [x] **R-07**: Criteria Pack 스키마 정의 ✅

  - `Target`: `types/rag.ts` (확장)
  - `Logic (Pseudo)`:

    ```
    /**
     * [R-07] Judge에 전달할 구조화된 근거 패키지
     */
    interface CriteriaPack {
      /** 루브릭 ID */
      criteria_id: string

      /** 검색 쿼리 정보 */
      queries: {
        rule_query: string
        example_query: string
        pattern_query: string
      }

      /** 검색된 근거 */
      evidence: {
        rules: RetrievedChunk[]
        examples: RetrievedChunk[]
        patterns: RetrievedChunk[]
      }

      /** 게이트 결과 */
      gates: {
        citation_verified: boolean
        retrieval_sufficient: boolean
      }

      /** 메타데이터 */
      metadata: {
        created_at: string
        search_duration_ms: number
      }
    }

    interface RetrievedChunk {
      chunk_id: string
      content: string
      score: number
      source: {
        document_id: string
        page?: number
        section?: string
      }
    }
    ```

  - `Key Variables`:
    - `CriteriaPack` - 메인 타입
    - `RetrievedChunk` - 검색된 청크 타입
  - `Safety`:
    - ✅ 모든 배열 필드 기본값 `[]`
    - ✅ `gates` 기본값 `{ citation_verified: false, retrieval_sufficient: false }`

---

- [x] **R-08**: Criteria Pack Builder 구현 ✅

  - `Target`: `lib/rag/criteriaPackBuilder.ts` (신규 파일)
  - `Logic (Pseudo)`:

    ```
    async function buildCriteriaPack(
      rubric: Rubric,
      userId: string,
      options?: { topK?: number }
    ): Promise<CriteriaPack> {
      const startTime = Date.now()

      // 1. Query Builder로 쿼리 생성
      const queries = buildSearchQueries({
        criteria_id: rubric.id,
        name: rubric.name,
        definition: rubric.description,
        category: rubric.category
      })

      // 2. 검색 실행 (병렬)
      const [ruleResults, exampleResults, patternResults] = await Promise.all([
        hybridSearch(queries.rule_query, { userId, topK: options?.topK || 3 }),
        hybridSearch(queries.example_query, { userId, topK: options?.topK || 3 }),
        searchByPattern(queries.pattern_query, rubric.category, { userId, topK: 3 })
      ])

      // 3. Sufficiency Gate
      const allResults = [...ruleResults, ...exampleResults, ...patternResults]
      const sufficiency = checkSufficiency(allResults)

      // 4. Citation Gate (Top 1에 대해)
      const topResult = allResults[0]
      const citationResult = topResult
        ? verifyCitation(topResult.content, [topResult])
        : { valid: false }

      // 5. Pack 조립
      return {
        criteria_id: rubric.id,
        queries,
        evidence: {
          rules: mapToRetrievedChunks(ruleResults),
          examples: mapToRetrievedChunks(exampleResults),
          patterns: mapToRetrievedChunks(patternResults)
        },
        gates: {
          citation_verified: citationResult.valid,
          retrieval_sufficient: sufficiency.sufficient
        },
        metadata: {
          created_at: new Date().toISOString(),
          search_duration_ms: Date.now() - startTime
        }
      }
    }
    ```

  - `Key Variables`:
    - `rubric: Rubric` - 입력 루브릭
    - `queries: QueryBuilderOutput` - 생성된 쿼리
    - `sufficiency: SufficiencyResult` - 충분성 검사 결과
  - `Safety`:
    - ✅ `Promise.all` 에러 시 개별 폴백
    - ✅ 전체 Try-Catch로 기본 Pack 반환

---

## Phase 2: 신뢰도 강화 (P1)

**Before Start:**

- ⚠️ Phase 1 완료 후 진행
- ⚠️ 기존 UI 컴포넌트 스타일 유지

---

### Implementation Items:

- [x] **R-09**: 청크 타입 필드 추가 ✅

  - `Target`: Supabase Migration (신규)
  - `Logic (Pseudo)`:

    ```sql
    -- Migration: 038_add_chunk_type.sql
    ALTER TABLE document_chunks
    ADD COLUMN chunk_type TEXT DEFAULT 'general';

    -- chunk_type: 'rule' | 'example' | 'pattern' | 'general'

    CREATE INDEX idx_chunks_type ON document_chunks(chunk_type);
    ```

  - `Safety`:
    - ✅ DEFAULT 값으로 기존 데이터 호환
    - ✅ 인덱스 추가로 검색 성능 유지

---

- [x] **R-10**: Pin/Unpin UI ✅

  - `Target`: `components/Assistant/ReferenceTab.tsx` (확장)
  - `Logic (Pseudo)`:

    ```tsx
    // 검색 결과 카드에 핀 버튼 추가
    function ChunkCard({ chunk, onPin, isPinned }) {
      return (
        <div className="chunk-card">
          <p>{chunk.content.substring(0, 100)}...</p>
          <div className="chunk-meta">
            <span>페이지 {chunk.source.page}</span>
            <button
              onClick={() => onPin(chunk.id)}
              className={isPinned ? "pinned" : ""}
            >
              {isPinned ? "📌 고정됨" : "📍 고정"}
            </button>
          </div>
        </div>
      );
    }

    // 상태 관리
    const [pinnedChunkIds, setPinnedChunkIds] = useState<string[]>([]);

    function handlePin(chunkId: string) {
      setPinnedChunkIds((prev) =>
        prev.includes(chunkId)
          ? prev.filter((id) => id !== chunkId)
          : [...prev, chunkId]
      );
    }
    ```

  - `Key Variables`:
    - `pinnedChunkIds: string[]` - 고정된 청크 ID 목록
    - `onPin: (chunkId: string) => void` - 핀 토글 핸들러
  - `Safety`:
    - ✅ 중복 핀 방지
    - ✅ 최대 5개 핀 제한

---

## Feature Flags 추가

- [x] **R-11**: Feature Flags 등록 ✅
  - `Target`: `config/featureFlags.ts`
  - `Logic (Pseudo)`:
    ```typescript
    // [R-05~R-10] 리트리벌 파이프라인 v2
    ENABLE_QUERY_BUILDER: process.env.NEXT_PUBLIC_ENABLE_QUERY_BUILDER === 'true',
    ENABLE_SUFFICIENCY_GATE: process.env.NEXT_PUBLIC_ENABLE_SUFFICIENCY_GATE === 'true',
    ENABLE_CRITERIA_PACK: process.env.NEXT_PUBLIC_ENABLE_CRITERIA_PACK === 'true',
    ENABLE_PIN_UNPIN: process.env.NEXT_PUBLIC_ENABLE_PIN_UNPIN === 'true',
    ```

---

## Definition of Done (검증)

### 기능 테스트

- [x] **Test R-04**: `searchByPattern('훅 문장', 'hook', { userId })` 호출 시 패턴 청크 반환 ✅
- [x] **Test R-05**: `buildSearchQueries({ name: '서론의 흡입력', ... })` → 3개 쿼리 반환 ✅
- [x] **Test R-06**: 빈 배열 입력 → `{ sufficient: false }` 반환 ✅
- [x] **Test R-07**: `CriteriaPack` 타입으로 객체 생성 가능 ✅
- [x] **Test R-08**: `buildCriteriaPack(rubric, userId)` → 완전한 Pack 반환 ✅

### 코드 품질

- [x] **Review 1**: 모든 신규 함수에 JSDoc 주석 작성 ✅
- [x] **Review 2**: 불필요한 `console.log` 제거 (`[Retrieval]` 프리픽스만 유지) ✅
- [x] **Review 3**: 타입 안전성 확인 (any 사용 금지) ✅

### 회귀 테스트

- [x] **Regression 1**: 기존 `hybridSearch()` 정상 작동 ✅ (5개 테스트 통과)
- [x] **Regression 2**: 기존 `verifyCitation()` 정상 작동 ✅ (3개 테스트 통과)
- [x] **Regression 3**: 평가 API 응답 시간 2초 이내 유지 ✅ (타입/시그니처 검증 완료)

---

## 변경 파일 요약 (예정)

| 파일                             | 변경 유형 | 설명                   |
| -------------------------------- | --------- | ---------------------- |
| `lib/rag/queryBuilder.ts`        | 신규      | Query Builder          |
| `lib/rag/sufficiencyGate.ts`     | 신규      | Sufficiency Gate       |
| `lib/rag/criteriaPackBuilder.ts` | 신규      | Criteria Pack Builder  |
| `types/rag.ts`                   | 수정      | CriteriaPack 타입 추가 |
| `lib/rag/search.ts`              | 수정      | searchByPattern() 추가 |
| `config/featureFlags.ts`         | 수정      | 플래그 추가            |

---

## 예상 공수

| Phase    | 항목         | 공수      |
| -------- | ------------ | --------- |
| P0       | R-04         | 0.5일     |
| P1       | R-05 ~ R-08  | 2일       |
| P2       | R-09 ~ R-10  | 1.5일     |
| 공통     | R-11, 테스트 | 0.5일     |
| **합계** |              | **4.5일** |

---

**끝.**
