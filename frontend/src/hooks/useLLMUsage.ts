// =============================================================================
// PRISM Writer - LLM 사용량 조회 훅 (v2.0 하이브리드)
// =============================================================================
// 파일: frontend/src/hooks/useLLMUsage.ts
// 역할: 일일 + 월간 LLM 사용량 조회 및 상태 관리
// 버전: v2.0 (하이브리드 모델 - 일일 요청 + 월간 토큰)
// =============================================================================

'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from './useAuth'
import { UsageSummary, DailyUsage, MonthlyUsage } from '@/types/auth'

// =============================================================================
// Types
// =============================================================================

interface UseLLMUsageReturn {
  /** 사용량 요약 정보 */
  usage: UsageSummary | null
  /** 로딩 중 여부 */
  loading: boolean
  /** 에러 메시지 */
  error: string | null
  /** 사용량 새로고침 */
  refetch: () => Promise<void>
}

// =============================================================================
// 유틸리티 함수
// =============================================================================

/**
 * 현재 월의 시작일 반환 (YYYY-MM-DD)
 */
function getCurrentMonthStart(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
}

/**
 * 오늘 날짜 반환 (YYYY-MM-DD)
 */
function getTodayDate(): string {
  return new Date().toISOString().split('T')[0]
}

/**
 * 다음 리셋 시간 계산 (일일)
 */
function getDailyResetTime(): string {
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  tomorrow.setHours(0, 0, 0, 0)
  
  const now = new Date()
  const diff = tomorrow.getTime() - now.getTime()
  const hours = Math.floor(diff / (1000 * 60 * 60))
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
  
  if (hours > 0) {
    return `${hours}시간 ${minutes}분 후`
  }
  return `${minutes}분 후`
}

/**
 * 다음 리셋 시간 계산 (월간)
 */
function getMonthlyResetTime(): string {
  const now = new Date()
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  const diff = nextMonth.getTime() - now.getTime()
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  
  if (days > 1) {
    return `${days}일 후`
  } else if (days === 1) {
    return '내일'
  }
  return '오늘 자정'
}

// =============================================================================
// Hook
// =============================================================================

/**
 * LLM 사용량 조회 훅 (v2.0 하이브리드)
 * 
 * @returns {UseLLMUsageReturn} 사용량 정보, 로딩 상태, 에러, 새로고침 함수
 * 
 * @example
 * ```tsx
 * 'use client'
 * import { useLLMUsage } from '@/hooks/useLLMUsage'
 * 
 * export default function UsageDisplay() {
 *   const { usage, loading, refetch } = useLLMUsage()
 *   
 *   if (loading) return <div>로딩 중...</div>
 *   if (!usage) return null
 *   
 *   return (
 *     <div>
 *       <span>오늘 {usage.daily.requestCount}회 사용</span>
 *       <span>이번 달 {usage.monthly.totalTokensUsed.toLocaleString()} 토큰</span>
 *       {usage.isNearDailyLimit && <span>⚠️ 일일 한도 임박</span>}
 *     </div>
 *   )
 * }
 * ```
 */
export function useLLMUsage(): UseLLMUsageReturn {
  const [usage, setUsage] = useState<UsageSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  const { user, profile } = useAuth()
  const supabase = createClient()

  // =============================================================================
  // 사용량 조회 함수
  // =============================================================================
  const fetchUsage = useCallback(async () => {
    if (!user || !profile) {
      setUsage(null)
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const today = getTodayDate()
      const monthStart = getCurrentMonthStart()

      // =======================================================================
      // 1. 일일 사용량 조회
      // =======================================================================
      const { data: dailyData, error: dailyError } = await supabase
        .from('llm_daily_usage')
        .select('request_count')
        .eq('user_id', user.id)
        .eq('usage_date', today)
        .single()

      if (dailyError && dailyError.code !== 'PGRST116') {
        // PGRST116 = 레코드 없음 (정상 - 오늘 사용 안 함)
        console.warn('일일 사용량 조회 실패:', dailyError.message)
      }

      const dailyCount = dailyData?.request_count ?? 0
      const dailyLimit = profile.dailyRequestLimit

      // =======================================================================
      // 2. 월간 사용량 조회
      // =======================================================================
      const { data: monthlyData, error: monthlyError } = await supabase
        .from('llm_usage_summary')
        .select('total_tokens, total_requests')
        .eq('user_id', user.id)
        .eq('period_type', 'monthly')
        .eq('period_start', monthStart)
        .single()

      if (monthlyError && monthlyError.code !== 'PGRST116') {
        console.warn('월간 사용량 조회 실패:', monthlyError.message)
      }

      const monthlyTokens = monthlyData?.total_tokens ?? 0
      const monthlyLimit = profile.monthlyTokenLimit

      // =======================================================================
      // 3. 사용량 요약 생성
      // =======================================================================
      const daily: DailyUsage = {
        requestCount: dailyCount,
        requestsRemaining: Math.max(0, dailyLimit - dailyCount),
        resetAt: getDailyResetTime(),
      }

      const monthly: MonthlyUsage = {
        totalTokensUsed: monthlyTokens,
        tokensRemaining: Math.max(0, monthlyLimit - monthlyTokens),
        resetAt: getMonthlyResetTime(),
      }

      const dailyPercent = dailyLimit > 0 ? (dailyCount / dailyLimit) * 100 : 0
      const monthlyPercent = monthlyLimit > 0 ? (monthlyTokens / monthlyLimit) * 100 : 0

      const summary: UsageSummary = {
        daily,
        monthly,
        percentUsed: Math.max(dailyPercent, monthlyPercent),
        isNearDailyLimit: dailyPercent >= 80,
        isAtDailyLimit: dailyPercent >= 100,
        isNearMonthlyLimit: monthlyPercent >= 80,
        isAtMonthlyLimit: monthlyPercent >= 100,
      }

      setUsage(summary)
    } catch (err) {
      console.error('사용량 조회 오류:', err)
      setError('사용량 정보를 불러오는데 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }, [user, profile, supabase])

  // =============================================================================
  // 초기 로드 및 프로필 변경 시 재조회
  // =============================================================================
  useEffect(() => {
    fetchUsage()
  }, [fetchUsage])

  // =============================================================================
  // v2.1: 자동 폴링 - 사용량 정보 주기적 갱신 (P2-01)
  // =============================================================================
  // 목적: LLM 사용 후 1분 내 UI에 사용량 반영
  // 참조: plan_report/2601070733_Auth_Data_Sync_체크리스트.md
  // =============================================================================
  useEffect(() => {
    // SSR 환경 체크
    if (typeof document === 'undefined') return
    // user, profile 모두 존재해야 폴링 시작
    if (!user || !profile) return

    // -------------------------------------------------------------------------
    // 상수 정의
    // -------------------------------------------------------------------------
    const USAGE_POLL_INTERVAL_MS = 60000 // 1분 (60초)

    // -------------------------------------------------------------------------
    // 폴링 인터벌 시작
    // -------------------------------------------------------------------------
    console.debug('[useLLMUsage] 자동 폴링 시작')
    const intervalId = setInterval(() => {
      console.debug('[useLLMUsage] 자동 폴링: 사용량 갱신')
      fetchUsage()
    }, USAGE_POLL_INTERVAL_MS)

    // -------------------------------------------------------------------------
    // Cleanup: 폴링 중지
    // -------------------------------------------------------------------------
    return () => {
      console.debug('[useLLMUsage] 자동 폴링 중지')
      clearInterval(intervalId)
    }
  }, [user, profile, fetchUsage])

  // =============================================================================
  // v2.1: 탭 활성화 시 즉시 갱신 (P2-02)
  // =============================================================================
  // 목적: 다른 탭에서 돌아왔을 때 최신 사용량 즉시 표시
  // =============================================================================
  useEffect(() => {
    // SSR 환경 체크
    if (typeof document === 'undefined') return
    // user, profile 모두 존재해야 동작
    if (!user || !profile) return

    // -------------------------------------------------------------------------
    // 탭 활성화 감지
    // -------------------------------------------------------------------------
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        // 탭이 활성화되면 즉시 사용량 갱신
        console.debug('[useLLMUsage] 탭 활성화: 즉시 사용량 갱신')
        fetchUsage()
      }
    }

    // -------------------------------------------------------------------------
    // 이벤트 리스너 등록
    // -------------------------------------------------------------------------
    document.addEventListener('visibilitychange', handleVisibilityChange)

    // -------------------------------------------------------------------------
    // Cleanup: 이벤트 리스너 해제
    // -------------------------------------------------------------------------
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [user, profile, fetchUsage])

  // =============================================================================
  // 외부에서 호출 가능한 새로고침 함수
  // =============================================================================
  const refetch = useCallback(async () => {
    await fetchUsage()
  }, [fetchUsage])

  return {
    usage,
    loading,
    error,
    refetch,
  }
}

export default useLLMUsage
