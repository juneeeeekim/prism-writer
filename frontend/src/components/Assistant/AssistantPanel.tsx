// =============================================================================
// PRISM Writer - Assistant Panel
// =============================================================================
// 파일: frontend/src/components/Assistant/AssistantPanel.tsx
// 역할: RAG 어시스턴트 패널 (탭 구조: 목차 제안 / 참고자료 / AI 채팅 / 평가)
// 접근성: role="tablist", role="tabpanel" 적용
// =============================================================================

'use client'


import { useState, useEffect } from 'react'
import OutlineTab from './OutlineTab'
import ReferenceTab from './ReferenceTab'
import ChatTab from './ChatTab'
import EvaluationTab from './EvaluationTab'
import ChatSessionList from './ChatSessionList'
import ChatHistoryOnboarding from './ChatHistoryOnboarding'
import { FEATURES } from '@/lib/features'
import { useEditorState } from '@/hooks/useEditorState'  // Phase 14.5: Category-Scoped
// [P6-03] 온보딩 상태 기반 탭 필터링
import { useProject } from '@/contexts/ProjectContext'

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------
type TabId = 'outline' | 'reference' | 'chat' | 'evaluation'

interface Tab {
  id: TabId
  label: string
  icon: string
}

// -----------------------------------------------------------------------------
// Tab Configuration
// [P6-01-A] 탭 순서 변경: 참고자료 → 목차 제안 → AI 채팅 → 평가
// 이유: 새 프로젝트 생성 시 RAG 구축(문서 업로드)이 먼저 보이도록
// -----------------------------------------------------------------------------
const TABS: Tab[] = [
  { id: 'reference', label: '참고자료', icon: '📚' },
  { id: 'outline', label: '목차 제안', icon: '🗂️' },
  { id: 'chat', label: 'AI 채팅', icon: '💬' },
  { id: 'evaluation', label: '평가', icon: '📊' },
]

// -----------------------------------------------------------------------------
// Props Interface
// -----------------------------------------------------------------------------
interface AssistantPanelProps {
  /** [P6-03-A] 외부에서 지정하는 기본 탭 (새 프로젝트 여부에 따라 결정) */
  defaultTab?: TabId
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------
export default function AssistantPanel({ defaultTab = 'reference' }: AssistantPanelProps) {
  // [P6-01-A] 기본 탭을 'reference'로 변경 - RAG 구축이 먼저 보이도록
  // [P6-03-A] 외부에서 defaultTab prop으로 제어 가능
  const [activeTab, setActiveTab] = useState<TabId>(defaultTab)
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null)

  // Feature Flag 확인 (클라이언트 사이드에서 안전하게 접근)
  const [showSessionList, setShowSessionList] = useState(false)

  useEffect(() => {
    setShowSessionList(FEATURES.CHAT_SESSION_LIST)
  }, [])



  // ===========================================================================
  // [P6-03] 온보딩 상태 기반 탭 필터링
  // ===========================================================================
  const { currentProject } = useProject()
  const isSetupCompleted = currentProject?.setup_completed ?? true  // 기본값 true (기존 프로젝트 호환)

  // 온보딩 미완료 시 참고자료 탭만 표시
  const visibleTabs = isSetupCompleted
    ? TABS
    : TABS.filter((tab) => tab.id === 'reference')

  // 온보딩 미완료 시 activeTab이 참고자료가 아니면 강제 전환
  useEffect(() => {
    if (!isSetupCompleted && activeTab !== 'reference') {
      setActiveTab('reference')
    }
  }, [isSetupCompleted, activeTab])

  // ===========================================================================
  // [Phase 8] Chat Draft Interaction
  // ===========================================================================
  const chatDraft = useEditorState((state) => state.chatDraft)
  
  useEffect(() => {
    if (chatDraft) {
      setActiveTab('chat')
    }
  }, [chatDraft])



  return (
    <div className="flex flex-col h-full relative">
      {/* Onboarding Modal (Feature Flag ON && LocalStorage Check handled inside component) */}
      {showSessionList && (
        <ChatHistoryOnboarding onDismiss={() => {}} />
      )}

      {/* -----------------------------------------------------------------------
          [P6-03] 온보딩 상태에 따라 탭 표시
          - setup_completed = false: 참고자료 탭만
          - setup_completed = true: 전체 탭
          ----------------------------------------------------------------------- */}
      <div
        className="flex border-b border-gray-200 dark:border-gray-700"
        role="tablist"
        aria-label="어시스턴트 기능 탭"
      >
        {visibleTabs.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            id={`tab-${tab.id}`}
            aria-selected={activeTab === tab.id}
            aria-controls={`panel-${tab.id}`}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors
                        ${activeTab === tab.id
                          ? 'border-b-2 border-prism-primary text-prism-primary bg-white dark:bg-gray-800'
                          : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                        }`}
            onClick={() => setActiveTab(tab.id)}
          >
            <span className="mr-2">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* -----------------------------------------------------------------------
          Tab Panels (Always Rendered, Hidden via CSS for State Persistence)
          ----------------------------------------------------------------------- */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        {/* 목차 제안 탭 */}
        <div
          id="panel-outline"
          role="tabpanel"
          aria-labelledby="tab-outline"
          className={`h-full ${activeTab !== 'outline' ? 'hidden' : ''}`}
        >
          <OutlineTab />
        </div>

        {/* 참고자료 탭 - Always mounted to preserve selected document & chunks */}
        <div
          id="panel-reference"
          role="tabpanel"
          aria-labelledby="tab-reference"
          className={`h-full ${activeTab !== 'reference' ? 'hidden' : ''}`}
        >
          <ReferenceTab />
        </div>

        {/* AI 채팅 탭 */}
        <div
          id="panel-chat"
          role="tabpanel"
          aria-labelledby="tab-chat"
          className={`h-full flex ${activeTab !== 'chat' ? 'hidden' : ''}`}
        >
          {/* Feature Flag: 세션 목록 표시 여부 */}
          {showSessionList && (
            <ChatSessionList 
              selectedSessionId={selectedSessionId} 
              onSelectSession={setSelectedSessionId} 
            />
          )}
          <div className="flex-1 min-w-0 h-full">
            {/* Feature Flag OFF 시 세션 관리 비활성화 (기존 동작 유지) */}
            {/* Phase 14.5: Pass category for scoped personalization */}
            <ChatTab 
              sessionId={showSessionList ? selectedSessionId : undefined} 
              onSessionChange={setSelectedSessionId}
            />
          </div>
        </div>

        {/* 평가 탭 - Always mounted to preserve evaluation results */}
        <div
          id="panel-evaluation"
          role="tabpanel"
          aria-labelledby="tab-evaluation"
          className={`h-full ${activeTab !== 'evaluation' ? 'hidden' : ''}`}
        >
          <EvaluationTab />
        </div>
      </div>
    </div>
  )
}

