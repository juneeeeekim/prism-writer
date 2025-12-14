// =============================================================================
// PRISM Writer - useAuth Hook
// =============================================================================
// 파일: frontend/src/hooks/useAuth.ts
// 역할: 인증 상태 관리 커스텀 훅
// 기능: 사용자 정보 조회, 로딩 상태, 로그아웃 기능
// =============================================================================

'use client'

import { useState, useEffect, useCallback } from 'react'
import { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

// =============================================================================
// Types
// =============================================================================
interface UseAuthReturn {
  /** 현재 로그인된 사용자 정보 (null이면 비로그인) */
  user: User | null
  /** 인증 상태 로딩 중 여부 */
  loading: boolean
  /** 로그아웃 함수 */
  signOut: () => Promise<void>
  /** 로그아웃 진행 중 여부 */
  signingOut: boolean
}

/**
 * 인증 상태 관리 훅
 * 
 * @returns {UseAuthReturn} 사용자 정보, 로딩 상태, 로그아웃 함수
 * 
 * @example
 * ```tsx
 * 'use client'
 * import { useAuth } from '@/hooks/useAuth'
 * 
 * export default function Header() {
 *   const { user, loading, signOut } = useAuth()
 *   
 *   if (loading) return <div>로딩 중...</div>
 *   
 *   return user ? (
 *     <button onClick={signOut}>로그아웃</button>
 *   ) : (
 *     <Link href="/login">로그인</Link>
 *   )
 * }
 * ```
 */
export function useAuth(): UseAuthReturn {
  // =============================================================================
  // State
  // =============================================================================
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [signingOut, setSigningOut] = useState(false)
  
  const router = useRouter()
  const supabase = createClient()

  // =============================================================================
  // 초기 사용자 정보 로드 및 인증 상태 변경 감지
  // =============================================================================
  useEffect(() => {
    // 초기 세션 확인
    const getInitialSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        setUser(session?.user ?? null)
      } catch (error) {
        console.error('세션 확인 오류:', error)
        setUser(null)
      } finally {
        setLoading(false)
      }
    }

    getInitialSession()

    // 인증 상태 변경 리스너
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null)
        setLoading(false)
      }
    )

    // 클린업
    return () => {
      subscription.unsubscribe()
    }
  }, [supabase.auth])

  // =============================================================================
  // 로그아웃 함수
  // =============================================================================
  const signOut = useCallback(async () => {
    setSigningOut(true)
    try {
      await supabase.auth.signOut()
      setUser(null)
      router.push('/')
      router.refresh()
    } catch (error) {
      console.error('로그아웃 오류:', error)
    } finally {
      setSigningOut(false)
    }
  }, [supabase.auth, router])

  return {
    user,
    loading,
    signOut,
    signingOut,
  }
}

// 기본 내보내기
export default useAuth
