// =============================================================================
// PRISM Writer - LLM Prompt Templates
// =============================================================================
// 파일: frontend/src/lib/llm/prompts.ts
// 역할: 글 평가용 프롬프트 템플릿 관리
// =============================================================================

// =============================================================================
// 타입 정의
// =============================================================================

/** 검색 결과 (RAG) */
export interface SearchResult {
  /** 청크 ID */
  chunkId: string
  /** 청크 내용 */
  content: string
  /** 유사도 점수 */
  score: number
  /** 메타데이터 */
  metadata?: Record<string, any>
}

/** 루브릭 항목 */
export interface RubricItem {
  /** 루브릭 ID */
  id: string
  /** 루브릭 이름 */
  name: string
  /** 평가 기준 설명 */
  description: string
  /** 가중치 (선택) */
  weight?: number
}

/** 평가 컨텍스트 */
export interface EvaluationContext {
  /** 사용자가 작성한 글 */
  userText: string
  /** 평가할 루브릭 항목들 */
  rubrics: RubricItem[]
  /** RAG 검색 결과 (근거 자료) */
  searchResults: SearchResult[]
  /** 추가 컨텍스트 (선택) */
  additionalContext?: string
}

// =============================================================================
// 상수
// =============================================================================

/** 시스템 프롬프트 - 평가자 역할 정의 */
const SYSTEM_PROMPT = `당신은 글 평가 전문가입니다.
제공된 루브릭(평가 기준)에 따라 사용자의 글을 평가합니다.

## 핵심 원칙

1. **근거 기반 평가**: 반드시 제공된 참고 자료(근거)를 인용하여 평가해야 합니다.
2. **객관적 평가**: 감정이나 주관적 의견 없이 사실에 기반하여 평가합니다.
3. **명확한 인용**: 근거를 인용할 때는 원문을 정확히 인용합니다.
4. **건설적 피드백**: 문제점뿐만 아니라 개선 방향도 제시합니다.

## 중요 가드레일

⚠️ **근거 부족 처리**: 
- 제공된 참고 자료에서 해당 루브릭을 평가할 근거를 찾을 수 없는 경우,
  status를 "insufficient_evidence"로 설정하고,
  evidence_quotes를 빈 배열로 두며,
  recommendations에 "참고 자료에서 관련 근거를 찾을 수 없습니다"라고 명시하세요.

⚠️ **절대 지어내지 마세요**:
- 참고 자료에 없는 내용을 근거로 인용하지 마세요.
- 확실하지 않으면 "근거 부족"으로 처리하세요.`

/** 출력 형식 지시문 */
const OUTPUT_FORMAT_INSTRUCTION = `
## 출력 형식

반드시 아래 JSON 형식으로 응답하세요. 다른 텍스트 없이 JSON만 출력하세요.

\`\`\`json
{
  "evaluations": [
    {
      "rubric_item": "루브릭 ID",
      "status": "pass | partial | fail | insufficient_evidence",
      "evidence_quotes": [
        "참고 자료에서 인용한 근거 1",
        "참고 자료에서 인용한 근거 2"
      ],
      "user_text_quotes": [
        "사용자 글에서 해당 부분 인용"
      ],
      "score": 0-100,
      "recommendations": "구체적인 개선 방향"
    }
  ],
  "overall_summary": "전체 평가 요약",
  "overall_score": 0-100
}
\`\`\`

## 상태(status) 정의

- **pass**: 루브릭 기준을 완전히 충족
- **partial**: 루브릭 기준을 부분적으로 충족
- **fail**: 루브릭 기준을 충족하지 못함
- **insufficient_evidence**: 참고 자료에서 평가할 근거를 찾을 수 없음`

// =============================================================================
// Main Functions
// =============================================================================

/**
 * 평가 프롬프트 생성
 * 
 * @description
 * 사용자 글, 루브릭, 검색 결과를 조합하여 LLM에 전달할 평가 프롬프트를 생성합니다.
 * 근거 인용을 강제하고, 근거가 없으면 "근거 부족"으로 처리하도록 가드레일이 포함됩니다.
 * 
 * @param context - 평가 컨텍스트
 * @returns 완성된 프롬프트 문자열
 * 
 * @example
 * ```typescript
 * const prompt = buildEvaluationPrompt({
 *   userText: "사용자가 작성한 글...",
 *   rubrics: [{ id: "r1", name: "논리성", description: "논리적 흐름" }],
 *   searchResults: [{ chunkId: "c1", content: "참고 자료...", score: 0.9 }]
 * })
 * ```
 */
export function buildEvaluationPrompt(context: EvaluationContext): string {
  const { userText, rubrics, searchResults, additionalContext } = context

  // ---------------------------------------------------------------------------
  // 1. 루브릭 섹션 구성
  // ---------------------------------------------------------------------------
  const rubricSection = buildRubricSection(rubrics)

  // ---------------------------------------------------------------------------
  // 2. 참고 자료 섹션 구성
  // ---------------------------------------------------------------------------
  const evidenceSection = buildEvidenceSection(searchResults)

  // ---------------------------------------------------------------------------
  // 3. 사용자 글 섹션 구성
  // ---------------------------------------------------------------------------
  const userTextSection = `## 평가할 사용자 글

\`\`\`
${userText}
\`\`\``

  // ---------------------------------------------------------------------------
  // 4. 추가 컨텍스트 (선택)
  // ---------------------------------------------------------------------------
  const additionalSection = additionalContext
    ? `## 추가 컨텍스트

${additionalContext}`
    : ''

  // ---------------------------------------------------------------------------
  // 5. 프롬프트 조합
  // ---------------------------------------------------------------------------
  return `${SYSTEM_PROMPT}

${OUTPUT_FORMAT_INSTRUCTION}

---

${rubricSection}

---

${evidenceSection}

---

${userTextSection}

${additionalSection}

---

위의 루브릭과 참고 자료를 바탕으로 사용자 글을 평가해주세요.
반드시 JSON 형식으로만 응답하세요.`
}

/**
 * 루브릭 섹션 생성
 * 
 * @param rubrics - 루브릭 배열
 * @returns 포맷팅된 루브릭 섹션
 */
function buildRubricSection(rubrics: RubricItem[]): string {
  if (!rubrics || rubrics.length === 0) {
    return `## 평가 루브릭

평가할 루브릭이 제공되지 않았습니다. 일반적인 글쓰기 품질 기준으로 평가해주세요.`
  }

  const rubricList = rubrics
    .map((r, index) => {
      const weight = r.weight ? ` (가중치: ${r.weight}%)` : ''
      return `${index + 1}. **${r.name}** (ID: ${r.id})${weight}
   - ${r.description}`
    })
    .join('\n\n')

  return `## 평가 루브릭

다음 ${rubrics.length}개 항목에 대해 평가해주세요:

${rubricList}`
}

/**
 * 참고 자료(근거) 섹션 생성
 * 
 * @param searchResults - RAG 검색 결과
 * @returns 포맷팅된 참고 자료 섹션
 */
function buildEvidenceSection(searchResults: SearchResult[]): string {
  if (!searchResults || searchResults.length === 0) {
    return `## 참고 자료 (RAG 검색 결과)

⚠️ 참고 자료가 제공되지 않았습니다.
모든 루브릭 항목에 대해 status를 "insufficient_evidence"로 설정해주세요.`
  }

  const evidenceList = searchResults
    .map((result, index) => {
      const score = (result.score * 100).toFixed(1)
      return `### 참고 자료 ${index + 1} (유사도: ${score}%)

\`\`\`
${result.content}
\`\`\`

메타데이터: ${JSON.stringify(result.metadata || {})}`
    })
    .join('\n\n')

  return `## 참고 자료 (RAG 검색 결과)

다음 ${searchResults.length}개의 참고 자료를 근거로 사용하세요:

${evidenceList}

⚠️ 위 참고 자료에 없는 내용은 근거로 인용하지 마세요.`
}

/**
 * 간단한 질문 프롬프트 생성
 * 
 * @description
 * 단순 질문-응답을 위한 프롬프트를 생성합니다.
 * 
 * @param question - 질문
 * @param context - 추가 컨텍스트 (선택)
 * @returns 프롬프트 문자열
 */
export function buildSimplePrompt(question: string, context?: string): string {
  if (context) {
    return `다음 컨텍스트를 참고하여 질문에 답변해주세요.

## 컨텍스트
${context}

## 질문
${question}

한국어로 답변해주세요.`
  }

  return `${question}

한국어로 답변해주세요.`
}

/**
 * 요약 프롬프트 생성
 * 
 * @description
 * 텍스트 요약을 위한 프롬프트를 생성합니다.
 * 
 * @param text - 요약할 텍스트
 * @param maxLength - 최대 요약 길이 (글자 수)
 * @returns 프롬프트 문자열
 */
export function buildSummaryPrompt(text: string, maxLength: number = 500): string {
  return `다음 텍스트를 ${maxLength}자 이내로 요약해주세요.
핵심 내용만 간결하게 정리해주세요.

## 요약할 텍스트
${text}

## 출력 형식
- 핵심 포인트를 불릿 포인트로 정리
- 최대 ${maxLength}자
- 한국어로 작성`
}
