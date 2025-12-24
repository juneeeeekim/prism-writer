'use client'

import { useState, useRef, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------
interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

interface ChatTabProps {
  sessionId?: string | null  // undefined = Feature Flag OFF (legacy mode)
  onSessionChange: (sessionId: string) => void
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------
export default function ChatTab({ sessionId, onSessionChange }: ChatTabProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // ---------------------------------------------------------------------------
  // Auto-scroll to bottom
  // ---------------------------------------------------------------------------
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // ---------------------------------------------------------------------------
  // Load Messages when Session Changes
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const loadMessages = async () => {
      // -----------------------------------------------------------------------
      // Feature Flag OFF (sessionId === undefined): 세션 관리 비활성화, 기존 메시지 유지
      // Feature Flag ON + 세션 미선택 (sessionId === null): 빈 메시지
      // Feature Flag ON + 세션 선택 (sessionId exists): API에서 메시지 로드
      // -----------------------------------------------------------------------
      if (sessionId === undefined) {
        // Legacy mode: 세션 관리 안 함, 메시지 유지
        return
      }
      if (sessionId === null) {
        setMessages([])
        return
      }

      try {
        setIsLoading(true)
        const res = await fetch(`/api/chat/sessions/${sessionId}`)
        if (!res.ok) throw new Error('Failed to load messages')
        
        const data = await res.json()
        const loadedMessages = data.messages.map((m: any) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          timestamp: new Date(m.created_at)
        }))
        setMessages(loadedMessages)
      } catch (error) {
        console.error('Error loading messages:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadMessages()
  }, [sessionId])

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
      // -----------------------------------------------------------------------
      // Feature Flag OFF (sessionId === undefined): 세션 생성 안 함
      // Feature Flag ON + 세션 없음 (sessionId === null): 새 세션 생성
      // -----------------------------------------------------------------------
      let currentSessionId = sessionId
      if (sessionId === null) {
        // Feature Flag ON이지만 세션이 없으면 새로 생성
        try {
          const sessionRes = await fetch('/api/chat/sessions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: input.slice(0, 30) }), // 첫 메시지로 제목 설정
          })
          const sessionData = await sessionRes.json()
          if (sessionData.session) {
            currentSessionId = sessionData.session.id
            if (currentSessionId) {
              onSessionChange(currentSessionId)
            }
          }
        } catch (error) {
          console.error('Failed to create session:', error)
        }
      }

      // -----------------------------------------------------------------------
      // Admin Mode에서 선택한 모델 가져오기 (localStorage)
      // -----------------------------------------------------------------------
      const selectedModel = typeof window !== 'undefined' 
        ? localStorage.getItem('prism_selected_model') 
        : null

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          messages: [...messages, userMessage].map(m => ({ role: m.role, content: m.content })),
          model: selectedModel || undefined,
          sessionId: currentSessionId // 세션 ID 전달
        }),
      })

      if (!response.ok) throw new Error('Network response was not ok')
      if (!response.body) throw new Error('No response body')

      // -----------------------------------------------------------------------
      // Stream Response Handling
      // -----------------------------------------------------------------------
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let aiMessageContent = ''
      
      // AI 메시지 플레이스홀더 추가
      const aiMessageId = (Date.now() + 1).toString()
      setMessages((prev) => [
        ...prev,
        {
          id: aiMessageId,
          role: 'assistant',
          content: '',
          timestamp: new Date(),
        },
      ])

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        aiMessageContent += chunk

        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === aiMessageId
              ? { ...msg, content: aiMessageContent }
              : msg
          )
        )
      }
    } catch (error) {
      console.error('Error:', error)
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 2).toString(),
          role: 'assistant',
          content: '죄송합니다. 오류가 발생했습니다. 다시 시도해주세요.',
          timestamp: new Date(),
        },
      ])
    } finally {
      setIsLoading(false)
    }
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
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
          <div
            key={message.id}
            className={`flex ${
              message.role === 'user' ? 'justify-end' : 'justify-start'
            }`}
          >
            <div
              className={`max-w-[85%] rounded-lg p-3 ${
                message.role === 'user'
                  ? 'bg-prism-primary text-white'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100'
              }`}
            >
              {message.role === 'user' ? (
                <p className="whitespace-pre-wrap">{message.content}</p>
              ) : (
                <div className="prose dark:prose-invert max-w-none text-sm">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      code({ node, inline, className, children, ...props }: any) {
                        const match = /language-(\w+)/.exec(className || '')
                        return !inline && match ? (
                          <div className="bg-gray-800 text-white p-2 rounded overflow-x-auto my-2">
                            <code className={className} {...props}>
                              {children}
                            </code>
                          </div>
                        ) : (
                          <code className={className} {...props}>
                            {children}
                          </code>
                        )
                      },
                    }}
                  >
                    {message.content}
                  </ReactMarkdown>
                </div>
              )}
              <span className="text-xs opacity-70 mt-1 block">
                {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
        <div className="flex space-x-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSend()
              }
            }}
            placeholder="메시지를 입력하세요..."
            className="flex-1 p-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-prism-primary bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 resize-none h-[50px]"
            disabled={isLoading}
          />
          <button
            onClick={handleSend}
            disabled={isLoading || !input.trim()}
            className="px-4 py-2 bg-prism-primary text-white rounded-lg hover:bg-prism-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? (
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
