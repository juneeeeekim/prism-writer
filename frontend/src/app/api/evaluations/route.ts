// =============================================================================
// PRISM Writer - Evaluations API
// =============================================================================
// 파일: frontend/src/app/api/evaluations/route.ts
// 역할: 평가 결과 저장/조회/삭제 API
// 생성일: 2025-12-27
// 수정일: 2025-12-28 (Phase 15: Document-Scoped Evaluations)
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import crypto from 'crypto'

// =============================================================================
// Helper: 텍스트 해시 생성
// =============================================================================
function hashText(text: string): string {
  return crypto.createHash('sha256').update(text).digest('hex').substring(0, 16)
}

// =============================================================================
// GET: 사용자의 평가 이력 조회
// =============================================================================
// Phase 15: documentId 필터 추가 - 문서별 평가 격리
// URL: /api/evaluations?documentId=xxx&limit=10
// =============================================================================
export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    
    // 인증 확인
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized', message: '로그인이 필요합니다.' },
        { status: 401 }
      )
    }

    // URL 파라미터에서 필터 조건 추출
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '10')
    const documentId = searchParams.get('documentId')

    // ---------------------------------------------------------------------------
    // Phase 15: 문서별 평가 조회
    // ---------------------------------------------------------------------------
    let query = supabase
      .from('evaluation_logs')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit)

    // documentId가 있고, 'null' 문자열이 아니면 필터 적용
    if (documentId && documentId !== 'null') {
      query = query.eq('document_id', documentId)
      console.log(`[Evaluations API] GET with documentId filter: ${documentId}`)
    }

    const { data, error } = await query

    if (error) {
      console.error('[Evaluations API] GET error:', error)
      return NextResponse.json(
        { error: 'Database error', message: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      evaluations: data || [],
      count: data?.length || 0
    })

  } catch (err) {
    console.error('[Evaluations API] Unexpected error:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// =============================================================================
// POST: 평가 결과 저장
// =============================================================================
// Phase 15: documentId 필드 추가 - 문서와 평가 연결
// =============================================================================
export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    
    // 인증 확인
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized', message: '로그인이 필요합니다.' },
        { status: 401 }
      )
    }

    const body = await request.json()
    // Phase 15: documentId 추가
    const { documentText, resultData, overallScore, documentId } = body

    // 필수 파라미터 검증
    if (!resultData) {
      return NextResponse.json(
        { error: 'Bad request', message: 'resultData가 필요합니다.' },
        { status: 400 }
      )
    }

    // 문서 해시 생성 (같은 글의 평가 이력 추적용)
    const textHash = documentText ? hashText(documentText) : null

    // ---------------------------------------------------------------------------
    // Phase 15: document_id 포함하여 저장
    // ---------------------------------------------------------------------------
    const { data, error } = await supabase
      .from('evaluation_logs')
      .insert({
        user_id: user.id,
        document_id: documentId || null,  // Phase 15: 문서 ID 연결
        document_text_hash: textHash,
        result_data: resultData,
        overall_score: overallScore ?? null
      })
      .select()
      .single()

    if (error) {
      console.error('[Evaluations API] POST error:', error)
      return NextResponse.json(
        { error: 'Database error', message: error.message },
        { status: 500 }
      )
    }

    console.log(`[Evaluations API] Evaluation saved for document: ${documentId || 'none'}`)

    return NextResponse.json({
      success: true,
      evaluation: data,
      message: '평가 결과가 저장되었습니다.'
    })

  } catch (err) {
    console.error('[Evaluations API] Unexpected error:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// =============================================================================
// DELETE: 평가 결과 삭제
// =============================================================================
// Phase 15: 신규 구현 - 사용자가 평가를 삭제할 수 있도록
// URL: /api/evaluations?id=xxx
// =============================================================================
export async function DELETE(request: NextRequest) {
  try {
    const supabase = createClient()
    
    // 인증 확인
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized', message: '로그인이 필요합니다.' },
        { status: 401 }
      )
    }

    // URL 파라미터에서 평가 ID 추출
    const { searchParams } = new URL(request.url)
    const evaluationId = searchParams.get('id')

    if (!evaluationId) {
      return NextResponse.json(
        { error: 'Bad request', message: '삭제할 평가 ID가 필요합니다.' },
        { status: 400 }
      )
    }

    // ---------------------------------------------------------------------------
    // 평가 삭제 (본인 것만 삭제 가능 - RLS + user_id 체크)
    // ---------------------------------------------------------------------------
    const { error } = await supabase
      .from('evaluation_logs')
      .delete()
      .eq('id', evaluationId)
      .eq('user_id', user.id)  // 본인 데이터만 삭제 가능

    if (error) {
      console.error('[Evaluations API] DELETE error:', error)
      return NextResponse.json(
        { error: 'Database error', message: error.message },
        { status: 500 }
      )
    }

    console.log(`[Evaluations API] Evaluation deleted: ${evaluationId}`)

    return NextResponse.json({
      success: true,
      message: '평가가 삭제되었습니다.'
    })

  } catch (err) {
    console.error('[Evaluations API] Unexpected error:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
