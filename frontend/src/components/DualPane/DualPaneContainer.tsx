// =============================================================================
// PRISM Writer - Dual Pane Container
// =============================================================================
// 파일: frontend/src/components/DualPane/DualPaneContainer.tsx
// 역할: 왼쪽(에디터) + 오른쪽(어시스턴트) 화면 분할 레이아웃
// 접근성: aria-label 적용
// =============================================================================

'use client'

import { useState, useCallback, useRef } from 'react'

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
  // Render
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
