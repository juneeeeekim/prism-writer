// =============================================================================
// PRISM Writer - Search Module: Vector Search
// =============================================================================
// 파일: frontend/src/lib/rag/search/vector.ts
// 역할: 벡터 유사도 검색 (pgvector 기반)
// 생성일: 2026-01-17 (리팩토링)
// =============================================================================

import { createClient } from '@/lib/supabase/server'
import { embedText } from '../embedding'
import { validateACL } from '../aclGate'
import { PIPELINE_V4_FLAGS } from '../featureFlags'
import { logger } from '@/lib/utils/logger'

import type { SearchResult, SearchOptions } from './types'
import {
  withRetry,
  calculateEvidenceQuality,
  DEFAULT_TOP_K,
  EMBEDDING_DIMENSION
} from './utils'

// =============================================================================
// [SECTION 1] 벡터 유사도 검색
// =============================================================================

/**
 * 벡터 유사도 검색
 * 
 * @description
 * 쿼리를 임베딩으로 변환하고, pgvector를 사용하여 유사한 청크를 검색합니다.
 * 
 * @param query - 검색 쿼리
 * @param options - 검색 옵션
 * @returns 검색 결과 배열
 * 
 * @example
 * ```typescript
 * const results = await vectorSearch("RAG란?", { userId, topK: 5 })
 * ```
 */
export async function vectorSearch(
  query: string,
  options: SearchOptions
): Promise<SearchResult[]> {
  // -------------------------------------------------------------------------
  // [P-A04-02] 구조화된 로거 사용
  // -------------------------------------------------------------------------
  logger.info('[vectorSearch]', 'CALLED', {
    query: query.substring(0, 50),
    userId: options.userId
  })
  
  const { userId, topK = DEFAULT_TOP_K, documentId, minScore = 0, chunkType, category } = options

  // -------------------------------------------------------------------------
  // [STEP 0] Supabase 클라이언트 생성 및 ACL 검증
  // -------------------------------------------------------------------------
  const supabase = await createClient()

  const aclResult = await validateACL({ userId }, supabase)
  if (!aclResult.valid) {
    logger.warn('[vectorSearch]', 'ACL FAILED', { error: aclResult.error })
    throw new Error(aclResult.error || '접근 권한이 없습니다.')
  }
  logger.debug('[vectorSearch]', 'ACL PASSED', { docsCount: aclResult.allowedDocumentIds.length })

  // -------------------------------------------------------------------------
  // [STEP 1] 쿼리 임베딩 생성 (Retry + 차원 검증 + Graceful Degradation)
  // -------------------------------------------------------------------------
  let queryEmbedding: number[]
  try {
    logger.debug('[vectorSearch]', 'Generating embedding...')
    queryEmbedding = await withRetry(
      () => embedText(query.trim()),
      'vectorSearch:embedText'
    )

    // 차원 검증 (OpenAI text-embedding-3-small: 1536)
    if (!queryEmbedding || queryEmbedding.length !== EMBEDDING_DIMENSION) {
      logger.error('[vectorSearch]', 'Invalid embedding dimension', {
        actual: queryEmbedding?.length,
        expected: EMBEDDING_DIMENSION
      })
      return [] // Graceful Degradation: 빈 결과 반환
    }
    logger.debug('[vectorSearch]', 'Embedding generated', { dim: queryEmbedding.length })
  } catch (err) {
    logger.error('[vectorSearch]', 'Embedding FAILED', { error: String(err) })
    return [] // Graceful Degradation: 500 에러 대신 빈 결과 반환
  }

  // -------------------------------------------------------------------------
  // [STEP 2] pgvector 검색 (Pipeline v4 Feature Flag 분기)
  // -------------------------------------------------------------------------
  // 시니어 개발자 주석: ENABLE_PIPELINE_V4=false 시 v3 로직으로 즉시 롤백
  if (!PIPELINE_V4_FLAGS.useChunkTypeFilter) {
    logger.info('[vectorSearch]', 'Pipeline v4 disabled - using v3 search')

    // -------------------------------------------------------------------------
    // [P7-02] v3 RPC 호출 (Retry + Graceful Degradation)
    // -------------------------------------------------------------------------
    try {
      logger.debug('[vectorSearch]', 'Calling match_document_chunks RPC', {
        user_id_param: userId,
        match_threshold: minScore,
        match_count: topK,
        category_param: category || null,
        embedding_length: queryEmbedding.length,
      })

      const { data: v3Data, error: v3Error } = await withRetry(
        async () => {
          const result = await supabase.rpc('match_document_chunks', {
            query_embedding: queryEmbedding,
            match_threshold: minScore,
            match_count: topK,
            user_id_param: userId,
            category_param: category || null,
            project_id_param: options.projectId || null,
          })
          return result
        },
        'vectorSearch:match_document_chunks'
      )

      logger.debug('[vectorSearch]', 'RPC result', {
        hasError: !!v3Error,
        error: v3Error?.message,
        resultCount: v3Data?.length || 0,
      })

      if (v3Error) {
        logger.error('[vectorSearch]', 'v3 RPC error', { error: v3Error.message })
        return [] // Graceful Degradation
      }

      // v3 결과 반환 (클라이언트 사이드 필터링)
      let v3Results: SearchResult[] = (v3Data || []).map((item: any) => ({
        chunkId: item.id,
        documentId: item.document_id,
        content: item.content,
        score: item.similarity,
        metadata: { 
          ...item.metadata, 
          chunkType: item.chunk_type,
          title: item.document_title || item.metadata?.title || null,
        },
      }))

      if (documentId) {
        v3Results = v3Results.filter((result) => result.documentId === documentId)
      }
      v3Results = v3Results.filter((result) => result.score >= minScore)
      if (chunkType) {
        v3Results = v3Results.filter((result) => result.metadata.chunkType === chunkType)
      }

      return v3Results
    } catch (err) {
      logger.error('[vectorSearch]', 'v3 RPC failed after retries', { error: String(err) })
      return [] // Graceful Degradation
    }
  }
  
  // -------------------------------------------------------------------------
  // [STEP 3] Pipeline v4: chunk_type 필터를 DB 레벨에서 적용
  // -------------------------------------------------------------------------
  try {
    const { data, error } = await withRetry(
      async () => {
        const result = await supabase.rpc('search_similar_chunks_v2', {
          query_embedding: queryEmbedding,
          user_id_param: userId,
          match_count: topK,
          chunk_type_filter: chunkType || null,
          project_id_param: options.projectId || null,
        })
        return result
      },
      'vectorSearch:search_similar_chunks_v2'
    )

    if (error) {
      // 주니어 개발자 주석: v2 함수 없으면 기존 함수로 폴백
      logger.warn('[vectorSearch]', 'search_similar_chunks_v2 실패, 기존 함수로 폴백', { error: error.message })

      // Fallback RPC with Retry
      const { data: fallbackData, error: fallbackError } = await withRetry(
        async () => {
          const result = await supabase.rpc('search_similar_chunks', {
            query_embedding: queryEmbedding,
            user_id_param: userId,
            match_count: topK,
          })
          return result
        },
        'vectorSearch:search_similar_chunks_fallback'
      )

      if (fallbackError) {
        logger.error('[vectorSearch]', 'Fallback RPC error', { error: fallbackError.message })
        return [] // Graceful Degradation
      }

      // 폴백 시 클라이언트 사이드 필터링
      let fallbackResults: SearchResult[] = (fallbackData || []).map((item: any) => ({
        chunkId: item.id,
        documentId: item.document_id,
        content: item.content,
        score: item.similarity,
        metadata: { ...item.metadata, chunkType: item.chunk_type },
      }))

      if (documentId) {
        fallbackResults = fallbackResults.filter((result) => result.documentId === documentId)
      }
      fallbackResults = fallbackResults.filter((result) => result.score >= minScore)
      if (chunkType) {
        fallbackResults = fallbackResults.filter((result) => result.metadata.chunkType === chunkType)
      }

      return fallbackResults
    }

    // -------------------------------------------------------------------------
    // [STEP 4] 결과 포맷팅 (Pipeline v4: DB에서 이미 필터링됨)
    // -------------------------------------------------------------------------
    let results: SearchResult[] = (data || []).map((item: any) => ({
      chunkId: item.id,
      documentId: item.document_id,
      content: item.content,
      score: item.similarity,
      metadata: { ...item.metadata, chunkType: item.chunk_type },
      quality: calculateEvidenceQuality(item.similarity, 'vector')
    }))

    // 문서 ID 필터 (DB 레벨에서 안 했으므로 여기서 처리)
    if (documentId) {
      results = results.filter((result) => result.documentId === documentId)
    }

    // 최소 점수 필터
    results = results.filter((result) => result.score >= minScore)

    return results
  } catch (err) {
    logger.error('[vectorSearch]', 'v4 RPC failed after retries', { error: String(err) })
    return [] // Graceful Degradation
  }
}
