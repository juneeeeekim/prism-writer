// =============================================================================
// [Phase 6.2] OnboardingGuide - 새 프로젝트 온보딩 가이드
// =============================================================================
// 파일: frontend/src/components/Assistant/Studio/OnboardingGuide.tsx
// 역할: 문서가 없는 새 프로젝트에 대한 온보딩 UI 제공
// 생성일: 2025-12-31
// =============================================================================

'use client'

import DocumentUploader from '@/components/documents/DocumentUploader'

// =============================================================================
// Types
// =============================================================================

interface OnboardingGuideProps {
  /** 현재 온보딩 단계 (1: 문서 업로드, 2: 학습 대기, 3: 완료) */
  step?: 1 | 2 | 3
  /** 문서 업로드 성공 시 콜백 */
  onUploadSuccess?: () => void
  /** 추가 CSS 클래스 */
  className?: string
}

// =============================================================================
// Sub Components
// =============================================================================

/**
 * 스텝 인디케이터 컴포넌트
 */
function StepIndicator({
  currentStep,
  totalSteps
}: {
  currentStep: number
  totalSteps: number
}) {
  return (
    <div className="flex items-center justify-center gap-2 my-6">
      {Array.from({ length: totalSteps }, (_, i) => {
        const stepNumber = i + 1
        const isActive = stepNumber === currentStep
        const isCompleted = stepNumber < currentStep

        return (
          <div key={stepNumber} className="flex items-center">
            {/* Step Circle */}
            <div
              className={`
                w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium
                transition-all duration-300
                ${isCompleted
                  ? 'bg-green-500 text-white'
                  : isActive
                    ? 'bg-indigo-600 text-white ring-4 ring-indigo-100 dark:ring-indigo-900'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                }
              `}
            >
              {isCompleted ? (
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
              ) : (
                stepNumber
              )}
            </div>

            {/* Connector Line (except last) */}
            {stepNumber < totalSteps && (
              <div
                className={`
                  w-12 h-1 mx-2 rounded
                  ${stepNumber < currentStep
                    ? 'bg-green-500'
                    : 'bg-gray-200 dark:bg-gray-700'
                  }
                `}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

/**
 * 스텝별 설명 텍스트
 */
const STEP_DESCRIPTIONS = {
  1: {
    title: 'AI 코치를 위한 참고자료를 업로드하세요!',
    description: '업로드한 문서를 기반으로 AI가 글쓰기를 도와드립니다.',
    hint: 'PDF, DOCX, TXT, MD 파일을 지원합니다.'
  },
  2: {
    title: '문서를 분석하고 있어요...',
    description: 'AI가 문서의 스타일과 패턴을 학습하고 있습니다.',
    hint: '잠시만 기다려주세요. 곧 준비됩니다!'
  },
  3: {
    title: '준비 완료!',
    description: '이제 AI 코치가 문서 스타일을 참고하여 도움을 드릴 수 있습니다.',
    hint: '에디터에서 글을 작성해보세요.'
  }
} as const

// =============================================================================
// Main Component
// =============================================================================

/**
 * 온보딩 가이드 컴포넌트
 *
 * @description
 * 새 프로젝트에서 문서가 없을 때 사용자를 안내하는 온보딩 UI입니다.
 * 단계별로 다른 메시지와 액션을 표시합니다.
 *
 * @example
 * ```tsx
 * <OnboardingGuide step={1} onUploadSuccess={refreshDocuments} />
 * ```
 */
export default function OnboardingGuide({
  step = 1,
  onUploadSuccess,
  className = ''
}: OnboardingGuideProps) {
  const stepInfo = STEP_DESCRIPTIONS[step]

  return (
    <div
      className={`
        flex flex-col items-center justify-center h-full p-8
        bg-gradient-to-br from-indigo-50 via-white to-purple-50
        dark:from-gray-900 dark:via-gray-800 dark:to-indigo-950
        ${className}
      `}
    >
      {/* ---------------------------------------------------------------------------
          Header Section - 아이콘 및 타이틀
          --------------------------------------------------------------------------- */}
      <div className="text-center max-w-lg">
        {/* Icon */}
        <div className="mb-4">
          {step === 1 && (
            <span className="text-6xl" role="img" aria-label="upload">
              📄
            </span>
          )}
          {step === 2 && (
            <div className="relative inline-block">
              <span className="text-6xl animate-pulse" role="img" aria-label="processing">
                🔄
              </span>
            </div>
          )}
          {step === 3 && (
            <span className="text-6xl" role="img" aria-label="ready">
              🎉
            </span>
          )}
        </div>

        {/* Title */}
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          {stepInfo.title}
        </h2>

        {/* Step Indicator */}
        <StepIndicator currentStep={step} totalSteps={3} />

        {/* Description */}
        <p className="text-gray-600 dark:text-gray-300 mb-2">
          {stepInfo.description}
        </p>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-8">
          {stepInfo.hint}
        </p>
      </div>

      {/* ---------------------------------------------------------------------------
          Action Section - 스텝별 다른 액션
          --------------------------------------------------------------------------- */}
      {step === 1 && (
        <div className="w-full max-w-md">
          {/* Document Uploader 통합 */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg border border-gray-200 dark:border-gray-700">
            <DocumentUploader
              onUploadSuccess={onUploadSuccess}
              className="w-full"
            />
          </div>

          {/* 추가 힌트 */}
          <div className="mt-6 text-center">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              💡 <strong>팁:</strong> 여러분의 글쓰기 스타일이 담긴 문서를 업로드하면,
              AI가 해당 스타일을 학습하여 더 나은 피드백을 제공합니다.
            </p>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="flex flex-col items-center">
          {/* Loading Spinner */}
          <div className="relative w-16 h-16 mb-4">
            <div className="absolute inset-0 border-4 border-indigo-200 dark:border-indigo-800 rounded-full" />
            <div className="absolute inset-0 border-4 border-transparent border-t-indigo-600 rounded-full animate-spin" />
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            문서 분석 중...
          </p>
        </div>
      )}

      {step === 3 && (
        <div className="text-center">
          <button
            type="button"
            className="
              px-6 py-3 bg-indigo-600 hover:bg-indigo-700
              text-white font-medium rounded-lg
              transition-colors shadow-lg hover:shadow-xl
              focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2
            "
            onClick={() => {
              // 에디터로 이동 또는 다음 동작
              console.log('[OnboardingGuide] Ready to start!')
            }}
          >
            글쓰기 시작하기
          </button>
        </div>
      )}

      {/* ---------------------------------------------------------------------------
          Footer - 도움말 링크
          --------------------------------------------------------------------------- */}
      <div className="mt-12 text-center">
        <p className="text-xs text-gray-400 dark:text-gray-500">
          문서 업로드에 문제가 있나요?{' '}
          <button
            type="button"
            className="text-indigo-600 dark:text-indigo-400 hover:underline"
            onClick={() => {
              // 도움말 모달 또는 링크
              console.log('[OnboardingGuide] Help requested')
            }}
          >
            도움말 보기
          </button>
        </p>
      </div>
    </div>
  )
}
