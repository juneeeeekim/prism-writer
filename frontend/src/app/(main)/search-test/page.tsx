// =============================================================================
// PRISM Writer - Search Test Page
// =============================================================================
// 파일: frontend/src/app/search-test/page.tsx
// 역할: Phase 5 검색 기능 테스트 페이지
// =============================================================================

'use client'

import { useState, useCallback } from 'react'

// =============================================================================
// 타입 정의
// =============================================================================

/** 검색 결과 아이템 */
interface SearchResultItem {
  chunk_id: string
  document_id: string
  content: string
  score: number
  metadata: Record<string, any>
}

/** 성능 측정 결과 */
interface PerformanceMetrics {
  startTime: number
  endTime: number
  duration: number
  resultCount: number
}

// =============================================================================
// 검색 테스트 페이지 컴포넌트
// =============================================================================

export default function SearchTestPage() {
  // ---------------------------------------------------------------------------
  // 상태 관리
  // ---------------------------------------------------------------------------
  const [query, setQuery] = useState('')
  const [topK, setTopK] = useState(5)
  const [category, setCategory] = useState('미분류')  // [보안] 카테고리 격리 필터
  const [results, setResults] = useState<SearchResultItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null)

  // ---------------------------------------------------------------------------
  // 검색 실행 핸들러
  // ---------------------------------------------------------------------------
  const handleSearch = useCallback(async () => {
    if (!query.trim()) {
      setError('검색어를 입력해주세요.')
      return
    }

    setLoading(true)
    setError(null)
    setResults([])
    setMetrics(null)

    const startTime = performance.now()

    try {
      const response = await fetch('/api/rag/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: query.trim(),
          topK,
          category,  // [보안] 카테고리 격리 필터
        }),
      })

      const endTime = performance.now()
      const duration = endTime - startTime

      const data = await response.json()

      if (!response.ok) {
        setError(data.message || '검색 중 오류가 발생했습니다.')
        return
      }

      if (data.success && data.results) {
        setResults(data.results)
        setMetrics({
          startTime,
          endTime,
          duration,
          resultCount: data.results.length,
        })
      } else {
        setError(data.message || '검색 결과가 없습니다.')
      }
    } catch (err) {
      console.error('Search error:', err)
      setError('서버 연결에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }, [query, topK, category])

  // ---------------------------------------------------------------------------
  // 렌더링
  // ---------------------------------------------------------------------------
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-4xl mx-auto">
        {/* 헤더 */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            🔍 RAG 검색 테스트
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Phase 5: 벡터 검색 엔진 테스트 페이지
          </p>
        </div>

        {/* 검색 폼 */}
        <section className="mb-8 bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            검색 쿼리 입력
          </h2>
          
          <div className="space-y-4">
            {/* 쿼리 입력 */}
            <div>
              <label 
                htmlFor="search-query" 
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
              >
                검색어
              </label>
              <input
                id="search-query"
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="검색할 내용을 입력하세요..."
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg 
                           bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                           focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* [보안] 카테고리 필터 */}
            <div>
              <label
                htmlFor="category-filter"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
              >
                카테고리 (격리 검색)
              </label>
              <input
                id="category-filter"
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="카테고리 입력"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                           bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                           focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* Top-K 설정 */}
            <div>
              <label
                htmlFor="top-k"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
              >
                결과 개수 (Top-K): {topK}
              </label>
              <input
                id="top-k"
                type="range"
                min="1"
                max="20"
                value={topK}
                onChange={(e) => setTopK(Number(e.target.value))}
                className="w-full"
              />
            </div>

            {/* 검색 버튼 */}
            <button
              onClick={handleSearch}
              disabled={loading}
              className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400
                       text-white font-medium rounded-lg transition-colors
                       focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              {loading ? '검색 중...' : '🔍 검색 실행'}
            </button>
          </div>
        </section>

        {/* 에러 메시지 */}
        {error && (
          <div className="mb-8 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-red-700 dark:text-red-400">❌ {error}</p>
          </div>
        )}

        {/* 성능 측정 결과 */}
        {metrics && (
          <section className="mb-8 bg-green-50 dark:bg-green-900/20 rounded-lg p-6 border border-green-200 dark:border-green-800">
            <h2 className="text-xl font-semibold text-green-900 dark:text-green-300 mb-4">
              ⚡ 성능 측정 결과
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white dark:bg-gray-800 p-4 rounded-lg">
                <p className="text-sm text-gray-600 dark:text-gray-400">검색 시간</p>
                <p className={`text-2xl font-bold ${
                  metrics.duration < 500 
                    ? 'text-green-600 dark:text-green-400' 
                    : 'text-red-600 dark:text-red-400'
                }`}>
                  {metrics.duration.toFixed(2)} ms
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                  {metrics.duration < 500 ? '✅ 목표(500ms) 달성!' : '⚠️ 목표 초과'}
                </p>
              </div>
              <div className="bg-white dark:bg-gray-800 p-4 rounded-lg">
                <p className="text-sm text-gray-600 dark:text-gray-400">결과 개수</p>
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {metrics.resultCount}개
                </p>
              </div>
            </div>
          </section>
        )}

        {/* 검색 결과 */}
        {results.length > 0 && (
          <section className="mb-8 bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              📋 검색 결과 ({results.length}개)
            </h2>
            <div className="space-y-4">
              {results.map((result, index) => (
                <div
                  key={result.chunk_id}
                  className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg"
                >
                  {/* 결과 헤더 */}
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
                      #{index + 1}
                    </span>
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      result.score >= 0.8 
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                        : result.score >= 0.5
                        ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                        : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                    }`}>
                      유사도: {(result.score * 100).toFixed(1)}%
                    </span>
                  </div>
                  
                  {/* 청크 내용 */}
                  <p className="text-gray-700 dark:text-gray-300 text-sm whitespace-pre-wrap">
                    {result.content}
                  </p>
                  
                  {/* 메타데이터 */}
                  <div className="mt-2 flex items-center gap-4 text-xs text-gray-500 dark:text-gray-500">
                    <span>청크 ID: {result.chunk_id.slice(0, 8)}...</span>
                    <span>문서 ID: {result.document_id.slice(0, 8)}...</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 테스트 안내 */}
        <section className="p-6 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
          <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-300 mb-3">
            ℹ️ 테스트 방법
          </h3>
          <ol className="list-decimal list-inside space-y-2 text-blue-800 dark:text-blue-400 text-sm">
            <li>먼저 로그인이 필요합니다 (인증이 필요한 API)</li>
            <li>문서를 업로드하고 임베딩이 완료되어야 합니다 (/documents-test)</li>
            <li>검색어를 입력하고 &quot;검색 실행&quot; 버튼을 클릭하세요</li>
            <li>성능 측정 결과에서 검색 시간을 확인하세요 (목표: 500ms 미만)</li>
            <li>검색 결과의 정확도(유사도 점수)를 확인하세요</li>
          </ol>
        </section>
      </div>
    </div>
  )
}
