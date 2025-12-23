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
import ReferenceItem from './ReferenceItem' // Phase 3: 신규 컴포넌트
import { searchDocuments, RAGSearchError } from '@/lib/api/rag'
import { useDocumentStatus } from '@/hooks/useDocumentStatus' // Phase 3: 신규 Hook

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
  // 업로드 섹션 State
  // -------------------------------------------------------------------------
  const [showUploader, setShowUploader] = useState(false)
  
  // Phase 3: 실시간 문서 상태 조회 Hook 사용
  const { documents, mutate: refreshDocuments } = useDocumentStatus()

  // ---------------------------------------------------------------------------
  // Search Handler
  // ---------------------------------------------------------------------------
  const handleSearch = async () => {
    if (!query.trim()) return
    
    setIsSearching(true)
    
    try {
      // -----------------------------------------------------------------------
      // 실제 RAG 검색 API 호출
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
      // 에러 처리
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
          자료 업로드 섹션
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
          <div className="mt-3 space-y-3">
            <DocumentUploader 
              onUploadSuccess={() => refreshDocuments()}
            />
            
            {/* ---------------------------------------------------------------
                업로드된 파일 목록 (Phase 3: 실시간 상태 표시)
                --------------------------------------------------------------- */}
            <div className="max-h-40 overflow-y-auto space-y-2 border border-gray-200 dark:border-gray-700 rounded-lg p-2 bg-white dark:bg-gray-800">
              {documents.length === 0 ? (
                <div className="text-center text-sm text-gray-500 py-4">
                  업로드된 문서가 없습니다.
                </div>
              ) : (
                documents.map((doc) => (
                  <div 
                    key={doc.id} 
                    className="flex items-center justify-between p-2 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded transition-colors"
                  >
                    <div className="flex-1 min-w-0 mr-2">
                      <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {doc.title}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {(doc.file_size / 1024).toFixed(1)} KB
                      </div>
                    </div>
                    <ReferenceItem 
                      status={doc.status} 
                      errorMessage={doc.error_message}
                    />
                  </div>
                ))
              )}
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
