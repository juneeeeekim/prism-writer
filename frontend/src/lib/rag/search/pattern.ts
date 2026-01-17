// =============================================================================
// PRISM Writer - Search Module: Pattern-Based Search
// =============================================================================
// 파일: frontend/src/lib/rag/search/pattern.ts
// 역할: 패턴 타입 기반 청크 검색 (순환 참조 방지를 위해 분리)
// 생성일: 2026-01-17 (리팩토링)
// 
// ⚠️ 중요: 이 파일은 hybridSearch를 import하지 않습니다 (순환 참조 방지)
// 폴백 로직은 호출자(searchByPattern)가 처리합니다.
// =============================================================================

import { createClient } from '@/lib/supabase/server'
import { embedText } from '../embedding'
import { type PatternType } from '../patternExtractor'
import { logger } from '@/lib/utils/logger'

import type { SearchResult, SearchOptions, PatternSearchOptions } from './types'
import { logRAGSearch } from './logger'
import { calculateEvidenceQuality } from './utils'
import { vectorSearch } from './vector'

// =============================================================================
// [SECTION 1] 패턴 기반 검색 (구현체)
// =============================================================================

/**
 * [PATTERN] 패턴 기반 검색
 * 
 * @description
 * pattern_type 컬럼을 필터로 사용하여 특정 패턴의 청크만 검색합니다.
 * 기존 하이브리드 검색과 달리, 패턴 타입으로 먼저 필터링한 후 벡터 검색을 수행합니다.
 * 
 * @param query - 검색 쿼리
 * @param options - 패턴 검색 옵션 (patternType 필수)
 * @returns 검색 결과 배열
 */
export async function patternBasedSearch(
  query: string,
  options: PatternSearchOptions
): Promise<SearchResult[]> {
  // -------------------------------------------------------------------------
  // [P-C03-02] 성능 측정 시작
  // -------------------------------------------------------------------------
  const startTime = Date.now()
  const { userId, topK = 10, minScore = 0.5, patternType, projectId } = options

  // -------------------------------------------------------------------------
  // [SAFETY] 필수 파라미터 검증
  // -------------------------------------------------------------------------
  if (!projectId) {
    logger.error('[PatternSearch]', 'projectId is required for pattern-based search')
    return []
  }

  try {
    // -------------------------------------------------------------------------
    // [STEP 1] 쿼리 임베딩 생성
    // -------------------------------------------------------------------------
    const embeddingStartTime = Date.now()
    const queryEmbedding = await embedText(query)
    const embeddingLatencyMs = Date.now() - embeddingStartTime

    if (!queryEmbedding) {
      logger.error('[PatternSearch]', 'Failed to generate embedding')

      // 임베딩 실패 로깅
      logRAGSearch({
        userId,
        projectId,
        query,
        searchMethod: 'pattern',
        resultCount: 0,
        latencyMs: Date.now() - startTime,
        embeddingLatencyMs,
        cacheHit: false,
        error: 'Failed to generate embedding',
        errorCode: 'EMBEDDING_FAILED',
        metadata: { patternType },
      }).catch(() => {})

      return []
    }

    // -------------------------------------------------------------------------
    // [STEP 2] Supabase RPC 호출 (패턴 필터 포함)
    // -------------------------------------------------------------------------
    const searchStartTime = Date.now()
    const supabase = await createClient()
    const { data, error } = await supabase.rpc('match_document_chunks_by_pattern', {
      query_embedding: queryEmbedding,
      pattern_type_param: patternType,
      project_id_param: projectId,
      user_id_param: userId,
      match_threshold: minScore,
      match_count: topK,
    })
    const searchLatencyMs = Date.now() - searchStartTime

    if (error) {
      logger.error('[PatternSearch]', 'RPC error', { error: error.message })

      // RPC 에러 로깅
      logRAGSearch({
        userId,
        projectId,
        query,
        searchMethod: 'pattern',
        resultCount: 0,
        latencyMs: Date.now() - startTime,
        embeddingLatencyMs,
        searchLatencyMs,
        cacheHit: false,
        error: error.message,
        errorCode: 'PATTERN_RPC_ERROR',
        metadata: { patternType },
      }).catch(() => {})

      // 시니어 개발자 주석: RPC 실패 시 기존 벡터 검색으로 폴백
      logger.info('[PatternSearch]', 'Falling back to standard vector search')
      return await vectorSearch(query, options)
    }

    if (!data || data.length === 0) {
      logger.debug('[PatternSearch]', `No results for pattern: ${patternType}`)

      // 결과 없음 로깅
      logRAGSearch({
        userId,
        projectId,
        query,
        searchMethod: 'pattern',
        resultCount: 0,
        latencyMs: Date.now() - startTime,
        embeddingLatencyMs,
        searchLatencyMs,
        cacheHit: false,
        metadata: { patternType },
      }).catch(() => {})

      return []
    }

    // -------------------------------------------------------------------------
    // [STEP 3] 결과 매핑
    // -------------------------------------------------------------------------
    const results: SearchResult[] = data.map((item: any) => ({
      chunkId: item.id,
      documentId: item.document_id,
      content: item.content,
      score: item.similarity,
      metadata: {
        ...item.metadata,
        title: item.document_title || item.metadata?.title || 'Untitled',
        patternType: item.pattern_type,
      },
      quality: calculateEvidenceQuality(item.similarity, 'vector'),
    }))

    logger.info('[PatternSearch]', `Found ${results.length} results for pattern: ${patternType}`)

    // -------------------------------------------------------------------------
    // [P-C03-02] 성공 로깅 (fire-and-forget)
    // -------------------------------------------------------------------------
    logRAGSearch({
      userId,
      projectId,
      query,
      searchMethod: 'pattern',
      resultCount: results.length,
      topScore: results.length > 0 ? results[0].score : null,
      latencyMs: Date.now() - startTime,
      embeddingLatencyMs,
      searchLatencyMs,
      cacheHit: false,
      metadata: { patternType },
    }).catch(() => {})

    return results

  } catch (err) {
    logger.error('[PatternSearch]', 'Unexpected error', { error: String(err) })

    // -------------------------------------------------------------------------
    // 예외 로깅 (fire-and-forget)
    // -------------------------------------------------------------------------
    const errorMessage = err instanceof Error ? err.message : String(err)
    logRAGSearch({
      userId,
      projectId,
      query,
      searchMethod: 'pattern',
      resultCount: 0,
      latencyMs: Date.now() - startTime,
      cacheHit: false,
      error: errorMessage,
      errorCode: 'PATTERN_UNEXPECTED_ERROR',
      metadata: { patternType },
    }).catch(() => {})

    return []
  }
}
