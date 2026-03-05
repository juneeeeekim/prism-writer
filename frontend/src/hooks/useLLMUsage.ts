// =============================================================================
// PRISM Writer - LLM 사용량 조회 훅 (v3.0 월간 질문 횟수)
// =============================================================================
// 파일: frontend/src/hooks/useLLMUsage.ts
// 역할: 월간 LLM 질문 사용량 조회 및 상태 관리
// 버전: v3.0 (월간 질문 횟수 단일 지표)
// =============================================================================

'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from './useAuth'
import { UsageSummary, MonthlyQuestionUsage } from '@/types/auth'

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
 * LLM 사용량 조회 훅 (v3.0 월간 질문 횟수)
 *
 * @returns {UseLLMUsageReturn} 사용량 정보, 로딩 상태, 에러, 새로고침 함수
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
      const monthStart = getCurrentMonthStart()

      // 월간 사용량 조회 (total_requests = 월간 질문 횟수)
      const { data: monthlyData, error: monthlyError } = await supabase
        .from('llm_usage_summary')
        .select('total_requests')
        .eq('user_id', user.id)
        .eq('period_type', 'monthly')
        .eq('period_start', monthStart)
        .single()

      if (monthlyError && monthlyError.code !== 'PGRST116') {
        console.warn('월간 사용량 조회 실패:', monthlyError.message)
      }

      const questionCount = monthlyData?.total_requests ?? 0
      const questionLimit = profile.monthlyQuestionLimit

      const monthlyQuestions: MonthlyQuestionUsage = {
        questionCount,
        questionsRemaining: Math.max(0, questionLimit - questionCount),
        resetAt: getMonthlyResetTime(),
      }

      const percentUsed = questionLimit > 0 ? (questionCount / questionLimit) * 100 : 0

      const summary: UsageSummary = {
        monthlyQuestions,
        percentUsed,
        isNearLimit: percentUsed >= 80,
        isAtLimit: percentUsed >= 100,
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
  // 자동 폴링 - 사용량 정보 주기적 갱신
  // =============================================================================
  useEffect(() => {
    if (typeof document === 'undefined') return
    if (!user || !profile) return

    const USAGE_POLL_INTERVAL_MS = 60000 // 1분

    console.debug('[useLLMUsage] 자동 폴링 시작')
    const intervalId = setInterval(() => {
      console.debug('[useLLMUsage] 자동 폴링: 사용량 갱신')
      fetchUsage()
    }, USAGE_POLL_INTERVAL_MS)

    return () => {
      console.debug('[useLLMUsage] 자동 폴링 중지')
      clearInterval(intervalId)
    }
  }, [user, profile, fetchUsage])

  // =============================================================================
  // 탭 활성화 시 즉시 갱신
  // =============================================================================
  useEffect(() => {
    if (typeof document === 'undefined') return
    if (!user || !profile) return

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        console.debug('[useLLMUsage] 탭 활성화: 즉시 사용량 갱신')
        fetchUsage()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

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
