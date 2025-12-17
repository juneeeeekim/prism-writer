// =============================================================================
// PRISM Writer - Search Utilities
// =============================================================================
// 파일: frontend/src/lib/rag/search.ts
// 역할: 하이브리드 검색 (벡터 + 키워드) 유틸리티
// =============================================================================

import { createClient } from '@/lib/supabase/client'
import { embedText } from './embedding'

// =============================================================================
// 타입 정의
// =============================================================================

/** 검색 결과 아이템 */
export interface SearchResult {
  /** 청크 ID */
  chunkId: string
  /** 문서 ID */
  documentId: string
  /** 청크 내용 */
  content: string
  /** 유사도 점수 */
  score: number
  /** 메타데이터 */
  metadata: Record<string, any>
}

/** 검색 옵션 */
export interface SearchOptions {
  /** 사용자 ID */
  userId: string
  /** 반환할 결과 개수 */
  topK?: number
  /** 문서 ID 필터 */
  documentId?: string
  /** 최소 점수 임계값 (0~1) */
  minScore?: number
}

/** 하이브리드 검색 옵션 */
export interface HybridSearchOptions extends SearchOptions {
  /** 벡터 검색 가중치 (0~1, 기본: 0.7) */
  vectorWeight?: number
  /** 키워드 검색 가중치 (0~1, 기본: 0.3) */
  keywordWeight?: number
}

// =============================================================================
// 상수
// =============================================================================

/** RRF 상수 (Reciprocal Rank Fusion) */
const RRF_K = 60

/** 기본 Top-K */
const DEFAULT_TOP_K = 5

/** 기본 벡터 가중치 */
const DEFAULT_VECTOR_WEIGHT = 0.7

/** 기본 키워드 가중치 */
const DEFAULT_KEYWORD_WEIGHT = 0.3

// =============================================================================
// 벡터 검색
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
  const { userId, topK = DEFAULT_TOP_K, documentId, minScore = 0 } = options

  // ---------------------------------------------------------------------------
  // 1. 쿼리 임베딩 생성
  // ---------------------------------------------------------------------------
  const queryEmbedding = await embedText(query.trim())

  // ---------------------------------------------------------------------------
  // 2. pgvector 검색 (search_similar_chunks 함수 사용)
  // ---------------------------------------------------------------------------
  const supabase = createClient()
  const { data, error } = await supabase.rpc('search_similar_chunks', {
    query_embedding: queryEmbedding,
    user_id_param: userId,
    match_count: topK,
  })

  if (error) {
    throw new Error(`벡터 검색 실패: ${error.message}`)
  }

  // ---------------------------------------------------------------------------
  // 3. 결과 필터링 및 포맷팅
  // ---------------------------------------------------------------------------
  let results: SearchResult[] = (data || []).map((item: any) => ({
    chunkId: item.chunk_id,
    documentId: item.document_id,
    content: item.content,
    score: item.similarity,
    metadata: item.metadata || {},
  }))

  // 문서 ID 필터
  if (documentId) {
    results = results.filter((result) => result.documentId === documentId)
  }

  // 최소 점수 필터
  results = results.filter((result) => result.score >= minScore)

  return results
}

// =============================================================================
// 키워드 검색 (Full Text Search)
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
  const { userId, topK = DEFAULT_TOP_K, documentId, minScore = 0 } = options

  const supabase = createClient()

  // ---------------------------------------------------------------------------
  // 1. 쿼리 준비 (기본 토큰화)
  // ---------------------------------------------------------------------------
  const searchQuery = query.trim()

  // ---------------------------------------------------------------------------
  // 2. Full Text Search 쿼리 실행
  // ---------------------------------------------------------------------------
  // PostgreSQL의 textSearch를 사용 (content 컬럼에서 검색)
  let queryBuilder = supabase
    .from('rag_chunks')
    .select(
      `
      id,
      document_id,
      content,
      metadata,
      rag_documents!inner(user_id)
    `
    )
    .textSearch('content', searchQuery)
    .eq('rag_documents.user_id', userId)
    .limit(topK)

  // 문서 ID 필터
  if (documentId) {
    queryBuilder = queryBuilder.eq('document_id', documentId)
  }

  const { data, error } = await queryBuilder

  if (error) {
    throw new Error(`키워드 검색 실패: ${error.message}`)
  }

  // ---------------------------------------------------------------------------
  // 3. 결과 포맷팅 (점수는 간단한 순위 기반)
  // ---------------------------------------------------------------------------
  const results: SearchResult[] = (data || []).map((item: any, index: number) => ({
    chunkId: item.id,
    documentId: item.document_id,
    content: item.content,
    score: 1 - index / topK, // 순위 기반 점수 (1 ~ 0)
    metadata: item.metadata || {},
  }))

  // 최소 점수 필터
  return results.filter((result) => result.score >= minScore)
}

// =============================================================================
// RRF (Reciprocal Rank Fusion)
// =============================================================================

/**
 * Reciprocal Rank Fusion 알고리즘
 * 
 * @description
 * 여러 검색 결과를 순위 기반으로 병합합니다.
 * RRF(d) = Σ 1 / (k + rank(d)) where k=60
 * 
 * @param resultSets - 검색 결과 배열들
 * @param topK - 반환할 결과 개수
 * @returns 병합된 검색 결과
 * 
 * @example
 * ```typescript
 * const vectorResults = await vectorSearch(query, options)
 * const keywordResults = await fullTextSearch(query, options)
 * const merged = reciprocalRankFusion([vectorResults, keywordResults], 5)
 * ```
 */
export function reciprocalRankFusion(
  resultSets: SearchResult[][],
  topK: number = DEFAULT_TOP_K
): SearchResult[] {
  // ---------------------------------------------------------------------------
  // 1. RRF 점수 계산
  // ---------------------------------------------------------------------------
  const scoreMap = new Map<string, { result: SearchResult; rrfScore: number }>()

  resultSets.forEach((results) => {
    results.forEach((result, rank) => {
      const existingEntry = scoreMap.get(result.chunkId)
      const rrfScore = 1 / (RRF_K + rank + 1)

      if (existingEntry) {
        // 기존 점수에 추가
        existingEntry.rrfScore += rrfScore
      } else {
        // 새로운 엔트리
        scoreMap.set(result.chunkId, {
          result: { ...result },
          rrfScore,
        })
      }
    })
  })

  // ---------------------------------------------------------------------------
  // 2. RRF 점수 기준으로 정렬
  // ---------------------------------------------------------------------------
  const rankedResults = Array.from(scoreMap.values())
    .sort((a, b) => b.rrfScore - a.rrfScore)
    .slice(0, topK)
    .map((entry) => ({
      ...entry.result,
      score: entry.rrfScore, // RRF 점수를 score로 사용
    }))

  return rankedResults
}

// =============================================================================
// 하이브리드 검색
// =============================================================================

/**
 * 하이브리드 검색 (벡터 + 키워드)
 * 
 * @description
 * 벡터 검색과 키워드 검색을 결합하여 더 정확한 결과를 제공합니다.
 * RRF 알고리즘으로 두 검색 결과를 병합합니다.
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
  const {
    topK = DEFAULT_TOP_K,
    vectorWeight = DEFAULT_VECTOR_WEIGHT,
    keywordWeight = DEFAULT_KEYWORD_WEIGHT,
    ...baseOptions
  } = options

  // ---------------------------------------------------------------------------
  // 1. 병렬로 벡터 검색과 키워드 검색 실행
  // ---------------------------------------------------------------------------
  const [vectorResults, keywordResults] = await Promise.all([
    vectorSearch(query, { ...baseOptions, topK: topK * 2 }), // 더 많은 결과 가져오기
    fullTextSearch(query, { ...baseOptions, topK: topK * 2 }).catch(() => []), // 실패 시 빈 배열
  ])

  // ---------------------------------------------------------------------------
  // 2. 가중치 적용
  // ---------------------------------------------------------------------------
  const weightedVectorResults = vectorResults.map((result) => ({
    ...result,
    score: result.score * vectorWeight,
  }))

  const weightedKeywordResults = keywordResults.map((result) => ({
    ...result,
    score: result.score * keywordWeight,
  }))

  // ---------------------------------------------------------------------------
  // 3. RRF로 병합
  // ---------------------------------------------------------------------------
  const mergedResults = reciprocalRankFusion(
    [weightedVectorResults, weightedKeywordResults],
    topK
  )

  return mergedResults
}
