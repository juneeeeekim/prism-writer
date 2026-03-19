'use client'

// =============================================================================
// Phase A Track 2: P1-07 - Version History Panel
// =============================================================================
// 파일: frontend/src/components/Editor/VersionHistoryPanel.tsx
// 역할: 문서 버전 히스토리 사이드 패널 (목록, diff 보기, 복원)
// 생성일: 2026-03-19
// =============================================================================

import { useState } from 'react'
import { useVersionHistory } from '@/hooks/useVersionHistory'
import VersionDiffViewer from './VersionDiffViewer'
import type { VersionSummary } from '@/lib/services/versionService'

// =============================================================================
// Props
// =============================================================================

interface VersionHistoryPanelProps {
  /** 현재 문서 ID */
  documentId: string | null
  /** 현재 에디터 내용 (diff 비교용) */
  currentContent: string
  /** 패널 닫기 콜백 */
  onClose: () => void
}

// =============================================================================
// Helpers
// =============================================================================

/** 상대 시간 포맷 ("방금 전", "5분 전", "2시간 전", "3일 전") */
function formatRelativeTime(dateStr: string): string {
  const now = new Date()
  const date = new Date(dateStr)
  const diffMs = now.getTime() - date.getTime()
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHour = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHour / 24)

  if (diffSec < 60) return '방금 전'
  if (diffMin < 60) return `${diffMin}분 전`
  if (diffHour < 24) return `${diffHour}시간 전`
  if (diffDay < 30) return `${diffDay}일 전`

  return date.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
}

/** 바이트 크기 포맷 */
function formatByteSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// =============================================================================
// Component
// =============================================================================

export default function VersionHistoryPanel({
  documentId,
  currentContent,
  onClose,
}: VersionHistoryPanelProps) {
  const {
    versions,
    selectedVersion,
    isLoading,
    isLoadingDetail,
    isRestoring,
    error,
    fetchVersionDetail,
    restoreVersion,
    createManualSnapshot,
    clearSelectedVersion,
  } = useVersionHistory(documentId)

  const [showDiff, setShowDiff] = useState(false)
  const [isCreatingSnapshot, setIsCreatingSnapshot] = useState(false)

  // ---------------------------------------------------------------------------
  // 버전 보기 (diff 표시)
  // ---------------------------------------------------------------------------
  const handleViewVersion = async (versionId: string) => {
    await fetchVersionDetail(versionId)
    setShowDiff(true)
  }

  // ---------------------------------------------------------------------------
  // 버전 복원 (확인 다이얼로그 포함)
  // ---------------------------------------------------------------------------
  const handleRestore = async (versionId: string, versionNumber: number) => {
    const confirmed = window.confirm(
      `버전 ${versionNumber}으로 복원하시겠습니까?\n\n현재 내용은 자동으로 백업됩니다.`
    )

    if (!confirmed) return

    const success = await restoreVersion(versionId)
    if (success) {
      setShowDiff(false)
    }
  }

  // ---------------------------------------------------------------------------
  // 수동 스냅샷 생성
  // ---------------------------------------------------------------------------
  const handleCreateSnapshot = async () => {
    if (!documentId) return

    setIsCreatingSnapshot(true)
    try {
      // 현재 에디터의 title을 가져옴
      const { useEditorState } = await import('@/hooks/useEditorState')
      const title = useEditorState.getState().title || '제목 없음'

      await createManualSnapshot(documentId, title, currentContent)
    } finally {
      setIsCreatingSnapshot(false)
    }
  }

  // ---------------------------------------------------------------------------
  // Diff 뷰 닫기
  // ---------------------------------------------------------------------------
  const handleCloseDiff = () => {
    setShowDiff(false)
    clearSelectedVersion()
  }

  // ---------------------------------------------------------------------------
  // Render: Diff View
  // ---------------------------------------------------------------------------
  if (showDiff && selectedVersion) {
    return (
      <div className="flex flex-col h-full bg-white dark:bg-gray-900">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <button
              onClick={handleCloseDiff}
              className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 transition-colors"
              title="목록으로"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
              </svg>
            </button>
            <span className="text-sm font-medium text-gray-900 dark:text-white">
              버전 {selectedVersion.version_number}
            </span>
          </div>
          <button
            onClick={() => handleRestore(selectedVersion.id, selectedVersion.version_number)}
            disabled={isRestoring}
            className="px-3 py-1.5 text-xs font-medium bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isRestoring ? '복원 중...' : '이 버전으로 복원'}
          </button>
        </div>

        {/* Diff Viewer */}
        <div className="flex-1 overflow-hidden">
          <VersionDiffViewer
            currentContent={currentContent}
            versionContent={selectedVersion.content}
            versionNumber={selectedVersion.version_number}
          />
        </div>
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // Render: Version List
  // ---------------------------------------------------------------------------
  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
          버전 히스토리
        </h3>
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          title="닫기"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* 수동 스냅샷 버튼 */}
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={handleCreateSnapshot}
          disabled={!documentId || isCreatingSnapshot}
          className="w-full px-3 py-2 text-sm font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/40 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
          </svg>
          {isCreatingSnapshot ? '저장 중...' : '수동 스냅샷 저장'}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="px-4 py-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-xs">
          {error}
        </div>
      )}

      {/* Version List */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-12 text-gray-400 dark:text-gray-500">
            <svg className="animate-spin w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <span className="text-sm">불러오는 중...</span>
          </div>
        ) : versions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <svg className="w-12 h-12 text-gray-300 dark:text-gray-600 mb-3" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              저장된 버전이 없습니다
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              문서를 저장하면 자동으로 버전이 생성됩니다
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-gray-800">
            {versions.map((version) => (
              <VersionListItem
                key={version.id}
                version={version}
                isLoadingDetail={isLoadingDetail}
                isRestoring={isRestoring}
                onView={() => handleViewVersion(version.id)}
                onRestore={() => handleRestore(version.id, version.version_number)}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

// =============================================================================
// Sub-component: Version List Item
// =============================================================================

interface VersionListItemProps {
  version: VersionSummary
  isLoadingDetail: boolean
  isRestoring: boolean
  onView: () => void
  onRestore: () => void
}

function VersionListItem({
  version,
  isLoadingDetail,
  isRestoring,
  onView,
  onRestore,
}: VersionListItemProps) {
  return (
    <li className="px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
      <div className="flex items-start justify-between gap-2">
        {/* 좌측: 버전 정보 */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-medium text-gray-900 dark:text-white">
              v{version.version_number}
            </span>
            <span
              className={`inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium rounded-full ${
                version.snapshot_type === 'manual'
                  ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
              }`}
            >
              {version.snapshot_type === 'manual' ? '수동' : '자동'}
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
            <span>{formatRelativeTime(version.created_at)}</span>
            <span className="text-gray-300 dark:text-gray-600">|</span>
            <span>{formatByteSize(version.byte_size)}</span>
          </div>
        </div>

        {/* 우측: 액션 버튼 */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={onView}
            disabled={isLoadingDetail}
            className="px-2.5 py-1 text-xs font-medium text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 transition-colors"
          >
            보기
          </button>
          <button
            onClick={onRestore}
            disabled={isRestoring}
            className="px-2.5 py-1 text-xs font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 rounded hover:bg-indigo-100 dark:hover:bg-indigo-900/40 disabled:opacity-50 transition-colors"
          >
            복원
          </button>
        </div>
      </div>
    </li>
  )
}
