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
  } = useChat({ sessionId, onSessionChange })

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900">
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
