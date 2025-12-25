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
import { useEditorState } from '@/hooks/useEditorState'

// =============================================================================
// 타입 정의
// =============================================================================

// (editorContent prop 제거됨 - useEditorState 훅 직접 사용)

// =============================================================================
// Component
// =============================================================================

export default function EvaluationTab() {
  // ---------------------------------------------------------------------------
  // 상태
  // ---------------------------------------------------------------------------
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<EvaluationResultType | null>(null)
  const [error, setError] = useState<string | null>(null)
  
  // [FIX] useEditorState 훅으로 에디터 내용 직접 가져오기
  const { content } = useEditorState()

  // ---------------------------------------------------------------------------
  // 평가 실행 핸들러
  // ---------------------------------------------------------------------------
  const handleEvaluate = useCallback(async () => {
    // [FIX] 훅에서 가져온 content 사용
    const textToEvaluate = content

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
      
      // [디버깅] 전체 응답 로그 출력
      console.log('[EvaluationTab] API Response:', {
        status: response.status,
        ok: response.ok,
        data: data
      })

      if (!response.ok) {
        console.error('[EvaluationTab] API Error:', data)
        setError(data.message || '평가 중 오류가 발생했습니다.')
        return
      }

      if (data.success && data.result) {
        setResult(data.result)
      } else {
        console.error('[EvaluationTab] Invalid result structure:', data)
        setError(data.message || '평가 결과를 받지 못했습니다.')
      }
    } catch (err) {
      console.error('[EvaluationTab] Unexpected error:', err)
      // 에러 객체의 전체 정보 출력
      if (err instanceof Error) {
        console.error('[EvaluationTab] Error details:', {
          name: err.name,
          message: err.message,
          stack: err.stack
        })
      }
      setError(`서버 연결 실패: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setIsLoading(false)
    }
  }, [content])

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
