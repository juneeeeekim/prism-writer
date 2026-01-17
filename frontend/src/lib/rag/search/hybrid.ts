// =============================================================================
// PRISM Writer - Search Module: Hybrid Search
// =============================================================================
// 파일: frontend/src/lib/rag/search/hybrid.ts
// 역할: 벡터 + 키워드 하이브리드 검색 (캐싱 & Re-ranking 포함)
// 생성일: 2026-01-17 (리팩토링)
// =============================================================================

import { LRUCache, createCacheKey } from '@/lib/cache/lruCache'
import { FEATURE_FLAGS } from '../../../config/featureFlags'
import { rerankResults } from '../rerank'
import { logger } from '@/lib/utils/logger'

import type { SearchResult, HybridSearchOptions } from './types'
import { logRAGSearch } from './logger'
import {
  DEFAULT_TOP_K,
  DEFAULT_VECTOR_WEIGHT,
  DEFAULT_KEYWORD_WEIGHT,
  weightedScoreFusion,
  reciprocalRankFusion
} from './utils'
import { vectorSearch } from './vector'
import { fullTextSearch, fullTextSearchWithRank } from './keyword'
import { patternBasedSearch } from './pattern'

// =============================================================================
// [SECTION 1] 검색 결과 캐시 (Pipeline v5)
// =============================================================================
// 시니어 개발자 주석: 동일 쿼리 반복 검색 최적화
// - 최대 1000개 항목
// - 1시간 TTL (문서 변경 시 영향 고려하여 24시간에서 축소)
// - 사용자별 + 카테고리별 + 쿼리별 캐시 키
// =============================================================================

const searchCache = new LRUCache<SearchResult[]>({
  maxSize: 1000,
  ttlMs: 60 * 60 * 1000, // 1시간
  name: 'SearchCache',
})

// =============================================================================
// [SECTION 2] 하이브리드 검색
// =============================================================================

/**
 * 하이브리드 검색 (벡터 + 키워드)
 * 
 * @description
 * 벡터 검색과 키워드 검색을 결합하여 더 정확한 결과를 제공합니다.
 * RRF 또는 Weighted Score Fusion 알고리즘으로 두 검색 결과를 병합합니다.
 * 
 * @param query - 검색 쿼리
 * @param options - 하이브리드 검색 옵션
 * @returns 병합된 검색 결과
 * 
 * @example
 * ```typescript
 * const results = await hybridSearch("RAG 시스템이란?", {
 *   userId,
 *   topK: 5,
 *   vectorWeight: 0.7,
 *   keywordWeight: 0.3
 * })
 * ```
 */
export async function hybridSearch(
  query: string,
  options: HybridSearchOptions
): Promise<SearchResult[]> {
  // -------------------------------------------------------------------------
  // [P-C03-02] 성능 측정 시작
  // -------------------------------------------------------------------------
  const startTime = Date.now()

  const {
    topK = DEFAULT_TOP_K,
    vectorWeight = DEFAULT_VECTOR_WEIGHT,
    keywordWeight = DEFAULT_KEYWORD_WEIGHT,
    patternType, // [PATTERN] 패턴 타입 추출
    ...baseOptions
  } = options

  // -------------------------------------------------------------------------
  // [PATTERN] 패턴 기반 검색 분기
  // -------------------------------------------------------------------------
  if (FEATURE_FLAGS.ENABLE_PATTERN_BASED_SEARCH && patternType && baseOptions.projectId) {
    logger.info('[Search]', `Pattern-based search for type: ${patternType}`)
    return await patternBasedSearch(query, {
      ...baseOptions,
      topK,
      patternType,
    })
  }

  // -------------------------------------------------------------------------
  // [Pipeline v5] 0. 검색 캐시 확인
  // -------------------------------------------------------------------------
  const cacheKey = createCacheKey(
    'hybrid',
    query,
    baseOptions.userId,
    baseOptions.category || 'all',
    topK,
    vectorWeight,
    keywordWeight
  )

  // 캐시 적중 시 반환
  const cachedResult = searchCache.get(cacheKey)
  if (cachedResult) {
    logger.info('[Search]', `Cache HIT for "${query}"`, { category: baseOptions.category || 'all' })

    // 캐시 히트 로깅 (fire-and-forget)
    logRAGSearch({
      userId: baseOptions.userId,
      projectId: baseOptions.projectId,
      query,
      searchMethod: 'hybrid',
      resultCount: cachedResult.length,
      topScore: cachedResult.length > 0 ? cachedResult[0].score : null,
      latencyMs: Date.now() - startTime,
      cacheHit: true,
      cacheKey,
    }).catch(() => {})

    return cachedResult
  }

  logger.info('[Search]', `Cache MISS for "${query}" - Executing Hybrid Search...`)

  // -------------------------------------------------------------------------
  // [STEP 1] 검색 실행 with try-catch for error logging
  // -------------------------------------------------------------------------
  try {
    // -------------------------------------------------------------------------
    // [Step 1-1] 병렬로 벡터 검색과 키워드 검색 실행
    // [P2-01] Feature Flag에 따라 키워드 검색 함수 분기
    // -------------------------------------------------------------------------
    const searchStartTime = Date.now()

    let vectorResults: SearchResult[]
    let keywordResults: SearchResult[]

    if (FEATURE_FLAGS.ENABLE_WEIGHTED_HYBRID_SEARCH) {
      // [P2-01] Weighted Score Fusion 모드: fullTextSearchWithRank 사용
      logger.info('[HybridSearch]', 'Using Weighted Score Fusion mode')
      ;[vectorResults, keywordResults] = await Promise.all([
        vectorSearch(query, { ...baseOptions, topK: topK * 2 }),
        fullTextSearchWithRank(query, { ...baseOptions, topK: topK * 2 }).catch(() => [])
      ])
    } else {
      // [Legacy] RRF 모드: 기존 fullTextSearch 사용
      ;[vectorResults, keywordResults] = await Promise.all([
        vectorSearch(query, { ...baseOptions, topK: topK * 2 }),
        fullTextSearch(query, { ...baseOptions, topK: topK * 2 }).catch(() => [])
      ])
    }

    const searchLatencyMs = Date.now() - searchStartTime

    // -------------------------------------------------------------------------
    // [Step 1-2] 결과 병합
    // [P2-01] Feature Flag에 따라 병합 알고리즘 분기
    // -------------------------------------------------------------------------
    let mergedResults: SearchResult[]

    if (FEATURE_FLAGS.ENABLE_WEIGHTED_HYBRID_SEARCH) {
      // [P2-01-03] Weighted Score Fusion (RRF 대체)
      mergedResults = weightedScoreFusion(
        vectorResults,
        keywordResults,
        vectorWeight,
        keywordWeight,
        topK
      )
    } else {
      // [Legacy] 가중치 적용 후 RRF 병합
      const weightedVectorResults = vectorResults.map((result) => ({
        ...result,
        score: result.score * vectorWeight,
      }))

      const weightedKeywordResults = keywordResults.map((result) => ({
        ...result,
        score: result.score * keywordWeight,
      }))

      mergedResults = reciprocalRankFusion(
        [weightedVectorResults, weightedKeywordResults],
        topK
      )
    }

    // -------------------------------------------------------------------------
    // [Pipeline v5] 4. 결과 캐싱
    // -------------------------------------------------------------------------
    searchCache.set(cacheKey, mergedResults)

    // -------------------------------------------------------------------------
    // [P-C03-02] 성공 로깅 (fire-and-forget)
    // -------------------------------------------------------------------------
    const totalLatencyMs = Date.now() - startTime
    logRAGSearch({
      userId: baseOptions.userId,
      projectId: baseOptions.projectId,
      query,
      searchMethod: 'hybrid',
      resultCount: mergedResults.length,
      topScore: mergedResults.length > 0 ? mergedResults[0].score : null,
      latencyMs: totalLatencyMs,
      searchLatencyMs,
      cacheHit: false,
      cacheKey,
      metadata: {
        vectorResultCount: vectorResults.length,
        keywordResultCount: keywordResults.length,
        vectorWeight,
        keywordWeight,
      },
    }).catch(() => {})

    // -------------------------------------------------------------------------
    // [P2-02-02] Re-ranking (Feature Flag 기반)
    // -------------------------------------------------------------------------
    // 시니어 개발자 주석: rerank 실패 시에도 mergedResults 반환 (graceful degradation)
    if (FEATURE_FLAGS.ENABLE_RERANKING && mergedResults.length > 0) {
      try {
        logger.info('[HybridSearch]', 'Applying Re-ranking', { 
          candidateCount: mergedResults.length,
          model: FEATURE_FLAGS.RERANK_MODEL 
        })
        
        const rerankedResults = await rerankResults(query, mergedResults, {
          model: FEATURE_FLAGS.RERANK_MODEL,
          topK,
        })
        
        return rerankedResults
      } catch (rerankError) {
        // 주니어 개발자 주석: rerank 실패 시 원본 결과 반환
        logger.error('[HybridSearch]', 'Re-ranking failed, using original results', {
          error: rerankError instanceof Error ? rerankError.message : String(rerankError)
        })
        return mergedResults
      }
    }

    return mergedResults

  } catch (error) {
    // -------------------------------------------------------------------------
    // [P-C03-02] 에러 로깅 (fire-and-forget)
    // -------------------------------------------------------------------------
    const errorMessage = error instanceof Error ? error.message : String(error)
    logRAGSearch({
      userId: baseOptions.userId,
      projectId: baseOptions.projectId,
      query,
      searchMethod: 'hybrid',
      resultCount: 0,
      latencyMs: Date.now() - startTime,
      cacheHit: false,
      error: errorMessage,
      errorCode: 'HYBRID_SEARCH_ERROR',
    }).catch(() => {})

    throw error  // 원래 에러 재throw
  }
}

// =============================================================================
// [EXPORT] 캐시 인스턴스 (테스트/디버깅용)
// =============================================================================
export { searchCache }
