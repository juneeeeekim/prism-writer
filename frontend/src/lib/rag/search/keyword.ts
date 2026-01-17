// =============================================================================
// PRISM Writer - Search Module: Keyword Search
// =============================================================================
// 파일: frontend/src/lib/rag/search/keyword.ts
// 역할: PostgreSQL Full Text Search (키워드 검색)
// 생성일: 2026-01-17 (리팩토링)
// =============================================================================

import { createClient } from '@/lib/supabase/server'
import { validateACL } from '../aclGate'
import { logger } from '@/lib/utils/logger'

import type { SearchResult, SearchOptions } from './types'
import { calculateEvidenceQuality, DEFAULT_TOP_K } from './utils'

// =============================================================================
// [SECTION 1] PostgreSQL Full Text Search
// =============================================================================

/**
 * PostgreSQL Full Text Search
 * 
 * @description
 * PostgreSQL의 tsvector를 사용한 키워드 검색입니다.
 * 한글 검색을 위해 기본적인 토큰화를 수행합니다.
 * 
 * @param query - 검색 쿼리
 * @param options - 검색 옵션
 * @returns 검색 결과 배열
 * 
 * @example
 * ```typescript
 * const results = await fullTextSearch("임베딩", { userId, topK: 5 })
 * ```
 */
export async function fullTextSearch(
  query: string,
  options: SearchOptions
): Promise<SearchResult[]> {
  const { userId, topK = DEFAULT_TOP_K, documentId, minScore = 0, chunkType } = options

  // -------------------------------------------------------------------------
  // [STEP 0] Supabase 클라이언트 생성 및 ACL 검증
  // -------------------------------------------------------------------------
  const supabase = await createClient()

  const aclResult = await validateACL({ userId }, supabase)
  if (!aclResult.valid) {
    throw new Error(aclResult.error || '접근 권한이 없습니다.')
  }

  // -------------------------------------------------------------------------
  // [STEP 1] 쿼리 준비 (기본 토큰화)
  // -------------------------------------------------------------------------
  const searchQuery = query.trim()

  // -------------------------------------------------------------------------
  // [STEP 2] Full Text Search 쿼리 실행 (Pipeline v4: chunk_type 필터 추가)
  // -------------------------------------------------------------------------
  // 시니어 개발자 주석: DB 레벨에서 chunk_type 필터링으로 성능 최적화
  let queryBuilder = supabase
    .from('rag_chunks')
    .select(
      `
      id,
      document_id,
      content,
      metadata,
      chunk_type,
      user_documents!inner(user_id)
    `
    )
    .textSearch('content', searchQuery)
    .eq('user_documents.user_id', userId)
    .limit(topK)

  // 문서 ID 필터
  if (documentId) {
    queryBuilder = queryBuilder.eq('document_id', documentId)
  }

  // Pipeline v4: DB 레벨 chunk_type 필터
  if (chunkType) {
    queryBuilder = queryBuilder.eq('chunk_type', chunkType)
  }

  const { data, error } = await queryBuilder

  if (error) {
    throw new Error(`키워드 검색 실패: ${error.message}`)
  }

  // -------------------------------------------------------------------------
  // [STEP 3] 결과 포맷팅 (Pipeline v4: chunk_type을 metadata에 포함)
  // -------------------------------------------------------------------------
  // 주니어 개발자 주석: DB에서 이미 chunk_type 필터링됨
  let results: SearchResult[] = (data || []).map((item: any, index: number) => ({
    chunkId: item.id,
    documentId: item.document_id,
    content: item.content,
    score: 1 - index / topK, // 순위 기반 점수 (1 ~ 0)
    metadata: { ...item.metadata, chunkType: item.chunk_type },
    quality: calculateEvidenceQuality(1 - index / topK, 'keyword')
  }))

  // 최소 점수 필터
  results = results.filter((result) => result.score >= minScore)

  return results
}

// =============================================================================
// [SECTION 2] Full Text Search with ts_rank
// =============================================================================

/**
 * PostgreSQL ts_rank 기반 키워드 검색
 * 
 * @description
 * 키워드 검색에 ts_rank() 점수를 부여하여 정량적 매칭 점수 제공.
 * 가중 점수 합산(Weighted Score Fusion)에서 사용됨.
 * 
 * @param query - 검색 쿼리
 * @param options - 검색 옵션
 * @returns 검색 결과 배열 (점수 정규화됨)
 * 
 * @example
 * ```typescript
 * const results = await fullTextSearchWithRank("현상 욕구", { userId, topK: 10 })
 * // results[0].score = 0.85 (정규화된 ts_rank 점수)
 * ```
 */
export async function fullTextSearchWithRank(
  query: string,
  options: SearchOptions
): Promise<SearchResult[]> {
  const { userId, topK = DEFAULT_TOP_K, projectId } = options

  // -------------------------------------------------------------------------
  // [Safety] 입력 검증
  // -------------------------------------------------------------------------
  const searchQuery = query.trim()
  if (!searchQuery) return []

  // -------------------------------------------------------------------------
  // [Core] RPC 호출 (직접 await - Supabase builder 패턴)
  // -------------------------------------------------------------------------
  const supabase = await createClient()

  // 시니어 개발자 주석: withRetry는 Promise를 반환하는 함수에만 사용 가능
  // Supabase RPC는 PostgrestFilterBuilder를 반환하므로 직접 await
  const { data, error } = await supabase.rpc('search_chunks_with_rank', {
    search_query: searchQuery,
    user_id_param: userId,
    project_id_param: projectId || null,
    match_count: topK
  })

  if (error) {
    logger.error('[fullTextSearchWithRank]', 'RPC error', { error })
    throw new Error(`키워드 검색(ts_rank) 실패: ${error.message}`)
  }

  // -------------------------------------------------------------------------
  // [Transform] 결과 변환 (rank → score 정규화)
  // -------------------------------------------------------------------------
  if (!data || data.length === 0) return []

  // maxRank로 정규화 (0-1 범위)
  const maxRank = Math.max(...data.map((d: any) => d.rank || 0), 0.001)  // [Safety] div by zero 방지

  const results: SearchResult[] = data.map((item: any) => ({
    chunkId: item.id,
    documentId: item.document_id,
    content: item.content,
    score: (item.rank || 0) / maxRank,  // [0, 1] 정규화
    metadata: item.metadata || {},
    quality: calculateEvidenceQuality((item.rank || 0) / maxRank, 'keyword')
  }))

  logger.debug('[fullTextSearchWithRank]', `Found ${results.length} results`, { maxRank: maxRank.toFixed(4) })

  return results
}
