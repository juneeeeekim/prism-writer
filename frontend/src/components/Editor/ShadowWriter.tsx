// =============================================================================
// PRISM Writer - Shadow Writer Component
// =============================================================================
// 파일: frontend/src/components/Editor/ShadowWriter.tsx
// 역할: 실시간 문장 완성 제안 (Ghost Text) 기능이 포함된 에디터
// 참고: [Shadow Writer 체크리스트 P2-01]
// =============================================================================

'use client'

import { useState, useCallback, useEffect, useRef, type KeyboardEvent } from 'react'

// =============================================================================
// Types
// =============================================================================

/** Shadow Writer 컴포넌트 Props */
interface ShadowWriterProps {
  /** 현재 텍스트 값 */
  text: string
  /** 텍스트 변경 시 콜백 */
  onChange: (text: string) => void
  /** 프로젝트 ID (RAG 컨텍스트용) */
  projectId?: string
  /** Shadow Writer 활성화 여부 (Feature Flag 연동) */
  enabled?: boolean
  /** 플레이스홀더 텍스트 */
  placeholder?: string
  /** 최대 글자 수 (경고용) */
  maxLength?: number
  /** Trigger Mode: 'auto' | 'sentence-end' | 'manual' */
  triggerMode?: 'auto' | 'sentence-end' | 'manual'
}

/** API 응답 타입 */
interface SuggestResponse {
  success: boolean
  suggestion: string
  error?: string
}

// =============================================================================
// Constants
// =============================================================================

/** API 호출 Debounce 딜레이 (ms) */
const DEBOUNCE_DELAY = 500

/** 최소 문맥 길이 (이보다 짧으면 제안 안 함) */
const MIN_CONTEXT_LENGTH = 10

// =============================================================================
// Hooks
// =============================================================================

/**
 * Debounce Hook
 * @param value - 디바운스할 값
 * @param delay - 딜레이 (ms)
 * @returns 디바운스된 값
 */
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
// Helper: API 호출
// =============================================================================

/**
 * /api/suggest 엔드포인트 호출
 * @param text - 전체 텍스트
 * @param cursorPosition - 커서 위치
 * @param projectId - 프로젝트 ID (선택)
 * @returns 제안된 문장
 */
async function fetchSuggestion(
  text: string,
  cursorPosition: number,
  projectId?: string
): Promise<string> {
  try {
    const response = await fetch('/api/suggest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, cursorPosition, projectId }),
    })

    if (!response.ok) {
      console.warn('[ShadowWriter] API 응답 오류:', response.status)
      return ''
    }

    const data: SuggestResponse = await response.json()
    return data.success ? data.suggestion : ''
  } catch (error) {
    console.warn('[ShadowWriter] API 호출 실패:', error)
    return ''
  }
}

// =============================================================================
// Sub-Component: Ghost Text Overlay
// =============================================================================

/**
 * Ghost Text 오버레이 컴포넌트
 * - 회색 반투명 텍스트로 제안 표시
 * - 클릭/선택 불가 (pointer-events: none)
 * - 스크린리더 무시 (aria-hidden)
 */
function GhostTextOverlay({ text }: { text: string }) {
  if (!text) return null

  return (
    <span
      className="ghost-text-overlay text-gray-400 dark:text-gray-500 opacity-60"
      style={{
        pointerEvents: 'none',
        userSelect: 'none',
      }}
      aria-hidden="true"
    >
      {text}
    </span>
  )
}

// =============================================================================
// Main Component: Shadow Writer
// =============================================================================

export default function ShadowWriter({
  text,
  onChange,
  projectId,
  enabled = true,
  placeholder = '글을 작성하세요...',
  maxLength = 10000,
  triggerMode = 'auto',
}: ShadowWriterProps) {
  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------
  const [suggestion, setSuggestion] = useState<string>('')
  const [cursorPosition, setCursorPosition] = useState<number>(text.length)
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Debounced text for API calls (auto 모드)
  const debouncedText = useDebounce(text, DEBOUNCE_DELAY)

  // ---------------------------------------------------------------------------
  // Effect: Auto Mode - 자동 제안 fetch
  // ---------------------------------------------------------------------------
  useEffect(() => {
    // [Safety] 비활성화 시 API 호출 차단
    if (!enabled) {
      setSuggestion('')
      return
    }

    // [Safety] 문맥이 너무 짧으면 스킵
    if (debouncedText.length < MIN_CONTEXT_LENGTH) {
      setSuggestion('')
      return
    }

    // Trigger Mode 분기
    if (triggerMode === 'auto') {
      // Auto Mode: Debounce 후 자동 호출
      fetchSuggestionAndUpdate()
    } else if (triggerMode === 'sentence-end') {
      // Sentence-End Mode: 문장 종결 부호 후에만 호출
      const trimmed = debouncedText.trim()
      if (/[.!?]$/.test(trimmed)) {
        fetchSuggestionAndUpdate()
      }
    }
    // manual 모드는 단축키로 처리 (이 useEffect에서는 아무것도 안 함)

    async function fetchSuggestionAndUpdate() {
      setIsLoading(true)
      const result = await fetchSuggestion(debouncedText, cursorPosition, projectId)
      setSuggestion(result)
      setIsLoading(false)
    }
  }, [debouncedText, cursorPosition, projectId, enabled, triggerMode])

  // ---------------------------------------------------------------------------
  // Handler: 텍스트 변경
  // ---------------------------------------------------------------------------
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newText = e.target.value
      const newCursor = e.target.selectionStart || newText.length

      onChange(newText)
      setCursorPosition(newCursor)

      // 텍스트 변경 시 기존 제안 초기화
      setSuggestion('')
    },
    [onChange]
  )

  // ---------------------------------------------------------------------------
  // Handler: 키보드 이벤트 (Tab으로 제안 수락, Escape로 제안 취소)
  // ---------------------------------------------------------------------------
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      // Tab: 제안 수락
      if (e.key === 'Tab' && suggestion) {
        e.preventDefault()
        
        // 커서 위치에 제안 삽입
        const before = text.substring(0, cursorPosition)
        const after = text.substring(cursorPosition)
        const newText = before + suggestion + after
        
        onChange(newText)
        setCursorPosition(cursorPosition + suggestion.length)
        setSuggestion('')
        return
      }

      // Escape: 제안 취소
      if (e.key === 'Escape' && suggestion) {
        e.preventDefault()
        setSuggestion('')
        return
      }

      // Ctrl+Shift+Space: Manual 모드에서 수동 호출
      if (triggerMode === 'manual' && e.ctrlKey && e.shiftKey && e.key === ' ') {
        e.preventDefault()
        fetchSuggestion(text, cursorPosition, projectId).then(setSuggestion)
        return
      }
    },
    [text, suggestion, cursorPosition, onChange, triggerMode, projectId]
  )

  // ---------------------------------------------------------------------------
  // Handler: 커서 위치 업데이트
  // ---------------------------------------------------------------------------
  const handleSelect = useCallback((e: React.SyntheticEvent<HTMLTextAreaElement>) => {
    const target = e.target as HTMLTextAreaElement
    setCursorPosition(target.selectionStart || 0)
  }, [])

  // ---------------------------------------------------------------------------
  // Derived State
  // ---------------------------------------------------------------------------
  const charCount = text.length
  const isOverLimit = charCount > maxLength
  const isNearLimit = charCount > maxLength * 0.9

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="shadow-writer-container flex flex-col h-full">
      {/* -----------------------------------------------------------------------
          Text Input Area with Ghost Text
          ----------------------------------------------------------------------- */}
      <div className="flex-1 relative">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onSelect={handleSelect}
          onClick={handleSelect}
          placeholder={placeholder}
          className="w-full h-full p-4 resize-none border-none outline-none
                     bg-white dark:bg-gray-900 
                     text-gray-900 dark:text-white
                     placeholder-gray-400 dark:placeholder-gray-500
                     text-base leading-relaxed"
          aria-label="글 입력 영역"
          aria-describedby="char-counter suggestion-hint"
        />
        
        {/* Ghost Text Hint (우측 하단) */}
        {suggestion && (
          <div 
            className="absolute bottom-16 right-4 max-w-md p-2 
                       bg-gray-100 dark:bg-gray-800 
                       border border-gray-200 dark:border-gray-700 
                       rounded-lg shadow-sm"
            id="suggestion-hint"
          >
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
              💡 Tab으로 적용 | Esc로 취소
            </div>
            <GhostTextOverlay text={suggestion} />
          </div>
        )}

        {/* Loading Indicator */}
        {isLoading && (
          <div className="absolute bottom-16 right-4 p-2 text-xs text-gray-400">
            ⏳ 제안 생성 중...
          </div>
        )}
      </div>

      {/* -----------------------------------------------------------------------
          Status Bar (글자 수 카운터)
          ----------------------------------------------------------------------- */}
      <div className="flex items-center justify-between px-4 py-2 
                      border-t border-gray-200 dark:border-gray-700
                      bg-gray-50 dark:bg-gray-800">
        {/* 글자 수 카운터 */}
        <div 
          id="char-counter" 
          className={`text-sm ${
            isOverLimit ? 'text-red-500' : 
            isNearLimit ? 'text-yellow-500' : 
            'text-gray-500 dark:text-gray-400'
          }`}
        >
          <span className="font-medium">{charCount.toLocaleString()}</span>
          <span className="text-gray-400 dark:text-gray-500"> / {maxLength.toLocaleString()}자</span>
          {isOverLimit && (
            <span className="ml-2 text-red-500">
              (초과: {(charCount - maxLength).toLocaleString()}자)
            </span>
          )}
        </div>

        {/* Shadow Writer 상태 표시 */}
        <div className="text-xs text-gray-400 dark:text-gray-500">
          {enabled ? (
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              Shadow Writer 활성
              {triggerMode !== 'auto' && ` (${triggerMode})`}
            </span>
          ) : (
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 bg-gray-400 rounded-full" />
              Shadow Writer 비활성
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
export { ShadowWriter, GhostTextOverlay }
