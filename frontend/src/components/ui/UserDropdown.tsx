// =============================================================================
// PRISM Writer - User Dropdown Component
// =============================================================================
// 파일: frontend/src/components/ui/UserDropdown.tsx
// 역할: 사용자 정보 및 등급/사용량을 드롭다운으로 표시
// 담당: 시니어 개발자
// =============================================================================

'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { User } from '@supabase/supabase-js'
import { UserRole } from '@/types/auth'
import { useLLMUsage } from '@/hooks/useLLMUsage'
import RoleBadge from './RoleBadge'

// =============================================================================
// v2.3: 동기화 시간 포매터 (P4-02)
// =============================================================================
/**
 * 주어진 날짜로부터 현재까지의 시간 차이를 한국어로 포맷
 * @param date 기준 날짜
 * @returns "1분 전", "5분 전", "1시간 전" 등의 문자열
 */
function formatTimeAgo(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHour = Math.floor(diffMin / 60)
  
  if (diffSec < 60) {
    return '방금'
  } else if (diffMin < 60) {
    return `${diffMin}분 전`
  } else if (diffHour < 24) {
    return `${diffHour}시간 전`
  } else {
    const diffDay = Math.floor(diffHour / 24)
    return `${diffDay}일 전`
  }
}

// =============================================================================
// Props Interface
// =============================================================================

interface UserDropdownProps {
  /** 현재 로그인된 사용자 */
  user: User
  /** 사용자 역할 */
  role: UserRole | null
  /** 일일 요청 한도 */
  dailyRequestLimit: number
  /** 월간 토큰 한도 */
  monthlyTokenLimit: number
  /** 로그아웃 함수 */
  onSignOut: () => Promise<void>
  /** 로그아웃 진행 중 여부 */
  signingOut?: boolean
  // ==========================================================================
  // v2.3: UI 피드백 (P4-02, P4-03)
  // ==========================================================================
  /** 마지막 동기화 시간 */
  lastSyncedAt?: Date | null
  /** 프로필 새로고침 함수 (P4-03) */
  onRefreshProfile?: () => Promise<void>
}

// =============================================================================
// Component
// =============================================================================

/**
 * 사용자 드롭다운 컴포넌트
 * 
 * 헤더에서 사용자 이메일 클릭 시 표시되는 드롭다운 메뉴
 * - 등급 배지
 * - 일일/월간 사용량
 * - 프로필 페이지 링크
 * - 로그아웃 버튼
 * 
 * @example
 * ```tsx
 * <UserDropdown
 *   user={user}
 *   role="free"
 *   dailyRequestLimit={5}
 *   monthlyTokenLimit={10000}
 *   onSignOut={signOut}
 * />
 * ```
 */
export default function UserDropdown({
  user,
  role,
  dailyRequestLimit,
  monthlyTokenLimit,
  onSignOut,
  signingOut = false,
  lastSyncedAt,
  onRefreshProfile,
}: UserDropdownProps) {
  // =============================================================================
  // State & Refs
  // =============================================================================
  const [isOpen, setIsOpen] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false) // P4-03: 새로고침 상태
  const dropdownRef = useRef<HTMLDivElement>(null)

  // 사용량 조회 (P4-03: refetch 추가)
  const { usage, loading: usageLoading, refetch: refetchUsage } = useLLMUsage()

  // =============================================================================
  // 외부 클릭 감지 (드롭다운 닫기)
  // =============================================================================
  const handleClickOutside = useCallback((event: MouseEvent) => {
    if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
      setIsOpen(false)
    }
  }, [])

  // =============================================================================
  // ESC 키 감지 (드롭다운 닫기)
  // =============================================================================
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      setIsOpen(false)
    }
  }, [])

  // =============================================================================
  // 이벤트 리스너 등록/해제
  // =============================================================================
  useEffect(() => {
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('keydown', handleKeyDown)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, handleClickOutside, handleKeyDown])

  // =============================================================================
  // 사용량 표시 텍스트 생성
  // =============================================================================
  const dailyUsageText = usageLoading
    ? '로딩 중...'
    : usage
      ? `오늘 ${usage.daily.requestCount}/${dailyRequestLimit}회`
      : (dailyRequestLimit === 0 && role !== 'pending') 
        ? '정보 없음' 
        : `오늘 0/${dailyRequestLimit}회`

  const monthlyUsageText = usageLoading
    ? '로딩 중...'
    : usage
      ? `이번 달 ${usage.monthly.totalTokensUsed.toLocaleString()}/${monthlyTokenLimit.toLocaleString()}`
      : (monthlyTokenLimit === 0 && role !== 'pending')
        ? '정보 없음'
        : `이번 달 0/${monthlyTokenLimit.toLocaleString()}`

  // =============================================================================
  // Render
  // =============================================================================
  return (
    <div ref={dropdownRef} className="relative">
      {/* ===================================================================
          Trigger Button
          =================================================================== */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 text-sm bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-label="사용자 메뉴 열기"
      >
        <span className="hidden sm:block max-w-[150px] truncate">
          {user.email}
        </span>
        <RoleBadge role={role} size="sm" />
        <svg
          className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* ===================================================================
          Dropdown Menu
          =================================================================== */}
      {isOpen && (
        <div
          className="absolute right-0 mt-2 w-64 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-2 z-50"
          role="menu"
          aria-orientation="vertical"
        >
          {/* ---------------------------------------------------------------
              등급 섹션
              --------------------------------------------------------------- */}
          <div className="px-4 py-2 border-b border-gray-100 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500 dark:text-gray-400">현재 등급</span>
              <RoleBadge role={role} size="md" />
            </div>
            {/* P4-02: 마지막 동기화 시간 표시 */}
            {lastSyncedAt && (
              <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                {formatTimeAgo(lastSyncedAt)} 동기화
              </div>
            )}
          </div>

          {/* ---------------------------------------------------------------
              사용량 섹션
              --------------------------------------------------------------- */}
          <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
            <div className="space-y-2">
              {/* 일일 사용량 */}
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-500 dark:text-gray-400">일일 요청</span>
                <span className={`text-sm font-medium ${
                  usage?.isAtDailyLimit 
                    ? 'text-red-600 dark:text-red-400' 
                    : usage?.isNearDailyLimit 
                      ? 'text-yellow-600 dark:text-yellow-400'
                      : 'text-gray-900 dark:text-white'
                }`}>
                  {dailyUsageText}
                </span>
              </div>
              {/* 월간 토큰 */}
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-500 dark:text-gray-400">월간 토큰</span>
                <span className={`text-sm font-medium ${
                  usage?.isAtMonthlyLimit 
                    ? 'text-red-600 dark:text-red-400' 
                    : usage?.isNearMonthlyLimit 
                      ? 'text-yellow-600 dark:text-yellow-400'
                      : 'text-gray-900 dark:text-white'
                }`}>
                  {monthlyUsageText}
                </span>
              </div>
            </div>
            {/* ---------------------------------------------------------------
                P4-03: 수동 새로고침 버튼
                --------------------------------------------------------------- */}
            {onRefreshProfile && (
              <button
                onClick={async () => {
                  setIsRefreshing(true)
                  try {
                    await Promise.all([
                      onRefreshProfile(),
                      refetchUsage()
                    ])
                  } finally {
                    setIsRefreshing(false)
                  }
                }}
                disabled={isRefreshing}
                className="mt-2 w-full flex items-center justify-center gap-1 px-2 py-1 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className={isRefreshing ? 'animate-spin' : ''}>🔄</span>
                {isRefreshing ? '새로고침 중...' : '새로고침'}
              </button>
            )}
          </div>

          {/* ---------------------------------------------------------------
              메뉴 항목
              --------------------------------------------------------------- */}
          <div className="py-1">
            {/* 프로필 보기 */}
            <Link
              href="/profile"
              className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              role="menuitem"
              onClick={() => setIsOpen(false)}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              내 프로필 보기
            </Link>

            {/* 구분선 */}
            <div className="border-t border-gray-100 dark:border-gray-700 my-1" />

            {/* 로그아웃 */}
            <button
              onClick={async () => {
                setIsOpen(false)
                await onSignOut()
              }}
              disabled={signingOut}
              className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
              role="menuitem"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              {signingOut ? '로그아웃 중...' : '로그아웃'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// Named export
export { UserDropdown }
