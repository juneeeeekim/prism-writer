// =============================================================================
// PRISM Writer - Writing Coach CRUD API
// =============================================================================
// 파일: frontend/src/app/api/coaches/route.ts
// 역할: 글쓰기 코치 페르소나 생성/조회/수정/삭제
// 생성일: 2026-03-19
// Phase C Track 1: P3-02
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// =============================================================================
// GET: 사용자의 코치 목록 조회
// =============================================================================
// URL: /api/coaches?projectId=xxx
// style_profile은 목록에서 제외 (용량이 크므로)
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

    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('projectId')

    // style_profile 제외한 컬럼만 선택 (목록 조회 최적화)
    let query = supabase
      .from('writing_coaches')
      .select('id, user_id, project_id, name, description, icon, source_document_ids, is_active, created_at, updated_at')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })

    // projectId 필터 (있으면 해당 프로젝트 + NULL 프로젝트 코치 모두 반환)
    if (projectId && projectId !== 'null') {
      query = query.or(`project_id.eq.${projectId},project_id.is.null`)
    }

    const { data, error } = await query

    if (error) {
      console.error('[Coaches API] GET error:', error)
      return NextResponse.json(
        { error: 'Database error', message: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      coaches: data || [],
      count: data?.length || 0
    })

  } catch (err) {
    console.error('[Coaches API] GET unexpected error:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// =============================================================================
// POST: 새 코치 생성
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
    const { name, description, icon, projectId, documentIds } = body

    // 필수 파라미터 검증
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { error: 'Bad request', message: '코치 이름은 필수입니다.' },
        { status: 400 }
      )
    }

    if (!documentIds || !Array.isArray(documentIds) || documentIds.length === 0) {
      return NextResponse.json(
        { error: 'Bad request', message: '참고 문서를 최소 1개 이상 선택해야 합니다.' },
        { status: 400 }
      )
    }

    // documentIds가 사용자 소유인지 검증
    const { data: ownedDocs, error: docError } = await supabase
      .from('user_documents')
      .select('id')
      .eq('user_id', user.id)
      .in('id', documentIds)

    if (docError) {
      console.error('[Coaches API] Document ownership check error:', docError)
      return NextResponse.json(
        { error: 'Database error', message: docError.message },
        { status: 500 }
      )
    }

    if (!ownedDocs || ownedDocs.length !== documentIds.length) {
      return NextResponse.json(
        { error: 'Forbidden', message: '선택한 문서 중 일부가 존재하지 않거나 접근 권한이 없습니다.' },
        { status: 403 }
      )
    }

    // 코치 생성 (style_profile은 빈 객체로 초기화 — 분석 후 업데이트)
    const { data, error } = await supabase
      .from('writing_coaches')
      .insert({
        user_id: user.id,
        project_id: projectId || null,
        name: name.trim(),
        description: description || null,
        icon: icon || '🎓',
        style_profile: {},
        source_document_ids: documentIds,
        is_active: true
      })
      .select()
      .single()

    if (error) {
      console.error('[Coaches API] POST insert error:', error)
      return NextResponse.json(
        { error: 'Database error', message: error.message },
        { status: 500 }
      )
    }

    console.log(`[Coaches API] Coach created: ${data.id} (${data.name})`)

    return NextResponse.json({
      success: true,
      coach: data,
      message: '코치가 생성되었습니다.'
    })

  } catch (err) {
    console.error('[Coaches API] POST unexpected error:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// =============================================================================
// PUT: 코치 정보 수정
// =============================================================================
export async function PUT(request: NextRequest) {
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
    const { id, name, description, icon, is_active } = body

    if (!id) {
      return NextResponse.json(
        { error: 'Bad request', message: '코치 ID가 필요합니다.' },
        { status: 400 }
      )
    }

    // 업데이트할 필드만 구성
    const updateData: Record<string, unknown> = {}
    if (name !== undefined) updateData.name = name.trim()
    if (description !== undefined) updateData.description = description
    if (icon !== undefined) updateData.icon = icon
    if (is_active !== undefined) updateData.is_active = is_active

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: 'Bad request', message: '수정할 항목이 없습니다.' },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from('writing_coaches')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .maybeSingle()

    if (error) {
      console.error('[Coaches API] PUT error:', error)
      return NextResponse.json(
        { error: 'Database error', message: error.message },
        { status: 500 }
      )
    }

    if (!data) {
      return NextResponse.json(
        { error: 'Not found', message: '코치를 찾을 수 없거나 권한이 없습니다.' },
        { status: 404 }
      )
    }

    console.log(`[Coaches API] Coach updated: ${data.id}`)

    return NextResponse.json({
      success: true,
      coach: data,
      message: '코치 정보가 수정되었습니다.'
    })

  } catch (err) {
    console.error('[Coaches API] PUT unexpected error:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// =============================================================================
// DELETE: 코치 삭제
// =============================================================================
// URL: /api/coaches?id=xxx
// =============================================================================
export async function DELETE(request: NextRequest) {
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

    const { searchParams } = new URL(request.url)
    const coachId = searchParams.get('id')

    if (!coachId) {
      return NextResponse.json(
        { error: 'Bad request', message: '삭제할 코치 ID가 필요합니다.' },
        { status: 400 }
      )
    }

    const { error } = await supabase
      .from('writing_coaches')
      .delete()
      .eq('id', coachId)
      .eq('user_id', user.id)

    if (error) {
      console.error('[Coaches API] DELETE error:', error)
      return NextResponse.json(
        { error: 'Database error', message: error.message },
        { status: 500 }
      )
    }

    console.log(`[Coaches API] Coach deleted: ${coachId}`)

    return NextResponse.json({
      success: true,
      message: '코치가 삭제되었습니다.'
    })

  } catch (err) {
    console.error('[Coaches API] DELETE unexpected error:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
