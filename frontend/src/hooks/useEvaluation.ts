// =============================================================================
// PRISM Writer - useEvaluation Hook
// =============================================================================
// 파일: frontend/src/hooks/useEvaluation.ts
// 역할: 평가 비즈니스 로직 분리 (API 호출, 상태 관리, 에러 처리)
// 리팩토링: 2026-01-20
// =============================================================================

import { useState, useCallback, useEffect } from 'react'
import type { EvaluationResult as V5EvaluationResult, HolisticEvaluationResult } from '@/lib/judge/types'
import { getApiHeaders } from '@/lib/api/utils'
import { useEditorState } from '@/hooks/useEditorState'
import { useProject } from '@/contexts/ProjectContext'

// =============================================================================
// Types
// =============================================================================

export interface SavedEvaluation {
  id: string
  document_id?: string
  result_data: V5EvaluationResult
  overall_score: number
  created_at: string
}

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

export interface UseEvaluationReturn {
  // 상태
  isLoading: boolean
  isHolisticLoading: boolean
  isLoadingHistory: boolean
  result: V5EvaluationResult | null
  holisticResult: HolisticEvaluationResult | null
  error: string | null
  isSaved: boolean
  savedEvaluations: SavedEvaluation[]
  activeEvalTab: 'holistic' | 'detailed'

  // 액션
  setActiveEvalTab: (tab: 'holistic' | 'detailed') => void
  handleEvaluate: () => Promise<void>
  handleHolisticEvaluate: () => Promise<void>
  handleApplyPlan: (plan: any) => Promise<void>
  handleRetryPlan: (criteriaId: string) => Promise<any>
  handleReevaluate: (criteriaId: string, options?: { quality?: 'standard' | 'high_quality' }) => Promise<any>
  handleLoadEvaluation: (evaluation: SavedEvaluation) => void
  handleDeleteEvaluation: (evaluationId: string) => Promise<void>
}

// =============================================================================
// Helper: Legacy Adapter
// =============================================================================

function adaptLegacyToV5(legacy: LegacyEvaluationResult): V5EvaluationResult {
  return {
    document_id: 'legacy-adapter',
    template_id: 'default',
    evaluated_at: new Date().toISOString(),
    overall_score: legacy.overall_score,
    judgments: legacy.evaluations.map(e => ({
      criteria_id: e.rubric_item,
      status: e.status,
      reasoning: e.recommendations,
      citation: e.evidence_quotes?.[0] || ''
    })),
    upgrade_plans: legacy.evaluations
      .filter(e => e.status !== 'pass')
      .map(e => ({
        criteria_id: e.rubric_item,
        what: '개선이 필요한 항목입니다',
        why: 'AI 분석 결과 기준에 미치지 못했습니다.',
        how: e.recommendations,
        example: ''
      }))
  }
}

// =============================================================================
// Hook
// =============================================================================

export function useEvaluation(): UseEvaluationReturn {
  // ---------------------------------------------------------------------------
  // 상태
  // ---------------------------------------------------------------------------
  const [isLoading, setIsLoading] = useState(false)
  const [isHolisticLoading, setIsHolisticLoading] = useState(false)
  const [isLoadingHistory, setIsLoadingHistory] = useState(true)
  const [result, setResult] = useState<V5EvaluationResult | null>(null)
  const [holisticResult, setHolisticResult] = useState<HolisticEvaluationResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isSaved, setIsSaved] = useState(false)
  const [savedEvaluations, setSavedEvaluations] = useState<SavedEvaluation[]>([])
  const [activeEvalTab, setActiveEvalTab] = useState<'holistic' | 'detailed'>('holistic')

  // Context
  const { content, setContent, documentId } = useEditorState()
  const { currentProject } = useProject()
  const projectId = currentProject?.id ?? null

  // ---------------------------------------------------------------------------
  // Load Saved Evaluations
  // ---------------------------------------------------------------------------
  useEffect(() => {
    let cancelled = false

    const loadEvaluations = async () => {
      if (!projectId) {
        setSavedEvaluations([])
        setResult(null)
        setHolisticResult(null)
        setIsSaved(false)
        setIsLoadingHistory(false)
        return
      }

      try {
        const res = await fetch(`/api/evaluations?projectId=${projectId}&limit=10`)
        if (!res.ok) return

        const data = await res.json()
        if (cancelled) return

        if (data.success && data.evaluations?.length > 0) {
          setSavedEvaluations(data.evaluations)

          const latest = data.evaluations[0]
          if (latest?.result_data) {
            setResult(latest.result_data)
            setHolisticResult(latest.result_data.holistic_result || null)
            setIsSaved(true)
          }
        } else {
          setSavedEvaluations([])
          setResult(null)
          setHolisticResult(null)
          setIsSaved(false)
        }
      } catch (err) {
        console.error('[useEvaluation] Error loading evaluations:', err)
      } finally {
        if (!cancelled) setIsLoadingHistory(false)
      }
    }

    setIsLoadingHistory(true)
    loadEvaluations()

    return () => { cancelled = true }
  }, [projectId])

  // ---------------------------------------------------------------------------
  // Save Evaluation
  // ---------------------------------------------------------------------------
  const saveEvaluation = useCallback(async (
    resultData: V5EvaluationResult,
    documentText: string
  ) => {
    try {
      const res = await fetch('/api/evaluations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          documentId,
          documentText,
          resultData: {
            ...resultData,
            holistic_result: resultData.holistic_result || holisticResult || undefined
          },
          overallScore: resultData.overall_score
        })
      })

      if (res.ok) {
        setIsSaved(true)
        const newEvalRes = await res.json()
        if (newEvalRes.evaluation) {
          setSavedEvaluations(prev => [newEvalRes.evaluation, ...prev])
        }
      }
    } catch (err) {
      console.error('[useEvaluation] Failed to save:', err)
    }
  }, [projectId, documentId, holisticResult])

  // ---------------------------------------------------------------------------
  // Holistic Evaluate
  // ---------------------------------------------------------------------------
  const handleHolisticEvaluate = useCallback(async () => {
    if (!content || content.trim().length < 50) {
      setError('평가할 글이 너무 짧습니다. 최소 50자 이상 입력해주세요.')
      return
    }

    setIsHolisticLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/rag/evaluate-holistic', {
        method: 'POST',
        headers: getApiHeaders(),
        body: JSON.stringify({
          userText: content,
          topK: 5,
          projectId: projectId || null,
        }),
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        setError(data.message || '종합 평가 중 오류가 발생했습니다.')
        return
      }

      setHolisticResult(data.result)

      const resultToSave: V5EvaluationResult = result ? {
        ...result,
        template_id: 'holistic-only',
        judgments: [],
        overall_score: data.result.scoreC.overall || 0
      } : {
        document_id: documentId || 'unknown',
        template_id: 'holistic-only',
        evaluated_at: new Date().toISOString(),
        overall_score: data.result.scoreC.overall || 0,
        judgments: [],
        upgrade_plans: []
      }

      resultToSave.holistic_result = data.result
      await saveEvaluation(resultToSave, content)

      if (!result) setResult(resultToSave)
    } catch (err) {
      console.error('[useEvaluation] Holistic error:', err)
      setError('종합 평가 요청 중 오류가 발생했습니다.')
    } finally {
      setIsHolisticLoading(false)
    }
  }, [content, result, documentId, projectId, saveEvaluation])

  // ---------------------------------------------------------------------------
  // Detailed Evaluate
  // ---------------------------------------------------------------------------
  const handleEvaluate = useCallback(async () => {
    if (!content || content.trim().length < 50) {
      setError('평가할 글이 너무 짧습니다. 최소 50자 이상 입력해주세요.')
      return
    }

    setIsLoading(true)
    setError(null)
    setResult(null)
    setIsSaved(false)

    try {
      const response = await fetch('/api/rag/evaluate', {
        method: 'POST',
        headers: getApiHeaders(),
        body: JSON.stringify({ userText: content, topK: 5 }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.message || '평가 중 오류가 발생했습니다.')
        return
      }

      let evaluationResult: V5EvaluationResult | null = null

      if (data.success && data.v3Result) {
        evaluationResult = data.v3Result
        setResult(data.v3Result)
      } else if (data.success && data.result) {
        const adapted = adaptLegacyToV5(data.result)
        evaluationResult = adapted
        setResult(adapted)
      } else {
        setError(data.message || '평가 결과를 받지 못했습니다.')
      }

      if (evaluationResult) {
        await saveEvaluation(evaluationResult, content)
      }
    } catch (err) {
      console.error('[useEvaluation] Evaluate error:', err)
      setError(`서버 연결 실패: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setIsLoading(false)
    }
  }, [content, saveEvaluation])

  // ---------------------------------------------------------------------------
  // Apply Plan
  // ---------------------------------------------------------------------------
  const handleApplyPlan = useCallback(async (plan: any) => {
    if (!content) return

    try {
      const response = await fetch('/api/rag/change-plan', {
        method: 'POST',
        headers: getApiHeaders(),
        body: JSON.stringify({
          userText: content,
          documentId: result?.document_id || 'unknown',
          targetCriteriaId: plan.criteria_id,
          maxPatches: 1
        }),
      })

      const data = await response.json()

      if (!response.ok || !data.success || !data.changePlan?.patches?.length) {
        throw new Error(data.message || '수정 패치를 생성할 수 없습니다.')
      }

      const patch = data.changePlan.patches[0]
      const start = patch.targetRange.start
      const end = patch.targetRange.end
      const newContent = content.substring(0, start) + patch.after + content.substring(end)

      setContent(newContent)
    } catch (err) {
      console.error('[useEvaluation] Apply Error:', err)
      alert(`적용 실패: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
  }, [content, result, setContent])

  // ---------------------------------------------------------------------------
  // Retry Plan
  // ---------------------------------------------------------------------------
  const handleRetryPlan = useCallback(async (criteriaId: string) => {
    if (!content) return null

    try {
      const response = await fetch('/api/rag/change-plan', {
        method: 'POST',
        headers: getApiHeaders(),
        body: JSON.stringify({
          userText: content,
          documentId: result?.document_id || 'unknown',
          targetCriteriaId: criteriaId,
          maxPatches: 1
        }),
      })

      const data = await response.json()

      if (!response.ok || !data.success) return null

      if (data.changePlan?.upgradePlan) {
        return data.changePlan.upgradePlan
      }

      return {
        criteria_id: criteriaId,
        what: '수정 계획이 생성되었습니다.',
        why: '재시도 요청에 의해 생성됨',
        how: data.changePlan?.patches?.[0]?.after || '잠시 후 다시 시도해주세요.',
        example: ''
      }
    } catch (err) {
      console.error('[useEvaluation] Retry Error:', err)
      return null
    }
  }, [content, result])

  // ---------------------------------------------------------------------------
  // Reevaluate Single
  // ---------------------------------------------------------------------------
  const handleReevaluate = useCallback(async (
    criteriaId: string,
    options?: { quality?: 'standard' | 'high_quality' }
  ) => {
    if (!content || !result || !projectId) return null

    try {
      const response = await fetch('/api/rag/evaluate-single', {
        method: 'POST',
        headers: getApiHeaders(),
        body: JSON.stringify({
          userText: content,
          documentId: result.document_id || 'unknown',
          criteriaId,
          qualityLevel: options?.quality || 'standard',
          topK: 5,
          projectId,
        }),
      })

      const data = await response.json()
      if (!response.ok || !data.success) return null

      const newJudgments = result.judgments.map(j =>
        j.criteria_id === criteriaId ? data.judgment : j
      )

      let newUpgradePlans = result.upgrade_plans.filter(p => p.criteria_id !== criteriaId)
      if (data.upgradePlan && data.judgment?.status !== 'pass') {
        newUpgradePlans = [...newUpgradePlans, data.upgradePlan]
      }

      const passCount = newJudgments.filter(j => j.status === 'pass').length
      const partialCount = newJudgments.filter(j => j.status === 'partial').length
      const totalCount = newJudgments.length
      const newScore = Math.round(((passCount * 1.0 + partialCount * 0.5) / totalCount) * 100)

      const updatedResult: V5EvaluationResult = {
        ...result,
        judgments: newJudgments,
        upgrade_plans: newUpgradePlans,
        overall_score: newScore
      }

      setResult(updatedResult)

      try {
        await saveEvaluation(updatedResult, content)
      } catch (saveErr) {
        console.error('[useEvaluation] DB save failed:', saveErr)
      }

      return { judgment: data.judgment, upgradePlan: data.upgradePlan }
    } catch (err) {
      console.error('[useEvaluation] Reevaluate Error:', err)
      return null
    }
  }, [content, result, projectId, saveEvaluation])

  // ---------------------------------------------------------------------------
  // Load Evaluation
  // ---------------------------------------------------------------------------
  const handleLoadEvaluation = useCallback((evaluation: SavedEvaluation) => {
    if (evaluation.result_data) {
      setResult(evaluation.result_data)
      setHolisticResult(evaluation.result_data.holistic_result || null)
      setIsSaved(true)

      const isHolistic = evaluation.result_data.template_id === 'holistic-only' ||
        (!evaluation.result_data.judgments || evaluation.result_data.judgments.length === 0)

      setActiveEvalTab(isHolistic ? 'holistic' : 'detailed')
    }
  }, [])

  // ---------------------------------------------------------------------------
  // Delete Evaluation
  // ---------------------------------------------------------------------------
  const handleDeleteEvaluation = useCallback(async (evaluationId: string) => {
    const confirmed = window.confirm('이 평가를 삭제하시겠습니까?')
    if (!confirmed) return

    try {
      const res = await fetch(`/api/evaluations?id=${evaluationId}`, {
        method: 'DELETE'
      })

      if (res.ok) {
        setSavedEvaluations(prev => {
          const updated = prev.filter(e => e.id !== evaluationId)

          if (prev[0]?.id === evaluationId) {
            if (updated.length > 0 && updated[0].result_data) {
              setResult(updated[0].result_data)
            } else {
              setResult(null)
              setIsSaved(false)
            }
          }

          return updated
        })
      } else {
        alert('평가 삭제에 실패했습니다.')
      }
    } catch (err) {
      console.error('[useEvaluation] Delete error:', err)
      alert('평가 삭제 중 오류가 발생했습니다.')
    }
  }, [savedEvaluations])

  return {
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
  }
}
