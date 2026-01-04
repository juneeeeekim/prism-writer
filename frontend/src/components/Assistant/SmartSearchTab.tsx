// =============================================================================
// PRISM Writer - Smart Search Tab (P2-01)
// =============================================================================
// 파일: frontend/src/components/assistant/SmartSearchTab.tsx
// 역할: 에디터 내 스마트 검색 탭 - 프로젝트별 RAG 검색
// Dependencies: useProject, searchDocuments (API 호출)
// =============================================================================

'use client'

import { useState } from 'react'
import { useProject } from '@/contexts/ProjectContext'
import { searchDocuments, RAGSearchError } from '@/lib/api/rag'
import type { EvidencePack, EvidenceItem } from '@/types/rag'
// =============================================================================
// [P-A01-03] 로딩 스켈레톤 컴포넌트 import
// =============================================================================
import { SearchResultSkeleton } from '@/components/ui/SearchResultSkeleton'
// =============================================================================
// [P-A02-02] Empty State 컴포넌트 import
// 검색 결과 없음, 초기 상태 등 빈 화면에 친절한 안내 제공
// =============================================================================
import { NoSearchResults, InitialSearchState } from '@/components/ui/EmptyState'

// =============================================================================
// [P2-01] 타입 정의
// =============================================================================

interface SearchState {
  query: string
  isLoading: boolean
  error: string | null
}

// =============================================================================
// [P2-01] SmartSearchTab 컴포넌트 (단순화 버전)
// =============================================================================

export default function SmartSearchTab() {
  // ---------------------------------------------------------------------------
  // [P2-01] 프로젝트 컨텍스트에서 projectId 가져오기
  // ---------------------------------------------------------------------------
  const { currentProject } = useProject()
  const projectId = currentProject?.id || null

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------
  const [searchState, setSearchState] = useState<SearchState>({
    query: '',
    isLoading: false,
    error: null,
  })

  const [evidencePack, setEvidencePack] = useState<EvidencePack | null>(null)

  // ---------------------------------------------------------------------------
  // [P2-01] 검색 핸들러
  // ---------------------------------------------------------------------------
  const handleSearch = async () => {
    // 프로젝트 미선택 시 에러 표시
    if (!projectId) {
      setSearchState(prev => ({ ...prev, error: '프로젝트를 먼저 선택해주세요.' }))
      return
    }

    if (!searchState.query.trim()) {
      setSearchState(prev => ({ ...prev, error: '질문을 입력해주세요.' }))
      return
    }

    setSearchState(prev => ({
      ...prev,
      isLoading: true,
      error: null,
    }))
    setEvidencePack(null)

    try {
      // -----------------------------------------------------------------
      // [P2-01] RAG 검색 API 호출
      // -----------------------------------------------------------------
      const searchResult = await searchDocuments(searchState.query, {
        topK: 5,
        threshold: 0.5,
        projectId,  // [P2-01] 프로젝트별 RAG 격리
      })
      setEvidencePack(searchResult.evidencePack)
    } catch (error) {
      console.error('[SmartSearchTab] Search error:', error)
      if (error instanceof RAGSearchError) {
        if (error.code === 'NO_RESULTS') {
          setSearchState(prev => ({ ...prev, error: '검색 결과가 없습니다.' }))
        } else {
          setSearchState(prev => ({ ...prev, error: error.message }))
        }
      } else {
        setSearchState(prev => ({
          ...prev,
          error: error instanceof Error ? error.message : '검색 중 오류가 발생했습니다.',
        }))
      }
    } finally {
      setSearchState(prev => ({ ...prev, isLoading: false }))
    }
  }

  // ---------------------------------------------------------------------------
  // [P2-01] 렌더링
  // ---------------------------------------------------------------------------
  return (
    <div className="flex flex-col h-full p-4 space-y-4">
      {/* =================================================================
          [P2-01] 헤더 및 안내
          ================================================================= */}
      <div className="text-center">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">
          🔍 스마트 검색
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          현재 프로젝트 문서에서 관련 내용을 찾아드립니다
        </p>
      </div>

      {/* =================================================================
          [P2-01] 프로젝트 상태 표시
          ================================================================= */}
      {!projectId && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
          <p className="text-amber-800 dark:text-amber-200 text-sm">
            ⚠️ 프로젝트가 선택되지 않았습니다. 사이드바에서 프로젝트를 선택해주세요.
          </p>
        </div>
      )}

      {projectId && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-2 text-sm">
          <span className="text-blue-800 dark:text-blue-200">
            📁 현재 프로젝트: <strong>{currentProject?.name || '이름 없음'}</strong>
          </span>
        </div>
      )}

      {/* =================================================================
          [P2-01] 검색 입력
          ================================================================= */}
      <div className="flex gap-2">
        <input
          type="text"
          value={searchState.query}
          onChange={(e) => setSearchState(prev => ({ ...prev, query: e.target.value }))}
          onKeyDown={(e) => e.key === 'Enter' && projectId && handleSearch()}
          placeholder="검색어를 입력하세요..."
          className="flex-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none text-sm"
          disabled={!projectId}
        />
        <button
          onClick={handleSearch}
          disabled={searchState.isLoading || !projectId}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 text-sm"
        >
          {searchState.isLoading ? (
            <>
              <span className="animate-spin">↻</span>
              검색 중
            </>
          ) : (
            <>
              <span>🔍</span>
              검색
            </>
          )}
        </button>
      </div>

      {/* =================================================================
          [P2-01] 에러 표시
          ================================================================= */}
      {searchState.error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
          <p className="text-red-800 dark:text-red-200 text-sm">
            ❌ {searchState.error}
          </p>
        </div>
      )}

      {/* =================================================================
          [P2-01] 검색 결과 표시
          [P-A01-03] 로딩 중 스켈레톤 표시 추가
          ================================================================= */}
      <div className="flex-1 overflow-y-auto space-y-3">
        {/* ===============================================================
            [P-A01-03] 로딩 중 스켈레톤 표시
            검색 API 호출 중일 때 SearchResultSkeleton 컴포넌트 표시
            =============================================================== */}
        {searchState.isLoading && (
          <SearchResultSkeleton count={3} />
        )}

        {/* Evidence Pack 결과 */}
        {!searchState.isLoading && evidencePack && evidencePack.items.length > 0 && (
          <div className="space-y-3">
            <h3 className="font-semibold text-gray-900 dark:text-white text-sm">
              📚 검색 결과 ({evidencePack.items.length}개)
            </h3>
            {evidencePack.items.map((item: EvidenceItem, index: number) => (
              <div 
                key={item.chunkId || index} 
                className="bg-white dark:bg-gray-800 rounded-lg p-3 shadow border border-gray-200 dark:border-gray-700"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-blue-600 dark:text-blue-400">
                    #{index + 1}
                  </span>
                  {item.scoreComponents && (
                    <span className="text-xs text-gray-500">
                      유사도: {Math.round((item.scoreComponents.vector || 0) * 100)}%
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-700 dark:text-gray-300 line-clamp-4">
                  {item.content}
                </p>
                {item.sourceUri && (
                  <p className="text-xs text-gray-500 mt-2 truncate">
                    📄 {item.sourceUri}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}

        {/* ===============================================================
            [P-A02-02] 검색 결과 없음 Empty State
            검색 완료 후 결과가 없는 경우 NoSearchResults 컴포넌트 표시
            - 친절한 안내 메시지와 업로드/재검색 버튼 제공
            =============================================================== */}
        {!searchState.isLoading && evidencePack && evidencePack.items.length === 0 && (
          <NoSearchResults
            onRetry={() => handleSearch()}
          />
        )}

        {/* ===============================================================
            [P-A02-02] 초기 검색 상태 Empty State
            아직 검색을 시작하지 않은 상태에서 InitialSearchState 표시
            - 검색 안내 메시지와 힌트 제공
            =============================================================== */}
        {!evidencePack && !searchState.isLoading && !searchState.error && (
          <InitialSearchState />
        )}
      </div>
    </div>
  )
}
