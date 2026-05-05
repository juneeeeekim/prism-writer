# Rubric Pipeline Implementation Checklist

## PRISM Writer - 루브릭 파이프라인 구현 체크리스트

| 항목      | 내용                                                |
| --------- | --------------------------------------------------- |
| 작성일    | 2026-01-03                                          |
| 기반 문서 | 2601031500_rubric_pipeline_integration_v1.md (v2.0) |
| 상태      | 구현 대기                                           |

---

## [Phase 0: 즉시 적용 - DB 스키마 및 기초 설정]

### Before Start:

- ⚠️ **회귀 테스트**: 기존 RAG 검색 기능이 정상 작동하는지 확인 필요
- ⚠️ **건드리지 말 것**: `search.ts`의 기존 `hybridSearch()` 로직
- ⚠️ **건드리지 말 것**: `templateGates.ts`의 기존 Gate 로직

---

### Implementation Items:

#### [x] **P0-01**: DB 스키마 수정 - `pattern_type` 컬럼 추가 ✅

- `Target`: `supabase/migrations/066_add_pattern_type_column.sql`
- `Logic (Pseudo)`:

  ```sql
  -- 1. rag_chunks 테이블에 pattern_type 컬럼 추가
  ALTER TABLE rag_chunks ADD COLUMN pattern_type TEXT;

  -- 2. 인덱스 생성 (검색 성능)
  CREATE INDEX idx_rag_chunks_pattern_type ON rag_chunks(pattern_type);

  -- 3. ENUM 값 정의 (constraint로 강제)
  ALTER TABLE rag_chunks ADD CONSTRAINT check_pattern_type
    CHECK (pattern_type IS NULL OR pattern_type IN (
      'hook', 'problem', 'cause', 'solution', 'evidence', 'cta',
      'metaphor', 'contrast', 'statistics', 'rebuttal', 'question', 'repetition'
    ));
  ```

- `Key Variables`: `pattern_type`
- `Safety`:
  - 기존 데이터에 영향 없음 (NULL 허용)
  - 마이그레이션 실패 시 롤백 가능

---

#### [x] **P0-02**: `rubrics.ts` 형식 중심 재설계 ✅

- `Target`: `frontend/src/lib/rag/rubrics.ts` > `DEFAULT_RUBRICS`, `RubricCategory`
- `Logic (Pseudo)`:

  ```typescript
  // 1. RubricCategory 확장
  export type RubricCategory =
    | 'structure'   // 구조
    | 'tone'        // 어투
    | 'persuasion'  // 설득 장치
    | 'rhythm'      // 리듬
    | 'trust'       // 신뢰 형성
    | 'cta'         // 행동 유도

  // 2. DEFAULT_RUBRICS 재정의 (형식 중심)
  // 기존 10개 → 새로운 12개 (카테고리별 2개)
  export const DEFAULT_RUBRICS: Rubric[] = [
    // structure (2개)
    { id: 'structure_hook', name: '도입 훅', category: 'structure', ... },
    { id: 'structure_flow', name: '논리 흐름', category: 'structure', ... },
    // tone (2개)
    { id: 'tone_consistency', name: '어투 일관성', category: 'tone', ... },
    { id: 'tone_authority', name: '전문성 어투', category: 'tone', ... },
    // persuasion (2개)
    { id: 'persuasion_contrast', name: '대비 활용', category: 'persuasion', ... },
    { id: 'persuasion_rebuttal', name: '반박 선제처리', category: 'persuasion', ... },
    // rhythm (2개)
    { id: 'rhythm_sentence', name: '문장 리듬', category: 'rhythm', ... },
    { id: 'rhythm_question', name: '질문 활용', category: 'rhythm', ... },
    // trust (2개)
    { id: 'trust_evidence', name: '근거 제시', category: 'trust', ... },
    { id: 'trust_limitation', name: '한계 인정', category: 'trust', ... },
    // cta (2개)
    { id: 'cta_specific', name: 'CTA 구체성', category: 'cta', ... },
    { id: 'cta_friction', name: '마찰 감소', category: 'cta', ... },
  ]
  ```

- `Key Variables`: `RubricCategory`, `DEFAULT_RUBRICS`
- `Safety`:
  - 기존 `RubricAdapter` 호환성 확인 필요
  - 카테고리 매핑 함수 업데이트 필요

---

#### [x] **P0-03**: Feature Flag 활성화 ✅

- `Target`: `frontend/src/config/featureFlags.ts` > `FEATURE_FLAGS`
- `Logic (Pseudo)`:

  ```typescript
  // 기존
  USE_TEMPLATE_FOR_CHAT: process.env.USE_TEMPLATE_FOR_CHAT === 'true',

  // 신규 추가
  ENABLE_PATTERN_EXTRACTION: process.env.ENABLE_PATTERN_EXTRACTION === 'true',
  ENABLE_PATTERN_BASED_SEARCH: process.env.ENABLE_PATTERN_BASED_SEARCH === 'true',
  ENABLE_RUBRIC_CANDIDATE_UI: process.env.ENABLE_RUBRIC_CANDIDATE_UI === 'true',
  ```

- `Key Variables`: `ENABLE_PATTERN_EXTRACTION`, `ENABLE_PATTERN_BASED_SEARCH`
- `Safety`: 기본값 `false` - 명시적 활성화 필요

---

#### [x] **P0-04**: 패턴 추출 LLM 프롬프트 설계 ✅

- `Target`: `frontend/src/lib/rag/patternExtractor.ts` (신규 파일)
- `Logic (Pseudo)`:

  ```typescript
  export async function extractPatterns(
    chunks: ChunkData[],
    options: {
      targetCount: number;
      patternScope: "script" | "lecture" | "both";
    }
  ): Promise<RuleCandidate[]> {
    // 1. 청크들을 프롬프트에 삽입
    const prompt = buildPatternExtractionPrompt(chunks, options);

    // 2. LLM 호출 (JSON 강제)
    const response = await generateStructuredJSON(prompt, {
      model: "gemini-3-flash-preview",
      responseSchema: RuleCandidateArraySchema,
    });

    // 3. 결과 검증 및 반환
    if (!response || response.length === 0) {
      throw new Error("Pattern extraction failed: empty response");
    }
    return response;
  }

  function buildPatternExtractionPrompt(chunks: ChunkData[], options): string {
    return `
    # 역할
    글쓰기 패턴 분석 전문가
    
    # 입력 청크
    ${chunks.map((c) => c.content).join("\n---\n")}
    
    # 추출할 패턴 유형
    - structure: 글의 구조 패턴
    - tone: 어투 스타일
    - persuasion: 설득 장치
    - rhythm: 문장 리듬
    - trust: 신뢰 형성
    - cta: 행동 유도
    
    # 출력 (JSON 배열, ${options.targetCount}개)
    [{ pattern_type, rule_text, why_it_works, query_hints, evidence_quote }]
    `;
  }
  ```

- `Key Variables`: `extractPatterns()`, `buildPatternExtractionPrompt()`, `RuleCandidate`
- `Safety`:
  - LLM 호출 실패 시 재시도 로직 (3회)
  - JSON 파싱 실패 시 에러 핸들링
  - 빈 응답 예외 처리

---

### Definition of Done (검증):

#### 기능 테스트:

- [x] **Test P0-01**: `SELECT pattern_type FROM rag_chunks LIMIT 1` - 에러 없이 실행 ✅ (수동 확인 완료)
- [x] **Test P0-02**: `getEnabledRubrics()` 호출 시 12개 항목 반환 ✅ (코드 확인)
- [x] **Test P0-03**: `FEATURE_FLAGS.ENABLE_PATTERN_EXTRACTION` 접근 가능 ✅
- [x] **Test P0-04**: `extractPatterns([mockChunk])` 호출 시 RuleCandidate[] 반환 ✅ (코드 확인)

#### 예외 처리:

- [x] **Exception P0-01**: 마이그레이션 실패 시 롤백 확인 ✅ (IF NOT EXISTS 사용)
- [x] **Exception P0-04**: LLM 응답 없을 때 에러 메시지 반환 ✅ (3회 재시도 로직)

#### 코드 품질:

- [x] **Review**: `// [PATTERN]` 주석 태그 확인 ✅ (19개 발견)
- [x] **Review**: TypeScript 타입 에러 없음 (빌드 성공) ✅

---

## [Phase 1: 품질 고정 - 패턴 기반 검색]

### Before Start:

- ⚠️ **선행 조건**: Phase 0 모든 항목 완료
- ⚠️ **건드리지 말 것**: `match_document_chunks` RPC (project_id 격리 유지)

---

### Implementation Items:

#### [x] **P1-01**: 패턴 태깅 서비스 구현 ✅

- `Target`: `frontend/src/lib/rag/patternTagger.ts` (신규 파일)
- `Logic (Pseudo)`:

  ```typescript
  export async function tagChunkWithPattern(
    chunkId: string,
    patternType: PatternType
  ): Promise<boolean> {
    if (!FEATURE_FLAGS.ENABLE_PATTERN_EXTRACTION) return false;

    const { error } = await supabase
      .from("rag_chunks")
      .update({ pattern_type: patternType })
      .eq("id", chunkId);

    if (error) {
      console.error("[PatternTagger] Failed to tag chunk:", chunkId, error);
      return false;
    }
    return true;
  }

  export async function batchTagChunks(
    tags: { chunkId: string; patternType: PatternType }[]
  ): Promise<{ success: number; failed: number }> {
    let success = 0,
      failed = 0;
    for (const tag of tags) {
      const result = await tagChunkWithPattern(tag.chunkId, tag.patternType);
      result ? success++ : failed++;
    }
    return { success, failed };
  }
  ```

- `Key Variables`: `tagChunkWithPattern()`, `batchTagChunks()`, `PatternType`
- `Safety`: Feature Flag 체크, 에러 시 false 반환

---

#### [x] **P1-02**: 패턴 기반 검색 쿼리 변환 ✅

- `Target`: `frontend/src/lib/rag/search.ts` > `hybridSearch()` 확장
- `Logic (Pseudo)`:

  ```typescript
  export async function hybridSearch(
    query: string,
    options: SearchOptions & { patternType?: PatternType }
  ): Promise<SearchResult[]> {
    // [PATTERN] 패턴 기반 검색 분기
    if (FEATURE_FLAGS.ENABLE_PATTERN_BASED_SEARCH && options.patternType) {
      return await patternBasedSearch(query, options);
    }

    // 기존 로직 유지
    return await legacyHybridSearch(query, options);
  }

  async function patternBasedSearch(
    query: string,
    options: SearchOptions & { patternType: PatternType }
  ): Promise<SearchResult[]> {
    // pattern_type 필터가 포함된 RPC 호출
    const { data } = await supabase.rpc("match_document_chunks_by_pattern", {
      query_embedding: embedding,
      pattern_type_param: options.patternType,
      project_id_param: options.projectId,
      // ... 기타 파라미터
    });
    return mapToSearchResults(data);
  }
  ```

- `Key Variables`: `patternType`, `patternBasedSearch()`, `match_document_chunks_by_pattern`
- `Safety`:
  - Feature Flag 체크
  - `patternType` 없으면 기존 로직 사용

---

#### [x] **P1-03**: 패턴 기반 RPC 추가 ✅

- `Target`: `supabase/migrations/067_add_pattern_search_rpc.sql`
- `Logic (Pseudo)`:

  ```sql
  CREATE FUNCTION match_document_chunks_by_pattern (
    query_embedding vector(1536),
    pattern_type_param text,
    project_id_param uuid,
    match_threshold float DEFAULT 0.5,
    match_count int DEFAULT 10
  )
  RETURNS TABLE (
    id uuid, document_id uuid, content text,
    metadata jsonb, similarity float, document_title text,
    pattern_type text
  )
  LANGUAGE plpgsql AS $$
  BEGIN
    IF project_id_param IS NULL THEN RETURN; END IF;

    RETURN QUERY
    SELECT rc.id, rc.document_id, rc.content, rc.metadata,
           1 - (rc.embedding <=> query_embedding) as similarity,
           ud.title as document_title,
           rc.pattern_type
    FROM rag_chunks rc
    JOIN user_documents ud ON rc.document_id = ud.id
    WHERE 1 - (rc.embedding <=> query_embedding) > match_threshold
      AND ud.project_id = project_id_param
      AND (pattern_type_param IS NULL OR rc.pattern_type = pattern_type_param)
    ORDER BY rc.embedding <=> query_embedding
    LIMIT match_count;
  END;
  $$;
  ```

- `Key Variables`: `match_document_chunks_by_pattern`, `pattern_type_param`
- `Safety`: `project_id_param` 필수 (격리 유지)

---

### Definition of Done (검증):

#### 기능 테스트:

- [x] **Test P1-01**: `tagChunkWithPattern(chunkId, 'hook')` → DB에 pattern_type='hook' 저장 ✅ (코드 확인)
- [x] **Test P1-02**: `hybridSearch(query, { patternType: 'cta' })` → CTA 패턴 청크만 반환 ✅ (코드 확인)
- [x] **Test P1-03**: RPC 직접 호출 시 pattern_type 필터링 동작 ✅ (SQL 적용 완료)

#### 예외 처리:

- [x] **Exception P1-02**: patternType 없을 때 기존 검색 로직 사용 ✅ (코드 확인)
- [x] **Exception P1-03**: project_id 없을 때 빈 결과 반환 ✅ (SQL 확인)

---

## [Phase 2: 완성도 - UI 및 자동화]

### Before Start:

- ⚠️ **선행 조건**: Phase 0, 1 모든 항목 완료

---

### Implementation Items:

#### [x] **P2-01**: 루브릭 후보 생성 API ✅

- `Target`: `frontend/src/app/api/rubrics/candidates/route.ts` (신규 파일)
- `Logic (Pseudo)`:

  ```typescript
  export async function POST(req: NextRequest) {
    const {
      projectId,
      targetCount = 50,
      patternScope = "both",
    } = await req.json();

    // 1. 프로젝트의 청크 조회
    const chunks = await getProjectChunks(projectId);

    // 2. 패턴 추출 LLM 호출
    const candidates = await extractPatterns(chunks, {
      targetCount,
      patternScope,
    });

    // 3. DB 저장 (rag_rule_candidates)
    const { data } = await supabase.from("rag_rule_candidates").insert(
      candidates.map((c) => ({
        ...c,
        project_id: projectId,
        status: "draft",
      }))
    );

    return NextResponse.json({ saved: data.length });
  }
  ```

- `Key Variables`: `extractPatterns()`, `rag_rule_candidates`
- `Safety`: 인증 확인, projectId 필수

---

#### [x] **P2-02**: 루브릭 채택 API ✅

- `Target`: `frontend/src/app/api/rubrics/candidates/select/route.ts` (신규 파일)
- `Logic (Pseudo)`:

  ```typescript
  export async function POST(req: NextRequest) {
    const { candidateIds } = await req.json();

    // 상태를 'selected'로 변경
    await supabase
      .from("rag_rule_candidates")
      .update({ status: "selected" })
      .in("id", candidateIds);

    return NextResponse.json({ selected: candidateIds.length });
  }
  ```

- `Key Variables`: `candidateIds`, `status: 'selected'`
- `Safety`: 최대 20개 제한

---

### Definition of Done (검증):

#### 기능 테스트:

- [ ] **Test P2-01**: POST `/api/rubrics/candidates` → 50개 후보 생성
- [ ] **Test P2-02**: POST `/api/rubrics/candidates/select` → 선택된 후보 상태 변경

---

## 구현 순서 요약

```
Phase 0 (P0)
├── P0-01: DB 컬럼 추가 (10분)
├── P0-02: rubrics.ts 재설계 (30분)
├── P0-03: Feature Flag 추가 (5분)
└── P0-04: 패턴 추출 프롬프트 (1시간)

Phase 1 (P1)
├── P1-01: 패턴 태깅 서비스 (1시간)
├── P1-02: 패턴 기반 검색 확장 (2시간)
└── P1-03: 패턴 검색 RPC (30분)

Phase 2 (P2)
├── P2-01: 후보 생성 API (2시간)
└── P2-02: 채택 API (1시간)
```

---

## Rollback Plan

```sql
-- Phase 0 롤백
ALTER TABLE rag_chunks DROP COLUMN pattern_type;
DROP INDEX IF EXISTS idx_rag_chunks_pattern_type;

-- Phase 1 롤백
DROP FUNCTION IF EXISTS match_document_chunks_by_pattern;
```

---

_문서 끝_
