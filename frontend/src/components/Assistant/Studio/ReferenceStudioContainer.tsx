
'use client'

import { useState, useEffect } from 'react'
import DocumentListPanel from './DocumentListPanel'
import ActiveContextPanel from './ActiveContextPanel'
import OnboardingGuide from './OnboardingGuide'
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
// =============================================================================
// [localStorage] 참고자료 선택 상태 저장 키
// - Cross-Device 동기화 불가 (v1 제한사항)
// - v2에서 DB 기반 user_preferences 테이블 검토 예정
// =============================================================================
const SELECTED_DOC_KEY = 'prism_ref_selected_doc'
const PANEL_WIDTH_KEY = 'prism_ref_panel_width'

import { useRef, useCallback } from 'react'

export default function ReferenceStudioContainer() {
  // ===========================================================================
  // [Resizing Logic] Panel Width Management
  // ===========================================================================
  const containerRef = useRef<HTMLDivElement>(null)
  
  // Initial width: Load from localStorage or default to 320px
  const [leftWidth, setLeftWidth] = useState<number>(() => {
    if (typeof window === 'undefined') return 320
    const saved = localStorage.getItem(PANEL_WIDTH_KEY)
    return saved ? parseInt(saved, 10) : 320
  })

  const [isDragging, setIsDragging] = useState(false)

  const startResizing = useCallback(() => {
    setIsDragging(true)
    // Add global cursor style to body to prevent cursor flickering
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }, [])

  const stopResizing = useCallback(() => {
    setIsDragging(false)
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
  }, [])

  const resize = useCallback(
    (mouseMoveEvent: MouseEvent) => {
      if (isDragging && containerRef.current) {
        const containerRect = containerRef.current.getBoundingClientRect()
        // Calculate new width relative to container left
        // min-width: 250px, max-width: containerWidth - 300px
        const newWidth = mouseMoveEvent.clientX - containerRect.left
        const maxLimit = containerRect.width - 300 // Keep at least 300px for right panel
        
        if (newWidth >= 250 && newWidth <= maxLimit) {
          setLeftWidth(newWidth)
        }
      }
    },
    [isDragging]
  )

  // Attach global listeners when dragging
  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', resize)
      window.addEventListener('mouseup', stopResizing)
    }
    return () => {
      window.removeEventListener('mousemove', resize)
      window.removeEventListener('mouseup', stopResizing)
    }
  }, [isDragging, resize, stopResizing])

  // Save width to localStorage on change (debounced slightly by effect nature)
  useEffect(() => {
    localStorage.setItem(PANEL_WIDTH_KEY, leftWidth.toString())
  }, [leftWidth])
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
  const { documents, isLoading, mutate: refreshDocuments } = useDocumentStatus()

  // ===========================================================================
  // [Phase 6.2] 새 프로젝트 온보딩 - 문서 없음 상태 감지
  // ===========================================================================
  const isNewProject = !isLoading && documents.length === 0

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

  // ---------------------------------------------------------------------------
  // [Phase 6.2] 새 프로젝트 온보딩 가이드 표시
  // ---------------------------------------------------------------------------
  if (isNewProject) {
    return (
      <div className="h-[calc(100vh-12rem)] min-h-[500px] border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden shadow-sm">
        <OnboardingGuide
          step={1}
          onUploadSuccess={refreshDocuments}
          className="h-full"
        />
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // 일반 2-Pane 레이아웃
  // ---------------------------------------------------------------------------
  return (
    <div
      ref={containerRef}
      className="flex h-[calc(100vh-12rem)] min-h-[500px] border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden shadow-sm bg-white dark:bg-gray-800"
      style={{ '--left-panel-width': `${leftWidth}px` } as React.CSSProperties}
    >

      {/* ========================================================================
          Desktop: 2-Pane Layout (Always visible on md+)
          Mobile: Stack Navigation (Conditional rendering)
          ======================================================================== */}

      {/* Left Panel: Document List */}
      <div className={`
        w-full md:w-[var(--left-panel-width)] md:flex-none h-full
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

      {/* Resize Handle (Desktop Only) */}
      <div
        className="hidden md:block w-1 h-full cursor-col-resize hover:bg-indigo-300 active:bg-indigo-500 transition-colors z-20 flex-none bg-gray-50 dark:bg-gray-900 border-l border-r border-transparent hover:border-gray-300"
        onMouseDown={startResizing}
        role="separator"
        aria-label="Resize panels"
      />

      {/* Right Panel: Active Context */}
      <div className={`
        w-full md:flex-1 h-full bg-white dark:bg-gray-800 min-w-0
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
