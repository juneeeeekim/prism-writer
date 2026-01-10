// =============================================================================
// PRISM Writer - Re-ranking Module
// =============================================================================
// 파일: frontend/src/lib/rag/rerank.ts
// 역할: LLM 기반 검색 결과 재정렬 (Cross-Encoder 대안)
// 생성일: 2026-01-05
// 
// [P2-02-01] 체크리스트 구현:
// - 1차 검색 결과 상위 N개를 LLM으로 재평가
// - 쿼리-문서 관련도 점수 (0.0 ~ 1.0) 반환
// - Feature Flag로 기존 로직과 토글 가능
// =============================================================================

import { FEATURE_FLAGS } from '@/config/featureFlags'
import { logger } from '@/lib/utils/logger'
import { generateText } from '@/lib/llm/gateway'
import type { SearchResult } from './search'
// P2-03-A: LLM 중앙 관리 마이그레이션 (2026-01-10)
import { getModelForUsage } from '@/config/llm-usage-map'

// =============================================================================
// 타입 정의
// =============================================================================

/**
 * Re-ranking 옵션
 */
export interface RerankOptions {
  /** 사용할 LLM 모델 */
  model?: 'gemini' | 'openai'
  /** 최종 반환 개수 */
  topK?: number
  /** LLM 호출 배치 크기 */
  batchSize?: number
  /** 타임아웃 (ms) */
  timeout?: number
}

/**
 * Re-ranking 결과 메타데이터
 */
interface RerankMetadata {
  originalRank: number
  rerankScore: number
  rerankModel: string
}

// =============================================================================
// 상수
// =============================================================================

/** 재평가 대상 최대 개수 */
const DEFAULT_RERANK_CANDIDATES = 20

/** 기본 타임아웃 (ms) */
const DEFAULT_TIMEOUT = 10000

/** 기본 배치 크기 */
const DEFAULT_BATCH_SIZE = 10

// =============================================================================
// [P2-02-01] rerankResults 함수
// =============================================================================

/**
 * LLM 기반 검색 결과 재정렬
 * 
 * @description
 * 1차 검색 결과의 상위 N개를 LLM으로 재평가하여
 * 쿼리-문서 관련도를 정밀하게 측정합니다.
 * 
 * @param query - 검색 쿼리
 * @param candidates - 1차 검색 결과
 * @param options - Re-ranking 옵션
 * @returns 재정렬된 검색 결과
 * 
 * @example
 * ```typescript
 * const results = await hybridSearch(query, options)
 * const reranked = await rerankResults(query, results, { topK: 5 })
 * ```
 */
export async function rerankResults(
  query: string,
  candidates: SearchResult[],
  options: RerankOptions = {}
): Promise<SearchResult[]> {
  const {
    model = FEATURE_FLAGS.RERANK_MODEL,
    topK = 5,
    timeout = DEFAULT_TIMEOUT
  } = options

  // ---------------------------------------------------------------------------
  // [Safety] 조기 반환 조건
  // ---------------------------------------------------------------------------
  
  // 후보가 topK 이하면 rerank 불필요
  if (candidates.length <= topK) {
    logger.debug('[Rerank]', `Skipping: candidates (${candidates.length}) <= topK (${topK})`)
    return candidates
  }

  // ---------------------------------------------------------------------------
  // [Core] 상위 N개만 재평가 (비용 최적화)
  // ---------------------------------------------------------------------------
  const rerankCandidates = FEATURE_FLAGS.RERANK_TOP_CANDIDATES || DEFAULT_RERANK_CANDIDATES
  const toRerank = candidates.slice(0, Math.min(candidates.length, rerankCandidates))

  logger.info('[Rerank]', `Evaluating ${toRerank.length} candidates with ${model}`)

  try {
    // -------------------------------------------------------------------------
    // [Step 1] LLM 프롬프트 생성
    // -------------------------------------------------------------------------
    const prompt = buildRerankPrompt(query, toRerank)

    // -------------------------------------------------------------------------
    // [Step 2] LLM 호출 (with timeout)
    // -------------------------------------------------------------------------
    const scores = await callLLMForRerank(prompt, model, timeout)

    // -------------------------------------------------------------------------
    // [Step 3] 점수 기반 재정렬
    // -------------------------------------------------------------------------
    const reranked = toRerank
      .map((result, index) => ({
        ...result,
        score: scores[index] ?? result.score, // fallback to original
        metadata: {
          ...result.metadata,
          _rerank: {
            originalRank: index + 1,
            rerankScore: scores[index] ?? result.score,
            rerankModel: model
          } as RerankMetadata
        }
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)

    // 로그: rerank 전/후 비교
    const originalTopIds = toRerank.slice(0, 5).map(r => r.chunkId.slice(0, 8))
    const rerankedTopIds = reranked.slice(0, 5).map(r => r.chunkId.slice(0, 8))
    logger.debug('[Rerank]', 'Before', { topIds: originalTopIds })
    logger.debug('[Rerank]', 'After', { topIds: rerankedTopIds })

    return reranked

  } catch (error) {
    // -------------------------------------------------------------------------
    // [Fallback] 실패 시 원본 결과 반환
    // -------------------------------------------------------------------------
    logger.error('[Rerank]', 'Failed, returning original results', { error: String(error) })
    return candidates.slice(0, topK)
  }
}

// =============================================================================
// [Helper] LLM 프롬프트 생성
// =============================================================================

/**
 * Re-ranking용 LLM 프롬프트 생성
 * 
 * @param query - 검색 쿼리
 * @param docs - 재평가 대상 문서들
 * @returns LLM 프롬프트 문자열
 */
function buildRerankPrompt(query: string, docs: SearchResult[]): string {
  const docList = docs
    .map((d, i) => {
      // 내용 200자로 제한
      const truncatedContent = d.content.length > 200 
        ? d.content.substring(0, 200) + '...' 
        : d.content
      return `[${i}] ${truncatedContent}`
    })
    .join('\n\n')

  return `You are a search relevance evaluator. Score how relevant each document is to the query.

Query: "${query}"

Documents:
${docList}

Instructions:
1. For each document, assign a relevance score from 0.0 (not relevant) to 1.0 (highly relevant)
2. Consider semantic meaning, not just keyword matching
3. Return ONLY a JSON array of scores in order, e.g., [0.8, 0.5, 0.9, ...]

Response (JSON array only):`
}

// =============================================================================
// [Helper] LLM 호출
// =============================================================================

/**
 * LLM을 호출하여 관련도 점수 배열 반환
 * 
 * @description
 * generateText()를 사용하여 LLM에 점수 요청.
 * JSON 파싱 실패 시 정규식 fallback으로 robust하게 처리.
 * [P2-02] 토큰 사용량을 로깅하여 비용 모니터링 가능.
 * 
 * @param prompt - LLM 프롬프트
 * @param model - 사용할 모델 (gemini | openai)
 * @param timeout - 타임아웃 (ms) - 현재 미사용 (generateText 내부 처리)
 * @returns 관련도 점수 배열 [0.0 ~ 1.0]
 */
async function callLLMForRerank(
  prompt: string,
  model: 'gemini' | 'openai',
  timeout: number
): Promise<number[]> {
  // ---------------------------------------------------------------------------
  // [Step 1] 모델 ID 결정
  // ---------------------------------------------------------------------------
  // P2-03-A: LLM 중앙 관리 마이그레이션 - getModelForUsage 적용
  const modelId = getModelForUsage('rag.rerank')

  logger.debug('[Rerank]', `Calling LLM`, { model: modelId, timeout: `${timeout}ms` })

  try {
    // -------------------------------------------------------------------------
    // [Step 2] LLM 호출 (generateText 사용)
    // -------------------------------------------------------------------------
    // 주니어 개발자 주석: temperature 0.1로 결정적 결과 유도
    const response = await generateText(prompt, {
      model: modelId,
      temperature: 0.1,      // 낮은 온도 = 결정적 결과
      maxOutputTokens: 500,  // 짧은 JSON 배열만 필요
    })

    // -------------------------------------------------------------------------
    // [Step 3] 토큰 사용량 로깅 (비용 모니터링)
    // -------------------------------------------------------------------------
    // [P2-02 Review] LLM 비용 모니터링을 위한 로깅
    logger.info('[Rerank]', 'LLM call completed', {
      tokensUsed: response.tokensUsed ?? 'N/A',
      model: modelId,
      finishReason: response.finishReason,
    })

    // -------------------------------------------------------------------------
    // [Step 4] JSON 파싱 (robust)
    // -------------------------------------------------------------------------
    const scores = parseScoresFromLLMResponse(response.text)
    
    if (scores.length === 0) {
      logger.warn('[Rerank]', 'Failed to parse scores, using original', { 
        responsePreview: response.text.substring(0, 100) 
      })
    }

    return scores

  } catch (error) {
    // -------------------------------------------------------------------------
    // [Error] LLM 호출 실패 (타임아웃 포함)
    // -------------------------------------------------------------------------
    // 시니어 개발자 주석: 실패 시 빈 배열 반환 → 원본 점수 유지
    logger.error('[Rerank]', 'LLM call failed', { 
      error: error instanceof Error ? error.message : String(error),
      model: modelId 
    })
    return []  // 빈 배열 → rerankResults에서 fallback으로 원본 점수 사용
  }
}

// =============================================================================
// [Helper] LLM 응답에서 점수 배열 파싱
// =============================================================================

/**
 * LLM 응답 텍스트에서 점수 배열 추출
 * 
 * @description
 * 여러 파싱 전략을 순차적으로 시도하여 robust하게 처리:
 * 1. 직접 JSON.parse
 * 2. JSON 배열 패턴 추출 (마크다운 코드블록 처리)
 * 3. 개별 숫자 추출 (최후 수단)
 * 
 * @param text - LLM 응답 텍스트
 * @returns 점수 배열 (파싱 실패 시 빈 배열)
 */
function parseScoresFromLLMResponse(text: string): number[] {
  // ---------------------------------------------------------------------------
  // [Strategy 1] 직접 JSON.parse
  // ---------------------------------------------------------------------------
  try {
    const trimmed = text.trim()
    const parsed = JSON.parse(trimmed)
    if (Array.isArray(parsed) && parsed.every(n => typeof n === 'number')) {
      logger.debug('[Rerank]', 'Parsed via direct JSON.parse', { count: parsed.length })
      return parsed
    }
  } catch {
    // 파싱 실패 - 다음 전략 시도
  }

  // ---------------------------------------------------------------------------
  // [Strategy 2] JSON 배열 패턴 추출 (마크다운 코드블록 등 처리)
  // ---------------------------------------------------------------------------
  // 패턴: [0.8, 0.5, 0.9] 또는 [ 0.8, 0.5, 0.9 ]
  const jsonMatch = text.match(/\[\s*([\d.,\s]+)\s*\]/)
  if (jsonMatch) {
    try {
      const extracted = JSON.parse(`[${jsonMatch[1]}]`)
      if (Array.isArray(extracted) && extracted.every(n => typeof n === 'number')) {
        logger.debug('[Rerank]', 'Parsed via regex extraction', { count: extracted.length })
        return extracted
      }
    } catch {
      // 파싱 실패 - 다음 전략 시도
    }
  }

  // ---------------------------------------------------------------------------
  // [Strategy 3] 개별 숫자 추출 (최후 수단)
  // ---------------------------------------------------------------------------
  // 주니어 개발자 주석: LLM이 "[0.8], [0.5], [0.9]" 같은 비표준 형식 응답 시 대응
  const numberMatches = text.match(/0\.\d+/g)
  if (numberMatches && numberMatches.length > 0) {
    const numbers = numberMatches.map(Number)
    logger.debug('[Rerank]', 'Parsed via individual number extraction', { count: numbers.length })
    return numbers
  }

  // ---------------------------------------------------------------------------
  // [Fallback] 모든 전략 실패
  // ---------------------------------------------------------------------------
  return []
}

// =============================================================================
// Export
// =============================================================================

export type { RerankMetadata }
