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
// Helper: Legacy Adapter for Backward Compatibility
// =============================================================================

interface LegacyEvaluationResult {
  evaluations: Array<{
    rubric_item: string
    status: 'pass' | 'fail' | 'partial'
    recommendations: string
    evidence_quotes: string[]
    score: number
  }>
  overall_score: number
}

function adaptLegacyToV5(legacy: LegacyEvaluationResult): V5EvaluationResult {
  return {
    document_id: 'legacy-adapter',
    template_id: 'default',
    evaluated_at: new Date().toISOString(),
    overall_score: legacy.overall_score,
    judgments: legacy.evaluations.map(e => ({
      criteria_id: e.rubric_item,
      status: e.status,
      reasoning: e.recommendations, // Legacy recommendation as reasoning
      citation: e.evidence_quotes?.[0] || ''
    })),
    upgrade_plans: legacy.evaluations
      .filter(e => e.status !== 'pass')
      .map(e => ({
        criteria_id: e.rubric_item,
        what: '개선이 필요한 항목입니다',
        why: 'AI 분석 결과 기준에 미치지 못했습니다.',
        how: e.recommendations, // Use legacy recommendation as 'how'
        example: ''
      }))
  }
}

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

      // [V5 Integration] v3Result 우선 사용
      if (data.success && data.v3Result) {
        setResult(data.v3Result)
      } else if (data.success && data.result) {
        // [Risk Mitigation] Legacy Adapter (Backend Rollback 대응)
        console.warn('[EvaluationTab] v3Result missing, adapting legacy result')
        const adapted = adaptLegacyToV5(data.result)
        setResult(adapted)
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
  const showInitialState = !result && !isLoading

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-900">
      {/* -----------------------------------------------------------------------
          헤더 및 평가 버튼 (초기 상태에서만 표시)
          ----------------------------------------------------------------------- */}
      {showInitialState && (
        <div className="p-4 pb-0">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              글 평가
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              AI가 루브릭 기준으로 글을 분석하고 피드백을 제공합니다.
            </p>

            <button
              onClick={handleEvaluate}
              className="w-full px-4 py-3 bg-prism-primary hover:bg-prism-primary/90 
                      text-white font-medium rounded-lg 
                      transition-colors flex items-center justify-center gap-2 shadow-sm"
              aria-label="지금 평가하기"
            >
              📊 평가하기
            </button>
          </div>
        </div>
      )}

      {/* -----------------------------------------------------------------------
          에러 메시지
          ----------------------------------------------------------------------- */}
      {error && (
        <div className="m-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-sm text-red-700 dark:text-red-400">❌ {error}</p>
        </div>
      )}

      {/* -----------------------------------------------------------------------
          v5 피드백 패널 (결과 또는 로딩 중일 때 표시)
          ----------------------------------------------------------------------- */}
      {(result || isLoading) && (
        <div className="flex-1 overflow-hidden">
          <FeedbackPanel 
            evaluation={result}
            isLoading={isLoading}
            onEvaluate={handleEvaluate}
          />
        </div>
      )}

      {/* -----------------------------------------------------------------------
          안내 정보 (초기 상태에서만 표시)
          ----------------------------------------------------------------------- */}
      {showInitialState && (
        <div className="mx-4 mt-auto mb-4 p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-xs text-gray-500 dark:text-gray-400 shadow-sm">
          <p>💡 평가는 업로드된 문서를 근거로 수행됩니다.</p>
          <p className="mt-1">문서를 먼저 업로드하면 더 정확한 피드백을 받을 수 있습니다.</p>
        </div>
      )}
    </div>
  )
}
