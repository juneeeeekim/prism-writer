// =============================================================================
// PRISM Writer - Feedback API
// =============================================================================
// 파일: frontend/src/app/api/feedback/route.ts
// 역할: 사용자 피드백 저장 및 조회 API
// =============================================================================

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// =============================================================================
// 타입 정의
// =============================================================================

interface FeedbackRequest {
  evaluationId: string
  feedbackType: 'like' | 'dislike'
  comment?: string
}

// =============================================================================
// POST: 피드백 저장
// =============================================================================

export async function POST(request: Request): Promise<NextResponse> {
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
        { success: false, message: '로그인이 필요합니다.' },
        { status: 401 }
      )
    }

    const userId = session.user.id

    // ---------------------------------------------------------------------------
    // 2. 요청 바디 파싱
    // ---------------------------------------------------------------------------
    let body: FeedbackRequest
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { success: false, message: '요청 형식이 올바르지 않습니다.' },
        { status: 400 }
      )
    }

    const { evaluationId, feedbackType, comment } = body

    if (!evaluationId || !feedbackType) {
      return NextResponse.json(
        { success: false, message: '필수 필드가 누락되었습니다.' },
        { status: 400 }
      )
    }

    if (!['like', 'dislike'].includes(feedbackType)) {
      return NextResponse.json(
        { success: false, message: '유효하지 않은 피드백 타입입니다.' },
        { status: 400 }
      )
    }

    // ---------------------------------------------------------------------------
    // 3. 피드백 저장
    // ---------------------------------------------------------------------------
    const { error } = await supabase.from('evaluation_feedback').upsert({
      user_id: userId,
      evaluation_id: evaluationId,
      feedback_type: feedbackType,
      comment: comment || null,
      created_at: new Date().toISOString(),
    }, {
      onConflict: 'user_id,evaluation_id', // 중복 시 업데이트
    })

    if (error) {
      console.error('Failed to save feedback:', error)
      return NextResponse.json(
        { success: false, message: '피드백 저장에 실패했습니다.' },
        { status: 500 }
      )
    }

    // ---------------------------------------------------------------------------
    // 4. 성공 응답
    // ---------------------------------------------------------------------------
    return NextResponse.json({
      success: true,
      message: '피드백이 저장되었습니다.',
    })
  } catch (error) {
    console.error('Unexpected error in feedback API:', error)
    return NextResponse.json(
      { success: false, message: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

// =============================================================================
// GET: 피드백 통계 조회
// =============================================================================

export async function GET(): Promise<NextResponse> {
  try {
    const supabase = createClient()
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
      return NextResponse.json(
        { success: false, message: '로그인이 필요합니다.' },
        { status: 401 }
      )
    }

    // 최근 30일 피드백 통계
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const { data: feedbackData, error } = await supabase
      .from('evaluation_feedback')
      .select('feedback_type')
      .gte('created_at', thirtyDaysAgo.toISOString())

    if (error) {
      console.error('Failed to fetch feedback stats:', error)
      return NextResponse.json(
        { success: false, message: '통계 조회에 실패했습니다.' },
        { status: 500 }
      )
    }

    const likes = feedbackData?.filter((f) => f.feedback_type === 'like').length || 0
    const dislikes = feedbackData?.filter((f) => f.feedback_type === 'dislike').length || 0
    const total = likes + dislikes
    const satisfactionRate = total > 0 ? Math.round((likes / total) * 100) : 0

    return NextResponse.json({
      success: true,
      stats: {
        likes,
        dislikes,
        total,
        satisfactionRate,
        period: '30일',
      },
    })
  } catch (error) {
    console.error('Unexpected error in feedback stats:', error)
    return NextResponse.json(
      { success: false, message: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
