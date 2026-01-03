// =============================================================================
// PRISM Writer - Citation Gate
// =============================================================================
// 파일: frontend/src/lib/rag/citationGate.ts
// 역할: LLM 응답의 인용문이 원본 청크에 실제로 존재하는지 검증
// =============================================================================

import type { JudgeEvidence } from '@/types/rag'

// =============================================================================
// 타입 정의
// =============================================================================

/**
 * 인용 검증 결과 인터페이스
 */
export interface CitationVerifyResult {
  /** 검증 성공 여부 */
  valid: boolean
  /** 매칭된 청크 ID (검증 성공 시) */
  matchedChunkId?: string
  /** 매칭 점수 (0~1) */
  matchScore: number
}

/**
 * 검증된 근거 인터페이스 (JudgeEvidence + 검증 결과)
 */
export interface VerifiedEvidence extends JudgeEvidence {
  /** 인용 검증 결과 */
  verified: CitationVerifyResult
}

// =============================================================================
// 상수
// =============================================================================

/** 유사도 임계값 - 이 값 이상이면 매칭으로 판단 */
// [2026-01-03] 60% → 70% 상향: 더 엄격한 근거 검증 기준 적용
const SIMILARITY_THRESHOLD = 0.7

/** 부분 매칭을 위한 최소 문자열 길이 */
const MIN_PARTIAL_MATCH_LENGTH = 10

/** [Phase B] 인용 마커 가산점 (0.15 = +15%) */
const CITATION_MARKER_BONUS = 0.15

// =============================================================================
// 유틸리티 함수
// =============================================================================

/**
 * 문자열 정규화
 * 
 * @description
 * 비교를 위해 문자열을 정규화합니다.
 * - 공백 통일
 * - 소문자 변환
 * - 특수문자 제거
 */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+/g, ' ')  // 연속 공백을 하나로
    .replace(/[^\w\sㄱ-ㅎㅏ-ㅣ가-힣]/g, '')  // 특수문자 제거 (한글 유지)
    .trim()
}

/**
 * 자카드 유사도 계산 (단어 기반)
 * 
 * @description
 * 두 문자열의 단어 집합 기반 유사도를 계산합니다.
 */
function calculateJaccardSimilarity(str1: string, str2: string): number {
  const words1 = new Set(normalizeText(str1).split(' ').filter(Boolean))
  const words2 = new Set(normalizeText(str2).split(' ').filter(Boolean))
  
  if (words1.size === 0 || words2.size === 0) return 0
  
  const intersection = Array.from(words1).filter((w) => words2.has(w)).length
  const union = new Set([...Array.from(words1), ...Array.from(words2)]).size
  
  return intersection / union
}

/**
 * 부분 문자열 포함 여부 검사
 * 
 * @description
 * 정규화된 text가 content에 포함되어 있는지 확인합니다.
 */
function containsSubstring(content: string, quote: string): boolean {
  const normalizedContent = normalizeText(content)
  const normalizedQuote = normalizeText(quote)
  
  return normalizedContent.includes(normalizedQuote)
}

/**
 * 부분 매칭 점수 계산
 * 
 * @description
 * 긴 인용문의 경우, 핵심 부분만 매칭되어도 점수를 부여합니다.
 */
function calculatePartialMatchScore(content: string, quote: string): number {
  const normalizedContent = normalizeText(content)
  const normalizedQuote = normalizeText(quote)
  
  // 인용문 길이가 짧으면 전체 매칭 필요
  if (normalizedQuote.length < MIN_PARTIAL_MATCH_LENGTH) {
    return containsSubstring(content, quote) ? 1.0 : 0
  }
  
  // 긴 인용문은 부분 매칭 허용
  const words = normalizedQuote.split(' ')
  const totalWords = words.length
  let matchedWords = 0
  
  for (const word of words) {
    if (normalizedContent.includes(word)) {
      matchedWords++
    }
  }
  
  return matchedWords / totalWords
}

/**
 * [Phase B] 인용 마커 존재 여부 확인
 * 
 * @description
 * AI 응답에 [1], [2], [참고 자료 1] 등의 인용 마커가 있는지 확인합니다.
 * 마커가 있으면 출처를 명시하려는 의도로 판단하여 가산점을 부여합니다.
 */
export function hasCitationMarkers(text: string): boolean {
  // [1], [2], ... [9] 패턴 또는 [참고 자료 N] 패턴
  const citationPattern = /\[\d+\]|\[참고\s*자료\s*\d+\]/g
  const matches = text.match(citationPattern)
  return matches !== null && matches.length >= 1
}

/**
 * [Phase B] 인용 마커 개수 반환
 */
export function countCitationMarkers(text: string): number {
  const citationPattern = /\[\d+\]|\[참고\s*자료\s*\d+\]/g
  const matches = text.match(citationPattern)
  return matches ? matches.length : 0
}

// =============================================================================
// Main Functions
// =============================================================================

/**
 * 단일 인용문 검증
 * 
 * @description
 * 주어진 인용문이 소스 청크 중 하나에 존재하는지 검증합니다.
 * fuzzy matching을 지원하여 오타나 띄어쓰기 차이를 허용합니다.
 * 
 * @param quote - 검증할 인용문
 * @param sourceChunks - 원본 청크 배열
 * @returns 인용 검증 결과
 * 
 * @example
 * ```typescript
 * const result = verifyCitation(
 *   "RAG는 검색과 생성을 결합한 기술입니다.",
 *   [{ id: "chunk-1", content: "RAG는 검색과 생성을 결합한 기술입니다..." }]
 * )
 * // result = { valid: true, matchedChunkId: "chunk-1", matchScore: 1.0 }
 * ```
 */
export function verifyCitation(
  quote: string,
  sourceChunks: Array<{ id: string; content: string }>
): CitationVerifyResult {
  // ---------------------------------------------------------------------------
  // 1. 빈 인용문 처리
  // ---------------------------------------------------------------------------
  if (!quote || quote.trim().length === 0) {
    return {
      valid: false,
      matchScore: 0,
    }
  }

  // ---------------------------------------------------------------------------
  // 2. 각 청크에서 인용문 검색
  // ---------------------------------------------------------------------------
  let bestMatch: CitationVerifyResult = {
    valid: false,
    matchScore: 0,
  }

  for (const chunk of sourceChunks) {
    // 정확한 부분 문자열 매칭 (가장 높은 점수)
    if (containsSubstring(chunk.content, quote)) {
      return {
        valid: true,
        matchedChunkId: chunk.id,
        matchScore: 1.0,
      }
    }

    // 부분 매칭 점수 계산
    const partialScore = calculatePartialMatchScore(chunk.content, quote)
    
    // 자카드 유사도
    const jaccardScore = calculateJaccardSimilarity(chunk.content, quote)
    
    // 최종 점수 (부분 매칭 70%, 자카드 30%)
    const combinedScore = partialScore * 0.7 + jaccardScore * 0.3

    if (combinedScore > bestMatch.matchScore) {
      bestMatch = {
        valid: combinedScore >= SIMILARITY_THRESHOLD,
        matchedChunkId: combinedScore >= SIMILARITY_THRESHOLD ? chunk.id : undefined,
        matchScore: Math.round(combinedScore * 100) / 100,
      }
    }
  }

  return bestMatch
}

/**
 * 여러 인용문 일괄 검증
 * 
 * @description
 * JudgeEvidence 배열의 모든 인용문을 검증합니다.
 * 
 * @param evidence - 검증할 근거 배열
 * @param sourceChunks - 원본 청크 배열
 * @returns 검증 결과가 포함된 근거 배열
 */
export function verifyAllCitations(
  evidence: JudgeEvidence[],
  sourceChunks: Array<{ id: string; content: string }>
): VerifiedEvidence[] {
  return evidence.map((ev) => ({
    ...ev,
    verified: verifyCitation(ev.quote, sourceChunks),
  }))
}

/**
 * 인용 검증 요약 생성
 * 
 * @description
 * 검증 결과의 요약 정보를 반환합니다.
 */
export function summarizeCitationVerification(
  verifiedEvidence: VerifiedEvidence[]
): {
  total: number
  valid: number
  invalid: number
  averageScore: number
} {
  const total = verifiedEvidence.length
  const valid = verifiedEvidence.filter((e) => e.verified.valid).length
  const invalid = total - valid
  const averageScore = total > 0
    ? verifiedEvidence.reduce((sum, e) => sum + e.verified.matchScore, 0) / total
    : 0

  return {
    total,
    valid,
    invalid,
    averageScore: Math.round(averageScore * 100) / 100,
  }
}
