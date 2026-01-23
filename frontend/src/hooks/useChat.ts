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

// [FIX] 타임아웃 30초 → 60초 증가 (RAG 파이프라인 처리 시간 고려)
// 2026-01-21: Self-RAG + Query Expansion 처리 시간으로 인한 타임아웃 방지
const CHAT_TIMEOUT_MS = 60_000

// [P2-01] Progressive Streaming - 상태 메시지 필터링용 접두사
const STATUS_PREFIX = '[STATUS]'

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
  statusText: string | null  // [P2-03] Progressive Streaming 상태 메시지
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
  const [statusText, setStatusText] = useState<string | null>(null)  // [P2-02] Progressive Streaming 상태

  // ---------------------------------------------------------------------------
  // [P3-01] 선택된 모델 상태 관리 - Chat Model Switcher 실시간 반영
  // null이면 기본값(Auto) 사용
  // ---------------------------------------------------------------------------
  const [selectedModel, setSelectedModel] = useState<string | null>(null)

  // ---------------------------------------------------------------------------
  // [P3-02] localStorage 초기값 로드 및 StorageEvent 리스너
  // 다른 탭/컴포넌트에서 모델 변경 시에도 실시간 동기화
  // ---------------------------------------------------------------------------
  useEffect(() => {
    // Safety: SSR 환경에서 window 접근 방지
    if (typeof window === 'undefined') return

    // 초기값 로드
    const storedModel = localStorage.getItem('prism_selected_model')
    setSelectedModel(storedModel)

    // 다른 탭/컴포넌트에서의 변경 감지 (StorageEvent)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'prism_selected_model') {
        setSelectedModel(e.newValue)
      }
    }

    window.addEventListener('storage', handleStorageChange)
    return () => window.removeEventListener('storage', handleStorageChange)
  }, [])

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
    setStatusText(null)  // [P2-02] 상태 초기화

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

      // ---------------------------------------------------------------------------
      // [P3-03] 선택된 모델 - 이제 상태에서 가져옴 (실시간 반영)
      // 기존: localStorage.getItem('prism_selected_model')
      // 개선: useState로 관리되는 selectedModel 사용 → 새로고침 없이 즉시 반영
      // ---------------------------------------------------------------------------
      // selectedModel은 상위 스코프에서 useState로 관리됨

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

        // ---------------------------------------------------------------------
        // [P2-01] Progressive Streaming - 상태 메시지 필터링 (개선)
        // 청크에 [STATUS] 메시지가 포함된 경우 라인별로 분리하여 처리
        // ---------------------------------------------------------------------
        if (chunk.includes(STATUS_PREFIX)) {
          const lines = chunk.split('\n')
          let contentToAdd = ''
          
          for (const line of lines) {
            if (line.startsWith(STATUS_PREFIX)) {
              // 상태 메시지 추출 및 UI 업데이트
              const statusMessage = line.replace(STATUS_PREFIX, '').trim()
              if (statusMessage) {
                setStatusText(statusMessage)
              }
            } else if (line.trim()) {
              // 상태가 아닌 실제 콘텐츠
              contentToAdd += line + '\n'
            }
          }
          
          // 실제 콘텐츠가 있으면 추가
          if (contentToAdd.trim()) {
            aiMessageContent += contentToAdd.trimEnd()
          }
          continue
        }

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
      setStatusText(null)  // [P2-02] 상태 클리어

      if (currentSessionId) {
        setTimeout(() => refreshMessages(currentSessionId!), 500)
      }
    }
  }, [input, isLoading, messages, sessionId, projectId, onSessionChange, selectedModel])

  return {
    messages,
    input,
    setInput,
    isLoading,
    handleSend,
    projectId,
    statusText,  // [P2-03] Progressive Streaming 상태 메시지
  }
}
