// =============================================================================
// PRISM Writer - Role Badge Component
// =============================================================================
// 파일: frontend/src/components/ui/RoleBadge.tsx
// 역할: 사용자 등급을 배지 형태로 표시하는 컴포넌트
// 담당: UX/UI 디자인 전문가
// =============================================================================

'use client'

import { UserRole } from '@/types/auth'

// =============================================================================
// 등급별 스타일 정의
// =============================================================================

interface RoleBadgeStyle {
  bg: string
  text: string
  darkBg: string
  darkText: string
  label: string
}

const ROLE_BADGE_STYLES: Record<UserRole, RoleBadgeStyle> = {
  pending: {
    bg: 'bg-gray-200',
    text: 'text-gray-600',
    darkBg: 'dark:bg-gray-700',
    darkText: 'dark:text-gray-300',
    label: '대기',
  },
  free: {
    bg: 'bg-green-100',
    text: 'text-green-700',
    darkBg: 'dark:bg-green-900/30',
    darkText: 'dark:text-green-400',
    label: 'FREE',
  },
  premium: {
    bg: 'bg-blue-100',
    text: 'text-blue-700',
    darkBg: 'dark:bg-blue-900/30',
    darkText: 'dark:text-blue-400',
    label: 'PREMIUM',
  },
  special: {
    bg: 'bg-purple-100',
    text: 'text-purple-700',
    darkBg: 'dark:bg-purple-900/30',
    darkText: 'dark:text-purple-400',
    label: 'SPECIAL',
  },
  admin: {
    bg: 'bg-red-100',
    text: 'text-red-700',
    darkBg: 'dark:bg-red-900/30',
    darkText: 'dark:text-red-400',
    label: 'ADMIN',
  },
}

// =============================================================================
// Props Interface
// =============================================================================

interface RoleBadgeProps {
  /** 사용자 역할 */
  role: UserRole | null
  /** 배지 크기 */
  size?: 'sm' | 'md'
  /** 추가 CSS 클래스 */
  className?: string
}

// =============================================================================
// Component
// =============================================================================

/**
 * 사용자 등급 배지 컴포넌트
 * 
 * @example
 * ```tsx
 * <RoleBadge role="free" size="sm" />
 * <RoleBadge role="premium" size="md" />
 * ```
 */
export default function RoleBadge({
  role,
  size = 'sm',
  className = '',
}: RoleBadgeProps) {
  // role이 없으면 렌더링하지 않음
  if (!role) return null

  const style = ROLE_BADGE_STYLES[role]
  
  // 크기별 스타일
  const sizeStyles = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-3 py-1 text-sm',
  }

  return (
    <span
      className={`
        inline-flex items-center font-semibold rounded-full
        ${style.bg} ${style.text}
        ${style.darkBg} ${style.darkText}
        ${sizeStyles[size]}
        ${className}
      `}
      role="status"
      aria-label={`현재 등급: ${style.label}`}
    >
      {style.label}
    </span>
  )
}

// Named export for convenience
export { RoleBadge, ROLE_BADGE_STYLES }
