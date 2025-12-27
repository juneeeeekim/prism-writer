// =============================================================================
// PRISM Writer - Evaluations API
// =============================================================================
// 파일: frontend/src/app/api/evaluations/route.ts
// 역할: 평가 결과 저장/조회 API
// 생성일: 2025-12-27
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

    // 최근 평가 이력 조회
    const { data, error } = await supabase
      .from('evaluation_logs')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit)

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
    const { documentText, resultData, overallScore } = body

    // 필수 파라미터 검증
    if (!resultData) {
      return NextResponse.json(
        { error: 'Bad request', message: 'resultData가 필요합니다.' },
        { status: 400 }
      )
    }

    // 문서 해시 생성 (같은 글의 평가 이력 추적용)
    const textHash = documentText ? hashText(documentText) : null

    // 평가 결과 저장
    const { data, error } = await supabase
      .from('evaluation_logs')
      .insert({
        user_id: user.id,
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
