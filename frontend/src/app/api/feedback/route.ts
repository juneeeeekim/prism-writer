import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * POST /api/feedback
 * 템플릿에 대한 사용자 피드백 수집
 */
export async function POST(request: Request) {
  try {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { template_id, helpful, comment } = body

    if (!template_id || helpful === undefined) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const { error } = await supabase
      .from('template_feedback')
      .insert({
        template_id,
        user_id: session.user.id,
        helpful,
        comment
      })

    if (error) {
      console.error('[Feedback API] DB Error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // 통계 업데이트 (선택 사항: 트리거로 처리하거나 여기서 직접 수행)
    // 여기서는 간단하게 성공 응답만 반환

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Feedback API] Error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
