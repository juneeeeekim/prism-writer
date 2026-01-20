// =============================================================================
// PRISM Writer - useChat Hook
// =============================================================================
// 파일: frontend/src/hooks/useChat.ts
// 역할: 채팅 상태 관리 및 메시지 전송 로직
// 리팩토링: 2026-01-20
// =============================================================================

import { useState, useEffect, useCallback } from 'react'
import { useEditorState } from '@/hooks/useEditorState'
import { useProject } from '@/contexts/ProjectContext'
import { addToLocalBackup, updateBackupStatus } from '@/lib/utils/chatBackup'
import type { Message } from '@/components/Assistant/chat/MessageItem'

// =============================================================================
// Constants
// =============================================================================

const CHAT_TIMEOUT_MS = 30_000

// =============================================================================
// Types
// =============================================================================

export interface UseChatOptions {
  sessionId?: string | null
  onSessionChange: (sessionId: string) => void
}

export interface UseChatReturn {
  messages: Message[]
  input: string
  setInput: (value: string) => void
  isLoading: boolean
  handleSend: () => Promise<void>
  projectId: string | null
}

// =============================================================================
// Hook
// =============================================================================

export function useChat({ sessionId, onSessionChange }: UseChatOptions): UseChatReturn {
  const { currentProject } = useProject()
  const projectId = currentProject?.id ?? null

  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  // Chat Draft consumption
  const chatDraft = useEditorState((state) => state.chatDraft)
  const setChatDraft = useEditorState((state) => state.setChatDraft)

  useEffect(() => {
    if (chatDraft) {
      setInput(chatDraft)
      setChatDraft(null)
    }
  }, [chatDraft, setChatDraft])

  // Load messages when session changes
  useEffect(() => {
    const loadMessages = async () => {
      if (sessionId === undefined) return
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
          timestamp: new Date(m.created_at),
          metadata: m.metadata,
          feedback: m.feedback ?? null,
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

  // Refresh messages helper
  const refreshMessages = async (sid: string) => {
    try {
      const res = await fetch(`/api/chat/sessions/${sid}`)
      if (!res.ok) return
      const data = await res.json()
      setMessages(
        data.messages.map((m: any) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          timestamp: new Date(m.created_at),
          metadata: m.metadata,
          feedback: m.feedback ?? null,
        }))
      )
    } catch (e) {
      console.error(e)
    }
  }

  // Send message handler
  const handleSend = useCallback(async () => {
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

    const abortController = new AbortController()
    let timeoutId: NodeJS.Timeout | null = setTimeout(() => {
      abortController.abort()
    }, CHAT_TIMEOUT_MS)

    let currentSessionId = sessionId

    try {
      // Create session if needed
      if (sessionId === null) {
        try {
          const sessionRes = await fetch('/api/chat/sessions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              title: input.slice(0, 30),
              projectId,
            }),
            signal: abortController.signal,
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

      const selectedModel =
        typeof window !== 'undefined'
          ? localStorage.getItem('prism_selected_model')
          : null

      const backupTimestamp = new Date().toISOString()
      addToLocalBackup(currentSessionId ?? null, 'user', userMessage.content, 'pending')

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, userMessage].map((m) => ({
            role: m.role,
            content: m.content,
          })),
          model: selectedModel || undefined,
          sessionId: currentSessionId,
          projectId,
        }),
        signal: abortController.signal,
      })

      if (!response.ok) throw new Error('Network response was not ok')
      if (!response.body) throw new Error('No response body')

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let aiMessageContent = ''
      let firstTokenReceived = false

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

        if (!firstTokenReceived && timeoutId) {
          clearTimeout(timeoutId)
          timeoutId = null
          firstTokenReceived = true
        }

        const chunk = decoder.decode(value, { stream: true })
        aiMessageContent += chunk

        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === aiMessageId ? { ...msg, content: aiMessageContent } : msg
          )
        )
      }

      updateBackupStatus(backupTimestamp, 'synced')
    } catch (error: any) {
      console.error('Error:', error)

      let errorMessage = '죄송합니다. 오류가 발생했습니다. 다시 시도해주세요.'

      if (error?.name === 'AbortError') {
        errorMessage = '⏱️ 응답 시간이 초과되었습니다. 네트워크 상태를 확인하고 다시 시도해주세요.'
      } else if (error?.message?.includes('401') || error?.message?.includes('Unauthorized')) {
        errorMessage = '🔒 로그인이 필요합니다. 로그인 후 다시 시도해주세요.'
      }

      addToLocalBackup(currentSessionId ?? null, 'user', userMessage.content, 'failed')

      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 2).toString(),
          role: 'assistant',
          content: errorMessage,
          timestamp: new Date(),
        },
      ])
    } finally {
      if (timeoutId) clearTimeout(timeoutId)
      setIsLoading(false)

      if (currentSessionId) {
        setTimeout(() => refreshMessages(currentSessionId!), 500)
      }
    }
  }, [input, isLoading, messages, sessionId, projectId, onSessionChange])

  return {
    messages,
    input,
    setInput,
    isLoading,
    handleSend,
    projectId,
  }
}
