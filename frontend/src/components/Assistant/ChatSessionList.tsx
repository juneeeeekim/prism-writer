// =============================================================================
// PRISM Writer - Chat Session List (Wrapper)
// =============================================================================
// 파일: frontend/src/components/Assistant/ChatSessionList.tsx
// 역할: SessionList의 Wrapper - 기존 import 경로 및 props 인터페이스 유지
// 패턴: Wrapper 패턴 - 하위 호환성 보장
// =============================================================================

'use client'

import SessionList from './SessionList'
import { useProject } from '@/contexts/ProjectContext'  // [FIX] 프로젝트 컨텍스트

// =============================================================================
// Types - 기존 인터페이스 100% 유지 (Breaking Change 방지)
// =============================================================================
interface ChatSessionListProps {
  selectedSessionId: string | null
  onSelectSession: (sessionId: string) => void
}

// =============================================================================
// Component - Wrapper 패턴
// =============================================================================
export default function ChatSessionList({ 
  selectedSessionId, 
  onSelectSession 
}: ChatSessionListProps) {
  // [FIX] 프로젝트 컨텍스트에서 현재 프로젝트 ID 가져오기
  const { currentProject } = useProject()
  const projectId = currentProject?.id ?? null

  return (
    <SessionList
      sessionType="chat"
      selectedSessionId={selectedSessionId}
      onSelectSession={onSelectSession}
      projectId={projectId}  // [FIX] 프로젝트 필터링
      newButtonText="+ 새 대화"
      emptyMessage="대화 내역이 없습니다."
    />
  )
}
