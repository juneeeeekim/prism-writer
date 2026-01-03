// =============================================================================
// PRISM Writer - Pattern Tagger Service
// =============================================================================
// 파일: frontend/src/lib/rag/patternTagger.ts
// 역할: 청크에 패턴 타입 태그를 저장하는 서비스
// 생성일: 2026-01-03
// =============================================================================

import { createClient } from '@supabase/supabase-js'
import { FEATURE_FLAGS } from '../../config/featureFlags'
import { type PatternType } from './patternExtractor'

// =============================================================================
// [PATTERN] Supabase 클라이언트
// =============================================================================

// 서버 사이드에서 사용하기 위한 Supabase 클라이언트 생성
function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('[PatternTagger] Supabase credentials not configured')
  }
  
  return createClient(supabaseUrl, supabaseKey)
}

// =============================================================================
// [PATTERN] 태깅 결과 타입
// =============================================================================

/** 배치 태깅 결과 */
export interface BatchTagResult {
  success: number
  failed: number
  errors: Array<{ chunkId: string; error: string }>
}

// =============================================================================
// [PATTERN] 단일 청크 태깅
// =============================================================================

/**
 * 단일 청크에 패턴 타입을 태깅합니다.
 * 
 * @param chunkId - 태깅할 청크 ID
 * @param patternType - 적용할 패턴 타입
 * @returns 성공 여부
 */
export async function tagChunkWithPattern(
  chunkId: string,
  patternType: PatternType
): Promise<boolean> {
  // [SAFETY] Feature Flag 확인
  if (!FEATURE_FLAGS.ENABLE_PATTERN_EXTRACTION) {
    console.warn('[PatternTagger] Pattern extraction is disabled')
    return false
  }

  // [SAFETY] 입력값 검증
  if (!chunkId || !patternType) {
    console.error('[PatternTagger] Invalid input:', { chunkId, patternType })
    return false
  }

  try {
    const supabase = getSupabaseClient()
    
    const { error } = await supabase
      .from('rag_chunks')
      .update({ pattern_type: patternType })
      .eq('id', chunkId)

    if (error) {
      console.error('[PatternTagger] Failed to tag chunk:', chunkId, error.message)
      return false
    }

    return true
  } catch (err) {
    console.error('[PatternTagger] Unexpected error:', err)
    return false
  }
}

// =============================================================================
// [PATTERN] 배치 청크 태깅
// =============================================================================

/**
 * 여러 청크에 패턴 타입을 일괄 태깅합니다.
 * 
 * @param tags - 태깅할 청크 ID와 패턴 타입 배열
 * @returns 성공/실패 개수 및 에러 목록
 */
export async function batchTagChunks(
  tags: Array<{ chunkId: string; patternType: PatternType }>
): Promise<BatchTagResult> {
  const result: BatchTagResult = {
    success: 0,
    failed: 0,
    errors: [],
  }

  // [SAFETY] Feature Flag 확인
  if (!FEATURE_FLAGS.ENABLE_PATTERN_EXTRACTION) {
    console.warn('[PatternTagger] Pattern extraction is disabled')
    return result
  }

  // [SAFETY] 빈 배열 확인
  if (!tags || tags.length === 0) {
    console.warn('[PatternTagger] No tags provided')
    return result
  }

  // 순차 처리 (병렬 처리 시 DB 부하 고려)
  for (const tag of tags) {
    const success = await tagChunkWithPattern(tag.chunkId, tag.patternType)
    
    if (success) {
      result.success++
    } else {
      result.failed++
      result.errors.push({
        chunkId: tag.chunkId,
        error: 'Failed to update pattern_type',
      })
    }
  }

  console.log('[PatternTagger] Batch tagging complete:', {
    success: result.success,
    failed: result.failed,
  })

  return result
}

// =============================================================================
// [PATTERN] 패턴 태그 조회
// =============================================================================

/**
 * 청크의 현재 패턴 타입을 조회합니다.
 * 
 * @param chunkId - 조회할 청크 ID
 * @returns 패턴 타입 또는 null
 */
export async function getChunkPatternType(
  chunkId: string
): Promise<PatternType | null> {
  try {
    const supabase = getSupabaseClient()
    
    const { data, error } = await supabase
      .from('rag_chunks')
      .select('pattern_type')
      .eq('id', chunkId)
      .single()

    if (error || !data) {
      return null
    }

    return data.pattern_type as PatternType | null
  } catch (err) {
    console.error('[PatternTagger] Failed to get pattern type:', err)
    return null
  }
}

/**
 * 특정 패턴 타입의 모든 청크를 조회합니다.
 * 
 * @param patternType - 조회할 패턴 타입
 * @param projectId - 프로젝트 ID (격리용)
 * @param limit - 최대 개수 (기본: 100)
 * @returns 청크 ID 배열
 */
export async function getChunksByPatternType(
  patternType: PatternType,
  projectId: string,
  limit: number = 100
): Promise<string[]> {
  try {
    const supabase = getSupabaseClient()
    
    const { data, error } = await supabase
      .from('rag_chunks')
      .select('id, document_id')
      .eq('pattern_type', patternType)
      .limit(limit)

    if (error || !data) {
      console.error('[PatternTagger] Failed to get chunks by pattern:', error?.message)
      return []
    }

    // TODO: project_id 필터링 추가 필요 (user_documents JOIN)
    return data.map(chunk => chunk.id)
  } catch (err) {
    console.error('[PatternTagger] Unexpected error:', err)
    return []
  }
}
