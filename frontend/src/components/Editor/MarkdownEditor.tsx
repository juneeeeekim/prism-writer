'use client'

import { useEffect, useCallback, useState } from 'react'
import dynamic from 'next/dynamic'
import { useEditorState } from '@/hooks/useEditorState'
import { useAutosave, type SaveStatus } from '@/hooks/useAutosave'  // Pipeline v5: Autosave
// [P7-FIX] 프로젝트 Context 추가
import { useProject } from '@/contexts/ProjectContext'
// [P3-01] 전역 테마 Context 사용
import { useTheme } from '@/contexts/ThemeContext'
// [P2-02] 테마 토글 버튼 컴포넌트
import ThemeToggle from '@/components/layout/ThemeToggle'
// 동적 import (SSR 비활성화 - 마크다운 에디터는 클라이언트 전용)
const MDEditor = dynamic(() => import('@uiw/react-md-editor'), { ssr: false })

// 버전 히스토리 패널 — 사용자가 토글한 뒤에만 필요하므로 lazy load
const VersionHistoryPanel = dynamic(() => import('@/components/Editor/VersionHistoryPanel'), {
  ssr: false,
})

// =============================================================================
// Helper: 저장 상태 아이콘 및 텍스트
// =============================================================================
function getSaveStatusDisplay(status: SaveStatus, lastSavedAt: Date | null, error: string | null) {
  switch (status) {
    case 'saving':
      return { icon: '⏳', text: '저장 중...', className: 'text-blue-500' }
    case 'saved':
      return {
        icon: '✅',
        text: lastSavedAt ? `저장됨 ${lastSavedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : '저장됨',
        className: 'text-green-600 dark:text-green-400'
      }
    case 'error':
      return { icon: '❌', text: error || '저장 실패', className: 'text-red-500' }
    default:
      return { icon: '', text: '', className: '' }
  }
}

// -----------------------------------------------------------------------------
// Component (Pipeline v5: Autosave + Ctrl+S 단축키 통합)
// -----------------------------------------------------------------------------
export default function MarkdownEditor() {
  // [P7-FIX] 프로젝트 Context에서 현재 프로젝트 ID 가져오기
  const { currentProject } = useProject()
  const projectId = currentProject?.id ?? null

  const { content, setContent, title, setTitle, documentId } = useEditorState()

  // [Font Size Control] 폰트 크기 조절 (기본값 16px)
  const [fontSize, setFontSize] = useState<number>(16)

  // [Phase A] 버전 히스토리 패널 열림/닫힘
  const [showVersionHistory, setShowVersionHistory] = useState(false)

  // =========================================================================
  // [P3-01] 전역 테마 Context 사용 (기존 로컬 state 대체)
  // - ThemeContext를 통한 전역 테마 상태 관리
  // - localStorage 기반 사용자 선호도 저장 지원
  // - 수동 토글 기능 연동
  // =========================================================================
  const { theme } = useTheme()
  // theme이 null일 경우 (SSR 또는 초기화 전) 기본값 'light' 사용
  const isDarkMode = theme === 'dark'

  const handleZoomIn = () => setFontSize(prev => Math.min(prev + 1, 32))
  const handleZoomOut = () => setFontSize(prev => Math.max(prev - 1, 12)) 

  // =========================================================================
  // [Pipeline v5] Autosave 훅 통합
  // =========================================================================
  const {
    saveStatus,
    lastSavedAt,
    saveError,
    saveNow,
    hasPendingChanges,
    hasLocalBackup,
    restoreFromBackup,
    clearBackup,
  } = useAutosave()

  // =========================================================================
  // [Pipeline v5] Ctrl+S 단축키 지원
  // =========================================================================
  // 주석(시니어 개발자): 브라우저 기본 저장 동작을 막고 수동 저장 실행
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Ctrl+S 또는 Cmd+S (Mac)
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault()
      saveNow()
      console.log('[MarkdownEditor] Manual save triggered (Ctrl+S)')
    }
  }, [saveNow])

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [handleKeyDown])

  // =========================================================================
  // [P3-02] 다크 모드 에디터 스타일 강제 적용 (JavaScript DOM 조작)
  // - CSS 오버라이드가 작동하지 않는 경우를 위한 폴백
  // - 테마 변경 시 에디터 내부 요소 스타일 직접 설정
  // =========================================================================
  useEffect(() => {
    if (theme === null) return // 테마 로드 전

    const applyEditorStyles = () => {
      const container = document.getElementById('markdown-editor-container')
      if (!container) return

      const textColor = isDarkMode ? '#f9fafb' : '#1f2937'
      const bgColor = isDarkMode ? '#1f2937' : '#ffffff'

      // 에디터 내부 모든 텍스트 요소에 색상 적용
      // TipTap/ProseMirror 기반 에디터 + 기존 @uiw/react-md-editor 선택자 모두 포함
      const selectors = [
        // TipTap/ProseMirror 에디터 (실제 사용 중)
        '.tiptap',
        '.ProseMirror',
        '.tiptap.ProseMirror',
        '[contenteditable="true"]',
        '.tiptap p',
        '.ProseMirror p',
        // @uiw/react-md-editor (폴백)
        '.w-md-editor',
        '.w-md-editor-text',
        '.w-md-editor-text-pre',
        '.w-md-editor-text-pre code',
        '.w-md-editor-text-input',
        '.w-md-editor-content',
        '.w-md-editor-area',
        'textarea',
      ]

      selectors.forEach(selector => {
        const elements = container.querySelectorAll(selector)
        elements.forEach(el => {
          const htmlEl = el as HTMLElement
          htmlEl.style.setProperty('color', textColor, 'important')
          htmlEl.style.setProperty('-webkit-text-fill-color', textColor, 'important')
          if (selector === '.w-md-editor' || selector === '.w-md-editor-content' || selector === '.w-md-editor-area') {
            htmlEl.style.setProperty('background-color', bgColor, 'important')
          }
        })
      })
    }

    // 즉시 적용
    applyEditorStyles()

    // 에디터가 늦게 렌더링될 수 있으므로 약간의 지연 후 재적용
    const timeoutId = setTimeout(applyEditorStyles, 100)
    const timeoutId2 = setTimeout(applyEditorStyles, 500)

    // MutationObserver로 에디터 내용 변경 시에도 스타일 유지
    const container = document.getElementById('markdown-editor-container')
    let observer: MutationObserver | null = null

    if (container) {
      observer = new MutationObserver(() => {
        applyEditorStyles()
      })
      observer.observe(container, { childList: true, subtree: true })
    }

    return () => {
      clearTimeout(timeoutId)
      clearTimeout(timeoutId2)
      if (observer) observer.disconnect()
    }
  }, [theme, isDarkMode])

  // =========================================================================
  // [Pipeline v5] 저장 상태 표시 정보
  // =========================================================================
  const statusDisplay = getSaveStatusDisplay(saveStatus, lastSavedAt, saveError)

  return (
    <div className="flex flex-col h-full relative">
      {/* -----------------------------------------------------------------------
          Title Input
          ----------------------------------------------------------------------- */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center gap-4">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="제목을 입력하세요..."
          className="flex-1 text-2xl font-bold bg-transparent border-none outline-none
                     text-gray-900 dark:text-white placeholder-gray-400 min-w-0"
          aria-label="글 제목"
        />
        
        {/* [Font Size Control] 폰트 크기 조절 UI */}
        <div className="shrink-0 z-10 hidden sm:flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1 border border-gray-200 dark:border-gray-700">
          <button
            onClick={handleZoomOut}
            disabled={fontSize <= 12}
            className="w-7 h-7 flex items-center justify-center rounded hover:bg-white dark:hover:bg-gray-700 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors disabled:opacity-50"
            title="글자 축소"
          >
            -
          </button>
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400 min-w-[32px] text-center select-none">
            {fontSize}px
          </span>
          <button
            onClick={handleZoomIn}
            disabled={fontSize >= 32}
            className="w-7 h-7 flex items-center justify-center rounded hover:bg-white dark:hover:bg-gray-700 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors disabled:opacity-50"
            title="글자 확대"
          >
            +
          </button>
        </div>

        {/* [Phase A] 버전 히스토리 버튼 */}
        <button
          onClick={() => setShowVersionHistory(!showVersionHistory)}
          disabled={!documentId}
          className={`hidden sm:flex shrink-0 items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
            showVersionHistory
              ? 'bg-indigo-50 dark:bg-indigo-900/30 border-indigo-200 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300'
              : 'bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
          } disabled:opacity-40 disabled:cursor-not-allowed`}
          title={documentId ? '버전 히스토리' : '문서를 저장한 후 사용할 수 있습니다'}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>버전</span>
        </button>

        {/* [P2-02] 테마 토글 버튼 - 폰트 조절 옆 */}
        <div className="hidden sm:block"><ThemeToggle size="sm" /></div>
      </div>

      {/* -----------------------------------------------------------------------
          Markdown Editor
          [P2-01] data-color-mode: isDarkMode 상태에 따라 동적 전환
          ----------------------------------------------------------------------- */}
      <div
        id="markdown-editor-container"
        className="flex-1 overflow-hidden"
        data-color-mode={isDarkMode ? 'dark' : 'light'}
      >
        {/* [Fix] 라이브러리 내부 스타일 강제 오버라이드
            [P4-01] 다크 모드 시 텍스트 색상 동적 적용
            [P3-05] TipTap/ProseMirror 에디터 지원 추가 */}
        <style>{`
          #markdown-editor-container .w-md-editor-text-pre > code,
          #markdown-editor-container .w-md-editor-text-input {
            font-size: ${fontSize}px !important;
            line-height: 1.6 !important;
          }

          /* TipTap/ProseMirror 다크 모드 강제 적용 */
          #markdown-editor-container .tiptap,
          #markdown-editor-container .tiptap.ProseMirror,
          #markdown-editor-container .ProseMirror,
          #markdown-editor-container [contenteditable="true"],
          #markdown-editor-container .tiptap p,
          #markdown-editor-container .tiptap *,
          #markdown-editor-container .ProseMirror p,
          #markdown-editor-container .ProseMirror * {
            color: ${isDarkMode ? '#f9fafb' : '#1f2937'} !important;
            -webkit-text-fill-color: ${isDarkMode ? '#f9fafb' : '#1f2937'} !important;
          }

          #markdown-editor-container .tiptap,
          #markdown-editor-container .ProseMirror {
            background-color: ${isDarkMode ? '#1f2937' : '#ffffff'} !important;
            caret-color: ${isDarkMode ? '#f9fafb' : '#1f2937'} !important;
          }
        `}</style>
        <MDEditor
          value={content}
          onChange={(value) => setContent(value || '')}
          height="100%"
          preview="edit"
          hideToolbar={false}
          enableScroll={true}
          aria-label="마크다운 에디터"
        />
      </div>

      {/* -----------------------------------------------------------------------
          Status Bar (Character Counter + Save Status) - Pipeline v5 업그레이드
          ----------------------------------------------------------------------- */}
      <div className="flex items-center justify-between flex-wrap gap-2 px-2 sm:px-4 py-2 text-sm border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        {/* 좌측: 글자 수 + 저장 상태 */}
        <div className="flex items-center gap-4">
          <span id="char-counter" className="text-gray-500 dark:text-gray-400">
            글자 수: {content.length.toLocaleString()}자
          </span>

          {/* [Pipeline v5] 저장 상태 표시 */}
          {statusDisplay.text && (
            <span className={`flex items-center gap-1 ${statusDisplay.className}`}>
              <span>{statusDisplay.icon}</span>
              <span>{statusDisplay.text}</span>
            </span>
          )}

          {/* [Pipeline v5] 변경사항 표시 */}
          {hasPendingChanges && saveStatus !== 'saving' && (
            <span className="text-amber-500 dark:text-amber-400 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
              <span>변경사항 있음</span>
            </span>
          )}
        </div>

        {/* 우측: 수동 저장 버튼 + 로컬 백업 복구 */}
        <div className="flex items-center gap-3">
          {/* [Pipeline v5] 로컬 백업 복구 알림 */}
          {hasLocalBackup && (
            <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
              <span className="text-xs">⚠️ 저장되지 않은 백업 있음</span>
              <button
                onClick={() => {
                  if (confirm('로컬 백업을 복구하시겠습니까? 현재 작성 중인 내용은 사라집니다.')) {
                    restoreFromBackup()
                  }
                }}
                className="px-2 py-0.5 text-xs bg-amber-100 dark:bg-amber-900 rounded hover:bg-amber-200 dark:hover:bg-amber-800 transition-colors"
              >
                복구
              </button>
              <button
                onClick={() => {
                  if (confirm('백업을 삭제하시겠습니까?')) {
                    clearBackup()
                  }
                }}
                className="px-2 py-0.5 text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
              >
                삭제
              </button>
            </div>
          )}

          {/* [Pipeline v5] 수동 저장 버튼 */}
          <button
            onClick={() => saveNow()}
            disabled={saveStatus === 'saving' || (!hasPendingChanges && saveStatus !== 'error')}
            className="px-3 py-1 text-xs font-medium bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
            title="Ctrl+S로도 저장할 수 있습니다"
          >
            {saveStatus === 'saving' ? (
              <>
                <span className="animate-spin">⏳</span>
                저장 중
              </>
            ) : (
              <>
                <span>💾</span>
                저장
              </>
            )}
          </button>
        </div>
      </div>

      {/* -------------------------------------------------------------------
          [Phase A] 버전 히스토리 사이드 패널 (오버레이)
          ------------------------------------------------------------------- */}
      {showVersionHistory && (
        <div className="absolute top-0 right-0 w-96 h-full z-30 shadow-xl border-l border-gray-200 dark:border-gray-700">
          <VersionHistoryPanel
            documentId={documentId}
            currentContent={content}
            onClose={() => setShowVersionHistory(false)}
          />
        </div>
      )}
    </div>
  )
}
