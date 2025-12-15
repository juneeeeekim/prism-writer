// =============================================================================
// PRISM Writer - useAuth Hook (v2.0 회원등급관리시스템 지원)
// =============================================================================
// 파일: frontend/src/hooks/useAuth.ts
// 역할: 인증 상태 관리 커스텀 훅 + 사용자 프로필/등급 정보
// 기능: 사용자 정보 조회, 프로필 조회, 로그아웃, 등급 확인
// =============================================================================

'use client'

import { useState, useEffect, useCallback } from 'react'
import { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { 
  UserProfile, 
  ProfileRow, 
  mapProfileRowToUserProfile,
  UserRole 
} from '@/types/auth'

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
  /** Google OAuth 로그인 함수 */
  signInWithGoogle: () => Promise<void>
  
  // ==========================================================================
  // v2.0: 회원등급관리시스템 추가 필드
  // ==========================================================================
  /** 사용자 프로필 (등급, 할당량 포함) */
  profile: UserProfile | null
  /** 프로필 로딩 중 여부 */
  profileLoading: boolean
  /** 사용자 역할 */
  role: UserRole | null
  /** 관리자 여부 */
  isAdmin: boolean
  /** 프리미엄 이상 여부 (premium, special, admin) */
  isPremium: boolean
  /** LLM 사용 가능 여부 (pending이 아니고 승인됨) */
  canUseLLM: boolean
  /** 일일 요청 한도 */
  dailyRequestLimit: number
  /** 월간 토큰 한도 */
  monthlyTokenLimit: number
  /** 프로필 새로고침 함수 */
  refreshProfile: () => Promise<void>
}

/**
 * 인증 상태 관리 훅 (v2.0)
 * 
 * @returns {UseAuthReturn} 사용자 정보, 프로필, 등급 정보, 로그아웃 함수
 * 
 * @example
 * ```tsx
 * 'use client'
 * import { useAuth } from '@/hooks/useAuth'
 * 
 * export default function Header() {
 *   const { user, profile, role, isAdmin, canUseLLM, loading } = useAuth()
 *   
 *   if (loading) return <div>로딩 중...</div>
 *   
 *   return (
 *     <div>
 *       {user && <span>등급: {role}</span>}
 *       {canUseLLM && <span>AI 사용 가능</span>}
 *     </div>
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
  
  // v2.0: 프로필 상태 추가
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [profileLoading, setProfileLoading] = useState(false)
  
  const router = useRouter()
  const supabase = createClient()

  // =============================================================================
  // v2.0: 프로필 조회 함수
  // =============================================================================
  const fetchProfile = useCallback(async (userId: string) => {
    setProfileLoading(true)
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()
      
      if (error) {
        // 프로필이 없는 경우 (트리거 실패 등)
        console.warn('프로필 조회 실패:', error.message)
        setProfile(null)
      } else if (data) {
        setProfile(mapProfileRowToUserProfile(data as ProfileRow))
      }
    } catch (error) {
      console.error('프로필 조회 오류:', error)
      setProfile(null)
    } finally {
      setProfileLoading(false)
    }
  }, [supabase])

  // =============================================================================
  // v2.0: 프로필 새로고침 (외부에서 호출용)
  // =============================================================================
  const refreshProfile = useCallback(async () => {
    if (user?.id) {
      await fetchProfile(user.id)
    }
  }, [user, fetchProfile])

  // =============================================================================
  // 초기 사용자 정보 로드 및 인증 상태 변경 감지
  // =============================================================================
  useEffect(() => {
    // 초기 세션 확인
    const getInitialSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        const currentUser = session?.user ?? null
        setUser(currentUser)
        
        // v2.0: 사용자가 있으면 프로필도 조회
        if (currentUser) {
          await fetchProfile(currentUser.id)
        }
      } catch (error) {
        console.error('세션 확인 오류:', error)
        setUser(null)
        setProfile(null)
      } finally {
        setLoading(false)
      }
    }

    getInitialSession()

    // 인증 상태 변경 리스너
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        const currentUser = session?.user ?? null
        setUser(currentUser)
        setLoading(false)
        
        // v2.0: 로그인/로그아웃 시 프로필 처리
        if (currentUser) {
          await fetchProfile(currentUser.id)
        } else {
          setProfile(null)
        }
      }
    )

    // 클린업
    return () => {
      subscription.unsubscribe()
    }
  }, [supabase.auth, fetchProfile])

  // =============================================================================
  // 로그아웃 함수
  // =============================================================================
  const signOut = useCallback(async () => {
    setSigningOut(true)
    try {
      await supabase.auth.signOut()
      setUser(null)
      setProfile(null)  // v2.0: 프로필도 초기화
      router.push('/')
      router.refresh()
    } catch (error) {
      console.error('로그아웃 오류:', error)
    } finally {
      setSigningOut(false)
    }
  }, [supabase.auth, router])

  // =============================================================================
  // Google OAuth 로그인 함수
  // =============================================================================
  const signInWithGoogle = useCallback(async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      })
      if (error) {
        console.error('Google 로그인 오류:', error)
      }
    } catch (error) {
      console.error('Google OAuth 오류:', error)
    }
  }, [supabase.auth])

  // =============================================================================
  // v2.0: 파생 상태 계산
  // =============================================================================
  const role = profile?.role ?? null
  const isAdmin = role === 'admin'
  const isPremium = ['premium', 'special', 'admin'].includes(role ?? '')
  const canUseLLM = role !== 'pending' && role !== null && profile?.isApproved === true
  const dailyRequestLimit = profile?.dailyRequestLimit ?? 0
  const monthlyTokenLimit = profile?.monthlyTokenLimit ?? 0

  return {
    user,
    loading,
    signOut,
    signingOut,
    signInWithGoogle,
    // v2.0: 추가 반환값
    profile,
    profileLoading,
    role,
    isAdmin,
    isPremium,
    canUseLLM,
    dailyRequestLimit,
    monthlyTokenLimit,
    refreshProfile,
  }
}

// 기본 내보내기
export default useAuth

