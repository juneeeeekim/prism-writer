// =============================================================================
// PRISM Writer - CriteriaPack Manager (Pipeline v5)
// =============================================================================
// 파일: frontend/src/lib/rag/criteriaPack.ts
// 역할: CriteriaPack 구축 및 Pin/Unpin 상태 동기화
// 생성일: 2025-12-25
//
// 주석(시니어 개발자): 
// 사용자가 특정 규칙/예시를 Pin하면 해당 항목이 항상 검색 결과 상위에 표시됩니다.
// Optimistic UI 패턴: 먼저 UI 업데이트 → 서버 요청 → 실패 시 롤백
//
// 주석(UX/UI 개발자):
// Pin 상태 변경 시 즉각적인 피드백이 중요합니다. 로딩 없이 먼저 변경 표시.
// =============================================================================

import { createClient } from '@/lib/supabase/client'
import type { CriteriaPack } from './cache/criteriaPackCache'

// =============================================================================
// 타입 정의
// =============================================================================

/**
 * Pin 상태 항목
 */
export interface PinnedItem {
  /** 항목 ID (chunk_id) */
  id: string
  /** 항목 유형 */
  type: 'rule' | 'example'
  /** Pin 시간 */
  pinnedAt: string
}

/**
 * Pin 상태 저장소
 */
export interface PinState {
  userId: string
  documentId?: string
  templateId?: string
  pinnedItems: PinnedItem[]
  updatedAt: string
}

/**
 * Pin 작업 결과
 */
export interface PinResult {
  success: boolean
  error?: string
  rollback?: () => void
}

// =============================================================================
// 로컬 상태 관리 (Optimistic UI용)
// =============================================================================

/** 로컬 Pin 상태 캐시 */
const localPinCache = new Map<string, Set<string>>()

/**
 * 캐시 키 생성
 */
function getCacheKey(userId: string, templateId?: string): string {
  return templateId ? `${userId}:${templateId}` : userId
}

/**
 * 로컬 캐시에서 Pin 상태 조회
 */
function getLocalPins(userId: string, templateId?: string): Set<string> {
  const key = getCacheKey(userId, templateId)
  if (!localPinCache.has(key)) {
    localPinCache.set(key, new Set())
  }
  return localPinCache.get(key)!
}

// =============================================================================
// CriteriaPack 빌더
// =============================================================================

/**
 * CriteriaPack 구축 옵션
 */
export interface BuildCriteriaPackOptions {
  userId: string
  documentId: string
  templateId?: string
  rules: Array<{ id: string; content: string; score: number }>
  examples: Array<{ id: string; content: string; score: number }>
}

/**
 * CriteriaPack 구축 (Pin 상태 반영)
 * 
 * @description
 * 검색 결과에 Pin 상태를 반영하여 CriteriaPack을 구성합니다.
 * Pin된 항목은 점수에 관계없이 상위에 배치됩니다.
 */
export async function buildCriteriaPack(
  options: BuildCriteriaPackOptions
): Promise<CriteriaPack> {
  const { userId, documentId, templateId, rules, examples } = options

  // -------------------------------------------------------------------------
  // 1. 서버에서 Pin 상태 조회
  // -------------------------------------------------------------------------
  const pinnedIds = await fetchPinnedItems(userId, templateId)
  const pinnedSet = new Set(pinnedIds)

  // 로컬 캐시 동기화
  const cacheKey = getCacheKey(userId, templateId)
  localPinCache.set(cacheKey, pinnedSet)

  // -------------------------------------------------------------------------
  // 2. Pin된 항목을 상위로 정렬
  // -------------------------------------------------------------------------
  const sortedRules = [...rules].sort((a, b) => {
    const aIsPinned = pinnedSet.has(a.id) ? 1 : 0
    const bIsPinned = pinnedSet.has(b.id) ? 1 : 0
    // Pin된 항목 우선, 그 다음 점수순
    return bIsPinned - aIsPinned || b.score - a.score
  })

  const sortedExamples = [...examples].sort((a, b) => {
    const aIsPinned = pinnedSet.has(a.id) ? 1 : 0
    const bIsPinned = pinnedSet.has(b.id) ? 1 : 0
    return bIsPinned - aIsPinned || b.score - a.score
  })

  // -------------------------------------------------------------------------
  // 3. CriteriaPack 반환
  // -------------------------------------------------------------------------
  return {
    rules: sortedRules,
    examples: sortedExamples,
    pinnedIds: Array.from(pinnedSet),
    documentId,
    templateId: templateId || 'default',
  }
}

// =============================================================================
// Pin/Unpin 작업 (Optimistic UI)
// =============================================================================

/**
 * 항목 Pin (Optimistic UI)
 * 
 * @description
 * 1. 먼저 로컬 상태 업데이트 (즉각적인 UI 반영)
 * 2. 서버에 요청
 * 3. 실패 시 롤백 함수 호출
 */
export async function pinItem(
  userId: string,
  itemId: string,
  itemType: 'rule' | 'example',
  templateId?: string
): Promise<PinResult> {
  // -------------------------------------------------------------------------
  // Step 1: Optimistic Update (로컬)
  // -------------------------------------------------------------------------
  const localPins = getLocalPins(userId, templateId)
  const wasAlreadyPinned = localPins.has(itemId)
  
  // 이미 Pin된 경우 무시
  if (wasAlreadyPinned) {
    return { success: true }
  }

  // 로컬에 먼저 추가
  localPins.add(itemId)

  // 롤백 함수
  const rollback = () => {
    localPins.delete(itemId)
  }

  // -------------------------------------------------------------------------
  // Step 2: 서버 동기화
  // -------------------------------------------------------------------------
  try {
    const supabase = await createClient()
    
    const { error } = await supabase
      .from('criteria_pack_pins')
      .upsert({
        user_id: userId,
        item_id: itemId,
        item_type: itemType,
        template_id: templateId || null,
        pinned_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id,item_id,template_id'
      })

    if (error) {
      // 서버 실패 시 롤백
      rollback()
      console.error('[CriteriaPack] Pin failed:', error)
      return { success: false, error: error.message, rollback }
    }

    return { success: true }
  } catch (error) {
    // 네트워크 오류 등
    rollback()
    console.error('[CriteriaPack] Pin error:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error',
      rollback 
    }
  }
}

/**
 * 항목 Unpin (Optimistic UI)
 */
export async function unpinItem(
  userId: string,
  itemId: string,
  templateId?: string
): Promise<PinResult> {
  // -------------------------------------------------------------------------
  // Step 1: Optimistic Update (로컬)
  // -------------------------------------------------------------------------
  const localPins = getLocalPins(userId, templateId)
  const wasPinned = localPins.has(itemId)
  
  // Pin되지 않은 경우 무시
  if (!wasPinned) {
    return { success: true }
  }

  // 로컬에서 먼저 제거
  localPins.delete(itemId)

  // 롤백 함수
  const rollback = () => {
    localPins.add(itemId)
  }

  // -------------------------------------------------------------------------
  // Step 2: 서버 동기화
  // -------------------------------------------------------------------------
  try {
    const supabase = await createClient()
    
    let query = supabase
      .from('criteria_pack_pins')
      .delete()
      .eq('user_id', userId)
      .eq('item_id', itemId)
    
    if (templateId) {
      query = query.eq('template_id', templateId)
    } else {
      query = query.is('template_id', null)
    }

    const { error } = await query

    if (error) {
      rollback()
      console.error('[CriteriaPack] Unpin failed:', error)
      return { success: false, error: error.message, rollback }
    }

    return { success: true }
  } catch (error) {
    rollback()
    console.error('[CriteriaPack] Unpin error:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error',
      rollback 
    }
  }
}

/**
 * Pin 상태 토글
 */
export async function togglePin(
  userId: string,
  itemId: string,
  itemType: 'rule' | 'example',
  templateId?: string
): Promise<PinResult> {
  const localPins = getLocalPins(userId, templateId)
  const isPinned = localPins.has(itemId)

  if (isPinned) {
    return unpinItem(userId, itemId, templateId)
  } else {
    return pinItem(userId, itemId, itemType, templateId)
  }
}

// =============================================================================
// 서버 조회 함수
// =============================================================================

/**
 * 서버에서 Pin된 항목 목록 조회
 */
async function fetchPinnedItems(
  userId: string,
  templateId?: string
): Promise<string[]> {
  try {
    const supabase = await createClient()
    
    let query = supabase
      .from('criteria_pack_pins')
      .select('item_id')
      .eq('user_id', userId)
    
    if (templateId) {
      query = query.eq('template_id', templateId)
    }

    const { data, error } = await query

    if (error) {
      console.error('[CriteriaPack] Fetch pins failed:', error)
      // 에러 시 로컬 캐시 사용
      return Array.from(getLocalPins(userId, templateId))
    }

    return (data || []).map(item => item.item_id)
  } catch (error: any) {
    // 42P01: undefined_table (마이그레이션 미적용 시)
    if (error?.code === '42P01' || error?.message?.includes('relation "criteria_pack_pins" does not exist')) {
      console.warn('[CriteriaPack] 테이블이 존재하지 않습니다. 마이그레이션(029_criteria_pack.sql)을 실행해주세요. (Graceful Fallback: 로컬 캐시 사용)')
    } else {
      console.error('[CriteriaPack] Fetch pins error:', error)
    }
    return Array.from(getLocalPins(userId, templateId))
  }
}

/**
 * 항목이 Pin되었는지 확인 (로컬 캐시 우선)
 */
export function isPinned(
  userId: string,
  itemId: string,
  templateId?: string
): boolean {
  const localPins = getLocalPins(userId, templateId)
  return localPins.has(itemId)
}

/**
 * Pin된 항목 개수 조회
 */
export function getPinnedCount(
  userId: string,
  templateId?: string
): number {
  const localPins = getLocalPins(userId, templateId)
  return localPins.size
}

/**
 * 모든 Pin 해제
 */
export async function unpinAll(
  userId: string,
  templateId?: string
): Promise<PinResult> {
  // 로컬 클리어
  const cacheKey = getCacheKey(userId, templateId)
  const previousPins = new Set(localPinCache.get(cacheKey) || [])
  localPinCache.set(cacheKey, new Set())

  // 롤백 함수
  const rollback = () => {
    localPinCache.set(cacheKey, previousPins)
  }

  try {
    const supabase = await createClient()
    
    let query = supabase
      .from('criteria_pack_pins')
      .delete()
      .eq('user_id', userId)
    
    if (templateId) {
      query = query.eq('template_id', templateId)
    }

    const { error } = await query

    if (error) {
      rollback()
      return { success: false, error: error.message, rollback }
    }

    return { success: true }
  } catch (error) {
    rollback()
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error',
      rollback 
    }
  }
}
