// =============================================================================
// PRISM Writer - Autosave Hook
// =============================================================================
// 파일: frontend/src/hooks/useAutosave.ts
// 역할: 에디터 자동 저장 기능 (2초 debounce + 서버 저장 + 로컬 백업)
// Pipeline v5 업그레이드: Autosave, 로컬 백업, 단축키 지원
// =============================================================================

import { useState, useEffect, useCallback, useRef } from 'react'
import { useEditorState } from './useEditorState'
import { useProject } from '@/contexts/ProjectContext'

// =============================================================================
// Constants
// =============================================================================

/** Autosave debounce 시간 (2초) */
const AUTOSAVE_DELAY_MS = 2000

/** 로컬 백업 저장 키 */
const LOCAL_BACKUP_KEY = 'prism_editor_backup'

/** 저장 상태 타입 */
export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

// =============================================================================
// Types
// =============================================================================

/** 로컬 백업 데이터 구조 */
interface BackupData {
  documentId: string | null
  title: string
  content: string
  timestamp: string
  syncStatus: 'pending' | 'failed'
}

/** Autosave 훅 반환 타입 */
export interface UseAutosaveReturn {
  /** 현재 저장 상태 */
  saveStatus: SaveStatus
  /** 마지막 저장 시간 */
  lastSavedAt: Date | null
  /** 저장 오류 메시지 */
  saveError: string | null
  /** 수동 저장 함수 */
  saveNow: () => Promise<void>
  /** 저장 보류 중인 변경사항 있음 */
  hasPendingChanges: boolean
  /** 로컬 백업 복구 가능 여부 */
  hasLocalBackup: boolean
  /** 로컬 백업 복구 함수 */
  restoreFromBackup: () => boolean
  /** 로컬 백업 삭제 함수 */
  clearBackup: () => void
}

// =============================================================================
// Local Backup Utilities
// =============================================================================

/**
 * 로컬 백업 저장
 *
 * @description
 * 주석(시니어 개발자): 서버 저장 실패 시 localStorage에 백업
 * - 문서 내용 + 메타데이터 저장
 * - syncStatus로 동기화 상태 추적
 */
function saveLocalBackup(data: BackupData): void {
  if (typeof window === 'undefined') return

  try {
    localStorage.setItem(LOCAL_BACKUP_KEY, JSON.stringify(data))
    console.log('[Autosave] Local backup saved')
  } catch (error) {
    console.error('[Autosave] Failed to save local backup:', error)
  }
}

/**
 * 로컬 백업 로드
 */
function loadLocalBackup(): BackupData | null {
  if (typeof window === 'undefined') return null

  try {
    const data = localStorage.getItem(LOCAL_BACKUP_KEY)
    if (!data) return null
    return JSON.parse(data)
  } catch {
    return null
  }
}

/**
 * 로컬 백업 삭제
 */
function removeLocalBackup(): void {
  if (typeof window === 'undefined') return

  try {
    localStorage.removeItem(LOCAL_BACKUP_KEY)
  } catch {
    // ignore
  }
}

// =============================================================================
// Hook Implementation
// =============================================================================

/**
 * Autosave 훅
 *
 * @description
 * Pipeline v5: 에디터 자동 저장 기능
 * - 2초 debounce로 서버 저장
 * - 저장 실패 시 로컬 스토리지 백업
 * - Ctrl+S 단축키 지원 (별도 훅에서 호출)
 *
 * @example
 * ```tsx
 * const { saveStatus, saveNow, lastSavedAt } = useAutosave()
 *
 * // 수동 저장
 * await saveNow()
 *
 * // 저장 상태 표시
 * {saveStatus === 'saving' && '저장 중...'}
 * ```
 */
export function useAutosave(): UseAutosaveReturn {
  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [hasPendingChanges, setHasPendingChanges] = useState(false)

  // Refs for debounce
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)
  const lastContentRef = useRef<string>('')
  const lastTitleRef = useRef<string>('')

  // ---------------------------------------------------------------------------
  // Editor State & Project Context
  // ---------------------------------------------------------------------------
  const {
    content,
    title,
    documentId,
    isDirty,
    markAsSaved,
    setDocumentId,
  } = useEditorState()

  const { currentProject } = useProject()
  const projectId = currentProject?.id ?? null

  // ---------------------------------------------------------------------------
  // Check for Local Backup
  // ---------------------------------------------------------------------------
  const [hasLocalBackup, setHasLocalBackup] = useState(false)

  useEffect(() => {
    const backup = loadLocalBackup()
    setHasLocalBackup(!!backup && backup.syncStatus === 'failed')
  }, [])

  // ---------------------------------------------------------------------------
  // Save Function
  // ---------------------------------------------------------------------------
  const saveToServer = useCallback(async (): Promise<boolean> => {
    // 빈 내용은 저장하지 않음
    if (!content.trim() && !title.trim()) {
      return true
    }

    setSaveStatus('saving')
    setSaveError(null)

    try {
      const response = await fetch('/api/documents/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: documentId,
          title: title || '제목 없음',
          content,
          projectId,
        }),
      })

      if (!response.ok) {
        throw new Error(`Save failed: ${response.status}`)
      }

      const data = await response.json()

      // 새 문서인 경우 ID 설정
      if (!documentId && data.id) {
        setDocumentId(data.id)
      }

      // 저장 성공
      markAsSaved()
      setLastSavedAt(new Date())
      setSaveStatus('saved')
      setHasPendingChanges(false)

      // 로컬 백업 삭제
      removeLocalBackup()
      setHasLocalBackup(false)

      console.log('[Autosave] Saved successfully')
      return true
    } catch (error) {
      console.error('[Autosave] Save failed:', error)
      setSaveError(error instanceof Error ? error.message : '저장 실패')
      setSaveStatus('error')

      // =========================================================================
      // [Pipeline v5] 저장 실패 시 로컬 백업
      // =========================================================================
      saveLocalBackup({
        documentId,
        title,
        content,
        timestamp: new Date().toISOString(),
        syncStatus: 'failed',
      })
      setHasLocalBackup(true)

      return false
    }
  }, [content, title, documentId, projectId, markAsSaved, setDocumentId])

  // ---------------------------------------------------------------------------
  // Manual Save (for Ctrl+S)
  // ---------------------------------------------------------------------------
  const saveNow = useCallback(async (): Promise<void> => {
    // 진행 중인 debounce 타이머 취소
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
      debounceTimerRef.current = null
    }

    await saveToServer()
  }, [saveToServer])

  // ---------------------------------------------------------------------------
  // Debounced Autosave
  // ---------------------------------------------------------------------------
  useEffect(() => {
    // 컨텐츠나 제목이 변경되었는지 확인
    const contentChanged = content !== lastContentRef.current
    const titleChanged = title !== lastTitleRef.current

    if (!contentChanged && !titleChanged) {
      return
    }

    // 변경 사항 추적
    lastContentRef.current = content
    lastTitleRef.current = title
    setHasPendingChanges(true)

    // 기존 타이머 취소
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }

    // 새 debounce 타이머 설정 (2초)
    debounceTimerRef.current = setTimeout(() => {
      saveToServer()
    }, AUTOSAVE_DELAY_MS)

    // Cleanup
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
    }
  }, [content, title, saveToServer])

  // ---------------------------------------------------------------------------
  // Restore from Local Backup
  // ---------------------------------------------------------------------------
  const restoreFromBackup = useCallback((): boolean => {
    const backup = loadLocalBackup()
    if (!backup) return false

    try {
      // 에디터 상태 복원
      useEditorState.setState({
        content: backup.content,
        title: backup.title,
        documentId: backup.documentId,
        isDirty: true,
      })

      console.log('[Autosave] Restored from local backup')
      return true
    } catch (error) {
      console.error('[Autosave] Failed to restore from backup:', error)
      return false
    }
  }, [])

  // ---------------------------------------------------------------------------
  // Clear Backup
  // ---------------------------------------------------------------------------
  const clearBackup = useCallback((): void => {
    removeLocalBackup()
    setHasLocalBackup(false)
  }, [])

  // ---------------------------------------------------------------------------
  // Return
  // ---------------------------------------------------------------------------
  return {
    saveStatus,
    lastSavedAt,
    saveError,
    saveNow,
    hasPendingChanges,
    hasLocalBackup,
    restoreFromBackup,
    clearBackup,
  }
}
