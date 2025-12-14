// =============================================================================
// PRISM Writer - Chat Tab
// =============================================================================
// 파일: frontend/src/components/Assistant/ChatTab.tsx
// 역할: AI 채팅 인터페이스 (Phase 3+에서 확장)
// =============================================================================

'use client'

import { useState } from 'react'

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------
interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------
export default function ChatTab() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: '안녕하세요! 글쓰기에 대해 도움이 필요하시면 질문해주세요. 📝',
      timestamp: new Date(),
    },
  ])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  // ---------------------------------------------------------------------------
  // Send Message Handler
  // ---------------------------------------------------------------------------
  const handleSend = async () => {
    if (!input.trim() || isLoading) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    try {
      // TODO: 실제 API 연동 (Phase 3에서 구현)
      await new Promise((resolve) => setTimeout(resolve, 1000))

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `"${input}"에 대해 좋은 질문이네요! 현재는 데모 모드입니다. Phase 3에서 실제 RAG 기반 응답이 연동됩니다.`,
        timestamp: new Date(),
      }

      setMessages((prev) => [...prev, assistantMessage])
    } finally {
      setIsLoading(false)
    }
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="flex flex-col h-full">
      {/* 메시지 목록 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] px-4 py-2 rounded-lg
                          ${msg.role === 'user'
                            ? 'bg-prism-primary text-white'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
                          }`}
            >
              <p className="text-sm">{msg.content}</p>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
              <span className="animate-pulse">💭 생각 중...</span>
            </div>
          </div>
        )}
      </div>

      {/* 입력 영역 */}
      <div className="border-t border-gray-200 dark:border-gray-700 p-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="질문을 입력하세요..."
            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                       bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                       focus:ring-2 focus:ring-prism-primary focus:border-transparent"
            disabled={isLoading}
            aria-label="AI에게 질문하기"
          />
          <button
            onClick={handleSend}
            disabled={isLoading || !input.trim()}
            className="px-4 py-2 bg-prism-primary text-white rounded-lg
                       hover:bg-prism-accent transition-colors disabled:opacity-50"
            aria-label="전송"
          >
            📤
          </button>
        </div>
      </div>
    </div>
  )
}
