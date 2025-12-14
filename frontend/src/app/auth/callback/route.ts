// =============================================================================
// PRISM Writer - OAuth Callback Route
// =============================================================================
// 파일: frontend/src/app/auth/callback/route.ts
// 역할: Supabase 인증 콜백 처리 (이메일 확인, 비밀번호 재설정 등)
// 사용처: 이메일 확인 링크, 비밀번호 재설정 링크 클릭 시
// =============================================================================

import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

/**
 * GET /auth/callback
 * 
 * Supabase 인증 콜백을 처리합니다.
 * - 이메일 확인 후 리다이렉트
 * - 비밀번호 재설정 링크 처리
 * - OAuth 인증 코드 교환
 * 
 * @param request - 들어오는 HTTP 요청
 * @returns NextResponse - 적절한 페이지로 리다이렉트
 */
export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const next = requestUrl.searchParams.get('next') || '/'

  // =============================================================================
  // 인증 코드가 있으면 세션으로 교환
  // =============================================================================
  if (code) {
    const cookieStore = cookies()

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          },
          set(name: string, value: string, options: CookieOptions) {
            cookieStore.set({ name, value, ...options })
          },
          remove(name: string, options: CookieOptions) {
            cookieStore.set({ name, value: '', ...options })
          },
        },
      }
    )

    // 인증 코드를 세션으로 교환
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      // 성공: 지정된 페이지 또는 에디터로 리다이렉트
      return NextResponse.redirect(new URL(next, requestUrl.origin))
    }
  }

  // =============================================================================
  // 에러 발생 시 로그인 페이지로 리다이렉트
  // =============================================================================
  return NextResponse.redirect(new URL('/login?error=callback_failed', requestUrl.origin))
}
