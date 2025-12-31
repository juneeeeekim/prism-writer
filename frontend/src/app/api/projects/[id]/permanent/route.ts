// =============================================================================
// [P7-02-C] PRISM Writer - Project Permanent Delete API
// =============================================================================
// 파일: frontend/src/app/api/projects/[id]/permanent/route.ts
// 역할: 휴지통에서 프로젝트 영구 삭제
// 메서드: DELETE
// 생성일: 2026-01-01
// JeDebug 패치: 휴지통에 있는 프로젝트만 영구 삭제 가능
// =============================================================================

import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// Dynamic rendering for Vercel deployment
export const dynamic = 'force-dynamic'

// =============================================================================
// 응답 타입 정의
// =============================================================================

interface ApiResponse {
  success: boolean
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
// DELETE: 프로젝트 영구 삭제
// =============================================================================

/**
 * [P7-02-C] 프로젝트 영구 삭제 API
 * 
 * ⚠️ 경고: 이 작업은 되돌릴 수 없습니다!
 * CASCADE 삭제로 연결된 문서, 평가, 채팅도 모두 영구 삭제됩니다.
 * 
 * JeDebug 패치: 휴지통에 있는 프로젝트만 영구 삭제 가능
 * (활성 프로젝트는 먼저 휴지통으로 이동해야 함)
 * 
 * @param id - 프로젝트 ID (UUID)
 * @returns JSON response with deletion confirmation
 * 
 * @example
 * DELETE /api/projects/550e8400-e29b-41d4-a716-446655440000/permanent
 */
export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse<ApiResponse>> {
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
    // [Step 3] 휴지통 확인 (deleted_at이 NOT NULL인지)
    // JeDebug 패치: 활성 프로젝트 직접 영구삭제 방지
    // -------------------------------------------------------------------------
    const { data: project } = await supabase
      .from('projects')
      .select('id, deleted_at')
      .eq('id', projectId)
      .eq('user_id', user.id)
      .single()

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

    // 활성 프로젝트인 경우 (deleted_at이 NULL) - 영구 삭제 차단
    if (project.deleted_at === null) {
      return NextResponse.json(
        {
          success: false,
          message: '활성 프로젝트는 영구 삭제할 수 없습니다. 먼저 휴지통으로 이동해주세요.',
          error: 'BAD_REQUEST',
        },
        { status: 400 }
      )
    }

    // -------------------------------------------------------------------------
    // [Step 4] 영구 삭제 실행
    // CASCADE로 연결된 모든 데이터도 함께 삭제됨
    // -------------------------------------------------------------------------
    const { error } = await supabase
      .from('projects')
      .delete()
      .eq('id', projectId)
      .eq('user_id', user.id)

    if (error) {
      console.error('[Projects API] PERMANENT DELETE error:', error)
      return NextResponse.json(
        {
          success: false,
          message: '프로젝트 영구 삭제 중 오류가 발생했습니다.',
          error: 'DATABASE_ERROR',
        },
        { status: 500 }
      )
    }

    // -------------------------------------------------------------------------
    // [Step 5] 성공 응답
    // -------------------------------------------------------------------------
    return NextResponse.json({
      success: true,
      message: '프로젝트가 영구적으로 삭제되었습니다.',
    })
  } catch (error) {
    console.error('[Projects API] PERMANENT DELETE error:', error)
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
