// =============================================================================
// PRISM Writer - RAFT Chunk Count API
// =============================================================================
// 파일: frontend/src/app/api/raft/chunk-count/route.ts
// 역할: 카테고리별 청크 개수 및 토큰 추정치 조회
// 생성일: 2025-12-28
//
// [Phase B] B-04: 청크 개수 API 엔드포인트
// - 프론트엔드 A-03에서 청크 미리보기에 사용
// - 효율적인 count 쿼리 (head: true)
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// =============================================================================
// 상수 정의
// =============================================================================

/** 토큰 한도 경고 기준 */
const TOKEN_WARNING_THRESHOLD = 80000

/** 청크당 평균 토큰 수 추정 */
const AVG_TOKENS_PER_CHUNK = 500

// =============================================================================
// GET: 청크 개수 조회
// =============================================================================

/**
 * 카테고리별 청크 개수 및 추정 토큰 조회 API
 * 
 * @query category - (필수) 조회할 카테고리명
 * @returns { count, estimatedTokens, warning }
 * 
 * @example
 * GET /api/raft/chunk-count?category=마케팅
 * → { count: 42, estimatedTokens: 21000, warning: null }
 */
export async function GET(request: NextRequest) {
  try {
    // ---------------------------------------------------------------------------
    // 쿼리 파라미터 파싱
    // ---------------------------------------------------------------------------
    const category = request.nextUrl.searchParams.get('category')

    if (!category || category.trim() === '') {
      return NextResponse.json(
        { 
          error: 'MISSING_CATEGORY',
          message: 'category 쿼리 파라미터가 필요합니다.' 
        },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // ---------------------------------------------------------------------------
    // Step 1: user_documents에서 해당 카테고리 문서 ID 조회
    // ---------------------------------------------------------------------------
    const { data: docs, error: docError } = await supabase
      .from('user_documents')
      .select('id')
      .eq('category', category)

    if (docError) {
      console.error('[chunk-count] user_documents query error:', docError)
      return NextResponse.json(
        { 
          error: 'DATABASE_ERROR',
          message: '문서 조회 중 오류가 발생했습니다.' 
        },
        { status: 500 }
      )
    }

    if (!docs || docs.length === 0) {
      return NextResponse.json({
        count: 0,
        documentCount: 0,
        estimatedTokens: 0,
        warning: null,
        message: `카테고리 '${category}'에 등록된 문서가 없습니다.`
      })
    }

    // ---------------------------------------------------------------------------
    // Step 2: document_chunks에서 청크 수 count (효율적 조회)
    // ---------------------------------------------------------------------------
    const { count, error: chunkError } = await supabase
      .from('document_chunks')
      .select('*', { count: 'exact', head: true })
      .in('document_id', docs.map(d => d.id))

    if (chunkError) {
      console.error('[chunk-count] document_chunks count error:', chunkError)
      return NextResponse.json(
        { 
          error: 'DATABASE_ERROR',
          message: '청크 수 조회 중 오류가 발생했습니다.' 
        },
        { status: 500 }
      )
    }

    // ---------------------------------------------------------------------------
    // 응답 구성
    // ---------------------------------------------------------------------------
    const chunkCount = count || 0
    const estimatedTokens = chunkCount * AVG_TOKENS_PER_CHUNK

    return NextResponse.json({
      count: chunkCount,
      documentCount: docs.length,
      estimatedTokens,
      warning: estimatedTokens > TOKEN_WARNING_THRESHOLD 
        ? `토큰 한도(${TOKEN_WARNING_THRESHOLD.toLocaleString()}) 초과 가능성`
        : null
    })

  } catch (error) {
    console.error('[chunk-count] Unexpected error:', error)
    return NextResponse.json(
      { 
        error: 'INTERNAL_ERROR',
        message: '서버 오류가 발생했습니다.' 
      },
      { status: 500 }
    )
  }
}
