// =============================================================================
// PRISM Writer - Evaluation Tab
// =============================================================================
// 파일: frontend/src/components/Assistant/EvaluationTab.tsx
// 역할: 글 평가 기능 탭 - 평가 실행 및 결과 표시
// =============================================================================

'use client'

import { useState, useCallback } from 'react'
import EvaluationResult from '@/components/Editor/EvaluationResult'
import type { EvaluationResult as EvaluationResultType } from '@/lib/llm/parser'
import { getApiHeaders } from '@/lib/api/utils'

// =============================================================================
// 타입 정의
// =============================================================================

interface EvaluationTabProps {
  /** 평가할 텍스트 (에디터에서 전달받음) */
  editorContent?: string
}

// =============================================================================
// Component
// =============================================================================

export default function EvaluationTab({ editorContent }: EvaluationTabProps) {
  // ---------------------------------------------------------------------------
  // 상태
  // ---------------------------------------------------------------------------
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<EvaluationResultType | null>(null)
  const [error, setError] = useState<string | null>(null)

  // ---------------------------------------------------------------------------
  // 평가 실행 핸들러
  // ---------------------------------------------------------------------------
  const handleEvaluate = useCallback(async () => {
    // 에디터 내용이 없으면 localStorage에서 가져오기 시도
    const textToEvaluate = editorContent || localStorage.getItem('prism-editor-content') || ''

    if (!textToEvaluate || textToEvaluate.trim().length < 50) {
      setError('평가할 글이 너무 짧습니다. 최소 50자 이상 입력해주세요.')
      return
    }

    setIsLoading(true)
    setError(null)
    setResult(null)

    try {
      const response = await fetch('/api/rag/evaluate', {
        method: 'POST',
        headers: getApiHeaders(),
        body: JSON.stringify({
          userText: textToEvaluate,
          topK: 5,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.message || '평가 중 오류가 발생했습니다.')
        return
      }

      if (data.success && data.result) {
        setResult(data.result)
      } else {
        setError(data.message || '평가 결과를 받지 못했습니다.')
      }
    } catch (err) {
      console.error('Evaluation error:', err)
      setError('서버 연결에 실패했습니다.')
    } finally {
      setIsLoading(false)
    }
  }, [editorContent])

  // ---------------------------------------------------------------------------
  // 렌더링
  // ---------------------------------------------------------------------------
  return (
    <div className="flex flex-col h-full p-4">
      {/* -----------------------------------------------------------------------
          헤더 및 평가 버튼
          ----------------------------------------------------------------------- */}
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          글 평가
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          AI가 루브릭 기준으로 글을 분석하고 피드백을 제공합니다.
        </p>

        <button
          onClick={handleEvaluate}
          disabled={isLoading}
          className="w-full px-4 py-3 bg-prism-primary hover:bg-prism-primary/90 
                   disabled:bg-gray-400 text-white font-medium rounded-lg 
                   transition-colors flex items-center justify-center gap-2"
        >
          {isLoading ? (
            <>
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              평가 중...
            </>
          ) : (
            <>
              📊 평가하기
            </>
          )}
        </button>
      </div>

      {/* -----------------------------------------------------------------------
          에러 메시지
          ----------------------------------------------------------------------- */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-sm text-red-700 dark:text-red-400">❌ {error}</p>
        </div>
      )}

      {/* -----------------------------------------------------------------------
          평가 결과
          ----------------------------------------------------------------------- */}
      <div className="flex-1 overflow-y-auto">
        {result ? (
          <EvaluationResult result={result} isLoading={isLoading} />
        ) : !isLoading && !error ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-500 dark:text-gray-400">
            <span className="text-4xl mb-4">📝</span>
            <p className="text-center">
              에디터에 글을 작성한 후<br />
              &ldquo;평가하기&rdquo; 버튼을 클릭하세요
            </p>
          </div>
        ) : null}
      </div>

      {/* -----------------------------------------------------------------------
          안내 정보
          ----------------------------------------------------------------------- */}
      <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg text-xs text-gray-500 dark:text-gray-400">
        <p>💡 평가는 업로드된 문서를 근거로 수행됩니다.</p>
        <p className="mt-1">문서를 먼저 업로드하면 더 정확한 피드백을 받을 수 있습니다.</p>
      </div>
    </div>
  )
}
