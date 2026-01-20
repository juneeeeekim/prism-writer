// =============================================================================
// PRISM Writer - EvaluationHistory Component
// =============================================================================
// 파일: frontend/src/components/Assistant/evaluation/EvaluationHistory.tsx
// 역할: 평가 히스토리 목록 및 관리 UI
// 리팩토링: 2026-01-20
// =============================================================================

'use client'

import type { SavedEvaluation } from '@/hooks/useEvaluation'

// =============================================================================
// Types
// =============================================================================

interface EvaluationHistoryProps {
  evaluations: SavedEvaluation[]
  onLoad: (evaluation: SavedEvaluation) => void
  onDelete: (evaluationId: string) => void
}

// =============================================================================
// Component
// =============================================================================

export function EvaluationHistory({
  evaluations,
  onLoad,
  onDelete
}: EvaluationHistoryProps) {
  if (evaluations.length === 0) return null

  // 평가 유형별 분류
  const holisticEvaluations = evaluations.filter(e =>
    e.result_data?.template_id === 'holistic-only' ||
    (e.result_data?.holistic_result && (!e.result_data?.judgments || e.result_data.judgments.length === 0))
  )

  const detailedEvaluations = evaluations.filter(e =>
    (e.result_data?.template_id && e.result_data.template_id !== 'holistic-only') ||
    (e.result_data?.judgments && e.result_data.judgments.length > 0 && e.result_data?.template_id !== 'holistic-only')
  )

  // 평가 항목 렌더링
  const renderEvaluationItem = (evaluation: SavedEvaluation) => (
    <div
      key={evaluation.id}
      className="flex items-center gap-1 group"
    >
      <button
        onClick={() => onLoad(evaluation)}
        className="flex-1 text-left px-2 py-1.5 text-xs rounded hover:bg-gray-100 dark:hover:bg-gray-800 flex justify-between items-center"
      >
        <span className="truncate">
          {new Date(evaluation.created_at).toLocaleDateString('ko-KR', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })}
        </span>
        <span className="text-prism-primary font-medium">
          {evaluation.overall_score ? `${Math.round(evaluation.overall_score)}점` : '-'}
        </span>
      </button>
      <button
        onClick={() => onDelete(evaluation.id)}
        className="p-1 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
        aria-label="평가 삭제"
        title="평가 삭제"
      >
        🗑️
      </button>
    </div>
  )

  return (
    <div className="mx-4 mb-4 border-t border-gray-200 dark:border-gray-700 pt-3">
      <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
        📁 이전 평가 기록
      </h4>

      {/* 2열 가로 배치 */}
      <div className="grid grid-cols-2 gap-3">
        {/* 종합 평가 기록 섹션 */}
        <div>
          <h5 className="text-xs font-medium text-indigo-600 dark:text-indigo-400 mb-1 flex items-center gap-1">
            📊 종합 평가
            <span className="text-gray-400 font-normal">({holisticEvaluations.length})</span>
          </h5>
          {holisticEvaluations.length > 0 ? (
            <div className="space-y-1 max-h-24 overflow-y-auto pl-2 border-l-2 border-indigo-200 dark:border-indigo-800">
              {holisticEvaluations.slice(0, 3).map(renderEvaluationItem)}
            </div>
          ) : (
            <p className="text-xs text-gray-400 pl-2 border-l-2 border-gray-200 dark:border-gray-700">
              없음
            </p>
          )}
        </div>

        {/* 기준별 평가 기록 섹션 */}
        <div>
          <h5 className="text-xs font-medium text-emerald-600 dark:text-emerald-400 mb-1 flex items-center gap-1">
            📋 기준별 평가
            <span className="text-gray-400 font-normal">({detailedEvaluations.length})</span>
          </h5>
          {detailedEvaluations.length > 0 ? (
            <div className="space-y-1 max-h-24 overflow-y-auto pl-2 border-l-2 border-emerald-200 dark:border-emerald-800">
              {detailedEvaluations.slice(0, 3).map(renderEvaluationItem)}
            </div>
          ) : (
            <p className="text-xs text-gray-400 pl-2 border-l-2 border-gray-200 dark:border-gray-700">
              없음
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
