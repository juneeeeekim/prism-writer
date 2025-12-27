// =============================================================================
// PRISM Writer - Search Utilities
// =============================================================================
// 파일: frontend/src/lib/rag/search.ts
// 역할: 하이브리드 검색 (벡터 + 키워드) 유틸리티
// =============================================================================

import { createClient } from '@/lib/supabase/server'
import { embedText } from './embedding'
import { validateACL } from './aclGate'
import { type ChunkType } from './chunking'
import { PIPELINE_V4_FLAGS } from './featureFlags'
import { type EvidenceQuality, EvidenceQualityGrade } from '@/types/rag' // P1-C types

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
  /** 근거 품질 (P1-C) */
  quality?: EvidenceQuality
}

export type Chunk = SearchResult

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
  /** 청크 유형 필터 (Pipeline v3 추가) */
  chunkType?: ChunkType
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
// Helper: 근거 품질 계산 (P1-C)
// =============================================================================
export function calculateEvidenceQuality(
  score: number, 
  method: 'vector' | 'keyword',
  chunkDate?: string // ISO string
): EvidenceQuality {
  // 1. 점수 스케일링 (0~1 -> 0~100)
  const normalizedScore = Math.round(score * 100)
  
  // 2. 등급 산정 로직
  let grade = EvidenceQualityGrade.LOW
  
  if (method === 'vector') {
    if (score >= 0.78) grade = EvidenceQualityGrade.HIGH
    else if (score >= 0.72) grade = EvidenceQualityGrade.MEDIUM
  } else {
    // Keyword search (score = 1 - rank/topK)
    if (score >= 0.8) grade = EvidenceQualityGrade.HIGH
    else if (score >= 0.5) grade = EvidenceQualityGrade.MEDIUM
  }

  // 3. 최신성 점수 계산 (1년 이내 100점, 1년 경과 시 20점)
  let recencyScore = undefined
  if (chunkDate) {
    const now = new Date()
    const docDate = new Date(chunkDate)
    const diffTime = Math.abs(now.getTime() - docDate.getTime())
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    
    if (diffDays <= 365) {
      recencyScore = 100
    } else {
      recencyScore = 20 // 1년 이상 된 문서는 최신성 낮음
    }
  }

  return {
    grade,
    score: normalizedScore,
    factors: {
      relevance: score,
      recency: recencyScore
    }
  }
}

/**
 * 근거 품질 일괄 계산 (Batch Processing)
 * 
 * @description
 * N+1 문제를 방지하기 위한 배치 처리 인터페이스입니다.
 * 현재 로직은 메모리 연산(O(1))이므로 map을 사용하지만,
 * 향후 DB 조회(예: 저자 권위)가 추가될 경우 이 함수 내부에서
 * 배치 쿼리(Promise.all 또는 WHERE IN)를 구현해야 합니다.
 * 
 * @param items - 점수와 검색 방식이 포함된 항목 배열
 */
export function calculateEvidenceQualityBatch(
  items: Array<{ score: number; method: 'vector' | 'keyword' }>
): EvidenceQuality[] {
  return items.map(item => calculateEvidenceQuality(item.score, item.method))
}

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
  const { userId, topK = DEFAULT_TOP_K, documentId, minScore = 0, chunkType } = options

  // [FIX] Supabase 클라이언트를 먼저 생성하여 ACL 검증에 전달
  const supabase = createClient()

  // ---------------------------------------------------------------------------
  // 0. ACL 검증 (Phase 2: ACL 게이트)
  // ---------------------------------------------------------------------------
  const aclResult = await validateACL({ userId }, supabase)
  if (!aclResult.valid) {
    throw new Error(aclResult.error || '접근 권한이 없습니다.')
  }

  // ---------------------------------------------------------------------------
  // 1. 쿼리 임베딩 생성
  // ---------------------------------------------------------------------------
  const queryEmbedding = await embedText(query.trim())

  // ---------------------------------------------------------------------------
  // 2. pgvector 검색 (Pipeline v4: search_similar_chunks_v2 함수 사용)
  // ---------------------------------------------------------------------------
  // 주석(시니어 개발자): DB 레벨에서 chunk_type 필터링으로 성능 최적화
  
  // ---------------------------------------------------------------------------
  // Pipeline v4 Feature Flag 체크
  // ---------------------------------------------------------------------------
  // 주석(시니어 개발자): ENABLE_PIPELINE_V4=false 시 v3 로직으로 즉시 롤백
  if (!PIPELINE_V4_FLAGS.useChunkTypeFilter) {
    console.log('[vectorSearch] Pipeline v4 disabled - using v3 search')
    const { data: v3Data, error: v3Error } = await supabase.rpc('search_similar_chunks', {
      query_embedding: queryEmbedding,
      user_id_param: userId,
      match_count: topK,
    })
    
    if (v3Error) {
      throw new Error(`벡터 검색 실패: ${v3Error.message}`)
    }
    
    // v3 결과 반환 (클라이언트 사이드 필터링)
    let v3Results: SearchResult[] = (v3Data || []).map((item: any) => ({
      chunkId: item.chunk_id,
      documentId: item.document_id,
      content: item.content,
      score: item.similarity,
      metadata: { ...item.metadata, chunkType: item.chunk_type },
    }))
    
    if (documentId) {
      v3Results = v3Results.filter((result) => result.documentId === documentId)
    }
    v3Results = v3Results.filter((result) => result.score >= minScore)
    if (chunkType) {
      v3Results = v3Results.filter((result) => result.metadata.chunkType === chunkType)
    }
    
    return v3Results
  }
  
  // Pipeline v4: chunk_type 필터를 DB 레벨에서 적용
  const { data, error } = await supabase.rpc('search_similar_chunks_v2', {
    query_embedding: queryEmbedding,
    user_id_param: userId,
    match_count: topK,
    chunk_type_filter: chunkType || null,  // NULL이면 모든 타입 검색
  })

  if (error) {
    // 주석(주니어 개발자): v2 함수 없으면 기존 함수로 폴백
    console.warn('[vectorSearch] search_similar_chunks_v2 실패, 기존 함수로 폴백:', error.message)
    const { data: fallbackData, error: fallbackError } = await supabase.rpc('search_similar_chunks', {
      query_embedding: queryEmbedding,
      user_id_param: userId,
      match_count: topK,
    })
    
    if (fallbackError) {
      throw new Error(`벡터 검색 실패: ${fallbackError.message}`)
    }
    
    // 폴백 시 클라이언트 사이드 필터링
    let fallbackResults: SearchResult[] = (fallbackData || []).map((item: any) => ({
      chunkId: item.chunk_id,
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

  // ---------------------------------------------------------------------------
  // 3. 결과 포맷팅 (Pipeline v4: DB에서 이미 필터링됨)
  // ---------------------------------------------------------------------------
  let results: SearchResult[] = (data || []).map((item: any) => ({
    chunkId: item.chunk_id,
    documentId: item.document_id,
    content: item.content,
    score: item.similarity,
    metadata: { ...item.metadata, chunkType: item.chunk_type },  // chunk_type을 metadata에 포함
    quality: calculateEvidenceQuality(item.similarity, 'vector') // P1-C Quality
  }))

  // 문서 ID 필터 (DB 레벨에서 안 했으므로 여기서 처리)
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
  const { userId, topK = DEFAULT_TOP_K, documentId, minScore = 0, chunkType } = options

  // [FIX] Supabase 클라이언트를 먼저 생성하여 ACL 검증에 전달
  const supabase = createClient()

  // ---------------------------------------------------------------------------
  // 0. ACL 검증 (Phase 2: ACL 게이트)
  // ---------------------------------------------------------------------------
  const aclResult = await validateACL({ userId }, supabase)
  if (!aclResult.valid) {
    throw new Error(aclResult.error || '접근 권한이 없습니다.')
  }

  // ---------------------------------------------------------------------------
  // 1. 쿼리 준비 (기본 토큰화)
  // ---------------------------------------------------------------------------
  const searchQuery = query.trim()

  // ---------------------------------------------------------------------------
  // 2. Full Text Search 쿼리 실행 (Pipeline v4: chunk_type 필터 추가)
  // ---------------------------------------------------------------------------
  // 주석(시니어 개발자): DB 레벨에서 chunk_type 필터링으로 성능 최적화
  let queryBuilder = supabase
    .from('rag_chunks')
    .select(
      `
      id,
      document_id,
      content,
      metadata,
      chunk_type,
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

  // Pipeline v4: DB 레벨 chunk_type 필터
  if (chunkType) {
    queryBuilder = queryBuilder.eq('chunk_type', chunkType)
  }

  const { data, error } = await queryBuilder

  if (error) {
    throw new Error(`키워드 검색 실패: ${error.message}`)
  }

  // ---------------------------------------------------------------------------
  // 3. 결과 포맷팅 (Pipeline v4: chunk_type을 metadata에 포함)
  // ---------------------------------------------------------------------------
  // 주석(주니어 개발자): DB에서 이미 chunk_type 필터링됨
  let results: SearchResult[] = (data || []).map((item: any, index: number) => ({
    chunkId: item.id,
    documentId: item.document_id,
    content: item.content,
    score: 1 - index / topK, // 순위 기반 점수 (1 ~ 0)
    metadata: { ...item.metadata, chunkType: item.chunk_type },  // chunk_type을 metadata에 포함
    quality: calculateEvidenceQuality(1 - index / topK, 'keyword') // P1-C Quality
  }))

  // 최소 점수 필터
  results = results.filter((result) => result.score >= minScore)

  return results
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
