// =============================================================================
// [P7-02-B] PRISM Writer - Project Restore API
// =============================================================================
// 파일: frontend/src/app/api/projects/[id]/restore/route.ts
// 역할: 휴지통에서 프로젝트 복구
// 메서드: PATCH
// 생성일: 2026-01-01
// =============================================================================

import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import type { Project } from '@/types/project'

// Dynamic rendering for Vercel deployment
export const dynamic = 'force-dynamic'

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
// PATCH: 프로젝트 복구 (휴지통에서 꺼내기)
// =============================================================================

/**
 * [P7-02-B] 프로젝트 복구 API
 * 
 * 휴지통에 있는 프로젝트를 다시 활성 상태로 복구합니다.
 * deleted_at을 NULL로 설정하여 복구합니다.
 * 
 * @param id - 프로젝트 ID (UUID)
 * @returns JSON response with restored project
 * 
 * @example
 * PATCH /api/projects/550e8400-e29b-41d4-a716-446655440000/restore
 */
export async function PATCH(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse<ApiResponse<Project>>> {
  try {
    // -------------------------------------------------------------------------
    // [Step 1] 사용자 인증 확인
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
    // [Step 2] 프로젝트 ID 확인
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
    // [Step 3] 프로젝트 복구 (deleted_at = NULL)
    // 휴지통에 있는 프로젝트만 복구 가능 (deleted_at IS NOT NULL)
    // -------------------------------------------------------------------------
    const { data: project, error } = await supabase
      .from('projects')
      .update({ 
        deleted_at: null, 
        updated_at: new Date().toISOString() 
      })
      .eq('id', projectId)
      .eq('user_id', user.id)
      .not('deleted_at', 'is', null)  // 휴지통에 있는 것만
      .select()
      .single()

    if (error) {
      console.error('[Projects API] RESTORE error:', error)
      return NextResponse.json(
        {
          success: false,
          message: '프로젝트 복구 중 오류가 발생했습니다.',
          error: 'DATABASE_ERROR',
        },
        { status: 500 }
      )
    }

    if (!project) {
      return NextResponse.json(
        {
          success: false,
          message: '복구할 프로젝트를 찾을 수 없습니다. 이미 복구되었거나 존재하지 않습니다.',
          error: 'NOT_FOUND',
        },
        { status: 404 }
      )
    }

    // -------------------------------------------------------------------------
    // [Step 4] 성공 응답
    // -------------------------------------------------------------------------
    return NextResponse.json({
      success: true,
      message: '프로젝트가 복구되었습니다.',
      data: project as Project,
    })
  } catch (error) {
    console.error('[Projects API] RESTORE error:', error)
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
