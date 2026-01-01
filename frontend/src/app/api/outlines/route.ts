// =============================================================================
// PRISM Writer - Outlines API
// =============================================================================
// 파일: frontend/src/app/api/outlines/route.ts
// 역할: 목차 저장/조회 API
// 생성일: 2025-12-27
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// =============================================================================
// GET: 사용자의 목차 목록 조회
// =============================================================================
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // 인증 확인
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized', message: '로그인이 필요합니다.' },
        { status: 401 }
      )
    }

    // 최근 목차 조회 (최대 20개)
    const { data, error } = await supabase
      .from('outlines')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20)

    if (error) {
      console.error('[Outlines API] GET error:', error)
      return NextResponse.json(
        { error: 'Database error', message: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      outlines: data || [],
      count: data?.length || 0
    })

  } catch (err) {
    console.error('[Outlines API] Unexpected error:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// =============================================================================
// POST: 새 목차 저장
// =============================================================================
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // 인증 확인
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized', message: '로그인이 필요합니다.' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { topic, outlineData, sourcesUsed } = body

    // 필수 파라미터 검증
    if (!topic || !outlineData) {
      return NextResponse.json(
        { error: 'Bad request', message: 'topic과 outlineData가 필요합니다.' },
        { status: 400 }
      )
    }

    // 목차 저장
    const { data, error } = await supabase
      .from('outlines')
      .insert({
        user_id: user.id,
        topic,
        outline_data: outlineData,
        sources_used: sourcesUsed || 0
      })
      .select()
      .single()

    if (error) {
      console.error('[Outlines API] POST error:', error)
      return NextResponse.json(
        { error: 'Database error', message: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      outline: data,
      message: '목차가 저장되었습니다.'
    })

  } catch (err) {
    console.error('[Outlines API] Unexpected error:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
