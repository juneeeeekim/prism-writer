// =============================================================================
// PRISM Writer - Reviewer Response Parser
// =============================================================================
// 파일: frontend/src/lib/rag/reviewerParser.ts
// 역할: Reviewer 모델 응답 파싱
// P1 Phase 1.3
// =============================================================================

import type { ReviewResult, ReviewBadge } from '@/types/rag'

// =============================================================================
// 기본값 및 상수
// =============================================================================

/**
 * 파싱 실패 시 반환할 기본 결과
 */
const DEFAULT_REVIEW_RESULT: ReviewResult = {
  badge: '⚠️',
  confidence: 0.5,
  issues: ['응답 파싱 실패'],
  reasoning: '검토 응답을 파싱하는 데 실패했습니다.',
}

/**
 * 유효한 배지 값
 */
const VALID_BADGES: ReviewBadge[] = ['✅', '⚠️', '⛔']

// =============================================================================
// JSON 추출 유틸리티
// =============================================================================

/**
 * 문자열에서 JSON 객체 추출
 * 
 * @param text - JSON이 포함된 문자열
 * @returns 파싱된 객체 또는 null
 */
function extractJSON(text: string): unknown | null {
  // ---------------------------------------------------------------------------
  // 방법 1: 코드 블록에서 추출
  // ---------------------------------------------------------------------------
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (codeBlockMatch && codeBlockMatch[1]) {
    try {
      return JSON.parse(codeBlockMatch[1].trim())
    } catch {
      // try next method
    }
  }

  // ---------------------------------------------------------------------------
  // 방법 2: 중괄호 매칭
  // ---------------------------------------------------------------------------
  const braceMatch = text.match(/\{[\s\S]*\}/)
  if (braceMatch) {
    try {
      return JSON.parse(braceMatch[0])
    } catch {
      // try next method
    }
  }

  // ---------------------------------------------------------------------------
  // 방법 3: 전체 텍스트 파싱 시도
  // ---------------------------------------------------------------------------
  try {
    return JSON.parse(text.trim())
  } catch {
    return null
  }
}

// =============================================================================
// 검증 함수
// =============================================================================

/**
 * 배지 값 검증 및 정규화
 */
function validateBadge(badge: unknown): ReviewBadge {
  if (typeof badge === 'string' && VALID_BADGES.includes(badge as ReviewBadge)) {
    return badge as ReviewBadge
  }
  return '⚠️'
}

/**
 * 신뢰도 값 검증 및 정규화
 */
function validateConfidence(confidence: unknown): number {
  if (typeof confidence === 'number' && confidence >= 0 && confidence <= 1) {
    return confidence
  }
  if (typeof confidence === 'string') {
    const parsed = parseFloat(confidence)
    if (!isNaN(parsed) && parsed >= 0 && parsed <= 1) {
      return parsed
    }
  }
  return 0.5
}

/**
 * 이슈 배열 검증 및 정규화
 */
function validateIssues(issues: unknown): string[] | undefined {
  if (Array.isArray(issues)) {
    const validIssues = issues.filter((i): i is string => typeof i === 'string')
    return validIssues.length > 0 ? validIssues : undefined
  }
  return undefined
}

// =============================================================================
// 메인 파서 함수
// =============================================================================

/**
 * Reviewer 응답 파싱
 * 
 * @param response - LLM 응답 문자열
 * @returns ReviewResult 또는 null (파싱 실패 시)
 */
export function parseReviewerResponse(response: string): ReviewResult | null {
  if (!response || typeof response !== 'string') {
    return null
  }

  const parsed = extractJSON(response)
  if (!parsed || typeof parsed !== 'object') {
    return null
  }

  const obj = parsed as Record<string, unknown>

  // ---------------------------------------------------------------------------
  // 필수 필드 검증
  // ---------------------------------------------------------------------------
  if (!('badge' in obj) || !('confidence' in obj) || !('reasoning' in obj)) {
    return null
  }

  return {
    badge: validateBadge(obj.badge),
    confidence: validateConfidence(obj.confidence),
    issues: validateIssues(obj.issues),
    reasoning: typeof obj.reasoning === 'string' ? obj.reasoning : '',
  }
}

/**
 * Reviewer 응답 안전 파싱 (실패 시 기본값 반환)
 * 
 * @param response - LLM 응답 문자열
 * @returns ReviewResult (항상 유효한 결과 반환)
 */
export function parseReviewerResponseSafe(response: string): ReviewResult {
  const result = parseReviewerResponse(response)
  return result ?? DEFAULT_REVIEW_RESULT
}

/**
 * 신뢰도 기반 배지 결정
 * 
 * @param confidence - 신뢰도 점수 (0~1)
 * @param hasIssues - 이슈 존재 여부
 * @returns 적절한 ReviewBadge
 */
export function determineBadgeFromConfidence(
  confidence: number,
  hasIssues: boolean = false
): ReviewBadge {
  if (confidence >= 0.8 && !hasIssues) {
    return '✅'
  }
  if (confidence >= 0.5) {
    return '⚠️'
  }
  return '⛔'
}

/**
 * 기본 Review 결과 반환
 */
export function getDefaultReviewResult(): ReviewResult {
  return { ...DEFAULT_REVIEW_RESULT }
}
