// =============================================================================
// PRISM Writer - Generic Session List Component
// =============================================================================
// 파일: frontend/src/components/Assistant/SessionList.tsx
// 역할: 제네릭 세션 목록 컴포넌트 (Chat/Outline/Evaluation 공통)
// 패턴: Adapter 패턴 - sessionType에 따라 API 분기
// =============================================================================

'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

// =============================================================================
// Types
// =============================================================================
export interface GenericSession {
  id: string
  title: string
  updated_at: string
  // 추가 필드는 metadata로 처리 가능
}

export interface SessionListProps {
  sessionType: 'chat' | 'outline' | 'evaluation'
  selectedSessionId: string | null
  onSelectSession: (sessionId: string) => void
  // [FIX] 프로젝트 격리
  projectId?: string | null
  // 커스터마이징 옵션
  newButtonText?: string
  emptyMessage?: string
  apiEndpoint?: string // 기본값: /api/${sessionType}/sessions
}

// =============================================================================
// Constants - 리사이즈 제한값
// =============================================================================
const MIN_WIDTH = 180  // 최소 너비 (px)
const MAX_WIDTH = 400  // 최대 너비 (px)
const DEFAULT_WIDTH = 256  // 기본 너비 (w-64 = 256px)

// =============================================================================
// [50개 제한] 세션 목록 UX 최적화
// - 초기 표시: 50개
// - 더보기 클릭 시: +50개씩 추가
// =============================================================================
const INITIAL_DISPLAY_COUNT = 50
const LOAD_MORE_COUNT = 50

// =============================================================================
// Component
// =============================================================================
export default function SessionList({ 
  sessionType,
  selectedSessionId, 
  onSelectSession,
  projectId,  // [FIX] 프로젝트 격리
  newButtonText = '+ 새 세션',
  emptyMessage = '세션이 없습니다.',
  apiEndpoint,
}: SessionListProps) {
  const [sessions, setSessions] = useState<GenericSession[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  
  // ===========================================================================
  // [50개 제한] 더보기 상태 관리
  // ===========================================================================
  const [displayCount, setDisplayCount] = useState(INITIAL_DISPLAY_COUNT)
  
  // ===========================================================================
  // [RESIZE] 사이드바 너비 리사이즈 상태 관리
  // ===========================================================================
  const [width, setWidth] = useState(DEFAULT_WIDTH)
  const [isResizing, setIsResizing] = useState(false)
  const sidebarRef = useRef<HTMLDivElement>(null)

  // API 엔드포인트 결정 (Adapter 패턴)
  const endpoint = apiEndpoint || `/api/${sessionType}/sessions`

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
  // [FIX] projectId로 필터링
  // ---------------------------------------------------------------------------
  const fetchSessions = async () => {
    try {
      setIsLoading(true)
      // [FIX] projectId가 있으면 쿼리 파라미터로 전달
      const url = projectId 
        ? `${endpoint}?projectId=${projectId}`
        : endpoint
      const res = await fetch(url)
      if (!res.ok) throw new Error('Failed to fetch sessions')
      const data = await res.json()
      setSessions(data.sessions || [])
    } catch (error) {
      console.error(`[SessionList:${sessionType}] Error loading sessions:`, error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchSessions()
  }, [endpoint, projectId])  // [FIX] projectId 변경 시에도 재로드

  // ---------------------------------------------------------------------------
  // Create New Session
  // [FIX] projectId 포함
  // ---------------------------------------------------------------------------
  const handleCreateNew = async () => {
    if (isCreating) return
    try {
      setIsCreating(true)
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          title: newButtonText.replace('+ ', ''),
          projectId  // [FIX] 프로젝트에 세션 연결
        }),
      })
      
      if (!res.ok) throw new Error('Failed to create session')
      
      const data = await res.json()
      if (data.session) {
        setSessions([data.session, ...sessions])
        onSelectSession(data.session.id)
      }
    } catch (error) {
      console.error(`[SessionList:${sessionType}] Error creating session:`, error)
    } finally {
      setIsCreating(false)
    }
  }

  // ---------------------------------------------------------------------------
  // Delete Session - CASCADE 삭제 경고 포함
  // ---------------------------------------------------------------------------
  const handleDelete = async (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation()
    
    // ===========================================================================
    // [CASCADE WARNING] 세션 타입별 삭제 경고 메시지
    // - assistant_sessions 삭제 시 outline_results/evaluation_results도 자동 삭제됨
    // ===========================================================================
    const cascadeWarning = sessionType === 'chat' 
      ? '이 대화와 모든 메시지가 삭제됩니다.'
      : sessionType === 'outline'
        ? '이 세션과 생성된 모든 목차 결과가 삭제됩니다.'
        : '이 세션과 모든 평가 결과가 삭제됩니다.'
    
    if (!confirm(`정말 삭제하시겠습니까?\n\n⚠️ ${cascadeWarning}\n\n이 작업은 되돌릴 수 없습니다.`)) return

    try {
      const res = await fetch(`${endpoint}/${sessionId}`, {
        method: 'DELETE',
      })
      
      if (!res.ok) throw new Error('Failed to delete session')
      
      setSessions(sessions.filter(s => s.id !== sessionId))
      if (selectedSessionId === sessionId) {
        onSelectSession('') // Deselect
      }
    } catch (error) {
      console.error(`[SessionList:${sessionType}] Error deleting session:`, error)
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
      {/* Header & New Session Button */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={handleCreateNew}
          disabled={isCreating}
          className="w-full flex items-center justify-center px-4 py-2 bg-prism-primary text-white rounded-lg hover:bg-prism-primary/90 transition-colors disabled:opacity-50 text-sm font-medium"
        >
          {isCreating ? '생성 중...' : newButtonText}
        </button>
      </div>

      {/* Session List */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="p-4 text-center text-gray-500 text-sm">로딩 중...</div>
        ) : sessions.length === 0 ? (
          <div className="p-4 text-center text-gray-500 text-sm">
            {emptyMessage}
            <br />
            새 세션을 시작해보세요!
          </div>
        ) : (
          <>
            <ul className="divide-y divide-gray-100 dark:divide-gray-800">
              {/* =========================================================================
                  [50개 제한] displayCount만큼만 세션 표시
                  ========================================================================= */}
              {sessions.slice(0, displayCount).map((session) => (
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
                    {/* [2026-01-17 Fix] div→button 변경, 이벤트 전파 차단 강화 */}
                    <button 
                      type="button"
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        handleDelete(e, session.id)
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                      aria-label="세션 삭제"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </button>
                </li>
              ))}
            </ul>
            
            {/* =========================================================================
                [50개 제한] 더보기 버튼 - 추가 세션이 있을 때만 표시
                ========================================================================= */}
            {sessions.length > displayCount && (
              <button
                onClick={() => setDisplayCount(prev => prev + LOAD_MORE_COUNT)}
                className="w-full py-3 text-sm text-prism-primary hover:text-prism-primary/80 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors border-t border-gray-100 dark:border-gray-800"
              >
                더보기 ({sessions.length - displayCount}개 남음)
              </button>
            )}
          </>
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
