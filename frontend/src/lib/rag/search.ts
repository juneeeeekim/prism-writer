// =============================================================================
// PRISM Writer - Search Utilities
// =============================================================================
// 파일: frontend/src/lib/rag/search.ts
// 역할: 하이브리드 검색 (벡터 + 키워드) 유틸리티
// Pipeline v5: 검색 결과 캐싱 추가 (Section 5.2)
// =============================================================================

import { createClient } from '@/lib/supabase/server'
import { embedText } from './embedding'
import { validateACL } from './aclGate'
import { type ChunkType } from './chunking'
import { PIPELINE_V4_FLAGS } from './featureFlags'
import { type EvidenceQuality, EvidenceQualityGrade } from '@/types/rag' // P1-C types
import { LRUCache, hashText, createCacheKey } from '@/lib/cache/lruCache'
import { type PatternType } from './patternExtractor' // [PATTERN] 패턴 타입
import { FEATURE_FLAGS } from '../../config/featureFlags' // [PATTERN] Feature Flags
// =============================================================================
// [P-A04-02] 구조화된 로거 import
// - 점진적 마이그레이션: 일부 핵심 로그만 logger 사용
// - 나머지 console.log는 추후 마이그레이션 예정
// =============================================================================
import { logger } from '@/lib/utils/logger'

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
  /** 카테고리 필터 (Phase 14.5: null = 전체) */
  category?: string | null
  /** [RAG-ISOLATION] 프로젝트 ID 필터 (null = 전체) */
  projectId?: string | null
}

/** 하이브리드 검색 옵션 */
export interface HybridSearchOptions extends SearchOptions {
  /** 벡터 검색 가중치 (0~1, 기본: 0.7) */
  vectorWeight?: number
  /** 키워드 검색 가중치 (0~1, 기본: 0.3) */
  keywordWeight?: number
  /** [PATTERN] 패턴 타입 필터 (선택적) */
  patternType?: PatternType
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
// [Pipeline v5] 검색 결과 캐시 (Section 5.2)
// =============================================================================
// 주석(시니어 개발자): 동일 쿼리 반복 검색 최적화
// - 최대 1000개 항목
// - 1시간 TTL (문서 변경 시 영향 고려하여 24시간에서 축소)
// - 사용자별 + 카테고리별 + 쿼리별 캐시 키

const searchCache = new LRUCache<SearchResult[]>({
  maxSize: 1000,
  ttlMs: 60 * 60 * 1000, // 1시간
  name: 'SearchCache',
})

// =============================================================================
// [P7-02] Retry 상수 및 유틸리티 함수
// =============================================================================
// 목적: 외부 API 호출(embedText, supabase.rpc) 실패 시 재시도 로직
// 전략: Exponential Backoff (200ms → 400ms → 800ms)
// =============================================================================

/** 최대 재시도 횟수 */
const MAX_RETRY_COUNT = 3

/** 초기 대기 시간 (ms) */
const INITIAL_BACKOFF_MS = 200

/** OpenAI text-embedding 차원 (text-embedding-3-small) */
const EMBEDDING_DIMENSION = 1536

/**
 * [P7-02] 재시도 유틸리티 함수
 *
 * @description
 * 외부 API 호출 실패 시 Exponential Backoff로 재시도합니다.
 * 모든 시도 실패 시 마지막 에러를 throw합니다.
 *
 * @param operation - 재시도할 비동기 작업
 * @param context - 로그 컨텍스트 (함수명)
 * @returns 작업 결과
 */
async function withRetry<T>(
  operation: () => Promise<T>,
  context: string
): Promise<T> {
  let lastError: Error | null = null

  for (let attempt = 1; attempt <= MAX_RETRY_COUNT; attempt++) {
    try {
      return await operation()
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))
      console.warn(`[${context}] Attempt ${attempt}/${MAX_RETRY_COUNT} failed:`, lastError.message)

      if (attempt < MAX_RETRY_COUNT) {
        // Exponential Backoff: 200ms, 400ms, 800ms
        const backoffMs = INITIAL_BACKOFF_MS * Math.pow(2, attempt - 1)
        await new Promise(resolve => setTimeout(resolve, backoffMs))
      }
    }
  }

  throw lastError // 모든 시도 실패
}

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
  // -------------------------------------------------------------------------
  // [P-A04-02] 구조화된 로거 사용 예시 (점진적 마이그레이션)
  // -------------------------------------------------------------------------
  logger.info('[vectorSearch]', 'CALLED', {
    query: query.substring(0, 50),
    userId: options.userId
  })
  
  const { userId, topK = DEFAULT_TOP_K, documentId, minScore = 0, chunkType, category } = options

  // [FIX] Supabase 클라이언트를 먼저 생성하여 ACL 검증에 전달
  const supabase = await createClient()

  // ---------------------------------------------------------------------------
  // 0. ACL 검증 (Phase 2: ACL 게이트)
  // ---------------------------------------------------------------------------
  const aclResult = await validateACL({ userId }, supabase)
  if (!aclResult.valid) {
    logger.warn('[vectorSearch]', 'ACL FAILED', { error: aclResult.error })
    throw new Error(aclResult.error || '접근 권한이 없습니다.')
  }
  logger.debug('[vectorSearch]', 'ACL PASSED', { docsCount: aclResult.allowedDocumentIds.length })

  // ---------------------------------------------------------------------------
  // 1. [P7-02] 쿼리 임베딩 생성 (Retry + 차원 검증 + Graceful Degradation)
  // ---------------------------------------------------------------------------
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

    // -------------------------------------------------------------------------
    // [P7-02] v3 RPC 호출 (Retry + Graceful Degradation)
    // -------------------------------------------------------------------------
    try {
      console.log('[vectorSearch] Calling match_document_chunks RPC with:', {
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
            category_param: category || null,  // null = all categories
            project_id_param: options.projectId || null,  // [RAG-ISOLATION] 프로젝트 필터
          })
          return result
        },
        'vectorSearch:match_document_chunks'
      )

      console.log('[vectorSearch] RPC result:', {
        hasError: !!v3Error,
        error: v3Error?.message,
        resultCount: v3Data?.length || 0,
      })

      if (v3Error) {
        console.error('[vectorSearch] v3 RPC error:', v3Error.message)
        return [] // Graceful Degradation
      }

      // v3 결과 반환 (클라이언트 사이드 필터링)
      // [P0-01-D Fix] RPC returns 'id', not 'chunk_id' - mapped correctly
      // [CITATION-FIX] document_title 추가 - 인용 시 문서 제목 표시용
      let v3Results: SearchResult[] = (v3Data || []).map((item: any) => ({
        chunkId: item.id,  // Fixed: RPC returns 'id' not 'chunk_id'
        documentId: item.document_id,
        content: item.content,
        score: item.similarity,
        metadata: { 
          ...item.metadata, 
          chunkType: item.chunk_type,
          title: item.document_title || item.metadata?.title || null,  // [CITATION-FIX] 문서 제목
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
      console.error('[vectorSearch] v3 RPC failed after retries:', err)
      return [] // Graceful Degradation: 500 에러 대신 빈 결과 반환
    }
  }
  
  // ---------------------------------------------------------------------------
  // [P7-02] Pipeline v4: chunk_type 필터를 DB 레벨에서 적용 (Retry + Graceful Degradation)
  // ---------------------------------------------------------------------------
  try {
    const { data, error } = await withRetry(
      async () => {
        const result = await supabase.rpc('search_similar_chunks_v2', {
          query_embedding: queryEmbedding,
          user_id_param: userId,
          match_count: topK,
          chunk_type_filter: chunkType || null,  // NULL이면 모든 타입 검색
        })
        return result
      },
      'vectorSearch:search_similar_chunks_v2'
    )

    if (error) {
      // 주석(주니어 개발자): v2 함수 없으면 기존 함수로 폴백
      console.warn('[vectorSearch] search_similar_chunks_v2 실패, 기존 함수로 폴백:', error.message)

      // [P7-02] Fallback RPC with Retry
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
        console.error('[vectorSearch] Fallback RPC error:', fallbackError.message)
        return [] // Graceful Degradation
      }

      // 폴백 시 클라이언트 사이드 필터링
      // [P0-01-D Fix] RPC returns 'id', not 'chunk_id' - mapped correctly
      let fallbackResults: SearchResult[] = (fallbackData || []).map((item: any) => ({
        chunkId: item.id,  // Fixed: RPC returns 'id' not 'chunk_id'
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
    // 3. 결과 포맷팅 (Pipeline v4: DB에서 이미 필터링됨)
    // -------------------------------------------------------------------------
    // [P0-01-D Fix] RPC returns 'id', not 'chunk_id' - mapped correctly
    let results: SearchResult[] = (data || []).map((item: any) => ({
      chunkId: item.id,  // Fixed: RPC returns 'id' not 'chunk_id'
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
  } catch (err) {
    console.error('[vectorSearch] v4 RPC failed after retries:', err)
    return [] // Graceful Degradation: 500 에러 대신 빈 결과 반환
  }
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
  const supabase = await createClient()

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
    patternType, // [PATTERN] 패턴 타입 추출
    ...baseOptions
  } = options

  // ---------------------------------------------------------------------------
  // [PATTERN] 패턴 기반 검색 분기
  // ---------------------------------------------------------------------------
  if (FEATURE_FLAGS.ENABLE_PATTERN_BASED_SEARCH && patternType && baseOptions.projectId) {
    console.log(`[Search] Pattern-based search for type: ${patternType}`)
    return await patternBasedSearch(query, {
      ...baseOptions,
      topK,
      patternType,
    })
  }

  // ---------------------------------------------------------------------------
  // [Pipeline v5] 0. 검색 캐시 확인
  // ---------------------------------------------------------------------------
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
    console.log(`[Search] Cache HIT for "${query}" (Category: ${baseOptions.category || 'all'})`)
    return cachedResult
  }

  console.log(`[Search] Cache MISS for "${query}" - Executing Hybrid Search...`)

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

  // ---------------------------------------------------------------------------
  // [Pipeline v5] 4. 결과 캐싱
  // ---------------------------------------------------------------------------
  searchCache.set(cacheKey, mergedResults)

  return mergedResults
}

// =============================================================================
// [PATTERN] 패턴 기반 검색
// =============================================================================

/** 패턴 기반 검색 옵션 */
interface PatternSearchOptions extends SearchOptions {
  patternType: PatternType
}

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
async function patternBasedSearch(
  query: string,
  options: PatternSearchOptions
): Promise<SearchResult[]> {
  const { userId, topK = 10, minScore = 0.5, patternType, projectId } = options

  // [SAFETY] 필수 파라미터 검증
  if (!projectId) {
    console.error('[PatternSearch] projectId is required for pattern-based search')
    return []
  }

  try {
    // 1. 쿼리 임베딩 생성
    const queryEmbedding = await embedText(query)
    if (!queryEmbedding) {
      console.error('[PatternSearch] Failed to generate embedding')
      return []
    }

    // 2. Supabase RPC 호출 (패턴 필터 포함)
    const supabase = await createClient()
    const { data, error } = await supabase.rpc('match_document_chunks_by_pattern', {
      query_embedding: queryEmbedding,
      pattern_type_param: patternType,
      project_id_param: projectId,
      user_id_param: userId,
      match_threshold: minScore,
      match_count: topK,
    })

    if (error) {
      console.error('[PatternSearch] RPC error:', error.message)
      // 폴백: 기존 검색으로 대체
      console.log('[PatternSearch] Falling back to standard vector search')
      return await vectorSearch(query, options)
    }

    if (!data || data.length === 0) {
      console.log(`[PatternSearch] No results for pattern: ${patternType}`)
      return []
    }

    // 3. 결과 매핑
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

    console.log(`[PatternSearch] Found ${results.length} results for pattern: ${patternType}`)
    return results

  } catch (err) {
    console.error('[PatternSearch] Unexpected error:', err)
    return []
  }
}

// =============================================================================
// [R-04] 패턴 검색 Wrapper 함수
// =============================================================================
// 목적: 외부에서 패턴 기반 검색을 쉽게 호출할 수 있도록 Wrapper 제공
// 폴백: patternType이 없거나 RPC 실패 시 hybridSearch()로 폴백
// =============================================================================

/** 패턴 검색 Wrapper 옵션 */
export interface SearchByPatternOptions extends SearchOptions {
  /** 패턴 타입 (null이면 일반 검색으로 폴백) */
  patternType?: PatternType | null
}

/**
 * [R-04] 패턴 검색 Wrapper
 * 
 * @description
 * 패턴 타입을 기반으로 청크를 검색합니다.
 * patternType이 없거나 projectId가 없으면 hybridSearch()로 폴백합니다.
 * 
 * @param query - 검색 쿼리
 * @param patternType - 패턴 타입 ('hook' | 'cta' | 'rebuttal' | 등)
 * @param options - 검색 옵션
 * @returns 검색 결과 배열
 * 
 * @example
 * ```typescript
 * // 패턴 검색
 * const results = await searchByPattern('훅 문장 예시', 'hook', { userId, projectId })
 * 
 * // 폴백 (patternType null)
 * const generalResults = await searchByPattern('일반 검색', null, { userId })
 * ```
 */
export async function searchByPattern(
  query: string,
  patternType: PatternType | null | undefined,
  options: SearchByPatternOptions
): Promise<SearchResult[]> {
  const { userId, projectId, topK = 5, minScore = 0.5 } = options

  // patternType을 제외한 기본 옵션 (hybridSearch 호환용)
  const baseOptions: SearchOptions = {
    userId,
    topK,
    minScore,
    documentId: options.documentId,
    chunkType: options.chunkType,
    category: options.category,
    projectId: options.projectId,
  }

  // -------------------------------------------------------------------------
  // 1. patternType null 체크 → hybridSearch 폴백
  // -------------------------------------------------------------------------
  if (!patternType) {
    console.log('[searchByPattern] No patternType provided, falling back to hybridSearch')
    return await hybridSearch(query, baseOptions)
  }

  // -------------------------------------------------------------------------
  // 2. projectId 필수 체크 → hybridSearch 폴백
  // -------------------------------------------------------------------------
  if (!projectId) {
    console.warn('[searchByPattern] projectId is required for pattern search, falling back to hybridSearch')
    return await hybridSearch(query, baseOptions)
  }

  // -------------------------------------------------------------------------
  // 3. Feature Flag 체크
  // -------------------------------------------------------------------------
  if (!FEATURE_FLAGS.ENABLE_PATTERN_BASED_SEARCH) {
    console.log('[searchByPattern] Pattern search disabled by feature flag, falling back to hybridSearch')
    return await hybridSearch(query, baseOptions)
  }

  // -------------------------------------------------------------------------
  // 4. 패턴 기반 검색 실행 (Try-Catch로 폴백 보장)
  // -------------------------------------------------------------------------
  try {
    console.log(`[searchByPattern] Searching for pattern: ${patternType}`)
    
    const results = await patternBasedSearch(query, {
      userId,
      projectId,
      topK,
      minScore,
      patternType,
    })

    // 결과가 없으면 hybridSearch로 보완
    if (results.length === 0) {
      console.log('[searchByPattern] No pattern results, supplementing with hybridSearch')
      return await hybridSearch(query, { ...baseOptions, topK: Math.min(topK, 3) })
    }

    return results

  } catch (error) {
    console.error('[searchByPattern] Pattern search failed, falling back to hybridSearch:', error)
    return await hybridSearch(query, baseOptions)
  }
}

