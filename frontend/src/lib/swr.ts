// =================================================================
// [CHAT HISTORY] SWR Configuration
// 채팅 세션 목록 캐싱을 위한 SWR 설정
// =================================================================

import useSWR, { SWRConfiguration } from 'swr'

/**
 * SWR Global Configuration
 * 
 * 최적화 포인트:
 * - revalidateOnFocus: false - 탭 전환 시 재요청 방지
 * - dedupingInterval: 30000 - 30초 내 중복 요청 방지
 * - errorRetryCount: 3 - 에러 시 3회 재시도
 */
export const swrConfig: SWRConfiguration = {
  revalidateOnFocus: false,       // 포커스 시 재검증 비활성화
  revalidateOnReconnect: true,    // 네트워크 재연결 시 재검증
  dedupingInterval: 30000,        // 30초 캐시 (중복 요청 방지)
  errorRetryCount: 3,             // 에러 시 3회 재시도
  errorRetryInterval: 1000,       // 재시도 간격 1초
  shouldRetryOnError: true,       // 에러 시 재시도 활성화
}

/**
 * Default fetcher for SWR
 * JSON API 응답을 위한 기본 fetcher
 */
export async function fetcher<T>(url: string): Promise<T> {
  const response = await fetch(url)
  
  if (!response.ok) {
    const error = new Error('API 요청 실패')
    throw error
  }
  
  return response.json()
}

// =================================================================
// Chat Session Types
// =================================================================

export interface ChatSession {
  id: string
  user_id: string
  title: string
  model_id: string | null
  created_at: string
  updated_at: string
}

export interface ChatMessage {
  id: string
  session_id: string
  role: 'user' | 'assistant'
  content: string
  model_id: string | null
  tokens_used: number | null
  created_at: string
}

// =================================================================
// Chat Session Hooks
// =================================================================

/**
 * Hook for fetching chat sessions list
 * 캐싱 적용으로 목록 조회 성능 최적화
 */
export function useChatSessions() {
  return useSWR<{ sessions: ChatSession[] }>(
    '/api/chat/sessions',
    fetcher,
    {
      ...swrConfig,
      revalidateOnMount: true,  // 마운트 시 항상 검증
    }
  )
}

/**
 * Hook for fetching messages of a specific session
 * @param sessionId - UUID of the chat session
 */
export function useChatMessages(sessionId: string | null) {
  return useSWR<{ messages: ChatMessage[] }>(
    sessionId ? `/api/chat/sessions/${sessionId}` : null,
    fetcher,
    {
      ...swrConfig,
      revalidateOnMount: true,
    }
  )
}

// =================================================================
// API Endpoints (for reference)
// =================================================================
export const CHAT_API_ENDPOINTS = {
  SESSIONS: '/api/chat/sessions',
  SESSION_BY_ID: (id: string) => `/api/chat/sessions/${id}`,
  CHAT_V2: '/api/chat/v2',
} as const
