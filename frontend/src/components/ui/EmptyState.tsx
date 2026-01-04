// =============================================================================
// PRISM Writer - Empty State Component (P-A02-01)
// =============================================================================
// 파일: frontend/src/components/ui/EmptyState.tsx
// 역할: 데이터가 없을 때 표시되는 공통 빈 상태 컴포넌트
// 작성일: 2026-01-04
// Phase: A - Quick Wins (UX 개선)
// =============================================================================

'use client'

import { clsx } from 'clsx'

// =============================================================================
// 타입 정의
// =============================================================================

export interface EmptyStateAction {
  /** 버튼 레이블 */
  label: string
  /** 클릭 핸들러 */
  onClick: () => void
  /** 버튼 스타일 변형 (기본: primary) */
  variant?: 'primary' | 'secondary'
}

export interface EmptyStateProps {
  /** 아이콘 (이모지 또는 React 노드) */
  icon?: React.ReactNode
  /** 제목 (필수) */
  title: string
  /** 설명 텍스트 */
  description?: string
  /** CTA 버튼 액션 */
  action?: EmptyStateAction
  /** 보조 액션 */
  secondaryAction?: EmptyStateAction
  /** 추가 CSS 클래스 */
  className?: string
  /** 컴팩트 모드 (작은 패딩) */
  compact?: boolean
}

// =============================================================================
// EmptyState 컴포넌트
// =============================================================================

/**
 * 데이터가 없을 때 표시되는 빈 상태 컴포넌트
 *
 * @description
 * 검색 결과 없음, 목록 비어있음 등의 상황에서 사용자에게
 * 친절한 안내 메시지와 다음 행동을 제안합니다.
 *
 * @example
 * ```tsx
 * // 기본 사용
 * <EmptyState
 *   icon="🔍"
 *   title="검색 결과가 없습니다"
 *   description="다른 키워드로 검색해보세요."
 * />
 *
 * // CTA 버튼 포함
 * <EmptyState
 *   icon="📁"
 *   title="문서가 없습니다"
 *   description="새 문서를 업로드하여 시작하세요."
 *   action={{
 *     label: '문서 업로드',
 *     onClick: () => openUploader()
 *   }}
 * />
 * ```
 */
export function EmptyState({
  icon = '📭',
  title,
  description,
  action,
  secondaryAction,
  className,
  compact = false,
}: EmptyStateProps) {
  // ---------------------------------------------------------------------------
  // [P-A02-01] 렌더링
  // ---------------------------------------------------------------------------
  return (
    <div
      className={clsx(
        'flex flex-col items-center justify-center text-center',
        compact ? 'py-6' : 'py-12',
        className
      )}
      role="status"
      aria-label={title}
    >
      {/* =====================================================================
          [P-A02-01] 아이콘 영역
          이모지 또는 커스텀 React 노드 지원
          ===================================================================== */}
      {icon && (
        <span className={clsx('mb-4', compact ? 'text-3xl' : 'text-4xl')}>
          {icon}
        </span>
      )}

      {/* =====================================================================
          [P-A02-01] 제목
          ===================================================================== */}
      <h3
        className={clsx(
          'font-semibold text-gray-900 dark:text-white mb-2',
          compact ? 'text-base' : 'text-lg'
        )}
      >
        {title}
      </h3>

      {/* =====================================================================
          [P-A02-01] 설명 텍스트 (선택적)
          ===================================================================== */}
      {description && (
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 max-w-xs">
          {description}
        </p>
      )}

      {/* =====================================================================
          [P-A02-01] 액션 버튼 영역 (선택적)
          primary와 secondary 버튼 지원
          ===================================================================== */}
      {(action || secondaryAction) && (
        <div className="flex flex-col sm:flex-row gap-2 mt-2">
          {/* Primary Action */}
          {action && (
            <button
              onClick={action.onClick}
              className={clsx(
                'px-4 py-2 rounded-lg font-medium transition-colors',
                action.variant === 'secondary'
                  ? 'bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300'
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
              )}
            >
              {action.label}
            </button>
          )}

          {/* Secondary Action */}
          {secondaryAction && (
            <button
              onClick={secondaryAction.onClick}
              className="px-4 py-2 rounded-lg font-medium transition-colors bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300"
            >
              {secondaryAction.label}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// =============================================================================
// 프리셋 Empty State 컴포넌트들
// =============================================================================

/**
 * 검색 결과 없음 Empty State
 */
export function NoSearchResults({
  onRetry,
  onUpload,
}: {
  onRetry?: () => void
  onUpload?: () => void
}) {
  return (
    <EmptyState
      icon="🔍"
      title="검색 결과가 없습니다"
      description="다른 키워드로 검색하거나, 참고자료 탭에서 문서를 먼저 업로드해주세요."
      action={
        onUpload
          ? {
              label: '참고자료 업로드하기',
              onClick: onUpload,
            }
          : undefined
      }
      secondaryAction={
        onRetry
          ? {
              label: '다시 검색',
              onClick: onRetry,
              variant: 'secondary',
            }
          : undefined
      }
    />
  )
}

/**
 * 평가 기록 없음 Empty State
 */
export function NoEvaluationHistory() {
  return (
    <EmptyState
      icon="📝"
      title="평가 기록이 없습니다"
      description="에디터에 글을 작성한 후 평가 버튼을 눌러주세요."
      compact
    />
  )
}

/**
 * 초기 검색 상태 Empty State
 */
export function InitialSearchState() {
  return (
    <EmptyState
      icon="💡"
      title="검색을 시작해보세요"
      description="검색어를 입력하고 검색 버튼을 클릭하면 관련 문서를 찾아드립니다."
      compact
    />
  )
}

// Default export
export default EmptyState
