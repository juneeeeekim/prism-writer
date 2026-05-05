// =============================================================================
// PRISM Writer - LLM Performance Logger (Phase 4)
// =============================================================================
// 파일: frontend/src/lib/llm/performance-logger.ts
// 역할: LLM 호출의 응답시간, 성공 여부, 에러 분류를 Supabase
//       llm_performance_logs 테이블에 기록한다.
// 설계 의도(왜 이 구조인가):
//   1) 로깅이 본 기능을 막지 않도록 모든 호출은 try/catch로 격리되어 있고
//      실패는 console.warn으로만 보고된다. 본 기능 흐름과 별도 분리.
//   2) measurePerformance 래퍼는 비동기 함수에 사용하기 쉬운 형태로
//      latency를 자동 측정한다. 토큰/품질 점수는 호출자가 별도로 보강할 수
//      있다.
//   3) 마이그레이션이 적용되지 않은 환경에서도 안전: 테이블이 없으면 INSERT는
//      실패하고 catch에서 조용히 흡수한다.
// =============================================================================

import { createClient } from '@/lib/supabase/server'
import type { LLMUsageContext } from '@/config/llm-usage-map'

// -----------------------------------------------------------------------------
// 타입
// -----------------------------------------------------------------------------

export interface PerformanceLog {
  context: LLMUsageContext
  modelId: string
  usedFallback: boolean
  latencyMs: number
  inputTokens?: number
  outputTokens?: number
  qualityScore?: number
  isSuccess: boolean
  errorType?: string
  userId?: string
  documentId?: string
}

// -----------------------------------------------------------------------------
// Public: logPerformance
// -----------------------------------------------------------------------------

/**
 * 성능 로그를 Supabase에 기록한다.
 *
 * @description
 * - 실패는 조용히 흡수(console.warn)되어 본 기능에 영향 없음.
 * - 마이그레이션 미적용 환경에서도 throw하지 않는다.
 */
export async function logPerformance(log: PerformanceLog): Promise<void> {
  try {
    const supabase = await createClient()

    await supabase.from('llm_performance_logs').insert({
      context: log.context,
      model_id: log.modelId,
      used_fallback: log.usedFallback,
      latency_ms: log.latencyMs,
      input_tokens: log.inputTokens,
      output_tokens: log.outputTokens,
      quality_score: log.qualityScore,
      is_success: log.isSuccess,
      error_type: log.errorType,
      user_id: log.userId,
      document_id: log.documentId,
    })
  } catch (error) {
    console.warn('[PerformanceLogger] Failed to log:', error)
  }
}

// -----------------------------------------------------------------------------
// Public: measurePerformance 래퍼
// -----------------------------------------------------------------------------

/**
 * LLM 호출을 감싸 응답시간과 결과를 자동 기록한다.
 *
 * @example
 * const result = await measurePerformance(
 *   'rag.answer',
 *   'gemini-3-flash-preview',
 *   () => generateText(prompt, { context: 'rag.answer' }),
 *   { userId: user.id, documentId: doc.id }
 * )
 */
export async function measurePerformance<T>(
  context: LLMUsageContext,
  modelId: string,
  operation: () => Promise<T>,
  options?: {
    usedFallback?: boolean
    userId?: string
    documentId?: string
  }
): Promise<T> {
  const startTime = Date.now()
  let isSuccess = true
  let errorType: string | undefined

  try {
    const result = await operation()
    return result
  } catch (error) {
    isSuccess = false
    errorType = error instanceof Error ? error.name : 'UnknownError'
    throw error
  } finally {
    const latencyMs = Date.now() - startTime

    // 비동기 로깅, await 하지 않는다.
    void logPerformance({
      context,
      modelId,
      usedFallback: options?.usedFallback ?? false,
      latencyMs,
      isSuccess,
      errorType,
      userId: options?.userId,
      documentId: options?.documentId,
    })
  }
}
