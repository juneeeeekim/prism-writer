// =============================================================================
// PRISM Writer - EvaluationTabs Component
// =============================================================================
// 파일: frontend/src/components/Assistant/evaluation/EvaluationTabs.tsx
// 역할: 종합 평가 / 기준별 평가 탭 UI
// 리팩토링: 2026-01-20
// =============================================================================

'use client'

import { clsx } from 'clsx'
import type { EvaluationResult as V5EvaluationResult, HolisticEvaluationResult } from '@/lib/judge/types'
import FeedbackPanel from '@/components/Editor/FeedbackPanel'
import HolisticFeedbackPanel from '@/components/Editor/HolisticFeedbackPanel'
import { EvaluationSkeleton } from '@/components/ui/SearchResultSkeleton'
import { HolisticEvaluateCTA } from './EvaluationActions'

// =============================================================================
// Types
// =============================================================================

interface EvaluationTabsProps {
  activeTab: 'holistic' | 'detailed'
  onTabChange: (tab: 'holistic' | 'detailed') => void
  result: V5EvaluationResult | null
  holisticResult: HolisticEvaluationResult | null
  isLoading: boolean
  isHolisticLoading: boolean
  isSaved: boolean
  onHolisticEvaluate: () => void
  onDetailedEvaluate: () => void
  onApplyPlan: (plan: any) => Promise<void>
  onRetryPlan: (criteriaId: string) => Promise<any>
  onReevaluate: (criteriaId: string, options?: { quality?: 'standard' | 'high_quality' }) => Promise<any>
}

// =============================================================================
// Component
// =============================================================================

export function EvaluationTabs({
  activeTab,
  onTabChange,
  result,
  holisticResult,
  isLoading,
  isHolisticLoading,
  isSaved,
  onHolisticEvaluate,
  onDetailedEvaluate,
  onApplyPlan,
  onRetryPlan,
  onReevaluate
}: EvaluationTabsProps) {
  return (
    <div className="flex-1 overflow-hidden flex flex-col">
      {/* 탭 헤더 */}
      <div className="flex border-b border-gray-200 dark:border-gray-700 mx-4 mt-2">
        <button
          onClick={() => onTabChange('holistic')}
          className={clsx(
            'px-4 py-2 text-sm font-medium transition-colors',
            activeTab === 'holistic'
              ? 'text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
          )}
          aria-label="종합 평가 탭"
        >
          📊 종합 평가
        </button>
        <button
          onClick={() => onTabChange('detailed')}
          className={clsx(
            'px-4 py-2 text-sm font-medium transition-colors',
            activeTab === 'detailed'
              ? 'text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
          )}
          aria-label="기준별 평가 탭"
        >
          📋 기준별 평가
        </button>
      </div>

      {/* 탭 컨텐츠 */}
      <div className="flex-1 overflow-y-auto">
        {/* 종합 평가 탭 */}
        {activeTab === 'holistic' && (
          <div className="p-4">
            {holisticResult ? (
              <HolisticFeedbackPanel
                result={holisticResult}
                isLoading={false}
                onRetry={onHolisticEvaluate}
              />
            ) : (
              <HolisticEvaluateCTA
                isLoading={isHolisticLoading}
                onEvaluate={onHolisticEvaluate}
              />
            )}
          </div>
        )}

        {/* 기준별 평가 탭 */}
        {activeTab === 'detailed' && (
          <>
            {/* 로딩 스켈레톤 */}
            {isLoading && !result && <EvaluationSkeleton />}

            {/* 저장됨 표시 */}
            {isSaved && result && (
              <div className="mx-4 mt-2 mb-0 px-2 py-1 bg-green-100 dark:bg-green-900/30 rounded text-xs text-green-700 dark:text-green-300 flex items-center gap-1">
                ✅ 평가 결과 저장됨
              </div>
            )}

            {/* 결과 패널 */}
            {(result || (isLoading && result)) && (
              <FeedbackPanel
                evaluation={result}
                isLoading={isLoading}
                onEvaluate={onDetailedEvaluate}
                onApplyPlan={onApplyPlan}
                onRetryPlan={onRetryPlan}
                onReevaluate={onReevaluate}
              />
            )}
          </>
        )}
      </div>
    </div>
  )
}
