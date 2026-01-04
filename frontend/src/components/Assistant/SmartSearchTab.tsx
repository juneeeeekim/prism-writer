// =============================================================================
// PRISM Writer - Smart Search Tab (P2-01)
// =============================================================================
// 파일: frontend/src/components/assistant/SmartSearchTab.tsx
// 역할: 에디터 내 스마트 검색 탭 - 프로젝트별 RAG 검색
// Dependencies: useProject, searchDocuments (API 호출)
// =============================================================================

'use client'

import { useState, useCallback } from 'react'
import { useProject } from '@/contexts/ProjectContext'
// =============================================================================
// [P-A05-02] 검색 히스토리 훅 import
// =============================================================================
import { useSearchHistory } from '@/hooks/useSearchHistory'
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
  // [P-A05-02] 검색 히스토리 훅 및 드롭다운 상태
  // ---------------------------------------------------------------------------
  const { history, addToHistory, removeFromHistory } = useSearchHistory()
  const [showHistory, setShowHistory] = useState(false)

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
      // [DEBUG] 검색 파라미터 로깅
      // -----------------------------------------------------------------
      console.log('[SmartSearchTab] Calling search with:', {
        query: searchState.query,
        projectId,
        threshold: 0.1,
      })
      const searchResult = await searchDocuments(searchState.query, {
        topK: 5,
        threshold: 0.1,  // [Diagnostic] 0.5 → 0.1로 낮춤
        projectId,  // [P2-01] 프로젝트별 RAG 격리
      })
      setEvidencePack(searchResult.evidencePack)

      // -----------------------------------------------------------------
      // [P-A05-02] 검색 성공 시 히스토리에 추가
      // 결과가 있는 경우에만 히스토리에 저장
      // -----------------------------------------------------------------
      if (searchResult.evidencePack && searchResult.evidencePack.items.length > 0) {
        addToHistory(searchState.query)
      }
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
          [P-A05-02] 히스토리 드롭다운 추가
          ================================================================= */}
      <div className="flex gap-2">
        {/* ===============================================================
            [P-A05-02] 검색 입력 + 히스토리 드롭다운 컨테이너
            - relative 포지션으로 드롭다운 위치 지정
            - onFocus/onBlur로 드롭다운 표시/숨김 제어
            =============================================================== */}
        <div className="relative flex-1">
          <input
            type="text"
            value={searchState.query}
            onChange={(e) => setSearchState(prev => ({ ...prev, query: e.target.value }))}
            onKeyDown={(e) => e.key === 'Enter' && projectId && handleSearch()}
            onFocus={() => setShowHistory(true)}
            onBlur={() => setTimeout(() => setShowHistory(false), 200)}
            placeholder="검색어를 입력하세요..."
            className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none text-sm"
            disabled={!projectId}
            aria-label="검색어 입력"
            aria-describedby="search-history-hint"
          />

          {/* ===============================================================
              [P-A05-02] 검색 히스토리 드롭다운
              - 입력 필드 포커스 시 표시
              - 히스토리가 있을 때만 렌더링
              - 각 항목 클릭 시 검색어 설정 및 검색 실행
              - 삭제 버튼으로 개별 항목 제거
              =============================================================== */}
          {showHistory && history.length > 0 && (
            <div
              className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-20 max-h-48 overflow-y-auto"
              role="listbox"
              aria-label="최근 검색어"
            >
              <div className="px-3 py-1.5 text-xs text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700">
                🕐 최근 검색어
              </div>
              {history.map((item, idx) => (
                <div
                  key={`${item.query}-${item.timestamp}`}
                  className="flex items-center justify-between px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer group"
                  role="option"
                >
                  <button
                    type="button"
                    className="flex-1 text-left text-sm text-gray-700 dark:text-gray-300 truncate"
                    onClick={() => {
                      setSearchState(prev => ({ ...prev, query: item.query }))
                      setShowHistory(false)
                      // 약간의 딜레이 후 검색 실행 (상태 업데이트 대기)
                      setTimeout(() => {
                        handleSearch()
                      }, 50)
                    }}
                  >
                    {item.query}
                  </button>
                  <button
                    type="button"
                    className="ml-2 p-1 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => {
                      e.stopPropagation()
                      removeFromHistory(item.query)
                    }}
                    aria-label={`"${item.query}" 삭제`}
                    title="삭제"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* 스크린 리더용 힌트 */}
          <span id="search-history-hint" className="sr-only">
            최근 검색어가 있으면 아래 드롭다운에서 선택할 수 있습니다
          </span>
        </div>

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
