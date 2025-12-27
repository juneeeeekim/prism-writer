'use client'

import { useState, memo } from 'react'
import { clsx } from 'clsx'
import { type EvaluationResult, type JudgeResult, type UpgradePlan } from '@/lib/judge/types'
import FeedbackButtons from './FeedbackButtons'

interface FeedbackPanelProps {
  evaluation?: EvaluationResult | null
  isLoading?: boolean
  onEvaluate?: () => void
  onApplyPlan?: (plan: UpgradePlan) => Promise<void>
  onRetryPlan?: (criteriaId: string) => Promise<UpgradePlan | null>
  // Phase 8-B: 개별 항목 재평가 콜백
  // Phase 8-B: 개별 항목 재평가 콜백
  onReevaluate?: (criteriaId: string, options?: { quality?: 'standard' | 'high_quality' }) => Promise<{
    judgment: JudgeResult
    upgradePlan?: UpgradePlan
  } | null>
}

export default function FeedbackPanel({
  evaluation,
  isLoading = false,
  onEvaluate,
  onApplyPlan,
  onRetryPlan,
  onReevaluate,
}: FeedbackPanelProps) {
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mb-4" />
        <p className="text-gray-500 dark:text-gray-400">
          AI가 글을 분석하고 있습니다...
        </p>
        <p className="text-xs text-gray-400 mt-2">
          (Align Judge & Upgrade Planner)
        </p>
      </div>
    )
  }

  if (!evaluation) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <div className="text-6xl mb-4 opacity-50">📝</div>
        <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">
          평가 결과가 없습니다
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 max-w-xs">
          글을 작성한 후 평가를 요청하면<br/>
          구체적인 피드백과 수정 제안을 받을 수 있습니다.
        </p>
        {onEvaluate && (
          <button
            onClick={onEvaluate}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors shadow-sm"
          >
            지금 평가하기
          </button>
        )}
      </div>
    )
  }

  const { judgments, upgrade_plans, overall_score, template_id } = evaluation

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900 border-l border-gray-200 dark:border-gray-700">
      {/* 헤더 */}
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex justify-between items-center sticky top-0 z-10">
        <div>
          <h2 className="font-semibold text-gray-900 dark:text-white">
            피드백 (Feedback)
          </h2>
          <p className="text-xs text-gray-500">
            {new Date(evaluation.evaluated_at).toLocaleTimeString()} 기준
          </p>
        </div>
        <div className="text-right">
          <span className="text-xs text-gray-500 block">종합 점수</span>
          <span className={clsx(
            "text-xl font-bold",
            overall_score >= 80 ? "text-green-600" :
            overall_score >= 50 ? "text-yellow-600" : "text-red-600"
          )}>
            {overall_score}점
          </span>
        </div>
      </div>

      {/* 컨텐츠 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {judgments.map((judge) => {
          const plan = upgrade_plans.find(p => p.criteria_id === judge.criteria_id)
          return (
            <FeedbackItem 
              key={judge.criteria_id} 
              judge={judge} 
              plan={plan} 
              onApplyPlan={onApplyPlan}
              onRetryPlan={onRetryPlan}
              onReevaluate={onReevaluate}
            />
          )
        })}
      </div>

      {/* 하단 액션 */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 space-y-4">
        <FeedbackButtons templateId={template_id} />
        
        {onEvaluate && (
          <button
            onClick={onEvaluate}
            className="w-full py-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg transition-colors text-sm font-medium"
          >
            재평가하기
          </button>
        )}
      </div>
    </div>
  )
}

// =============================================================================
// Individual Feedback Item (Accordion)
// =============================================================================

const FeedbackItem = memo(function FeedbackItem({ 
  judge, 
  plan: initialPlan,
  onApplyPlan,
  onRetryPlan,
  onReevaluate
}: { 
  judge: JudgeResult, 
  plan?: UpgradePlan,
  onApplyPlan?: (plan: UpgradePlan) => Promise<void>,
  onRetryPlan?: (criteriaId: string) => Promise<UpgradePlan | null>,
  onReevaluate?: (criteriaId: string, options?: { quality?: 'standard' | 'high_quality' }) => Promise<{
    judgment: JudgeResult
    upgradePlan?: UpgradePlan
  } | null>
}) {
  // -------------------------------------------------------------------------
  // Phase 8-B: 로컬 상태 관리 (부분 업데이트 지원)
  // -------------------------------------------------------------------------
  const [localJudgment, setLocalJudgment] = useState(judge)
  const [isOpen, setIsOpen] = useState(judge.status !== 'pass')
  const [isApplying, setIsApplying] = useState(false)
  const [isRetrying, setIsRetrying] = useState(false)
  const [isReevaluating, setIsReevaluating] = useState(false)
  const [lastReevaluateTime, setLastReevaluateTime] = useState<number>(0)
  const [plan, setPlan] = useState(initialPlan)

  const handleApply = async () => {
    if (!plan || !onApplyPlan || isApplying) return
    
    setIsApplying(true)
    try {
      await onApplyPlan(plan)
    } finally {
      setIsApplying(false)
    }
  }

  const handleRetry = async () => {
    if (!onRetryPlan || isRetrying) return
    
    setIsRetrying(true)
    try {
      const newPlan = await onRetryPlan(judge.criteria_id)
      if (newPlan) {
        setPlan(newPlan)
      }
    } finally {
      setIsRetrying(false)
    }
  }

  // -------------------------------------------------------------------------
  // Phase 8-B: 개별 항목 재평가 핸들러 (30초 쿨다운 포함)
  // -------------------------------------------------------------------------
  const handleReevaluate = async (quality: 'standard' | 'high_quality' = 'standard') => {
    if (!onReevaluate || isReevaluating) return
    
    // 30초 쿨다운 체크 (standard quality에만 적용)
    if (quality === 'standard') {
      const now = Date.now()
      if (now - lastReevaluateTime < 30000) {
        alert('30초 후에 다시 시도해주세요.')
        return
      }
      setLastReevaluateTime(now)
    }
    
    setIsReevaluating(true)
    
    try {
      const result = await onReevaluate(localJudgment.criteria_id, { quality })
      if (result) {
        setLocalJudgment(result.judgment)
        if (result.upgradePlan) {
          setPlan(result.upgradePlan)
        } else if (result.judgment.status === 'pass') {
          // PASS인 경우 upgradePlan 없음
          setPlan(undefined)
        }
      } else {
        alert('재평가에 실패했습니다. 잠시 후 다시 시도해주세요.')
      }
    } finally {
      setIsReevaluating(false)
    }
  }

  // 오류 상태 감지 (plan.what에 "실패" 또는 "오류" 포함)
  const isPlanError = plan?.what?.includes('실패') || plan?.what?.includes('오류')

  const statusColors = {
    pass: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800',
    fail: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800',
    partial: 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-800',
  }

  const statusIcons = {
    pass: '✅',
    fail: '❌',
    partial: '⚠️',
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
      {/* 요약 헤더 (클릭 시 토글) */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-lg">{statusIcons[localJudgment.status]}</span>
          <span className="font-medium text-gray-900 dark:text-white text-sm line-clamp-1">
            {localJudgment.reasoning}
          </span>
        </div>
        <span className="text-gray-400 text-xs ml-2">
          {isOpen ? '▲' : '▼'}
        </span>
      </button>

      {/* 상세 내용 */}
      {isOpen && (
        <div className="px-4 pb-4 pt-0 border-t border-gray-100 dark:border-gray-700/50">
          {/* 상태 뱃지 */}
          <div className="mt-3 mb-2 flex items-center gap-2">
            <span className={clsx("text-xs px-2 py-1 rounded-full border transition-colors duration-300", statusColors[localJudgment.status])}>
              {localJudgment.status.toUpperCase()}
            </span>
            {/* Phase 8-B: 재평가 버튼 */}
            {onReevaluate && (
              <div className="flex gap-1">
                <button
                  onClick={() => handleReevaluate('standard')}
                  disabled={isReevaluating}
                  className="text-xs bg-blue-100 hover:bg-blue-200 text-blue-700 px-2 py-1 rounded transition-colors flex items-center gap-1"
                  aria-label="이 항목 재평가"
                >
                  {isReevaluating ? (
                    <>
                      <span className="animate-spin text-xs">⏳</span> 재평가 중...
                    </>
                  ) : (
                    <>
                      <span>🔁</span> 재평가
                    </>
                  )}
                </button>
              </div>
            )}
          </div>

          {/* 판정 근거 */}
          <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">
            {localJudgment.reasoning}
          </p>

          {/* 인용구 (문제 문장) */}
          {localJudgment.citation && (
            <div className="mb-3 p-2 bg-gray-50 dark:bg-gray-900 rounded border-l-2 border-gray-300 dark:border-gray-600 text-xs text-gray-500 italic">
              "{localJudgment.citation}"
            </div>
          )}

          {/* 수정 계획 (Upgrade Plan) */}
          {plan && (
            <div className="mt-4 pt-3 border-t border-dashed border-gray-200 dark:border-gray-700">
                <h4 className="text-xs font-bold text-indigo-600 dark:text-indigo-400 mb-2 flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    🚀 Upgrade Plan
                    {/* Badge for High Quality model */}
                    {plan._meta?.quality === 'high_quality' && (
                      <span className="ml-2 text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded border border-purple-200">
                        Pro Analysis
                      </span>
                    )}
                  </span>
                  <div className="flex items-center gap-2">
                    {/* P10-04: Deep Analysis Button */}
                    {!isPlanError && onReevaluate && (
                      <button
                        onClick={() => handleReevaluate('high_quality')}
                        disabled={isReevaluating}
                        className="text-[10px] bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 px-2 py-1 rounded transition-colors flex items-center gap-1"
                        title="GPT-4/Gemini Pro 수준의 심층 분석"
                      >
                         {isReevaluating ? (
                           <>
                             <span className="animate-spin text-[10px]">⏳</span> 분석 중...
                           </>
                         ) : (
                           <>
                             🧠 Deep Analysis
                           </>
                         )}
                      </button>
                    )}

                  {/* 재평가를 통해 LLM 기반 Upgrade Plan 생성 */}
                  {isPlanError && onReevaluate && (
                    <button
                      onClick={() => handleReevaluate('standard')}
                      disabled={isReevaluating}
                      className="text-xs bg-amber-100 hover:bg-amber-200 text-amber-700 px-2 py-1 rounded transition-colors flex items-center gap-1"
                    >
                      {isReevaluating ? (
                        <>
                          <span className="animate-spin text-xs">⏳</span> 재평가 중...
                        </>
                      ) : (
                        <>
                          <span>🔁</span> 재평가
                        </>
                      )}
                    </button>
                  )}
                  {/* 자동 수정 버튼 - 오류가 아닐 때만 표시 */}
                  {onApplyPlan && !isPlanError && (
                    <button
                      onClick={handleApply}
                      disabled={isApplying}
                      className="text-xs bg-indigo-100 hover:bg-indigo-200 text-indigo-700 px-2 py-1 rounded transition-colors flex items-center gap-1"
                    >
                      {isApplying ? (
                        <>
                          <span className="animate-spin text-xs">⏳</span> applying...
                        </>
                      ) : (
                        <>
                          <span>⚡</span> 자동 수정
                        </>
                      )}
                    </button>
                  )}
                </div>
              </h4>

              {/* Fallback Notification */}
              {plan._meta?.isFallback && (
                <div className="mb-3 px-2 py-1.5 bg-amber-50 border border-amber-200 rounded text-xs text-amber-700 flex items-center gap-1.5 animate-pulse">
                  <span>⚠️</span>
                  <span>Pro 모델 사용량이 많아 <strong>Flash 모델</strong>로 자동 전환되었습니다.</span>
                </div>
              )}
              
              <div className="space-y-2 text-sm">
                <div>
                  <span className="font-semibold text-gray-700 dark:text-gray-300 text-xs">What: </span>
                  <span className="text-gray-600 dark:text-gray-400">{plan.what}</span>
                </div>
                <div>
                  <span className="font-semibold text-gray-700 dark:text-gray-300 text-xs">Why: </span>
                  <span className="text-gray-600 dark:text-gray-400">{plan.why}</span>
                </div>
                <div className="bg-indigo-50 dark:bg-indigo-900/20 p-2 rounded text-gray-700 dark:text-gray-300 mt-1">
                  <span className="font-semibold text-xs block mb-1 text-indigo-700 dark:text-indigo-300">How to Fix:</span>
                  {plan.how}
                </div>
                {plan.example && (
                  <div className="mt-2">
                    <span className="font-semibold text-xs text-green-600 dark:text-green-400 block mb-1">Example:</span>
                    <div className="text-gray-600 dark:text-gray-400 bg-green-50 dark:bg-green-900/10 p-2 rounded border border-green-100 dark:border-green-900/20">
                      {plan.example}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
})
