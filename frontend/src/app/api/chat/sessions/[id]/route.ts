import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = params

    // =========================================================================
    // [Phase 1] Session 조회 (기존 로직 유지)
    // =========================================================================
    const { data: session, error: sessionError } = await supabase
      .from('chat_sessions')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (sessionError || !session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    // =========================================================================
    // [Phase 1] Messages 조회 (기존 로직 유지)
    // =========================================================================
    const { data: messages, error: messagesError } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('session_id', id)
      .order('created_at', { ascending: true })

    if (messagesError) {
      console.error('Error fetching messages:', messagesError)
      return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 })
    }

    // =========================================================================
    // [Feedback Sync] P1-01: 피드백 이벤트 조회 및 매핑
    // =========================================================================
    // 해당 프로젝트의 채팅 피드백 이벤트를 조회
    let feedbackEvents: Array<{ event_type: string; event_data: any }> = []
    
    try {
      // session.project_id가 있을 때만 조회 (프로젝트 미연결 세션은 스킵)
      if (session.project_id) {
        const { data: feedbackData } = await supabase
          .from('learning_events')
          .select('event_type, event_data')
          .eq('user_id', user.id)
          .eq('project_id', session.project_id)
          .in('event_type', ['chat_helpful', 'chat_not_helpful', 'chat_hallucination'])
        
        feedbackEvents = feedbackData ?? []
      }
    } catch (feedbackError) {
      // 피드백 조회 실패 시에도 메시지는 정상 반환 (graceful degradation)
      console.warn('[Feedback Sync] Failed to fetch feedback events:', feedbackError)
    }

    // 메시지에 피드백 상태 매핑
    const messagesWithFeedback = (messages ?? []).map((msg: any) => ({
      ...msg,
      // event_data.messageId와 msg.id 매칭하여 피드백 타입 반환
      feedback: feedbackEvents.find(
        (f) => f.event_data?.messageId === msg.id
      )?.event_type ?? null
    }))

    return NextResponse.json({ session, messages: messagesWithFeedback })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = params
    const body = await request.json()
    const { title } = body

    const { error } = await supabase
      .from('chat_sessions')
      .update({ title })
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) {
      console.error('Error updating session:', error)
      return NextResponse.json({ error: 'Failed to update session' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = params

    const { error } = await supabase
      .from('chat_sessions')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) {
      console.error('Error deleting session:', error)
      return NextResponse.json({ error: 'Failed to delete session' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
