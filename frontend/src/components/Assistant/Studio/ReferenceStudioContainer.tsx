
'use client'

import { useState } from 'react'
import DocumentListPanel from './DocumentListPanel'
import ActiveContextPanel from './ActiveContextPanel'
import { useDocumentStatus } from '@/hooks/useDocumentStatus'

// =============================================================================
// Reference Studio Container (Mobile Responsive)
// =============================================================================
// Desktop (≥768px): 2-Pane Layout (List | Detail)
// Mobile (<768px): Stack Navigation (List ↔ Detail)
// =============================================================================

export default function ReferenceStudioContainer() {
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null)
  
  // Mobile Navigation State
  // 'list' = show document list, 'detail' = show active context
  const [mobileView, setMobileView] = useState<'list' | 'detail'>('list')
  
  // Data Fetching
  const { documents, mutate: refreshDocuments } = useDocumentStatus()

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
