// =============================================================================
// PRISM Writer - Sufficiency Gate
// =============================================================================
// 파일: frontend/src/lib/rag/sufficiencyGate.ts
// 역할: 검색 결과의 근거 충분성 검사 (Judge 판정 전 품질 게이트)
// 작성일: 2026-01-03
// =============================================================================
// [R-06] 리트리벌 파이프라인 v2 - Sufficiency Gate
// - 검색 결과가 Judge 판정에 충분한지 확인
// - 충분하지 않으면 '판정 보류' 또는 '근거 부족' 상태 반환
// =============================================================================

import { type SearchResult } from './search'

// =============================================================================
// 상수
// =============================================================================

/** 최소 유사도 점수 (이 이상이어야 유의미한 근거로 인정) */
export const MIN_SCORE_THRESHOLD = 0.5

/** 최소 청크 수 (최소 1개 이상의 유의미한 근거 필요) */
export const MIN_CHUNK_COUNT = 1

/** 높은 신뢰도 점수 (이 이상이면 강한 근거) */
export const HIGH_CONFIDENCE_THRESHOLD = 0.75

// =============================================================================
// 타입 정의
// =============================================================================

/**
 * [R-06] Sufficiency Gate 결과
 * 
 * @description
 * 검색 결과의 근거 충분성 검사 결과입니다.
 * Judge가 이 결과를 참조하여 판정 진행 여부를 결정합니다.
 */
export interface SufficiencyResult {
  /** 근거가 충분한지 여부 */
  sufficient: boolean
  /** 판정 사유 */
  reason: string
  /** 가장 높은 유사도 점수 */
  best_score: number
  /** 유의미한 청크 수 */
  chunk_count: number
  /** 신뢰도 등급 */
  confidence_level: 'high' | 'medium' | 'low' | 'none'
}

/**
 * [R-06] Sufficiency Gate 옵션
 */
export interface SufficiencyOptions {
  /** 최소 유사도 점수 */
  minScore?: number
  /** 최소 청크 수 */
  minChunkCount?: number
  /** 빈 결과 허용 여부 (기본: false) */
  allowEmpty?: boolean
}

// =============================================================================
// Helper 함수
// =============================================================================

/**
 * [R-06] 신뢰도 등급 계산
 * 
 * @description
 * 최고 점수를 기반으로 신뢰도 등급을 결정합니다.
 */
function calculateConfidenceLevel(
  bestScore: number,
  chunkCount: number
): 'high' | 'medium' | 'low' | 'none' {
  if (chunkCount === 0 || bestScore === 0) {
    return 'none'
  }
  
  if (bestScore >= HIGH_CONFIDENCE_THRESHOLD && chunkCount >= 2) {
    return 'high'
  }
  
  if (bestScore >= MIN_SCORE_THRESHOLD) {
    return chunkCount >= 2 ? 'medium' : 'low'
  }
  
  return 'low'
}

/**
 * [R-06] 점수 안전 추출
 * 
 * @description
 * SearchResult에서 score를 안전하게 추출합니다.
 * score 필드가 없거나 NaN인 경우 0을 반환합니다.
 */
function safeGetScore(result: SearchResult | null | undefined): number {
  if (!result) return 0
  
  const score = result.score
  
  if (typeof score !== 'number' || isNaN(score)) {
    return 0
  }
  
  return score
}

// =============================================================================
// 메인 함수
// =============================================================================

/**
 * [R-06] 근거 충분성 검사
 * 
 * @description
 * 검색 결과가 Judge 판정에 충분한 품질인지 검사합니다.
 * - Top-K 결과 중 minScore 이상인 결과가 minChunkCount 이상 있어야 충분
 * - 충분하지 않으면 sufficient=false 반환
 * 
 * @param searchResults - 검색 결과 배열
 * @param options - 검사 옵션
 * @returns SufficiencyResult
 * 
 * @example
 * ```typescript
 * const results = await hybridSearch(query, options)
 * const sufficiency = checkSufficiency(results)
 * 
 * if (!sufficiency.sufficient) {
 *   console.log(`근거 부족: ${sufficiency.reason}`)
 *   // Judge에게 '판정 보류' 상태 전달
 * }
 * ```
 */
export function checkSufficiency(
  searchResults: SearchResult[] | null | undefined,
  options: SufficiencyOptions = {}
): SufficiencyResult {
  const {
    minScore = MIN_SCORE_THRESHOLD,
    minChunkCount = MIN_CHUNK_COUNT,
    allowEmpty = false,
  } = options

  // -------------------------------------------------------------------------
  // 1. null/undefined 체크
  // -------------------------------------------------------------------------
  if (!searchResults) {
    return {
      sufficient: allowEmpty,
      reason: '검색 결과 없음 (null)',
      best_score: 0,
      chunk_count: 0,
      confidence_level: 'none',
    }
  }

  // -------------------------------------------------------------------------
  // 2. 빈 배열 체크
  // -------------------------------------------------------------------------
  if (searchResults.length === 0) {
    return {
      sufficient: allowEmpty,
      reason: '검색 결과 없음',
      best_score: 0,
      chunk_count: 0,
      confidence_level: 'none',
    }
  }

  // -------------------------------------------------------------------------
  // 3. 유의미한 결과 필터링 (minScore 이상)
  // -------------------------------------------------------------------------
  const validResults = searchResults.filter(result => {
    const score = safeGetScore(result)
    return score >= minScore
  })

  // -------------------------------------------------------------------------
  // 4. 최고 점수 계산
  // -------------------------------------------------------------------------
  const bestScore = Math.max(
    ...searchResults.map(r => safeGetScore(r)),
    0  // 빈 배열 방지
  )

  // -------------------------------------------------------------------------
  // 5. 충분성 판정
  // -------------------------------------------------------------------------
  if (validResults.length < minChunkCount) {
    return {
      sufficient: false,
      reason: `유의미한 근거 부족 (${validResults.length}/${minChunkCount}개)`,
      best_score: bestScore,
      chunk_count: validResults.length,
      confidence_level: calculateConfidenceLevel(bestScore, validResults.length),
    }
  }

  // -------------------------------------------------------------------------
  // 6. 성공 반환
  // -------------------------------------------------------------------------
  return {
    sufficient: true,
    reason: '근거 충분',
    best_score: validResults[0] ? safeGetScore(validResults[0]) : bestScore,
    chunk_count: validResults.length,
    confidence_level: calculateConfidenceLevel(bestScore, validResults.length),
  }
}

// =============================================================================
// 확장 함수
// =============================================================================

/**
 * [R-06] 다중 검색 결과에 대한 충분성 일괄 검사
 * 
 * @description
 * 여러 검색 결과 세트에 대해 충분성을 일괄 검사합니다.
 * 모든 세트가 충분해야 전체가 충분한 것으로 판정됩니다.
 * 
 * @param resultSets - 검색 결과 세트 배열
 * @param options - 검사 옵션
 * @returns 전체 충분성 결과 및 개별 결과 배열
 */
export function checkSufficiencyBatch(
  resultSets: Array<{ name: string; results: SearchResult[] }>,
  options: SufficiencyOptions = {}
): {
  allSufficient: boolean
  details: Array<{ name: string; result: SufficiencyResult }>
} {
  const details = resultSets.map(({ name, results }) => ({
    name,
    result: checkSufficiency(results, options),
  }))

  const allSufficient = details.every(d => d.result.sufficient)

  return {
    allSufficient,
    details,
  }
}

/**
 * [R-06] 충분성 실패 시 상세 진단 메시지 생성
 * 
 * @description
 * 디버깅 및 사용자 피드백을 위한 상세 메시지를 생성합니다.
 */
export function getDiagnosticMessage(result: SufficiencyResult): string {
  if (result.sufficient) {
    return `✅ 근거 충분 (${result.chunk_count}개, 최고 점수: ${(result.best_score * 100).toFixed(1)}%)`
  }

  return `⚠️ ${result.reason} - 최고 점수: ${(result.best_score * 100).toFixed(1)}%, 신뢰도: ${result.confidence_level}`
}
