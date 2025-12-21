// =============================================================================
// PRISM Writer - Editor Page
// =============================================================================
// 파일: frontend/src/app/editor/page.tsx
// 역할: Dual Pane Editor 메인 페이지 (에디터 + 어시스턴트 조립)
// =============================================================================

'use client'

// Dynamic rendering for Vercel deployment
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import DualPaneContainer from '@/components/DualPane/DualPaneContainer'
import MarkdownEditor from '@/components/Editor/MarkdownEditor'
import AssistantPanel from '@/components/Assistant/AssistantPanel'
import { AuthHeader } from '@/components/auth'
import ThreePaneLayout from '@/components/Editor/ThreePaneLayout'
import ReferencePanel from '@/components/Editor/ReferencePanel'
import FeedbackPanel from '@/components/Editor/FeedbackPanel'
import { useEditorState } from '@/hooks/useEditorState'
import { createClient } from '@/lib/supabase/client'

// -----------------------------------------------------------------------------
// Editor Page Component
// -----------------------------------------------------------------------------
export default function EditorPage() {
  const { 
    content, 
    evaluationResult, 
    setEvaluationResult, 
    template, 
    setTemplate 
  } = useEditorState()
  
  const [isV3Mode, setIsV3Mode] = useState(false)
  const [isEvaluating, setIsEvaluating] = useState(false)

  // Feature Flag 확인
  useEffect(() => {
    const v3Enabled = process.env.NEXT_PUBLIC_USE_V3_TEMPLATES === 'true'
    setIsV3Mode(v3Enabled)
    
    // 임시: v3 모드일 때 테스트용 템플릿 로드 (실제로는 문서 선택 시 로드)
    if (v3Enabled) {
      // TODO: 템플릿 로드 로직
    }
  }, [])

  // =============================================================================
  // Handler Functions
  // =============================================================================
  const handleSave = () => {
    console.log('저장 기능 (추후 구현)')
  }

  const handleExport = () => {
    console.log('내보내기 기능 (추후 구현)')
  }

  const handleEvaluate = async () => {
    if (!content || content.length < 10) {
      alert('평가할 내용을 10자 이상 입력해주세요.')
      return
    }

    setIsEvaluating(true)
    try {
      // API 호출
      const response = await fetch('/api/rag/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userText: content,
          // templateId: template?.[0]?.document_id // 템플릿 ID가 있다면 전달
          useV3: true // v3 평가 강제 (임시)
        }),
      })

      const data = await response.json()
      
      if (data.success && data.v3Result) {
        setEvaluationResult(data.v3Result)
      } else {
        console.error('Evaluation failed:', data.message)
        alert('평가에 실패했습니다: ' + (data.message || 'Unknown error'))
      }
    } catch (error) {
      console.error('Evaluation error:', error)
      alert('평가 중 오류가 발생했습니다.')
    } finally {
      setIsEvaluating(false)
    }
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
          Main Content
          ----------------------------------------------------------------------- */}
      <div className="flex-1 overflow-hidden">
        {isV3Mode ? (
          <ThreePaneLayout
            leftPanel={
              <ReferencePanel 
                template={template || []} 
                isLoading={false} 
              />
            }
            centerPanel={<MarkdownEditor />}
            rightPanel={
              <FeedbackPanel 
                evaluation={evaluationResult}
                isLoading={isEvaluating}
                onEvaluate={handleEvaluate}
              />
            }
          />
        ) : (
          <DualPaneContainer
            editorPane={<MarkdownEditor />}
            assistantPane={<AssistantPanel />}
            initialEditorWidth={55}
          />
        )}
      </div>
    </div>
  )
}
