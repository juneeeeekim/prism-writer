'use client'

import { useEffect, useCallback, useState } from 'react'
import dynamic from 'next/dynamic'
import { useEditorState } from '@/hooks/useEditorState'
import { useAutosave, type SaveStatus } from '@/hooks/useAutosave'  // Pipeline v5: Autosave
// [P7-FIX] 프로젝트 Context 추가
import { useProject } from '@/contexts/ProjectContext'

// 동적 import (SSR 비활성화 - 마크다운 에디터는 클라이언트 전용)
const MDEditor = dynamic(() => import('@uiw/react-md-editor'), { ssr: false })

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

  const { content, setContent, title, setTitle } = useEditorState()

  // [Font Size Control] 폰트 크기 조절 (기본값 16px)
  const [fontSize, setFontSize] = useState<number>(16)

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
  // [Pipeline v5] 저장 상태 표시 정보
  // =========================================================================
  const statusDisplay = getSaveStatusDisplay(saveStatus, lastSavedAt, saveError)

  return (
    <div className="flex flex-col h-full">
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
        <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1 border border-gray-200 dark:border-gray-700">
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
      </div>

      {/* -----------------------------------------------------------------------
          Markdown Editor
          ----------------------------------------------------------------------- */}
      <div 
        id="markdown-editor-container"
        className="flex-1 overflow-hidden" 
        data-color-mode="light"
      >
        {/* [Fix] 라이브러리 내부 스타일 강제 오버라이드 */}
        <style>{`
          #markdown-editor-container .w-md-editor-text,
          #markdown-editor-container .w-md-editor-text-pre,
          #markdown-editor-container textarea,
          #markdown-editor-container .wmde-markdown {
            font-size: ${fontSize}px !important;
            line-height: 1.6 !important;
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
      <div className="flex items-center justify-between px-4 py-2 text-sm border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
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
    </div>
  )
}
