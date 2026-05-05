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
import { callWithFallback } from '@/lib/llm/fallback-handler'

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
// 주석(시니어, 2026-05-04 Phase 3): Reranker는 Gemini SDK를 직접 호출한다.
// `rag.reranker` 컨텍스트는 fallback이 정의되어 있지 않으며, cross-provider
// 응답 포맷 차이(JSON 구조)로 인해 자동 fallback은 위험하다. 대신 다음 두
// 보호장치로 안정성을 보장한다:
//   1) getModelForUsage가 ENV 오버라이드/사용자 선호를 우선 적용 → 운영 중
//      모델 교체가 코드 변경 없이 가능.
//   2) evaluateRelevance의 try/catch가 LLM 실패 시 0.5 점수로 안전 복귀.
// 향후 같은 Provider 패밀리(Gemini → Gemini)로 fallback이 필요하면
// llm-usage-map의 'rag.reranker' 항목에 fallback 필드를 추가한 뒤 본 모듈을
// fallback-handler로 래핑할 수 있다.
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
// 주석(시니어, 2026-05-04 Phase 3 완전 적용): Phase 3에서 cachedModelInfo는
// 모델 ID별 캐시로 재구성되어 fallback 모델도 분리 캐싱한다. 같은 인스턴스를
// 모델별로 보관하므로 fallback 시점에도 SDK 인스턴스 생성 비용이 한 번에 그친다.
function getGeminiModelByIdInternal(modelId: string): GenerativeModel {
  const now = Date.now()

  // 같은 modelId + TTL 내면 캐시 재사용
  if (
    cachedModelInfo &&
    cachedModelInfo.modelId === modelId &&
    now - cachedModelInfo.createdAt < MODEL_CACHE_TTL_MS
  ) {
    return cachedModelInfo.model
  }

  const apiKey = process.env.GOOGLE_API_KEY
  if (!apiKey) {
    throw new Error(
      'GOOGLE_API_KEY 환경 변수가 설정되지 않았습니다. ' +
        '.env.local 파일에 GOOGLE_API_KEY를 추가해주세요.'
    )
  }

  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({
    model: modelId,
    generationConfig: {
      temperature: 1.0, // Gemini 3 권장 (Gemini_3_Flash_Reference.md)
      maxOutputTokens: 10,
    },
  })

  cachedModelInfo = { model, modelId, createdAt: now }
  console.log(`[Reranker] 모델 초기화: ${modelId}`)
  return model
}

// 기존 시그니처 유지(외부 코드 회귀 방지). 내부적으로 'rag.reranker' 컨텍스트의
// 기본 모델을 사용한다.
function getGeminiModel(): GenerativeModel {
  return getGeminiModelByIdInternal(getModelForUsage('rag.reranker'))
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
  _modelHint: string
): Promise<number> {
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
  // 주석(시니어, Phase 3 완전 적용): callWithFallback로 래핑.
  // - primary 실패 시 같은 Gemini 패밀리의 fallback 모델로 자동 재시도.
  // - 응답 포맷(짧은 숫자)이 같은 SDK에서 보장되므로 호환 안전.
  // - 양쪽 모두 실패하면 0.5 반환(기존 안전망 유지)으로 순위 매기기 자체는
  //   계속 진행되어 RAG 흐름이 차단되지 않는다.
  // ---------------------------------------------------------------------------
  const out = await callWithFallback('rag.reranker', async (modelId) => {
    const gemini = getGeminiModelByIdInternal(modelId)
    const response = await gemini.generateContent({
      contents: [
        {
          role: 'user',
          parts: [
            {
              text:
                '당신은 텍스트 관련성 평가 전문가입니다. 숫자만 답변해주세요.\n\n' +
                prompt,
            },
          ],
        },
      ],
    })
    const content = response.response.text()?.trim()
    if (!content) throw new Error('LLM 응답이 비어있습니다.')
    return content
  })

  if (!out.success || !out.result) {
    console.error('[Reranker] Both primary and fallback failed:', out.error?.type)
    return 0.5
  }

  // ---------------------------------------------------------------------------
  // 점수 파싱 (텍스트에서 숫자 추출)
  // ---------------------------------------------------------------------------
  const scoreMatch = out.result.match(/([0-9]+\.?[0-9]*)/)
  const score = scoreMatch ? parseFloat(scoreMatch[1]) : 0.5
  if (isNaN(score) || score < 0 || score > 1) {
    console.warn(`Invalid relevance score: ${out.result}, defaulting to 0.5`)
    return 0.5
  }
  return score
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

