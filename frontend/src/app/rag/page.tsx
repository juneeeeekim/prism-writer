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
import type { JudgeResult, JudgeEvidence } from '@/types/rag'
import type { VerifiedEvidence } from '@/lib/rag/citationGate'

// =============================================================================
// 타입 정의
// =============================================================================

interface SearchState {
  query: string
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
        {/* 페이지 제목 */}
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            🔍 RAG 검색
          </h1>
          <p className="text-gray-600">
            질문을 입력하면 RAG 파이프라인이 답변을 평가합니다.
          </p>
        </header>

        {/* 검색 입력 */}
        <section className="bg-white rounded-lg shadow p-6 mb-6">
          <label htmlFor="query" className="block text-sm font-medium text-gray-700 mb-2">
            질문 입력
          </label>
          <textarea
            id="query"
            rows={3}
            className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="RAG 시스템에 대해 질문해보세요..."
            value={searchState.query}
            onChange={(e) => setSearchState(prev => ({ ...prev, query: e.target.value }))}
            disabled={searchState.isLoading}
          />
          
          <button
            onClick={handleSearch}
            disabled={searchState.isLoading}
            className="mt-4 w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {searchState.isLoading ? '🔄 분석 중...' : '🔍 질문하기'}
          </button>
        </section>

        {/* 에러 표시 */}
        {searchState.error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
            ❌ {searchState.error}
          </div>
        )}

        {/* Judge 결과 표시 */}
        {judgeResult && (
          <section className="space-y-6">
            {/* 판정 결과 요약 */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4">📊 평가 결과</h2>
              
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <div className="text-2xl font-bold">
                    {judgeResult.result.verdict === 'pass' ? '✅' : 
                     judgeResult.result.verdict === 'fail' ? '❌' : '⚠️'}
                  </div>
                  <div className="text-sm text-gray-600">판정</div>
                  <div className="font-medium">{judgeResult.result.verdict}</div>
                </div>
                
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">
                    {judgeResult.result.score}
                  </div>
                  <div className="text-sm text-gray-600">점수</div>
                </div>
                
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <div className="text-2xl font-bold">
                    {judgeResult.result.evidence.length}
                  </div>
                  <div className="text-sm text-gray-600">근거 수</div>
                </div>
              </div>

              <div className="prose max-w-none">
                <h3 className="text-sm font-medium text-gray-700">판정 이유</h3>
                <p className="text-gray-600">{judgeResult.result.reasoning}</p>
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
          </section>
        )}
      </main>
    </div>
  )
}
