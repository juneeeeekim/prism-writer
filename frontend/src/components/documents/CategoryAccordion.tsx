'use client'

// =============================================================================
// Phase 12: Category Accordion Component
// =============================================================================
// 파일: frontend/src/components/documents/CategoryAccordion.tsx
// 역할: 카테고리별 문서 그룹을 접기/펼치기 가능한 아코디언으로 표시
// 생성일: 2025-12-28
// =============================================================================

import { useState } from 'react'
import type { UserDocumentPreview } from '@/types/document'
import DocumentCard from './DocumentCard'

interface CategoryAccordionProps {
  category: string
  documents: UserDocumentPreview[]
  onDelete: (id: string) => Promise<void>
  defaultOpen?: boolean
}

export default function CategoryAccordion({
  category,
  documents,
  onDelete,
  defaultOpen = true
}: CategoryAccordionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

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
        <span className="font-semibold text-gray-900 dark:text-gray-100">
          {category}
        </span>
        
        {/* 문서 개수 */}
        <span className="text-sm text-gray-500 dark:text-gray-400">
          ({documents.length})
        </span>
      </button>

      {/* 문서 카드 그리드 (접기/펼치기 상태에 따라 표시) */}
      {isOpen && (
        <div 
          id={`category-${category}`}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 
                     gap-4 mt-3 pl-4 border-l-2 border-gray-200 
                     dark:border-gray-700 animate-fadeIn"
        >
          {documents.map((doc) => (
            <DocumentCard 
              key={doc.id} 
              {...doc} 
              onDelete={onDelete} 
            />
          ))}
        </div>
      )}
    </div>
  )
}
