'use client'

/**
 * =============================================================================
 * P4: Adaptive Feedback Buttons Component
 * =============================================================================
 * 
 * @description P4 Adaptive Threshold System용 피드백 버튼 컴포넌트
 * @module AdaptiveFeedbackButtons
 * @since 2026-01-06
 * @related 2601062127_Adaptive_Threshold_System_체크리스트.md P4-04-01
 * 
 * 기능:
 * - 👍 도움됨: 임계값 하락 (더 관대하게)
 * - 👎 아니요: 중립 (변화 없음)
 * - 🚨 틀린 정보: 임계값 상승 (더 엄격하게)
 * 
 * API: POST /api/rag/feedback
 */

import React, { useState } from 'react'
import { useToast } from '@/hooks/useToast'

// =============================================================================
// [P4-04-01] 타입 정의
// =============================================================================

/**
 * 학습 신호 유형 (projectPreferences.ts의 SignalType과 동일)
 */
type SignalType = 
  | 'chat_helpful' 
  | 'chat_not_helpful' 
  | 'chat_hallucination'
  | 'eval_override'
  | 'rubric_adopt'
  | 'doc_reupload'
  | 'example_pin'

interface AdaptiveFeedbackButtonsProps {
  /** 대상 메시지 ID */
  messageId: string
  /** 프로젝트 ID (필수) */
  projectId: string
  /** 피드백 제출 후 콜백 */
  onFeedbackSubmit?: (type: SignalType) => void
  // =========================================================================
  // [Feedback Sync] P3-01: 서버에서 받은 기존 피드백 상태
  // =========================================================================
  initialFeedback?: SignalType | null
}

// =============================================================================
// [P4-04-01] 메인 컴포넌트
// =============================================================================

/**
 * P4 Adaptive Threshold용 피드백 버튼
 * 
 * @description 
 * AI 응답 품질에 대한 간단한 피드백을 수집하고,
 * 프로젝트별 RAG 임계값을 조정하는 데 사용됩니다.
 */
export default function AdaptiveFeedbackButtons({
  messageId,
  projectId,
  onFeedbackSubmit,
  initialFeedback,  // [Feedback Sync] P3-01: 서버 동기화된 피드백
}: AdaptiveFeedbackButtonsProps) {
  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------
  // [Feedback Sync] P3-01: 초기값을 prop에서 받음 (크로스 디바이스 동기화)
  const [submitted, setSubmitted] = useState<SignalType | null>(initialFeedback ?? null)
  const [loading, setLoading] = useState(false)
  const toast = useToast()  // [P4] useToast 훅 사용

  // ---------------------------------------------------------------------------
  // [P4-04-01] 피드백 제출 핸들러
  // ---------------------------------------------------------------------------
  const handleFeedback = async (type: SignalType) => {
    // 이미 제출되었거나 로딩 중이면 무시
    if (submitted || loading) return

    setLoading(true)

    try {
      const response = await fetch('/api/rag/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          signalType: type,
          messageId,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        setSubmitted(type)
        onFeedbackSubmit?.(type)
        
        // 토스트 알림
        const thresholdPercent = (data.newThreshold * 100).toFixed(0)
        toast.success(`피드백이 반영되었습니다. (새 임계값: ${thresholdPercent}%)`)
      } else {
        const error = await response.json()
        toast.error(error.message || '피드백 전송에 실패했습니다.')
      }
    } catch (error) {
      console.error('[AdaptiveFeedback] Error:', error)
      toast.error('네트워크 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  // ---------------------------------------------------------------------------
  // [P4-04-01] 제출 완료 상태 렌더링
  // ---------------------------------------------------------------------------
  if (submitted) {
    return (
      <div className="flex items-center gap-1 text-xs text-gray-500 mt-2">
        <span className="text-green-600">✓</span>
        <span>피드백 감사합니다</span>
        {submitted === 'chat_helpful' && <span className="text-green-600">👍</span>}
        {submitted === 'chat_not_helpful' && <span className="text-gray-600">👎</span>}
        {submitted === 'chat_hallucination' && <span className="text-red-600">🚨</span>}
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // [P4-04-01] 피드백 버튼 렌더링
  // ---------------------------------------------------------------------------
  return (
    <div className="flex items-center gap-1 mt-2">
      {/* 도움됨 버튼 */}
      <button
        onClick={() => handleFeedback('chat_helpful')}
        disabled={loading}
        className={`
          inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md
          transition-all duration-200
          border border-transparent
          hover:border-green-200 hover:bg-green-50 hover:text-green-700
          disabled:opacity-50 disabled:cursor-not-allowed
          ${loading ? 'animate-pulse' : ''}
        `}
        title="이 답변이 도움이 되었어요 (임계값 하락)"
        aria-label="도움됨"
      >
        <span>👍</span>
        <span className="hidden sm:inline">도움됨</span>
      </button>

      {/* 아니요 버튼 */}
      <button
        onClick={() => handleFeedback('chat_not_helpful')}
        disabled={loading}
        className={`
          inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md
          transition-all duration-200
          border border-transparent
          hover:border-gray-300 hover:bg-gray-100 hover:text-gray-700
          disabled:opacity-50 disabled:cursor-not-allowed
          ${loading ? 'animate-pulse' : ''}
        `}
        title="도움이 되지 않았어요"
        aria-label="아니요"
      >
        <span>👎</span>
        <span className="hidden sm:inline">아니요</span>
      </button>

      {/* 틀린 정보 버튼 */}
      <button
        onClick={() => handleFeedback('chat_hallucination')}
        disabled={loading}
        className={`
          inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md
          transition-all duration-200
          border border-transparent
          hover:border-red-200 hover:bg-red-50 hover:text-red-700
          disabled:opacity-50 disabled:cursor-not-allowed
          ${loading ? 'animate-pulse' : ''}
        `}
        title="문서에 없는 잘못된 정보가 있어요 (임계값 상승)"
        aria-label="틀린 정보"
      >
        <span>🚨</span>
        <span className="hidden sm:inline">틀린 정보</span>
      </button>

      {/* 로딩 표시 */}
      {loading && (
        <span className="text-xs text-gray-400 ml-1">
          처리 중...
        </span>
      )}
    </div>
  )
}
