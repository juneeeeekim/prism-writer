// =============================================================================
// PRISM Writer - Auth Header Component (v2.0 회원등급 표시 지원)
// =============================================================================
// 파일: frontend/src/components/auth/AuthHeader.tsx
// 역할: 인증 상태를 표시하는 헤더 컴포넌트
// 기능: 로그인 상태에 따라 사용자 드롭다운 또는 로그인 버튼 표시
// 버전: v2.0 - UserDropdown 컴포넌트 통합
// =============================================================================

'use client'

import Link from 'next/link'
import { useAuth } from '@/hooks/useAuth'
import UserDropdown from '@/components/ui/UserDropdown'

// =============================================================================
// Props Interface
// =============================================================================
interface AuthHeaderProps {
  /** 추가 CSS 클래스 */
  className?: string
  /** 로고 표시 여부 */
  showLogo?: boolean
  /** 저장/내보내기 버튼 표시 여부 */
  showToolbar?: boolean
  /** 저장 버튼 클릭 핸들러 */
  onSave?: () => void
  /** 내보내기 버튼 클릭 핸들러 */
  onExport?: () => void
}

/**
 * 인증 상태 표시 헤더 컴포넌트
 * 
 * @example
 * ```tsx
 * <AuthHeader showLogo showToolbar onSave={handleSave} />
 * ```
 */
export default function AuthHeader({
  className = '',
  showLogo = true,
  showToolbar = false,
  onSave,
  onExport,
}: AuthHeaderProps) {
  // v2.0: 추가 필드 (role, dailyRequestLimit, monthlyTokenLimit)
  const { user, loading, signOut, signingOut, role, dailyRequestLimit, monthlyTokenLimit } = useAuth()

  return (
    <header
      className={`h-14 flex items-center justify-between px-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 ${className}`}
    >
      {/* =================================================================
          Left Section - Logo + Navigation
          ================================================================= */}
      <div className="flex items-center gap-3">
        {showLogo && (
          <>
            <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              <span className="text-2xl">💎</span>
              <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
                PRISM Writer
              </h1>
            </Link>
            {/* RAG 검색 네비게이션 버튼 */}
            <nav className="hidden sm:flex items-center gap-2 ml-4 border-l border-gray-200 dark:border-gray-700 pl-4">
              <Link
                href="/rag"
                className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors flex items-center gap-1"
                aria-label="RAG 검색"
              >
                🔍 RAG 검색
              </Link>
            </nav>
          </>
        )}
      </div>

      {/* =================================================================
          Right Section - Toolbar + Auth
          ================================================================= */}
      <div className="flex items-center gap-3">
        {/* ---------------------------------------------------------------
            Toolbar Buttons (optional)
            --------------------------------------------------------------- */}
        {showToolbar && (
          <div className="flex items-center gap-2 mr-4">
            <button
              onClick={onSave}
              className="px-3 py-1.5 text-sm bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
              aria-label="저장"
            >
              💾 저장
            </button>
            <button
              onClick={onExport}
              className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              aria-label="내보내기"
            >
              📤 내보내기
            </button>
          </div>
        )}

        {/* ---------------------------------------------------------------
            Auth Section
            --------------------------------------------------------------- */}
        {loading ? (
          // 로딩 상태
          <div className="h-8 w-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
        ) : user ? (
          // =================================================================
          // v2.0: UserDropdown 컴포넌트로 등급 및 사용량 표시
          // =================================================================
          <UserDropdown
            user={user}
            role={role}
            dailyRequestLimit={dailyRequestLimit}
            monthlyTokenLimit={monthlyTokenLimit}
            onSignOut={signOut}
            signingOut={signingOut}
          />
        ) : (
          // 비로그인 상태
          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded hover:bg-indigo-700 transition-colors"
              aria-label="로그인"
            >
              로그인
            </Link>
            <Link
              href="/signup"
              className="px-3 py-1.5 text-sm border border-indigo-600 text-indigo-600 dark:text-indigo-400 rounded hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors hidden sm:block"
              aria-label="회원가입"
            >
              회원가입
            </Link>
          </div>
        )}
      </div>
    </header>
  )
}
