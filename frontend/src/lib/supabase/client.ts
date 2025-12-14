// =============================================================================
// PRISM Writer - Supabase Client (Browser/Client Component)
// =============================================================================
// 파일: frontend/src/lib/supabase/client.ts
// 역할: 클라이언트 컴포넌트에서 사용하는 Supabase 클라이언트
// 사용처: React Client Components, 브라우저에서 실행되는 코드
// =============================================================================

import { createBrowserClient } from '@supabase/ssr'

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
export const createClient = () =>
  createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
