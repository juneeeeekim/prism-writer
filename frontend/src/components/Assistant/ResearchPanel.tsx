// =============================================================================
// PRISM Writer - Research Panel Component
// =============================================================================
// 파일: frontend/src/components/Assistant/ResearchPanel.tsx
// 역할: Deep Scholar 검색 패널 (검색 입력 + 결과 목록)
// 참고: [Deep Scholar 체크리스트 P2-01]
// =============================================================================

'use client'

import { useState, useCallback } from 'react'
import { useToast } from '@/hooks/useToast'
import ResearchCard from './ResearchCard'
import type { SummarizedResult } from '@/lib/research/resultSummarizer'

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
 * 1. 검색 쿼리 입력
 * 2. API 호출 (/api/research)
 * 3. 결과 카드 목록 표시
 * 4. 인용 삽입 기능
 */
export default function ResearchPanel({
  selectedText,
  onInsert,
}: ResearchPanelProps) {
  // ---------------------------------------------------------------------------
  // [P2-01-01] State
  // ---------------------------------------------------------------------------
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SummarizedResult[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchedQuery, setSearchedQuery] = useState<string | null>(null)
  // [다국어 검색 P2-01-A] 언어 선택 상태 (2026-01-09 추가)
  const [language, setLanguage] = useState<'ko' | 'en' | 'all'>('all')

  const toast = useToast()

  // ---------------------------------------------------------------------------
  // [P2-01-02] Search Handler
  // ---------------------------------------------------------------------------
  const handleSearch = useCallback(async () => {
    // 빈 쿼리 검증
    if (!query.trim()) {
      toast.warning('검색할 내용을 입력해주세요.')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      // [다국어 검색 P2-01-C] language 파라미터 전달 (2026-01-09)
      const response = await fetch('/api/research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userQuery: query,
          context: selectedText || '',
          language,  // 언어 선택 전달
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
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '알 수 없는 오류'
      setError(errorMessage)
      toast.error(`검색 실패: ${errorMessage}`)
    } finally {
      setIsLoading(false)
    }
  }, [query, selectedText, language, toast])  // [다국어 검색] language 의존성 추가

  // ---------------------------------------------------------------------------
  // [P2-01-03] Insert Handler
  // ---------------------------------------------------------------------------
  const handleInsert = useCallback((citation: Citation) => {
    if (onInsert) {
      onInsert(citation)
      toast.success('인용이 삽입되었습니다.')
    } else {
      // onInsert가 없으면 클립보드에 복사
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
      {/* -----------------------------------------------------------------------
          [P2-01-05-A] Header
          ----------------------------------------------------------------------- */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-1">
          🔍 Deep Scholar
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          학술 논문, 정부 자료에서 신뢰할 수 있는 정보를 검색합니다.
        </p>
      </div>

      {/* -----------------------------------------------------------------------
          [P2-01-05-B] Search Input
          ----------------------------------------------------------------------- */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex gap-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="예: AI 시장 규모 통계, 기후 변화 최신 연구..."
            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600
                       rounded-lg bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200
                       placeholder-gray-400 dark:placeholder-gray-500
                       focus:outline-none focus:ring-2 focus:ring-prism-primary/50"
            disabled={isLoading}
          />
          <button
            onClick={handleSearch}
            disabled={isLoading || !query.trim()}
            className={`px-4 py-2 rounded-lg font-medium transition-colors
              ${isLoading || !query.trim()
                ? 'bg-gray-300 dark:bg-gray-700 text-gray-500 cursor-not-allowed'
                : 'bg-prism-primary text-white hover:bg-prism-primary/90'
              }`}
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <span className="animate-spin">⏳</span>
                검색 중...
              </span>
            ) : (
              '🔍 검색'
            )}
          </button>
        </div>

        {/* =====================================================================
            [다국어 검색 P2-01-B] 언어 선택 버튼 그룹 (2026-01-09 추가)
            ===================================================================== */}
        <div className="flex gap-2 mt-3">
          <span className="text-xs text-gray-500 dark:text-gray-400 self-center mr-1">
            검색 범위:
          </span>
          <button
            onClick={() => setLanguage('ko')}
            disabled={isLoading}
            className={`px-3 py-1.5 text-xs rounded-full transition-colors
              ${language === 'ko'
                ? 'bg-prism-primary text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }
              ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}
            `}
          >
            🇰🇷 한국어
          </button>
          <button
            onClick={() => setLanguage('en')}
            disabled={isLoading}
            className={`px-3 py-1.5 text-xs rounded-full transition-colors
              ${language === 'en'
                ? 'bg-prism-primary text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }
              ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}
            `}
          >
            🌐 English
          </button>
          <button
            onClick={() => setLanguage('all')}
            disabled={isLoading}
            className={`px-3 py-1.5 text-xs rounded-full transition-colors
              ${language === 'all'
                ? 'bg-prism-primary text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }
              ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}
            `}
          >
            🌍 모든 언어
          </button>
        </div>

        {/* 언어별 도메인 힌트 */}
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

      {/* -----------------------------------------------------------------------
          [P2-01-05-C] Results Area
          ----------------------------------------------------------------------- */}
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
        {results.length > 0 ? (
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
        ) : !isLoading && !error && (
          /* Empty State */
          <div className="flex flex-col items-center justify-center py-12 text-gray-500 dark:text-gray-400">
            <span className="text-4xl mb-4">📚</span>
            <p className="text-lg font-medium">검색 결과가 없습니다</p>
            <p className="text-sm mt-1">
              학술 논문, 통계, 정부 자료를 검색해보세요.
            </p>
          </div>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-12">
            <span className="text-4xl animate-bounce mb-4">🔍</span>
            <p className="text-gray-500 dark:text-gray-400">
              학술/정부 자료에서 검색 중...
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
              arxiv.org, .edu, .gov 등에서 신뢰할 수 있는 정보를 찾고 있습니다.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
