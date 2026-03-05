// =============================================================================
// PRISM Writer - Assistant Panel
// =============================================================================
// 파일: frontend/src/components/Assistant/AssistantPanel.tsx
// 역할: RAG 어시스턴트 패널 (탭 구조: 목차 제안 / 참고자료 / AI 채팅 / 평가)
// 접근성: role="tablist", role="tabpanel" 적용
// =============================================================================

'use client'


import { useState, useEffect, useCallback, useRef } from 'react'
// import OutlineTab from './OutlineTab' // [Deprecation] 비활성화
import ReferenceTab from './ReferenceTab'
import ChatTab from './ChatTab'
import EvaluationTab from './EvaluationTab'
import SmartSearchTab from './SmartSearchTab'  // [P2-02] 스마트 검색 탭 추가
import StructureTab from './StructureTab'  // [P4-01] AI Structurer 탭 추가
import ResearchPanel from './ResearchPanel'  // [Deep Scholar P4-01] 외부 자료 검색 탭
import ChatSessionList from './ChatSessionList'
import ChatHistoryOnboarding from './ChatHistoryOnboarding'
import { FEATURES } from '@/lib/features'
import { FEATURE_FLAGS } from '@/config/featureFlags'  // [P4-02] AI Structurer Feature Flag
import { useEditorState } from '@/hooks/useEditorState'  // Phase 14.5: Category-Scoped
// [P6-03] 온보딩 상태 기반 탭 필터링
import { useProject } from '@/contexts/ProjectContext'

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------
// [P2-02] TabId에 'search' 추가
// [P4-02] TabId에 'structure' 추가 (AI Structurer)
// [Deep Scholar P4-01] TabId에 'research' 추가
type TabId = 'outline' | 'reference' | 'chat' | 'evaluation' | 'search' | 'structure' | 'research'

interface Tab {
  id: TabId
  label: string
  icon: string
}

// -----------------------------------------------------------------------------
// Tab Configuration
// [P6-01-A] 탭 순서 변경: 참고자료 → 목차 제안 → AI 채팅 → 평가 → 스마트 검색
// [P2-02] 스마트 검색 탭 추가
// [P4-02] AI Structurer 탭 추가 (Feature Flag로 제어)
// -----------------------------------------------------------------------------
const TABS: Tab[] = [
  { id: 'reference', label: '참고자료', icon: '📚' },
  // { id: 'outline', label: '목차 제안', icon: '🗂️' }, // [Deprecation] 사용률 저조로 비활성화 (2026-01-10)
  { id: 'chat', label: 'AI 채팅', icon: '💬' },
  { id: 'evaluation', label: '평가', icon: '📊' },
  { id: 'search', label: '스마트 검색', icon: '🔍' },  // [P2-02] 추가
  { id: 'structure', label: '구조', icon: '🧩' },  // [P4-02] AI Structurer
  { id: 'research', label: '근거 찾기', icon: '🎓' },  // [Deep Scholar P4-01] 외부 자료 검색
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
  // [P4-02] AI Structurer Feature Flag 기반 필터링
  // ===========================================================================
  const { currentProject } = useProject()
  const isSetupCompleted = currentProject?.setup_completed ?? true  // 기본값 true (기존 프로젝트 호환)

  // 온보딩 미완료 시 참고자료 탭만 표시
  // [P4-02] AI Structurer 탭은 Feature Flag로 제어
  // [Deep Scholar P4-01] Research 탭은 ENABLE_DEEP_SCHOLAR Feature Flag로 제어
  const visibleTabs = isSetupCompleted
    ? TABS.filter((tab) => {
        // AI Structurer 탭: Feature Flag 체크
        if (tab.id === 'structure') return FEATURE_FLAGS.ENABLE_AI_STRUCTURER
        // Research 탭: Feature Flag 체크
        if (tab.id === 'research') return FEATURE_FLAGS.ENABLE_DEEP_SCHOLAR
        return true
      })
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

  // ===========================================================================
  // [P-B04-02] 키보드 네비게이션 (WAI-ARIA Tab Pattern)
  // ---------------------------------------------------------------------------
  // - ArrowLeft/ArrowRight: 이전/다음 탭으로 포커스 이동
  // - Home: 첫 번째 탭으로 포커스 이동
  // - End: 마지막 탭으로 포커스 이동
  // - tabIndex: 활성 탭 = 0, 비활성 탭 = -1 (roving tabindex)
  // ===========================================================================
  const tabRefs = useRef<Map<TabId, HTMLButtonElement>>(new Map())

  /**
   * [P-B04-02] 탭 키보드 이벤트 핸들러
   * WAI-ARIA Tab Pattern에 따른 키보드 네비게이션 구현
   */
  const handleTabKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLButtonElement>, currentTabId: TabId) => {
      const currentIndex = visibleTabs.findIndex((tab) => tab.id === currentTabId)
      if (currentIndex === -1) return

      let nextIndex: number | null = null

      switch (e.key) {
        case 'ArrowLeft':
          // 이전 탭으로 이동 (순환)
          nextIndex = currentIndex === 0 ? visibleTabs.length - 1 : currentIndex - 1
          break
        case 'ArrowRight':
          // 다음 탭으로 이동 (순환)
          nextIndex = currentIndex === visibleTabs.length - 1 ? 0 : currentIndex + 1
          break
        case 'Home':
          // 첫 번째 탭으로 이동
          nextIndex = 0
          break
        case 'End':
          // 마지막 탭으로 이동
          nextIndex = visibleTabs.length - 1
          break
        default:
          return // 다른 키는 무시
      }

      if (nextIndex !== null) {
        e.preventDefault() // 기본 동작 방지
        const nextTab = visibleTabs[nextIndex]
        setActiveTab(nextTab.id)
        // 포커스 이동
        tabRefs.current.get(nextTab.id)?.focus()
      }
    },
    [visibleTabs]
  )

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
        {/* =================================================================
            [P-B02-01] 모바일 반응형 탭 버튼
            - 모바일: px-2 py-2.5, 아이콘만 표시 (text-xs)
            - 데스크톱(sm+): px-4 py-3, 아이콘+레이블 표시 (text-sm)
            - 터치 타겟 44px 이상 유지 (py-2.5 ≈ 10px * 2 + 텍스트)
            ================================================================= */}
        {/* =================================================================
            [P-B04-02] 키보드 네비게이션 추가
            - onKeyDown: ArrowLeft/Right, Home/End 키 핸들링
            - tabIndex: roving tabindex (활성=0, 비활성=-1)
            - ref: 포커스 이동을 위한 ref 저장
            ================================================================= */}
        {visibleTabs.map((tab) => (
          <button
            key={tab.id}
            ref={(el) => {
              if (el) {
                tabRefs.current.set(tab.id, el)
              } else {
                tabRefs.current.delete(tab.id)
              }
            }}
            role="tab"
            id={`tab-${tab.id}`}
            aria-selected={activeTab === tab.id}
            aria-controls={`panel-${tab.id}`}
            tabIndex={activeTab === tab.id ? 0 : -1}
            onKeyDown={(e) => handleTabKeyDown(e, tab.id)}
            className={`
              flex-1 flex items-center justify-center
              px-2 py-2.5 sm:px-4 sm:py-3
              text-xs sm:text-sm font-medium transition-colors
              focus:outline-none focus:ring-2 focus:ring-prism-primary focus:ring-inset
              ${activeTab === tab.id
                ? 'border-b-2 border-prism-primary text-prism-primary bg-white dark:bg-gray-800'
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
              }
            `}
            onClick={() => setActiveTab(tab.id)}
          >
            <span className="mr-1 sm:mr-2">{tab.icon}</span>
            {/* [P-B02-01] 모바일에서 레이블 숨김 - 아이콘만 표시 */}
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* -----------------------------------------------------------------------
          Tab Panels (Always Rendered, Hidden via CSS for State Persistence)
          ----------------------------------------------------------------------- */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        {/* 목차 제안 탭 (비활성화) */}
        {/* <div
          id="panel-outline"
          role="tabpanel"
          aria-labelledby="tab-outline"
          className={`h-full ${activeTab !== 'outline' ? 'hidden' : ''}`}
        >
          <OutlineTab />
        </div> */}

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
          {/* Feature Flag: 세션 목록 표시 여부 (모바일에서는 숨김 — 공간 부족) */}
          {showSessionList && (
            <div className="hidden sm:block">
              <ChatSessionList
                selectedSessionId={selectedSessionId}
                onSelectSession={setSelectedSessionId}
              />
            </div>
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

        {/* [P2-02] 스마트 검색 탭 - Always mounted to preserve search results */}
        <div
          id="panel-search"
          role="tabpanel"
          aria-labelledby="tab-search"
          className={`h-full ${activeTab !== 'search' ? 'hidden' : ''}`}
        >
          <SmartSearchTab />
        </div>

        {/* [P4-02] AI Structurer 탭 - Feature Flag로 제어 */}
        {FEATURE_FLAGS.ENABLE_AI_STRUCTURER && (
          <div
            id="panel-structure"
            role="tabpanel"
            aria-labelledby="tab-structure"
            className={`h-full ${activeTab !== 'structure' ? 'hidden' : ''}`}
          >
            <StructureTab />
          </div>
        )}

        {/* -----------------------------------------------------------------------
            [Deep Scholar P4-01] Research 탭 - 외부 학술/정부 자료 검색
            - Feature Flag: ENABLE_DEEP_SCHOLAR
            - 인용 삽입 시 useEditorState.insertCitation 사용
            ----------------------------------------------------------------------- */}
        {FEATURE_FLAGS.ENABLE_DEEP_SCHOLAR && (
          <div
            id="panel-research"
            role="tabpanel"
            aria-labelledby="tab-research"
            className={`h-full ${activeTab !== 'research' ? 'hidden' : ''}`}
          >
            <ResearchPanel />
          </div>
        )}
      </div>
    </div>
  )
}

