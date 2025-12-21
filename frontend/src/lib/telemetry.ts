// =============================================================================
// PRISM Writer - Telemetry Utilities
// =============================================================================
// 파일: frontend/src/lib/telemetry.ts
// 역할: Telemetry 유틸리티 함수
// P1 Phase 3.2
// =============================================================================

import type { 
  TelemetryRecord, 
  TelemetryStep, 
  PartialTelemetry, 
  MeasureStepResult 
} from '@/types/telemetry'
import { estimateCost } from '@/types/telemetry'

// =============================================================================
// Run ID 생성
// =============================================================================

/**
 * 고유 실행 ID 생성
 * 
 * @description
 * 모든 파이프라인 단계를 연결하는 고유 식별자
 * 형식: run_<timestamp>_<random>
 * 
 * @returns 고유 run_id
 */
export function generateRunId(): string {
  const timestamp = Date.now()
  const random = Math.random().toString(36).slice(2, 9)
  return `run_${timestamp}_${random}`
}

// =============================================================================
// 성능 측정 래퍼
// =============================================================================

/**
 * 단계별 성능 측정 래퍼
 * 
 * @description
 * 함수 실행 시간을 측정하고 Telemetry 데이터 반환
 * 
 * @param step - 파이프라인 단계
 * @param fn - 측정할 비동기 함수
 * @returns 결과 및 Telemetry 데이터
 * 
 * @example
 * ```typescript
 * const { result, telemetry } = await measureStep('search', () => searchDocs(query))
 * ```
 */
export async function measureStep<T>(
  step: TelemetryStep,
  fn: () => Promise<T>
): Promise<MeasureStepResult<T>> {
  const startTime = Date.now()
  let success = true
  let errorCode: string | undefined

  try {
    const result = await fn()
    const endTime = Date.now()
    
    return {
      result,
      telemetry: {
        step,
        startTime,
        endTime,
        latencyMs: endTime - startTime,
        success: true,
        tokensIn: 0,
        tokensOut: 0,
        costEstimate: 0,
      },
    }
  } catch (error) {
    const endTime = Date.now()
    success = false
    errorCode = error instanceof Error ? error.message.slice(0, 100) : 'unknown'
    
    return {
      result: null as unknown as T,
      telemetry: {
        step,
        startTime,
        endTime,
        latencyMs: endTime - startTime,
        success: false,
        errorCode,
        tokensIn: 0,
        tokensOut: 0,
        costEstimate: 0,
      },
    }
  }
}

/**
 * LLM 호출 측정 래퍼 (토큰 정보 포함)
 * 
 * @param step - 파이프라인 단계
 * @param modelId - 모델 ID
 * @param fn - 측정할 비동기 함수 (토큰 정보 반환)
 * @returns 결과 및 Telemetry 데이터 (비용 포함)
 */
export async function measureLLMStep<T extends { tokensIn?: number; tokensOut?: number }>(
  step: TelemetryStep,
  modelId: string,
  fn: () => Promise<T>
): Promise<MeasureStepResult<T>> {
  const startTime = Date.now()

  try {
    const result = await fn()
    const endTime = Date.now()
    
    const tokensIn = result.tokensIn ?? 0
    const tokensOut = result.tokensOut ?? 0
    const costEstimate = estimateCost(modelId, tokensIn, tokensOut)

    return {
      result,
      telemetry: {
        step,
        startTime,
        endTime,
        latencyMs: endTime - startTime,
        modelId,
        tokensIn,
        tokensOut,
        costEstimate,
        success: true,
      },
    }
  } catch (error) {
    const endTime = Date.now()
    
    return {
      result: null as unknown as T,
      telemetry: {
        step,
        startTime,
        endTime,
        latencyMs: endTime - startTime,
        modelId,
        tokensIn: 0,
        tokensOut: 0,
        costEstimate: 0,
        success: false,
        errorCode: error instanceof Error ? error.message.slice(0, 100) : 'unknown',
      },
    }
  }
}

// =============================================================================
// Telemetry 로깅
// =============================================================================

/**
 * Telemetry 기록 저장 (비동기)
 * 
 * @description
 * Supabase에 Telemetry 기록 저장
 * 응답 지연 최소화를 위해 fire-and-forget 방식
 * 
 * @param record - Telemetry 기록
 */
export async function logTelemetry(record: TelemetryRecord): Promise<void> {
  // ---------------------------------------------------------------------------
  // 개발 환경 로깅
  // ---------------------------------------------------------------------------
  if (process.env.NODE_ENV === 'development') {
    console.log('[Telemetry]', {
      runId: record.runId,
      step: record.step,
      latencyMs: record.latencyMs,
      success: record.success,
      costEstimate: record.costEstimate.toFixed(6),
    })
  }

  // ---------------------------------------------------------------------------
  // Supabase 저장 (추후 구현)
  // ---------------------------------------------------------------------------
  // try {
  //   const { createClient } = await import('@/lib/supabase/client')
  //   const supabase = createClient()
  //   
  //   await supabase.from('telemetry_logs').insert({
  //     run_id: record.runId,
  //     user_id: record.userId,
  //     step: record.step,
  //     start_time: record.startTime,
  //     end_time: record.endTime,
  //     latency_ms: record.latencyMs,
  //     model_id: record.modelId,
  //     tokens_in: record.tokensIn,
  //     tokens_out: record.tokensOut,
  //     cost_estimate: record.costEstimate,
  //     success: record.success,
  //     error_code: record.errorCode,
  //   })
  // } catch (error) {
  //   console.error('[Telemetry] Failed to log:', error)
  // }
}

/**
 * 여러 Telemetry 기록 일괄 저장
 * 
 * @param records - Telemetry 기록 배열
 */
export async function logTelemetryBatch(records: TelemetryRecord[]): Promise<void> {
  if (process.env.NODE_ENV === 'development') {
    console.log(`[Telemetry] Batch logging ${records.length} records`)
    records.forEach(r => {
      console.log(`  - ${r.step}: ${r.latencyMs}ms, success=${r.success}`)
    })
  }
  
  // Supabase batch insert 추후 구현
}

/**
 * 템플릿 빌드 이벤트 로깅
 * 
 * @param event - 템플릿 빌드 관련 정보
 */
export async function logTemplateBuildEvent(event: {
  template_id: string
  document_id: string
  build_time_ms: number
  success: boolean
  failure_reason?: string
}): Promise<void> {
  if (process.env.NODE_ENV === 'development') {
    console.log('[Telemetry] Template Build Event:', event)
  }

  // Supabase 저장 (추후 구현)
  // try {
  //   const { createClient } = await import('@/lib/supabase/client')
  //   const supabase = createClient()
  //   await supabase.from('template_build_logs').insert({
  //     template_id: event.template_id,
  //     document_id: event.document_id,
  //     build_time_ms: event.build_time_ms,
  //     success: event.success,
  //     failure_reason: event.failure_reason,
  //     created_at: new Date().toISOString()
  //   })
  // } catch (error) {
  //   console.error('[Telemetry] Failed to log build event:', error)
  // }
}

// =============================================================================
// Telemetry 집계 유틸리티
// =============================================================================

/**
 * 실행의 총 비용 계산
 * 
 * @param records - 동일 runId의 Telemetry 기록들
 * @returns 총 비용 (USD)
 */
export function calculateTotalCost(records: TelemetryRecord[]): number {
  return records.reduce((sum, r) => sum + r.costEstimate, 0)
}

/**
 * 실행의 총 지연 시간 계산
 * 
 * @param records - 동일 runId의 Telemetry 기록들
 * @returns 총 지연 시간 (ms)
 */
export function calculateTotalLatency(records: TelemetryRecord[]): number {
  return records.reduce((sum, r) => sum + r.latencyMs, 0)
}
