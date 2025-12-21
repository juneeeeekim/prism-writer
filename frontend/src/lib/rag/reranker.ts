// =============================================================================
// PRISM Writer - Reranker
// =============================================================================
// 파일: frontend/src/lib/rag/reranker.ts
// 역할: LLM 기반 검색 결과 리랭킹 (선택 기능)
// Pipeline v3 업그레이드: Example-Specific Re-ranking 추가
// =============================================================================

import OpenAI from 'openai'
import type { SearchResult } from './search'
import { hasQuotes, hasDialogue, hasNumericData } from './chunking'

// =============================================================================
// 타입 정의
// =============================================================================

/** 리랭킹 옵션 */
export interface RerankOptions {
  /** 최대 결과 개수 (리랭킹 후) */
  topK?: number
  /** 모델 (기본: gpt-3.5-turbo) */
  model?: string
  /** 배치 크기 (한 번에 처리할 청크 수) */
  batchSize?: number
  /** Pipeline v3: 예시 가중치 적용 여부 (기본: true) */
  applyExampleBoost?: boolean
}

/** 리랭킹 결과 */
interface RerankResult {
  /** 청크 ID */
  chunkId: string
  /** 관련성 점수 (0~1) */
  relevanceScore: number
}

/** Pipeline v3: 예시 리랭킹 설정 */
export interface ExampleRerankerConfig {
  /** 따옴표 포함 시 가중치 (기본: 1.2) */
  quoteBoost: number
  /** 대화체 포함 시 가중치 (기본: 1.1) */
  dialogueBoost: number
  /** 구체적 수치 포함 시 가중치 (기본: 1.15) */
  numericBoost: number
}

/** 기본 예시 리랭킹 설정 */
export const DEFAULT_EXAMPLE_RERANKER_CONFIG: ExampleRerankerConfig = {
  quoteBoost: 1.2,
  dialogueBoost: 1.1,
  numericBoost: 1.15,
}

// =============================================================================
// 상수
// =============================================================================

/** 기본 모델 */
const DEFAULT_MODEL = 'gpt-3.5-turbo'

/** 기본 Top-K */
const DEFAULT_TOP_K = 5

/** 기본 배치 크기 */
const DEFAULT_BATCH_SIZE = 10

// =============================================================================
// OpenAI 클라이언트 초기화
// =============================================================================

let openaiClient: OpenAI | null = null

/**
 * OpenAI 클라이언트 가져오기 (지연 초기화)
 */
function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    const apiKey = process.env.OPENAI_API_KEY

    if (!apiKey) {
      throw new Error(
        'OPENAI_API_KEY 환경 변수가 설정되지 않았습니다. ' +
        '.env.local 파일에 OPENAI_API_KEY를 추가해주세요.'
      )
    }

    openaiClient = new OpenAI({
      apiKey,
    })
  }

  return openaiClient
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * LLM을 사용하여 쿼리-청크 관련성 평가
 * 
 * @param query - 검색 쿼리
 * @param chunk - 청크 내용
 * @param model - 사용할 모델
 * @returns 관련성 점수 (0~1)
 */
async function evaluateRelevance(
  query: string,
  chunk: string,
  model: string
): Promise<number> {
  const client = getOpenAIClient()

  // ---------------------------------------------------------------------------
  // 프롬프트 구성
  // ---------------------------------------------------------------------------
  const prompt = `다음 쿼리와 텍스트의 관련성을 0~1 사이의 숫자로 평가해주세요.

쿼리: "${query}"

텍스트: "${chunk.substring(0, 500)}" ${chunk.length > 500 ? '...' : ''}

평가 기준:
- 1.0: 매우 관련성이 높음 (쿼리에 직접적으로 답함)
- 0.7~0.9: 관련성이 있음 (쿼리와 관련된 정보 포함)
- 0.4~0.6: 약간 관련성 있음 (간접적으로 관련)
- 0~0.3: 관련성이 낮음

숫자만 답변해주세요 (예: 0.85):`

  // ---------------------------------------------------------------------------
  // LLM 호출
  // ---------------------------------------------------------------------------
  try {
    const response = await client.chat.completions.create({
      model,
      messages: [
        {
          role: 'system',
          content: '당신은 텍스트 관련성 평가 전문가입니다. 숫자만 답변해주세요.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0, // 일관성을 위해 temperature를 0으로 설정
      max_tokens: 10,
    })

    const content = response.choices[0]?.message?.content?.trim()
    if (!content) {
      throw new Error('LLM 응답이 비어있습니다.')
    }

    // ---------------------------------------------------------------------------
    // 점수 파싱
    // ---------------------------------------------------------------------------
    const score = parseFloat(content)
    if (isNaN(score) || score < 0 || score > 1) {
      console.warn(`Invalid relevance score: ${content}, defaulting to 0.5`)
      return 0.5
    }

    return score
  } catch (error) {
    console.error('Failed to evaluate relevance:', error)
    // 에러 시 중간 점수 반환
    return 0.5
  }
}

// =============================================================================
// Main Reranking Function
// =============================================================================

/**
 * LLM 기반 검색 결과 리랭킹
 * 
 * @description
 * 검색 결과를 LLM을 사용하여 쿼리와의 관련성 기준으로 재정렬합니다.
 * 배치 처리를 지원하여 비용 효율성을 높입니다.
 * 
 * @param query - 검색 쿼리
 * @param results - 검색 결과 배열
 * @param options - 리랭킹 옵션
 * @returns 리랭킹된 검색 결과
 * 
 * @example
 * ```typescript
 * const searchResults = await hybridSearch(query, { userId, topK: 20 })
 * const reranked = await rerank(query, searchResults, { topK: 5 })
 * ```
 */
export async function rerank(
  query: string,
  results: SearchResult[],
  options: RerankOptions = {}
): Promise<SearchResult[]> {
  const {
    topK = DEFAULT_TOP_K,
    model = DEFAULT_MODEL,
    batchSize = DEFAULT_BATCH_SIZE,
  } = options

  // ---------------------------------------------------------------------------
  // 1. 결과가 비어있거나 Top-K보다 적으면 그대로 반환
  // ---------------------------------------------------------------------------
  if (results.length === 0 || results.length <= topK) {
    return results.slice(0, topK)
  }

  // ---------------------------------------------------------------------------
  // 2. 배치 처리로 관련성 평가
  // ---------------------------------------------------------------------------
  const rerankResults: RerankResult[] = []

  for (let i = 0; i < results.length; i += batchSize) {
    const batch = results.slice(i, i + batchSize)

    // 배치 내 모든 청크의 관련성 평가 (병렬)
    const batchEvaluations = await Promise.all(
      batch.map(async (result) => {
        const relevanceScore = await evaluateRelevance(
          query,
          result.content,
          model
        )

        return {
          chunkId: result.chunkId,
          relevanceScore,
        }
      })
    )

    rerankResults.push(...batchEvaluations)

    // 진행 상황 로그
    console.log(
      `Reranking progress: ${Math.min(i + batchSize, results.length)}/${results.length}`
    )
  }

  // ---------------------------------------------------------------------------
  // 3. 관련성 점수 기준으로 정렬
  // ---------------------------------------------------------------------------
  const sortedResults = rerankResults
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, topK)

  // ---------------------------------------------------------------------------
  // 4. 원본 결과와 병합
  // ---------------------------------------------------------------------------
  const rerankedResults: SearchResult[] = sortedResults
    .map((rerankResult) => {
      const originalResult = results.find(
        (r) => r.chunkId === rerankResult.chunkId
      )
      if (!originalResult) return null

      return {
        ...originalResult,
        score: rerankResult.relevanceScore, // 새로운 관련성 점수로 교체
      }
    })
    .filter((r): r is SearchResult => r !== null)

  return rerankedResults
}

// =============================================================================
// Utility: Simple Reranking (빠른 버전)
// =============================================================================

/**
 * 간단한 리랭킹 (점수 기반만 사용)
 * 
 * @description
 * LLM을 사용하지 않고, 기존 점수만으로 재정렬합니다.
 * 빠른 성능이 필요할 때 사용합니다.
 * 
 * @param results - 검색 결과 배열
 * @param topK - 반환할 결과 개수
 * @returns 상위 K개 결과
 */
export function simpleRerank(
  results: SearchResult[],
  topK: number = DEFAULT_TOP_K
): SearchResult[] {
  return results
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
}

// =============================================================================
// Pipeline v3: Example-Specific Re-ranking
// =============================================================================

/**
 * 예시 특화 가중치 적용 (Pipeline v3)
 * 
 * @description
 * 따옴표, 대화체, 구체적 수치가 포함된 청크에 가중치를 주어
 * 예시 채굴의 정확도를 높입니다.
 * 
 * @param results - 검색 결과 배열
 * @param config - 예시 리랭킹 설정 (선택)
 * @returns 점수가 조정된 검색 결과
 * 
 * @example
 * ```typescript
 * const boostedResults = applyExampleBoost(results, {
 *   quoteBoost: 1.2,
 *   dialogueBoost: 1.1,
 *   numericBoost: 1.15
 * })
 * ```
 */
export function applyExampleBoost(
  results: SearchResult[],
  config: ExampleRerankerConfig = DEFAULT_EXAMPLE_RERANKER_CONFIG
): SearchResult[] {
  // 원본 배열을 변경하지 않기 위해 새 배열 생성
  return results.map((result) => {
    let boostedScore = result.score
    
    // ---------------------------------------------------------------------------
    // 가중치 적용 (중복 적용 가능)
    // ---------------------------------------------------------------------------
    if (hasQuotes(result.content)) {
      boostedScore *= config.quoteBoost
    }
    
    if (hasDialogue(result.content)) {
      boostedScore *= config.dialogueBoost
    }
    
    if (hasNumericData(result.content)) {
      boostedScore *= config.numericBoost
    }
    
    return {
      ...result,
      score: boostedScore,
    }
  }).sort((a, b) => b.score - a.score) // 새로운 점수로 재정렬
}

