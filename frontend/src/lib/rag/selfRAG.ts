// =============================================================================
// PRISM Writer - Self-RAG (자기 검증 RAG)
// =============================================================================
// 파일: frontend/src/lib/rag/selfRAG.ts
// 역할: 4단계 자기 검증 RAG - 검색 필요 판단, 관련도 평가, 생성, 근거 검증
// Pipeline P3-02: Self-RAG
// =============================================================================

import { generateText } from '@/lib/llm/gateway'
import { FEATURE_FLAGS } from '@/config/featureFlags'
import { logger } from '@/lib/utils/logger'
import type { SearchResult } from './search'

// =============================================================================
// [P3-02] 타입 정의
// =============================================================================

/**
 * Self-RAG 옵션
 * 
 * @description
 * 시니어 개발자 주석: Self-RAG 4단계 설정
 */
export interface SelfRAGOptions {
  /** 사용할 LLM 모델 */
  model?: 'gemini' | 'openai'
  /** 검색 필요도 임계값 (0.0-1.0) */
  retrievalThreshold?: number
  /** 관련도 필터 임계값 (0.0-1.0) */
  critiqueThreshold?: number
}

/**
 * 검색 필요 여부 판단 결과
 */
export interface RetrievalNecessityResult {
  /** 검색이 필요한지 여부 */
  needed: boolean
  /** 판단 신뢰도 (0.0-1.0) */
  confidence: number
  /** 판단 이유 */
  reason: string
}

/**
 * 검색 결과 비평 정보
 */
export interface CritiquedResult {
  /** 원본 검색 결과 */
  result: SearchResult
  /** LLM이 평가한 관련도 (0.0-1.0) */
  relevanceScore: number
  /** 관련 여부 */
  isRelevant: boolean
  /** 관련/비관련 판단 이유 */
  critique: string
}

/**
 * 근거 검증 결과
 */
export interface GroundednessResult {
  /** 답변이 문서에 근거하는지 */
  isGrounded: boolean
  /** 근거 점수 (0.0-1.0) */
  groundednessScore: number
  /** 근거가 된 문서 인용 */
  citations: string[]
  /** 근거 없는 주장 목록 */
  hallucinations: string[]
}

// =============================================================================
// [P3-02-01] 검색 필요 여부 판단
// =============================================================================

/**
 * Step 1: 검색 필요 여부 판단
 * 
 * @description
 * 시니어 개발자 주석:
 * 단순 인사, FAQ, 일반 상식 질문은 검색 없이 응답 가능.
 * 불필요한 검색을 줄여 latency와 비용을 절감.
 * 
 * 주의: 파싱 실패 시 안전하게 { needed: true } 반환
 * 
 * @param query - 사용자 질문
 * @param options - Self-RAG 옵션
 * @returns 검색 필요 여부 및 신뢰도
 * 
 * @example
 * ```typescript
 * const check = await checkRetrievalNecessity("안녕하세요")
 * // { needed: false, confidence: 0.9, reason: "Greeting, no document needed" }
 * ```
 */
export async function checkRetrievalNecessity(
  query: string,
  options: SelfRAGOptions = {}
): Promise<RetrievalNecessityResult> {
  const {
    model = FEATURE_FLAGS.SELF_RAG_MODEL,
    retrievalThreshold = FEATURE_FLAGS.SELF_RAG_RETRIEVAL_THRESHOLD,
  } = options

  const modelId = model === 'gemini' ? 'gemini-2.0-flash' : 'gpt-4o-mini'

  logger.debug('[SelfRAG]', 'Checking retrieval necessity', { query: query.substring(0, 50) })

  const prompt = `You are a query classifier. Determine if the following query requires document retrieval to answer properly.

Query: "${query}"

Return JSON: { "needed": true/false, "confidence": 0.0-1.0, "reason": "..." }

Examples where retrieval is NOT needed:
- Greetings: "안녕하세요", "Hello"
- General knowledge: "1+1은?", "What is 2+2?"
- System questions: "너는 누구니?", "What can you do?"

Examples where retrieval IS needed:
- Specific domain questions: "현상 욕구 계획이란?"
- Document references: "업로드한 문서에서..."
- Writing guidance: "문장 시작에 사용하는 후킹 기법은?"

Return ONLY the JSON object, no other text.`

  try {
    const response = await callLLMForSelfRAG(prompt, modelId)
    const result = parseSelfRAGResponse(response)

    logger.info('[SelfRAG]', 'Retrieval necessity check completed', {
      needed: result.confidence >= retrievalThreshold,
      confidence: result.confidence,
    })

    return {
      needed: result.confidence >= retrievalThreshold ? result.needed : true,
      confidence: result.confidence ?? 0.5,
      reason: result.reason ?? 'Unknown',
    }
  } catch (error) {
    logger.warn('[SelfRAG]', 'Retrieval necessity check failed, defaulting to needed', {
      error: error instanceof Error ? error.message : String(error),
    })
    // 안전하게 검색 수행
    return { needed: true, confidence: 0.5, reason: 'Parse error, defaulting to retrieval' }
  }
}

// =============================================================================
// [P3-02-02] 검색 결과 관련도 평가
// =============================================================================

/**
 * Step 2: 검색 결과 관련도 평가 (Critique)
 * 
 * @description
 * 주니어 개발자 주석:
 * 검색된 각 문서가 쿼리에 실제로 관련 있는지 LLM이 판단.
 * 관련도가 낮은 문서를 필터링하여 답변 품질 향상.
 * 
 * 비용 최적화: 상위 10개만 평가
 * 
 * @param query - 사용자 질문
 * @param results - 검색 결과 배열
 * @param options - Self-RAG 옵션
 * @returns 비평된 검색 결과 배열
 */
export async function critiqueRetrievalResults(
  query: string,
  results: SearchResult[],
  options: SelfRAGOptions = {}
): Promise<CritiquedResult[]> {
  const {
    model = FEATURE_FLAGS.SELF_RAG_MODEL,
    critiqueThreshold = FEATURE_FLAGS.SELF_RAG_CRITIQUE_THRESHOLD,
  } = options

  // 비용 최적화: 상위 10개만 평가
  const toEvaluate = results.slice(0, 10)

  if (toEvaluate.length === 0) {
    return []
  }

  const modelId = model === 'gemini' ? 'gemini-2.0-flash' : 'gpt-4o-mini'

  logger.debug('[SelfRAG]', 'Critiquing retrieval results', { 
    query: query.substring(0, 50),
    resultCount: toEvaluate.length,
  })

  const prompt = `You are a relevance evaluator. Rate how relevant each document is to the query.

Query: "${query}"

Documents:
${toEvaluate.map((r, i) => `[${i}] ${r.content.substring(0, 300)}...`).join('\n\n')}

Rate each document's relevance from 0.0 (not relevant) to 1.0 (highly relevant).

Return JSON array:
[
  { "index": 0, "score": 0.9, "critique": "Directly answers the query about X" },
  { "index": 1, "score": 0.3, "critique": "Mentions topic but not directly relevant" },
  ...
]

Return ONLY the JSON array, no other text.`

  try {
    const response = await callLLMForSelfRAG(prompt, modelId)
    const evaluations = parseCritiqueResponse(response)

    const critiqued: CritiquedResult[] = toEvaluate.map((result, i) => {
      const evaluation = evaluations.find(e => e.index === i) || {
        score: result.score,
        critique: 'Not evaluated',
      }
      return {
        result,
        relevanceScore: evaluation.score ?? result.score,
        isRelevant: (evaluation.score ?? result.score) >= critiqueThreshold,
        critique: evaluation.critique ?? 'N/A',
      }
    })

    const relevantCount = critiqued.filter(c => c.isRelevant).length
    logger.info('[SelfRAG]', 'Critique completed', {
      total: critiqued.length,
      relevant: relevantCount,
      filtered: critiqued.length - relevantCount,
    })

    return critiqued
  } catch (error) {
    logger.warn('[SelfRAG]', 'Critique failed, returning original results', {
      error: error instanceof Error ? error.message : String(error),
    })
    // 평가 실패 시 원본 점수 사용
    return toEvaluate.map(result => ({
      result,
      relevanceScore: result.score,
      isRelevant: result.score >= critiqueThreshold,
      critique: 'Evaluation failed, using original score',
    }))
  }
}

// =============================================================================
// [P3-02-03] 근거 검증 (할루시네이션 탐지)
// =============================================================================

/**
 * Step 4: 답변의 근거 검증 (Groundedness Check)
 * 
 * @description
 * 시니어 개발자 주석:
 * 생성된 답변이 실제로 제공된 문서에 근거하는지 검증.
 * 할루시네이션(근거 없는 주장) 탐지.
 * 
 * 주의: 답변이 매우 짧으면 검증 스킵 (비용 절감)
 * 
 * @param answer - 생성된 답변
 * @param usedDocuments - 답변 생성에 사용된 문서들
 * @param options - Self-RAG 옵션
 * @returns 근거 검증 결과
 */
export async function verifyGroundedness(
  answer: string,
  usedDocuments: SearchResult[],
  options: SelfRAGOptions = {}
): Promise<GroundednessResult> {
  const { model = FEATURE_FLAGS.SELF_RAG_MODEL } = options

  // 짧은 답변 또는 문서 없음 시 스킵
  if (answer.length < 50 || usedDocuments.length === 0) {
    logger.debug('[SelfRAG]', 'Skipping groundedness check (short answer or no docs)')
    return {
      isGrounded: usedDocuments.length > 0,
      groundednessScore: usedDocuments.length > 0 ? 1.0 : 0.0,
      citations: [],
      hallucinations: [],
    }
  }

  const modelId = model === 'gemini' ? 'gemini-2.0-flash' : 'gpt-4o-mini'

  logger.debug('[SelfRAG]', 'Verifying groundedness', {
    answerLength: answer.length,
    documentCount: usedDocuments.length,
  })

  const prompt = `You are a fact-checker. Verify if the answer is grounded in the provided documents.

ANSWER:
"${answer.substring(0, 1500)}"

DOCUMENTS:
${usedDocuments.map((d, i) => `[DOC${i}] ${d.content.substring(0, 500)}...`).join('\n\n')}

Check each claim in the answer:
1. If a claim is supported by the documents, note the document reference.
2. If a claim is NOT supported by any document, it's a potential hallucination.

OUTPUT FORMAT (JSON):
{
  "isGrounded": true/false,
  "score": 0.0-1.0,
  "citations": ["DOC0", "DOC2"],
  "hallucinations": ["Claim X is not supported by any document"]
}

Return ONLY the JSON object, no other text.`

  try {
    const response = await callLLMForSelfRAG(prompt, modelId)
    const result = parseGroundednessResponse(response)

    logger.info('[SelfRAG]', 'Groundedness check completed', {
      isGrounded: result.score >= 0.7,
      score: result.score,
      hallucinationCount: result.hallucinations?.length ?? 0,
    })

    return {
      isGrounded: result.score >= 0.7,
      groundednessScore: result.score ?? 0.5,
      citations: result.citations ?? [],
      hallucinations: result.hallucinations ?? [],
    }
  } catch (error) {
    logger.warn('[SelfRAG]', 'Groundedness check failed', {
      error: error instanceof Error ? error.message : String(error),
    })
    // 검증 실패 시 보수적으로 처리
    return {
      isGrounded: false,
      groundednessScore: 0.5,
      citations: [],
      hallucinations: ['Verification failed'],
    }
  }
}

// =============================================================================
// [P3-02] LLM 호출 / 파싱 유틸리티
// =============================================================================

/**
 * Self-RAG용 LLM 호출
 */
async function callLLMForSelfRAG(prompt: string, modelId: string): Promise<string> {
  const response = await generateText(prompt, {
    model: modelId,
    temperature: 0.1,  // 결정적 응답
    maxOutputTokens: 1000,
  })

  logger.debug('[SelfRAG]', 'LLM call completed', {
    tokensUsed: response.tokensUsed ?? 'N/A',
  })

  return response.text
}

/**
 * Self-RAG JSON 응답 파싱 (검색 필요 여부)
 */
function parseSelfRAGResponse(text: string): { needed: boolean; confidence: number; reason: string } {
  const defaultResult = { needed: true, confidence: 0.5, reason: 'Parse failed' }

  try {
    // JSON 직접 파싱
    const parsed = JSON.parse(text.trim())
    if (typeof parsed.needed === 'boolean') {
      return parsed
    }
  } catch {
    // 코드블록 내 JSON 추출 시도
    const match = text.match(/\{[\s\S]*?\}/)
    if (match) {
      try {
        const parsed = JSON.parse(match[0])
        if (typeof parsed.needed === 'boolean') {
          return parsed
        }
      } catch {
        // 파싱 실패
      }
    }
  }

  return defaultResult
}

/**
 * Critique 응답 파싱
 */
function parseCritiqueResponse(text: string): Array<{ index: number; score: number; critique: string }> {
  try {
    const jsonMatch = text.match(/\[[\s\S]*\]/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])
      if (Array.isArray(parsed)) {
        return parsed
      }
    }
  } catch {
    // 파싱 실패
  }
  return []
}

/**
 * Groundedness 응답 파싱
 */
function parseGroundednessResponse(text: string): { score: number; citations: string[]; hallucinations: string[] } {
  const defaultResult = { score: 0.5, citations: [], hallucinations: [] }

  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])
      return {
        score: parsed.score ?? 0.5,
        citations: parsed.citations ?? [],
        hallucinations: parsed.hallucinations ?? [],
      }
    }
  } catch {
    // 파싱 실패
  }

  return defaultResult
}
