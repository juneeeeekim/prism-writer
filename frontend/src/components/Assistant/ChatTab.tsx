'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useEditorState } from '@/hooks/useEditorState'
import { useProject } from '@/contexts/ProjectContext'  // [FIX] 프로젝트 격리

// =============================================================================
// Constants (Pipeline v5 업그레이드)
// =============================================================================

/** 채팅 API 타임아웃 (30초) */
const CHAT_TIMEOUT_MS = 30_000

/** 로컬 백업 저장 키 */
const LOCAL_BACKUP_KEY = 'prism_chat_backup'

/** 최대 로컬 백업 메시지 수 */
const MAX_BACKUP_MESSAGES = 50

// =============================================================================
// Types
// =============================================================================
interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  metadata?: {
    citation_verification?: {
      valid: boolean
      matchScore: number
    }
  }
}

interface ChatTabProps {
  sessionId?: string | null  // undefined = Feature Flag OFF (legacy mode)
  onSessionChange: (sessionId: string) => void
}

/** 로컬 백업 데이터 구조 */
interface BackupData {
  messages: Array<{
    sessionId: string | null
    role: 'user' | 'assistant'
    content: string
    timestamp: string
    syncStatus: 'pending' | 'failed' | 'synced'
  }>
  lastUpdated: string
}

// =============================================================================
// Local Backup Utilities (Pipeline v5: 메시지 저장 실패 시 로컬 백업)
// =============================================================================

/**
 * 로컬 백업에 메시지 추가
 *
 * @description
 * 주석(시니어 개발자): 메시지 저장 실패 시 localStorage에 백업
 * - 최대 50개까지 보관
 * - 동기화 상태 추적 (pending/failed/synced)
 */
function addToLocalBackup(
  sessionId: string | null,
  role: 'user' | 'assistant',
  content: string,
  syncStatus: 'pending' | 'failed' = 'pending'
): void {
  if (typeof window === 'undefined') return

  try {
    const existing = localStorage.getItem(LOCAL_BACKUP_KEY)
    const backup: BackupData = existing
      ? JSON.parse(existing)
      : { messages: [], lastUpdated: '' }

    backup.messages.push({
      sessionId,
      role,
      content,
      timestamp: new Date().toISOString(),
      syncStatus,
    })

    // 최대 개수 초과 시 오래된 것부터 삭제
    if (backup.messages.length > MAX_BACKUP_MESSAGES) {
      backup.messages = backup.messages.slice(-MAX_BACKUP_MESSAGES)
    }

    backup.lastUpdated = new Date().toISOString()
    localStorage.setItem(LOCAL_BACKUP_KEY, JSON.stringify(backup))
  } catch (error) {
    console.warn('[LocalBackup] Failed to save backup:', error)
  }
}

/**
 * 로컬 백업에서 실패한 메시지 가져오기
 */
function getFailedBackups(): BackupData['messages'] {
  if (typeof window === 'undefined') return []

  try {
    const existing = localStorage.getItem(LOCAL_BACKUP_KEY)
    if (!existing) return []

    const backup: BackupData = JSON.parse(existing)
    return backup.messages.filter(m => m.syncStatus === 'failed')
  } catch {
    return []
  }
}

/**
 * 로컬 백업 메시지 상태 업데이트
 */
function updateBackupStatus(
  timestamp: string,
  newStatus: 'pending' | 'failed' | 'synced'
): void {
  if (typeof window === 'undefined') return

  try {
    const existing = localStorage.getItem(LOCAL_BACKUP_KEY)
    if (!existing) return

    const backup: BackupData = JSON.parse(existing)
    const msg = backup.messages.find(m => m.timestamp === timestamp)
    if (msg) {
      msg.syncStatus = newStatus
      // synced 메시지는 일정 시간 후 삭제 가능
      localStorage.setItem(LOCAL_BACKUP_KEY, JSON.stringify(backup))
    }
  } catch {
    // ignore
  }
}

// =============================================================================
// Component
// =============================================================================
export default function ChatTab({ sessionId, onSessionChange }: ChatTabProps) {
  // ===========================================================================
  // [FIX] 프로젝트 Context에서 현재 프로젝트 ID 가져오기
  // ===========================================================================
  const { currentProject } = useProject()
  const projectId = currentProject?.id ?? null

  // [DEBUG] 프로젝트 ID 추적용 (문제 해결 후 삭제)
  console.log('[ChatTab] currentProject:', currentProject?.name, '| projectId:', projectId)

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

  // ===========================================================================
  // [Phase 8] Chat Draft Consumption
  // ===========================================================================
  const chatDraft = useEditorState((state) => state.chatDraft)
  const setChatDraft = useEditorState((state) => state.setChatDraft)

  useEffect(() => {
    if (chatDraft) {
      setInput(chatDraft)
      // Consume the draft (reset to null) so it doesn't trigger again
      setChatDraft(null)
      // Auto focus logic (optional)
    }
  }, [chatDraft, setChatDraft])

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
          timestamp: new Date(m.created_at),
          metadata: m.metadata // 메타데이터 매핑
        }))
        setMessages(loadedMessages)
      } catch (error) {
        console.error('Error loading messages:', error)
      } finally {
        setIsLoading(false)
      }
    }
    
    // loadMessages 함수를 handleSend에서도 사용할 수 있도록 외부로 분리 필요하지만,
    // 현재는 useEffect 내부라 접근 불가. 
    // 리팩토링 대신 sessionId 변경 시만 호출되도록 둠.
    // 임시 해결: handleSend 완료 후 forceUpdate 또는 fetch 로직 복사.
    
    loadMessages()
  }, [sessionId])
  
  // loadMessages 로직 재사용을 위한 헬퍼 (useEffect 밖으로 이동 불가 시 복제)
  const refreshMessages = async (sid: string) => {
    try {
      const res = await fetch(`/api/chat/sessions/${sid}`)
      if (!res.ok) return
      const data = await res.json()
      setMessages(data.messages.map((m: any) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        timestamp: new Date(m.created_at),
        metadata: m.metadata
      })))
    } catch (e) { console.error(e) }
  }

  // ---------------------------------------------------------------------------
  // Send Message Handler (Pipeline v5: 타임아웃 + 로컬 백업 추가)
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

    // =========================================================================
    // [Pipeline v5] AbortController 설정 (30초 타임아웃)
    // =========================================================================
    // 주석(시니어 개발자): 스트리밍 응답의 전체 타임아웃 설정
    // - 첫 토큰 수신 전 30초 초과 시 취소
    // - 스트리밍 중에는 타임아웃 연장
    const abortController = new AbortController()
    let timeoutId: NodeJS.Timeout | null = null

    // 초기 타임아웃 설정
    timeoutId = setTimeout(() => {
      abortController.abort()
      console.warn('[ChatTab] Request timeout after 30s')
    }, CHAT_TIMEOUT_MS)

    // -----------------------------------------------------------------------
    // Feature Flag OFF (sessionId === undefined): 세션 생성 안 함
    // Feature Flag ON + 세션 없음 (sessionId === null): 새 세션 생성
    // -----------------------------------------------------------------------
    let currentSessionId = sessionId

    try {
      if (sessionId === null) {
        // Feature Flag ON이지만 세션이 없으면 새로 생성
        try {
          const sessionRes = await fetch('/api/chat/sessions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              title: input.slice(0, 30),  // 첫 메시지로 제목 설정
              projectId  // [FIX] 프로젝트 격리: 현재 프로젝트에 세션 연결
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

      // -----------------------------------------------------------------------
      // Admin Mode에서 선택한 모델 가져오기 (localStorage)
      // -----------------------------------------------------------------------
      const selectedModel = typeof window !== 'undefined'
        ? localStorage.getItem('prism_selected_model')
        : null

      // =========================================================================
      // [Pipeline v5] 로컬 백업: 전송 전 pending 상태로 저장
      // =========================================================================
      const backupTimestamp = new Date().toISOString()
      addToLocalBackup(currentSessionId ?? null, 'user', userMessage.content, 'pending')

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [...messages, userMessage].map(m => ({ role: m.role, content: m.content })),
          model: selectedModel || undefined,
          sessionId: currentSessionId,
          projectId,  // [RAG-ISOLATION] 프로젝트별 RAG 검색
        }),
        signal: abortController.signal,  // [Pipeline v5] 타임아웃 signal 추가
      })

      if (!response.ok) throw new Error('Network response was not ok')
      if (!response.body) throw new Error('No response body')

      // -----------------------------------------------------------------------
      // Stream Response Handling (Pipeline v5: 타임아웃 관리 개선)
      // -----------------------------------------------------------------------
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let aiMessageContent = ''
      let firstTokenReceived = false

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

        // =====================================================================
        // [Pipeline v5] 첫 토큰 수신 시 타임아웃 클리어
        // =====================================================================
        // 주석(주니어 개발자): 스트리밍이 시작되면 타임아웃 해제
        // AI 응답 생성이 오래 걸릴 수 있으므로 첫 토큰 수신 후에는 타임아웃 적용 안 함
        if (!firstTokenReceived && timeoutId) {
          clearTimeout(timeoutId)
          timeoutId = null
          firstTokenReceived = true
          console.log('[ChatTab] First token received, timeout cleared')
        }

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

      // =========================================================================
      // [Pipeline v5] 로컬 백업: 성공 시 synced로 업데이트
      // =========================================================================
      updateBackupStatus(backupTimestamp, 'synced')

    } catch (error: any) {
      console.error('Error:', error)

      // =========================================================================
      // [Pipeline v5] 에러 유형별 처리 (타임아웃 vs 기타)
      // =========================================================================
      let errorMessage = '죄송합니다. 오류가 발생했습니다. 다시 시도해주세요.'

      if (error?.name === 'AbortError') {
        // 타임아웃 에러
        errorMessage = '⏱️ 응답 시간이 초과되었습니다. 네트워크 상태를 확인하고 다시 시도해주세요.'
        console.warn('[ChatTab] Request aborted due to timeout')
      } else if (error?.message?.includes('401') || error?.message?.includes('Unauthorized')) {
        // 인증 에러
        errorMessage = '🔒 로그인이 필요합니다. 로그인 후 다시 시도해주세요.'
      }

      // [Pipeline v5] 로컬 백업: 실패 시 failed로 업데이트
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
      // =========================================================================
      // [Pipeline v5] 타임아웃 클리어 (finally에서 안전하게)
      // =========================================================================
      if (timeoutId) {
        clearTimeout(timeoutId)
      }

      setIsLoading(false)
      // 스트림 완료 후 메타데이터(검증 결과) 동기화를 위해 메시지 목록 갱신
      if (currentSessionId) {
        // 약간의 지연 후 갱신 (DB 저장 시간 고려)
        setTimeout(() => refreshMessages(currentSessionId!), 500)
      }
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
              
              {/* Citation Verification Badge */}
              {message.role === 'assistant' && message.metadata?.citation_verification && (
                <div className={`mt-1 text-xs px-2 py-1 rounded w-fit ${
                  message.metadata.citation_verification.valid 
                    ? 'bg-green-100 text-green-700' 
                    : 'bg-amber-100 text-amber-700'
                }`}>
                  {message.metadata.citation_verification.valid ? '✅ 근거 검증됨' : '⚠️ 근거 부족 가능성'} 
                  {message.metadata.citation_verification.matchScore > 0 && 
                    ` (${Math.round(message.metadata.citation_verification.matchScore * 100)}% 일치)`
                  }
                </div>
              )}
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
