'use client'

import dynamic from 'next/dynamic'
import { useEditorState } from '@/hooks/useEditorState'
import { useDocuments } from '@/hooks/useDocuments'  // Phase 12: 카테고리 목록

// 동적 import (SSR 비활성화 - 마크다운 에디터는 클라이언트 전용)
const MDEditor = dynamic(() => import('@uiw/react-md-editor'), { ssr: false })

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------
export default function MarkdownEditor() {
  const { content, setContent, title, setTitle, category, setCategory } = useEditorState()
  const { categories } = useDocuments()  // Phase 12: 기존 카테고리 목록

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
          Phase 12: Category Input
          ----------------------------------------------------------------------- */}
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
        <div className="flex items-center gap-3">
          <label 
            htmlFor="category-input" 
            className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1.5"
          >
            <span className="text-base">📁</span>
            카테고리
          </label>
          <input
            id="category-input"
            type="text"
            list="category-suggestions"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="미분류"
            className="flex-1 px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 
                       rounded-lg bg-white dark:bg-gray-700 
                       text-gray-900 dark:text-white placeholder-gray-400
                       focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400
                       transition-colors"
            aria-label="글 카테고리"
          />
          <datalist id="category-suggestions">
            {categories.map((cat) => (
              <option key={cat} value={cat} />
            ))}
          </datalist>
        </div>
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
