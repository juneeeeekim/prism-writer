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
import type { SearchResult } from './search'

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
    console.log(`[Rerank] Skipping: candidates (${candidates.length}) <= topK (${topK})`)
    return candidates
  }

  // ---------------------------------------------------------------------------
  // [Core] 상위 N개만 재평가 (비용 최적화)
  // ---------------------------------------------------------------------------
  const rerankCandidates = FEATURE_FLAGS.RERANK_TOP_CANDIDATES || DEFAULT_RERANK_CANDIDATES
  const toRerank = candidates.slice(0, Math.min(candidates.length, rerankCandidates))

  console.log(`[Rerank] Evaluating ${toRerank.length} candidates with ${model}`)

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
    console.log(`[Rerank] Before: [${originalTopIds.join(', ')}]`)
    console.log(`[Rerank] After:  [${rerankedTopIds.join(', ')}]`)

    return reranked

  } catch (error) {
    // -------------------------------------------------------------------------
    // [Fallback] 실패 시 원본 결과 반환
    // -------------------------------------------------------------------------
    console.error('[Rerank] Failed, returning original results:', error)
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
 * @param prompt - LLM 프롬프트
 * @param model - 사용할 모델
 * @param timeout - 타임아웃 (ms)
 * @returns 관련도 점수 배열 [0.0 ~ 1.0]
 */
async function callLLMForRerank(
  prompt: string,
  model: 'gemini' | 'openai',
  timeout: number
): Promise<number[]> {
  // ---------------------------------------------------------------------------
  // [Implementation] 실제 LLM 호출
  // ---------------------------------------------------------------------------
  // 현재는 Placeholder - 실제 구현 시 Gemini/OpenAI API 호출
  // Phase 2 완료 후 실제 LLM 연동 예정
  // ---------------------------------------------------------------------------

  console.log(`[Rerank] Calling ${model} LLM (timeout: ${timeout}ms)...`)

  // TODO: 실제 LLM API 호출 구현
  // 현재는 원본 점수 유지를 위해 빈 배열 반환
  // 이렇게 하면 rerankResults에서 fallback으로 원본 점수 사용
  
  // [Placeholder] 실제 구현 전까지는 빈 배열 (원본 점수 유지)
  return []

  /* 실제 구현 예시:
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeout)

  try {
    if (model === 'gemini') {
      const response = await fetch('/api/rerank', {
        method: 'POST',
        body: JSON.stringify({ prompt }),
        signal: controller.signal
      })
      const { scores } = await response.json()
      return scores
    } else {
      // OpenAI 구현
    }
  } finally {
    clearTimeout(timeoutId)
  }
  */
}

// =============================================================================
// Export
// =============================================================================

export type { RerankMetadata }
