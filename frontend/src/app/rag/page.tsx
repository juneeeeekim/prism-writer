// =============================================================================
// PRISM Writer - RAG Search Page (P2 Phase 4 Updated)
// =============================================================================
// 파일: frontend/src/app/rag/page.tsx
// 역할: RAG 검색 전용 페이지 (실제 API 연동)
// 변경사항: Mock 데이터 제거 → 실제 searchDocuments API 호출
// =============================================================================

'use client'

import { useState, useEffect } from 'react'
import AuthHeader from '@/components/auth/AuthHeader'
import { EvidenceCard, EvidenceList } from '@/components/rag/EvidenceCard'

import { ReviewBadge } from '@/components/rag/ReviewBadge'
// [P1-04] 미사용 타입 제거: JudgeEvidence, RouterMode
import type { JudgeResult, EvidencePack } from '@/types/rag'
import type { VerifiedEvidence } from '@/lib/rag/citationGate'
import { searchDocuments, documentsToContext, RAGSearchError } from '@/lib/api/rag'

// =============================================================================
// 타입 정의
// =============================================================================

// [P1-01] SearchState 단순화: mode/category 제거 (Google 스타일 UI)
// - mode: 'standard' 고정 (Judge API에서 하드코딩)
// - category: 전체 검색 (백엔드 자동 처리)
interface SearchState {
  query: string
  isLoading: boolean
  isSearching: boolean  // 검색 단계 표시용
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
  // [P1-01] 단순화된 초기 상태
  const [searchState, setSearchState] = useState<SearchState>({
    query: '',
    isLoading: false,
    isSearching: false,
    error: null,
  })
  
  const [judgeResult, setJudgeResult] = useState<JudgeResponseData | null>(null)
  const [evidencePack, setEvidencePack] = useState<EvidencePack | null>(null)

  // ---------------------------------------------------------------------------
  // [P1-03] 프로젝트 선택 상태
  // ---------------------------------------------------------------------------
  const [projects, setProjects] = useState<{id: string, name: string}[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [isLoadingProjects, setIsLoadingProjects] = useState(true)

  // ---------------------------------------------------------------------------
  // [P1-03] 프로젝트 목록 로드
  // ---------------------------------------------------------------------------
  useEffect(() => {
    async function loadProjects() {
      try {
        const res = await fetch('/api/projects')
        if (res.ok) {
          const data = await res.json()
          const projectList = data.projects || []
          setProjects(projectList)
          // 첫 번째 프로젝트 자동 선택
          if (projectList.length > 0) {
            setSelectedProjectId(projectList[0].id)
          }
        }
      } catch (err) {
        console.error('[RAG Search] Failed to load projects:', err)
      } finally {
        setIsLoadingProjects(false)
      }
    }
    loadProjects()
  }, [])

  // ---------------------------------------------------------------------------
  // 검색 핸들러 (2단계 파이프라인: 검색 → Judge)
  // ---------------------------------------------------------------------------
  const handleSearch = async () => {
    // [P1-05] 프로젝트 미선택 시 에러 표시
    if (!selectedProjectId) {
      setSearchState(prev => ({ ...prev, error: '프로젝트를 먼저 선택해주세요.' }))
      return
    }
    if (!searchState.query.trim()) {
      setSearchState(prev => ({ ...prev, error: '질문을 입력해주세요.' }))
      return
    }

    setSearchState(prev => ({ ...prev, isLoading: true, isSearching: true, error: null }))
    setJudgeResult(null)
    setEvidencePack(null)

    try {
      // -----------------------------------------------------------------
      // [Option B] 1단계: RAG 검색 API 호출 (Gemini 768차원 벡터 검색)
      // category 생략 → 백엔드에서 기본값 '*' (전체 검색) 자동 적용
      // -----------------------------------------------------------------
      let searchResult
      try {
        // [P1-05] projectId 전달
        searchResult = await searchDocuments(searchState.query, {
          topK: 5,
          threshold: 0.5,
          projectId: selectedProjectId,  // [P1-05] 프로젝트별 RAG 격리
        })
        setEvidencePack(searchResult.evidencePack)
      } catch (searchError) {
        if (searchError instanceof RAGSearchError) {
          // 검색 결과가 없어도 Judge 진행 (Mock 컨텍스트로 대체)
          if (searchError.code === 'NO_RESULTS') {
            console.warn('검색 결과 없음, 기본 컨텍스트로 진행')
            searchResult = null
          } else {
            throw searchError
          }
        } else {
          throw searchError
        }
      }

      setSearchState(prev => ({ ...prev, isSearching: false }))

      // -----------------------------------------------------------------
      // [P1-03] 2단계: Judge API 호출 (검색된 문서를 컨텍스트로 전달)
      // mode: 'standard' 고정 (UI에서 선택권 제거됨)
      // [FIX] 검색 성공했지만 documents가 빈 배열인 경우도 fallback 처리
      // -----------------------------------------------------------------
      const context = searchResult && searchResult.documents.length > 0
        ? documentsToContext(searchResult.documents)
        : [
            // 검색 결과가 없을 경우 안내 메시지
            {
              id: 'no-results',
              content: '검색 결과가 없습니다. 문서를 먼저 업로드해주세요.',
            },
          ]

      const response = await fetch('/api/llm/judge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: searchState.query,
          mode: 'standard',  // [P1-03] 고정값 (Google 스타일 단순화)
          context,
        }),
      })

      const data: JudgeResponseData = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Judge API 호출 실패')
      }

      setJudgeResult(data)
    } catch (error) {
      const errorMessage = error instanceof RAGSearchError
        ? `[${error.code}] ${error.message}`
        : error instanceof Error 
          ? error.message 
          : '알 수 없는 오류'
      
      setSearchState(prev => ({
        ...prev,
        error: errorMessage,
      }))
    } finally {
      setSearchState(prev => ({ ...prev, isLoading: false, isSearching: false }))
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
          [P2-01] 메인 콘텐츠 - 사용자 친화적 타이틀로 변경
          ================================================================= */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
            스마트 검색
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400">
            AI가 문서를 분석하여 정확한 답변을 제공합니다.
          </p>
        </div>

        {/* =================================================================
            [P1-04] 프로젝트 선택 드롭다운
            ================================================================= */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 mb-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            📁 프로젝트 선택
          </label>
          {isLoadingProjects ? (
            <div className="text-gray-500">프로젝트 목록 로딩 중...</div>
          ) : projects.length === 0 ? (
            <div className="text-amber-600 dark:text-amber-400">
              ⚠️ 프로젝트가 없습니다. 먼저 프로젝트를 생성해주세요.
            </div>
          ) : (
            <select
              value={selectedProjectId || ''}
              onChange={(e) => setSelectedProjectId(e.target.value || null)}
              className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
            >
              <option value="">프로젝트를 선택하세요</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          )}
        </div>

        {/* 검색 입력 섹션 */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 mb-8">
          <div className="flex flex-col gap-4">
            <div className="flex gap-4">
              <input
                type="text"
                value={searchState.query}
                onChange={(e) => setSearchState(prev => ({ ...prev, query: e.target.value }))}
                onKeyDown={(e) => e.key === 'Enter' && selectedProjectId && handleSearch()}
                placeholder="질문을 입력하세요..."
                className="flex-1 px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              />
              {/* [P2-02] 검색 버튼 - 프로젝트 미선택 시 비활성화 */}
              <button
                onClick={handleSearch}
                disabled={searchState.isLoading || !selectedProjectId}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {searchState.isLoading ? (
                  <>
                    <span className="animate-spin">↻</span>
                    처리 중...
                  </>
                ) : (
                  <>
                    <span>🔍</span>
                    검색
                  </>
                )}
              </button>
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
