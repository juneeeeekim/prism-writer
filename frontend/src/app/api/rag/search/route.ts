// =============================================================================
// PRISM Writer - RAG Search API (P2 Phase 3)
// =============================================================================
// 파일: frontend/src/app/api/rag/search/route.ts
// 역할: Gemini 임베딩 + 벡터 유사도 기반 문서 청크 검색 API
// 메서드: POST
// 변경사항: OpenAI → Gemini embedding, match_document_chunks RPC 사용
// =============================================================================

import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { generateEmbedding, EMBEDDING_CONFIG } from '@/lib/ai/embedding'
import { buildEvidencePack } from '@/lib/rag/evidencePack'
import type { EvidencePack, EvidenceItem } from '@/types/rag'

// =============================================================================
// 타입 정의
// =============================================================================

/** 검색 요청 바디 */
interface SearchRequest {
  /** 검색 쿼리 */
  query: string
  /** 반환할 결과 개수 (기본: 5, 최대: 20) */
  topK?: number
  /** 최소 유사도 임계값 (기본: 0.5) */
  threshold?: number
  /** [Phase C] 카테고리 필터 (필수 - 격리 모드) */
  category?: string
  /** [P1-01] 프로젝트 ID 필터 (프로젝트별 RAG 격리) */
  projectId?: string
}

/** 검색 결과 아이템 (DB에서 반환되는 형식) */
interface DBSearchResult {
  id: number
  content: string
  metadata: Record<string, unknown>
  similarity: number
}

/** 검색 응답 (EvidencePack 형식) */
interface SearchResponse {
  success: boolean
  evidencePack?: EvidencePack
  documents?: EvidenceItem[]
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

/** 기본 유사도 임계값 */
const DEFAULT_THRESHOLD = 0.5

// =============================================================================
// POST: Gemini 임베딩 기반 벡터 검색
// =============================================================================

/**
 * Gemini 임베딩 + 벡터 유사도 기반 청크 검색 API
 * 
 * @description
 * 1. 사용자 쿼리를 OpenAI text-embedding-3-small로 임베딩 (1536차원)
 * 2. match_document_chunks RPC로 유사한 청크 검색
 * 3. 결과를 EvidencePack 형식으로 변환하여 반환
 * 
 * @returns JSON response with EvidencePack
 */
export async function POST(request: Request): Promise<NextResponse<SearchResponse>> {
  try {
    // ---------------------------------------------------------------------------
    // 1. 사용자 인증 확인
    // ---------------------------------------------------------------------------
    const supabase = await createClient()
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

    const {
      query,
      topK = DEFAULT_TOP_K,
      threshold = 0.1, // [Diagnostic] Lower threshold to 0.1
      category = '*'
    } = body

    console.log('[SearchDebug] Query:', query)
    console.log('[SearchDebug] ProjectId:', body.projectId)
    console.log('[SearchDebug] Threshold:', threshold)

    const effectiveCategory = category || '*'

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

    // =========================================================================
    // [Option B] 카테고리 기본값 처리 (UI 단순화)
    // =========================================================================
    // 변경사항: category 미지정 시 기본값 '*' (전체 검색) 적용
    // - 기존: 필수 검증 → 에러 반환
    // - 변경: 기본값 '*' → 전체 문서에서 검색
    // 참고: 특정 카테고리 검색이 필요한 API는 별도로 category 전달
    const effectiveCategory = category || '*'

    // Top-K 값 검증 및 제한
    const validTopK = Math.min(Math.max(topK, 1), MAX_TOP_K)

    // ---------------------------------------------------------------------------
    // 3. Gemini 임베딩 생성 (768차원)
    // ---------------------------------------------------------------------------
    let queryEmbedding: number[]
    try {
      queryEmbedding = await generateEmbedding(query.trim())
    } catch (embeddingError) {
      console.error('Failed to generate Gemini query embedding:', embeddingError)
      return NextResponse.json(
        {
          success: false,
          message: 'Gemini 쿼리 임베딩 생성에 실패했습니다.',
          error: 'EMBEDDING_FAILED',
        },
        { status: 500 }
      )
    }

    // ---------------------------------------------------------------------------
    // 4. match_document_chunks RPC 호출 (P2 Phase 1에서 생성된 함수)
    // [Phase C] C-02: user_id_param과 category_param 전달
    // [P1-02] project_id_param 추가 - 프로젝트별 RAG 격리
    // ---------------------------------------------------------------------------
    const { data: searchResults, error: searchError } = await supabase.rpc(
      'match_document_chunks',
      {
        query_embedding: queryEmbedding,
        match_threshold: threshold,
        match_count: validTopK,
        user_id_param: session.user.id,        // [Phase C] 사용자 ID 전달
        category_param: effectiveCategory === '*' ? null : effectiveCategory,  // [Option B] '*' → null (전체 검색)
        project_id_param: body.projectId || null  // [P1-02] 프로젝트 ID 전달 (null이면 RPC가 빈 결과 반환)
      }
    )

    if (searchError) {
      console.error('Vector search error (match_document_chunks):', searchError)
      return NextResponse.json(
        {
          success: false,
          message: '벡터 검색 중 오류가 발생했습니다.',
          error: 'SEARCH_FAILED',
        },
        { status: 500 }
      )
    }

    // ---------------------------------------------------------------------------
    // 5. 결과를 EvidenceItem 형식으로 변환
    // ---------------------------------------------------------------------------
    const dbResults: DBSearchResult[] = searchResults || []
    
    // buildEvidencePack에 전달할 형식으로 변환
    const searchResultsForPack = dbResults.map((result) => ({
      id: String(result.id),
      documentId: (result.metadata?.documentId as string) || 'unknown',
      content: result.content,
      score: result.similarity,
      metadata: result.metadata,
    }))

    // ---------------------------------------------------------------------------
    // 6. EvidencePack 빌드 (P1 Phase 4 자산 활용)
    // ---------------------------------------------------------------------------
    const runId = `search_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    const evidencePack = buildEvidencePack(
      runId,
      searchResultsForPack,
      {
        query: query.trim(),
        retrievalConfigId: 'openai-1536',
        embeddingModelId: EMBEDDING_CONFIG.modelId,
      }
    )

    // ---------------------------------------------------------------------------
    // 7. 성공 응답
    // ---------------------------------------------------------------------------
    return NextResponse.json({
      success: true,
      evidencePack,
      documents: evidencePack.items,
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

