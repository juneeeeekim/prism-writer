// =============================================================================
// PRISM Writer - Search Module Utils
// =============================================================================
// 파일: frontend/src/lib/rag/search/utils.ts
// 역할: 검색 모듈에서 사용하는 상수 및 순수 함수
// 생성일: 2026-01-17 (리팩토링)
// ⚠️ 주의: 순환 참조 방지를 위해 vector.ts, hybrid.ts를 import하지 않음
// =============================================================================

import { logger } from '@/lib/utils/logger'
import { type EvidenceQuality, EvidenceQualityGrade } from '@/types/rag'
import type { SearchResult } from './types'

// =============================================================================
// [SECTION 1] 상수 정의
// =============================================================================

/** RRF 상수 (Reciprocal Rank Fusion) */
export const RRF_K = 60

/** 기본 Top-K */
export const DEFAULT_TOP_K = 5

/** 기본 벡터 가중치 */
export const DEFAULT_VECTOR_WEIGHT = 0.7

/** 기본 키워드 가중치 */
export const DEFAULT_KEYWORD_WEIGHT = 0.3

/** 최대 재시도 횟수 */
export const MAX_RETRY_COUNT = 3

/** 초기 대기 시간 (ms) - Exponential Backoff */
export const INITIAL_BACKOFF_MS = 200

/** OpenAI text-embedding 차원 (text-embedding-3-small) */
export const EMBEDDING_DIMENSION = 1536

// =============================================================================
// [SECTION 2] 재시도 유틸리티
// =============================================================================

/**
 * [P7-02] 재시도 유틸리티 함수
 *
 * @description
 * 외부 API 호출 실패 시 Exponential Backoff로 재시도합니다.
 * 모든 시도 실패 시 마지막 에러를 throw합니다.
 *
 * @param operation - 재시도할 비동기 작업
 * @param context - 로그 컨텍스트 (함수명)
 * @returns 작업 결과
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  context: string
): Promise<T> {
  let lastError: Error | null = null

  for (let attempt = 1; attempt <= MAX_RETRY_COUNT; attempt++) {
    try {
      return await operation()
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))
      logger.warn(`[${context}]`, `Attempt ${attempt}/${MAX_RETRY_COUNT} failed`, { error: lastError.message })

      if (attempt < MAX_RETRY_COUNT) {
        // Exponential Backoff: 200ms, 400ms, 800ms
        const backoffMs = INITIAL_BACKOFF_MS * Math.pow(2, attempt - 1)
        await new Promise(resolve => setTimeout(resolve, backoffMs))
      }
    }
  }

  throw lastError // 모든 시도 실패
}

// =============================================================================
// [SECTION 3] 근거 품질 계산 (P1-C)
// =============================================================================

/**
 * 근거 품질 계산 함수
 *
 * @description
 * 검색 점수와 방법에 따라 근거의 품질 등급을 산정합니다.
 *
 * @param score - 유사도 점수 (0~1)
 * @param method - 검색 방법 ('vector' | 'keyword')
 * @param chunkDate - 청크 날짜 (ISO string, 선택)
 * @returns EvidenceQuality 객체
 */
export function calculateEvidenceQuality(
  score: number, 
  method: 'vector' | 'keyword',
  chunkDate?: string // ISO string
): EvidenceQuality {
  // -------------------------------------------------------------------------
  // [Step 1] 점수 스케일링 (0~1 -> 0~100)
  // -------------------------------------------------------------------------
  const normalizedScore = Math.round(score * 100)
  
  // -------------------------------------------------------------------------
  // [Step 2] 등급 산정 로직
  // -------------------------------------------------------------------------
  let grade = EvidenceQualityGrade.LOW
  
  if (method === 'vector') {
    if (score >= 0.78) grade = EvidenceQualityGrade.HIGH
    else if (score >= 0.72) grade = EvidenceQualityGrade.MEDIUM
  } else {
    // Keyword search (score = 1 - rank/topK)
    if (score >= 0.8) grade = EvidenceQualityGrade.HIGH
    else if (score >= 0.5) grade = EvidenceQualityGrade.MEDIUM
  }

  // -------------------------------------------------------------------------
  // [Step 3] 최신성 점수 계산 (1년 이내 100점, 1년 경과 시 20점)
  // -------------------------------------------------------------------------
  let recencyScore = undefined
  if (chunkDate) {
    const now = new Date()
    const docDate = new Date(chunkDate)
    const diffTime = Math.abs(now.getTime() - docDate.getTime())
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    
    if (diffDays <= 365) {
      recencyScore = 100
    } else {
      recencyScore = 20 // 1년 이상 된 문서는 최신성 낮음
    }
  }

  return {
    grade,
    score: normalizedScore,
    factors: {
      relevance: score,
      recency: recencyScore
    }
  }
}

/**
 * 근거 품질 일괄 계산 (Batch Processing)
 * 
 * @description
 * N+1 문제를 방지하기 위한 배치 처리 인터페이스입니다.
 * 
 * @param items - 점수와 검색 방식이 포함된 항목 배열
 */
export function calculateEvidenceQualityBatch(
  items: Array<{ score: number; method: 'vector' | 'keyword' }>
): EvidenceQuality[] {
  return items.map(item => calculateEvidenceQuality(item.score, item.method))
}

// =============================================================================
// [SECTION 4] 검색 결과 병합 알고리즘
// =============================================================================

/**
 * 가중 점수 합산 알고리즘 (Weighted Score Fusion)
 * 
 * @description
 * RRF 대신 벡터/키워드 점수를 가중치로 합산하여 병합.
 * 동일 청크가 양쪽에 있으면 점수를 합산.
 * 
 * @param vectorResults - 벡터 검색 결과
 * @param keywordResults - 키워드 검색 결과 (ts_rank 정규화됨)
 * @param vectorWeight - 벡터 가중치 (기본 0.7)
 * @param keywordWeight - 키워드 가중치 (기본 0.3)
 * @param topK - 반환할 결과 개수
 * @returns 병합된 검색 결과
 */
export function weightedScoreFusion(
  vectorResults: SearchResult[],
  keywordResults: SearchResult[],
  vectorWeight: number = DEFAULT_VECTOR_WEIGHT,
  keywordWeight: number = DEFAULT_KEYWORD_WEIGHT,
  topK: number = DEFAULT_TOP_K
): SearchResult[] {
  // -------------------------------------------------------------------------
  // [Core] 점수 합산 맵
  // -------------------------------------------------------------------------
  const scoreMap = new Map<string, { result: SearchResult; finalScore: number }>()

  // -------------------------------------------------------------------------
  // [Step 1] 벡터 점수 합산
  // -------------------------------------------------------------------------
  vectorResults.forEach((r) => {
    scoreMap.set(r.chunkId, {
      result: r,
      finalScore: r.score * vectorWeight
    })
  })

  // -------------------------------------------------------------------------
  // [Step 2] 키워드 점수 합산
  // -------------------------------------------------------------------------
  keywordResults.forEach((r) => {
    const existing = scoreMap.get(r.chunkId)
    if (existing) {
      // 양쪽에 존재: 점수 합산 (boost)
      existing.finalScore += r.score * keywordWeight
    } else {
      // 키워드만 존재
      scoreMap.set(r.chunkId, {
        result: r,
        finalScore: r.score * keywordWeight
      })
    }
  })

  // -------------------------------------------------------------------------
  // [Step 3] 정렬 및 반환
  // -------------------------------------------------------------------------
  const merged = Array.from(scoreMap.values())
    .sort((a, b) => b.finalScore - a.finalScore)
    .slice(0, topK)
    .map((entry) => ({
      ...entry.result,
      score: entry.finalScore
    }))

  logger.debug('[weightedScoreFusion]', `Merged ${vectorResults.length}V + ${keywordResults.length}K → ${merged.length} results`)

  return merged
}

/**
 * Reciprocal Rank Fusion 알고리즘
 * 
 * @description
 * 여러 검색 결과를 순위 기반으로 병합합니다.
 * RRF(d) = Σ 1 / (k + rank(d)) where k=60
 * 
 * @param resultSets - 검색 결과 배열들
 * @param topK - 반환할 결과 개수
 * @returns 병합된 검색 결과
 */
export function reciprocalRankFusion(
  resultSets: SearchResult[][],
  topK: number = DEFAULT_TOP_K
): SearchResult[] {
  // -------------------------------------------------------------------------
  // [Step 1] RRF 점수 계산
  // -------------------------------------------------------------------------
  const scoreMap = new Map<string, { result: SearchResult; rrfScore: number }>()

  resultSets.forEach((results) => {
    results.forEach((result, rank) => {
      const existingEntry = scoreMap.get(result.chunkId)
      const rrfScore = 1 / (RRF_K + rank + 1)

      if (existingEntry) {
        // 기존 점수에 추가
        existingEntry.rrfScore += rrfScore
      } else {
        // 새로운 엔트리
        scoreMap.set(result.chunkId, {
          result: { ...result },
          rrfScore,
        })
      }
    })
  })

  // -------------------------------------------------------------------------
  // [Step 2] RRF 점수 기준으로 정렬
  // -------------------------------------------------------------------------
  const rankedResults = Array.from(scoreMap.values())
    .sort((a, b) => b.rrfScore - a.rrfScore)
    .slice(0, topK)
    .map((entry) => ({
      ...entry.result,
      score: entry.rrfScore, // RRF 점수를 score로 사용
    }))

  return rankedResults
}
