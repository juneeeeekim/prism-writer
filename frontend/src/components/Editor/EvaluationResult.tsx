// =============================================================================
// PRISM Writer - Evaluation Result Component
// =============================================================================
// 파일: frontend/src/components/editor/EvaluationResult.tsx
// 역할: 글 평가 결과를 표시하는 UI 컴포넌트
// 접근성: 상태별 색상 + 아이콘 (색맹 고려)
// =============================================================================

'use client'

import { useState } from 'react'
import type { EvaluationResult as EvaluationResultType, RubricEvaluation, EvaluationStatus } from '@/lib/llm/parser'
import { getCategoryLabel, type RubricCategory } from '@/lib/rag/rubrics'
import FeedbackButtons from '@/components/feedback/FeedbackButtons'

// =============================================================================
// 타입 정의
// =============================================================================

interface EvaluationResultProps {
  /** 평가 결과 데이터 */
  result: EvaluationResultType
  /** 로딩 상태 */
  isLoading?: boolean
  /** 평가 세션 ID (피드백용) */
  evaluationId?: string
}

// =============================================================================
// 상수: 상태별 스타일 (색맹 고려 - 아이콘과 패턴 병행)
// =============================================================================

const STATUS_CONFIG: Record<EvaluationStatus, {
  label: string
  icon: string
  bgColor: string
  textColor: string
  borderColor: string
}> = {
  pass: {
    label: '통과',
    icon: '✅',
    bgColor: 'bg-green-50 dark:bg-green-900/20',
    textColor: 'text-green-700 dark:text-green-400',
    borderColor: 'border-green-200 dark:border-green-800',
  },
  partial: {
    label: '보완 필요',
    icon: '⚠️',
    bgColor: 'bg-yellow-50 dark:bg-yellow-900/20',
    textColor: 'text-yellow-700 dark:text-yellow-400',
    borderColor: 'border-yellow-200 dark:border-yellow-800',
  },
  fail: {
    label: '미충족',
    icon: '❌',
    bgColor: 'bg-red-50 dark:bg-red-900/20',
    textColor: 'text-red-700 dark:text-red-400',
    borderColor: 'border-red-200 dark:border-red-800',
  },
  insufficient_evidence: {
    label: '근거 부족',
    icon: '📭',
    bgColor: 'bg-gray-50 dark:bg-gray-800',
    textColor: 'text-gray-600 dark:text-gray-400',
    borderColor: 'border-gray-200 dark:border-gray-700',
  },
}

// =============================================================================
// Sub Components
// =============================================================================

/** 점수 게이지 컴포넌트 */
function ScoreGauge({ score }: { score: number }) {
  const getScoreColor = (s: number) => {
    if (s >= 80) return 'bg-green-500'
    if (s >= 60) return 'bg-yellow-500'
    if (s >= 40) return 'bg-orange-500'
    return 'bg-red-500'
  }

  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
          className={`h-full ${getScoreColor(score)} transition-all duration-500`}
          style={{ width: `${score}%` }}
        />
      </div>
      <span className="text-lg font-bold text-gray-900 dark:text-white min-w-[3rem] text-right">
        {score}점
      </span>
    </div>
  )
}

/** 상태 배지 컴포넌트 */
function StatusBadge({ status }: { status: EvaluationStatus }) {
  const config = STATUS_CONFIG[status]
  
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full
                  ${config.bgColor} ${config.textColor} border ${config.borderColor}`}
    >
      <span>{config.icon}</span>
      <span>{config.label}</span>
    </span>
  )
}

/** 개별 루브릭 평가 카드 */
function RubricCard({ 
  evaluation, 
  isExpanded, 
  onToggle 
}: { 
  evaluation: RubricEvaluation
  isExpanded: boolean
  onToggle: () => void
}) {
  const config = STATUS_CONFIG[evaluation.status]
  // ---------------------------------------------------------------------------
  // Pipeline v4: 성능 최적화 - 최대 표시 개수 제한
  // ---------------------------------------------------------------------------
  // 주석(시니어 개발자): 대량 예시로 인한 FCP 지연 방지
  const MAX_DISPLAY_QUOTES = 5
  const [showAllEvidenceQuotes, setShowAllEvidenceQuotes] = useState(false)
  const [showAllUserQuotes, setShowAllUserQuotes] = useState(false)

  // 표시할 인용문 계산
  const displayedEvidenceQuotes = showAllEvidenceQuotes 
    ? evaluation.evidence_quotes 
    : evaluation.evidence_quotes.slice(0, MAX_DISPLAY_QUOTES)
  const displayedUserQuotes = showAllUserQuotes 
    ? (evaluation.user_text_quotes || [])
    : (evaluation.user_text_quotes || []).slice(0, MAX_DISPLAY_QUOTES)

  const hasMoreEvidenceQuotes = evaluation.evidence_quotes.length > MAX_DISPLAY_QUOTES
  const hasMoreUserQuotes = (evaluation.user_text_quotes || []).length > MAX_DISPLAY_QUOTES

  return (
    <div
      className={`border rounded-lg overflow-hidden transition-all
                  ${config.borderColor} ${config.bgColor}`}
    >
      {/* 헤더 (클릭 가능) */}
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-3 text-left hover:bg-white/50 dark:hover:bg-black/20 transition-colors"
        aria-expanded={isExpanded}
      >
        <div className="flex items-center gap-2">
          <span className="text-lg">{config.icon}</span>
          <span className="font-medium text-gray-900 dark:text-white">
            {evaluation.rubric_item}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-sm font-medium ${config.textColor}`}>
            {evaluation.score}점
          </span>
          <span className="text-gray-400">
            {isExpanded ? '▲' : '▼'}
          </span>
        </div>
      </button>

      {/* 상세 내용 (확장 시) */}
      {isExpanded && (
        <div className="p-3 pt-0 space-y-3 border-t border-gray-200 dark:border-gray-700">
          {/* 근거 인용 - Pipeline v4: 최대 5개만 표시 */}
          {evaluation.evidence_quotes.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">
                📚 참고 근거
              </h4>
              <ul className="space-y-1">
                {displayedEvidenceQuotes.map((quote, idx) => (
                  <li
                    key={idx}
                    className="text-sm text-gray-700 dark:text-gray-300 pl-3 border-l-2 border-prism-primary/50"
                  >
                    &ldquo;{quote}&rdquo;
                  </li>
                ))}
              </ul>
              {/* 더 보기 버튼 */}
              {hasMoreEvidenceQuotes && (
                <button
                  onClick={() => setShowAllEvidenceQuotes(!showAllEvidenceQuotes)}
                  className="mt-2 text-xs text-prism-primary hover:underline"
                  aria-label={showAllEvidenceQuotes ? '접기' : `${evaluation.evidence_quotes.length - MAX_DISPLAY_QUOTES}개 더 보기`}
                >
                  {showAllEvidenceQuotes 
                    ? '접기' 
                    : `+ ${evaluation.evidence_quotes.length - MAX_DISPLAY_QUOTES}개 더 보기`}
                </button>
              )}
            </div>
          )}

          {/* 사용자 글 인용 - Pipeline v4: 최대 5개만 표시 */}
          {evaluation.user_text_quotes && evaluation.user_text_quotes.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">
                📝 해당 부분
              </h4>
              <ul className="space-y-1">
                {displayedUserQuotes.map((quote, idx) => (
                  <li
                    key={idx}
                    className="text-sm text-gray-600 dark:text-gray-400 pl-3 border-l-2 border-gray-300 dark:border-gray-600 italic"
                  >
                    &ldquo;{quote}&rdquo;
                  </li>
                ))}
              </ul>
              {/* 더 보기 버튼 */}
              {hasMoreUserQuotes && (
                <button
                  onClick={() => setShowAllUserQuotes(!showAllUserQuotes)}
                  className="mt-2 text-xs text-prism-primary hover:underline"
                  aria-label={showAllUserQuotes ? '접기' : `${(evaluation.user_text_quotes || []).length - MAX_DISPLAY_QUOTES}개 더 보기`}
                >
                  {showAllUserQuotes 
                    ? '접기' 
                    : `+ ${(evaluation.user_text_quotes || []).length - MAX_DISPLAY_QUOTES}개 더 보기`}
                </button>
              )}
            </div>
          )}

          {/* 개선 권고 */}
          <div>
            <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">
              💡 개선 방향
            </h4>
            <p className="text-sm text-gray-700 dark:text-gray-300">
              {evaluation.recommendations}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

// =============================================================================
// Main Component
// =============================================================================

export default function EvaluationResult({ result, isLoading, evaluationId }: EvaluationResultProps) {
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set())

  // 로딩 상태
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <div className="w-10 h-10 border-4 border-prism-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-gray-600 dark:text-gray-400">AI가 평가 중입니다...</p>
      </div>
    )
  }

  // 에러 상태
  if (!result.success) {
    return (
      <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
        <p className="text-red-700 dark:text-red-400">
          ❌ 평가 실패: {result.error || '알 수 없는 오류'}
        </p>
      </div>
    )
  }

  // 토글 핸들러
  const toggleItem = (id: string) => {
    setExpandedItems((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  // 전체 펼치기/접기
  const toggleAll = () => {
    if (expandedItems.size === result.evaluations.length) {
      setExpandedItems(new Set())
    } else {
      setExpandedItems(new Set(result.evaluations.map((e) => e.rubric_item)))
    }
  }

  // 상태별 통계
  const stats = {
    pass: result.evaluations.filter((e) => e.status === 'pass').length,
    partial: result.evaluations.filter((e) => e.status === 'partial').length,
    fail: result.evaluations.filter((e) => e.status === 'fail').length,
    insufficient: result.evaluations.filter((e) => e.status === 'insufficient_evidence').length,
  }

  return (
    <div className="space-y-4">
      {/* ---------------------------------------------------------------------------
          전체 점수
          --------------------------------------------------------------------------- */}
      <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-2">
          전체 점수
        </h3>
        <ScoreGauge score={result.overall_score} />
      </div>

      {/* ---------------------------------------------------------------------------
          상태 요약
          --------------------------------------------------------------------------- */}
      <div className="flex flex-wrap gap-2">
        <StatusBadge status="pass" />
        <span className="text-sm text-gray-600 dark:text-gray-400">{stats.pass}개</span>
        <StatusBadge status="partial" />
        <span className="text-sm text-gray-600 dark:text-gray-400">{stats.partial}개</span>
        <StatusBadge status="fail" />
        <span className="text-sm text-gray-600 dark:text-gray-400">{stats.fail}개</span>
        {stats.insufficient > 0 && (
          <>
            <StatusBadge status="insufficient_evidence" />
            <span className="text-sm text-gray-600 dark:text-gray-400">{stats.insufficient}개</span>
          </>
        )}
      </div>

      {/* ---------------------------------------------------------------------------
          전체 요약
          --------------------------------------------------------------------------- */}
      <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
        <p className="text-sm text-blue-800 dark:text-blue-300">
          📋 {result.overall_summary}
        </p>
      </div>

      {/* ---------------------------------------------------------------------------
          루브릭별 평가 결과
          --------------------------------------------------------------------------- */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            항목별 평가 ({result.evaluations.length}개)
          </h3>
          <button
            onClick={toggleAll}
            className="text-xs text-prism-primary hover:underline"
          >
            {expandedItems.size === result.evaluations.length ? '모두 접기' : '모두 펼치기'}
          </button>
        </div>

        {result.evaluations.map((evaluation) => (
          <RubricCard
            key={evaluation.rubric_item}
            evaluation={evaluation}
            isExpanded={expandedItems.has(evaluation.rubric_item)}
            onToggle={() => toggleItem(evaluation.rubric_item)}
          />
        ))}
      </div>

      {/* ---------------------------------------------------------------------------
          사용자 피드백
          --------------------------------------------------------------------------- */}
      {evaluationId && (
        <FeedbackButtons 
          evaluationId={evaluationId}
          onFeedbackSubmitted={(type) => console.log('Feedback:', type)}
        />
      )}
    </div>
  )
}

