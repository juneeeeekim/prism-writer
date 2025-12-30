// =============================================================================
// [P5-04-C] Chat Sessions API - projectId 지원 추가
// =============================================================================

import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// =============================================================================
// GET: 채팅 세션 목록 조회
// =============================================================================

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // -------------------------------------------------------------------------
    // [P5-04-C] projectId 필터 지원
    // -------------------------------------------------------------------------
    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('projectId')

    let query = supabase
      .from('chat_sessions')
      .select('*')
      .eq('user_id', user.id)

    // projectId가 있으면 해당 프로젝트의 세션만 조회
    if (projectId) {
      query = query.eq('project_id', projectId)
    }

    const { data: sessions, error } = await query
      .order('updated_at', { ascending: false })
      .limit(50)

    if (error) {
      console.error('Error fetching chat sessions:', error)
      return NextResponse.json({ error: 'Failed to fetch sessions' }, { status: 500 })
    }

    return NextResponse.json({ sessions })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// =============================================================================
// POST: 새 채팅 세션 생성
// =============================================================================

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    // [P5-04-C] projectId 추가 지원
    const { title, model, projectId } = body

    const { data: session, error } = await supabase
      .from('chat_sessions')
      .insert({
        user_id: user.id,
        title: title || '새 대화',
        model_id: model,
        project_id: projectId || null  // [P5-04-C] 프로젝트 연결
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating chat session:', error)
      return NextResponse.json({ error: 'Failed to create session' }, { status: 500 })
    }

    return NextResponse.json({ session })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

