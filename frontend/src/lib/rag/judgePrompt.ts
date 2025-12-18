// =============================================================================
// PRISM Writer - Judge Prompt Builder
// =============================================================================
// 파일: frontend/src/lib/rag/judgePrompt.ts
// 역할: LLM에게 JSON 형식 응답을 강제하는 Judge 프롬프트 생성
// =============================================================================

import type { JudgeResult } from '@/types/rag'

// =============================================================================
// 상수
// =============================================================================

/** Judge 프롬프트 시스템 메시지 */
const JUDGE_SYSTEM_PROMPT = `당신은 RAG(Retrieval-Augmented Generation) 시스템의 답변 품질을 평가하는 Judge입니다.

주어진 질문과 컨텍스트를 분석하여 답변의 품질을 평가해주세요.

## 평가 기준
1. **pass**: 컨텍스트에서 질문에 대한 충분한 근거를 찾을 수 있음
2. **fail**: 컨텍스트가 질문과 관련이 없거나 잘못된 정보를 포함
3. **insufficient_evidence**: 컨텍스트에 일부 관련 정보가 있지만 완전한 답변에는 부족함

## 응답 규칙
- 반드시 JSON 형식으로 응답하세요
- 인용문(quote)은 컨텍스트에서 실제로 존재하는 문장을 그대로 사용하세요
- 없는 내용을 만들어내지 마세요`

/** JSON 스키마 예시 */
const JSON_SCHEMA_EXAMPLE = `{
  "verdict": "pass" | "fail" | "insufficient_evidence",
  "score": 0-100,
  "evidence": [
    {
      "chunkId": "chunk-id-here",
      "quote": "컨텍스트에서 발췌한 실제 인용문",
      "relevance": 0.0-1.0
    }
  ],
  "reasoning": "판정 이유 설명",
  "missingEvidence": ["부족한 근거 1", "부족한 근거 2"]
}`

// =============================================================================
// Main Functions
// =============================================================================

/**
 * Judge 프롬프트 빌더
 * 
 * @description
 * LLM에게 JSON 형식의 Judge 응답을 요청하는 프롬프트를 생성합니다.
 * 
 * @param query - 사용자 질문
 * @param context - 검색된 컨텍스트 청크 배열
 * @param rubric - 추가 평가 기준 (옵션)
 * @returns 완성된 Judge 프롬프트
 * 
 * @example
 * ```typescript
 * const prompt = buildJudgePrompt(
 *   "RAG란 무엇인가요?",
 *   ["RAG는 Retrieval-Augmented Generation의 약자입니다.", "..."]
 * )
 * ```
 */
export function buildJudgePrompt(
  query: string,
  context: string[],
  rubric?: string
): string {
  // ---------------------------------------------------------------------------
  // 1. 컨텍스트 포맷팅
  // ---------------------------------------------------------------------------
  const formattedContext = context
    .map((chunk, index) => `[청크 ${index + 1}]\n${chunk}`)
    .join('\n\n')

  // ---------------------------------------------------------------------------
  // 2. 프롬프트 구성
  // ---------------------------------------------------------------------------
  let prompt = `${JUDGE_SYSTEM_PROMPT}

## 질문
${query}

## 컨텍스트
${formattedContext}
`

  // ---------------------------------------------------------------------------
  // 3. 추가 평가 기준 (옵션)
  // ---------------------------------------------------------------------------
  if (rubric) {
    prompt += `
## 추가 평가 기준
${rubric}
`
  }

  // ---------------------------------------------------------------------------
  // 4. JSON 응답 형식 강제
  // ---------------------------------------------------------------------------
  prompt += `
## 응답 형식
다음 JSON 스키마에 맞춰 응답하세요:
\`\`\`json
${JSON_SCHEMA_EXAMPLE}
\`\`\`

JSON 형식으로만 응답하세요. 다른 텍스트를 추가하지 마세요.`

  return prompt
}

/**
 * 간단한 Judge 프롬프트 빌더 (청크 ID 포함)
 * 
 * @param query - 사용자 질문
 * @param chunks - 청크 객체 배열 (id, content 포함)
 * @returns 완성된 Judge 프롬프트
 */
export function buildJudgePromptWithChunks(
  query: string,
  chunks: Array<{ id: string; content: string }>
): string {
  const formattedContext = chunks
    .map((chunk) => `[청크 ID: ${chunk.id}]\n${chunk.content}`)
    .join('\n\n')

  const context = chunks.map((c) => c.content)
  
  // 기본 빌더 사용하되 ID 정보 추가
  let prompt = buildJudgePrompt(query, context)
  
  // 청크 ID 안내 추가
  prompt = prompt.replace(
    '## 컨텍스트',
    `## 컨텍스트 (각 청크의 ID를 evidence.chunkId에 사용하세요)\n${formattedContext}`
  )
  
  return prompt
}

/**
 * Judge 결과의 기본값 생성
 * 
 * @description
 * 파싱 실패 시 사용할 안전한 기본값
 */
export function getDefaultJudgeResult(): JudgeResult {
  return {
    verdict: 'insufficient_evidence',
    score: 0,
    evidence: [],
    reasoning: 'Judge 응답을 파싱할 수 없습니다.',
    missingEvidence: [],
  }
}

// =============================================================================
// Evidence Pack 통합 (P1 Phase 4.3)
// =============================================================================

import type { EvidencePack } from '@/types/rag'
import { formatEvidenceForPrompt } from '@/lib/rag/evidencePack'

/**
 * Evidence Pack을 사용한 Judge 프롬프트 빌더
 * 
 * @description
 * 표준화된 Evidence Pack을 사용하여 Judge 프롬프트 생성
 * 점수 정보와 메타데이터 포함
 * 
 * @param query - 사용자 질문
 * @param evidencePack - Evidence Pack 객체
 * @param rubric - 추가 평가 기준 (옵션)
 * @returns 완성된 Judge 프롬프트
 * 
 * @example
 * ```typescript
 * const prompt = buildJudgePromptWithEvidence(
 *   "RAG란 무엇인가요?",
 *   evidencePack
 * )
 * ```
 */
export function buildJudgePromptWithEvidence(
  query: string,
  evidencePack: EvidencePack,
  rubric?: string
): string {
  // ---------------------------------------------------------------------------
  // 1. Evidence Pack에서 컨텍스트 포맷팅
  // ---------------------------------------------------------------------------
  const formattedEvidence = formatEvidenceForPrompt(evidencePack)

  // ---------------------------------------------------------------------------
  // 2. 메타데이터 정보
  // ---------------------------------------------------------------------------
  const metaInfo = `
[검색 메타데이터]
- 질문: ${evidencePack.metadata.searchQuery}
- 검색 설정: ${evidencePack.metadata.retrievalConfigId}
- 임베딩 모델: ${evidencePack.metadata.embeddingModelId}
- 총 후보: ${evidencePack.metadata.totalCandidates}
- 선택된 근거: ${evidencePack.metadata.selectedCount}
- 실행 ID: ${evidencePack.runId}
`

  // ---------------------------------------------------------------------------
  // 3. 프롬프트 구성
  // ---------------------------------------------------------------------------
  let prompt = `${JUDGE_SYSTEM_PROMPT}

## 질문
${query}

## 검색된 근거 (Evidence Pack)
${metaInfo}
${formattedEvidence}
`

  // ---------------------------------------------------------------------------
  // 4. 추가 평가 기준 (옵션)
  // ---------------------------------------------------------------------------
  if (rubric) {
    prompt += `
## 추가 평가 기준
${rubric}
`
  }

  // ---------------------------------------------------------------------------
  // 5. Rubric ID가 있으면 추가
  // ---------------------------------------------------------------------------
  if (evidencePack.rubricId) {
    prompt += `
## 평가 기준 ID
${evidencePack.rubricId}
`
  }

  // ---------------------------------------------------------------------------
  // 6. JSON 응답 형식 강제
  // ---------------------------------------------------------------------------
  prompt += `
## 응답 형식
다음 JSON 스키마에 맞춰 응답하세요:
\`\`\`json
${JSON_SCHEMA_EXAMPLE}
\`\`\`

각 evidence의 chunkId는 위 근거의 번호를 사용하세요 (예: "근거 1" → "1").
JSON 형식으로만 응답하세요. 다른 텍스트를 추가하지 마세요.`

  return prompt
}
