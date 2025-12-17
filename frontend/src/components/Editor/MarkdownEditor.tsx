// =============================================================================
// PRISM Writer - Markdown Editor Component
// =============================================================================
// 파일: frontend/src/components/Editor/MarkdownEditor.tsx
// 역할: 마크다운 입력 및 미리보기 에디터
// 라이브러리: @uiw/react-md-editor
// =============================================================================

'use client'

import dynamic from 'next/dynamic'
import { useEditorState } from '@/hooks/useEditorState'

// 동적 import (SSR 비활성화 - 마크다운 에디터는 클라이언트 전용)
const MDEditor = dynamic(() => import('@uiw/react-md-editor'), { ssr: false })

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------
export default function MarkdownEditor() {
  const { content, setContent, title, setTitle } = useEditorState()

  return (
    <div className="flex flex-col h-full">
      {/* -----------------------------------------------------------------------
          Title Input
          ----------------------------------------------------------------------- */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="제목을 입력하세요..."
          className="w-full text-2xl font-bold bg-transparent border-none outline-none
                     text-gray-900 dark:text-white placeholder-gray-400"
          aria-label="글 제목"
        />
      </div>

      {/* -----------------------------------------------------------------------
          Markdown Editor
          ----------------------------------------------------------------------- */}
      <div className="flex-1 overflow-hidden" data-color-mode="light">
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
          Status Bar (Character Counter)
          ----------------------------------------------------------------------- */}
      <div className="flex justify-end px-4 py-2 text-sm text-gray-500 dark:text-gray-400 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <span id="char-counter">
          글자 수: {content.length.toLocaleString()}자
        </span>
      </div>
    </div>
  )
}
