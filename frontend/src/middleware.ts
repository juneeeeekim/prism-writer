// =============================================================================
// PRISM Writer - Authentication & RBAC Middleware (v2.0)
// =============================================================================
// 파일: frontend/src/middleware.ts
// 역할: 인증 + 역할 기반 접근 제어 (Role-Based Access Control)
// 영향: /editor, /admin 등 보호된 경로 접근 시 인증 및 역할 확인
// 버전: v2.0 (회원등급관리시스템 지원)
// =============================================================================

import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// =============================================================================
// 타입 정의
// =============================================================================

/** 사용자 역할 타입 */
type UserRole = 'pending' | 'free' | 'premium' | 'special' | 'admin'

/** 경로별 접근 요구사항 */
interface RouteRequirement {
  /** 최소 필요 역할 */
  minimumRole: UserRole
  /** 승인 필수 여부 */
  requireApproval: boolean
  /** 접근 거부 시 리다이렉트 경로 */
  redirectTo: string
}

// =============================================================================
// 역할 계층 정의 (v2.0)
// =============================================================================

const ROLE_HIERARCHY: Record<UserRole, number> = {
  pending: 0,
  free: 1,
  premium: 2,
  special: 3,
  admin: 4,
}

// =============================================================================
// 경로별 접근 요구사항 정의 (v2.0)
// =============================================================================

/**
 * 보호된 경로와 필요 권한 설정
 * - 배열 순서대로 매칭 (더 구체적인 경로를 먼저 배치)
 */
const PROTECTED_ROUTES: Array<{ pattern: RegExp; requirement: RouteRequirement }> = [
  // 관리자 전용 경로
  {
    pattern: /^\/admin/,
    requirement: {
      minimumRole: 'admin',
      requireApproval: true,
      redirectTo: '/login?error=admin_required',
    },
  },
  // 프로필 페이지 (v2.0 추가: 모든 로그인 사용자 허용)
  {
    pattern: /^\/profile/,
    requirement: {
      minimumRole: 'pending',
      requireApproval: false,
      redirectTo: '/login?redirect=%2Fprofile',
    },
  },
  // 일반 에디터 (free 이상, 승인 필요)
  {
    pattern: /^\/editor/,
    requirement: {
      minimumRole: 'free',
      requireApproval: true,
      redirectTo: '/login',
    },
  },
]

// =============================================================================
// 유틸리티 함수
// =============================================================================

/**
 * 역할이 최소 요구사항을 충족하는지 확인
 */
function hasMinimumRole(currentRole: UserRole | null, minimumRole: UserRole): boolean {
  if (!currentRole) return false
  return ROLE_HIERARCHY[currentRole] >= ROLE_HIERARCHY[minimumRole]
}

/**
 * 경로에 대한 요구사항 조회
 */
function getRouteRequirement(pathname: string): RouteRequirement | null {
  for (const route of PROTECTED_ROUTES) {
    if (route.pattern.test(pathname)) {
      return route.requirement
    }
  }
  return null
}

// =============================================================================
// 미들웨어 메인 함수
// =============================================================================

/**
 * Next.js 미들웨어 - 인증 + RBAC 처리 (v2.0)
 * 
 * @param req - Next.js 요청 객체
 * @returns NextResponse - 리다이렉트 또는 정상 응답
 * 
 * @description
 * 1. 세션 확인 (비로그인 → 로그인 페이지)
 * 2. 프로필 조회 (역할, 승인 상태)
 * 3. 역할 기반 접근 제어 (권한 부족 → 에러 페이지)
 */
export async function middleware(req: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: req.headers,
    },
  })

  // =============================================================================
  // Supabase 클라이언트 생성 (미들웨어용)
  // =============================================================================
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return req.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          req.cookies.set({
            name,
            value,
            ...options,
          })
          response = NextResponse.next({
            request: {
              headers: req.headers,
            },
          })
          response.cookies.set({
            name,
            value,
            ...options,
          })
        },
        remove(name: string, options: CookieOptions) {
          req.cookies.set({
            name,
            value: '',
            ...options,
          })
          response = NextResponse.next({
            request: {
              headers: req.headers,
            },
          })
          response.cookies.set({
            name,
            value: '',
            ...options,
          })
        },
      },
    }
  )

  // =============================================================================
  // 경로 요구사항 확인
  // =============================================================================
  const pathname = req.nextUrl.pathname
  const requirement = getRouteRequirement(pathname)

  // 보호되지 않은 경로는 통과
  if (!requirement) {
    return response
  }

  // =============================================================================
  // 1단계: 세션 확인
  // =============================================================================
  const {
    data: { session },
  } = await supabase.auth.getSession()

  // 비로그인 상태 → 로그인 페이지로 리다이렉트
  if (!session) {
    const redirectUrl = new URL(requirement.redirectTo, req.url)
    redirectUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(redirectUrl)
  }

  // =============================================================================
  // 2단계: 프로필 조회 (v2.0)
  // =============================================================================
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, is_approved')
    .eq('id', session.user.id)
    .single()

  // 프로필이 없는 경우 (마이그레이션 미완료 등)
  // → 일단 통과 (클라이언트에서 처리)
  if (!profile) {
    console.warn(`[Middleware] 프로필 없음: ${session.user.id}`)
    return response
  }

  const userRole = profile.role as UserRole
  const isApproved = profile.is_approved

  // =============================================================================
  // 3단계: 역할 확인 (v2.0 RBAC)
  // =============================================================================
  if (!hasMinimumRole(userRole, requirement.minimumRole)) {
    // 권한 부족
    const errorUrl = new URL('/login', req.url)
    errorUrl.searchParams.set('error', 'insufficient_role')
    errorUrl.searchParams.set('required', requirement.minimumRole)
    return NextResponse.redirect(errorUrl)
  }

  // =============================================================================
  // 4단계: 승인 상태 확인 (v2.0)
  // =============================================================================
  if (requirement.requireApproval && !isApproved) {
    // 미승인 상태
    const errorUrl = new URL('/login', req.url)
    errorUrl.searchParams.set('error', 'pending_approval')
    return NextResponse.redirect(errorUrl)
  }

  // =============================================================================
  // 모든 검증 통과 → 정상 응답
  // =============================================================================
  return response
}

// =============================================================================
// 미들웨어 적용 경로 설정 (v2.0)
// =============================================================================
/**
 * matcher: 미들웨어가 실행될 경로 패턴
 * - /editor, /admin, /profile 경로에 적용
 * - 성능 최적화: 필요한 경로에만 미들웨어 실행
 */
export const config = {
  matcher: [
    '/editor/:path*',
    '/admin/:path*',
    '/profile/:path*',
  ],
}

