# Phase 3: 지능형 파이프라인 구현 체크리스트

> **문서 ID**: 2601050033_Intelligent_Pipeline  
> **작성일**: 2026-01-05  
> **버전**: v1.0  
> **원본 전략**: `2601042100_RAG_2_0_Upgrade_Proposal.md` > Phase 3

---

## Before Start

> [!CAUTION] > **회귀 테스트 필수**: 기존 문서 처리 파이프라인(`processDocument()`)의 정상 동작 유지해야 함.

- ⚠️ **건드리지 말 것**: `semanticChunk()` 핵심 분할 로직 (기존 고객 데이터 호환성)
- ⚠️ **의존성**: Phase 1 (Embedding Migration), Phase 2 (Hybrid Search) 완료 권장
- ⚠️ **비용 주의**: Agentic Chunking은 문서당 1회 LLM 호출 → 비용 모니터링 필수
- ⚠️ **Vercel Timeout**: 대용량 문서(>50KB) 처리 시 타임아웃 → 배치 처리 또는 분할 호출 고려

---

## [P3-01] Agentic Chunking (AI 기반 구조 분석 청킹)

### 개요

기존 `semanticChunk()`는 정규식 기반 패턴 매칭으로 청킹.  
Agentic Chunking은 LLM이 문서 전체를 읽고 **"의미가 끊기는 지점"**을 판단하여 최적의 분할 위치를 결정.

---

### [P3-01-01] agenticChunk 함수 생성

- **ID**: P3-01-01
- `Target`: `frontend/src/lib/rag/agenticChunking.ts` (신규 파일)
- `Logic (Pseudo)`:

  ```typescript
  export interface AgenticChunkOptions {
    model?: "gemini" | "openai"; // 분석에 사용할 LLM
    maxChunkTokens?: number; // 청크당 최대 토큰 (기본: 512)
    minChunkTokens?: number; // 청크당 최소 토큰 (기본: 100)
    preserveContext?: boolean; // 문맥 보존 모드
  }

  export interface ChunkBoundary {
    startPosition: number;
    endPosition: number;
    reason: string; // LLM이 판단한 분할 이유
    chunkType: ChunkType;
  }

  export async function agenticChunk(
    text: string,
    options: AgenticChunkOptions = {}
  ): Promise<DocumentChunk[]> {
    const {
      model = "gemini",
      maxChunkTokens = 512,
      minChunkTokens = 100,
    } = options;

    // 1. 문서가 작으면 단일 청크로 반환
    const totalTokens = estimateTokenCount(text);
    if (totalTokens <= maxChunkTokens) {
      return [createSingleChunk(text)];
    }

    // 2. LLM에게 분할 위치 요청
    const prompt = buildChunkAnalysisPrompt(text, {
      maxChunkTokens,
      minChunkTokens,
    });
    const boundaries: ChunkBoundary[] = await callLLMForChunking(prompt, model);

    // 3. 경계 검증 및 청크 생성
    const validBoundaries = validateBoundaries(boundaries, text.length);
    const chunks = createChunksFromBoundaries(text, validBoundaries);

    // 4. 청크 유형 분류 (기존 classifyChunkType 재사용)
    return chunks.map((chunk, index) => ({
      ...chunk,
      index,
      metadata: {
        ...chunk.metadata,
        chunkType:
          boundaries[index]?.chunkType || classifyChunkType(chunk.content),
      },
    }));
  }

  function buildChunkAnalysisPrompt(
    text: string,
    options: { maxChunkTokens: number; minChunkTokens: number }
  ): string {
    return `
    You are a document structure analyst. Analyze the following document and identify optimal chunk boundaries.
    
    RULES:
    1. Each chunk should be ${options.minChunkTokens}-${
      options.maxChunkTokens
    } tokens.
    2. Never split in the middle of a concept, rule, or example.
    3. Keep related content together (e.g., a rule and its example).
    4. Identify the chunk type: 'rule', 'example', 'criteria', 'evidence', 'general'.
    
    DOCUMENT:
    """
    ${text.substring(0, 8000)}  // Token limit consideration
    """
    
    OUTPUT FORMAT (JSON array):
    [
      { "start": 0, "end": 500, "reason": "Introduction section", "type": "general" },
      { "start": 501, "end": 1200, "reason": "First rule with example", "type": "rule" },
      ...
    ]
    `;
  }
  ```

- `Key Variables`: `ChunkBoundary`, `maxChunkTokens`, `minChunkTokens`, `boundaries[]`
- `Safety`:
  - LLM 응답 JSON 파싱 실패 시 → `semanticChunk()` fallback
  - 경계 겹침/누락 검증 → `validateBoundaries()`에서 자동 보정
  - 텍스트 8000자 제한 (LLM 컨텍스트 초과 방지)

---

### [P3-01-02] LLM 호출 유틸리티 (청킹 전용)

- **ID**: P3-01-02
- `Target`: `frontend/src/lib/rag/agenticChunking.ts` > `callLLMForChunking()`
- `Logic (Pseudo)`:
  ```typescript
  async function callLLMForChunking(
    prompt: string,
    model: "gemini" | "openai"
  ): Promise<ChunkBoundary[]> {
    try {
      const response =
        model === "gemini"
          ? await callGeminiAPI(prompt, { temperature: 0.1 }) // 결정적 응답
          : await callOpenAIAPI(prompt, { temperature: 0.1 });

      // JSON 추출 (마크다운 코드블록 처리)
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (!jsonMatch) throw new Error("Invalid LLM response format");

      const boundaries = JSON.parse(jsonMatch[0]) as ChunkBoundary[];

      // 유효성 검증
      if (!Array.isArray(boundaries) || boundaries.length === 0) {
        throw new Error("Empty boundaries array");
      }

      return boundaries;
    } catch (error) {
      console.error("[AgenticChunk] LLM call failed:", error);
      throw error; // Caller에서 fallback 처리
    }
  }
  ```
- `Key Variables`: `temperature: 0.1`, `jsonMatch`
- `Safety`:
  - JSON 파싱 `try-catch` 필수
  - 타임아웃: 30초 (대용량 문서 분석 고려)
  - Rate limiting 고려 (연속 호출 시 지연)

---

### [P3-01-03] processDocument에 Agentic Chunking 통합

- **ID**: P3-01-03
- `Target`: `frontend/src/lib/rag/documentProcessor.ts` > `processDocument()` (수정)
- `Logic (Pseudo)`:

  ```typescript
  // processDocument() 내부 (line ~350):

  // 기존:
  // const chunks = semanticChunk(content, options)

  // 개선:
  let chunks: DocumentChunk[];

  if (FEATURE_FLAGS.ENABLE_AGENTIC_CHUNKING) {
    try {
      chunks = await agenticChunk(content, {
        model: "gemini",
        maxChunkTokens: 512,
        preserveContext: true,
      });
      console.log(
        `[ProcessDocument] Agentic chunking: ${chunks.length} chunks`
      );
    } catch (error) {
      console.warn(
        "[ProcessDocument] Agentic chunking failed, fallback to semantic:",
        error
      );
      chunks = semanticChunk(content, options); // Fallback
    }
  } else {
    chunks = semanticChunk(content, options);
  }
  ```

- `Key Variables`: `ENABLE_AGENTIC_CHUNKING`
- `Safety`:
  - Agentic 실패 시 항상 `semanticChunk()` fallback
  - 처리 시간 로깅 (성능 모니터링)

---

### [P3-01-04] Feature Flag: ENABLE_AGENTIC_CHUNKING

- **ID**: P3-01-04
- `Target`: `frontend/src/config/featureFlags.ts`
- `Logic (Pseudo)`:
  ```typescript
  export const FEATURE_FLAGS = {
    // ... 기존 플래그
    ENABLE_AGENTIC_CHUNKING:
      process.env.NEXT_PUBLIC_ENABLE_AGENTIC_CHUNKING === "true",
    AGENTIC_CHUNKING_MODEL:
      process.env.NEXT_PUBLIC_AGENTIC_CHUNKING_MODEL || "gemini",
  };
  ```
- `Key Variables`: `ENABLE_AGENTIC_CHUNKING`, `AGENTIC_CHUNKING_MODEL`
- `Safety`: 기본값 `false` (기존 semanticChunk 유지)

---

## [P3-02] Self-RAG (자기 검증 RAG)

### 개요

Self-RAG는 다음 4단계로 동작:

1. **Retrieve**: 필요할 때만 검색 수행 (비용 절감)
2. **Critique**: 검색된 문서가 쿼리와 관련 있는지 자가 판단
3. **Generate**: 답변 생성
4. **Verify**: 생성된 답변이 문서에 근거하는지 검증

---

### [P3-02-01] retrievalNecessity 함수 생성

- **ID**: P3-02-01
- `Target`: `frontend/src/lib/rag/selfRAG.ts` (신규 파일)
- `Logic (Pseudo)`:

  ```typescript
  export interface SelfRAGOptions {
    model?: "gemini" | "openai";
    retrievalThreshold?: number; // 검색 필요도 임계값 (0.0-1.0)
    critiqueThreshold?: number; // 관련도 필터 임계값
  }

  /**
   * Step 1: 검색 필요 여부 판단
   * 단순 인사, FAQ 등은 검색 없이 응답 가능
   */
  export async function checkRetrievalNecessity(
    query: string,
    options: SelfRAGOptions = {}
  ): Promise<{ needed: boolean; confidence: number; reason: string }> {
    const { model = "gemini", retrievalThreshold = 0.5 } = options;

    const prompt = `
    Analyze if this query requires document retrieval:
    Query: "${query}"
    
    Return JSON: { "needed": true/false, "confidence": 0.0-1.0, "reason": "..." }
    
    Examples where retrieval is NOT needed:
    - Greetings: "안녕하세요"
    - General knowledge: "1+1은?"
    
    Examples where retrieval IS needed:
    - Specific domain questions: "현상 욕구 계획이란?"
    - Document references: "업로드한 문서에서..."
    `;

    const response = await callLLMForSelfRAG(prompt, model);
    const result = parseJSONResponse(response);

    return {
      needed: result.confidence >= retrievalThreshold,
      confidence: result.confidence,
      reason: result.reason,
    };
  }
  ```

- `Key Variables`: `retrievalThreshold`, `needed`, `confidence`
- `Safety`:
  - 파싱 실패 시 `{ needed: true }` (안전하게 검색 수행)
  - 낮은 confidence 시에도 검색 수행 (false negative 방지)

---

### [P3-02-02] critiqueRetrievalResults 함수 생성

- **ID**: P3-02-02
- `Target`: `frontend/src/lib/rag/selfRAG.ts` > `critiqueRetrievalResults()`
- `Logic (Pseudo)`:

  ```typescript
  export interface CritiquedResult {
    result: SearchResult;
    relevanceScore: number; // LLM이 평가한 관련도 (0.0-1.0)
    isRelevant: boolean;
    critique: string; // 관련/비관련 판단 이유
  }

  /**
   * Step 2: 검색 결과 관련도 평가
   * 각 청크가 쿼리에 실제로 관련 있는지 LLM이 판단
   */
  export async function critiqueRetrievalResults(
    query: string,
    results: SearchResult[],
    options: SelfRAGOptions = {}
  ): Promise<CritiquedResult[]> {
    const { model = "gemini", critiqueThreshold = 0.6 } = options;

    // 비용 최적화: 상위 10개만 평가
    const toEvaluate = results.slice(0, 10);

    const prompt = `
    Query: "${query}"
    
    Rate the relevance of each document (0.0-1.0):
    ${toEvaluate
      .map((r, i) => `[${i}] ${r.content.substring(0, 300)}`)
      .join("\n\n")}
    
    Return JSON array:
    [
      { "index": 0, "score": 0.9, "critique": "Directly answers the query" },
      { "index": 1, "score": 0.3, "critique": "Mentions topic but not relevant" },
      ...
    ]
    `;

    const response = await callLLMForSelfRAG(prompt, model);
    const evaluations = parseJSONResponse(response) as Array<{
      index: number;
      score: number;
      critique: string;
    }>;

    return toEvaluate.map((result, i) => {
      const evaluation = evaluations.find((e) => e.index === i) || {
        score: result.score,
        critique: "Not evaluated",
      };
      return {
        result,
        relevanceScore: evaluation.score,
        isRelevant: evaluation.score >= critiqueThreshold,
        critique: evaluation.critique,
      };
    });
  }
  ```

- `Key Variables`: `critiqueThreshold`, `CritiquedResult`, `relevanceScore`
- `Safety`:
  - 평가 누락 시 원본 `result.score` 사용
  - 빈 결과 배열 처리

---

### [P3-02-03] verifyGroundedness 함수 생성

- **ID**: P3-02-03
- `Target`: `frontend/src/lib/rag/selfRAG.ts` > `verifyGroundedness()`
- `Logic (Pseudo)`:

  ```typescript
  export interface GroundednessResult {
    isGrounded: boolean; // 답변이 문서에 근거하는지
    groundednessScore: number; // 근거 점수 (0.0-1.0)
    citations: string[]; // 근거가 된 문서 인용
    hallucinations: string[]; // 근거 없는 주장 목록
  }

  /**
   * Step 4: 답변의 근거 검증 (할루시네이션 탐지)
   */
  export async function verifyGroundedness(
    answer: string,
    usedDocuments: SearchResult[],
    options: SelfRAGOptions = {}
  ): Promise<GroundednessResult> {
    const { model = "gemini" } = options;

    const prompt = `
    Verify if the answer is grounded in the provided documents.
    
    ANSWER:
    "${answer}"
    
    DOCUMENTS:
    ${usedDocuments
      .map((d, i) => `[DOC${i}] ${d.content.substring(0, 500)}`)
      .join("\n")}
    
    OUTPUT FORMAT (JSON):
    {
      "isGrounded": true/false,
      "score": 0.0-1.0,
      "citations": ["DOC0", "DOC2"],  // Documents that support the answer
      "hallucinations": ["Claim X is not supported by any document"]
    }
    `;

    const response = await callLLMForSelfRAG(prompt, model);
    const result = parseJSONResponse(response);

    return {
      isGrounded: result.score >= 0.7,
      groundednessScore: result.score,
      citations: result.citations || [],
      hallucinations: result.hallucinations || [],
    };
  }
  ```

- `Key Variables`: `groundednessScore`, `citations`, `hallucinations`
- `Safety`:
  - 빈 documents 배열 시 `isGrounded: false` 반환
  - 답변이 매우 짧으면 검증 스킵 (비용 절감)

---

### [P3-02-04] Chat API에 Self-RAG 통합

- **ID**: P3-02-04
- `Target`: `frontend/src/app/api/chat/route.ts` (수정)
- `Logic (Pseudo)`:

  ```typescript
  // Chat API 내부 (메시지 처리 부분):

  if (FEATURE_FLAGS.ENABLE_SELF_RAG) {
    // Step 1: 검색 필요 여부 판단
    const retrievalCheck = await checkRetrievalNecessity(userMessage);

    let relevantDocs: SearchResult[] = [];

    if (retrievalCheck.needed) {
      // Step 1.5: 검색 수행
      const rawResults = await hybridSearch(userMessage, searchOptions);

      // Step 2: 결과 관련도 평가
      const critiqued = await critiqueRetrievalResults(userMessage, rawResults);
      relevantDocs = critiqued.filter((c) => c.isRelevant).map((c) => c.result);

      console.log(
        `[SelfRAG] ${critiqued.length} → ${relevantDocs.length} (filtered)`
      );
    }

    // Step 3: 답변 생성 (기존 로직)
    const answer = await generateAnswer(userMessage, relevantDocs);

    // Step 4: 근거 검증 (답변이 길 경우만)
    if (answer.length > 100 && relevantDocs.length > 0) {
      const verification = await verifyGroundedness(answer, relevantDocs);

      if (!verification.isGrounded) {
        // 할루시네이션 경고 추가
        answer += `\n\n⚠️ 주의: 일부 내용이 문서에서 확인되지 않았습니다.`;
      }
    }

    return answer;
  }
  ```

- `Key Variables`: `retrievalCheck`, `critiqued`, `verification`
- `Safety`:
  - 각 단계 실패 시 기존 로직으로 fallback
  - 단계별 latency 로깅 (성능 모니터링)

---

### [P3-02-05] Feature Flag: ENABLE_SELF_RAG

- **ID**: P3-02-05
- `Target`: `frontend/src/config/featureFlags.ts`
- `Logic (Pseudo)`:
  ```typescript
  export const FEATURE_FLAGS = {
    // ... 기존 플래그
    ENABLE_SELF_RAG: process.env.NEXT_PUBLIC_ENABLE_SELF_RAG === "true",
    SELF_RAG_MODEL: process.env.NEXT_PUBLIC_SELF_RAG_MODEL || "gemini",
    SELF_RAG_RETRIEVAL_THRESHOLD: parseFloat(
      process.env.NEXT_PUBLIC_SELF_RAG_RETRIEVAL_THRESHOLD || "0.5"
    ),
    SELF_RAG_CRITIQUE_THRESHOLD: parseFloat(
      process.env.NEXT_PUBLIC_SELF_RAG_CRITIQUE_THRESHOLD || "0.6"
    ),
  };
  ```
- `Key Variables`: `ENABLE_SELF_RAG`, 각 Threshold 설정
- `Safety`: 기본값 `false` (기존 검색 로직 유지)

---

## Definition of Done (검증)

### Agentic Chunking (P3-01)

- [ ] **Test (Unit)**: 500토큰 문서 → 단일 청크 반환
- [ ] **Test (Unit)**: 2000토큰 문서 → 최소 3개 청크 (각 512토큰 이하)
- [ ] **Test (Fallback)**: LLM 타임아웃 시 `semanticChunk()` 호출 확인
- [ ] **Test (Quality)**: 규칙+예시가 같은 청크에 포함되는지 수동 검토
  - 테스트 문서: 기존 업로드된 가이드라인 문서
- [ ] **Review**: LLM 비용 로깅 (문서당 토큰 사용량)
- [ ] **Review**: 처리 시간 비교 (semanticChunk vs agenticChunk)

### Self-RAG (P3-02)

- [ ] **Test (Retrieval Necessity)**:
  - 입력: "안녕하세요" → `needed: false`
  - 입력: "현상 욕구 계획이란?" → `needed: true`
- [ ] **Test (Critique)**: 관련 없는 청크가 필터링되는지 확인
- [ ] **Test (Groundedness)**:
  - 문서에 없는 내용 답변 시 → `hallucinations` 배열에 포함
- [ ] **Test (Integration)**: 전체 파이프라인 실행 (검색→비평→생성→검증)
- [ ] **Review**: 할루시네이션 경고 UI 표시 확인

### 공통

- [ ] **Build**: `npm run build` 에러 없음
- [ ] **Type Check**: `npx tsc --noEmit` 에러 없음
- [ ] **Console Logs**: `console.log` → `logger.info` 마이그레이션
- [ ] **JSDoc**: 신규 함수에 `@description`, `@param`, `@returns` 작성
- [ ] **비용 모니터링**: LLM 호출 횟수/토큰 로깅 설정

---

## 파일 변경 요약

| 파일                                        | 변경 유형 | 설명                       |
| ------------------------------------------- | --------- | -------------------------- |
| `frontend/src/lib/rag/agenticChunking.ts`   | NEW       | LLM 기반 구조 분석 청킹    |
| `frontend/src/lib/rag/selfRAG.ts`           | NEW       | Self-RAG 4단계 검증 시스템 |
| `frontend/src/lib/rag/documentProcessor.ts` | MODIFY    | Agentic Chunking 통합      |
| `frontend/src/app/api/chat/route.ts`        | MODIFY    | Self-RAG 파이프라인 통합   |
| `frontend/src/config/featureFlags.ts`       | MODIFY    | 신규 플래그 추가           |

---

## 비용 예측 (LLM 호출)

| 기능                | 호출 시점    | 예상 토큰                  | 비용 (Gemini Pro) |
| ------------------- | ------------ | -------------------------- | ----------------- |
| Agentic Chunking    | 문서 업로드  | ~10,000 input + 500 output | ~$0.01/문서       |
| Retrieval Necessity | 매 채팅      | ~200 input + 50 output     | ~$0.0002/쿼리     |
| Critique            | 검색 수행 시 | ~3,000 input + 200 output  | ~$0.003/쿼리      |
| Groundedness        | 긴 답변 시   | ~2,000 input + 100 output  | ~$0.002/쿼리      |

> [!TIP] > **비용 최적화**: Self-RAG의 각 단계는 Feature Flag로 개별 제어 가능.  
> 예: Critique만 활성화하고 Groundedness는 비활성화 → 50% 비용 절감

---

**문서 끝**
