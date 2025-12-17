// =============================================================================
// PRISM Writer - Supabase Server Client (Server Component)
// =============================================================================
// 파일: frontend/src/lib/supabase/server.ts
// 역할: 서버 컴포넌트에서 사용하는 Supabase 클라이언트
// 사용처: React Server Components, API Routes, Middleware
// =============================================================================

import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'

// 환경 변수 (빌드 시점에는 없을 수 있음)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

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

  // 빌드 시점 또는 환경 변수 누락 시 처리
  const url = supabaseUrl || 'https://placeholder.supabase.co'
  const key = supabaseAnonKey || 'placeholder-key'

  return createServerClient(url, key, {
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
  })
}

