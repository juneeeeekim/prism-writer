// =============================================================================
// PRISM Writer - Editor Page
// =============================================================================
// 파일: frontend/src/app/editor/page.tsx
// 역할: Dual Pane Editor 메인 페이지 (에디터 + 어시스턴트 조립)
// Pipeline v5 준비: Feature Flag로 2패널/3패널 전환 가능
// [P5-07-A] 프로젝트 선택기 지원 추가
// =============================================================================

'use client'

// Dynamic rendering for Vercel deployment
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import DualPaneContainer from '@/components/DualPane/DualPaneContainer'
import MarkdownEditor from '@/components/Editor/MarkdownEditor'
import AssistantPanel from '@/components/Assistant/AssistantPanel'
import { AuthHeader } from '@/components/auth'
import ThreePaneLayout from '@/components/Editor/ThreePaneLayout'
import ReferencePanel from '@/components/Editor/ReferencePanel'
import FeedbackPanel from '@/components/Editor/FeedbackPanel'
import { useEditorState } from '@/hooks/useEditorState'
import { useDocuments } from '@/hooks/useDocuments'
import { useAuth } from '@/hooks/useAuth'
import { createClient } from '@/lib/supabase/client'
// ---------------------------------------------------------------------------
// Pipeline v5: 중앙 집중 Feature Flag 사용
// ---------------------------------------------------------------------------
import { isFeatureEnabled, getUILayoutType, logFeatureFlags } from '@/config/featureFlags'
// [P5-07-A] 프로젝트 Context Provider
import { ProjectProvider, useProject } from '@/contexts/ProjectContext'
// [P6-04] Full-screen Onboarding
import OnboardingGuide from '@/components/Assistant/Studio/OnboardingGuide'

// -----------------------------------------------------------------------------
// Editor Page Component (ProjectProvider 래핑)
// -----------------------------------------------------------------------------
export default function EditorPage() {
  return (
    <ProjectProvider>
      <EditorContent />
    </ProjectProvider>
  )
}
// -----------------------------------------------------------------------------
// Editor Content Component
// -----------------------------------------------------------------------------
function EditorContent() {
  const searchParams = useSearchParams()
  const documentIdFromUrl = searchParams.get('id')

  // ---------------------------------------------------------------------------
  // [P7-FIX] 프로젝트 Context에서 현재 프로젝트 ID 가져오기
  // ---------------------------------------------------------------------------
  const { currentProject } = useProject()
  const projectId = currentProject?.id ?? null

  // ---------------------------------------------------------------------------
  // [P6-03-A] URL에서 새 프로젝트 파라미터 읽기
  // - dashboard에서 새 프로젝트 생성 시 `?new=true` 파라미터가 붙음
  // - 새 프로젝트면 참고자료 탭, 기존 프로젝트면 목차 탭을 기본 선택
  // ---------------------------------------------------------------------------
  const isNewProject = searchParams.get('new') === 'true'
  const defaultAssistantTab = isNewProject ? 'reference' : 'outline'
  
  const { 
    content, 
    title,
    category,  // Phase 12
    documentId,
    setDocumentId,
    setCategory,  // Phase 12
    markAsSaved,
    loadFromServer,
    evaluationResult, 
    setEvaluationResult, 
    template, 
    setTemplate 
  } = useEditorState()
  
  // Phase 11: 문서 저장 관련 훅
  // [P7-FIX] projectId 전달하여 프로젝트별 문서만 조회/저장
  const { saveDocument, loadDocument, categories, fetchList } = useDocuments(projectId)  // Phase 12: categories 추가
  const { user } = useAuth()
  const [isSaving, setIsSaving] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  
  // Phase 12: 에디터 마운트 시 카테고리 목록 로드
  // [P7-FIX] projectId가 있을 때만 fetchList 호출
  useEffect(() => {
    if (projectId) {
      fetchList()
    }
  }, [projectId, fetchList])
  
  // ---------------------------------------------------------------------------
  // Phase 11: URL에서 문서 ID로 문서 로드
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const loadFromUrl = async () => {
      if (documentIdFromUrl && documentIdFromUrl !== documentId) {
        setIsLoading(true)
        try {
          const doc = await loadDocument(documentIdFromUrl)
          loadFromServer({
            id: doc.id,
            title: doc.title,
            content: doc.content,
            category: doc.category  // Phase 12
          })
        } catch (error) {
          console.error('[EditorPage] Load document error:', error)
          alert('문서를 불러오는데 실패했습니다.')
        } finally {
          setIsLoading(false)
        }
      }
    }
    
    loadFromUrl()
  }, [documentIdFromUrl])
   
  // ---------------------------------------------------------------------------
  // Feature Flag 기반 UI 레이아웃 결정
  // ---------------------------------------------------------------------------
  const [isThreePanelMode, setIsThreePanelMode] = useState(false)
  const [isEvaluating, setIsEvaluating] = useState(false)

  // Feature Flag 확인 (클라이언트 사이드)
  useEffect(() => {
    // 중앙 집중 Feature Flag 사용
    const useThreePanel = isFeatureEnabled('ENABLE_THREE_PANEL_UI')
    setIsThreePanelMode(useThreePanel)
    
    // 디버그 로그 (개발 환경에서만)
    if (process.env.NODE_ENV === 'development') {
      logFeatureFlags()
    }
  }, [])

  // =============================================================================
  // Handler Functions
  // =============================================================================
  
  // Phase 11: 실제 저장 기능 구현
  const handleSave = async () => {
    if (!user) {
      alert('로그인이 필요합니다.')
      return
    }
    
    if (!content && !title) {
      alert('저장할 내용이 없습니다.')
      return
    }
    
    setIsSaving(true)
    try {
      const result = await saveDocument({
        id: documentId || undefined,
        title: title || '제목 없음',
        content: content || '',
        category: category || '미분류'  // Phase 12
      })
      
      // 새 문서면 ID 세팅
      if (!documentId && result.id) {
        setDocumentId(result.id)
      }
      
      markAsSaved()
      alert('저장되었습니다!')
    } catch (error) {
      console.error('[EditorPage] Save error:', error)
      alert('저장에 실패했습니다. 다시 시도해주세요.')
    } finally {
      setIsSaving(false)
    }
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
          Header with Auth State & Project Selector
          ----------------------------------------------------------------------- */}
      <AuthHeader 
        showLogo 
        showToolbar 
        showProjectSelector
        onSave={handleSave} 
        onExport={handleExport} 
      />

      {/* -----------------------------------------------------------------------
          Main Content
          [P6-04] 온보딩 미완료 시 전체 화면 온보딩, 완료 시 에디터 표시
          ----------------------------------------------------------------------- */}
      <div className="flex-1 overflow-hidden">
        {!(currentProject?.setup_completed ?? true) ? (
          // [P6-04] 온보딩 미완료 → 전체 화면 온보딩 (에디터 숨김)
          <OnboardingGuide step={1} />
        ) : isThreePanelMode ? (
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
            assistantPane={
              // [P6-03-A] 새 프로젝트 여부에 따라 기본 탭 결정
              <AssistantPanel defaultTab={defaultAssistantTab as 'reference' | 'outline' | 'chat' | 'evaluation'} />
            }
            initialEditorWidth={55}
          />
        )}
      </div>
    </div>
  )
}
