// =============================================================================
// PRISM Writer - Editor Page
// =============================================================================
// 파일: frontend/src/app/editor/page.tsx
// 역할: Dual Pane Editor 메인 페이지 (에디터 + 어시스턴트 조립)
// =============================================================================

'use client'

// Dynamic rendering for Vercel deployment
export const dynamic = 'force-dynamic'

import DualPaneContainer from '@/components/DualPane/DualPaneContainer'
import MarkdownEditor from '@/components/Editor/MarkdownEditor'
import AssistantPanel from '@/components/Assistant/AssistantPanel'
import { AuthHeader } from '@/components/auth'

// -----------------------------------------------------------------------------
// Editor Page Component
// -----------------------------------------------------------------------------
export default function EditorPage() {
  // =============================================================================
  // Handler Functions
  // =============================================================================
  const handleSave = () => {
    // TODO: 저장 기능 구현
    console.log('저장 기능 (추후 구현)')
  }

  const handleExport = () => {
    // TODO: 내보내기 기능 구현
    console.log('내보내기 기능 (추후 구현)')
  }

  return (
    <div className="h-screen flex flex-col">
      {/* -----------------------------------------------------------------------
          Header with Auth State
          ----------------------------------------------------------------------- */}
      <AuthHeader 
        showLogo 
        showToolbar 
        onSave={handleSave} 
        onExport={handleExport} 
      />

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
