// =============================================================================
// PRISM Writer - Chat Local Backup Utilities
// =============================================================================
// 파일: frontend/src/lib/utils/chatBackup.ts
// 역할: 채팅 메시지 로컬 백업 관리 (Pipeline v5)
// 리팩토링: 2026-01-20
// =============================================================================

const LOCAL_BACKUP_KEY = 'prism_chat_backup'
const MAX_BACKUP_MESSAGES = 50

// =============================================================================
// Types
// =============================================================================

export interface BackupMessage {
  sessionId: string | null
  role: 'user' | 'assistant'
  content: string
  timestamp: string
  syncStatus: 'pending' | 'failed' | 'synced'
}

export interface BackupData {
  messages: BackupMessage[]
  lastUpdated: string
}

// =============================================================================
// Cache (Performance Optimization)
// =============================================================================

let backupCache: BackupData | null = null

function getCachedBackup(): BackupData {
  if (typeof window === 'undefined') {
    return { messages: [], lastUpdated: '' }
  }

  if (backupCache !== null) {
    return backupCache
  }

  try {
    const existing = localStorage.getItem(LOCAL_BACKUP_KEY)
    const parsed: BackupData = existing
      ? JSON.parse(existing)
      : { messages: [], lastUpdated: '' }
    backupCache = parsed
    return parsed
  } catch {
    const empty: BackupData = { messages: [], lastUpdated: '' }
    backupCache = empty
    return empty
  }
}

function saveBackup(backup: BackupData): void {
  if (typeof window === 'undefined') return

  try {
    backupCache = backup
    localStorage.setItem(LOCAL_BACKUP_KEY, JSON.stringify(backup))
  } catch (error) {
    console.warn('[LocalBackup] Failed to save backup:', error)
  }
}

// =============================================================================
// Public API
// =============================================================================

export function addToLocalBackup(
  sessionId: string | null,
  role: 'user' | 'assistant',
  content: string,
  syncStatus: 'pending' | 'failed' = 'pending'
): void {
  if (typeof window === 'undefined') return

  try {
    const backup = getCachedBackup()

    backup.messages.push({
      sessionId,
      role,
      content,
      timestamp: new Date().toISOString(),
      syncStatus,
    })

    if (backup.messages.length > MAX_BACKUP_MESSAGES) {
      backup.messages = backup.messages.slice(-MAX_BACKUP_MESSAGES)
    }

    backup.lastUpdated = new Date().toISOString()
    saveBackup(backup)
  } catch (error) {
    console.warn('[LocalBackup] Failed to save backup:', error)
  }
}

export function getFailedBackups(): BackupMessage[] {
  if (typeof window === 'undefined') return []

  try {
    const backup = getCachedBackup()
    return backup.messages.filter((m) => m.syncStatus === 'failed')
  } catch {
    return []
  }
}

export function updateBackupStatus(
  timestamp: string,
  newStatus: 'pending' | 'failed' | 'synced'
): void {
  if (typeof window === 'undefined') return

  try {
    const backup = getCachedBackup()
    const msg = backup.messages.find((m) => m.timestamp === timestamp)
    if (msg) {
      msg.syncStatus = newStatus
      saveBackup(backup)
    }
  } catch {
    // ignore
  }
}

export function clearSyncedBackups(): void {
  if (typeof window === 'undefined') return

  try {
    const backup = getCachedBackup()
    backup.messages = backup.messages.filter((m) => m.syncStatus !== 'synced')
    backup.lastUpdated = new Date().toISOString()
    saveBackup(backup)
  } catch {
    // ignore
  }
}
