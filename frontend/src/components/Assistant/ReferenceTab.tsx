// =============================================================================
// PRISM Writer - Reference Tab
// =============================================================================
// 파일: frontend/src/components/Assistant/ReferenceTab.tsx
// 역할: 참고자료 검색 및 삽입
// =============================================================================

'use client'

import { useState } from 'react'
import ReferenceCard from './ReferenceCard'
import DocumentUploader from '@/components/documents/DocumentUploader'
import DocumentList from '@/components/documents/DocumentList'
import { searchDocuments, RAGSearchError } from '@/lib/api/rag'

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
  // -------------------------------------------------------------------------
  // 업로드 섹션 State (Phase 1 추가)
  // -------------------------------------------------------------------------
  const [showUploader, setShowUploader] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  // ---------------------------------------------------------------------------
  // Search Handler (Phase 3: 실제 RAG API 연동)
  // ---------------------------------------------------------------------------
  const handleSearch = async () => {
    if (!query.trim()) return
    
    setIsSearching(true)
    
    try {
      // -----------------------------------------------------------------------
      // 실제 RAG 검색 API 호출 (Phase 3 구현)
      // -----------------------------------------------------------------------
      const result = await searchDocuments(query, { topK: 5, threshold: 0.5 })
      
      // API 응답 → Reference 형식 변환
      const mappedRefs: Reference[] = result.documents.map((doc) => ({
        id: doc.chunkId,
        content: doc.content,
        source: doc.sourceUri || '업로드된 문서',
        similarity: doc.scoreComponents.vector || 0,
      }))
      
      setReferences(mappedRefs)
    } catch (err) {
      // -----------------------------------------------------------------------
      // 에러 처리 (Phase 3: RAGSearchError 타입 체크)
      // -----------------------------------------------------------------------
      if (err instanceof RAGSearchError) {
        console.error('검색 오류:', err.code, err.message)
      } else {
        console.error('검색 실패:', err)
      }
      setReferences([])
    } finally {
      setIsSearching(false)
    }
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="p-4 space-y-4">
      {/* ---------------------------------------------------------------
          자료 업로드 섹션 (Phase 1 추가)
          --------------------------------------------------------------- */}
      <div className="mb-4">
        <button
          onClick={() => setShowUploader(!showUploader)}
          className="w-full flex items-center justify-between px-4 py-3 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/30 transition-colors"
          aria-expanded={showUploader}
          aria-label="자료 업로드 섹션 열기/닫기"
        >
          <span className="font-medium">📤 자료 업로드</span>
          <span className="text-xl">{showUploader ? '▲' : '▼'}</span>
        </button>
        
        {showUploader && (
          <div className="mt-3">
            <DocumentUploader 
              onUploadSuccess={() => setRefreshKey(prev => prev + 1)}
            />
            {/* ---------------------------------------------------------------
                업로드된 파일 목록 (Phase 2 추가)
                --------------------------------------------------------------- */}
            <div className="mt-3 max-h-40 overflow-y-auto">
              <DocumentList 
                key={refreshKey}
                onDocumentDeleted={() => setRefreshKey(prev => prev + 1)}
                className="text-sm"
              />
            </div>
          </div>
        )}
      </div>

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
