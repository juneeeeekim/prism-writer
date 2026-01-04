// =============================================================================
// PRISM Writer - Skeleton Component (P-A01-01)
// =============================================================================
// 파일: frontend/src/components/ui/Skeleton.tsx
// 역할: 로딩 상태 표시를 위한 공통 스켈레톤 컴포넌트
// 작성일: 2026-01-04
// Phase: A - Quick Wins (UX 개선)
// =============================================================================

'use client'

import { clsx } from 'clsx'

// =============================================================================
// 타입 정의
// =============================================================================

export interface SkeletonProps {
  /** 추가 CSS 클래스 */
  className?: string
  /** 스켈레톤 형태 */
  variant?: 'text' | 'rect' | 'circle'
  /** 너비 (px 또는 CSS 값) */
  width?: string | number
  /** 높이 (px 또는 CSS 값) */
  height?: string | number
  /** 애니메이션 비활성화 */
  disableAnimation?: boolean
}

// =============================================================================
// Skeleton 컴포넌트
// =============================================================================

/**
 * 로딩 상태를 시각적으로 표시하는 스켈레톤 컴포넌트
 *
 * @example
 * ```tsx
 * // 기본 사각형
 * <Skeleton width={200} height={20} />
 *
 * // 원형 (아바타용)
 * <Skeleton variant="circle" width={40} height={40} />
 *
 * // 텍스트 라인
 * <Skeleton variant="text" width="80%" />
 * ```
 */
export function Skeleton({
  className,
  variant = 'rect',
  width,
  height,
  disableAnimation = false,
}: SkeletonProps) {
  // ---------------------------------------------------------------------------
  // [P-A01-01] 스타일 클래스 구성
  // ---------------------------------------------------------------------------
  const baseClass = clsx(
    // 기본 배경색 (라이트/다크 모드 대응)
    'bg-gray-200 dark:bg-gray-700',
    // 애니메이션 (비활성화 옵션 지원)
    !disableAnimation && 'animate-pulse'
  )

  // variant별 모양 클래스
  const variantClass = {
    text: 'rounded h-4',      // 텍스트 라인 (기본 높이 16px)
    rect: 'rounded',          // 사각형
    circle: 'rounded-full',   // 원형
  }[variant]

  // ---------------------------------------------------------------------------
  // [P-A01-01] 인라인 스타일 (width/height 처리)
  // ---------------------------------------------------------------------------
  const style: React.CSSProperties = {}

  if (width !== undefined) {
    style.width = typeof width === 'number' ? `${width}px` : width
  }

  if (height !== undefined) {
    style.height = typeof height === 'number' ? `${height}px` : height
  }

  // ---------------------------------------------------------------------------
  // [P-A01-01] 렌더링
  // ---------------------------------------------------------------------------
  return (
    <div
      className={clsx(baseClass, variantClass, className)}
      style={style}
      role="status"
      aria-label="로딩 중"
    />
  )
}

// =============================================================================
// 편의 컴포넌트들
// =============================================================================

/**
 * 텍스트 라인 스켈레톤
 */
export function SkeletonText({
  lines = 1,
  className
}: {
  lines?: number
  className?: string
}) {
  return (
    <div className={clsx('space-y-2', className)}>
      {Array.from({ length: Math.max(0, lines) }).map((_, i) => (
        <Skeleton
          key={i}
          variant="text"
          width={i === lines - 1 ? '60%' : '100%'}
        />
      ))}
    </div>
  )
}

/**
 * 아바타 스켈레톤
 */
export function SkeletonAvatar({
  size = 40,
  className
}: {
  size?: number
  className?: string
}) {
  return (
    <Skeleton
      variant="circle"
      width={size}
      height={size}
      className={className}
    />
  )
}

// Default export
export default Skeleton
