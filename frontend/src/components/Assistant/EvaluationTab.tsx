// =============================================================================
// PRISM Writer - Evaluation Tab
// =============================================================================
// 파일: frontend/src/components/Assistant/EvaluationTab.tsx
// 역할: 글 평가 기능 탭 - 평가 실행 및 결과 표시 → DB 저장/로드
// Update: 2025-12-27 - Phase 7 Persistence
// =============================================================================

'use client'

import { useState, useCallback, useEffect } from 'react'
import FeedbackPanel from '@/components/Editor/FeedbackPanel'
import HolisticFeedbackPanel from '@/components/Editor/HolisticFeedbackPanel'
import type { EvaluationResult as V5EvaluationResult, HolisticEvaluationResult } from '@/lib/judge/types'
import { getApiHeaders } from '@/lib/api/utils'
import { useEditorState } from '@/hooks/useEditorState'
import type { UpgradePlan } from '@/lib/judge/types'
import type { ChangePlan, Patch } from '@/lib/rag/types/patch'
import { clsx } from 'clsx'


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
// Types
// =============================================================================
interface SavedEvaluation {
  id: string
  document_id?: string  // Phase 15: 문서 ID 연결
  result_data: V5EvaluationResult
  overall_score: number
  created_at: string
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
  const [isSaved, setIsSaved] = useState(false)
  const [savedEvaluations, setSavedEvaluations] = useState<SavedEvaluation[]>([])
  const [isLoadingHistory, setIsLoadingHistory] = useState(true)
  
  // ===========================================================================
  // [P2-06] 종합 평가 상태 추가
  // ===========================================================================
  const [holisticResult, setHolisticResult] = useState<HolisticEvaluationResult | null>(null)
  const [isHolisticLoading, setIsHolisticLoading] = useState(false)
  const [activeEvalTab, setActiveEvalTab] = useState<'holistic' | 'detailed'>('holistic')
  
  // [FIX] useEditorState 훅으로 에디터 내용 직접 가져오기
  // Phase 15: documentId 추가
  // [P1-03] 카테고리 격리: category 추가
  const { content, setContent, documentId, category } = useEditorState()

  // ---------------------------------------------------------------------------
  // Load Saved Evaluations on Mount or Document Change
  // ---------------------------------------------------------------------------
  // Phase 15: documentId별로 평가 로드 + Race Condition 방지
  useEffect(() => {
    let cancelled = false
    
    const loadEvaluations = async () => {
      try {
        // Phase 15: documentId가 있으면 해당 문서의 평가만 조회
        const url = documentId 
          ? `/api/evaluations?documentId=${documentId}&limit=10`
          : '/api/evaluations?limit=5'
        
        const res = await fetch(url)
        if (!res.ok) {
          console.warn('[EvaluationTab] Failed to load evaluations')
          return
        }
        const data = await res.json()
        
        // Race Condition 방지: 취소된 요청은 무시
        if (cancelled) return
        
        if (data.success && data.evaluations?.length > 0) {
          setSavedEvaluations(data.evaluations)
          // 가장 최근 평가 결과를 자동 로드
          const latest = data.evaluations[0]
          if (latest.result_data) {
            setResult(latest.result_data)
            
            // [P4] Holistic Result 복원
            if (latest.result_data.holistic_result) {
              setHolisticResult(latest.result_data.holistic_result)
            } else {
              setHolisticResult(null)
            }
            
            setIsSaved(true)
          }
        } else {
          // Phase 15: 평가 없으면 빈 상태로 초기화
          setSavedEvaluations([])
          setResult(null)
          setHolisticResult(null)
          setIsSaved(false)
        }
      } catch (err) {
        console.error('[EvaluationTab] Error loading evaluations:', err)
      } finally {
        if (!cancelled) {
          setIsLoadingHistory(false)
        }
      }
    }
    
    setIsLoadingHistory(true)
    loadEvaluations()
    
    // Cleanup: 문서 전환 시 이전 요청 취소
    return () => {
      cancelled = true
    }
  }, [documentId])

  // ---------------------------------------------------------------------------
  // Save Evaluation to DB
  // ---------------------------------------------------------------------------
  // Phase 15: documentId 포함하여 저장
  const saveEvaluation = async (resultData: V5EvaluationResult, documentText: string) => {
    try {
      const res = await fetch('/api/evaluations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId,  // Phase 15: 문서 ID 연결
          documentText,
          resultData: {
            ...resultData,
            // [P4] Holistic Result 병합 (이미 resultData에 있으면 유지, 없으면 현재 state 사용)
            holistic_result: resultData.holistic_result || holisticResult || undefined
          },
          overallScore: resultData.overall_score
        })
      })
      if (res.ok) {
        setIsSaved(true)
        console.log(`[EvaluationTab] Evaluation saved for document: ${documentId || 'none'}`)
        
        // Phase 15: 저장 후 히스토리 새로고침
        const newEvalRes = await res.json()
        if (newEvalRes.evaluation) {
          setSavedEvaluations(prev => [newEvalRes.evaluation, ...prev])
        }
      }
    } catch (err) {
      console.error('[EvaluationTab] Failed to save evaluation:', err)
    }
  }

  // ---------------------------------------------------------------------------
  // Delete Evaluation Handler (Phase 15)
  // ---------------------------------------------------------------------------
  const handleDeleteEvaluation = async (evaluationId: string) => {
    const confirmed = window.confirm('이 평가를 삭제하시겠습니까?')
    if (!confirmed) return
    
    try {
      const res = await fetch(`/api/evaluations?id=${evaluationId}`, {
        method: 'DELETE'
      })
      
      if (res.ok) {
        // 목록에서 제거
        setSavedEvaluations(prev => prev.filter(e => e.id !== evaluationId))
        console.log(`[EvaluationTab] Evaluation deleted: ${evaluationId}`)
        
        // 현재 표시 중인 평가가 삭제된 것이면 초기화
        // (첫 번째 평가가 삭제된 경우)
        if (savedEvaluations[0]?.id === evaluationId) {
          const remaining = savedEvaluations.filter(e => e.id !== evaluationId)
          if (remaining.length > 0 && remaining[0].result_data) {
            setResult(remaining[0].result_data)
          } else {
            setResult(null)
            setIsSaved(false)
          }
        }
      } else {
        alert('평가 삭제에 실패했습니다.')
      }
    } catch (err) {
      console.error('[EvaluationTab] Failed to delete evaluation:', err)
      alert('평가 삭제 중 오류가 발생했습니다.')
    }
  }

  // ===========================================================================
  // [P2-06] 종합 평가 실행 핸들러
  // ===========================================================================
  const handleHolisticEvaluate = useCallback(async () => {
    const textToEvaluate = content

    if (!textToEvaluate || textToEvaluate.trim().length < 50) {
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
          userText: textToEvaluate,
          category: category || '미분류',
          topK: 5,
        }),
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        console.error('[EvaluationTab] Holistic evaluation error:', data)
        setError(data.message || '종합 평가 중 오류가 발생했습니다.')
        return
      }

      setHolisticResult(data.result)
      console.log('[EvaluationTab] Holistic evaluation complete:', data.result?.scoreC?.overall)
      
      // [P4] 평가 결과 자동 저장
      const resultToSave: V5EvaluationResult = result ? { ...result } : {
        document_id: documentId || 'unknown',
        template_id: 'holistic-only',
        evaluated_at: new Date().toISOString(),
        overall_score: data.result.scoreC.overall || 0,
        judgments: [],
        upgrade_plans: []
      }
      
      // holistic_result 추가
      resultToSave.holistic_result = data.result
      
      // 저장 실행
      await saveEvaluation(resultToSave, textToEvaluate)
      
      // 상세 평가 결과가 없었다면 result 상태도 업데이트 (저장된 것과 동기화)
      if (!result) {
        setResult(resultToSave)
      }
      
    } catch (err) {
      console.error('[EvaluationTab] Holistic evaluation error:', err)
      setError('종합 평가 요청 중 오류가 발생했습니다.')
    } finally {
      setIsHolisticLoading(false)
    }
  }, [content, category, result, documentId, saveEvaluation, holisticResult])

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
    setIsSaved(false)

    try {
      // =========================================================================
      // [P1-04] 카테고리 격리: 현재 문서의 카테고리를 평가 API에 전달
      // 목적: 동일 카테고리의 참고자료만 사용하여 평가
      // =========================================================================
      const response = await fetch('/api/rag/evaluate', {
        method: 'POST',
        headers: getApiHeaders(),
        body: JSON.stringify({
          userText: textToEvaluate,
          topK: 5,
          category: category || null,  // [P1-04] 카테고리 격리 적용
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
      let evaluationResult: V5EvaluationResult | null = null
      
      if (data.success && data.v3Result) {
        evaluationResult = data.v3Result
        setResult(data.v3Result)
      } else if (data.success && data.result) {
        // [Risk Mitigation] Legacy Adapter (Backend Rollback 대응)
        console.warn('[EvaluationTab] v3Result missing, adapting legacy result')
        const adapted = adaptLegacyToV5(data.result)
        evaluationResult = adapted
        setResult(adapted)
      } else {
        console.error('[EvaluationTab] Invalid result structure:', data)
        setError(data.message || '평가 결과를 받지 못했습니다.')
      }

      // [Phase 7] 평가 완료 후 자동 저장
      if (evaluationResult) {
        await saveEvaluation(evaluationResult, textToEvaluate)
      }
      
    } catch (err) {
      console.error('[EvaluationTab] Unexpected error:', err)
      setError(`서버 연결 실패: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setIsLoading(false)
    }
  }, [content])

  // ---------------------------------------------------------------------------
  // [NEW] 자동 수정 적용 핸들러
  // ---------------------------------------------------------------------------
  const handleApplyPlan = useCallback(async (plan: any) => {
    // Type assertion to bypass strict UpgradePlan check for now if types mismatch
    const upgradePlan = plan
    const textToEvaluate = content

    if (!textToEvaluate) return

    // 1. Loading State (local button state will handle this, but global overlay optional)
    
    try {
      // 2. Call Change Plan API
      const response = await fetch('/api/rag/change-plan', {
        method: 'POST',
        headers: getApiHeaders(),
        body: JSON.stringify({
          userText: textToEvaluate,
          documentId: result?.document_id || 'unknown',
          targetCriteriaId: upgradePlan.criteria_id,
          maxPatches: 1
        }),
      })

      const data = await response.json()

      if (!response.ok || !data.success || !data.changePlan?.patches?.length) {
        throw new Error(data.message || '수정 패치를 생성할 수 없습니다.')
      }

      // 3. Apply Patch
      const patch = data.changePlan.patches[0]
      
      const start = patch.targetRange.start
      const end = patch.targetRange.end
      
      const newContent = content.substring(0, start) + patch.after + content.substring(end)
      
      // Update Editor
      setContent(newContent)

    } catch (err) {
      console.error('[EvaluationTab] Apply Error:', err)
      alert(`적용 실패: ${err instanceof Error ? err.message : 'Unknown error'}`) // Temporary alert
    }
  }, [content, result, setContent])

  // ---------------------------------------------------------------------------
  // Load Saved Evaluation Handler
  // ---------------------------------------------------------------------------
  const handleLoadEvaluation = (evaluation: SavedEvaluation) => {
    if (evaluation.result_data) {
      setResult(evaluation.result_data)
      // [P4] Holistic Result 복원
      if (evaluation.result_data.holistic_result) {
        setHolisticResult(evaluation.result_data.holistic_result)
      } else {
        setHolisticResult(null)
      }
      setIsSaved(true)
    }
  }

  // ---------------------------------------------------------------------------
  // [NEW] Upgrade Plan 재생성 핸들러
  // ---------------------------------------------------------------------------
  const handleRetryPlan = useCallback(async (criteriaId: string) => {
    const textToEvaluate = content
    
    if (!textToEvaluate) return null
    
    try {
      console.log(`[EvaluationTab] Retrying upgrade plan for criteria: ${criteriaId}`)
      
      const response = await fetch('/api/rag/change-plan', {
        method: 'POST',
        headers: getApiHeaders(),
        body: JSON.stringify({
          userText: textToEvaluate,
          documentId: result?.document_id || 'unknown',
          targetCriteriaId: criteriaId,
          maxPatches: 1
        }),
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        console.error('[EvaluationTab] Retry failed:', data)
        return null
      }

      // 성공적으로 생성된 UpgradePlan 반환
      if (data.changePlan?.upgradePlan) {
        return data.changePlan.upgradePlan
      }
      
      // 대체: 기본 구조로 반환
      return {
        criteria_id: criteriaId,
        what: '수정 계획이 생성되었습니다.',
        why: '재시도 요청에 의해 생성됨',
        how: data.changePlan?.patches?.[0]?.after || '잠시 후 다시 시도해주세요.',
        example: ''
      }
      
    } catch (err) {
      console.error('[EvaluationTab] Retry Error:', err)
      return null
    }
  }, [content, result])

  // ---------------------------------------------------------------------------
  // [Phase 8-C/D] 개별 항목 재평가 핸들러
  // Phase 8-D: result 상태 업데이트 + DB 저장 추가
  // ---------------------------------------------------------------------------
  const handleReevaluate = useCallback(async (criteriaId: string, options?: { quality?: 'standard' | 'high_quality' }) => {
    const textToEvaluate = content
    
    if (!textToEvaluate) return null
    
    // Phase 8-D: result null 체크 (최초 평가 전 재평가 방지)
    if (!result) {
      console.warn('[EvaluationTab] 재평가 불가: 기존 평가 결과 없음')
      return null
    }
    
    try {
      console.log(`[EvaluationTab] 개별 재평가 시작: ${criteriaId}`)
      
      const response = await fetch('/api/rag/evaluate-single', {
        method: 'POST',
        headers: getApiHeaders(),
        body: JSON.stringify({
          userText: textToEvaluate,
          documentId: result?.document_id || 'unknown', // Use result?.document_id as currentDoc is not defined
          criteriaId,
          qualityLevel: options?.quality || 'standard', // P10-02: Pass quality param
          topK: 5
        }),
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        console.error('[EvaluationTab] 재평가 실패:', data)
        return null
      }

      console.log(`[EvaluationTab] 재평가 성공: ${data.judgment?.status}`)
      
      // -----------------------------------------------------------------------
      // Phase 8-D: result 상태 업데이트 (React setState 비동기 문제 해결)
      // 새 객체를 변수에 저장 후 setResult와 saveEvaluation에 동일 객체 전달
      // -----------------------------------------------------------------------
      
      // 1. judgments 배열에서 해당 criteriaId 항목 교체
      const newJudgments = result.judgments.map(j => 
        j.criteria_id === criteriaId ? data.judgment : j
      )
      
      // 2. upgrade_plans 배열 업데이트 (PASS면 제거, 아니면 추가/교체)
      let newUpgradePlans = result.upgrade_plans.filter(p => p.criteria_id !== criteriaId)
      if (data.upgradePlan && data.judgment?.status !== 'pass') {
        newUpgradePlans = [...newUpgradePlans, data.upgradePlan]
      }
      
      // 3. overall_score 재계산 (백엔드와 동일 수식)
      const passCount = newJudgments.filter(j => j.status === 'pass').length
      const partialCount = newJudgments.filter(j => j.status === 'partial').length
      const totalCount = newJudgments.length
      const newScore = Math.round(((passCount * 1.0 + partialCount * 0.5) / totalCount) * 100)
      
      // 4. 새 result 객체 생성 (불변성 유지)
      const updatedResult: V5EvaluationResult = {
        ...result,
        judgments: newJudgments,
        upgrade_plans: newUpgradePlans,
        overall_score: newScore
      }
      
      // 5. React 상태 업데이트
      setResult(updatedResult)
      
      // 6. DB 저장 (새 객체 전달 - setState 비동기 문제 해결)
      try {
        await saveEvaluation(updatedResult, textToEvaluate)
        console.log('[EvaluationTab] 재평가 결과 DB 저장 완료')
      } catch (saveErr) {
        console.error('[EvaluationTab] DB 저장 실패 (로컬 상태는 유지):', saveErr)
      }
      
      // 7. FeedbackItem의 localJudgment 업데이트용 반환
      return { 
        judgment: data.judgment, 
        upgradePlan: data.upgradePlan 
      }
      
    } catch (err) {
      console.error('[EvaluationTab] Reevaluate Error:', err)
      return null
    }
  }, [content, result, saveEvaluation])

  // ---------------------------------------------------------------------------
  // 렌더링
  // ---------------------------------------------------------------------------
  const showInitialState = !result && !isLoading

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-900">
      {/* -----------------------------------------------------------------------
          헤더 및 평가 버튼 (초기 상태에서만 표시)
          [P2-06] 종합 평가 버튼 추가
          ----------------------------------------------------------------------- */}
      {showInitialState && (
        <div className="p-4 pb-0">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              글 평가
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              AI가 글을 분석하고 종합 피드백을 제공합니다.
            </p>

            {/* [P2-06] 종합 평가 버튼 (메인) */}
            <button
              onClick={handleHolisticEvaluate}
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
              onClick={handleEvaluate}
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
          [P2-06] 종합 평가 결과 (holisticResult 또는 isHolisticLoading)
          ----------------------------------------------------------------------- */}
      {(holisticResult || isHolisticLoading) && !result && (
        <div className="flex-1 overflow-y-auto p-4">
          <HolisticFeedbackPanel 
            result={holisticResult}
            isLoading={isHolisticLoading}
            onRetry={handleHolisticEvaluate}
          />
          
          {/* 기준별 평가로 전환 버튼 */}
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

      {/* -----------------------------------------------------------------------
          v5 피드백 패널 (result 및 holisticResult 둘 다 있으면 탭 표시)
          [P2-06] 탭 시스템 추가
          ----------------------------------------------------------------------- */}
      {(result || isLoading) && (
        <div className="flex-1 overflow-hidden flex flex-col">
          {/* [P2-06] 탭 헤더 (holisticResult도 있으면 표시) */}
          {holisticResult && result && (
            <div className="flex border-b border-gray-200 dark:border-gray-700 mx-4 mt-2">
              <button
                onClick={() => setActiveEvalTab('holistic')}
                className={clsx(
                  'px-4 py-2 text-sm font-medium transition-colors',
                  activeEvalTab === 'holistic'
                    ? 'text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                )}
                aria-label="종합 평가 탭"
              >
                📊 종합 평가
              </button>
              <button
                onClick={() => setActiveEvalTab('detailed')}
                className={clsx(
                  'px-4 py-2 text-sm font-medium transition-colors',
                  activeEvalTab === 'detailed'
                    ? 'text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                )}
                aria-label="기준별 평가 탭"
              >
                📋 기준별 평가
              </button>
            </div>
          )}
          
          {/* 탭 컨텐츠 */}
          <div className="flex-1 overflow-y-auto">
            {/* 종합 평가 탭 */}
            {holisticResult && activeEvalTab === 'holistic' && (
              <div className="p-4">
                <HolisticFeedbackPanel 
                  result={holisticResult}
                  isLoading={false}
                  onRetry={handleHolisticEvaluate}
                />
              </div>
            )}
            
            {/* 기준별 평가 탭 (또는 holisticResult 없으면 바로 표시) */}
            {(activeEvalTab === 'detailed' || !holisticResult) && (
              <>
                {/* [UX Fix] 종합 평가 유도 버튼 (종합 평가 결과가 없을 때) */}
                {!holisticResult && (
                  <div className="mx-4 mt-2 p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg border border-indigo-100 dark:border-indigo-800 flex justify-between items-center">
                    <div className="text-sm text-indigo-700 dark:text-indigo-300">
                      <span className="font-semibold">💡 전체적인 글 평가가 필요하신가요?</span>
                    </div>
                    <button
                      onClick={handleHolisticEvaluate}
                      disabled={isHolisticLoading}
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium rounded transition-colors shadow-sm"
                    >
                      {isHolisticLoading ? '분석 중...' : '📊 종합 평가 실행'}
                    </button>
                  </div>
                )}

                {/* 저장됨 표시 */}
                {isSaved && result && (
                  <div className="mx-4 mt-2 mb-0 px-2 py-1 bg-green-100 dark:bg-green-900/30 rounded text-xs text-green-700 dark:text-green-300 flex items-center gap-1">
                    ✅ 평가 결과 저장됨
                  </div>
                )}
                <FeedbackPanel 
                  evaluation={result}
                  isLoading={isLoading}
                  onEvaluate={handleEvaluate}
                  onApplyPlan={handleApplyPlan}
                  onRetryPlan={handleRetryPlan}
                  onReevaluate={handleReevaluate}
                />
              </>
            )}
          </div>
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

      {/* -----------------------------------------------------------------------
          이전 평가 히스토리 - 저장된 평가가 있으면 항상 표시
          Phase 15: 삭제 버튼 추가
          ----------------------------------------------------------------------- */}
      {!isLoadingHistory && savedEvaluations.length > 0 && (
        <div className="mx-4 mb-4 border-t border-gray-200 dark:border-gray-700 pt-3">
          <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">📁 이전 평가 기록</h4>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {savedEvaluations.slice(0, 5).map((evaluation) => (
              <div
                key={evaluation.id}
                className="flex items-center gap-1 group"
              >
                <button
                  onClick={() => handleLoadEvaluation(evaluation)}
                  className="flex-1 text-left px-2 py-1.5 text-xs rounded hover:bg-gray-100 dark:hover:bg-gray-800 flex justify-between items-center"
                >
                  <span className="truncate">
                    {new Date(evaluation.created_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <span className="text-prism-primary font-medium">
                    {evaluation.overall_score ? `${Math.round(evaluation.overall_score)}점` : '-'}
                  </span>
                </button>
                {/* Phase 15: 삭제 버튼 */}
                <button
                  onClick={() => handleDeleteEvaluation(evaluation.id)}
                  className="p-1 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                  aria-label="평가 삭제"
                  title="평가 삭제"
                >
                  🗑️
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Phase 15: 평가 없음 상태 표시 */}
      {!isLoadingHistory && savedEvaluations.length === 0 && !result && !isLoading && (
        <div className="mx-4 mb-4 p-4 text-center text-sm text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
          <p>📝 이 문서의 평가 기록이 없습니다.</p>
          <p className="mt-1 text-xs">위의 '평가하기' 버튼을 눌러 평가를 시작하세요.</p>
        </div>
      )}
    </div>
  )
}
