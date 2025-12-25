'use client'

import { useState, memo } from 'react'
import { clsx } from 'clsx'
import { type EvaluationResult, type JudgeResult, type UpgradePlan } from '@/lib/judge/types'
import FeedbackButtons from './FeedbackButtons'

interface FeedbackPanelProps {
  evaluation?: EvaluationResult | null
  isLoading?: boolean
  onEvaluate?: () => void
}

export default function FeedbackPanel({
  evaluation,
  isLoading = false,
  onEvaluate,
}: FeedbackPanelProps) {
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mb-4" />
        <p className="text-gray-500 dark:text-gray-400">
          AI가 글을 분석하고 있습니다...
        </p>
        <p className="text-xs text-gray-400 mt-2">
          (Align Judge & Upgrade Planner)
        </p>
      </div>
    )
  }

  if (!evaluation) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <div className="text-6xl mb-4 opacity-50">📝</div>
        <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">
          평가 결과가 없습니다
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 max-w-xs">
          글을 작성한 후 평가를 요청하면<br/>
          구체적인 피드백과 수정 제안을 받을 수 있습니다.
        </p>
        {onEvaluate && (
          <button
            onClick={onEvaluate}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors shadow-sm"
          >
            지금 평가하기
          </button>
        )}
      </div>
    )
  }

  const { judgments, upgrade_plans, overall_score, template_id } = evaluation

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900 border-l border-gray-200 dark:border-gray-700">
      {/* 헤더 */}
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex justify-between items-center sticky top-0 z-10">
        <div>
          <h2 className="font-semibold text-gray-900 dark:text-white">
            피드백 (Feedback)
          </h2>
          <p className="text-xs text-gray-500">
            {new Date(evaluation.evaluated_at).toLocaleTimeString()} 기준
          </p>
        </div>
        <div className="text-right">
          <span className="text-xs text-gray-500 block">종합 점수</span>
          <span className={clsx(
            "text-xl font-bold",
            overall_score >= 80 ? "text-green-600" :
            overall_score >= 50 ? "text-yellow-600" : "text-red-600"
          )}>
            {overall_score}점
          </span>
        </div>
      </div>

      {/* 컨텐츠 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {judgments.map((judge) => {
          const plan = upgrade_plans.find(p => p.criteria_id === judge.criteria_id)
          return (
            <FeedbackItem 
              key={judge.criteria_id} 
              judge={judge} 
              plan={plan} 
            />
          )
        })}
      </div>

      {/* 하단 액션 */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 space-y-4">
        <FeedbackButtons templateId={template_id} />
        
        {onEvaluate && (
          <button
            onClick={onEvaluate}
            className="w-full py-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg transition-colors text-sm font-medium"
          >
            재평가하기
          </button>
        )}
      </div>
    </div>
  )
}

// =============================================================================
// Individual Feedback Item (Accordion)
// =============================================================================

const FeedbackItem = memo(function FeedbackItem({ judge, plan }: { judge: JudgeResult, plan?: UpgradePlan }) {
  const [isOpen, setIsOpen] = useState(judge.status !== 'pass') // Fail/Partial은 기본 펼침

  const statusColors = {
    pass: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800',
    fail: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800',
    partial: 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-800',
  }

  const statusIcons = {
    pass: '✅',
    fail: '❌',
    partial: '⚠️',
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
      {/* 요약 헤더 (클릭 시 토글) */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-lg">{statusIcons[judge.status]}</span>
          <span className="font-medium text-gray-900 dark:text-white text-sm line-clamp-1">
            {judge.reasoning}
          </span>
        </div>
        <span className="text-gray-400 text-xs ml-2">
          {isOpen ? '▲' : '▼'}
        </span>
      </button>

      {/* 상세 내용 */}
      {isOpen && (
        <div className="px-4 pb-4 pt-0 border-t border-gray-100 dark:border-gray-700/50">
          {/* 상태 뱃지 */}
          <div className="mt-3 mb-2">
            <span className={clsx("text-xs px-2 py-1 rounded-full border", statusColors[judge.status])}>
              {judge.status.toUpperCase()}
            </span>
          </div>

          {/* 판정 근거 */}
          <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">
            {judge.reasoning}
          </p>

          {/* 인용구 (문제 문장) */}
          {judge.citation && (
            <div className="mb-3 p-2 bg-gray-50 dark:bg-gray-900 rounded border-l-2 border-gray-300 dark:border-gray-600 text-xs text-gray-500 italic">
              "{judge.citation}"
            </div>
          )}

          {/* 수정 계획 (Upgrade Plan) */}
          {plan && (
            <div className="mt-4 pt-3 border-t border-dashed border-gray-200 dark:border-gray-700">
              <h4 className="text-xs font-bold text-indigo-600 dark:text-indigo-400 mb-2 flex items-center gap-1">
                🚀 Upgrade Plan
              </h4>
              
              <div className="space-y-2 text-sm">
                <div>
                  <span className="font-semibold text-gray-700 dark:text-gray-300 text-xs">What: </span>
                  <span className="text-gray-600 dark:text-gray-400">{plan.what}</span>
                </div>
                <div>
                  <span className="font-semibold text-gray-700 dark:text-gray-300 text-xs">Why: </span>
                  <span className="text-gray-600 dark:text-gray-400">{plan.why}</span>
                </div>
                <div className="bg-indigo-50 dark:bg-indigo-900/20 p-2 rounded text-gray-700 dark:text-gray-300 mt-1">
                  <span className="font-semibold text-xs block mb-1 text-indigo-700 dark:text-indigo-300">How to Fix:</span>
                  {plan.how}
                </div>
                {plan.example && (
                  <div className="mt-2">
                    <span className="font-semibold text-xs text-green-600 dark:text-green-400 block mb-1">Example:</span>
                    <div className="text-gray-600 dark:text-gray-400 bg-green-50 dark:bg-green-900/10 p-2 rounded border border-green-100 dark:border-green-900/20">
                      {plan.example}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
})
