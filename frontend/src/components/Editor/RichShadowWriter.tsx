// =============================================================================
// PRISM Writer - Rich Shadow Writer Component (TipTap)
// =============================================================================
// 파일: frontend/src/components/Editor/RichShadowWriter.tsx
// 역할: TipTap 기반 Rich Text Editor with Muted Text 기능
// 참고: [Muted Text 체크리스트 P2-01]
// =============================================================================
//
// [기능 설명]
// - TipTap 에디터를 사용한 Rich Text 편집
// - MutedMark Extension을 통한 "비강조" 텍스트 스타일 지원
// - 기존 ShadowWriter와 동일한 Props 인터페이스 유지 (호환성)
//
// [사용 예시]
// <RichShadowWriter
//   text={content}
//   onChange={handleContentChange}
//   projectId={projectId}
//   enabled={true}
//   fontSize={16}
//   placeholder="글을 작성하세요..."
// />
//
// =============================================================================

'use client'

import { useEffect, useCallback, useState, useRef } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import { BubbleMenuPlugin } from '@tiptap/extension-bubble-menu'
import { MutedMark } from './extensions/MutedMark'
import { logger } from '@/lib/utils/logger'

// =============================================================================
// Types
// =============================================================================

/** RichShadowWriter 컴포넌트 Props (기존 ShadowWriter와 호환) */
interface RichShadowWriterProps {
  /** 현재 텍스트 값 (HTML 또는 Plain Text) */
  text: string
  /** 텍스트 변경 시 콜백 (HTML 반환) */
  onChange: (html: string) => void
  /** 프로젝트 ID (RAG 컨텍스트용) */
  projectId?: string
  /** Shadow Writer 활성화 여부 (Feature Flag 연동) */
  enabled?: boolean
  /** 플레이스홀더 텍스트 */
  placeholder?: string
  /** 최대 글자 수 (경고용) */
  maxLength?: number
  /** Trigger Mode: Ghost Text 트리거 방식 */
  triggerMode?: 'auto' | 'sentence-end' | 'manual'
  /** [Font Size Control] 폰트 크기 (px) */
  fontSize?: number
}

/** [Phase 2-03] Ghost Text API 응답 타입 */
interface SuggestResponse {
  success: boolean
  suggestion: string
  error?: string
}

// =============================================================================
// Constants
// =============================================================================

/** 글자 수 경고 임계값 (90%) */
const WARNING_THRESHOLD = 0.9

/** BubbleMenu 플러그인 키 */
const BUBBLE_MENU_PLUGIN_KEY = 'richShadowWriterBubbleMenu'

/** [Phase 2-03] API 호출 Debounce 딜레이 (ms) */
const DEBOUNCE_DELAY = 500

/** [Phase 2-03] 최소 문맥 길이 (이보다 짧으면 제안 안 함) */
const MIN_CONTEXT_LENGTH = 10

// =============================================================================
// [P3-03] Content Format Detection & Conversion Utilities
// =============================================================================
// [시니어 개발자 주석]
// 기존 사용자 데이터(Plain Text)와의 호환성을 위한 유틸리티 함수들
// - TipTap은 HTML을 네이티브로 사용하지만, 기존 데이터는 Plain Text일 수 있음
// - 불러올 때: Plain Text → HTML 자동 변환
// - 저장할 때: HTML 유지 (TipTap 네이티브)
// =============================================================================

/**
 * 콘텐츠가 HTML 형식인지 감지
 * @param content - 확인할 콘텐츠
 * @returns HTML 형식이면 true
 */
function isHtmlContent(content: string): boolean {
  if (!content) return false
  
  // 기본 HTML 태그 패턴 검사 (TipTap이 생성하는 태그들)
  const htmlTagPattern = /<(p|h[1-6]|ul|ol|li|br|strong|em|span|blockquote|code|pre|hr)[^>]*>/i
  return htmlTagPattern.test(content)
}

/**
 * Plain Text를 TipTap 호환 HTML로 변환
 * @param plainText - 변환할 Plain Text
 * @returns TipTap 호환 HTML
 * 
 * [변환 규칙]
 * - 빈 줄로 구분된 문단 → <p> 태그로 래핑
 * - 단일 줄바꿈 → <br> 태그
 * - 빈 텍스트 → 빈 <p> 태그 (TipTap 기본값)
 */
function convertPlainTextToHtml(plainText: string): string {
  if (!plainText) return '<p></p>'
  
  // 문단 분리 (빈 줄 기준)
  const paragraphs = plainText.split(/\n\s*\n/)
  
  // 각 문단을 <p> 태그로 래핑, 단일 줄바꿈은 <br>로 변환
  const htmlParagraphs = paragraphs.map(paragraph => {
    const trimmed = paragraph.trim()
    if (!trimmed) return ''
    
    // 단일 줄바꿈을 <br>로 변환
    const withBreaks = trimmed.replace(/\n/g, '<br>')
    return `<p>${withBreaks}</p>`
  })
  
  // 빈 문단 제거 후 결합
  return htmlParagraphs.filter(Boolean).join('') || '<p></p>'
}

/**
 * HTML을 Plain Text로 변환 (API 호출용)
 * @param html - 변환할 HTML
 * @returns Plain Text
 */
function convertHtmlToPlainText(html: string): string {
  if (!html) return ''
  
  // HTML 태그 제거 (간단한 버전 - TipTap의 getText()도 사용 가능)
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>\s*<p[^>]*>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .trim()
}

// =============================================================================
// [Phase 2-03] Hooks: Debounce
// =============================================================================

/**
 * Debounce Hook - 값 변경 시 딜레이 후 업데이트
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
// [Phase 2-03] Helper: Ghost Text API 호출
// =============================================================================

/**
 * /api/suggest 엔드포인트 호출
 * @param text - 전체 텍스트 (Plain Text)
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
      logger.warn('[RichShadowWriter]', 'API 응답 오류', { status: response.status })
      return ''
    }

    const data: SuggestResponse = await response.json()
    return data.success ? data.suggestion : ''
  } catch (error) {
    logger.warn('[RichShadowWriter]', 'API 호출 실패', { error: String(error) })
    return ''
  }
}

// =============================================================================
// [Phase 2-03] Sub-Component: Ghost Text Overlay
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
// Main Component: Rich Shadow Writer
// =============================================================================

export default function RichShadowWriter({
  text,
  onChange,
  projectId,
  enabled = true,
  placeholder = '글을 작성하세요...',
  maxLength = 10000,
  triggerMode = 'auto',
  fontSize = 16,
}: RichShadowWriterProps) {
  // ---------------------------------------------------------------------------
  // TipTap Editor Instance
  // ---------------------------------------------------------------------------
  const editor = useEditor({
    extensions: [
      // 기본 확장: 제목, 단락, 볼드, 이탤릭, 리스트 등
      StarterKit.configure({
        // Heading 레벨 제한 (h1-h3만 허용)
        heading: {
          levels: [1, 2, 3],
        },
      }),
      // Placeholder 확장
      Placeholder.configure({
        placeholder,
        emptyEditorClass: 'is-editor-empty',
      }),
      // [Phase 1] MutedMark 확장 (비강조 텍스트)
      MutedMark,
    ],
    // ---------------------------------------------------------------------------
    // [P3-03] 초기 콘텐츠: Plain Text → HTML 자동 변환
    // 기존 사용자 데이터(Plain Text)와의 호환성 유지
    // ---------------------------------------------------------------------------
    content: isHtmlContent(text) ? text : convertPlainTextToHtml(text),
    // ---------------------------------------------------------------------------
    // 에디터 업데이트 콜백
    // ---------------------------------------------------------------------------
    onUpdate: ({ editor }) => {
      const html = editor.getHTML()
      onChange(html)
    },
    // ---------------------------------------------------------------------------
    // SSR 안전성: 클라이언트에서만 렌더링
    // ---------------------------------------------------------------------------
    immediatelyRender: false,
  })

  // ---------------------------------------------------------------------------
  // [Phase 2] BubbleMenu Ref - 플러그인에서 사용할 DOM 요소 참조
  // ---------------------------------------------------------------------------
  const bubbleMenuRef = useRef<HTMLDivElement>(null)

  // ---------------------------------------------------------------------------
  // [Phase 2-03] Ghost Text State
  // ---------------------------------------------------------------------------
  const [suggestion, setSuggestion] = useState<string>('')
  const [isLoading, setIsLoading] = useState<boolean>(false)

  // Plain Text 추출 (API 호출용) - HTML 태그 제거
  const plainText = editor?.getText() ?? ''

  // Debounced text for API calls
  const debouncedText = useDebounce(plainText, DEBOUNCE_DELAY)

  // 커서 위치 (TipTap selection anchor)
  const cursorPosition = editor?.state.selection.anchor ?? 0

  // ---------------------------------------------------------------------------
  // [P3-03] Effect: 외부에서 text prop 변경 시 에디터 내용 동기화
  // Plain Text → HTML 자동 변환 적용 (Backward Compatibility)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (editor && text !== editor.getHTML()) {
      // 외부에서 content가 변경된 경우에만 업데이트
      // (사용자 입력 중 깜빡임 방지)
      const currentContent = editor.getHTML()
      if (text !== currentContent) {
        // [P3-03] Plain Text인 경우 HTML로 변환
        const normalizedContent = isHtmlContent(text) ? text : convertPlainTextToHtml(text)
        
        // TipTap v3: emitUpdate를 false로 설정하여 onChange 콜백 중복 호출 방지
        editor.commands.setContent(normalizedContent, { emitUpdate: false })
      }
    }
  }, [text, editor])

  // ---------------------------------------------------------------------------
  // [Phase 2] Effect: BubbleMenu 플러그인 등록
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!editor || !bubbleMenuRef.current) return

    // BubbleMenu 플러그인 생성 및 등록
    const plugin = BubbleMenuPlugin({
      pluginKey: BUBBLE_MENU_PLUGIN_KEY,
      editor,
      element: bubbleMenuRef.current,
      updateDelay: 100,
      options: {
        placement: 'top',
      },
    })

    editor.registerPlugin(plugin)

    // Cleanup: 컴포넌트 언마운트 시 플러그인 해제
    return () => {
      editor.unregisterPlugin(BUBBLE_MENU_PLUGIN_KEY)
    }
  }, [editor])

  // ---------------------------------------------------------------------------
  // [Phase 2-03] Effect: Ghost Text 자동 제안 fetch
  // ---------------------------------------------------------------------------
  useEffect(() => {
    // [Safety] 비활성화 시 API 호출 차단
    if (!enabled || !editor) {
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
    // manual 모드는 단축키로 처리

    async function fetchSuggestionAndUpdate() {
      setIsLoading(true)
      const result = await fetchSuggestion(debouncedText, cursorPosition, projectId)
      setSuggestion(result)
      setIsLoading(false)
    }
  }, [debouncedText, cursorPosition, projectId, enabled, triggerMode, editor])

  // ---------------------------------------------------------------------------
  // [Phase 2-03] Effect: 키보드 이벤트 (Tab/Escape/Ctrl+Shift+Space)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!editor) return

    const handleKeyDown = (event: KeyboardEvent) => {
      // Tab: 제안 수락
      if (event.key === 'Tab' && suggestion) {
        event.preventDefault()

        // 현재 커서 위치에 제안 텍스트 삽입
        editor.chain().focus().insertContent(suggestion).run()
        setSuggestion('')
        return
      }

      // Escape: 제안 취소
      if (event.key === 'Escape' && suggestion) {
        event.preventDefault()
        setSuggestion('')
        return
      }

      // Ctrl+Shift+Space: Manual 모드에서 수동 호출
      if (triggerMode === 'manual' && event.ctrlKey && event.shiftKey && event.key === ' ') {
        event.preventDefault()
        const plainTextNow = editor.getText()
        const cursorNow = editor.state.selection.anchor
        fetchSuggestion(plainTextNow, cursorNow, projectId).then(setSuggestion)
        return
      }
    }

    // 에디터 DOM에 이벤트 리스너 등록
    const editorElement = editor.view.dom
    editorElement.addEventListener('keydown', handleKeyDown)

    return () => {
      editorElement.removeEventListener('keydown', handleKeyDown)
    }
  }, [editor, suggestion, triggerMode, projectId])

  // ---------------------------------------------------------------------------
  // [Phase 2-03] Handler: 텍스트 변경 시 제안 초기화
  // ---------------------------------------------------------------------------
  useEffect(() => {
    // 에디터 내용이 변경되면 기존 제안 초기화
    if (editor) {
      const handleUpdate = () => {
        setSuggestion('')
      }
      editor.on('update', handleUpdate)
      return () => {
        editor.off('update', handleUpdate)
      }
    }
  }, [editor])

  // ---------------------------------------------------------------------------
  // Derived State: 글자 수 계산
  // ---------------------------------------------------------------------------
  const charCount = editor?.storage.characterCount?.characters?.() ?? text.length
  const isOverLimit = charCount > maxLength
  const isNearLimit = charCount > maxLength * WARNING_THRESHOLD

  // ---------------------------------------------------------------------------
  // Early Return: SSR 안전성
  // ---------------------------------------------------------------------------
  if (!editor) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400">
        에디터 로딩 중...
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="rich-shadow-writer-container flex flex-col h-full">
      {/* -----------------------------------------------------------------------
          [Phase 2] Bubble Menu - 텍스트 선택 시 Mute 버튼 표시
          BubbleMenuPlugin이 이 div를 제어하여 선택 영역 위에 표시합니다.
          ----------------------------------------------------------------------- */}
      <div
        ref={bubbleMenuRef}
        className="flex items-center gap-1 p-1 bg-white dark:bg-gray-800
                   border border-gray-200 dark:border-gray-700
                   rounded-lg shadow-lg"
        style={{ visibility: 'hidden', position: 'absolute' }}
      >
        {/* Mute/Unmute 토글 버튼 */}
        <button
          onClick={() => editor.chain().focus().toggleMuted().run()}
          className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all duration-150
                     flex items-center gap-1.5
                     ${editor.isActive('muted')
                       ? 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                       : 'bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 hover:bg-purple-200 dark:hover:bg-purple-900'
                     }`}
          title={editor.isActive('muted') ? '비강조 해제 (원래 스타일로)' : '비강조 처리 (Mute)'}
        >
          <span>{editor.isActive('muted') ? '👁️' : '👻'}</span>
          <span>{editor.isActive('muted') ? '보이기' : '숨기기'}</span>
        </button>
      </div>

      {/* -----------------------------------------------------------------------
          TipTap Editor Content Area
          ----------------------------------------------------------------------- */}
      <div className="flex-1 overflow-auto relative">
        <EditorContent
          editor={editor}
          className="prose prose-lg dark:prose-invert max-w-none h-full
                     px-4 py-4
                     focus:outline-none
                     [&_.ProseMirror]:h-full
                     [&_.ProseMirror]:outline-none
                     [&_.ProseMirror_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)]
                     [&_.ProseMirror_p.is-editor-empty:first-child::before]:text-gray-400
                     [&_.ProseMirror_p.is-editor-empty:first-child::before]:pointer-events-none
                     [&_.ProseMirror_p.is-editor-empty:first-child::before]:float-left
                     [&_.ProseMirror_p.is-editor-empty:first-child::before]:h-0"
          style={{ fontSize: `${fontSize}px` }}
        />

        {/* -------------------------------------------------------------------
            [Phase 2-03] Ghost Text Hint - 제안 표시 (우측 하단)
            ------------------------------------------------------------------- */}
        {suggestion && (
          <div
            className="absolute bottom-4 right-4 max-w-md p-3
                       bg-white dark:bg-gray-800
                       border border-gray-200 dark:border-gray-700
                       rounded-lg shadow-lg z-10"
            id="suggestion-hint"
          >
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-2 flex items-center gap-2">
              <span>💡</span>
              <span>Tab으로 적용 | Esc로 취소</span>
            </div>
            <GhostTextOverlay text={suggestion} />
          </div>
        )}

        {/* [Phase 2-03] Loading Indicator */}
        {isLoading && (
          <div className="absolute bottom-4 right-4 p-2 text-xs text-gray-400
                          bg-white dark:bg-gray-800 rounded-lg shadow-sm
                          border border-gray-200 dark:border-gray-700">
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

        {/* Rich Shadow Writer 상태 표시 */}
        <div className="text-xs text-gray-400 dark:text-gray-500">
          {enabled ? (
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 bg-purple-500 rounded-full animate-pulse" />
              Rich Editor 활성
              {triggerMode !== 'auto' && ` (${triggerMode})`}
            </span>
          ) : (
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 bg-gray-400 rounded-full" />
              Rich Editor 비활성
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
export { RichShadowWriter }
