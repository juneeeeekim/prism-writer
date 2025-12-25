// =============================================================================
// PRISM Writer - Evaluation Tab
// =============================================================================
// 파일: frontend/src/components/Assistant/EvaluationTab.tsx
// 역할: 글 평가 기능 탭 - 평가 실행 및 결과 표시
// =============================================================================

'use client'

import { useState, useCallback } from 'react'
import FeedbackPanel from '@/components/Editor/FeedbackPanel'
import type { EvaluationResult as V5EvaluationResult } from '@/lib/judge/types'
import { getApiHeaders } from '@/lib/api/utils'
import { useEditorState } from '@/hooks/useEditorState'

// =============================================================================
// Component
// =============================================================================

export default function EvaluationTab() {
  // ---------------------------------------------------------------------------
  // 상태
  // ---------------------------------------------------------------------------
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<V5EvaluationResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  
  // [FIX] useEditorState 훅으로 에디터 내용 직접 가져오기
  const { content } = useEditorState()

  // ---------------------------------------------------------------------------
  // 평가 실행 핸들러
  // ---------------------------------------------------------------------------
  const handleEvaluate = useCallback(async () => {
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

      // [V5 Integration] v3Result 우선 사용 (없으면 legacy result를 adapter로 변환해야 하지만, 
      // V5 플래그가 켜져있으므로 v3Result가 항상 옴)
      if (data.success && data.v3Result) {
        setResult(data.v3Result)
      } else if (data.success && data.result) {
        // Fallback: Legacy result만 있는 경우 (드문 케이스)
        // 임시로 에러 처리하거나, Legacy UI를 보여줘야 함.
        // 여기서는 v5 데이터가 없다고 알림
        console.warn('[EvaluationTab] v3Result missing, falling back to legacy is not supported by FeedbackPanel')
        setError('상세 평가 데이터를 불러오지 못했습니다.')
      } else {
        console.error('[EvaluationTab] Invalid result structure:', data)
        setError(data.message || '평가 결과를 받지 못했습니다.')
      }
    } catch (err) {
      console.error('[EvaluationTab] Unexpected error:', err)
      setError(`서버 연결 실패: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setIsLoading(false)
    }
  }, [content])

  // ---------------------------------------------------------------------------
  // 렌더링
  // ---------------------------------------------------------------------------
  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-900">
      {/* -----------------------------------------------------------------------
          에러 메시지
          ----------------------------------------------------------------------- */}
      {error && (
        <div className="m-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-sm text-red-700 dark:text-red-400">❌ {error}</p>
        </div>
      )}

      {/* -----------------------------------------------------------------------
          v5 피드백 패널 (UI 위임)
          ----------------------------------------------------------------------- */}
      <div className="flex-1 overflow-hidden">
        <FeedbackPanel 
          evaluation={result}
          isLoading={isLoading}
          onEvaluate={handleEvaluate}
        />
      </div>
    </div>
  )
}
