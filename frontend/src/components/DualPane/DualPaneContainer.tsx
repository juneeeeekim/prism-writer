// =============================================================================
// PRISM Writer - Dual Pane Container
// =============================================================================
// 파일: frontend/src/components/DualPane/DualPaneContainer.tsx
// 역할: 왼쪽(에디터) + 오른쪽(어시스턴트) 화면 분할 레이아웃
// 접근성: aria-label 적용
// 모바일: 에디터 전체화면 + 플로팅 버튼으로 어시스턴트 오버레이 전환
// =============================================================================

'use client'

import { useState, useCallback, useRef, useEffect } from 'react'

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------
interface DualPaneContainerProps {
  /** 왼쪽 패널 (에디터) */
  editorPane: React.ReactNode
  /** 오른쪽 패널 (어시스턴트) */
  assistantPane: React.ReactNode
  /** 초기 에디터 패널 너비 (%) */
  initialEditorWidth?: number
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------
export default function DualPaneContainer({
  editorPane,
  assistantPane,
  initialEditorWidth = 50,
}: DualPaneContainerProps) {
  // 에디터 패널 너비 상태 (%)
  const [editorWidth, setEditorWidth] = useState(initialEditorWidth)
  const [isDragging, setIsDragging] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // ---------------------------------------------------------------------------
  // 모바일 감지 + 어시스턴트 오버레이 토글
  // ---------------------------------------------------------------------------
  const [isMobile, setIsMobile] = useState(false)
  const [showMobileAssistant, setShowMobileAssistant] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    setIsMobile(mq.matches)
    const handler = (e: MediaQueryListEvent) => {
      setIsMobile(e.matches)
      if (!e.matches) setShowMobileAssistant(false) // 데스크톱 전환 시 오버레이 닫기
    }
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  // ESC 키로 오버레이 닫기
  useEffect(() => {
    if (!showMobileAssistant) return
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowMobileAssistant(false)
    }
    document.addEventListener('keydown', handleEsc)
    return () => document.removeEventListener('keydown', handleEsc)
  }, [showMobileAssistant])

  // 오버레이 열릴 때 body 스크롤 방지
  useEffect(() => {
    if (showMobileAssistant) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [showMobileAssistant])

  // ---------------------------------------------------------------------------
  // Resize Handler (드래그로 패널 크기 조절)
  // ---------------------------------------------------------------------------
  const handleMouseDown = useCallback(() => {
    setIsDragging(true)
  }, [])

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDragging || !containerRef.current) return

      const containerRect = containerRef.current.getBoundingClientRect()
      const newWidth = ((e.clientX - containerRect.left) / containerRect.width) * 100

      // 최소 20%, 최대 80% 제한
      const clampedWidth = Math.min(Math.max(newWidth, 20), 80)
      setEditorWidth(clampedWidth)
    },
    [isDragging]
  )

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
  }, [])

  // ---------------------------------------------------------------------------
  // Keyboard Accessibility (화살표 키로 리사이즈)
  // ---------------------------------------------------------------------------
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    const step = 2 // 2% 씩 이동
    if (e.key === 'ArrowLeft') {
      setEditorWidth((prev) => Math.max(prev - step, 20))
    } else if (e.key === 'ArrowRight') {
      setEditorWidth((prev) => Math.min(prev + step, 80))
    }
  }, [])

  // ---------------------------------------------------------------------------
  // 모바일 렌더링: 에디터 전체화면 + 플로팅 버튼 + 오버레이 어시스턴트
  // ---------------------------------------------------------------------------
  if (isMobile) {
    return (
      <div className="h-full relative">
        {/* 에디터 전체화면 */}
        <div
          className="h-full bg-white dark:bg-gray-900"
          aria-label="글쓰기 영역"
          role="region"
        >
          {editorPane}
        </div>

        {/* 플로팅 토글 버튼 */}
        {!showMobileAssistant && (
          <button
            onClick={() => setShowMobileAssistant(true)}
            className="fixed bottom-6 right-4 z-40 w-14 h-14 rounded-full
                       bg-prism-primary text-white shadow-lg
                       flex items-center justify-center
                       active:scale-95 transition-transform"
            aria-label="어시스턴트 패널 열기"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </button>
        )}

        {/* 어시스턴트 오버레이 (전체화면) */}
        {showMobileAssistant && (
          <div className="fixed inset-0 z-50 flex flex-col bg-gray-50 dark:bg-gray-800">
            {/* 오버레이 헤더 */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
              <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                AI 어시스턴트
              </h2>
              <button
                onClick={() => setShowMobileAssistant(false)}
                className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                aria-label="어시스턴트 패널 닫기"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            {/* 어시스턴트 콘텐츠 */}
            <div className="flex-1 overflow-hidden">
              {assistantPane}
            </div>
          </div>
        )}
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // 데스크톱 렌더링: 기존 좌우 분할 레이아웃
  // ---------------------------------------------------------------------------
  return (
    <div
      ref={containerRef}
      className="dual-pane-container h-full"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* 왼쪽: 에디터 패널 */}
      <div
        className="editor-pane bg-white dark:bg-gray-900"
        style={{ width: `${editorWidth}%` }}
        aria-label="글쓰기 영역"
        role="region"
      >
        {editorPane}
      </div>

      {/* 리사이즈 드래거 (Divider) */}
      <div
        className={`pane-divider ${isDragging ? 'dragging' : ''}`}
        onMouseDown={handleMouseDown}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        role="separator"
        aria-orientation="vertical"
        aria-label="패널 크기 조절 (좌우 화살표 키 사용 가능)"
        aria-valuenow={editorWidth}
        aria-valuemin={20}
        aria-valuemax={80}
      />

      {/* 오른쪽: 어시스턴트 패널 */}
      <div
        className="assistant-pane bg-gray-50 dark:bg-gray-800"
        style={{ width: `${100 - editorWidth}%` }}
        aria-label="RAG 어시스턴트 영역"
        role="region"
      >
        {assistantPane}
      </div>
    </div>
  )
}
