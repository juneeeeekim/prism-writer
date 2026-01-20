// =============================================================================
// PRISM Writer - Evaluation Tab (Refactored)
// =============================================================================
// 파일: frontend/src/components/Assistant/EvaluationTab.tsx
// 역할: 글 평가 기능 탭 - 메인 컨테이너
// 리팩토링: 2026-01-20 - 937줄 → ~150줄
// =============================================================================

'use client'

import { useEvaluation } from '@/hooks/useEvaluation'
import HolisticFeedbackPanel from '@/components/Editor/HolisticFeedbackPanel'
import { NoEvaluationHistory } from '@/components/ui/EmptyState'
import {
  EvaluationHistory,
  EvaluationActions,
  EvaluationInfoBox,
  EvaluationTabs
} from './evaluation'

// =============================================================================
// Component
// =============================================================================

export default function EvaluationTab() {
  const {
    isLoading,
    isHolisticLoading,
    isLoadingHistory,
    result,
    holisticResult,
    error,
    isSaved,
    savedEvaluations,
    activeEvalTab,
    setActiveEvalTab,
    handleEvaluate,
    handleHolisticEvaluate,
    handleApplyPlan,
    handleRetryPlan,
    handleReevaluate,
    handleLoadEvaluation,
    handleDeleteEvaluation,
  } = useEvaluation()

  const showInitialState = !result && !isLoading

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-900 overflow-hidden">
      {/* 헤더 및 평가 버튼 (초기 상태에서만) */}
      {showInitialState && (
        <EvaluationActions
          isLoading={isLoading}
          isHolisticLoading={isHolisticLoading}
          onHolisticEvaluate={handleHolisticEvaluate}
          onDetailedEvaluate={handleEvaluate}
        />
      )}

      {/* 에러 메시지 */}
      {error && (
        <div className="m-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-sm text-red-700 dark:text-red-400">❌ {error}</p>
        </div>
      )}

      {/* 종합 평가 결과 (holisticResult만 있고 result가 없을 때) */}
      {(holisticResult || isHolisticLoading) && !result && (
        <div className="flex-1 overflow-y-auto p-4">
          <HolisticFeedbackPanel
            result={holisticResult}
            isLoading={isHolisticLoading}
            onRetry={handleHolisticEvaluate}
          />

          {/* 기준별 평가 전환 버튼 */}
          {holisticResult && (
            <button
              onClick={handleEvaluate}
              disabled={isLoading}
              className="w-full mt-4 px-4 py-2 bg-gray-100 hover:bg-gray-200
                      dark:bg-gray-800 dark:hover:bg-gray-700
                      text-gray-700 dark:text-gray-300 font-medium rounded-lg
                      transition-colors flex items-center justify-center gap-2 text-sm"
            >
              📋 기준별 상세 평가 추가하기
            </button>
          )}
        </div>
      )}

      {/* 탭 시스템 (result가 있거나 로딩 중일 때) */}
      {(result || isLoading) && (
        <EvaluationTabs
          activeTab={activeEvalTab}
          onTabChange={setActiveEvalTab}
          result={result}
          holisticResult={holisticResult}
          isLoading={isLoading}
          isHolisticLoading={isHolisticLoading}
          isSaved={isSaved}
          onHolisticEvaluate={handleHolisticEvaluate}
          onDetailedEvaluate={handleEvaluate}
          onApplyPlan={handleApplyPlan}
          onRetryPlan={handleRetryPlan}
          onReevaluate={handleReevaluate}
        />
      )}

      {/* 안내 정보 (초기 상태) */}
      {showInitialState && <EvaluationInfoBox />}

      {/* 평가 히스토리 */}
      {!isLoadingHistory && savedEvaluations.length > 0 && (
        <EvaluationHistory
          evaluations={savedEvaluations}
          onLoad={handleLoadEvaluation}
          onDelete={handleDeleteEvaluation}
        />
      )}

      {/* Empty State */}
      {!isLoadingHistory && savedEvaluations.length === 0 && !result && !isLoading && (
        <div className="mx-4 mb-4">
          <NoEvaluationHistory />
        </div>
      )}
    </div>
  )
}
