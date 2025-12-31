// =============================================================================
// [P5-03-A, P5-03-B] PRISM Writer - Projects API (GET, POST)
// =============================================================================
// 파일: frontend/src/app/api/projects/route.ts
// 역할: 사용자의 프로젝트 목록 조회 및 생성
// 메서드: GET, POST
// 생성일: 2025-12-31
// 수정일: 2026-01-01 - [P8-SEARCH] 검색/정렬 기능 추가
// =============================================================================

import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import type { Project, CreateProjectInput, ProjectListResponse, ProjectSortBy } from '@/types/project'

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
// GET: 프로젝트 목록 조회
// =============================================================================

/**
 * 사용자의 프로젝트 목록 조회 API
 *
 * @query status - 'active' | 'archived' (기본값: 'active')
 * @query search - 검색어 (이름, 설명에서 검색)
 * @query sortBy - 정렬 기준: 'name' | 'created_at' | 'updated_at' (기본값: 'updated_at')
 * @query sortOrder - 정렬 방향: 'asc' | 'desc' (기본값: 'desc')
 * @returns JSON response with projects array
 *
 * @example
 * GET /api/projects
 * GET /api/projects?status=archived
 * GET /api/projects?search=기업&sortBy=name&sortOrder=asc
 */
export async function GET(
  request: NextRequest
): Promise<NextResponse<ApiResponse<ProjectListResponse>>> {
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
    // 2. 쿼리 파라미터 파싱
    // [P8-SEARCH] 검색/정렬 파라미터 추가
    // -------------------------------------------------------------------------
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') ?? 'active'
    const search = searchParams.get('search')?.trim() ?? ''
    const sortBy = (searchParams.get('sortBy') ?? 'updated_at') as ProjectSortBy
    const sortOrder = searchParams.get('sortOrder') ?? 'desc'

    // 유효한 status 값인지 확인
    if (status !== 'active' && status !== 'archived') {
      return NextResponse.json(
        {
          success: false,
          message: 'status는 "active" 또는 "archived"만 허용됩니다.',
          error: 'BAD_REQUEST',
        },
        { status: 400 }
      )
    }

    // [P8-SEARCH] 유효한 sortBy 값인지 확인
    const validSortBy: ProjectSortBy[] = ['name', 'created_at', 'updated_at']
    if (!validSortBy.includes(sortBy)) {
      return NextResponse.json(
        {
          success: false,
          message: 'sortBy는 "name", "created_at", "updated_at"만 허용됩니다.',
          error: 'BAD_REQUEST',
        },
        { status: 400 }
      )
    }

    // [P8-SEARCH] 유효한 sortOrder 값인지 확인
    if (sortOrder !== 'asc' && sortOrder !== 'desc') {
      return NextResponse.json(
        {
          success: false,
          message: 'sortOrder는 "asc" 또는 "desc"만 허용됩니다.',
          error: 'BAD_REQUEST',
        },
        { status: 400 }
      )
    }

    // -------------------------------------------------------------------------
    // 3. 데이터베이스에서 프로젝트 목록 조회
    // [P7-FIX] deleted_at IS NULL 필터 추가 - 휴지통 프로젝트 제외
    // [P8-SEARCH] 검색 및 정렬 기능 추가
    // -------------------------------------------------------------------------

    // [P8-SEARCH] 기본 쿼리 빌더 생성
    let query = supabase
      .from('projects')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', status)
      .is('deleted_at', null)  // [P7-FIX] 활성 프로젝트만 (휴지통 제외)

    // [P8-SEARCH] 검색어가 있으면 이름 또는 설명에서 검색 (ILIKE)
    if (search) {
      query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`)
    }

    // [P8-SEARCH] 정렬 적용
    query = query.order(sortBy, { ascending: sortOrder === 'asc' })

    const { data: projects, error } = await query

    if (error) {
      console.error('[Projects API] Database query error:', error)
      return NextResponse.json(
        {
          success: false,
          message: '프로젝트 목록을 불러오는 중 오류가 발생했습니다.',
          error: 'DATABASE_ERROR',
        },
        { status: 500 }
      )
    }

    // -------------------------------------------------------------------------
    // 4. 성공 응답
    // -------------------------------------------------------------------------
    const typedProjects = (projects ?? []) as Project[]

    return NextResponse.json({
      success: true,
      data: {
        projects: typedProjects,
        total: typedProjects.length,
      },
    })
  } catch (error) {
    console.error('[Projects API] Unexpected error:', error)
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
// POST: 프로젝트 생성
// =============================================================================

/**
 * 새 프로젝트 생성 API
 * 
 * @body { name: string, description?: string, icon?: string }
 * @returns JSON response with created project
 * 
 * @example
 * POST /api/projects
 * Body: { "name": "새 프로젝트", "description": "설명", "icon": "📚" }
 */
export async function POST(
  request: NextRequest
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
    // 2. 요청 바디 파싱
    // -------------------------------------------------------------------------
    let body: CreateProjectInput
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

    const { name, description, icon } = body

    // -------------------------------------------------------------------------
    // 3. 유효성 검사
    // -------------------------------------------------------------------------
    if (!name || name.trim().length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: '프로젝트 이름은 필수입니다.',
          error: 'VALIDATION_ERROR',
        },
        { status: 400 }
      )
    }

    if (name.length > 100) {
      return NextResponse.json(
        {
          success: false,
          message: '프로젝트 이름은 100자 이내여야 합니다.',
          error: 'VALIDATION_ERROR',
        },
        { status: 400 }
      )
    }

    // -------------------------------------------------------------------------
    // 4. 데이터베이스에 프로젝트 삽입
    // -------------------------------------------------------------------------
    const { data: project, error } = await supabase
      .from('projects')
      .insert({
        user_id: user.id,
        name: name.trim(),
        description: description?.trim() ?? null,
        icon: icon ?? '📁',
      })
      .select()
      .single()

    if (error) {
      console.error('[Projects API] Database insert error:', error)
      return NextResponse.json(
        {
          success: false,
          message: '프로젝트 생성 중 오류가 발생했습니다.',
          error: 'DATABASE_ERROR',
        },
        { status: 500 }
      )
    }

    // -------------------------------------------------------------------------
    // 5. 성공 응답
    // -------------------------------------------------------------------------
    return NextResponse.json(
      {
        success: true,
        data: project as Project,
        message: '프로젝트가 생성되었습니다.',
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('[Projects API] Unexpected error:', error)
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
