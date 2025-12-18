// =============================================================================
// PRISM Writer - Review Badge Component
// =============================================================================
// 파일: frontend/src/components/rag/ReviewBadge.tsx
// 역할: Reviewer 검토 결과 배지 표시 컴포넌트
// P1 Phase 1.5
// =============================================================================

import type { ReviewResult, ReviewBadge as ReviewBadgeType } from '@/types/rag'

// =============================================================================
// 스타일 정의
// =============================================================================

const BADGE_STYLES: Record<ReviewBadgeType, string> = {
  '✅': 'bg-green-100 text-green-800 border-green-200',
  '⚠️': 'bg-yellow-100 text-yellow-800 border-yellow-200',
  '⛔': 'bg-red-100 text-red-800 border-red-200',
}

const BADGE_LABELS: Record<ReviewBadgeType, string> = {
  '✅': '검증됨',
  '⚠️': '주의 필요',
  '⛔': '거부됨',
}

// =============================================================================
// Props 인터페이스
// =============================================================================

interface ReviewBadgeProps {
  /** 검토 결과 */
  result: ReviewResult
  /** 추가 CSS 클래스 */
  className?: string
  /** 상세 정보 표시 여부 */
  showDetails?: boolean
}

// =============================================================================
// 컴포넌트
// =============================================================================

/**
 * Review 배지 컴포넌트
 * 
 * @description
 * Reviewer 모델의 검토 결과를 시각적으로 표시하는 배지
 * 
 * @example
 * ```tsx
 * <ReviewBadge result={reviewResult} showDetails />
 * ```
 */
export function ReviewBadge({ 
  result, 
  className = '',
  showDetails = false,
}: ReviewBadgeProps) {
  return (
    <div className={`inline-flex flex-col ${className}`}>
      {/* ---------------------------------------------------------------
          배지
          --------------------------------------------------------------- */}
      <span
        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-sm font-medium ${BADGE_STYLES[result.badge]}`}
        aria-label={`검토 결과: ${BADGE_LABELS[result.badge]}`}
        role="status"
      >
        <span className="text-base">{result.badge}</span>
        <span>{BADGE_LABELS[result.badge]}</span>
        <span className="text-xs opacity-70">
          ({Math.round(result.confidence * 100)}%)
        </span>
      </span>

      {/* ---------------------------------------------------------------
          상세 정보 (옵션)
          --------------------------------------------------------------- */}
      {showDetails && (
        <div className="mt-2 text-sm text-gray-600">
          <p className="mb-1">{result.reasoning}</p>
          
          {result.issues && result.issues.length > 0 && (
            <div className="mt-2">
              <span className="font-medium text-gray-700">발견된 이슈:</span>
              <ul className="list-disc list-inside mt-1 space-y-1">
                {result.issues.map((issue, i) => (
                  <li key={i} className="text-amber-700">{issue}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// =============================================================================
// 간단 배지 컴포넌트
// =============================================================================

interface SimpleBadgeProps {
  /** 배지 타입 */
  badge: ReviewBadgeType
  /** 추가 CSS 클래스 */
  className?: string
}

/**
 * 간단한 Review 배지 (아이콘만)
 * 
 * @description
 * 배지 아이콘만 표시하는 미니멀 버전
 */
export function SimpleReviewBadge({ badge, className = '' }: SimpleBadgeProps) {
  return (
    <span
      className={`inline-flex items-center justify-center w-8 h-8 rounded-full ${BADGE_STYLES[badge]} ${className}`}
      aria-label={`검토 결과: ${BADGE_LABELS[badge]}`}
      role="status"
    >
      {badge}
    </span>
  )
}

// =============================================================================
// Export
// =============================================================================

export default ReviewBadge
