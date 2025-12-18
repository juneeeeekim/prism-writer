// =============================================================================
// PRISM Writer - Judge Response Parser
// =============================================================================
// 파일: frontend/src/lib/rag/judgeParser.ts
// 역할: LLM의 Judge 응답을 파싱하고 검증
// =============================================================================

import type { JudgeResult, JudgeEvidence, JudgeVerdict } from '@/types/rag'
import { getDefaultJudgeResult } from './judgePrompt'

// =============================================================================
// 검증 함수
// =============================================================================

/**
 * JudgeVerdict 타입 검증
 */
function isValidVerdict(value: unknown): value is JudgeVerdict {
  return value === 'pass' || value === 'fail' || value === 'insufficient_evidence'
}

/**
 * JudgeEvidence 객체 검증
 */
function isValidEvidence(value: unknown): value is JudgeEvidence {
  if (typeof value !== 'object' || value === null) return false
  
  const obj = value as Record<string, unknown>
  
  return (
    typeof obj.chunkId === 'string' &&
    typeof obj.quote === 'string' &&
    typeof obj.relevance === 'number' &&
    obj.relevance >= 0 &&
    obj.relevance <= 1
  )
}

/**
 * JudgeResult 객체 검증
 */
function isValidJudgeResult(value: unknown): value is JudgeResult {
  if (typeof value !== 'object' || value === null) return false
  
  const obj = value as Record<string, unknown>
  
  // 필수 필드 검증
  if (!isValidVerdict(obj.verdict)) return false
  if (typeof obj.score !== 'number' || obj.score < 0 || obj.score > 100) return false
  if (!Array.isArray(obj.evidence)) return false
  if (typeof obj.reasoning !== 'string') return false
  
  // evidence 배열 검증
  for (const ev of obj.evidence) {
    if (!isValidEvidence(ev)) return false
  }
  
  // missingEvidence 검증 (옵션)
  if (obj.missingEvidence !== undefined) {
    if (!Array.isArray(obj.missingEvidence)) return false
    for (const item of obj.missingEvidence) {
      if (typeof item !== 'string') return false
    }
  }
  
  return true
}

// =============================================================================
// Main Functions
// =============================================================================

/**
 * LLM 응답에서 JSON 추출
 * 
 * @description
 * LLM 응답에서 JSON 블록을 추출합니다.
 * ```json ... ``` 형식 또는 순수 JSON을 처리합니다.
 */
function extractJSON(response: string): string | null {
  // 1. ```json ... ``` 블록 추출 시도
  const jsonBlockMatch = response.match(/```json\s*([\s\S]*?)\s*```/)
  if (jsonBlockMatch) {
    return jsonBlockMatch[1].trim()
  }
  
  // 2. ``` ... ``` 블록 추출 시도
  const codeBlockMatch = response.match(/```\s*([\s\S]*?)\s*```/)
  if (codeBlockMatch) {
    return codeBlockMatch[1].trim()
  }
  
  // 3. 순수 JSON 추출 시도 (첫 번째 { 부터 마지막 } 까지)
  const jsonMatch = response.match(/\{[\s\S]*\}/)
  if (jsonMatch) {
    return jsonMatch[0]
  }
  
  return null
}

/**
 * Judge 응답 파서
 * 
 * @description
 * LLM의 Judge 응답을 파싱하여 JudgeResult 객체로 변환합니다.
 * 파싱 실패 시 null을 반환합니다.
 * 
 * @param response - LLM의 원본 응답 문자열
 * @returns 파싱된 JudgeResult 또는 null
 * 
 * @example
 * ```typescript
 * const result = parseJudgeResponse(llmResponse)
 * if (!result) {
 *   // 파싱 실패 처리
 * }
 * ```
 */
export function parseJudgeResponse(response: string): JudgeResult | null {
  // ---------------------------------------------------------------------------
  // 1. JSON 추출
  // ---------------------------------------------------------------------------
  const jsonString = extractJSON(response)
  
  if (!jsonString) {
    console.warn('[JudgeParser] JSON 추출 실패')
    return null
  }
  
  // ---------------------------------------------------------------------------
  // 2. JSON 파싱
  // ---------------------------------------------------------------------------
  let parsed: unknown
  
  try {
    parsed = JSON.parse(jsonString)
  } catch (error) {
    console.warn('[JudgeParser] JSON 파싱 오류:', error)
    return null
  }
  
  // ---------------------------------------------------------------------------
  // 3. 스키마 검증
  // ---------------------------------------------------------------------------
  if (!isValidJudgeResult(parsed)) {
    console.warn('[JudgeParser] 스키마 검증 실패:', parsed)
    return null
  }
  
  // ---------------------------------------------------------------------------
  // 4. 정규화 및 반환
  // ---------------------------------------------------------------------------
  return {
    verdict: parsed.verdict,
    score: Math.round(parsed.score),
    evidence: parsed.evidence.map((ev) => ({
      chunkId: ev.chunkId,
      quote: ev.quote,
      relevance: Math.round(ev.relevance * 100) / 100, // 소수점 2자리
    })),
    reasoning: parsed.reasoning,
    missingEvidence: parsed.missingEvidence,
  }
}

/**
 * 안전한 Judge 응답 파서
 * 
 * @description
 * 파싱 실패 시 기본값을 반환합니다.
 * 
 * @param response - LLM의 원본 응답 문자열
 * @returns 파싱된 JudgeResult (실패 시 기본값)
 */
export function parseJudgeResponseSafe(response: string): JudgeResult {
  const result = parseJudgeResponse(response)
  
  if (!result) {
    console.warn('[JudgeParser] 파싱 실패, 기본값 사용')
    return getDefaultJudgeResult()
  }
  
  return result
}
