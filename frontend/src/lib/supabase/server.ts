// =============================================================================
// PRISM Writer - Supabase Server Client (Server Component)
// =============================================================================
// 파일: frontend/src/lib/supabase/server.ts
// 역할: 서버 컴포넌트에서 사용하는 Supabase 클라이언트
// 사용처: React Server Components, API Routes, Middleware
// =============================================================================

import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * 서버 컴포넌트용 Supabase 클라이언트 생성
 * 
 * @returns Supabase 클라이언트 인스턴스
 * 
 * @example
 * ```tsx
 * import { createClient } from '@/lib/supabase/server'
 * 
 * export default async function ServerComponent() {
 *   const supabase = createClient()
 *   const { data } = await supabase.auth.getSession()
 *   // ... 사용
 * }
 * ```
 * 
 * @note
 * - Next.js의 cookies()를 사용하여 세션 쿠키 접근
 * - 서버 사이드에서만 실행 가능
 */
export const createClient = () => {
  const cookieStore = cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options })
          } catch (error) {
            // Server Component에서 set 호출 시 무시 (읽기 전용)
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: '', ...options })
          } catch (error) {
            // Server Component에서 remove 호출 시 무시 (읽기 전용)
          }
        },
      },
    }
  )
}
