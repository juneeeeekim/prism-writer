// =============================================================================
// PRISM Writer - RAG Search Page
// =============================================================================
// 파일: frontend/src/app/rag/page.tsx
// 역할: RAG 검색 전용 페이지 (모듈형 설계)
// =============================================================================

'use client'

import { useState } from 'react'
import AuthHeader from '@/components/auth/AuthHeader'
import { EvidenceCard, EvidenceList } from '@/components/rag/EvidenceCard'
import { ModeSelector } from '@/components/rag/ModeSelector'
import { ReviewBadge } from '@/components/rag/ReviewBadge'
import type { JudgeResult, JudgeEvidence, RouterMode } from '@/types/rag'
import type { VerifiedEvidence } from '@/lib/rag/citationGate'

// =============================================================================
// 타입 정의
// =============================================================================

interface SearchState {
  query: string
  mode: RouterMode
  isLoading: boolean
  error: string | null
}

interface JudgeResponseData {
  success: boolean
  result: JudgeResult
  verifiedEvidence?: VerifiedEvidence[]
  citationSummary?: {
    total: number
    valid: number
    invalid: number
    averageScore: number
  }
  tokensUsed?: number
  error?: string
}

// =============================================================================
// 메인 컴포넌트
// =============================================================================

export default function RAGSearchPage() {
  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------
  const [searchState, setSearchState] = useState<SearchState>({
    query: '',
    mode: 'standard',
    isLoading: false,
    error: null,
  })
  
  const [judgeResult, setJudgeResult] = useState<JudgeResponseData | null>(null)

  // ---------------------------------------------------------------------------
  // 검색 핸들러
  // ---------------------------------------------------------------------------
  const handleSearch = async () => {
    if (!searchState.query.trim()) {
      setSearchState(prev => ({ ...prev, error: '질문을 입력해주세요.' }))
      return
    }

    setSearchState(prev => ({ ...prev, isLoading: true, error: null }))
    setJudgeResult(null)

    try {
      // -----------------------------------------------------------------
      // 1단계: Judge API 호출 (RAG 파이프라인)
      // -----------------------------------------------------------------
      const response = await fetch('/api/llm/judge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: searchState.query,
          mode: searchState.mode, // 모드 전달
          // 테스트용 샘플 컨텍스트 (실제로는 검색 API에서 가져와야 함)
          context: [
            {
              id: 'sample-chunk-1',
              content: 'RAG(Retrieval-Augmented Generation)는 검색과 생성을 결합한 기술입니다. 대규모 언어 모델의 환각 문제를 해결하기 위해 외부 지식을 활용합니다.',
            },
            {
              id: 'sample-chunk-2',
              content: '자연어 처리(NLP)는 컴퓨터가 인간의 언어를 이해하고 생성하는 인공지능의 한 분야입니다.',
            },
          ],
        }),
      })

      const data: JudgeResponseData = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Judge API 호출 실패')
      }

      setJudgeResult(data)
    } catch (error) {
      setSearchState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : '알 수 없는 오류',
      }))
    } finally {
      setSearchState(prev => ({ ...prev, isLoading: false }))
    }
  }

  // ---------------------------------------------------------------------------
  // 렌더링
  // ---------------------------------------------------------------------------
  return (
    <div className="min-h-screen bg-gray-50">
      {/* =================================================================
          AuthHeader - 일관된 네비게이션
          ================================================================= */}
      <AuthHeader showLogo />

      {/* =================================================================
          메인 콘텐츠
          ================================================================= */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
            RAG 검색 파이프라인
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400">
            검색, 리랭킹, 그리고 검증(Citation Gate) 과정을 시각화합니다.
          </p>
        </div>

        {/* 검색 입력 섹션 */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 mb-8">
          <div className="flex flex-col gap-4">
            <div className="flex gap-4">
              <input
                type="text"
                value={searchState.query}
                onChange={(e) => setSearchState(prev => ({ ...prev, query: e.target.value }))}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="질문을 입력하세요..."
                className="flex-1 px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              />
              <button
                onClick={handleSearch}
                disabled={searchState.isLoading}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {searchState.isLoading ? (
                  <>
                    <span className="animate-spin">↻</span>
                    분석 중...
                  </>
                ) : (
                  <>
                    <span>🔍</span>
                    검색
                  </>
                )}
              </button>
            </div>
            
            {/* 모드 선택기 */}
            <div className="flex justify-end">
              <ModeSelector 
                value={searchState.mode} 
                onChange={(mode) => setSearchState(prev => ({ ...prev, mode }))}
                showDetails={true}
                className="w-full sm:w-auto"
              />
            </div>
          </div>

          {searchState.error && (
            <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg">
              {searchState.error}
            </div>
          )}
        </div>

        {/* 결과 섹션 */}
        {judgeResult && (
          <div className="space-y-8 animate-fade-in">
            {/* 1. Judge 결과 요약 */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border-l-4 border-blue-500">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    🤖 Judge 분석 결과
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                      judgeResult.result.verdict === 'pass' ? 'bg-green-100 text-green-800' :
                      judgeResult.result.verdict === 'fail' ? 'bg-red-100 text-red-800' :
                      'bg-yellow-100 text-yellow-800'
                    }`}>
                      {judgeResult.result.verdict.toUpperCase()} ({judgeResult.result.score}점)
                    </span>
                  </h2>
                  <p className="text-gray-600 dark:text-gray-300 mt-2">
                    {judgeResult.result.reasoning}
                  </p>
                </div>
              </div>
            </div>

            {/* 인용 검증 요약 */}
            {judgeResult.citationSummary && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-semibold mb-4">📝 인용 검증 요약</h2>
                <div className="grid grid-cols-4 gap-4">
                  <div className="text-center">
                    <div className="text-lg font-bold">{judgeResult.citationSummary.total}</div>
                    <div className="text-sm text-gray-600">전체</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold text-green-600">{judgeResult.citationSummary.valid}</div>
                    <div className="text-sm text-gray-600">검증됨</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold text-amber-600">{judgeResult.citationSummary.invalid}</div>
                    <div className="text-sm text-gray-600">미검증</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold">{Math.round(judgeResult.citationSummary.averageScore * 100)}%</div>
                    <div className="text-sm text-gray-600">평균 점수</div>
                  </div>
                </div>
              </div>
            )}

            {/* 근거 목록 */}
            {judgeResult.verifiedEvidence && judgeResult.verifiedEvidence.length > 0 && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-semibold mb-4">📚 인용 근거</h2>
                <EvidenceList evidence={judgeResult.verifiedEvidence} />
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
