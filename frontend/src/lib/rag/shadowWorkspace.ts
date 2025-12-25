// =============================================================================
// PRISM Writer - Shadow Workspace (Pipeline v5)
// =============================================================================
// 파일: frontend/src/lib/rag/shadowWorkspace.ts
// 역할: 패치 시뮬레이션 및 보안 로깅
// 생성일: 2025-12-25
//
// 주석(시니어 개발자): 
// Shadow Workspace는 패치 적용 전 가상으로 시뮬레이션합니다.
// 보안 주의: 로그에 사용자 원문이 노출되지 않도록 마스킹 처리합니다.
//
// 주석(UX/UI 개발자):
// 시뮬레이션 결과를 사용자에게 보여줄 때는 diff 형태로 표시 권장
// =============================================================================

import type { Patch, SimulationResult, AlignmentDelta } from '@/lib/rag/types/patch'

// =============================================================================
// 보안 설정
// =============================================================================

/** 로그에 표시할 최대 문자 수 */
const LOG_MAX_CHARS = 50

/** 마스킹 접미사 */
const MASK_SUFFIX = '...[MASKED]'

// =============================================================================
// 로그 마스킹 유틸리티
// =============================================================================

/**
 * 텍스트를 보안 로그용으로 마스킹
 * 
 * @description
 * 사용자 원문이 로그에 전체 노출되지 않도록 truncate합니다.
 * 개인정보 보호 및 보안을 위해 필수 적용합니다.
 * 
 * @param text - 마스킹할 텍스트
 * @param maxLength - 최대 표시 길이 (기본 50자)
 * @returns 마스킹된 텍스트
 * 
 * @example
 * maskForLog("긴 사용자 텍스트...", 50) 
 * // → "긴 사용자 텍스트...[MASKED]"
 */
export function maskForLog(text: string, maxLength: number = LOG_MAX_CHARS): string {
  if (!text) return '[EMPTY]'
  
  const trimmed = text.trim()
  if (trimmed.length <= maxLength) {
    return trimmed
  }
  
  return trimmed.substring(0, maxLength) + MASK_SUFFIX
}

/**
 * 패치 정보를 보안 로그용으로 변환
 */
export function maskPatchForLog(patch: Patch): Record<string, unknown> {
  return {
    id: patch.id,
    type: patch.type,
    targetRange: patch.targetRange,
    before: maskForLog(patch.before),
    after: maskForLog(patch.after),
    reason: patch.reason,
    status: patch.status,
  }
}

/**
 * 시뮬레이션 결과를 보안 로그용으로 변환
 */
export function maskSimulationForLog(
  result: SimulationResult
): Record<string, unknown> {
  return {
    patchId: result.patchId,
    success: result.success,
    previewText: maskForLog(result.previewText),
    overallScoreDelta: result.overallScoreDelta,
    simulatedAt: result.simulatedAt,
    // alignmentDelta는 민감 정보가 아니므로 그대로 포함
    alignmentDelta: result.alignmentDelta,
  }
}

// =============================================================================
// 보안 로깅 함수
// =============================================================================

/**
 * Shadow Workspace 로그 기록 (보안 마스킹 적용)
 */
export function logShadowWorkspace(
  action: string,
  userId: string,
  documentId: string,
  data?: Record<string, unknown>
): void {
  const safeData = data ? maskSensitiveData(data) : {}
  
  console.log(`[ShadowWorkspace] ${action}`, {
    userId: maskForLog(userId, 8),
    documentId: maskForLog(documentId, 8),
    timestamp: new Date().toISOString(),
    ...safeData,
  })
}

/**
 * 객체 내 민감 데이터 마스킹
 */
function maskSensitiveData(data: Record<string, unknown>): Record<string, unknown> {
  const sensitiveKeys = ['text', 'content', 'before', 'after', 'userText', 'originalText']
  const masked: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(data)) {
    if (sensitiveKeys.includes(key) && typeof value === 'string') {
      masked[key] = maskForLog(value)
    } else if (typeof value === 'object' && value !== null) {
      masked[key] = Array.isArray(value)
        ? value.map(item => 
            typeof item === 'object' && item !== null 
              ? maskSensitiveData(item as Record<string, unknown>)
              : item
          )
        : maskSensitiveData(value as Record<string, unknown>)
    } else {
      masked[key] = value
    }
  }

  return masked
}

// =============================================================================
// Shadow Workspace 시뮬레이션
// =============================================================================

/**
 * Shadow Workspace 시뮬레이션 옵션
 */
export interface SimulateOptions {
  /** 디버그 로깅 활성화 */
  debug?: boolean
  /** 사용자 ID (로깅용) */
  userId?: string
  /** 문서 ID (로깅용) */
  documentId?: string
}

/**
 * 패치를 가상으로 적용하고 결과 시뮬레이션
 * 
 * @description
 * 실제 문서를 수정하지 않고 패치 적용 결과를 미리 계산합니다.
 * 로깅 시 사용자 원문은 마스킹 처리됩니다.
 */
export async function simulateInShadowWorkspace(
  originalText: string,
  patch: Patch,
  options?: SimulateOptions
): Promise<SimulationResult> {
  const { debug = false, userId = 'unknown', documentId = 'unknown' } = options || {}

  // -------------------------------------------------------------------------
  // 1. 보안 로깅 (마스킹 적용)
  // -------------------------------------------------------------------------
  if (debug) {
    logShadowWorkspace('SIMULATE_START', userId, documentId, {
      patchId: patch.id,
      patchType: patch.type,
      targetRange: patch.targetRange,
      originalTextLength: originalText.length,
    })
  }

  // -------------------------------------------------------------------------
  // 2. 패치 적용 시뮬레이션
  // -------------------------------------------------------------------------
  const { targetRange, before, after } = patch
  
  // 범위 검증
  if (targetRange.start < 0 || targetRange.end > originalText.length) {
    if (debug) {
      logShadowWorkspace('SIMULATE_ERROR', userId, documentId, {
        error: 'Invalid target range',
        patchId: patch.id,
      })
    }
    
    return {
      patchId: patch.id,
      success: false,
      previewText: '',
      alignmentDelta: [],
      overallScoreDelta: 0,
      simulatedAt: new Date().toISOString(),
      error: 'Invalid target range',
    }
  }

  // 가상 적용
  const actualBefore = originalText.substring(targetRange.start, targetRange.end)
  const simulatedText = originalText.substring(0, targetRange.start) + 
                        after + 
                        originalText.substring(targetRange.end)

  // -------------------------------------------------------------------------
  // 3. 부합도 변화 계산 (TODO: 실제 LLM 평가)
  // -------------------------------------------------------------------------
  // 현재는 Mock 계산
  const alignmentDelta: AlignmentDelta[] = patch.expectedDelta || [{
    criteria_id: patch.citationId,
    before_score: 60,
    after_score: 75,
    delta: 15,
  }]

  const overallScoreDelta = alignmentDelta.reduce((sum, d) => sum + d.delta, 0)

  // -------------------------------------------------------------------------
  // 4. 결과 생성
  // -------------------------------------------------------------------------
  const result: SimulationResult = {
    patchId: patch.id,
    success: true,
    previewText: simulatedText.substring(0, 500), // 미리보기는 500자로 제한
    alignmentDelta,
    overallScoreDelta,
    simulatedAt: new Date().toISOString(),
  }

  // -------------------------------------------------------------------------
  // 5. 보안 로깅 (마스킹 적용)
  // -------------------------------------------------------------------------
  if (debug) {
    logShadowWorkspace('SIMULATE_COMPLETE', userId, documentId, 
      maskSimulationForLog(result)
    )
  }

  return result
}

/**
 * 여러 패치를 순차 시뮬레이션
 */
export async function simulateMultiplePatches(
  originalText: string,
  patches: Patch[],
  options?: SimulateOptions
): Promise<SimulationResult[]> {
  const results: SimulationResult[] = []
  let currentText = originalText

  for (const patch of patches) {
    const result = await simulateInShadowWorkspace(currentText, patch, options)
    results.push(result)
    
    if (result.success) {
      // 다음 패치를 위해 텍스트 업데이트
      currentText = result.previewText
    }
  }

  return results
}

// =============================================================================
// 디버그 유틸리티
// =============================================================================

/**
 * 시뮬레이션 결과 요약 (보안 마스킹 적용)
 */
export function summarizeSimulation(results: SimulationResult[]): string {
  const successful = results.filter(r => r.success).length
  const failed = results.length - successful
  const totalDelta = results.reduce((sum, r) => sum + r.overallScoreDelta, 0)

  return `[ShadowWorkspace] Summary: ${successful}/${results.length} patches successful, total delta: +${totalDelta}`
}
