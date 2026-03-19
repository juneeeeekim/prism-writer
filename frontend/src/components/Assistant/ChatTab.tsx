// =============================================================================
// PRISM Writer - ChatTab (Refactored)
// =============================================================================
// 파일: frontend/src/components/Assistant/ChatTab.tsx
// 역할: AI 채팅 탭 - 메인 컨테이너
// 리팩토링: 2026-01-20 - 737줄 → ~80줄
// [P3-10] 2026-03-19: Coach selector 통합
// =============================================================================

'use client'

import { useRef, useEffect, useState } from 'react'
import { useChat } from '@/hooks/useChat'
import { useCoach } from '@/hooks/useCoach'
import { useProject } from '@/contexts/ProjectContext'
import { MessageItem, ChatInput } from './chat'
import ChatModelSelector from './ChatModelSelector'
import CoachManager from '@/components/Coach/CoachManager'

// =============================================================================
// Types
// =============================================================================

interface ChatTabProps {
  sessionId?: string | null
  onSessionChange: (sessionId: string) => void
}

// =============================================================================
// Component
// =============================================================================

export default function ChatTab({ sessionId, onSessionChange }: ChatTabProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [showCoachManager, setShowCoachManager] = useState(false)

  // [P3-10] Coach state
  const { currentProject } = useProject()
  const projectId = currentProject?.id ?? null
  const { activeCoach, activateCoach } = useCoach(projectId)

  const {
    messages,
    input,
    setInput,
    isLoading,
    handleSend,
    projectId: chatProjectId,
    statusText,  // [P3-01] Progressive Streaming 상태 메시지
  } = useChat({ sessionId, onSessionChange, coachId: activeCoach?.id ?? null })

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Coach Manager 오버레이
  if (showCoachManager) {
    return (
      <div className="flex flex-col h-full bg-white dark:bg-gray-900">
        <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
          <button
            onClick={() => setShowCoachManager(false)}
            className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
          >
            &larr; 채팅으로 돌아가기
          </button>
        </div>
        <div className="flex-1 overflow-hidden">
          <CoachManager onClose={() => setShowCoachManager(false)} />
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900">
      {/* =========================================================================
          [Phase 2] Model Selector - 채팅 모델 선택 UI (2026-01-23 추가)
          ========================================================================= */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
        <ChatModelSelector />
      </div>

      {/* =========================================================================
          [P3-10] Coach indicator / selector
          ========================================================================= */}
      <div className="flex items-center px-4 py-1.5 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30">
        {activeCoach ? (
          <button
            onClick={() => activateCoach(null)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-900/60 transition-colors group"
            title="클릭하여 코치 비활성화"
          >
            <span>{activeCoach.icon}</span>
            <span className="font-medium">{activeCoach.name}</span>
            <span className="text-blue-400 dark:text-blue-500 group-hover:text-red-500 transition-colors">
              &times;
            </span>
          </button>
        ) : (
          <button
            onClick={() => setShowCoachManager(true)}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors"
          >
            <span className="text-sm">🎓</span>
            <span>코치 선택</span>
          </button>
        )}
        {activeCoach && (
          <button
            onClick={() => setShowCoachManager(true)}
            className="ml-1.5 text-xs text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            title="코치 관리"
          >
            관리
          </button>
        )}
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 space-y-2">
            <span className="text-4xl">💬</span>
            <p>AI 어시스턴트와 대화를 시작해보세요.</p>
          </div>
        )}

        {messages.map((message) => (
          <MessageItem
            key={message.id}
            message={message}
            projectId={chatProjectId}
          />
        ))}

        {/* [P3-01] Progressive Streaming - 상태 메시지 UI */}
        {statusText && (
          <div className="flex items-center gap-2 px-4 py-2 text-sm text-gray-500 dark:text-gray-400 animate-pulse">
            <span>{statusText}</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <ChatInput
        value={input}
        onChange={setInput}
        onSend={handleSend}
        isLoading={isLoading}
      />
    </div>
  )
}
