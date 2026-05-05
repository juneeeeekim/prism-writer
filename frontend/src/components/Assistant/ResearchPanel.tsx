// =============================================================================
// PRISM Writer - Research Panel Component
// =============================================================================
// 파일: frontend/src/components/Assistant/ResearchPanel.tsx
// 역할: Deep Scholar 검색 패널 (검색 입력 + 결과 목록 + 히스토리)
// 참고: [Deep Scholar 체크리스트 P2-01, P3-03]
// =============================================================================

'use client'

import { useState, useCallback, useEffect } from 'react'
import { useToast } from '@/hooks/useToast'
import ResearchCard from './ResearchCard'
import {
  detectTrustBadge,
  type SummarizedResult,
} from '@/lib/research/resultMetadata'

import { useProject } from '@/contexts/ProjectContext'
import { useResearchPersistence } from '@/hooks/useResearchPersistence'
import { useResearchHistory } from '@/hooks/useResearchHistory'

// =============================================================================
// Types
// =============================================================================

/**
 * 인용 데이터 타입
 */
export interface Citation {
  /** 삽입할 텍스트 (Key Fact) */
  text: string
  /** 출처명 */
  source: string
  /** 출처 URL */
  url: string
}

interface ResearchPanelProps {
  /** 드래그된 텍스트 (문맥으로 사용) */
  selectedText?: string
  /** 에디터에 인용 삽입 콜백 */
  onInsert?: (citation: Citation) => void
}

interface ResearchResponse {
  success: boolean
  results: SummarizedResult[]
  rawQuery: string
  message?: string
  error?: string
}

// =============================================================================
// Component: ResearchPanel
// =============================================================================

/**
 * Research Panel - Deep Scholar 검색 패널
 *
 * @description
 * [시니어 개발자 주석]
 * 1. 검색 쿼리 입력 및 실행
 * 2. 결과 카드 목록 표시 (Persistence 적용)
 * 3. 최근 검색어 히스토리 제공
 * 4. 인용 삽입 기능
 */
export default function ResearchPanel({
  selectedText,
  onInsert,
}: ResearchPanelProps) {
  const { currentProject } = useProject()
  const projectId = currentProject?.id || 'default'

  // ---------------------------------------------------------------------------
  // [P3-03-01] Hooks Integration
  // [Search History Sync] deleteHistoryItem 추가
  // ---------------------------------------------------------------------------
  const { saveState, loadState } = useResearchPersistence(projectId)
  const { history, addToHistory, deleteHistoryItem, clearHistory } = useResearchHistory(projectId)
  const toast = useToast()

  // ---------------------------------------------------------------------------
  // [P2-01-01] State
  // ---------------------------------------------------------------------------
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SummarizedResult[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchedQuery, setSearchedQuery] = useState<string | null>(null)
  const [language, setLanguage] = useState<'ko' | 'en' | 'all'>('all')

  // ---------------------------------------------------------------------------
  // [P6-01] View Mode State - 결과/히스토리 뷰 전환
  // ---------------------------------------------------------------------------
  const [viewMode, setViewMode] = useState<'results' | 'history'>('results')

  // ---------------------------------------------------------------------------
  // [P3-03-02] Load Persistence State
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const persisted = loadState()
    if (persisted) {
      setQuery(persisted.query)
      setResults(persisted.results)
      setSearchedQuery(persisted.searchedQuery)
      setLanguage(persisted.language)
    }
  }, [projectId, loadState]) // loadState는 useCallback으로 감싸져 있어 안전

  // ---------------------------------------------------------------------------
  // [P3-03-03] Save Persistence State
  // ---------------------------------------------------------------------------
  useEffect(() => {
    // 결과가 있거나 검색어/언어가 변경되었을 때 저장
    // (빈 상태도 저장하여 초기화 상태 유지)
    saveState({ query, results, searchedQuery, language })
  }, [projectId, query, results, searchedQuery, language, saveState])

  // ---------------------------------------------------------------------------
  // [P2-01-02] Search Handler
  // ---------------------------------------------------------------------------
  const handleSearch = useCallback(async (searchQuery: string = query) => {
    // 빈 쿼리 검증
    if (!searchQuery.trim()) {
      toast.warning('검색할 내용을 입력해주세요.')
      return
    }

    // [P6-05] 검색 시 결과 모드로 전환
    setViewMode('results')
    setIsLoading(true)
    setError(null)
    // 쿼리 상태 업데이트 (히스토리 클릭 시 필요)
    setQuery(searchQuery)

    try {
      const response = await fetch('/api/research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userQuery: searchQuery,
          context: selectedText || '',
          language,
        }),
      })

      const data: ResearchResponse = await response.json()

      if (!response.ok) {
        throw new Error(data.error || '검색 중 오류가 발생했습니다.')
      }

      setResults(data.results || [])
      setSearchedQuery(data.rawQuery)

      if (data.results.length === 0) {
        toast.info('검색 결과가 없습니다. 다른 키워드로 시도해보세요.')
      } else {
        toast.success(`${data.results.length}개의 결과를 찾았습니다.`)
        // [Search History Sync] P4-03: DB에 히스토리 저장 (results 포함)
        addToHistory(searchQuery, data.results, data.results.length)
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '알 수 없는 오류'
      setError(errorMessage)
      toast.error(`검색 실패: ${errorMessage}`)
    } finally {
      setIsLoading(false)
    }
  }, [query, selectedText, language, addToHistory, toast])

  // ---------------------------------------------------------------------------
  // [P2-01-03] Insert Handler
  // ---------------------------------------------------------------------------
  const handleInsert = useCallback((citation: Citation) => {
    if (onInsert) {
      onInsert(citation)
      toast.success('인용이 삽입되었습니다.')
    } else {
      const citationText = `"${citation.text}" — ${citation.source} (${citation.url})`
      navigator.clipboard.writeText(citationText)
      toast.success('인용이 클립보드에 복사되었습니다.')
    }
  }, [onInsert, toast])

  // ---------------------------------------------------------------------------
  // [P2-01-04] Enter 키 핸들러
  // ---------------------------------------------------------------------------
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isLoading) {
      handleSearch()
    }
  }

  // ---------------------------------------------------------------------------
  // [P2-01-05] Render
  // ---------------------------------------------------------------------------
  return (
    <div className="research-panel flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-1">
          🔍 Deep Scholar
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          학술 논문, 정부 자료에서 신뢰할 수 있는 정보를 검색합니다.
        </p>
      </div>

      {/* Search Input */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex gap-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="예: AI 시장 규모 통계..."
            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 
                       rounded-lg bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200
                       placeholder-gray-400 dark:placeholder-gray-500
                       focus:outline-none focus:ring-2 focus:ring-prism-primary/50"
            disabled={isLoading}
          />
          <button
            onClick={() => handleSearch()}
            disabled={isLoading || !query.trim()}
            className={`px-4 py-2 rounded-lg font-medium transition-colors
              ${isLoading || !query.trim()
                ? 'bg-gray-300 dark:bg-gray-700 text-gray-500 cursor-not-allowed'
                : 'bg-prism-primary text-white hover:bg-prism-primary/90'
              }`}
          >
            {isLoading ? '⏳' : '🔍 검색'}
          </button>
        </div>

        {/* Language Selection + History Toggle */}
        <div className="flex gap-2 mt-3 flex-wrap items-center">
          <span className="text-xs text-gray-500 dark:text-gray-400 self-center mr-1">
            검색 범위:
          </span>
          {(['ko', 'en', 'all'] as const).map((lang) => (
            <button
              key={lang}
              onClick={() => setLanguage(lang)}
              disabled={isLoading}
              className={`px-3 py-1.5 text-xs rounded-full transition-colors
                ${language === lang
                  ? 'bg-prism-primary text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }
                ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}
              `}
            >
              {lang === 'ko' ? '🇰🇷 한국어' : lang === 'en' ? '🌐 English' : '🌍 모든 언어'}
            </button>
          ))}

          {/* [P6-02] 히스토리 토글 버튼 - 이전 검색 보기/숨기기 */}
          <div className="flex-1" /> {/* Spacer */}
          <button
            onClick={() => setViewMode(viewMode === 'results' ? 'history' : 'results')}
            className={`px-3 py-1.5 text-xs rounded-full transition-colors
              ${viewMode === 'history'
                ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 ring-1 ring-amber-300 dark:ring-amber-700'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-amber-50 dark:hover:bg-amber-900/20'
              }`}
          >
            🕒 이전 검색{history.length > 0 ? ` (${history.length})` : ''}
          </button>
        </div>

        {/* Domain Hint */}
        <div className="mt-2 text-xs text-gray-400 dark:text-gray-500">
          {language === 'ko' && '📚 RISS, DBpia, KCI, 정부(.go.kr) 등에서 검색'}
          {language === 'en' && '📚 arXiv, PubMed, Nature, .edu, .gov 등에서 검색'}
          {language === 'all' && '📚 국내외 학술 DB 통합 검색'}
        </div>

        {/* Selected Text Context */}
        {selectedText && (
          <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-900/20 rounded text-xs 
                          text-blue-700 dark:text-blue-300">
            📝 선택된 텍스트가 문맥으로 사용됩니다: "{selectedText.substring(0, 50)}..."
          </div>
        )}
      </div>

      {/* Results Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Error Message */}
        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 
                          dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-sm">
            ❌ {error}
          </div>
        )}

        {/* Search Query Info */}
        {searchedQuery && results.length > 0 && (
          <div className="text-xs text-gray-500 dark:text-gray-400">
            🔎 검색어: "{searchedQuery}"
          </div>
        )}

        {/* Results */}
        {/* [P6-03] 조건부 렌더링: viewMode에 따라 결과 또는 히스토리 표시 */}
        {viewMode === 'results' && results.length > 0 ? (
          // 결과 모드: 검색 결과 표시
          results.map((result, idx) => (
            <ResearchCard
              key={`${result.url}-${idx}`}
              result={result}
              onInsert={() => handleInsert({
                text: result.keyFact,
                source: result.source,
                url: result.url,
              })}
            />
          ))
        ) : (viewMode === 'history' || (viewMode === 'results' && results.length === 0)) && !isLoading && !error && history.length > 0 ? (
          /* [P6-03] 히스토리 모드: 토글 버튼 클릭 또는 결과 없을 때 표시 */
          <div className="recent-history">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-400">🕒 최근 검색</h3>
              {/* [Search History Sync] P4-04: 전체 삭제 시 Confirmation */}
              <button 
                onClick={() => {
                  if (confirm('모든 검색 기록을 삭제하시겠습니까?')) {
                    clearHistory()
                  }
                }}
                className="text-xs text-gray-400 hover:text-red-500 transition-colors"
              >
                기록 삭제
              </button>
            </div>
            <ul className="space-y-1">
              {history.map((item) => (
                <li key={item.id} className="flex items-center gap-2">
                  {/* [P6-04] 히스토리 클릭 시 캐시 로드 + 결과 모드 전환 */}
                  <button
                    onClick={() => {
                      setQuery(item.query)
                      setSearchedQuery(item.query)
                      // 캐시된 결과가 있으면 API 호출 없이 즉시 표시
                      if (item.resultsSummary && item.resultsSummary.length > 0) {
                        const cachedResults = item.resultsSummary.map(r => {
                          let hostname = 'unknown'
                          const url = r.url || ''
                          try {
                            if (url) hostname = new URL(url).hostname
                          } catch (e) {
                            // ignore invalid url
                          }
                          return {
                            title: r.title || '',
                            url: url,
                            keyFact: r.keyFact || '',
                            source: hostname,
                            summary: r.keyFact || '요약 내용이 없습니다.',
                            publishedDate: '',
                            trustBadge: detectTrustBadge(url),
                          }
                        })
                        setResults(cachedResults as SummarizedResult[])
                        setViewMode('results')  // [P6-04] 결과 모드로 전환
                        toast.success(`캐시에서 ${item.resultCount}개 결과 로드`)
                      } else {
                        setViewMode('results')  // [P6-04] 결과 모드로 전환
                        handleSearch(item.query)
                      }
                    }}
                    className="flex-1 text-left px-3 py-2 rounded-lg text-sm
                               text-gray-700 dark:text-gray-300 
                               hover:bg-gray-100 dark:hover:bg-gray-800 
                               transition-colors flex justify-between items-center"
                  >
                    <span>{item.query}</span>
                    <span className="text-xs text-gray-400 dark:text-gray-500">
                      {item.resultCount}건
                    </span>
                  </button>
                  {/* [Search History Sync] P4-01: 개별 삭제 버튼 */}
                  <button
                    onClick={() => deleteHistoryItem(item.id)}
                    className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                    title="삭제"
                  >
                    🗑️
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : !isLoading && !error && viewMode === 'results' ? (
          /* Empty State */
          <div className="flex flex-col items-center justify-center py-12 text-gray-500 dark:text-gray-400">
            <span className="text-4xl mb-4">📚</span>
            <p className="text-lg font-medium">검색 결과가 없습니다</p>
            <p className="text-sm mt-1">
              학술 논문, 통계, 정부 자료를 검색해보세요.
            </p>
          </div>
        ) : !isLoading && !error && viewMode === 'history' && history.length === 0 ? (
          /* [P6-03] 히스토리 빈 상태 */
          <div className="flex flex-col items-center justify-center py-12 text-gray-500 dark:text-gray-400">
            <span className="text-4xl mb-4">🕒</span>
            <p className="text-lg font-medium">검색 기록이 없습니다</p>
            <p className="text-sm mt-1">
              검색하면 여기에 기록이 저장됩니다.
            </p>
          </div>
        ) : null}

        {/* Loading State */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-12">
            <span className="text-4xl animate-bounce mb-4">🔍</span>
            <p className="text-gray-500 dark:text-gray-400">
              학술/정부 자료에서 검색 중...
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
              신뢰할 수 있는 정보를 찾고 있습니다.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

