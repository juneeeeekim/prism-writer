// =============================================================================
// Phase A Track 1: P1-02 - Version Service
// =============================================================================
// 파일: frontend/src/lib/services/versionService.ts
// 역할: 문서 버전 관리 유틸리티 (해시 계산, 버전 생성, 정리)
// 생성일: 2026-03-19
// =============================================================================

import crypto from 'crypto'
import type { SupabaseClient } from '@supabase/supabase-js'

// =============================================================================
// Types
// =============================================================================

/** 문서 버전 전체 데이터 */
export interface DocumentVersion {
  id: string
  document_id: string
  user_id: string
  title: string
  content: string
  version_number: number
  content_hash: string
  byte_size: number
  snapshot_type: 'auto' | 'manual'
  created_at: string
}

/** 버전 목록용 요약 (content 제외) */
export interface VersionSummary {
  id: string
  document_id: string
  user_id: string
  title: string
  version_number: number
  content_hash: string
  byte_size: number
  snapshot_type: 'auto' | 'manual'
  created_at: string
}

/** 버전 생성 파라미터 */
export interface CreateVersionParams {
  documentId: string
  userId: string
  title: string
  content: string
  snapshotType: 'auto' | 'manual'
}

// =============================================================================
// Constants
// =============================================================================

/** 문서당 최대 버전 수 */
const MAX_VERSIONS_PER_DOCUMENT = 50

// =============================================================================
// Hash Utility
// =============================================================================

/**
 * 콘텐츠 해시 계산 (SHA256 앞 16자리)
 *
 * @description 동일 내용의 중복 스냅샷을 방지하기 위한 해시
 * Node.js crypto 모듈 사용 (API Route 전용)
 */
export function computeContentHash(content: string): string {
  return crypto
    .createHash('sha256')
    .update(content, 'utf8')
    .digest('hex')
    .substring(0, 16)
}

// =============================================================================
// Version CRUD
// =============================================================================

/**
 * 새 버전 생성
 *
 * @description
 * 1. 마지막 버전의 content_hash와 비교하여 중복 방지
 * 2. version_number 자동 증가
 * 3. 삽입 후 오래된 버전 정리 (MAX 50)
 *
 * @returns 생성된 버전 데이터 또는 null (중복 스킵 시)
 */
export async function createVersion(
  supabase: SupabaseClient,
  params: CreateVersionParams
): Promise<DocumentVersion | null> {
  const { documentId, userId, title, content, snapshotType } = params

  // 1. 콘텐츠 해시 계산
  const contentHash = computeContentHash(content)
  const byteSize = Buffer.byteLength(content, 'utf8')

  // 2. 마지막 버전 확인 (중복 해시 체크 + version_number 조회)
  const { data: lastVersion, error: lastError } = await supabase
    .from('document_versions')
    .select('version_number, content_hash')
    .eq('document_id', documentId)
    .eq('user_id', userId)
    .order('version_number', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (lastError) {
    console.error('[VersionService] Failed to fetch last version:', lastError)
    throw new Error(`버전 조회 실패: ${lastError.message}`)
  }

  // 3. 중복 해시 → 스킵 (동일 내용이면 새 버전 불필요)
  if (lastVersion && lastVersion.content_hash === contentHash) {
    console.log('[VersionService] Skipped - same content hash:', contentHash)
    return null
  }

  // 4. 다음 버전 번호
  const nextVersionNumber = lastVersion ? lastVersion.version_number + 1 : 1

  // 5. INSERT
  const { data, error } = await supabase
    .from('document_versions')
    .insert({
      document_id: documentId,
      user_id: userId,
      title,
      content,
      version_number: nextVersionNumber,
      content_hash: contentHash,
      byte_size: byteSize,
      snapshot_type: snapshotType,
    })
    .select()
    .single()

  if (error) {
    console.error('[VersionService] Insert failed:', error)
    throw new Error(`버전 생성 실패: ${error.message}`)
  }

  console.log('[VersionService] Version created:', {
    documentId,
    versionNumber: nextVersionNumber,
    snapshotType,
    byteSize,
  })

  // 6. 오래된 버전 정리
  await pruneOldVersions(supabase, documentId, userId)

  return data as DocumentVersion
}

/**
 * 오래된 버전 정리 (최신 50개만 유지)
 *
 * @description
 * version_number DESC 기준으로 50개 초과분 삭제
 * RLS가 user_id를 검증하므로 userId 파라미터로 추가 안전장치
 */
export async function pruneOldVersions(
  supabase: SupabaseClient,
  documentId: string,
  userId: string
): Promise<number> {
  // 현재 버전 수 확인
  const { count, error: countError } = await supabase
    .from('document_versions')
    .select('id', { count: 'exact', head: true })
    .eq('document_id', documentId)
    .eq('user_id', userId)

  if (countError || count === null) {
    console.warn('[VersionService] Failed to count versions:', countError)
    return 0
  }

  if (count <= MAX_VERSIONS_PER_DOCUMENT) {
    return 0
  }

  // 삭제할 버전 ID 조회 (오래된 것부터)
  const deleteCount = count - MAX_VERSIONS_PER_DOCUMENT
  const { data: oldVersions, error: fetchError } = await supabase
    .from('document_versions')
    .select('id')
    .eq('document_id', documentId)
    .eq('user_id', userId)
    .order('version_number', { ascending: true })
    .limit(deleteCount)

  if (fetchError || !oldVersions?.length) {
    console.warn('[VersionService] Failed to fetch old versions:', fetchError)
    return 0
  }

  const idsToDelete = oldVersions.map((v) => v.id)

  const { error: deleteError } = await supabase
    .from('document_versions')
    .delete()
    .in('id', idsToDelete)
    .eq('user_id', userId) // 안전장치: 본인 데이터만 삭제

  if (deleteError) {
    console.error('[VersionService] Prune failed:', deleteError)
    return 0
  }

  console.log('[VersionService] Pruned old versions:', {
    documentId,
    deletedCount: idsToDelete.length,
  })

  return idsToDelete.length
}
