// =============================================================================
// PRISM Writer - API Auth Wrapper
// =============================================================================
// 파일: frontend/src/lib/api/withAuth.ts
// 역할: API Route 공통 인증 + 에러 핸들링 래퍼
// 생성: 2026-03-05 Health Audit — 35개 API 라우트의 보일러플레이트 공통화
// 사용법:
//   export const GET = withAuth(async (request, user, supabase) => {
//     // user.id, user.email 사용 가능
//     // supabase 클라이언트 바로 사용 가능
//     return NextResponse.json({ data: ... })
//   })
// =============================================================================

import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// =============================================================================
// 타입 정의
// =============================================================================

/** 인증된 사용자 정보 */
interface AuthenticatedUser {
  id: string
  email: string
}

/** 인증 완료 후 실행되는 핸들러 타입 */
type AuthenticatedHandler = (
  request: Request,
  user: AuthenticatedUser,
  supabase: Awaited<ReturnType<typeof createClient>>
) => Promise<NextResponse>

// =============================================================================
// withAuth — API 공통 인증 래퍼
// =============================================================================

/**
 * API Route에서 인증 + 에러 핸들링을 자동으로 처리하는 HOF
 *
 * @description
 * - Supabase 세션 확인 → 미인증 시 401 응답
 * - 핸들러 실행 중 예외 발생 시 500 응답 + 서버 로그
 * - 기존 35개 API 라우트의 반복 코드를 대체
 *
 * @example
 * // app/api/example/route.ts
 * import { withAuth } from '@/lib/api/withAuth'
 *
 * export const GET = withAuth(async (request, user, supabase) => {
 *   const { data } = await supabase.from('table').select('*').eq('user_id', user.id)
 *   return NextResponse.json({ data })
 * })
 */
export function withAuth(handler: AuthenticatedHandler) {
  return async (request: Request) => {
    try {
      const supabase = await createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user || !user.email) {
        return NextResponse.json(
          { error: 'Unauthorized', message: '로그인이 필요합니다.' },
          { status: 401 }
        )
      }

      return await handler(
        request,
        { id: user.id, email: user.email },
        supabase
      )
    } catch (error) {
      console.error('[API Error]', error)
      return NextResponse.json(
        { error: 'Internal Server Error', message: '서버 오류가 발생했습니다.' },
        { status: 500 }
      )
    }
  }
}
