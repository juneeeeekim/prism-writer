// =============================================================================
// PRISM Writer - Search Module: Pattern Search Wrapper
// =============================================================================
// 파일: frontend/src/lib/rag/search/wrapper.ts
// 역할: 패턴 검색과 하이브리드 검색 사이의 래퍼 (순환 참조 해소)
// 생성일: 2026-01-17 (리팩토링)
// 
// ⚠️ 중요: 순환 참조 해소 설계
// - hybrid.ts는 wrapper.ts를 모름 (import 안 함)
// - wrapper.ts는 hybrid.ts를 앎 (import 함)
// - 따라서 hybrid → pattern → vector 순서로 로딩되고, wrapper는 맨 마지막
// =============================================================================

import { type PatternType } from '../patternExtractor'
import { FEATURE_FLAGS } from '../../../config/featureFlags'
import { logger } from '@/lib/utils/logger'

import type { SearchResult, SearchOptions, SearchByPatternOptions } from './types'
import { hybridSearch } from './hybrid'
import { patternBasedSearch } from './pattern'

// =============================================================================
// [SECTION 1] 패턴 검색 Wrapper
// =============================================================================
// 목적: 외부에서 패턴 기반 검색을 쉽게 호출할 수 있도록 Wrapper 제공
// 폴백: patternType이 없거나 RPC 실패 시 hybridSearch()로 폴백
// =============================================================================

/**
 * [R-04] 패턴 검색 Wrapper
 * 
 * @description
 * 패턴 타입을 기반으로 청크를 검색합니다.
 * patternType이 없거나 projectId가 없으면 hybridSearch()로 폴백합니다.
 * 
 * @param query - 검색 쿼리
 * @param patternType - 패턴 타입 ('hook' | 'cta' | 'rebuttal' | 등)
 * @param options - 검색 옵션
 * @returns 검색 결과 배열
 * 
 * @example
 * ```typescript
 * // 패턴 검색
 * const results = await searchByPattern('훅 문장 예시', 'hook', { userId, projectId })
 * 
 * // 폴백 (patternType null)
 * const generalResults = await searchByPattern('일반 검색', null, { userId })
 * ```
 */
export async function searchByPattern(
  query: string,
  patternType: PatternType | null | undefined,
  options: SearchByPatternOptions
): Promise<SearchResult[]> {
  const { userId, projectId, topK = 5, minScore = 0.5 } = options

  // patternType을 제외한 기본 옵션 (hybridSearch 호환용)
  const baseOptions: SearchOptions = {
    userId,
    topK,
    minScore,
    documentId: options.documentId,
    chunkType: options.chunkType,
    category: options.category,
    projectId: options.projectId,
  }

  // -------------------------------------------------------------------------
  // [STEP 1] patternType null 체크 → hybridSearch 폴백
  // -------------------------------------------------------------------------
  if (!patternType) {
    logger.info('[searchByPattern]', 'No patternType provided, falling back to hybridSearch')
    return await hybridSearch(query, baseOptions)
  }

  // -------------------------------------------------------------------------
  // [STEP 2] projectId 필수 체크 → hybridSearch 폴백
  // -------------------------------------------------------------------------
  if (!projectId) {
    logger.warn('[searchByPattern]', 'projectId is required for pattern search, falling back to hybridSearch')
    return await hybridSearch(query, baseOptions)
  }

  // -------------------------------------------------------------------------
  // [STEP 3] Feature Flag 체크
  // -------------------------------------------------------------------------
  if (!FEATURE_FLAGS.ENABLE_PATTERN_BASED_SEARCH) {
    logger.info('[searchByPattern]', 'Pattern search disabled by feature flag, falling back to hybridSearch')
    return await hybridSearch(query, baseOptions)
  }

  // -------------------------------------------------------------------------
  // [STEP 4] 패턴 기반 검색 실행 (Try-Catch로 폴백 보장)
  // -------------------------------------------------------------------------
  try {
    logger.info('[searchByPattern]', `Searching for pattern: ${patternType}`)
    
    const results = await patternBasedSearch(query, {
      userId,
      projectId,
      topK,
      minScore,
      patternType,
    })

    // 결과가 없으면 hybridSearch로 보완
    if (results.length === 0) {
      logger.info('[searchByPattern]', 'No pattern results, supplementing with hybridSearch')
      return await hybridSearch(query, { ...baseOptions, topK: Math.min(topK, 3) })
    }

    return results

  } catch (error) {
    // 시니어 개발자 주석: 패턴 검색 실패 시 hybridSearch로 Graceful Fallback
    logger.error('[searchByPattern]', 'Pattern search failed, falling back to hybridSearch', { error: String(error) })
    return await hybridSearch(query, baseOptions)
  }
}
