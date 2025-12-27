// =============================================================================
// PRISM Writer - Custom Hooks
// =============================================================================
// 파일: frontend/src/hooks/useAssistantSessions.ts
// 역할: 어시스턴트 세션 관리 훅 (Outline/Evaluation 탭용)
// 패턴: Adapter 패턴 - session_type에 따라 API 분기
// =============================================================================

import { useState, useEffect, useCallback } from 'react'

// =============================================================================
// Types
// =============================================================================
export interface AssistantSession {
  id: string
  title: string
  session_type: 'outline' | 'evaluation'
  metadata: Record<string, any>
  updated_at: string
}

export type SessionType = 'outline' | 'evaluation'

// =============================================================================
// Hook
// =============================================================================
export function useAssistantSessions(sessionType: SessionType) {
  const [sessions, setSessions] = useState<AssistantSession[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // API 엔드포인트 (Adapter 패턴)
  const endpoint = `/api/assistant/sessions?type=${sessionType}`

  // ---------------------------------------------------------------------------
  // 세션 목록 조회
  // ---------------------------------------------------------------------------
  const refreshSessions = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)
      
      const res = await fetch(endpoint)
      if (!res.ok) throw new Error('Failed to fetch sessions')
      
      const data = await res.json()
      setSessions(data.sessions || [])
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      setError(message)
      console.error(`[useAssistantSessions:${sessionType}] Error:`, err)
    } finally {
      setIsLoading(false)
    }
  }, [endpoint, sessionType])

  // 초기 로드
  useEffect(() => {
    refreshSessions()
  }, [refreshSessions])

  // ---------------------------------------------------------------------------
  // 새 세션 생성
  // ---------------------------------------------------------------------------
  const createSession = useCallback(async (title?: string): Promise<AssistantSession | null> => {
    try {
      const res = await fetch('/api/assistant/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_type: sessionType,
          title: title || '새 세션',
        }),
      })

      if (!res.ok) throw new Error('Failed to create session')

      const data = await res.json()
      if (data.session) {
        setSessions([data.session, ...sessions])
        return data.session
      }
      return null
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      setError(message)
      console.error(`[useAssistantSessions:${sessionType}] Create error:`, err)
      return null
    }
  }, [sessionType, sessions])

  // ---------------------------------------------------------------------------
  // 세션 삭제
  // ---------------------------------------------------------------------------
  const deleteSession = useCallback(async (id: string): Promise<boolean> => {
    try {
      const res = await fetch(`/api/assistant/sessions/${id}`, {
        method: 'DELETE',
      })

      if (!res.ok) throw new Error('Failed to delete session')

      setSessions(sessions.filter(s => s.id !== id))
      return true
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      setError(message)
      console.error(`[useAssistantSessions:${sessionType}] Delete error:`, err)
      return false
    }
  }, [sessions, sessionType])

  return {
    sessions,
    isLoading,
    error,
    createSession,
    deleteSession,
    refreshSessions,
  }
}
