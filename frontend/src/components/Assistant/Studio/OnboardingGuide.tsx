// =============================================================================
// [Phase 6.2] OnboardingGuide - 새 프로젝트 온보딩 가이드
// =============================================================================
// 파일: frontend/src/components/Assistant/Studio/OnboardingGuide.tsx
// 역할: 문서가 없는 새 프로젝트에 대한 온보딩 UI 제공
// 생성일: 2025-12-31
// 수정일: 2026-01-01 - RAG 파이프라인 완료 대기 로직 추가
// =============================================================================

'use client'

import { useState, useEffect, useCallback } from 'react'
import DocumentUploader from '@/components/documents/DocumentUploader'
// [P6-03] 온보딩 완료 처리
import { useProject } from '@/contexts/ProjectContext'

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

/** 문서 처리 상태 */
type ProcessingStatus = 'idle' | 'uploading' | 'processing' | 'completed' | 'error'

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
 */
export default function OnboardingGuide({
  step = 1,
  onUploadSuccess,
  className = ''
}: OnboardingGuideProps) {
  // ===========================================================================
  // State
  // ===========================================================================
  const { completeSetup } = useProject()
  const [isCompleting, setIsCompleting] = useState(false)
  const [processingStatus, setProcessingStatus] = useState<ProcessingStatus>('idle')
  const [uploadedDocumentId, setUploadedDocumentId] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [currentStep, setCurrentStep] = useState(step)

  // ===========================================================================
  // 문서 처리 상태 폴링
  // ===========================================================================
  const checkProcessingStatus = useCallback(async (documentId: string) => {
    try {
      const response = await fetch(`/api/documents/${documentId}`)
      if (!response.ok) {
        throw new Error('문서 상태를 확인할 수 없습니다.')
      }
      
      const data = await response.json()
      const status = data.status
      
      console.log(`[OnboardingGuide] Document ${documentId} status: ${status}`)
      
      // 상태에 따른 처리
      if (status === 'completed') {
        setProcessingStatus('completed')
        setCurrentStep(3)
        return true // 폴링 종료
      } else if (status === 'error' || status === 'failed') {
        setProcessingStatus('error')
        setErrorMessage(data.error_message || '문서 처리 중 오류가 발생했습니다.')
        return true // 폴링 종료
      } else {
        // pending, parsing, chunking, embedding 등 처리 중 상태
        setProcessingStatus('processing')
        setCurrentStep(2)
        return false // 계속 폴링
      }
    } catch (error) {
      console.error('[OnboardingGuide] Status check error:', error)
      // 에러가 발생해도 폴링 계속 (일시적 네트워크 오류일 수 있음)
      return false
    }
  }, [])

  // ===========================================================================
  // 폴링 Effect
  // ===========================================================================
  useEffect(() => {
    if (!uploadedDocumentId || processingStatus === 'completed' || processingStatus === 'error') {
      return
    }

    let pollingInterval: NodeJS.Timeout | null = null
    let pollCount = 0
    const MAX_POLLS = 60 // 최대 60회 (2분)

    const poll = async () => {
      pollCount++
      const isDone = await checkProcessingStatus(uploadedDocumentId)
      
      if (isDone || pollCount >= MAX_POLLS) {
        if (pollingInterval) {
          clearInterval(pollingInterval)
        }
        
        // isDone이 false인데 pollCount가 MAX_POLLS에 도달한 경우 = 타임아웃
        if (!isDone && pollCount >= MAX_POLLS) {
          setProcessingStatus('error')
          setErrorMessage('문서 처리 시간이 초과되었습니다. 다시 시도해주세요.')
        }
      }
    }

    // 즉시 한 번 체크
    poll()
    
    // 2초마다 폴링
    pollingInterval = setInterval(poll, 2000)

    return () => {
      if (pollingInterval) {
        clearInterval(pollingInterval)
      }
    }
  }, [uploadedDocumentId, processingStatus, checkProcessingStatus])

  // ===========================================================================
  // Handlers
  // ===========================================================================

  /**
   * 문서 업로드 성공 시 호출
   */
  const handleUploadSuccess = (documentId?: string) => {
    console.log('[OnboardingGuide] Upload success, documentId:', documentId)
    
    if (documentId) {
      setUploadedDocumentId(documentId)
      setProcessingStatus('processing')
      setCurrentStep(2)
    }
    
    onUploadSuccess?.()
  }

  /**
   * 설정 완료 버튼 클릭
   */
  const handleCompleteSetup = async () => {
    try {
      setIsCompleting(true)
      await completeSetup()
      console.log('[OnboardingGuide] Setup completed!')
      
      // [Fix] 페이지 새로고침하여 setup_completed 상태 반영
      // ProjectContext 상태가 업데이트되어도 조건부 렌더링이 제대로 동작하지 않는 경우 대비
      window.location.reload()
    } catch (error) {
      console.error('[OnboardingGuide] Complete setup error:', error)
      alert('설정 완료 처리 중 오류가 발생했습니다.')
    } finally {
      setIsCompleting(false)
    }
  }

  /**
   * 재시도 버튼 클릭
   */
  const handleRetry = () => {
    setProcessingStatus('idle')
    setUploadedDocumentId(null)
    setErrorMessage(null)
    setCurrentStep(1)
  }

  // ===========================================================================
  // Render
  // ===========================================================================
  const stepInfo = STEP_DESCRIPTIONS[currentStep]

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
          {currentStep === 1 && (
            <span className="text-6xl" role="img" aria-label="upload">
              📄
            </span>
          )}
          {currentStep === 2 && (
            <div className="relative inline-block">
              <span className="text-6xl animate-pulse" role="img" aria-label="processing">
                🔄
              </span>
            </div>
          )}
          {currentStep === 3 && (
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
        <StepIndicator currentStep={currentStep} totalSteps={3} />

        {/* Description */}
        <p className="text-gray-600 dark:text-gray-300 mb-2">
          {stepInfo.description}
        </p>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-8">
          {stepInfo.hint}
        </p>
      </div>

      {/* ---------------------------------------------------------------------------
          Step 1: 문서 업로드
          --------------------------------------------------------------------------- */}
      {currentStep === 1 && (
        <div className="w-full max-w-md">
          {/* Document Uploader 통합 */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg border border-gray-200 dark:border-gray-700">
            <DocumentUploader
              onUploadSuccess={handleUploadSuccess}
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

      {/* ---------------------------------------------------------------------------
          Step 2: 문서 처리 중
          --------------------------------------------------------------------------- */}
      {currentStep === 2 && (
        <div className="flex flex-col items-center">
          {/* Loading Spinner */}
          <div className="relative w-16 h-16 mb-4">
            <div className="absolute inset-0 border-4 border-indigo-200 dark:border-indigo-800 rounded-full" />
            <div className="absolute inset-0 border-4 border-transparent border-t-indigo-600 rounded-full animate-spin" />
          </div>
          
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
            문서를 분석하고 임베딩을 생성하고 있습니다...
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500">
            문서 크기에 따라 1~2분 정도 소요될 수 있습니다.
          </p>
        </div>
      )}

      {/* ---------------------------------------------------------------------------
          Step 3: 처리 완료
          --------------------------------------------------------------------------- */}
      {currentStep === 3 && processingStatus === 'completed' && (
        <div className="text-center">
          <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
            <p className="text-green-700 dark:text-green-300 font-medium">
              ✅ 참고자료가 성공적으로 등록되었습니다!
            </p>
            <p className="text-sm text-green-600 dark:text-green-400 mt-1">
              AI가 문서를 학습했습니다. 이제 글쓰기를 시작할 수 있습니다.
            </p>
          </div>

          <button
            type="button"
            onClick={handleCompleteSetup}
            disabled={isCompleting}
            className={`
              px-8 py-3 rounded-lg font-medium text-white
              transition-all duration-200 shadow-lg
              ${isCompleting
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-indigo-600 hover:bg-indigo-700 hover:shadow-xl'
              }
              focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2
            `}
          >
            {isCompleting ? (
              <span className="flex items-center gap-2">
                <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                처리 중...
              </span>
            ) : (
              '🚀 글쓰기 시작하기'
            )}
          </button>
        </div>
      )}

      {/* ---------------------------------------------------------------------------
          Error State
          --------------------------------------------------------------------------- */}
      {processingStatus === 'error' && (
        <div className="text-center">
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
            <p className="text-red-700 dark:text-red-300 font-medium">
              ❌ 문서 처리 중 오류가 발생했습니다
            </p>
            <p className="text-sm text-red-600 dark:text-red-400 mt-1">
              {errorMessage || '알 수 없는 오류가 발생했습니다.'}
            </p>
          </div>

          <button
            type="button"
            onClick={handleRetry}
            className="px-6 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium rounded-lg transition-colors"
          >
            🔄 다시 시도하기
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
