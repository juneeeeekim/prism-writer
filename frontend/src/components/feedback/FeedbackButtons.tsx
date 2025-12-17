// =============================================================================
// PRISM Writer - Feedback Buttons Component
// =============================================================================
// 파일: frontend/src/components/feedback/FeedbackButtons.tsx
// 역할: 평가 결과에 대한 사용자 피드백 수집 (좋아요/싫어요)
// =============================================================================

'use client'

import { useState, useCallback } from 'react'

// =============================================================================
// 타입 정의
// =============================================================================

interface FeedbackButtonsProps {
  /** 평가 세션 ID 또는 고유 식별자 */
  evaluationId: string
  /** 피드백 완료 콜백 */
  onFeedbackSubmitted?: (type: 'like' | 'dislike') => void
  /** 컴팩트 모드 */
  compact?: boolean
}

// =============================================================================
// Component
// =============================================================================

export default function FeedbackButtons({
  evaluationId,
  onFeedbackSubmitted,
  compact = false,
}: FeedbackButtonsProps) {
  // ---------------------------------------------------------------------------
  // 상태
  // ---------------------------------------------------------------------------
  const [feedback, setFeedback] = useState<'like' | 'dislike' | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showThanks, setShowThanks] = useState(false)

  // ---------------------------------------------------------------------------
  // 피드백 제출 핸들러
  // ---------------------------------------------------------------------------
  const handleFeedback = useCallback(async (type: 'like' | 'dislike') => {
    if (isSubmitting || feedback) return

    setIsSubmitting(true)

    try {
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          evaluationId,
          feedbackType: type,
        }),
      })

      if (response.ok) {
        setFeedback(type)
        setShowThanks(true)
        onFeedbackSubmitted?.(type)

        // 감사 메시지 3초 후 숨기기
        setTimeout(() => setShowThanks(false), 3000)
      } else {
        console.error('Failed to submit feedback')
      }
    } catch (error) {
      console.error('Feedback submission error:', error)
    } finally {
      setIsSubmitting(false)
    }
  }, [evaluationId, feedback, isSubmitting, onFeedbackSubmitted])

  // ---------------------------------------------------------------------------
  // 렌더링
  // ---------------------------------------------------------------------------
  
  // 이미 피드백 제출됨
  if (feedback) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
        {showThanks && <span>피드백 감사합니다! 🙏</span>}
        <span className={feedback === 'like' ? 'text-green-600' : 'text-red-500'}>
          {feedback === 'like' ? '👍' : '👎'} 선택됨
        </span>
      </div>
    )
  }

  // 컴팩트 모드
  if (compact) {
    return (
      <div className="flex items-center gap-1">
        <button
          onClick={() => handleFeedback('like')}
          disabled={isSubmitting}
          className="p-1 hover:bg-green-100 dark:hover:bg-green-900/30 rounded transition-colors"
          title="도움이 됐어요"
          aria-label="도움이 됐어요"
        >
          👍
        </button>
        <button
          onClick={() => handleFeedback('dislike')}
          disabled={isSubmitting}
          className="p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-colors"
          title="개선이 필요해요"
          aria-label="개선이 필요해요"
        >
          👎
        </button>
      </div>
    )
  }

  // 기본 모드
  return (
    <div className="flex flex-col items-center gap-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
      <p className="text-sm text-gray-600 dark:text-gray-400">
        평가 결과가 도움이 되셨나요?
      </p>
      <div className="flex items-center gap-3">
        <button
          onClick={() => handleFeedback('like')}
          disabled={isSubmitting}
          className="flex items-center gap-2 px-4 py-2 bg-green-100 dark:bg-green-900/30 
                   text-green-700 dark:text-green-400 rounded-lg hover:bg-green-200 
                   dark:hover:bg-green-900/50 transition-colors disabled:opacity-50"
        >
          <span className="text-lg">👍</span>
          <span className="text-sm font-medium">도움이 됐어요</span>
        </button>
        <button
          onClick={() => handleFeedback('dislike')}
          disabled={isSubmitting}
          className="flex items-center gap-2 px-4 py-2 bg-red-100 dark:bg-red-900/30 
                   text-red-700 dark:text-red-400 rounded-lg hover:bg-red-200 
                   dark:hover:bg-red-900/50 transition-colors disabled:opacity-50"
        >
          <span className="text-lg">👎</span>
          <span className="text-sm font-medium">개선이 필요해요</span>
        </button>
      </div>
      {isSubmitting && (
        <p className="text-xs text-gray-500">제출 중...</p>
      )}
    </div>
  )
}
