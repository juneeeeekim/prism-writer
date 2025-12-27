'use client'

// =============================================================================
// PRISM Writer - Feedback Buttons Component
// =============================================================================
// 파일: frontend/src/components/chat/FeedbackButtons.tsx
// 역할: AI 응답에 대한 사용자 피드백 수집 UI
// 생성일: 2025-12-27
// 
// [RAG 환각 방지 업그레이드]
// - 좋아요/싫어요 버튼으로 응답 품질 평가
// - 코멘트 입력으로 상세 피드백 수집
// - /api/feedback/hallucination API 연동
// =============================================================================

import React, { useState } from 'react'

// =============================================================================
// 타입 정의
// =============================================================================

interface FeedbackButtonsProps {
  /** 사용자 질문 */
  userQuery: string
  /** AI 응답 */
  modelResponse: string
  /** 세션 ID (선택) */
  sessionId?: string
  /** 메시지 ID (선택) */
  messageId?: string
  /** 사용한 모델 ID (선택) */
  modelId?: string
  /** 검색된 문서 정보 (선택) */
  retrievedDocs?: Array<{ title: string; chunkId: string }>
  /** 피드백 제출 후 콜백 (선택) */
  onFeedbackSubmit?: (isPositive: boolean) => void
}

// =============================================================================
// 메인 컴포넌트
// =============================================================================

export default function FeedbackButtons({
  userQuery,
  modelResponse,
  sessionId,
  messageId,
  modelId,
  retrievedDocs,
  onFeedbackSubmit,
}: FeedbackButtonsProps) {
  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------
  const [feedbackGiven, setFeedbackGiven] = useState<'positive' | 'negative' | null>(null)
  const [showCommentBox, setShowCommentBox] = useState(false)
  const [comment, setComment] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // ---------------------------------------------------------------------------
  // 피드백 제출 핸들러
  // ---------------------------------------------------------------------------
  const handleFeedback = async (isPositive: boolean) => {
    // 이미 같은 피드백을 주었으면 무시
    if (feedbackGiven === (isPositive ? 'positive' : 'negative')) {
      return
    }

    setIsSubmitting(true)
    setSubmitError(null)

    try {
      const response = await fetch('/api/feedback/hallucination', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userQuery,
          modelResponse,
          sessionId: sessionId || null,
          messageId: messageId || null,
          modelId: modelId || null,
          retrievedDocs: retrievedDocs || null,
          isPositive,
          feedbackType: isPositive ? 'quality' : 'hallucination',
          userComment: comment || null,
        }),
      })

      if (!response.ok) {
        throw new Error('피드백 제출에 실패했습니다.')
      }

      setFeedbackGiven(isPositive ? 'positive' : 'negative')
      
      // 부정적 피드백 시 코멘트 박스 표시
      if (!isPositive) {
        setShowCommentBox(true)
      }

      // 콜백 호출
      onFeedbackSubmit?.(isPositive)

    } catch (error: any) {
      console.error('[FeedbackButtons] Error:', error)
      setSubmitError(error.message || '피드백 제출 중 오류가 발생했습니다.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // ---------------------------------------------------------------------------
  // 코멘트 제출 핸들러
  // ---------------------------------------------------------------------------
  const handleCommentSubmit = async () => {
    if (!comment.trim()) {
      setShowCommentBox(false)
      return
    }

    setIsSubmitting(true)
    setSubmitError(null)

    try {
      const response = await fetch('/api/feedback/hallucination', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userQuery,
          modelResponse,
          sessionId: sessionId || null,
          messageId: messageId || null,
          modelId: modelId || null,
          retrievedDocs: retrievedDocs || null,
          isPositive: false,
          feedbackType: 'hallucination',
          userComment: comment,
        }),
      })

      if (!response.ok) {
        throw new Error('코멘트 제출에 실패했습니다.')
      }

      setShowCommentBox(false)
      setComment('')

    } catch (error: any) {
      console.error('[FeedbackButtons] Comment Error:', error)
      setSubmitError(error.message || '코멘트 제출 중 오류가 발생했습니다.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="feedback-buttons-container mt-2">
      {/* ---------------------------------------------------------------------
          피드백 버튼 영역
      --------------------------------------------------------------------- */}
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <span className="text-xs">이 답변이 도움이 되었나요?</span>
        
        {/* 좋아요 버튼 */}
        <button
          onClick={() => handleFeedback(true)}
          disabled={isSubmitting || feedbackGiven !== null}
          className={`
            p-1 rounded transition-colors
            ${feedbackGiven === 'positive' 
              ? 'text-green-500 bg-green-50' 
              : 'hover:text-green-500 hover:bg-green-50'
            }
            ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}
          `}
          title="도움이 됐어요"
          aria-label="좋아요"
        >
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            className="h-4 w-4" 
            fill={feedbackGiven === 'positive' ? 'currentColor' : 'none'}
            viewBox="0 0 24 24" 
            stroke="currentColor" 
            strokeWidth={2}
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" 
            />
          </svg>
        </button>

        {/* 싫어요 버튼 */}
        <button
          onClick={() => handleFeedback(false)}
          disabled={isSubmitting || feedbackGiven !== null}
          className={`
            p-1 rounded transition-colors
            ${feedbackGiven === 'negative' 
              ? 'text-red-500 bg-red-50' 
              : 'hover:text-red-500 hover:bg-red-50'
            }
            ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}
          `}
          title="개선이 필요해요"
          aria-label="싫어요"
        >
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            className="h-4 w-4" 
            fill={feedbackGiven === 'negative' ? 'currentColor' : 'none'}
            viewBox="0 0 24 24" 
            stroke="currentColor" 
            strokeWidth={2}
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              d="M10 14H5.236a2 2 0 01-1.789-2.894l3.5-7A2 2 0 018.736 3h4.018a2 2 0 01.485.06l3.76.94m-7 10v5a2 2 0 002 2h.096c.5 0 .905-.405.905-.904 0-.715.211-1.413.608-2.008L17 13V4m-7 10h2m5-10h2a2 2 0 012 2v6a2 2 0 01-2 2h-2.5" 
            />
          </svg>
        </button>

        {/* 피드백 완료 메시지 */}
        {feedbackGiven && !showCommentBox && (
          <span className="text-xs text-green-600 ml-2">
            피드백 감사합니다!
          </span>
        )}
      </div>

      {/* ---------------------------------------------------------------------
          코멘트 입력 영역 (부정적 피드백 시 표시)
      --------------------------------------------------------------------- */}
      {showCommentBox && (
        <div className="mt-2 p-3 bg-gray-50 rounded-lg border border-gray-200">
          <p className="text-xs text-gray-600 mb-2">
            어떤 점이 개선되면 좋을까요? (선택사항)
          </p>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="예: 참고 자료와 관련 없는 답변이었어요, 더 구체적인 설명이 필요해요..."
            className="w-full p-2 text-sm border border-gray-300 rounded resize-none focus:outline-none focus:ring-1 focus:ring-blue-500"
            rows={2}
            disabled={isSubmitting}
          />
          <div className="flex justify-end gap-2 mt-2">
            <button
              onClick={() => {
                setShowCommentBox(false)
                setComment('')
              }}
              className="px-3 py-1 text-xs text-gray-600 hover:text-gray-800"
              disabled={isSubmitting}
            >
              건너뛰기
            </button>
            <button
              onClick={handleCommentSubmit}
              disabled={isSubmitting || !comment.trim()}
              className={`
                px-3 py-1 text-xs text-white bg-blue-500 rounded
                hover:bg-blue-600
                ${isSubmitting || !comment.trim() ? 'opacity-50 cursor-not-allowed' : ''}
              `}
            >
              {isSubmitting ? '제출 중...' : '제출'}
            </button>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------------
          에러 메시지
      --------------------------------------------------------------------- */}
      {submitError && (
        <p className="text-xs text-red-500 mt-1">{submitError}</p>
      )}
    </div>
  )
}
