// =============================================================================
// Phase 12: Category Accordion Component (Phase 13: Sort Order)
// =============================================================================
// 파일: frontend/src/components/documents/CategoryAccordion.tsx
// 역할: 카테고리별 문서 그룹을 접기/펼치기 가능한 아코디언으로 표시 + 순서 변경
// 생성일: 2025-12-28
// 수정일: 2025-12-28 (Phase 13 - 순서 변경 버튼 추가)
// =============================================================================

import { useState } from 'react'
import type { UserDocumentPreview } from '@/types/document'
import DocumentCard from './DocumentCard'

interface CategoryAccordionProps {
  category: string
  documents: UserDocumentPreview[]
  onDelete: (id: string) => Promise<void>
  onReorder?: (items: { id: string; sort_order: number }[]) => Promise<void> // Phase 13
  defaultOpen?: boolean
}

export default function CategoryAccordion({
  category,
  documents,
  onDelete,
  onReorder, // Phase 13
  defaultOpen = true
}: CategoryAccordionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  // ---------------------------------------------------------------------------
  // Phase 13: 순서 변경 핸들러
  // ---------------------------------------------------------------------------
  const handleMove = async (docId: string, direction: 'first' | 'prev' | 'next' | 'last') => {
    if (!onReorder) return
    
    // 현재 카테고리의 문서들 복사 (정렬된 상태 가정)
    const currentDocs = [...documents]
    const currentIndex = currentDocs.findIndex(d => d.id === docId)
    if (currentIndex === -1) return

    let newDocs = [...currentDocs]
    const [movedDoc] = newDocs.splice(currentIndex, 1)

    // 위치 이동
    if (direction === 'first') {
      newDocs.unshift(movedDoc)
    } else if (direction === 'prev') {
      if (currentIndex > 0) {
        newDocs.splice(currentIndex - 1, 0, movedDoc)
      } else {
        return // 이미 첫 번째
      }
    } else if (direction === 'next') {
      if (currentIndex < newDocs.length) {
        newDocs.splice(currentIndex + 1, 0, movedDoc)
      } else {
        return // 이미 마지막
      }
    } else if (direction === 'last') {
      newDocs.push(movedDoc)
    }

    // sort_order 재할당 (0부터 순차적)
    const reorderedItems = newDocs.map((doc, index) => ({
      id: doc.id,
      sort_order: index // 단순 인덱스 기반 재정렬
    }))

    await onReorder(reorderedItems)
  }

  return (
    <div className="mb-6">
      {/* 카테고리 헤더 (접기/펼치기 버튼) */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-2 p-3 bg-gray-100 
                   dark:bg-gray-800 rounded-lg hover:bg-gray-200 
                   dark:hover:bg-gray-700 transition-colors text-left"
        aria-expanded={isOpen}
        aria-controls={`category-${category}`}
      >
        {/* 펼치기/접기 아이콘 */}
        <span 
          className="text-gray-600 dark:text-gray-400 transition-transform duration-200"
          style={{ transform: isOpen ? 'rotate(0deg)' : 'rotate(-90deg)' }}
        >
          ▼
        </span>
        
        {/* 폴더 아이콘 */}
        <span className="text-lg">📁</span>
        
        {/* 카테고리 이름 */}
        <span className="font-semibold text-gray-900 dark:text-gray-100 flex-1">
          {category}
          <span className="ml-2 text-sm font-normal text-gray-500 dark:text-gray-400">
            ({documents.length})
          </span>
        </span>
      </button>

      {/* 문서 카드 그리드 (접기/펼치기 상태에 따라 표시) */}
      {isOpen && (
        <div 
          id={`category-${category}`}
          className="flex flex-col gap-2 mt-3 pl-4 border-l-2 border-gray-200 
                     dark:border-gray-700 animate-fadeIn"
        >
          {documents.map((doc, index) => (
            <div key={doc.id} className="group flex items-center gap-2">
              {/* Phase 13: 순서 변경 버튼 (hover 시 표시) */}
              {onReorder && (
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button 
                    onClick={() => handleMove(doc.id, 'first')}
                    title="맨 앞으로"
                    disabled={index === 0}
                    className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded disabled:opacity-30"
                  >
                    ⏮️
                  </button>
                  <button 
                    onClick={() => handleMove(doc.id, 'prev')}
                    title="앞으로"
                    disabled={index === 0}
                    className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded disabled:opacity-30"
                  >
                    ◀️
                  </button>
                  <button 
                    onClick={() => handleMove(doc.id, 'next')}
                    title="뒤로"
                    disabled={index === documents.length - 1}
                    className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded disabled:opacity-30"
                  >
                    ▶️
                  </button>
                  <button 
                    onClick={() => handleMove(doc.id, 'last')}
                    title="맨 뒤로"
                    disabled={index === documents.length - 1}
                    className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded disabled:opacity-30"
                  >
                    ⏭️
                  </button>
                </div>
              )}

              {/* 문서 카드 (기존 그리드 -> 리스트 형태로 변경 필요하거나 감싸기) */}
              <div className="flex-1">
                 <DocumentCard 
                  {...doc} 
                  onDelete={onDelete} 
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
