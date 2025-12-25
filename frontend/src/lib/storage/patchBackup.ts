// =============================================================================
// PRISM Writer - Patch Backup Storage (Pipeline v5)
// =============================================================================
// 파일: frontend/src/lib/storage/patchBackup.ts
// 역할: 패치 적용 중 브라우저 크래시 시 데이터 복구를 위한 IndexedDB 백업
// 생성일: 2025-12-25
//
// 주석(시니어 개발자): 
// 사용자가 Apply 클릭 후 저장 전 크래시되면 데이터가 유실될 수 있습니다.
// 이 모듈은 IndexedDB를 사용하여 로컬에 백업을 저장하고,
// 재접속 시 마지막 상태로 복원할 수 있게 합니다.
//
// 주석(UX/UI 개발자):
// 복구 시 사용자에게 "이전 작업을 복구하시겠습니까?" 모달 표시 권장
// =============================================================================

import type { Patch } from '@/lib/rag/types/patch'

// =============================================================================
// 타입 정의
// =============================================================================

/**
 * 백업 상태
 */
export type BackupStatus = 'pending' | 'applied' | 'saved' | 'discarded'

/**
 * 패치 백업 항목
 */
export interface PatchBackupEntry {
  /** 고유 ID */
  id: string
  /** 문서 ID */
  documentId: string
  /** 원본 텍스트 */
  originalText: string
  /** 패치 적용 후 텍스트 */
  patchedText: string
  /** 적용된 패치 목록 */
  appliedPatches: Patch[]
  /** 백업 상태 */
  status: BackupStatus
  /** 생성 시간 */
  createdAt: number
  /** 마지막 업데이트 시간 */
  updatedAt: number
}

/**
 * 복구 가능한 백업 정보
 */
export interface RecoverableBackup {
  entry: PatchBackupEntry
  timeSinceUpdate: string
}

// =============================================================================
// IndexedDB 설정
// =============================================================================

const DB_NAME = 'prism-writer-backup'
const DB_VERSION = 1
const STORE_NAME = 'patch-backups'

// 백업 유효 시간 (24시간)
const BACKUP_TTL_MS = 24 * 60 * 60 * 1000

// =============================================================================
// IndexedDB 헬퍼 함수
// =============================================================================

/**
 * IndexedDB 연결 열기
 */
function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    // 브라우저 환경 체크
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB is not available'))
      return
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onerror = () => {
      reject(new Error('Failed to open IndexedDB'))
    }

    request.onsuccess = () => {
      resolve(request.result)
    }

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result
      
      // 스토어 생성
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' })
        store.createIndex('documentId', 'documentId', { unique: false })
        store.createIndex('status', 'status', { unique: false })
        store.createIndex('updatedAt', 'updatedAt', { unique: false })
      }
    }
  })
}

// =============================================================================
// PatchBackupStorage 클래스
// =============================================================================

/**
 * 패치 백업 저장소
 * 
 * @description
 * IndexedDB를 사용하여 패치 적용 상태를 로컬에 백업합니다.
 * 브라우저 크래시나 예기치 않은 종료 후 복구에 사용됩니다.
 * 
 * @example
 * ```typescript
 * const backup = PatchBackupStorage.getInstance()
 * 
 * // 백업 생성
 * await backup.create(documentId, originalText)
 * 
 * // 패치 적용 시 업데이트
 * await backup.updateWithPatch(documentId, patchedText, appliedPatch)
 * 
 * // 저장 완료 후 삭제
 * await backup.markAsSaved(documentId)
 * 
 * // 재접속 시 복구 가능 여부 확인
 * const recoverable = await backup.getRecoverable(documentId)
 * ```
 */
class PatchBackupStorage {
  // ---------------------------------------------------------------------------
  // 싱글톤 인스턴스
  // ---------------------------------------------------------------------------
  private static instance: PatchBackupStorage | null = null

  private constructor() {}

  public static getInstance(): PatchBackupStorage {
    if (!PatchBackupStorage.instance) {
      PatchBackupStorage.instance = new PatchBackupStorage()
    }
    return PatchBackupStorage.instance
  }

  // ---------------------------------------------------------------------------
  // 백업 CRUD
  // ---------------------------------------------------------------------------

  /**
   * 새 백업 생성
   */
  async create(documentId: string, originalText: string): Promise<string> {
    const db = await openDatabase()
    const id = `backup-${documentId}-${Date.now()}`
    const now = Date.now()

    const entry: PatchBackupEntry = {
      id,
      documentId,
      originalText,
      patchedText: originalText,
      appliedPatches: [],
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    }

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.put(entry)

      request.onsuccess = () => {
        db.close()
        resolve(id)
      }
      request.onerror = () => {
        db.close()
        reject(new Error('Failed to create backup'))
      }
    })
  }

  /**
   * 패치 적용 시 백업 업데이트
   */
  async updateWithPatch(
    documentId: string,
    patchedText: string,
    appliedPatch: Patch
  ): Promise<void> {
    const db = await openDatabase()
    const existing = await this.getLatestByDocumentId(documentId)

    if (!existing) {
      // 기존 백업이 없으면 새로 생성
      await this.create(documentId, patchedText)
      return
    }

    const updated: PatchBackupEntry = {
      ...existing,
      patchedText,
      appliedPatches: [...existing.appliedPatches, appliedPatch],
      status: 'applied',
      updatedAt: Date.now(),
    }

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.put(updated)

      request.onsuccess = () => {
        db.close()
        resolve()
      }
      request.onerror = () => {
        db.close()
        reject(new Error('Failed to update backup'))
      }
    })
  }

  /**
   * 저장 완료 표시
   */
  async markAsSaved(documentId: string): Promise<void> {
    const db = await openDatabase()
    const existing = await this.getLatestByDocumentId(documentId)

    if (!existing) return

    const updated: PatchBackupEntry = {
      ...existing,
      status: 'saved',
      updatedAt: Date.now(),
    }

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.put(updated)

      request.onsuccess = () => {
        db.close()
        resolve()
      }
      request.onerror = () => {
        db.close()
        reject(new Error('Failed to mark as saved'))
      }
    })
  }

  /**
   * 문서 ID로 최신 백업 조회
   */
  async getLatestByDocumentId(documentId: string): Promise<PatchBackupEntry | null> {
    const db = await openDatabase()

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly')
      const store = transaction.objectStore(STORE_NAME)
      const index = store.index('documentId')
      const request = index.getAll(documentId)

      request.onsuccess = () => {
        db.close()
        const entries = request.result as PatchBackupEntry[]
        if (entries.length === 0) {
          resolve(null)
          return
        }
        // 가장 최근 항목 반환
        const sorted = entries.sort((a, b) => b.updatedAt - a.updatedAt)
        resolve(sorted[0])
      }
      request.onerror = () => {
        db.close()
        reject(new Error('Failed to get backup'))
      }
    })
  }

  /**
   * 복구 가능한 백업 조회
   */
  async getRecoverable(documentId: string): Promise<RecoverableBackup | null> {
    const entry = await this.getLatestByDocumentId(documentId)

    if (!entry) return null

    // 저장 완료된 항목은 복구 불필요
    if (entry.status === 'saved' || entry.status === 'discarded') {
      return null
    }

    // TTL 만료 확인
    const now = Date.now()
    if (now - entry.updatedAt > BACKUP_TTL_MS) {
      return null
    }

    // 적용된 패치가 없으면 복구 불필요
    if (entry.appliedPatches.length === 0) {
      return null
    }

    // 시간 경과 계산
    const timeSinceUpdate = this.formatTimeSince(now - entry.updatedAt)

    return {
      entry,
      timeSinceUpdate,
    }
  }

  /**
   * 백업 삭제
   */
  async delete(id: string): Promise<void> {
    const db = await openDatabase()

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.delete(id)

      request.onsuccess = () => {
        db.close()
        resolve()
      }
      request.onerror = () => {
        db.close()
        reject(new Error('Failed to delete backup'))
      }
    })
  }

  /**
   * 문서의 모든 백업 삭제
   */
  async deleteAllByDocumentId(documentId: string): Promise<void> {
    const db = await openDatabase()
    const entries = await this.getAllByDocumentId(documentId)

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite')
      const store = transaction.objectStore(STORE_NAME)

      let completed = 0
      const total = entries.length

      if (total === 0) {
        db.close()
        resolve()
        return
      }

      entries.forEach(entry => {
        const request = store.delete(entry.id)
        request.onsuccess = () => {
          completed++
          if (completed === total) {
            db.close()
            resolve()
          }
        }
        request.onerror = () => {
          db.close()
          reject(new Error('Failed to delete backups'))
        }
      })
    })
  }

  /**
   * 문서의 모든 백업 조회
   */
  private async getAllByDocumentId(documentId: string): Promise<PatchBackupEntry[]> {
    const db = await openDatabase()

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly')
      const store = transaction.objectStore(STORE_NAME)
      const index = store.index('documentId')
      const request = index.getAll(documentId)

      request.onsuccess = () => {
        db.close()
        resolve(request.result as PatchBackupEntry[])
      }
      request.onerror = () => {
        db.close()
        reject(new Error('Failed to get backups'))
      }
    })
  }

  /**
   * 만료된 백업 정리
   */
  async cleanupExpired(): Promise<number> {
    const db = await openDatabase()
    const now = Date.now()
    const cutoff = now - BACKUP_TTL_MS

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite')
      const store = transaction.objectStore(STORE_NAME)
      const index = store.index('updatedAt')
      const range = IDBKeyRange.upperBound(cutoff)
      const request = index.openCursor(range)

      let deleted = 0

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result
        if (cursor) {
          cursor.delete()
          deleted++
          cursor.continue()
        } else {
          db.close()
          resolve(deleted)
        }
      }
      request.onerror = () => {
        db.close()
        reject(new Error('Failed to cleanup expired backups'))
      }
    })
  }

  // ---------------------------------------------------------------------------
  // 헬퍼 함수
  // ---------------------------------------------------------------------------

  /**
   * 시간 경과 포맷팅
   */
  private formatTimeSince(ms: number): string {
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)

    if (hours > 0) {
      return `${hours}시간 전`
    }
    if (minutes > 0) {
      return `${minutes}분 전`
    }
    return `${seconds}초 전`
  }
}

// =============================================================================
// 편의 함수 Export
// =============================================================================

/**
 * 패치 백업 저장소 인스턴스 가져오기
 */
export function getPatchBackupStorage(): PatchBackupStorage {
  return PatchBackupStorage.getInstance()
}

/**
 * 문서에 대한 복구 가능한 백업 확인
 */
export async function checkRecoverableBackup(
  documentId: string
): Promise<RecoverableBackup | null> {
  try {
    return await getPatchBackupStorage().getRecoverable(documentId)
  } catch (error) {
    console.error('[PatchBackup] Failed to check recoverable:', error)
    return null
  }
}

/**
 * 패치 적용 시 백업 생성/업데이트
 */
export async function backupPatchApplication(
  documentId: string,
  originalText: string,
  patchedText: string,
  appliedPatch: Patch
): Promise<void> {
  try {
    const storage = getPatchBackupStorage()
    const existing = await storage.getLatestByDocumentId(documentId)
    
    if (!existing || existing.status === 'saved') {
      // 새 백업 생성
      await storage.create(documentId, originalText)
    }
    
    // 패치 적용 업데이트
    await storage.updateWithPatch(documentId, patchedText, appliedPatch)
  } catch (error) {
    console.error('[PatchBackup] Failed to backup:', error)
  }
}

/**
 * 저장 완료 시 백업 상태 업데이트
 */
export async function markBackupAsSaved(documentId: string): Promise<void> {
  try {
    await getPatchBackupStorage().markAsSaved(documentId)
  } catch (error) {
    console.error('[PatchBackup] Failed to mark as saved:', error)
  }
}

/**
 * 백업에서 텍스트 복구
 */
export async function recoverFromBackup(
  documentId: string
): Promise<{ text: string; patches: Patch[] } | null> {
  try {
    const recoverable = await checkRecoverableBackup(documentId)
    if (!recoverable) return null

    return {
      text: recoverable.entry.patchedText,
      patches: recoverable.entry.appliedPatches,
    }
  } catch (error) {
    console.error('[PatchBackup] Failed to recover:', error)
    return null
  }
}

/**
 * 백업 삭제 (복구 거부 시)
 */
export async function discardBackup(documentId: string): Promise<void> {
  try {
    await getPatchBackupStorage().deleteAllByDocumentId(documentId)
  } catch (error) {
    console.error('[PatchBackup] Failed to discard:', error)
  }
}

export { PatchBackupStorage }
