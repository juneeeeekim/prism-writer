// =============================================================================
// PRISM Writer - Supabase Client (Browser/Client Component)
// =============================================================================
// 파일: frontend/src/lib/supabase/client.ts
// 역할: 클라이언트 컴포넌트에서 사용하는 Supabase 클라이언트
// 사용처: React Client Components, 브라우저에서 실행되는 코드
// =============================================================================

import { createBrowserClient } from '@supabase/ssr'

// 환경 변수 (빌드 시점에는 없을 수 있음)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

/**
 * 클라이언트 컴포넌트용 Supabase 클라이언트 생성
 * 
 * @returns Supabase 클라이언트 인스턴스
 * 
 * @example
 * ```tsx
 * 'use client'
 * import { createClient } from '@/lib/supabase/client'
 * 
 * export default function MyComponent() {
 *   const supabase = createClient()
 *   // ... 사용
 * }
 * ```
 */
export const createClient = () => {
  // 빌드 시점 또는 환경 변수 누락 시 빈 값으로 처리
  // 실제 런타임에서만 Supabase가 동작함
  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('[Supabase] 환경 변수가 설정되지 않았습니다.')
    // 타입 호환을 위해 빈 URL로 클라이언트 생성 (실제 호출 시 에러 발생)
    return createBrowserClient(
      'https://placeholder.supabase.co',
      'placeholder-key'
    )
  }
  
  return createBrowserClient(supabaseUrl, supabaseAnonKey)
}

