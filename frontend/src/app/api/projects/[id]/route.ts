// =============================================================================
// [P5-03-C, P5-03-D, P5-03-E] PRISM Writer - Project Detail API
// =============================================================================
// 파일: frontend/src/app/api/projects/[id]/route.ts
// 역할: 개별 프로젝트 조회, 수정, 삭제
// 메서드: GET, PATCH, DELETE
// 생성일: 2025-12-31
// =============================================================================

import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import type { Project, UpdateProjectInput } from '@/types/project'

// =============================================================================
// 응답 타입 정의
// =============================================================================

interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  message?: string
  error?: string
}

// =============================================================================
// 라우트 파라미터 타입
// =============================================================================

interface RouteParams {
  params: {
    id: string
  }
}

// =============================================================================
// GET: 프로젝트 상세 조회
// =============================================================================

/**
 * 개별 프로젝트 상세 조회 API
 * 
 * @param id - 프로젝트 ID (UUID)
 * @returns JSON response with project details
 * 
 * @example
 * GET /api/projects/550e8400-e29b-41d4-a716-446655440000
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse<ApiResponse<Project>>> {
  try {
    // -------------------------------------------------------------------------
    // 1. 사용자 인증 확인
    // -------------------------------------------------------------------------
    const supabase = createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        {
          success: false,
          message: '로그인이 필요합니다.',
          error: 'UNAUTHORIZED',
        },
        { status: 401 }
      )
    }

    // -------------------------------------------------------------------------
    // 2. 프로젝트 ID 확인
    // -------------------------------------------------------------------------
    const projectId = params.id
    if (!projectId) {
      return NextResponse.json(
        {
          success: false,
          message: '프로젝트 ID가 필요합니다.',
          error: 'BAD_REQUEST',
        },
        { status: 400 }
      )
    }

    // -------------------------------------------------------------------------
    // 3. 데이터베이스에서 프로젝트 조회 (소유권 확인 포함)
    // -------------------------------------------------------------------------
    const { data: project, error } = await supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .eq('user_id', user.id) // 소유권 이중 확인 (RLS + 쿼리)
      .single()

    if (error || !project) {
      return NextResponse.json(
        {
          success: false,
          message: '프로젝트를 찾을 수 없습니다.',
          error: 'NOT_FOUND',
        },
        { status: 404 }
      )
    }

    // -------------------------------------------------------------------------
    // 4. 성공 응답
    // -------------------------------------------------------------------------
    return NextResponse.json({
      success: true,
      data: project as Project,
    })
  } catch (error) {
    console.error('[Projects API] GET error:', error)
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

// =============================================================================
// PATCH: 프로젝트 수정
// =============================================================================

/**
 * 프로젝트 수정 API
 * 
 * @param id - 프로젝트 ID (UUID)
 * @body { name?: string, description?: string, icon?: string, status?: 'active'|'archived' }
 * @returns JSON response with updated project
 * 
 * @example
 * PATCH /api/projects/550e8400-e29b-41d4-a716-446655440000
 * Body: { "name": "수정된 이름", "status": "archived" }
 */
export async function PATCH(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse<ApiResponse<Project>>> {
  try {
    // -------------------------------------------------------------------------
    // 1. 사용자 인증 확인
    // -------------------------------------------------------------------------
    const supabase = createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        {
          success: false,
          message: '로그인이 필요합니다.',
          error: 'UNAUTHORIZED',
        },
        { status: 401 }
      )
    }

    // -------------------------------------------------------------------------
    // 2. 프로젝트 ID 확인
    // -------------------------------------------------------------------------
    const projectId = params.id
    if (!projectId) {
      return NextResponse.json(
        {
          success: false,
          message: '프로젝트 ID가 필요합니다.',
          error: 'BAD_REQUEST',
        },
        { status: 400 }
      )
    }

    // -------------------------------------------------------------------------
    // 3. 요청 바디 파싱
    // -------------------------------------------------------------------------
    let body: UpdateProjectInput
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        {
          success: false,
          message: '잘못된 요청 형식입니다.',
          error: 'BAD_REQUEST',
        },
        { status: 400 }
      )
    }

    // -------------------------------------------------------------------------
    // 4. 업데이트할 필드 구성
    // -------------------------------------------------------------------------
    const updates: Record<string, unknown> = {}

    if (body.name !== undefined) {
      if (body.name.trim().length === 0) {
        return NextResponse.json(
          {
            success: false,
            message: '프로젝트 이름은 비어있을 수 없습니다.',
            error: 'VALIDATION_ERROR',
          },
          { status: 400 }
        )
      }
      if (body.name.length > 100) {
        return NextResponse.json(
          {
            success: false,
            message: '프로젝트 이름은 100자 이내여야 합니다.',
            error: 'VALIDATION_ERROR',
          },
          { status: 400 }
        )
      }
      updates.name = body.name.trim()
    }

    if (body.description !== undefined) {
      updates.description = body.description?.trim() ?? null
    }

    if (body.icon !== undefined) {
      updates.icon = body.icon
    }

    if (body.status !== undefined) {
      if (body.status !== 'active' && body.status !== 'archived') {
        return NextResponse.json(
          {
            success: false,
            message: 'status는 "active" 또는 "archived"만 허용됩니다.',
            error: 'VALIDATION_ERROR',
          },
          { status: 400 }
        )
      }
      updates.status = body.status
    }

    // [P6-03] setup_completed 필드 처리
    if ((body as { setup_completed?: boolean }).setup_completed !== undefined) {
      updates.setup_completed = (body as { setup_completed?: boolean }).setup_completed
    }

    // 업데이트할 내용이 없는 경우
    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: '수정할 내용이 없습니다.',
          error: 'BAD_REQUEST',
        },
        { status: 400 }
      )
    }

    // updated_at 자동 갱신
    updates.updated_at = new Date().toISOString()

    // -------------------------------------------------------------------------
    // 5. 데이터베이스에서 프로젝트 수정
    // -------------------------------------------------------------------------
    const { data: project, error } = await supabase
      .from('projects')
      .update(updates)
      .eq('id', projectId)
      .eq('user_id', user.id) // 소유권 이중 확인
      .select()
      .single()

    if (error) {
      console.error('[Projects API] PATCH error:', error)
      return NextResponse.json(
        {
          success: false,
          message: '프로젝트 수정 중 오류가 발생했습니다.',
          error: 'DATABASE_ERROR',
        },
        { status: 500 }
      )
    }

    if (!project) {
      return NextResponse.json(
        {
          success: false,
          message: '프로젝트를 찾을 수 없습니다.',
          error: 'NOT_FOUND',
        },
        { status: 404 }
      )
    }

    // -------------------------------------------------------------------------
    // 6. 성공 응답
    // -------------------------------------------------------------------------
    return NextResponse.json({
      success: true,
      data: project as Project,
      message: '프로젝트가 수정되었습니다.',
    })
  } catch (error) {
    console.error('[Projects API] PATCH error:', error)
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

// =============================================================================
// DELETE: 프로젝트 삭제
// =============================================================================

/**
 * 프로젝트 삭제 API
 * 
 * ⚠️ 주의: CASCADE 삭제로 연결된 문서, 평가, 채팅도 모두 삭제됩니다.
 * 
 * @param id - 프로젝트 ID (UUID)
 * @returns 204 No Content on success
 * 
 * @example
 * DELETE /api/projects/550e8400-e29b-41d4-a716-446655440000
 */
export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse<ApiResponse | null>> {
  try {
    // -------------------------------------------------------------------------
    // 1. 사용자 인증 확인
    // -------------------------------------------------------------------------
    const supabase = createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        {
          success: false,
          message: '로그인이 필요합니다.',
          error: 'UNAUTHORIZED',
        },
        { status: 401 }
      )
    }

    // -------------------------------------------------------------------------
    // 2. 프로젝트 ID 확인
    // -------------------------------------------------------------------------
    const projectId = params.id
    if (!projectId) {
      return NextResponse.json(
        {
          success: false,
          message: '프로젝트 ID가 필요합니다.',
          error: 'BAD_REQUEST',
        },
        { status: 400 }
      )
    }

    // -------------------------------------------------------------------------
    // 3. 데이터베이스에서 프로젝트 삭제
    // CASCADE로 연결된 user_documents, evaluation_logs, chat_sessions도 삭제됨
    // -------------------------------------------------------------------------
    const { error } = await supabase
      .from('projects')
      .delete()
      .eq('id', projectId)
      .eq('user_id', user.id) // 소유권 이중 확인

    if (error) {
      console.error('[Projects API] DELETE error:', error)
      return NextResponse.json(
        {
          success: false,
          message: '프로젝트 삭제 중 오류가 발생했습니다.',
          error: 'DATABASE_ERROR',
        },
        { status: 500 }
      )
    }

    // -------------------------------------------------------------------------
    // 4. 성공 응답 (204 No Content)
    // -------------------------------------------------------------------------
    return new NextResponse(null, { status: 204 })
  } catch (error) {
    console.error('[Projects API] DELETE error:', error)
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
