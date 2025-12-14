// =============================================================================
// PRISM Writer - Reference Tab
// =============================================================================
// 파일: frontend/src/components/Assistant/ReferenceTab.tsx
// 역할: 참고자료 검색 및 삽입
// =============================================================================

'use client'

import { useState } from 'react'
import ReferenceCard from './ReferenceCard'

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------
interface Reference {
  id: string
  content: string
  source: string
  similarity: number
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------
export default function ReferenceTab() {
  const [query, setQuery] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [references, setReferences] = useState<Reference[]>([])

  // ---------------------------------------------------------------------------
  // Search Handler
  // ---------------------------------------------------------------------------
  const handleSearch = async () => {
    if (!query.trim()) return
    
    setIsSearching(true)
    
    try {
      // TODO: 실제 API 연동 (Phase 3에서 구현)
      // const response = await fetch('/api/v1/search', { ... })
      
      // 임시 더미 데이터
      const dummyReferences: Reference[] = [
        {
          id: '1',
          content: 'RAG(Retrieval-Augmented Generation)는 검색과 생성을 결합한 AI 기술로, 외부 지식 베이스에서 관련 정보를 검색하여 LLM의 답변을 강화합니다.',
          source: 'AI 기술 개요.pdf (p.12)',
          similarity: 0.92,
        },
        {
          id: '2',
          content: '효과적인 글쓰기는 명확한 구조, 논리적 흐름, 그리고 독자를 고려한 표현이 핵심입니다.',
          source: '글쓰기 가이드.md',
          similarity: 0.87,
        },
        {
          id: '3',
          content: '벡터 검색은 텍스트를 고차원 벡터로 변환하여 의미적 유사성을 계산하는 방식입니다.',
          source: '기술 문서.txt (섹션 3)',
          similarity: 0.81,
        },
      ]
      
      // 로딩 시뮬레이션
      await new Promise(resolve => setTimeout(resolve, 800))
      
      setReferences(dummyReferences)
    } catch (err) {
      console.error('검색 실패:', err)
    } finally {
      setIsSearching(false)
    }
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="p-4 space-y-4">
      {/* 검색 입력 */}
      <div className="flex gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          placeholder="참고할 내용 검색..."
          className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                     bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                     focus:ring-2 focus:ring-prism-primary focus:border-transparent"
          aria-label="참고자료 검색"
        />
        <button
          onClick={handleSearch}
          disabled={isSearching}
          className="px-4 py-2 bg-prism-primary text-white rounded-lg
                     hover:bg-prism-accent transition-colors disabled:opacity-50"
          aria-label="검색"
        >
          {isSearching ? '⏳' : '🔍'}
        </button>
      </div>

      {/* 검색 결과 */}
      <div className="space-y-3">
        {references.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <p className="text-4xl mb-2">📚</p>
            <p>검색어를 입력하면 관련 문서를 찾아드립니다.</p>
          </div>
        ) : (
          references.map((ref) => (
            <ReferenceCard
              key={ref.id}
              id={ref.id}
              content={ref.content}
              source={ref.source}
              similarity={ref.similarity}
            />
          ))
        )}
      </div>
    </div>
  )
}
