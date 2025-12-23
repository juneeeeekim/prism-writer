// =============================================================================
// PRISM Writer - Assistant Panel
// =============================================================================
// 파일: frontend/src/components/Assistant/AssistantPanel.tsx
// 역할: RAG 어시스턴트 패널 (탭 구조: 목차 제안 / 참고자료 / AI 채팅 / 평가)
// 접근성: role="tablist", role="tabpanel" 적용
// =============================================================================

'use client'

import { useState } from 'react'
import OutlineTab from './OutlineTab'
import ReferenceTab from './ReferenceTab'
import ChatTab from './ChatTab'
import EvaluationTab from './EvaluationTab'
import ChatSessionList from './ChatSessionList'

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
// -----------------------------------------------------------------------------
const TABS: Tab[] = [
  { id: 'outline', label: '목차 제안', icon: '🗂️' },
  { id: 'reference', label: '참고자료', icon: '📚' },
  { id: 'chat', label: 'AI 채팅', icon: '💬' },
  { id: 'evaluation', label: '평가', icon: '📊' },
]

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------
export default function AssistantPanel() {
  const [activeTab, setActiveTab] = useState<TabId>('outline')
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null)

  return (
    <div className="flex flex-col h-full">
      {/* ... (Tab List remains the same) */}
      <div 
        className="flex border-b border-gray-200 dark:border-gray-700"
        role="tablist"
        aria-label="어시스턴트 기능 탭"
      >
        {TABS.map((tab) => (
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
          Tab Panels
          ----------------------------------------------------------------------- */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        {/* 목차 제안 탭 */}
        <div
          id="panel-outline"
          role="tabpanel"
          aria-labelledby="tab-outline"
          hidden={activeTab !== 'outline'}
          className="h-full"
        >
          {activeTab === 'outline' && <OutlineTab />}
        </div>

        {/* 참고자료 탭 */}
        <div
          id="panel-reference"
          role="tabpanel"
          aria-labelledby="tab-reference"
          hidden={activeTab !== 'reference'}
          className="h-full"
        >
          {activeTab === 'reference' && <ReferenceTab />}
        </div>

        {/* AI 채팅 탭 */}
        <div
          id="panel-chat"
          role="tabpanel"
          aria-labelledby="tab-chat"
          hidden={activeTab !== 'chat'}
          className="h-full flex"
        >
          {activeTab === 'chat' && (
            <>
              <ChatSessionList 
                selectedSessionId={selectedSessionId} 
                onSelectSession={setSelectedSessionId} 
              />
              <div className="flex-1 min-w-0 h-full">
                <ChatTab 
                  sessionId={selectedSessionId} 
                  onSessionChange={setSelectedSessionId} 
                />
              </div>
            </>
          )}
        </div>

        {/* 평가 탭 */}
        <div
          id="panel-evaluation"
          role="tabpanel"
          aria-labelledby="tab-evaluation"
          hidden={activeTab !== 'evaluation'}
          className="h-full"
        >
          {activeTab === 'evaluation' && <EvaluationTab />}
        </div>
      </div>
    </div>
  )
}
