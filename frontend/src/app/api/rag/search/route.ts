// =============================================================================
// PRISM Writer - RAG Search API
// =============================================================================
// 파일: frontend/src/app/api/rag/search/route.ts
// 역할: 벡터 유사도 기반 문서 청크 검색 API
// 메서드: POST
// =============================================================================

import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { embedText } from '@/lib/rag/embedding'

// =============================================================================
// 타입 정의
// =============================================================================

/** 검색 요청 바디 */
interface SearchRequest {
  /** 검색 쿼리 */
  query: string
  /** 반환할 결과 개수 (기본: 5, 최대: 20) */
  topK?: number
  /** 문서 ID 필터 (선택) */
  documentId?: string
}

/** 검색 결과 아이템 */
interface SearchResultItem {
  /** 청크 ID */
  chunk_id: string
  /** 문서 ID */
  document_id: string
  /** 청크 내용 */
  content: string
  /** 유사도 점수 (0~1, 높을수록 유사) */
  score: number
  /** 메타데이터 */
  metadata: Record<string, any>
}

/** 검색 응답 */
interface SearchResponse {
  success: boolean
  results?: SearchResultItem[]
  message?: string
  error?: string
}

// =============================================================================
// 상수
// =============================================================================

/** 기본 Top-K 값 */
const DEFAULT_TOP_K = 5

/** 최대 Top-K 값 */
const MAX_TOP_K = 20

// =============================================================================
// POST: 벡터 검색
// =============================================================================

/**
 * 벡터 유사도 기반 청크 검색 API
 * 
 * @description
 * 사용자 쿼리를 임베딩으로 변환하고, 데이터베이스에서 유사한 청크를 검색합니다.
 * pgvector의 코사인 유사도를 사용하여 가장 관련성 높은 청크를 반환합니다.
 * 
 * @returns JSON response with search results
 */
export async function POST(request: Request): Promise<NextResponse<SearchResponse>> {
  try {
    // ---------------------------------------------------------------------------
    // 1. 사용자 인증 확인
    // ---------------------------------------------------------------------------
    const supabase = createClient()
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
      return NextResponse.json(
        {
          success: false,
          message: '로그인이 필요합니다.',
          error: 'UNAUTHORIZED',
        },
        { status: 401 }
      )
    }

    const userId = session.user.id

    // ---------------------------------------------------------------------------
    // 2. 요청 바디 파싱 및 검증
    // ---------------------------------------------------------------------------
    let body: SearchRequest
    try {
      body = await request.json()
    } catch (parseError) {
      return NextResponse.json(
        {
          success: false,
          message: '요청 형식이 올바르지 않습니다.',
          error: 'INVALID_REQUEST',
        },
        { status: 400 }
      )
    }

    const { query, topK = DEFAULT_TOP_K, documentId } = body

    // 쿼리 검증
    if (!query || query.trim().length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: '검색 쿼리가 필요합니다.',
          error: 'MISSING_QUERY',
        },
        { status: 400 }
      )
    }

    // Top-K 값 검증 및 제한
    const validTopK = Math.min(Math.max(topK, 1), MAX_TOP_K)

    // ---------------------------------------------------------------------------
    // 3. 쿼리 임베딩 생성
    // ---------------------------------------------------------------------------
    let queryEmbedding: number[]
    try {
      queryEmbedding = await embedText(query.trim())
    } catch (embeddingError) {
      console.error('Failed to generate query embedding:', embeddingError)
      return NextResponse.json(
        {
          success: false,
          message: '쿼리 임베딩 생성에 실패했습니다.',
          error: 'EMBEDDING_FAILED',
        },
        { status: 500 }
      )
    }

    // ---------------------------------------------------------------------------
    // 4. 벡터 유사도 검색 (pgvector)
    // ---------------------------------------------------------------------------
    // PostgreSQL의 search_similar_chunks 함수 사용
    // 이 함수는 013_rag_chunks_schema.sql에서 정의됨
    const { data: searchResults, error: searchError } = await supabase.rpc(
      'search_similar_chunks',
      {
        query_embedding: queryEmbedding,
        user_id_param: userId,
        match_count: validTopK,
      }
    )

    if (searchError) {
      console.error('Vector search error:', searchError)
      return NextResponse.json(
        {
          success: false,
          message: '검색 중 오류가 발생했습니다.',
          error: 'SEARCH_FAILED',
        },
        { status: 500 }
      )
    }

    // ---------------------------------------------------------------------------
    // 5. 결과 필터링 (documentId 필터)
    // ---------------------------------------------------------------------------
    let filteredResults = searchResults || []
    if (documentId) {
      filteredResults = filteredResults.filter(
        (result: any) => result.document_id === documentId
      )
    }

    // ---------------------------------------------------------------------------
    // 6. 결과 포맷팅
    // ---------------------------------------------------------------------------
    const formattedResults: SearchResultItem[] = filteredResults.map((result: any) => ({
      chunk_id: result.chunk_id,
      document_id: result.document_id,
      content: result.content,
      score: result.similarity, // 코사인 유사도 (0~1)
      metadata: result.metadata || {},
    }))

    // ---------------------------------------------------------------------------
    // 7. 성공 응답
    // ---------------------------------------------------------------------------
    return NextResponse.json({
      success: true,
      results: formattedResults,
    })
  } catch (error) {
    console.error('Unexpected error in RAG search API:', error)
    return NextResponse.json(
      {
        success: false,
        message: '서버 오류가 발생했습니다.',
        error: 'INTERNAL_SERVER_ERROR',
      },
      { status: 500 }
    )
  }
}
