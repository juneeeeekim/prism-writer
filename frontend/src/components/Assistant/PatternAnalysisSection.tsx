// =============================================================================
// PRISM Writer - Pattern Analysis Section Component
// =============================================================================
// 파일: frontend/src/components/Assistant/PatternAnalysisSection.tsx
// 역할: 루브릭 파이프라인 UI - 패턴 분석 및 후보 관리
// 생성일: 2026-01-03
// =============================================================================

'use client'

import { useState, useEffect, useCallback } from 'react'
import { useProject } from '@/contexts/ProjectContext'
import { FEATURE_FLAGS } from '@/config/featureFlags'

// =============================================================================
// [PATTERN] 타입 정의
// =============================================================================

interface RuleCandidate {
  id: string
  pattern_type: string
  rule_text: string
  why_it_works: string
  query_hints: string[]
  evidence_quote: string
  status: 'draft' | 'selected' | 'rejected'
  created_at: string
}

interface PatternAnalysisSectionProps {
  documentId?: string | null
}

// =============================================================================
// [PATTERN] 패턴 타입 한글 이름
// =============================================================================

const PATTERN_TYPE_LABELS: Record<string, string> = {
  hook: '🎯 도입 훅',
  problem: '❓ 문제 정의',
  cause: '🔍 원인 분석',
  solution: '💡 해결책',
  evidence: '📊 근거 제시',
  cta: '👆 행동 유도',
  metaphor: '🌊 비유/은유',
  contrast: '⚖️ 대비/비교',
  statistics: '📈 통계 활용',
  rebuttal: '🛡️ 반박 처리',
  question: '❔ 질문 활용',
  repetition: '🔄 반복 구조',
}

// =============================================================================
// [PATTERN] 컴포넌트
// =============================================================================

export default function PatternAnalysisSection({ documentId }: PatternAnalysisSectionProps) {
  // ---------------------------------------------------------------------------
  // 상태
  // ---------------------------------------------------------------------------
  const [candidates, setCandidates] = useState<RuleCandidate[]>([])
  const [isExtracting, setIsExtracting] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const { currentProject } = useProject()
  const projectId = currentProject?.id ?? null

  // ---------------------------------------------------------------------------
  // Feature Flag 체크
  // ---------------------------------------------------------------------------
  if (!FEATURE_FLAGS.ENABLE_RUBRIC_CANDIDATE_UI) {
    return null // UI 비활성화 시 렌더링하지 않음
  }

  // ---------------------------------------------------------------------------
  // 후보 목록 로드
  // ---------------------------------------------------------------------------
  const loadCandidates = useCallback(async () => {
    if (!projectId) return

    setIsLoading(true)
    setError(null)

    try {
      const res = await fetch(`/api/rubrics/candidates?projectId=${projectId}`)
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to load candidates')
      }

      setCandidates(data.candidates || [])
    } catch (err) {
      console.error('[PatternAnalysis] Load error:', err)
      setError((err as Error).message)
    } finally {
      setIsLoading(false)
    }
  }, [projectId])

  // 마운트 시 로드
  useEffect(() => {
    loadCandidates()
  }, [loadCandidates])

  // ---------------------------------------------------------------------------
  // 패턴 추출 시작
  // ---------------------------------------------------------------------------
  const handleExtractPatterns = async () => {
    if (!projectId) {
      setError('프로젝트를 선택해주세요.')
      return
    }

    setIsExtracting(true)
    setError(null)
    setSuccessMessage(null)

    try {
      const res = await fetch('/api/rubrics/candidates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          targetCount: 50,
          patternScope: 'both',
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Pattern extraction failed')
      }

      setSuccessMessage(`${data.extracted}개 패턴 추출, ${data.saved}개 저장됨`)
      loadCandidates() // 목록 새로고침
    } catch (err) {
      console.error('[PatternAnalysis] Extract error:', err)
      setError((err as Error).message)
    } finally {
      setIsExtracting(false)
    }
  }

  // ---------------------------------------------------------------------------
  // 후보 채택/거부
  // ---------------------------------------------------------------------------
  const handleSelectCandidate = async (candidateId: string, action: 'select' | 'reject') => {
    try {
      const res = await fetch('/api/rubrics/candidates/select', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidateIds: [candidateId],
          action,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Action failed')
      }

      // 로컬 상태 업데이트
      setCandidates(prev =>
        prev.map(c =>
          c.id === candidateId
            ? { ...c, status: action === 'select' ? 'selected' : 'rejected' }
            : c
        )
      )
    } catch (err) {
      console.error('[PatternAnalysis] Select error:', err)
      setError((err as Error).message)
    }
  }

  // ---------------------------------------------------------------------------
  // 선택된 개수 계산
  // ---------------------------------------------------------------------------
  const selectedCount = candidates.filter(c => c.status === 'selected').length
  const draftCount = candidates.filter(c => c.status === 'draft').length

  // ---------------------------------------------------------------------------
  // 렌더링
  // ---------------------------------------------------------------------------
  return (
    <div className="pattern-analysis-section mb-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-lg">📊</span>
          <h3 className="font-semibold text-gray-900 dark:text-white">
            패턴 기반 평가 기준
          </h3>
          {selectedCount > 0 && (
            <span className="px-2 py-0.5 text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full">
              {selectedCount}/20 선택됨
            </span>
          )}
        </div>

        <button
          onClick={handleExtractPatterns}
          disabled={isExtracting || !projectId}
          className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-md 
                     disabled:bg-gray-400 disabled:cursor-not-allowed
                     flex items-center gap-2 transition-colors"
        >
          {isExtracting ? (
            <>
              <span className="animate-spin">⏳</span>
              분석 중...
            </>
          ) : (
            <>
              <span>🔍</span>
              패턴 분석
            </>
          )}
        </button>
      </div>

      {/* 에러/성공 메시지 */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-md text-sm">
          ❌ {error}
        </div>
      )}
      {successMessage && (
        <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 rounded-md text-sm">
          ✅ {successMessage}
        </div>
      )}

      {/* 안내 메시지 (후보 없을 때) */}
      {candidates.length === 0 && !isLoading && (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          <p className="mb-2">아직 패턴을 추출하지 않았습니다.</p>
          <p className="text-sm">업로드한 문서에서 글쓰기 패턴을 분석해보세요.</p>
        </div>
      )}

      {/* 로딩 */}
      {isLoading && (
        <div className="text-center py-8 text-gray-500">
          <span className="animate-spin inline-block mr-2">⏳</span>
          후보 목록 로딩 중...
        </div>
      )}

      {/* 후보 목록 */}
      {candidates.length > 0 && (
        <div className="space-y-3 max-h-80 overflow-y-auto">
          {candidates.map(candidate => (
            <div
              key={candidate.id}
              className={`p-3 rounded-md border transition-colors ${
                candidate.status === 'selected'
                  ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700'
                  : candidate.status === 'rejected'
                  ? 'bg-gray-100 dark:bg-gray-700 border-gray-300 dark:border-gray-600 opacity-50'
                  : 'bg-white dark:bg-gray-850 border-gray-200 dark:border-gray-600'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  {/* 패턴 타입 뱃지 */}
                  <span className="inline-block px-2 py-0.5 text-xs bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded mb-2">
                    {PATTERN_TYPE_LABELS[candidate.pattern_type] || candidate.pattern_type}
                  </span>
                  
                  {/* 규칙 텍스트 */}
                  <p className="text-sm text-gray-900 dark:text-white font-medium">
                    {candidate.rule_text}
                  </p>
                  
                  {/* 이유 */}
                  {candidate.why_it_works && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      💡 {candidate.why_it_works}
                    </p>
                  )}
                </div>

                {/* 버튼 (draft 상태일 때만) */}
                {candidate.status === 'draft' && (
                  <div className="flex gap-2 flex-shrink-0">
                    <button
                      onClick={() => handleSelectCandidate(candidate.id, 'select')}
                      disabled={selectedCount >= 20}
                      className="px-2 py-1 text-xs bg-green-600 hover:bg-green-700 text-white rounded
                                 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                      title={selectedCount >= 20 ? '최대 20개까지 선택 가능' : '채택'}
                    >
                      채택
                    </button>
                    <button
                      onClick={() => handleSelectCandidate(candidate.id, 'reject')}
                      className="px-2 py-1 text-xs bg-gray-500 hover:bg-gray-600 text-white rounded transition-colors"
                    >
                      거부
                    </button>
                  </div>
                )}

                {/* 상태 표시 */}
                {candidate.status === 'selected' && (
                  <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">✅ 채택됨</span>
                )}
                {candidate.status === 'rejected' && (
                  <span className="text-xs text-gray-500">거부됨</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 선택 현황 (후보 있을 때) */}
      {candidates.length > 0 && (
        <div className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
          <span>
            대기: {draftCount}개 | 채택: {selectedCount}개
          </span>
          {selectedCount > 0 && (
            <span className="text-blue-600 dark:text-blue-400">
              선택된 패턴이 평가에 반영됩니다.
            </span>
          )}
        </div>
      )}
    </div>
  )
}
