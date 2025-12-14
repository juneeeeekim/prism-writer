// =============================================================================
// PRISM Writer - Authentication Middleware
// =============================================================================
// 파일: frontend/src/middleware.ts
// 역할: 인증되지 않은 사용자를 보호된 경로에서 차단하고 로그인 페이지로 리다이렉트
// 영향: /editor 페이지 접근 시 인증 필요
// =============================================================================

import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * Next.js 미들웨어 - 인증 확인 및 보호된 경로 처리
 * 
 * @param req - Next.js 요청 객체
 * @returns NextResponse - 리다이렉트 또는 정상 응답
 * 
 * @description
 * - 보호된 경로(/editor)에 접근 시 세션 확인
 * - 세션이 없으면 로그인 페이지로 리다이렉트
 * - redirect 쿼리 파라미터로 원래 경로 전달 (로그인 후 복귀용)
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
  // 세션 확인
  // =============================================================================
  const {
    data: { session },
  } = await supabase.auth.getSession()

  // =============================================================================
  // 보호된 경로 확인
  // =============================================================================
  const protectedPaths = ['/editor']
  const isProtectedPath = protectedPaths.some((path) =>
    req.nextUrl.pathname.startsWith(path)
  )

  // =============================================================================
  // 인증 로직: 비로그인 + 보호된 경로 → 로그인 페이지로 리다이렉트
  // =============================================================================
  if (!session && isProtectedPath) {
    const redirectUrl = new URL('/login', req.url)
    // 로그인 후 원래 페이지로 돌아가기 위해 redirect 파라미터 추가
    redirectUrl.searchParams.set('redirect', req.nextUrl.pathname)
    return NextResponse.redirect(redirectUrl)
  }

  return response
}

// =============================================================================
// 미들웨어 적용 경로 설정
// =============================================================================
/**
 * matcher: 미들웨어가 실행될 경로 패턴
 * - /editor로 시작하는 모든 경로에 적용
 * - 성능 최적화: 필요한 경로에만 미들웨어 실행
 */
export const config = {
  matcher: ['/editor/:path*'],
}
