// =============================================================================
// PRISM Writer - useAuth Hook (v2.0 회원등급관리시스템 지원)
// =============================================================================
// 파일: frontend/src/hooks/useAuth.ts
// 역할: 인증 상태 관리 커스텀 훅 + 사용자 프로필/등급 정보
// 기능: 사용자 정보 조회, 프로필 조회, 로그아웃, 등급 확인
// =============================================================================

'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
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
  // ==========================================================================
  // v2.3: UI 피드백 (P4-01)
  // ==========================================================================
  /** 마지막 동기화 시간 */
  lastSyncedAt: Date | null
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
  
  // v2.3: 마지막 동기화 시간 (P4-01)
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null)
  
  const router = useRouter()
  const supabase = createClient()

  // v2.2: 폴링 인터벌 (P3-02: Realtime 연결 상태에 따라 동적 변경)
  // 기본값: 1분(60초), Realtime 연결 성공 시: 5분(300초)으로 변경
  const pollIntervalRef = useRef(60000)

  // =============================================================================
  // v2.0: 프로필 조회 함수 (v2.1: isPolling 파라미터 추가 - P1-02)
  // =============================================================================
  // isPolling이 true면 에러 발생 시 기존 profile 유지 (덮어쓰기 금지)
  // =============================================================================
  const fetchProfile = useCallback(async (userId: string, isPolling: boolean = false) => {
    setProfileLoading(true)
    console.debug('[useAuth] fetchProfile 시작, userId:', userId, 'isPolling:', isPolling)
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()
      
      // 디버깅: 조회 결과 출력
      console.debug('[useAuth] 프로필 조회 결과:', { data, error })
      
      if (error) {
        // 프로필이 없는 경우 (트리거 실패 등)
        console.warn('프로필 조회 실패:', error.message, error.code, error.details)
        // P1-02: 폴링 중 에러 시 기존 profile 유지
        if (!isPolling) {
          setProfile(null)
        }
      } else if (data) {
        console.debug('[useAuth] 프로필 데이터 매핑:', data)
        setProfile(mapProfileRowToUserProfile(data as ProfileRow))
        // P4-01: 프로필 조회 성공 시 마지막 동기화 시간 기록
        setLastSyncedAt(new Date())
      }
    } catch (error) {
      console.error('프로필 조회 오류:', error)
      // P1-02: 폴링 중 에러 시 기존 profile 유지
      if (!isPolling) {
        setProfile(null)
      }
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
  // 로그아웃 함수 (v2.2: 쿠키 강제 삭제 추가)
  // =============================================================================
  const signOut = useCallback(async () => {
    setSigningOut(true)
    try {
      // 타임아웃 설정 (5초 후 강제 종료)
      const signOutPromise = supabase.auth.signOut()
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('로그아웃 타임아웃')), 5000)
      )
      
      await Promise.race([signOutPromise, timeoutPromise])
    } catch (error) {
      console.error('로그아웃 오류:', error)
    }
    
    // v2.2: 강제 쿠키 삭제 (signOut 성공/실패 무관)
    // Supabase 쿠키 삭제
    document.cookie.split(';').forEach(cookie => {
      const cookieName = cookie.split('=')[0].trim()
      if (cookieName.startsWith('sb-')) {
        document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`
        document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; domain=${window.location.hostname}`
      }
    })
    
    // localStorage 정리
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('sb-') || key.includes('supabase')) {
        localStorage.removeItem(key)
      }
    })
    
    // sessionStorage 정리
    Object.keys(sessionStorage).forEach(key => {
      if (key.startsWith('sb-') || key.includes('supabase')) {
        sessionStorage.removeItem(key)
      }
    })
    
    // 상태 초기화
    setUser(null)
    setProfile(null)
    setSigningOut(false)
    
    // 페이지 이동 (강제 새로고침으로 완전 초기화)
    window.location.href = '/'
  }, [supabase.auth])

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
  // v2.1: 자동 폴링 - 프로필 정보 주기적 갱신 (P1-01)
  // =============================================================================
  // 목적: 관리자가 DB에서 역할/할당량 변경 시 1분 내 UI에 반영
  // 참조: plan_report/2601070733_Auth_Data_Sync_체크리스트.md
  // =============================================================================
  useEffect(() => {
    // SSR 환경 체크
    if (typeof document === 'undefined') return
    // 로그인 상태가 아니면 폴링 불필요
    if (!user?.id) return

    // ---------------------------------------------------------------------
    // 상수 정의 (P3-02: pollIntervalRef 사용으로 동적 변경 지원)
    // ---------------------------------------------------------------------
    let intervalId: ReturnType<typeof setInterval> | null = null

    // ---------------------------------------------------------------------
    // 폴링 시작 함수
    // ---------------------------------------------------------------------
    const startPolling = () => {
      if (intervalId) return // 이미 실행 중이면 중복 방지
      intervalId = setInterval(() => {
        console.debug('[useAuth] 자동 폴링: 프로필 갱신 시작, 인터벌:', pollIntervalRef.current, 'ms')
        // P1-02: isPolling=true로 호출하여 에러 시 기존 profile 유지
        fetchProfile(user.id, true)
      }, pollIntervalRef.current)
    }

    // ---------------------------------------------------------------------
    // 폴링 중지 함수
    // ---------------------------------------------------------------------
    const stopPolling = () => {
      if (intervalId) {
        clearInterval(intervalId)
        intervalId = null
      }
    }

    // ---------------------------------------------------------------------
    // 탭 활성화/비활성화 감지
    // ---------------------------------------------------------------------
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // 탭 비활성화 → 폴링 중지 (불필요한 API 호출 방지)
        console.debug('[useAuth] 탭 비활성화: 폴링 중지')
        stopPolling()
      } else {
        // 탭 활성화 → 즉시 1회 조회 + 폴링 재개
        console.debug('[useAuth] 탭 활성화: 즉시 조회 + 폴링 재개')
        // P1-02: isPolling=true로 호출하여 에러 시 기존 profile 유지
        fetchProfile(user.id, true)
        startPolling()
      }
    }

    // ---------------------------------------------------------------------
    // 초기화: 폴링 시작 + 이벤트 리스너 등록
    // ---------------------------------------------------------------------
    startPolling()
    document.addEventListener('visibilitychange', handleVisibilityChange)

    // ---------------------------------------------------------------------
    // Cleanup: 폴링 중지 + 이벤트 리스너 해제
    // ---------------------------------------------------------------------
    return () => {
      stopPolling()
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [user?.id, fetchProfile])

  // =============================================================================
  // v2.2: Supabase Realtime 구독 - 프로필 변경 즉시 반영 (P3-01)
  // =============================================================================
  // 목적: 관리자가 DB에서 역할/할당량 변경 시 10초 내 UI에 즉시 반영
  // 참조: plan_report/2601070733_Auth_Data_Sync_체크리스트.md
  // 주의: 구독 실패 시 폴링(P1-01)이 Fallback으로 동작
  // =============================================================================
  useEffect(() => {
    // 로그인 상태가 아니면 구독 불필요
    if (!user?.id) return

    // -------------------------------------------------------------------------
    // Realtime 채널 생성 및 구독
    // -------------------------------------------------------------------------
    console.debug('[useAuth] Realtime 구독 시작, userId:', user.id)
    
    const channel = supabase
      .channel(`profile-sync-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${user.id}`
        },
        (payload) => {
          // -----------------------------------------------------------------------
          // 프로필 변경 감지 시 즉시 상태 업데이트
          // -----------------------------------------------------------------------
          console.debug('[useAuth] Realtime 프로필 변경 감지:', payload)
          if (payload.new) {
            setProfile(mapProfileRowToUserProfile(payload.new as ProfileRow))
          }
        }
      )
      .subscribe((status) => {
        // -----------------------------------------------------------------------
        // 구독 상태에 따른 폴링 인터벌 조정 (P3-02)
        // -----------------------------------------------------------------------
        console.debug('[useAuth] Realtime 구독 상태:', status)
        if (status === 'SUBSCRIBED') {
          // 성공: Realtime이 실시간 처리하므로 폴링 주기 5분으로 연장 (백업용)
          console.debug('[useAuth] Realtime 연결 성공, 폴링 인터벌 5분으로 연장')
          pollIntervalRef.current = 300000 // 5분
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          // 실패: 폴링이 메인이므로 1분 유지
          console.warn('[useAuth] Realtime 연결 실패, 폴링 모드 유지 (1분 인터벌)')
          pollIntervalRef.current = 60000 // 1분
        }
      })

    // -------------------------------------------------------------------------
    // Cleanup: 채널 구독 해제 (메모리 누수 방지)
    // -------------------------------------------------------------------------
    return () => {
      console.debug('[useAuth] Realtime 구독 해제')
      supabase.removeChannel(channel)
    }
  }, [user?.id, supabase])

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
    // v2.3: UI 피드백 (P4-01)
    lastSyncedAt,
  }
}

// 기본 내보내기
export default useAuth

