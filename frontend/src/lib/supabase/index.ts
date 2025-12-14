// =============================================================================
// PRISM Writer - Supabase Client Index
// =============================================================================
// 파일: frontend/src/lib/supabase/index.ts
// 역할: Supabase 클라이언트 export 통합
// =============================================================================

/**
 * 브라우저/클라이언트 컴포넌트용 Supabase 클라이언트
 * 
 * @example
 * ```tsx
 * 'use client'
 * import { createBrowserClient } from '@/lib/supabase'
 * 
 * const supabase = createBrowserClient()
 * ```
 */
export { createClient as createBrowserClient } from './client'

/**
 * 서버 컴포넌트용 Supabase 클라이언트
 * 
 * @example
 * ```tsx
 * import { createServerClient } from '@/lib/supabase'
 * 
 * const supabase = createServerClient()
 * ```
 */
export { createClient as createServerClient } from './server'
