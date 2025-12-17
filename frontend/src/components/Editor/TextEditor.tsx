// =============================================================================
// PRISM Writer - Text Editor Component with Auto-Save
// =============================================================================
// 파일: frontend/src/components/editor/TextEditor.tsx
// 역할: 텍스트 입력 영역 + 글자 수 카운터 + 자동 저장 (debounce 500ms)
// 접근성: aria-label, role 적용
// Phase 1: RAG 시스템 구축 체크리스트 1.2 항목
// =============================================================================

'use client'

import { useState, useCallback, useEffect, useRef } from 'react'

// =============================================================================
// Types
// =============================================================================
interface TextEditorProps {
  /** 초기 텍스트 값 */
  initialValue?: string
  /** 텍스트 변경 시 콜백 */
  onChange?: (text: string) => void
  /** 플레이스홀더 텍스트 */
  placeholder?: string
  /** localStorage 저장 키 */
  storageKey?: string
  /** 최대 글자 수 (경고용) */
  maxLength?: number
  /** 자동 저장 활성화 여부 */
  autoSave?: boolean
  /** 자동 저장 딜레이 (ms) */
  autoSaveDelay?: number
}

// =============================================================================
// Debounce Hook
// =============================================================================
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      clearTimeout(timer)
    }
  }, [value, delay])

  return debouncedValue
}

// =============================================================================
// Component
// =============================================================================
export default function TextEditor({
  initialValue = '',
  onChange,
  placeholder = '글을 작성하세요...',
  storageKey = 'prism-writer-draft',
  maxLength = 10000,
  autoSave = true,
  autoSaveDelay = 500,
}: TextEditorProps) {
  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------
  const [text, setText] = useState<string>(initialValue)
  const [isSaving, setIsSaving] = useState<boolean>(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Debounced text for auto-save
  const debouncedText = useDebounce(text, autoSaveDelay)

  // ---------------------------------------------------------------------------
  // Load from localStorage on mount
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (autoSave && storageKey) {
      try {
        const saved = localStorage.getItem(storageKey)
        if (saved && !initialValue) {
          setText(saved)
        }
      } catch (error) {
        console.warn('localStorage 읽기 실패:', error)
      }
    }
  }, [autoSave, storageKey, initialValue])

  // ---------------------------------------------------------------------------
  // Auto-save to localStorage
  // ---------------------------------------------------------------------------
  const saveToLocalStorage = useCallback((content: string) => {
    if (!autoSave || !storageKey) return

    setIsSaving(true)
    setSaveError(null)

    try {
      localStorage.setItem(storageKey, content)
      setLastSaved(new Date())
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '저장 실패'
      setSaveError(`자동 저장 실패: ${errorMessage}`)
      console.error('localStorage 저장 실패:', error)
    } finally {
      setIsSaving(false)
    }
  }, [autoSave, storageKey])

  // Trigger auto-save when debounced text changes
  useEffect(() => {
    if (debouncedText !== initialValue) {
      saveToLocalStorage(debouncedText)
    }
  }, [debouncedText, saveToLocalStorage, initialValue])

  // ---------------------------------------------------------------------------
  // Text Change Handler
  // ---------------------------------------------------------------------------
  const handleTextChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value
    setText(newText)
    onChange?.(newText)
  }, [onChange])

  // ---------------------------------------------------------------------------
  // Character Count & Status
  // ---------------------------------------------------------------------------
  const charCount = text.length
  const isOverLimit = charCount > maxLength
  const isNearLimit = charCount > maxLength * 0.9

  // Determine counter status class
  const getCounterClass = () => {
    if (isOverLimit) return 'character-counter danger'
    if (isNearLimit) return 'character-counter warning'
    return 'character-counter'
  }

  // ---------------------------------------------------------------------------
  // Format last saved time
  // ---------------------------------------------------------------------------
  const formatLastSaved = (date: Date | null) => {
    if (!date) return ''
    const hours = date.getHours().toString().padStart(2, '0')
    const minutes = date.getMinutes().toString().padStart(2, '0')
    return `${hours}:${minutes}`
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="flex flex-col h-full">
      {/* -----------------------------------------------------------------------
          Text Input Area
          ----------------------------------------------------------------------- */}
      <div className="flex-1 relative">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleTextChange}
          placeholder={placeholder}
          className="w-full h-full p-4 resize-none border-none outline-none
                     bg-white dark:bg-gray-900 
                     text-gray-900 dark:text-white
                     placeholder-gray-400 dark:placeholder-gray-500
                     text-base leading-relaxed"
          aria-label="글 입력 영역"
          aria-describedby="char-counter save-status"
        />
      </div>

      {/* -----------------------------------------------------------------------
          Status Bar (글자 수 카운터 + 저장 상태)
          ----------------------------------------------------------------------- */}
      <div className="flex items-center justify-between px-4 py-2 
                      border-t border-gray-200 dark:border-gray-700
                      bg-gray-50 dark:bg-gray-800">
        {/* 글자 수 카운터 */}
        <div id="char-counter" className={getCounterClass()}>
          <span className="font-medium">{charCount.toLocaleString()}</span>
          <span className="text-gray-400 dark:text-gray-500"> / {maxLength.toLocaleString()}자</span>
          {isOverLimit && (
            <span className="ml-2 text-red-500">
              (초과: {(charCount - maxLength).toLocaleString()}자)
            </span>
          )}
        </div>

        {/* 저장 상태 */}
        <div id="save-status" className="text-sm text-gray-500 dark:text-gray-400">
          {isSaving && (
            <span className="flex items-center gap-1">
              <span className="animate-pulse">●</span>
              저장 중...
            </span>
          )}
          {!isSaving && saveError && (
            <span className="text-red-500" role="alert">
              {saveError}
            </span>
          )}
          {!isSaving && !saveError && lastSaved && (
            <span>
              마지막 저장: {formatLastSaved(lastSaved)}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

// =============================================================================
// Named Export
// =============================================================================
export { TextEditor }
