
'use client'

import { useState, useEffect } from 'react'
import DocumentListPanel from './DocumentListPanel'
import ActiveContextPanel from './ActiveContextPanel'
import { useDocumentStatus } from '@/hooks/useDocumentStatus'

// =============================================================================
// Reference Studio Container (Mobile Responsive)
// =============================================================================
// Desktop (≥768px): 2-Pane Layout (List | Detail)
// Mobile (<768px): Stack Navigation (List ↔ Detail)
// =============================================================================

// =============================================================================
// [localStorage] 참고자료 선택 상태 저장 키
// - Cross-Device 동기화 불가 (v1 제한사항)
// - v2에서 DB 기반 user_preferences 테이블 검토 예정
// =============================================================================
const SELECTED_DOC_KEY = 'prism_ref_selected_doc'

export default function ReferenceStudioContainer() {
  // ===========================================================================
  // [localStorage] 선택 상태 초기화 - localStorage에서 복원
  // ===========================================================================
  const [selectedDocId, setSelectedDocId] = useState<string | null>(() => {
    // SSR 환경에서는 localStorage 접근 불가
    if (typeof window === 'undefined') return null
    
    const saved = localStorage.getItem(SELECTED_DOC_KEY)
    return saved || null
  })
  
  // Mobile Navigation State
  // 'list' = show document list, 'detail' = show active context
  const [mobileView, setMobileView] = useState<'list' | 'detail'>('list')
  
  // Data Fetching
  const { documents, mutate: refreshDocuments } = useDocumentStatus()

  // ===========================================================================
  // [localStorage] 선택 상태 변경 시 저장
  // ===========================================================================
  useEffect(() => {
    if (selectedDocId) {
      localStorage.setItem(SELECTED_DOC_KEY, selectedDocId)
    } else {
      localStorage.removeItem(SELECTED_DOC_KEY)
    }
  }, [selectedDocId])

  // =============================================================================
  // Event Handlers
  // =============================================================================
  
  // Mobile-aware document selection
  const handleSelectDoc = (id: string | null) => {
    setSelectedDocId(id)
    
    // On mobile, switch to detail view when a document is selected
    if (id !== null) {
      setMobileView('detail')
    }
  }

  // Mobile back button handler
  const handleBackToList = () => {
    setMobileView('list')
    // Optionally deselect document: setSelectedDocId(null)
  }

  // Delete Handler
  const handleDeleteDoc = async (id: string) => {
    if (!confirm('정말 이 문서를 삭제하시겠습니까?\n모든 학습 데이터(Chunk)도 함께 삭제됩니다.')) return
    
    try {
      const res = await fetch(`/api/documents?id=${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('삭제 실패')
      
      // If selected doc was deleted, deselect it and return to list on mobile
      if (selectedDocId === id) {
        setSelectedDocId(null)
        setMobileView('list')
      }
      
      refreshDocuments()
    } catch (err) {
      console.error('문서 삭제 중 오류:', err)
      alert('문서 삭제에 실패했습니다.')
    }
  }

  // =============================================================================
  // Render
  // =============================================================================

  return (
    <div className="flex h-[calc(100vh-12rem)] min-h-[500px] border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden shadow-sm bg-white dark:bg-gray-800">
      
      {/* ========================================================================
          Desktop: 2-Pane Layout (Always visible on md+)
          Mobile: Stack Navigation (Conditional rendering)
          ======================================================================== */}
      
      {/* Left Panel: Document List */}
      <div className={`
        w-full md:w-1/3 md:min-w-[300px] h-full
        ${mobileView === 'detail' ? 'hidden md:block' : 'block'}
      `}>
        <DocumentListPanel 
          documents={documents}
          selectedDocId={selectedDocId}
          onSelectDoc={handleSelectDoc}
          onRefresh={refreshDocuments}
          onDeleteDoc={handleDeleteDoc}
          className="h-full"
        />
      </div>

      {/* Right Panel: Active Context */}
      <div className={`
        w-full md:flex-1 h-full bg-white dark:bg-gray-800
        ${mobileView === 'list' ? 'hidden md:block' : 'block'}
      `}>
        <ActiveContextPanel 
          selectedDocId={selectedDocId}
          className="h-full"
          // Mobile Back Button (only visible on mobile when detail is shown)
          onBack={handleBackToList}
          showBackButton={mobileView === 'detail'}
        />
      </div>
    </div>
  )
}
