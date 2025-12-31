// =============================================================================
// [P7-02-D] PRISM Writer - Project Trash List API
// =============================================================================
// 파일: frontend/src/app/api/projects/trash/route.ts
// 역할: 휴지통에 있는 프로젝트 목록 조회
// 메서드: GET
// 생성일: 2026-01-01
// =============================================================================

import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import type { Project } from '@/types/project'

// =============================================================================
// 응답 타입 정의
// =============================================================================

interface TrashProject extends Project {
  /** 삭제된 시간 */
  deleted_at: string
  /** 영구 삭제까지 남은 일수 */
  days_remaining: number
}

interface ApiResponse {
  success: boolean
  data?: TrashProject[]
  total?: number
  message?: string
  error?: string
}

// =============================================================================
// 유틸리티 함수
// =============================================================================

/**
 * 영구 삭제까지 남은 일수 계산
 * @param deletedAt - 삭제된 시간 (ISO 8601)
 * @returns 남은 일수 (0 이상)
 */
function getDaysRemaining(deletedAt: string): number {
  const deleted = new Date(deletedAt)
  const expiry = new Date(deleted.getTime() + 30 * 24 * 60 * 60 * 1000) // 30일 후
  const now = new Date()
  return Math.max(0, Math.ceil((expiry.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)))
}

// =============================================================================
// GET: 휴지통 프로젝트 목록 조회
// =============================================================================

/**
 * [P7-02-D] 휴지통 프로젝트 목록 API
 * 
 * 삭제된 프로젝트 목록을 조회합니다.
 * 각 프로젝트에 영구 삭제까지 남은 일수(days_remaining)가 포함됩니다.
 * 
 * @returns JSON response with trashed projects
 * 
 * @example
 * GET /api/projects/trash
 */
export async function GET(
  request: NextRequest
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
    // [Step 2] 휴지통 프로젝트 조회 (deleted_at IS NOT NULL)
    // RLS 정책 projects_trash_access가 자동 적용됨
    // -------------------------------------------------------------------------
    const { data: projects, error } = await supabase
      .from('projects')
      .select('*')
      .eq('user_id', user.id)
      .not('deleted_at', 'is', null)  // 휴지통에 있는 것만
      .order('deleted_at', { ascending: false })  // 최근 삭제순

    if (error) {
      console.error('[Projects API] TRASH LIST error:', error)
      return NextResponse.json(
        {
          success: false,
          message: '휴지통 조회 중 오류가 발생했습니다.',
          error: 'DATABASE_ERROR',
        },
        { status: 500 }
      )
    }

    // -------------------------------------------------------------------------
    // [Step 3] 남은 일수 계산 추가
    // -------------------------------------------------------------------------
    const trashProjects: TrashProject[] = (projects || []).map((project) => ({
      ...project,
      days_remaining: getDaysRemaining(project.deleted_at),
    }))

    // -------------------------------------------------------------------------
    // [Step 4] 성공 응답
    // -------------------------------------------------------------------------
    return NextResponse.json({
      success: true,
      data: trashProjects,
      total: trashProjects.length,
    })
  } catch (error) {
    console.error('[Projects API] TRASH LIST error:', error)
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
