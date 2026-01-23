// =============================================================================
// PRISM Writer - ChatTab (Refactored)
// =============================================================================
// 파일: frontend/src/components/Assistant/ChatTab.tsx
// 역할: AI 채팅 탭 - 메인 컨테이너
// 리팩토링: 2026-01-20 - 737줄 → ~80줄
// =============================================================================

'use client'

import { useRef, useEffect } from 'react'
import { useChat } from '@/hooks/useChat'
import { MessageItem, ChatInput } from './chat'
import ChatModelSelector from './ChatModelSelector'

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

  const {
    messages,
    input,
    setInput,
    isLoading,
    handleSend,
    projectId,
    statusText,  // [P3-01] Progressive Streaming 상태 메시지
  } = useChat({ sessionId, onSessionChange })

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900">
      {/* =========================================================================
          [Phase 2] Model Selector - 채팅 모델 선택 UI (2026-01-23 추가)
          ========================================================================= */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
        <ChatModelSelector />
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
            projectId={projectId}
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
