// =============================================================================
// PRISM Writer - EvaluationActions Component
// =============================================================================
// 파일: frontend/src/components/Assistant/evaluation/EvaluationActions.tsx
// 역할: 평가 실행 버튼 및 초기 상태 UI
// 리팩토링: 2026-01-20
// =============================================================================

'use client'

// =============================================================================
// Types
// =============================================================================

interface EvaluationActionsProps {
  isLoading: boolean
  isHolisticLoading: boolean
  onHolisticEvaluate: () => void
  onDetailedEvaluate: () => void
}

// =============================================================================
// Component
// =============================================================================

export function EvaluationActions({
  isLoading,
  isHolisticLoading,
  onHolisticEvaluate,
  onDetailedEvaluate
}: EvaluationActionsProps) {
  return (
    <div className="p-4 pb-0">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          글 평가
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          AI가 글을 분석하고 종합 피드백을 제공합니다.
        </p>

        {/* 종합 평가 버튼 (메인) */}
        <button
          onClick={onHolisticEvaluate}
          disabled={isHolisticLoading}
          className="w-full px-4 py-3 bg-indigo-600 hover:bg-indigo-700
                  text-white font-medium rounded-lg
                  transition-colors flex items-center justify-center gap-2 shadow-sm
                  disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="종합 평가하기"
        >
          {isHolisticLoading ? (
            <>
              <span className="animate-spin">⏳</span> 평가 중...
            </>
          ) : (
            <>📊 종합 평가하기</>
          )}
        </button>

        {/* 기준별 평가 버튼 (보조) */}
        <button
          onClick={onDetailedEvaluate}
          disabled={isLoading}
          className="w-full mt-2 px-4 py-2 bg-gray-100 hover:bg-gray-200
                  dark:bg-gray-800 dark:hover:bg-gray-700
                  text-gray-700 dark:text-gray-300 font-medium rounded-lg
                  transition-colors flex items-center justify-center gap-2 text-sm"
          aria-label="기준별 상세 평가"
        >
          📋 기준별 상세 평가
        </button>
      </div>
    </div>
  )
}

// =============================================================================
// Inline Holistic CTA Component
// =============================================================================

interface HolisticEvaluateCTAProps {
  isLoading: boolean
  onEvaluate: () => void
}

export function HolisticEvaluateCTA({
  isLoading,
  onEvaluate
}: HolisticEvaluateCTAProps) {
  return (
    <div className="mx-auto mt-8 p-6 max-w-sm bg-indigo-50 dark:bg-indigo-900/20 rounded-xl border border-indigo-100 dark:border-indigo-800 text-center">
      <div className="mb-3 text-2xl">💡</div>
      <h3 className="text-sm font-semibold text-indigo-900 dark:text-indigo-200 mb-2">
        전체적인 글 평가가 필요하신가요?
      </h3>
      <p className="text-xs text-indigo-700 dark:text-indigo-400 mb-4">
        AI가 글의 구조, 내용, 표현을 종합적으로 분석해드립니다.
      </p>
      <button
        onClick={onEvaluate}
        disabled={isLoading}
        className="w-full px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors shadow-sm disabled:opacity-50"
      >
        {isLoading ? '분석 중...' : '📊 종합 평가 실행하기'}
      </button>
    </div>
  )
}

// =============================================================================
// Info Box Component
// =============================================================================

export function EvaluationInfoBox() {
  return (
    <div className="mx-4 mt-auto mb-4 p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-xs text-gray-500 dark:text-gray-400 shadow-sm">
      <p>💡 평가는 업로드된 문서를 근거로 수행됩니다.</p>
      <p className="mt-1">문서를 먼저 업로드하면 더 정확한 피드백을 받을 수 있습니다.</p>
    </div>
  )
}
