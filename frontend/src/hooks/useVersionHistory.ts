// =============================================================================
// Phase A Track 2: P1-06 - useVersionHistory Hook
// =============================================================================
// 파일: frontend/src/hooks/useVersionHistory.ts
// 역할: 문서 버전 히스토리 관리 (목록 조회, 상세 조회, 복원, 수동 스냅샷)
// 생성일: 2026-03-19
// =============================================================================

import { useState, useEffect, useCallback } from 'react'
import { useEditorState } from './useEditorState'
import type { VersionSummary, DocumentVersion } from '@/lib/services/versionService'

// =============================================================================
// Types
// =============================================================================

export interface UseVersionHistoryReturn {
  /** 버전 목록 (content 제외) */
  versions: VersionSummary[]
  /** 선택된 버전 상세 (content 포함) */
  selectedVersion: DocumentVersion | null
  /** 목록 로딩 중 */
  isLoading: boolean
  /** 상세 로딩 중 */
  isLoadingDetail: boolean
  /** 복원 진행 중 */
  isRestoring: boolean
  /** 오류 메시지 */
  error: string | null
  /** 버전 목록 조회 */
  fetchVersions: (documentId: string) => Promise<void>
  /** 버전 상세 조회 */
  fetchVersionDetail: (versionId: string) => Promise<void>
  /** 버전 복원 */
  restoreVersion: (versionId: string) => Promise<boolean>
  /** 수동 스냅샷 생성 */
  createManualSnapshot: (documentId: string, title: string, content: string) => Promise<boolean>
  /** 선택된 버전 초기화 */
  clearSelectedVersion: () => void
}

// =============================================================================
// Hook Implementation
// =============================================================================

export function useVersionHistory(documentId: string | null): UseVersionHistoryReturn {
  const [versions, setVersions] = useState<VersionSummary[]>([])
  const [selectedVersion, setSelectedVersion] = useState<DocumentVersion | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingDetail, setIsLoadingDetail] = useState(false)
  const [isRestoring, setIsRestoring] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // ---------------------------------------------------------------------------
  // 버전 목록 조회
  // ---------------------------------------------------------------------------
  const fetchVersions = useCallback(async (docId: string) => {
    if (!docId) return

    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/documents/versions?documentId=${encodeURIComponent(docId)}`)

      if (!response.ok) {
        throw new Error(`버전 목록 조회 실패: ${response.status}`)
      }

      const data = await response.json()

      if (data.success) {
        setVersions(data.versions || [])
      } else {
        throw new Error(data.message || '버전 목록 조회 실패')
      }
    } catch (err) {
      console.error('[useVersionHistory] fetchVersions error:', err)
      setError(err instanceof Error ? err.message : '버전 목록 조회 실패')
    } finally {
      setIsLoading(false)
    }
  }, [])

  // ---------------------------------------------------------------------------
  // 버전 상세 조회 (content 포함)
  // ---------------------------------------------------------------------------
  const fetchVersionDetail = useCallback(async (versionId: string) => {
    setIsLoadingDetail(true)
    setError(null)

    try {
      const response = await fetch(`/api/documents/versions/${encodeURIComponent(versionId)}`)

      if (!response.ok) {
        throw new Error(`버전 상세 조회 실패: ${response.status}`)
      }

      const data = await response.json()

      if (data.success && data.version) {
        setSelectedVersion(data.version as DocumentVersion)
      } else {
        throw new Error(data.message || '버전 상세 조회 실패')
      }
    } catch (err) {
      console.error('[useVersionHistory] fetchVersionDetail error:', err)
      setError(err instanceof Error ? err.message : '버전 상세 조회 실패')
    } finally {
      setIsLoadingDetail(false)
    }
  }, [])

  // ---------------------------------------------------------------------------
  // 버전 복원
  // ---------------------------------------------------------------------------
  const restoreVersion = useCallback(async (versionId: string): Promise<boolean> => {
    setIsRestoring(true)
    setError(null)

    try {
      const response = await fetch(`/api/documents/versions/${encodeURIComponent(versionId)}`, {
        method: 'POST',
      })

      if (!response.ok) {
        throw new Error(`버전 복원 실패: ${response.status}`)
      }

      const data = await response.json()

      if (data.success) {
        // 에디터 상태 업데이트 — 복원된 내용으로 교체
        // 복원 API가 문서를 업데이트하므로, 해당 버전의 내용을 에디터에 반영
        if (selectedVersion) {
          useEditorState.getState().setContent(selectedVersion.content)
          useEditorState.getState().setTitle(selectedVersion.title)
        }

        // 버전 목록 새로고침
        if (documentId) {
          await fetchVersions(documentId)
        }

        setSelectedVersion(null)
        return true
      } else {
        throw new Error(data.message || '버전 복원 실패')
      }
    } catch (err) {
      console.error('[useVersionHistory] restoreVersion error:', err)
      setError(err instanceof Error ? err.message : '버전 복원 실패')
      return false
    } finally {
      setIsRestoring(false)
    }
  }, [selectedVersion, documentId, fetchVersions])

  // ---------------------------------------------------------------------------
  // 수동 스냅샷 생성
  // ---------------------------------------------------------------------------
  const createManualSnapshot = useCallback(async (
    docId: string,
    title: string,
    content: string
  ): Promise<boolean> => {
    setError(null)

    try {
      const response = await fetch('/api/documents/versions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId: docId,
          title,
          content,
          snapshotType: 'manual',
        }),
      })

      if (!response.ok) {
        throw new Error(`스냅샷 생성 실패: ${response.status}`)
      }

      const data = await response.json()

      if (data.success) {
        // 목록 새로고침
        await fetchVersions(docId)
        return true
      } else {
        throw new Error(data.message || '스냅샷 생성 실패')
      }
    } catch (err) {
      console.error('[useVersionHistory] createManualSnapshot error:', err)
      setError(err instanceof Error ? err.message : '스냅샷 생성 실패')
      return false
    }
  }, [fetchVersions])

  // ---------------------------------------------------------------------------
  // 선택된 버전 초기화
  // ---------------------------------------------------------------------------
  const clearSelectedVersion = useCallback(() => {
    setSelectedVersion(null)
  }, [])

  // ---------------------------------------------------------------------------
  // documentId 변경 시 자동 조회
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (documentId) {
      fetchVersions(documentId)
    } else {
      setVersions([])
      setSelectedVersion(null)
    }
  }, [documentId, fetchVersions])

  return {
    versions,
    selectedVersion,
    isLoading,
    isLoadingDetail,
    isRestoring,
    error,
    fetchVersions,
    fetchVersionDetail,
    restoreVersion,
    createManualSnapshot,
    clearSelectedVersion,
  }
}
