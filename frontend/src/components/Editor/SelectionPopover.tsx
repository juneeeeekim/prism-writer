// =============================================================================
// PRISM Writer - Selection Popover Component
// =============================================================================
// 파일: frontend/src/components/Editor/SelectionPopover.tsx
// 역할: 텍스트 선택 시 "근거 찾기" 팝오버 표시
// 참고: [Deep Scholar 체크리스트 P3-01]
// =============================================================================

'use client'

import { useState, useEffect, useCallback } from 'react'

// =============================================================================
// Types
// =============================================================================

interface SelectionPopoverProps {
  /** 근거 찾기 클릭 시 콜백 */
  onResearchClick: (selectedText: string) => void
  /** 컴포넌트 활성화 여부 (Feature Flag 연동) */
  enabled?: boolean
}

interface PopoverPosition {
  x: number
  y: number
  visible: boolean
}

// =============================================================================
// Constants
// =============================================================================

/** 팝오버 표시를 위한 최소 선택 문자 수 */
const MIN_SELECTION_LENGTH = 10

/** 팝오버 Y 오프셋 (선택 영역 위에 표시) */
const POPOVER_Y_OFFSET = 40

// =============================================================================
// Component: SelectionPopover
// =============================================================================

/**
 * Selection Popover - 텍스트 선택 시 팝오버 표시
 *
 * @description
 * [시니어 개발자 주석]
 * - 10자 이상 텍스트 선택 시 팝오버 표시
 * - "🔍 근거 찾기" 버튼 클릭 시 콜백 호출
 * - 선택 영역 위에 고정 위치로 표시
 * - cleanup 함수로 이벤트 리스너 해제 (메모리 누수 방지)
 */
export default function SelectionPopover({
  onResearchClick,
  enabled = true,
}: SelectionPopoverProps) {
  // ---------------------------------------------------------------------------
  // [P3-01-01] State
  // ---------------------------------------------------------------------------
  const [position, setPosition] = useState<PopoverPosition>({
    x: 0,
    y: 0,
    visible: false,
  })
  const [selectedText, setSelectedText] = useState<string>('')

  // ---------------------------------------------------------------------------
  // [P3-01-02] Hide Popover Handler
  // ---------------------------------------------------------------------------
  const hidePopover = useCallback(() => {
    setPosition((prev) => ({ ...prev, visible: false }))
  }, [])

  // ---------------------------------------------------------------------------
  // [P3-01-03] Research Click Handler
  // ---------------------------------------------------------------------------
  const handleResearchClick = useCallback(() => {
    if (selectedText) {
      onResearchClick(selectedText)
      hidePopover()
    }
  }, [selectedText, onResearchClick, hidePopover])

  // ---------------------------------------------------------------------------
  // [P3-01-04] Mouse Up Event Handler (텍스트 선택 감지)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    // Feature Flag로 비활성화된 경우 이벤트 리스너 등록 안 함
    if (!enabled) return

    // [P3-04] setTimeout cleanup 추가 — 언마운트 시 메모리 누수 방지 (2026-02-17 Audit)
    let mouseUpTimerId: ReturnType<typeof setTimeout> | null = null

    const handleMouseUp = () => {
      // 약간의 딜레이로 선택 완료 후 처리 (브라우저 선택 동작 완료 대기)
      mouseUpTimerId = setTimeout(() => {
        const selection = window.getSelection()
        const text = selection?.toString().trim()

        // 최소 10자 이상 선택 시에만 팝오버 표시
        if (text && text.length >= MIN_SELECTION_LENGTH) {
          try {
            const range = selection?.getRangeAt(0)
            const rect = range?.getBoundingClientRect()

            if (rect) {
              // 팝오버 위치 계산 (선택 영역 중앙 상단)
              // 스크롤 위치 고려
              const scrollX = window.scrollX || window.pageXOffset
              const scrollY = window.scrollY || window.pageYOffset

              setPosition({
                x: rect.left + scrollX + rect.width / 2,
                y: rect.top + scrollY - POPOVER_Y_OFFSET,
                visible: true,
              })
              setSelectedText(text)
            }
          } catch {
            // 선택 범위가 없거나 오류 발생 시 무시
            hidePopover()
          }
        } else {
          hidePopover()
        }
      }, 10)
    }

    // 다른 곳 클릭 시 팝오버 숨기기
    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      // 팝오버 자체를 클릭한 경우는 제외
      if (!target.closest('.selection-popover')) {
        hidePopover()
      }
    }

    // 스크롤 시 팝오버 숨기기 (위치 계산 복잡성 방지)
    const handleScroll = () => {
      hidePopover()
    }

    // ---------------------------------------------------------------------------
    // [P3-01-05] Event Listeners 등록
    // ---------------------------------------------------------------------------
    document.addEventListener('mouseup', handleMouseUp)
    document.addEventListener('mousedown', handleMouseDown)
    window.addEventListener('scroll', handleScroll, true)

    // ---------------------------------------------------------------------------
    // [P3-01-06] Cleanup 함수 (메모리 누수 방지)
    // [P3-04] setTimeout cleanup 추가 (2026-02-17 Audit)
    // ---------------------------------------------------------------------------
    return () => {
      if (mouseUpTimerId) clearTimeout(mouseUpTimerId)
      document.removeEventListener('mouseup', handleMouseUp)
      document.removeEventListener('mousedown', handleMouseDown)
      window.removeEventListener('scroll', handleScroll, true)
    }
  }, [enabled, hidePopover])

  // ---------------------------------------------------------------------------
  // [P3-01-07] Render
  // ---------------------------------------------------------------------------
  // 비활성화 또는 숨김 상태면 렌더링 안 함
  if (!enabled || !position.visible) return null

  return (
    <div
      className="selection-popover fixed z-50 transform -translate-x-1/2"
      style={{
        top: `${position.y}px`,
        left: `${position.x}px`,
      }}
    >
      {/* -----------------------------------------------------------------------
          [P3-01-07-A] Popover Container
          ----------------------------------------------------------------------- */}
      <div
        className="bg-gray-900 dark:bg-gray-800 text-white px-3 py-2 rounded-lg shadow-xl
                   border border-gray-700 dark:border-gray-600
                   animate-in fade-in slide-in-from-bottom-2 duration-200"
      >
        {/* Research Button */}
        <button
          onClick={handleResearchClick}
          className="flex items-center gap-2 text-sm font-medium
                     hover:text-prism-primary transition-colors
                     focus:outline-none focus:ring-2 focus:ring-prism-primary/50 rounded"
        >
          <span>🔍</span>
          <span>근거 찾기</span>
        </button>
      </div>

      {/* -----------------------------------------------------------------------
          [P3-01-07-B] Popover Arrow (삼각형 화살표)
          ----------------------------------------------------------------------- */}
      <div
        className="absolute left-1/2 transform -translate-x-1/2 -bottom-2
                   w-0 h-0 border-l-[8px] border-r-[8px] border-t-[8px]
                   border-l-transparent border-r-transparent border-t-gray-900 dark:border-t-gray-800"
      />
    </div>
  )
}
