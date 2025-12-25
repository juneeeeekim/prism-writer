'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------
interface ChatSession {
  id: string
  title: string
  model_id: string | null
  updated_at: string
}

interface ChatSessionListProps {
  selectedSessionId: string | null
  onSelectSession: (sessionId: string) => void
}

// -----------------------------------------------------------------------------
// Constants - 리사이즈 제한값
// -----------------------------------------------------------------------------
const MIN_WIDTH = 180  // 최소 너비 (px)
const MAX_WIDTH = 400  // 최대 너비 (px)
const DEFAULT_WIDTH = 256  // 기본 너비 (w-64 = 256px)

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------
export default function ChatSessionList({ 
  selectedSessionId, 
  onSelectSession 
}: ChatSessionListProps) {
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  
  // ===========================================================================
  // [RESIZE] 사이드바 너비 리사이즈 상태 관리
  // ===========================================================================
  const [width, setWidth] = useState(DEFAULT_WIDTH)
  const [isResizing, setIsResizing] = useState(false)
  const sidebarRef = useRef<HTMLDivElement>(null)

  // ===========================================================================
  // [RESIZE] 마우스 드래그 이벤트 핸들러
  // ===========================================================================
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsResizing(true)
  }, [])

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizing) return
    
    const newWidth = e.clientX - (sidebarRef.current?.getBoundingClientRect().left || 0)
    
    // 최소/최대 너비 제한 적용
    if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) {
      setWidth(newWidth)
    }
  }, [isResizing])

  const handleMouseUp = useCallback(() => {
    setIsResizing(false)
  }, [])

  // 글로벌 마우스 이벤트 리스너 등록/해제
  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      // 드래그 중 텍스트 선택 방지
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
    }
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [isResizing, handleMouseMove, handleMouseUp])

  // ---------------------------------------------------------------------------
  // Load Sessions
  // ---------------------------------------------------------------------------
  const fetchSessions = async () => {
    try {
      setIsLoading(true)
      const res = await fetch('/api/chat/sessions')
      if (!res.ok) throw new Error('Failed to fetch sessions')
      const data = await res.json()
      setSessions(data.sessions || [])
    } catch (error) {
      console.error('Error loading sessions:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchSessions()
  }, [])

  // ---------------------------------------------------------------------------
  // Create New Session
  // ---------------------------------------------------------------------------
  const handleCreateNew = async () => {
    if (isCreating) return
    try {
      setIsCreating(true)
      const res = await fetch('/api/chat/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: '새 대화' }),
      })
      
      if (!res.ok) throw new Error('Failed to create session')
      
      const data = await res.json()
      if (data.session) {
        setSessions([data.session, ...sessions])
        onSelectSession(data.session.id)
      }
    } catch (error) {
      console.error('Error creating session:', error)
    } finally {
      setIsCreating(false)
    }
  }

  // ---------------------------------------------------------------------------
  // Delete Session
  // ---------------------------------------------------------------------------
  const handleDelete = async (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation()
    if (!confirm('정말 이 대화를 삭제하시겠습니까?')) return

    try {
      const res = await fetch(`/api/chat/sessions/${sessionId}`, {
        method: 'DELETE',
      })
      
      if (!res.ok) throw new Error('Failed to delete session')
      
      setSessions(sessions.filter(s => s.id !== sessionId))
      if (selectedSessionId === sessionId) {
        onSelectSession('') // Deselect
      }
    } catch (error) {
      console.error('Error deleting session:', error)
    }
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div 
      ref={sidebarRef}
      className="flex flex-col h-full border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex-shrink-0 relative"
      style={{ width: `${width}px` }}
    >
      {/* Header & New Chat Button */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={handleCreateNew}
          disabled={isCreating}
          className="w-full flex items-center justify-center px-4 py-2 bg-prism-primary text-white rounded-lg hover:bg-prism-primary/90 transition-colors disabled:opacity-50 text-sm font-medium"
        >
          {isCreating ? '생성 중...' : '+ 새 대화'}
        </button>
      </div>

      {/* Session List */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="p-4 text-center text-gray-500 text-sm">로딩 중...</div>
        ) : sessions.length === 0 ? (
          <div className="p-4 text-center text-gray-500 text-sm">
            대화 내역이 없습니다.
            <br />
            새 대화를 시작해보세요!
          </div>
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-gray-800">
            {sessions.map((session) => (
              <li key={session.id}>
                <button
                  onClick={() => onSelectSession(session.id)}
                  className={`w-full text-left px-4 py-3 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors group relative
                    ${selectedSessionId === session.id ? 'bg-white dark:bg-gray-800 border-l-4 border-prism-primary' : 'border-l-4 border-transparent'}
                  `}
                >
                  <div className="pr-6">
                    <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                      {session.title}
                    </h3>
                    <p className="text-xs text-gray-500 mt-1">
                      {new Intl.DateTimeFormat('ko-KR', { month: 'long', day: 'numeric', hour: 'numeric', minute: 'numeric', hour12: true }).format(new Date(session.updated_at))}
                    </p>
                  </div>
                  
                  {/* Delete Button (Visible on Hover) */}
                  <div 
                    onClick={(e) => handleDelete(e, session.id)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                    role="button"
                    aria-label="대화 삭제"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* =========================================================================
          [RESIZE] 드래그 핸들 (사이드바 오른쪽 가장자리)
          ========================================================================= */}
      <div
        onMouseDown={handleMouseDown}
        className={`absolute top-0 right-0 w-1 h-full cursor-col-resize transition-colors
          ${isResizing 
            ? 'bg-prism-primary' 
            : 'bg-transparent hover:bg-gray-300 dark:hover:bg-gray-600'
          }`}
        title="드래그하여 너비 조절"
      />
    </div>
  )
}

