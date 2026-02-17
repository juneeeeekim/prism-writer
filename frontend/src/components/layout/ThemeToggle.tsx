// =============================================================================
// [P2-01] ThemeToggle - 테마 토글 버튼 컴포넌트
// =============================================================================
// 파일: frontend/src/components/layout/ThemeToggle.tsx
// 역할: 다크/라이트 모드 전환 버튼 UI
// 생성일: 2026-01-24
// =============================================================================
// 사용법:
// - 헤더, 사이드바 등에 배치하여 테마 전환 기능 제공
// - useTheme 훅을 통해 전역 테마 상태와 연동
// =============================================================================

'use client'

import { SunIcon, MoonIcon } from '@heroicons/react/24/outline'
import { useTheme } from '@/contexts/ThemeContext'

// =============================================================================
// Props 타입 정의
// =============================================================================

interface ThemeToggleProps {
  /** 추가 CSS 클래스 */
  className?: string
  /** 버튼 크기 (아이콘 크기) */
  size?: 'sm' | 'md' | 'lg'
  /** 라벨 표시 여부 */
  showLabel?: boolean
}

// =============================================================================
// 크기별 스타일 매핑
// =============================================================================

const sizeStyles = {
  sm: {
    button: 'p-1.5',
    icon: 'w-4 h-4',
  },
  md: {
    button: 'p-2',
    icon: 'w-5 h-5',
  },
  lg: {
    button: 'p-2.5',
    icon: 'w-6 h-6',
  },
}

// =============================================================================
// ThemeToggle 컴포넌트
// =============================================================================

/**
 * 테마 토글 버튼 컴포넌트
 *
 * @description
 * 클릭 시 다크/라이트 모드를 전환합니다.
 * - 다크 모드: SunIcon 표시 (밝은 모드로 전환하려면 클릭)
 * - 라이트 모드: MoonIcon 표시 (다크 모드로 전환하려면 클릭)
 *
 * @example
 * // 기본 사용
 * <ThemeToggle />
 *
 * // 라벨과 함께
 * <ThemeToggle showLabel />
 *
 * // 커스텀 크기
 * <ThemeToggle size="lg" />
 */
export default function ThemeToggle({
  className = '',
  size = 'md',
  showLabel = false,
}: ThemeToggleProps) {
  const { theme, toggleTheme, isThemeLoaded } = useTheme()

  // =========================================================================
  // Hydration Mismatch 방지
  // - 테마가 로드되기 전에는 렌더링하지 않음
  // - SSR에서는 theme이 null이므로 빈 상태 반환
  // =========================================================================
  if (!isThemeLoaded) {
    // 스켈레톤 플레이스홀더 (레이아웃 시프트 방지)
    return (
      <div
        className={`${sizeStyles[size].button} rounded-lg bg-gray-200 dark:bg-gray-700 animate-pulse ${className}`}
        aria-hidden="true"
      >
        <div className={`${sizeStyles[size].icon} bg-gray-300 dark:bg-gray-600 rounded`} />
      </div>
    )
  }

  // =========================================================================
  // 테마별 아이콘 및 라벨
  // =========================================================================
  const isDark = theme === 'dark'
  const Icon = isDark ? SunIcon : MoonIcon
  const label = isDark ? '라이트 모드로 전환' : '다크 모드로 전환'
  const labelText = isDark ? '라이트 모드' : '다크 모드'

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`
        ${sizeStyles[size].button}
        rounded-lg
        hover:bg-gray-100 dark:hover:bg-gray-800
        focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2
        dark:focus:ring-offset-gray-900
        transition-colors duration-200
        flex items-center gap-2
        ${className}
      `}
      aria-label={label}
      title={label}
    >
      {/* 아이콘 */}
      <Icon
        className={`
          ${sizeStyles[size].icon}
          ${isDark ? 'text-yellow-400' : 'text-gray-500 dark:text-gray-400'}
          transition-colors duration-200
        `}
      />

      {/* 라벨 (선택적) */}
      {showLabel && (
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {labelText}
        </span>
      )}
    </button>
  )
}
