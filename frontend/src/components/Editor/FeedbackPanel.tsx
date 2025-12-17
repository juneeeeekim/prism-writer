// =============================================================================
// PRISM Writer - Feedback Panel Component
// =============================================================================
// 파일: frontend/src/components/editor/FeedbackPanel.tsx
// 역할: RAG 평가 결과 표시 패널 (사이드 패널용)
// 접근성: role="complementary", aria-label 적용
// Phase 1: RAG 시스템 구축 체크리스트 1.3 항목
// =============================================================================

'use client'

import { useState } from 'react'

// =============================================================================
// Types
// =============================================================================

/** 피드백 상태 유형 */
type FeedbackStatus = '통과' | '보완' | '미충족' | '검토중'

/** 개별 피드백 항목 */
interface FeedbackItem {
  /** 항목 ID */
  id: string
  /** 루브릭 항목명 */
  rubricItem: string
  /** 상태 */
  status: FeedbackStatus
  /** 근거 인용 */
  evidenceQuotes?: string[]
  /** 부족한 점 */
  gap?: string
  /** 개선안 */
  recommendations?: string[]
  /** 신뢰도 (0-1) */
  confidence?: number
}

/** FeedbackPanel Props */
interface FeedbackPanelProps {
  /** 피드백 목록 */
  feedbacks?: FeedbackItem[]
  /** 로딩 상태 */
  isLoading?: boolean
  /** 평가 트리거 콜백 */
  onEvaluate?: () => void
}

// =============================================================================
// Status Badge Component
// =============================================================================
function StatusBadge({ status }: { status: FeedbackStatus }) {
  const statusConfig = {
    '통과': { 
      bg: 'bg-green-100 dark:bg-green-900', 
      text: 'text-green-800 dark:text-green-200',
      icon: '✓'
    },
    '보완': { 
      bg: 'bg-yellow-100 dark:bg-yellow-900', 
      text: 'text-yellow-800 dark:text-yellow-200',
      icon: '△'
    },
    '미충족': { 
      bg: 'bg-red-100 dark:bg-red-900', 
      text: 'text-red-800 dark:text-red-200',
      icon: '✗'
    },
    '검토중': { 
      bg: 'bg-gray-100 dark:bg-gray-700', 
      text: 'text-gray-800 dark:text-gray-200',
      icon: '○'
    },
  }

  const config = statusConfig[status]

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
      <span>{config.icon}</span>
      {status}
    </span>
  )
}

// =============================================================================
// Feedback Card Component
// =============================================================================
function FeedbackCard({ feedback }: { feedback: FeedbackItem }) {
  const [isExpanded, setIsExpanded] = useState(false)

  return (
    <div 
      className="feedback-card p-4 border rounded-lg transition-all mb-3
                 bg-white dark:bg-gray-800 
                 border-gray-200 dark:border-gray-700
                 hover:border-indigo-300 dark:hover:border-indigo-600
                 hover:shadow-sm"
    >
      {/* 카드 헤더 */}
      <div className="flex items-start justify-between gap-2">
        <h4 className="font-medium text-gray-900 dark:text-white">
          {feedback.rubricItem}
        </h4>
        <StatusBadge status={feedback.status} />
      </div>

      {/* 부족한 점 (gap) */}
      {feedback.gap && (
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          {feedback.gap}
        </p>
      )}

      {/* 확장 버튼 */}
      {(feedback.evidenceQuotes?.length || feedback.recommendations?.length) && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="mt-2 text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
          aria-expanded={isExpanded}
        >
          {isExpanded ? '접기 ▲' : '상세 보기 ▼'}
        </button>
      )}

      {/* 확장된 내용 */}
      {isExpanded && (
        <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
          {/* 근거 인용 */}
          {feedback.evidenceQuotes && feedback.evidenceQuotes.length > 0 && (
            <div className="mb-3">
              <h5 className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                📚 근거 인용
              </h5>
              <ul className="space-y-1">
                {feedback.evidenceQuotes.map((quote, idx) => (
                  <li 
                    key={idx}
                    className="text-sm text-gray-600 dark:text-gray-300 pl-3 border-l-2 border-indigo-300"
                  >
                    "{quote}"
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* 개선안 */}
          {feedback.recommendations && feedback.recommendations.length > 0 && (
            <div>
              <h5 className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                💡 개선안
              </h5>
              <ul className="space-y-1">
                {feedback.recommendations.map((rec, idx) => (
                  <li 
                    key={idx}
                    className="text-sm text-gray-600 dark:text-gray-300 flex items-start gap-2"
                  >
                    <span className="text-indigo-500">{idx + 1}.</span>
                    {rec}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* 신뢰도 */}
          {feedback.confidence !== undefined && (
            <div className="mt-3 text-xs text-gray-400">
              신뢰도: {Math.round(feedback.confidence * 100)}%
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// =============================================================================
// Empty State Component
// =============================================================================
function EmptyState({ onEvaluate }: { onEvaluate?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full p-8 text-center">
      <div className="text-6xl mb-4 opacity-50">📝</div>
      <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">
        평가 결과가 여기에 표시됩니다
      </h3>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 max-w-xs">
        글을 작성한 후 "평가하기" 버튼을 클릭하면 
        RAG 기반 피드백을 받을 수 있습니다.
      </p>
      {onEvaluate && (
        <button
          onClick={onEvaluate}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 
                     text-white rounded-lg transition-colors
                     focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          평가하기
        </button>
      )}
    </div>
  )
}

// =============================================================================
// Loading State Component
// =============================================================================
function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center h-full p-8">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mb-4" />
      <p className="text-gray-500 dark:text-gray-400">
        평가 중입니다...
      </p>
    </div>
  )
}

// =============================================================================
// Main Component
// =============================================================================
export default function FeedbackPanel({
  feedbacks = [],
  isLoading = false,
  onEvaluate,
}: FeedbackPanelProps) {
  // ---------------------------------------------------------------------------
  // Summary Stats
  // ---------------------------------------------------------------------------
  const stats = {
    total: feedbacks.length,
    passed: feedbacks.filter(f => f.status === '통과').length,
    needsWork: feedbacks.filter(f => f.status === '보완').length,
    failed: feedbacks.filter(f => f.status === '미충족').length,
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <aside
      className="flex flex-col h-full bg-gray-50 dark:bg-gray-900"
      role="complementary"
      aria-label="피드백 패널"
    >
      {/* -----------------------------------------------------------------------
          Header
          ----------------------------------------------------------------------- */}
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          평가 결과
        </h2>
        {feedbacks.length > 0 && (
          <div className="flex gap-3 mt-2 text-sm">
            <span className="text-green-600 dark:text-green-400">
              ✓ {stats.passed}
            </span>
            <span className="text-yellow-600 dark:text-yellow-400">
              △ {stats.needsWork}
            </span>
            <span className="text-red-600 dark:text-red-400">
              ✗ {stats.failed}
            </span>
          </div>
        )}
      </div>

      {/* -----------------------------------------------------------------------
          Content Area
          ----------------------------------------------------------------------- */}
      <div className="flex-1 overflow-y-auto p-4">
        {isLoading ? (
          <LoadingState />
        ) : feedbacks.length === 0 ? (
          <EmptyState onEvaluate={onEvaluate} />
        ) : (
          <div>
            {feedbacks.map((feedback) => (
              <FeedbackCard key={feedback.id} feedback={feedback} />
            ))}
          </div>
        )}
      </div>
    </aside>
  )
}

// =============================================================================
// Named Export
// =============================================================================
export { FeedbackPanel }
export type { FeedbackItem, FeedbackStatus, FeedbackPanelProps }
