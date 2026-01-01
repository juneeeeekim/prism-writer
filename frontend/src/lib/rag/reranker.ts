// =============================================================================
// PRISM Writer - Reranker
// =============================================================================
// 파일: frontend/src/lib/rag/reranker.ts
// 역할: LLM 기반 검색 결과 리랭킹 (선택 기능)
// Pipeline v3 업그레이드: Example-Specific Re-ranking 추가
// Pipeline v4: Gemini 3 Flash로 업그레이드 (2025-12-25)
// Pipeline v5: 모델 동적 로딩 및 캐시 갱신 구현 (설정 변경 시 재시작 불필요)
// =============================================================================

import { GoogleGenerativeAI, type GenerativeModel } from '@google/generative-ai'
import type { SearchResult } from './search'
import { hasQuotes, hasDialogue, hasNumericData } from './chunking'
import { getModelForUsage } from '@/config/llm-usage-map'

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

// ❌ (중앙화 마이그레이션 2025-12-28)
// const DEFAULT_MODEL = 'gemini-3-flash-preview'
// 대신 getModelForUsage('rag.reranker') 직접 호출

/** 기본 Top-K */
const DEFAULT_TOP_K = 5

/** 기본 배치 크기 */
const DEFAULT_BATCH_SIZE = 10

// =============================================================================
// Gemini 클라이언트 초기화 (Pipeline v5: 동적 모델 로딩)
// =============================================================================

// ---------------------------------------------------------------------------
// 주석(시니어 개발자): Pipeline v5 - 모델 동적 로딩 및 캐시 갱신 구현
// - 기존 문제: 모듈 레벨 캐싱으로 설정 변경 시 앱 재시작 필요
// - 해결책: 모델 ID 기반 캐시 키로 설정 변경 감지 + 수동 캐시 무효화 함수 제공
// ---------------------------------------------------------------------------

/** 캐시된 모델 정보 */
interface CachedModel {
  model: GenerativeModel
  modelId: string
  createdAt: number
}

let cachedModelInfo: CachedModel | null = null

/** 캐시 TTL (기본: 5분) - 설정 변경 감지 주기 */
const MODEL_CACHE_TTL_MS = 5 * 60 * 1000

/**
 * Gemini 모델 가져오기 (동적 캐시 관리)
 *
 * @description
 * Pipeline v5 개선:
 * - 모델 ID 변경 시 자동으로 새 인스턴스 생성
 * - 캐시 TTL로 주기적 설정 변경 감지
 * - invalidateRerankerCache()로 수동 캐시 무효화 가능
 *
 * 주석(LLM 전문 개발자): Gemini 3 Flash 기본 사용
 * 주석(중앙화 마이그레이션): getModelForUsage 적용
 */
function getGeminiModel(): GenerativeModel {
  const currentModelId = getModelForUsage('rag.reranker')
  const now = Date.now()

  // 캐시 유효성 검사: 모델 ID 변경 또는 TTL 초과 시 재생성
  const isCacheValid = cachedModelInfo &&
    cachedModelInfo.modelId === currentModelId &&
    (now - cachedModelInfo.createdAt) < MODEL_CACHE_TTL_MS

  if (isCacheValid && cachedModelInfo) {
    return cachedModelInfo.model
  }

  // 새 모델 인스턴스 생성
  const apiKey = process.env.GOOGLE_API_KEY

  if (!apiKey) {
    throw new Error(
      'GOOGLE_API_KEY 환경 변수가 설정되지 않았습니다. ' +
      '.env.local 파일에 GOOGLE_API_KEY를 추가해주세요.'
    )
  }

  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({
    model: currentModelId,
    generationConfig: {
      temperature: 1.0,  // Gemini 3 권장 (Gemini_3_Flash_Reference.md)
      maxOutputTokens: 10,
    },
  })

  // 캐시 업데이트
  cachedModelInfo = {
    model,
    modelId: currentModelId,
    createdAt: now,
  }

  console.log(`[Reranker] 모델 초기화: ${currentModelId}`)

  return model
}

/**
 * Reranker 모델 캐시 무효화
 *
 * @description
 * 설정 변경 후 즉시 새 모델을 사용해야 할 때 호출합니다.
 * 다음 getGeminiModel() 호출 시 새 인스턴스가 생성됩니다.
 *
 * @example
 * ```typescript
 * // 설정 변경 후
 * invalidateRerankerCache()
 * // 다음 rerank() 호출 시 새 모델 사용
 * ```
 */
export function invalidateRerankerCache(): void {
  cachedModelInfo = null
  console.log('[Reranker] 모델 캐시 무효화됨')
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * LLM을 사용하여 쿼리-청크 관련성 평가
 * 주석(LLM 전문 개발자): Gemini 3 Flash로 업그레이드 (2025-12-25)
 * 
 * @param query - 검색 쿼리
 * @param chunk - 청크 내용
 * @param model - 사용할 모델 (unused, Gemini 사용)
 * @returns 관련성 점수 (0~1)
 */
async function evaluateRelevance(
  query: string,
  chunk: string,
  model: string
): Promise<number> {
  const gemini = getGeminiModel()

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
  // Gemini 3 Flash 호출
  // ---------------------------------------------------------------------------
  try {
    const response = await gemini.generateContent({
      contents: [{
        role: 'user',
        parts: [{ text: '당신은 텍스트 관련성 평가 전문가입니다. 숫자만 답변해주세요.\n\n' + prompt }]
      }],
    })

    const content = response.response.text()?.trim()
    if (!content) {
      throw new Error('LLM 응답이 비어있습니다.')
    }

    // ---------------------------------------------------------------------------
    // 점수 파싱
    // ---------------------------------------------------------------------------
    // 숫자만 추출 (텍스트가 포함될 수 있음)
    const scoreMatch = content.match(/([0-9]+\.?[0-9]*)/)
    const score = scoreMatch ? parseFloat(scoreMatch[1]) : 0.5
    
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
    model = getModelForUsage('rag.reranker'),
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

