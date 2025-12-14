// =============================================================================
// PRISM Writer - Editor Page
// =============================================================================
// 파일: frontend/src/app/editor/page.tsx
// 역할: Dual Pane Editor 메인 페이지 (에디터 + 어시스턴트 조립)
// =============================================================================

'use client'

import DualPaneContainer from '@/components/DualPane/DualPaneContainer'
import MarkdownEditor from '@/components/Editor/MarkdownEditor'
import AssistantPanel from '@/components/Assistant/AssistantPanel'

// -----------------------------------------------------------------------------
// Editor Page Component
// -----------------------------------------------------------------------------
export default function EditorPage() {
  return (
    <div className="h-screen flex flex-col">
      {/* -----------------------------------------------------------------------
          Header
          ----------------------------------------------------------------------- */}
      <header className="h-14 flex items-center justify-between px-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
        <div className="flex items-center gap-3">
          <span className="text-2xl">💎</span>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
            PRISM Writer
          </h1>
        </div>
        
        {/* 툴바 버튼 */}
        <div className="flex items-center gap-2">
          <button
            className="px-3 py-1.5 text-sm bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
            aria-label="저장"
          >
            💾 저장
          </button>
          <button
            className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            aria-label="내보내기"
          >
            📤 내보내기
          </button>
        </div>
      </header>

      {/* -----------------------------------------------------------------------
          Main Content (Dual Pane)
          ----------------------------------------------------------------------- */}
      <div className="flex-1 overflow-hidden">
        <DualPaneContainer
          editorPane={<MarkdownEditor />}
          assistantPane={<AssistantPanel />}
          initialEditorWidth={55}
        />
      </div>
    </div>
  )
}
