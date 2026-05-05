// =============================================================================
// PRISM Writer - LLM Fallback Handler
// =============================================================================
// 파일: frontend/src/lib/llm/fallback-handler.ts
// 역할: Gateway를 우회하여 Provider SDK를 직접 호출하는 모듈(Reranker,
//       Template Gates 등)이 동일한 fallback/quota/로깅 정책을 공유할 수
//       있도록 한다.
// 설계 의도(왜 이 구조인가):
//   1) 게이트웨이의 모든 보호 로직(분류·차단·로깅)을 generateText 외부에서도
//      재사용 가능하게 만든다. 동일 정책을 두 곳에서 관리하지 않도록 단일
//      소스를 유지한다.
//   2) 콜백 기반(apiCall: (modelId) => Promise<T>)으로 모델 ID만 주입하므로
//      Provider SDK 호출 코드를 그대로 두고 외부에서 모델만 교체할 수 있다.
//   3) Fallback 가능 에러 타입을 화이트리스트로 명시한다. CONTEXT_TOO_LONG /
//      INVALID_API_KEY는 fallback이 무의미하므로 시도하지 않는다.
// =============================================================================

import {
  getModelForUsage,
  getFallbackModel,
  type LLMUsageContext,
} from '@/config/llm-usage-map'
import {
  classifyLLMError,
  inferProviderFromModelId,
  type LLMError,
  type LLMErrorType,
} from './error-handler'
import {
  markQuotaExceeded,
  markRateLimited,
  isQuotaExceeded,
} from './quota-manager'
import { writeErrorLog } from '@/lib/error-log'

// -----------------------------------------------------------------------------
// 정책: fallback 시도 가능 에러 타입
// -----------------------------------------------------------------------------
// 주석(API/Integration): CONTEXT_TOO_LONG은 입력 자체 문제라 fallback해도
// 동일하게 실패한다. INVALID_API_KEY는 운영자 개입이 필요한 영구 에러로
// 자동 우회보다 빠르게 노출되는 편이 낫다. UNKNOWN은 재시도 보장이 없으므로
// 보수적으로 제외한다.
const FALLBACK_ELIGIBLE_ERRORS: readonly LLMErrorType[] = [
  'QUOTA_EXCEEDED',
  'RATE_LIMITED',
  'MODEL_NOT_FOUND',
  'NETWORK_ERROR',
] as const

// -----------------------------------------------------------------------------
// 결과 타입
// -----------------------------------------------------------------------------

export interface FallbackResult<T> {
  success: boolean
  result?: T
  usedModel: string
  usedFallback: boolean
  error?: LLMError
}

// -----------------------------------------------------------------------------
// 내부 유틸: 구조화 로그
// -----------------------------------------------------------------------------

function logEvent(
  outcome:
    | 'primary-failure'
    | 'fallback-success'
    | 'fallback-failure'
    | 'preflight-fallback',
  context: LLMUsageContext,
  modelId: string,
  error?: unknown
): void {
  const provider = inferProviderFromModelId(modelId)
  void writeErrorLog({
    category: 'external',
    domain:
      outcome === 'primary-failure' ? `llm-${provider}` : 'llm-fallback',
    severity: outcome === 'fallback-success' ? 'warn' : 'error',
    source: `fallback-handler.${outcome}`,
    operation: context,
    message: `Fallback handler ${outcome}`,
    error,
    metadata: { modelId, provider, outcome },
  })
}

// -----------------------------------------------------------------------------
// Public: callWithFallback
// -----------------------------------------------------------------------------

/**
 * 임의의 LLM 호출 함수를 fallback 정책으로 래핑한다.
 *
 * @description
 * - 1차: getModelForUsage(context) 결과로 호출.
 * - Provider가 사전 차단되어 있으면 즉시 fallback으로 우회.
 * - 1차 실패 시 에러를 분류하고 fallback 가능하면 1회 재시도.
 *
 * @param context - 사용 컨텍스트 (fallback 모델 결정 키)
 * @param apiCall - 모델 ID를 받아 결과를 반환하는 비동기 호출자
 * @returns 성공/실패 + 사용된 모델 + fallback 사용 여부
 *
 * @example
 * const out = await callWithFallback('rag.reranker', async (modelId) => {
 *   return await callGeminiSdkWithModel(modelId, prompt)
 * })
 * if (!out.success) // 호출자에서 보호 로직 적용
 */
export async function callWithFallback<T>(
  context: LLMUsageContext,
  apiCall: (modelId: string) => Promise<T>
): Promise<FallbackResult<T>> {
  const primaryModel = getModelForUsage(context)
  const fallbackModel = getFallbackModel(context)
  const primaryProvider = inferProviderFromModelId(primaryModel)

  // 0) Provider가 사전 차단된 경우, 차단을 인지하고 곧장 fallback으로.
  if (fallbackModel && isQuotaExceeded(primaryProvider)) {
    logEvent('preflight-fallback', context, primaryModel)
    try {
      const result = await apiCall(fallbackModel)
      logEvent('fallback-success', context, fallbackModel)
      return {
        success: true,
        result,
        usedModel: fallbackModel,
        usedFallback: true,
      }
    } catch (fallbackError) {
      logEvent('fallback-failure', context, fallbackModel, fallbackError)
      const llmError = classifyLLMError(fallbackError)
      return {
        success: false,
        usedModel: fallbackModel,
        usedFallback: true,
        error: llmError,
      }
    }
  }

  // 1) Primary 시도
  try {
    const result = await apiCall(primaryModel)
    return {
      success: true,
      result,
      usedModel: primaryModel,
      usedFallback: false,
    }
  } catch (primaryError) {
    const llmError = classifyLLMError(primaryError)
    logEvent('primary-failure', context, primaryModel, primaryError)
    console.warn(
      `[Fallback] Primary model failed (${context}): ${llmError.type}`
    )

    // Quota / RateLimit 차단 표시
    if (llmError.type === 'QUOTA_EXCEEDED' && llmError.retryAfter) {
      markQuotaExceeded(primaryProvider, llmError.retryAfter)
    } else if (llmError.type === 'RATE_LIMITED' && llmError.retryAfter) {
      markRateLimited(primaryProvider, llmError.retryAfter)
    }

    // 2) Fallback 가능성 평가
    if (!fallbackModel || !FALLBACK_ELIGIBLE_ERRORS.includes(llmError.type)) {
      return {
        success: false,
        usedModel: primaryModel,
        usedFallback: false,
        error: llmError,
      }
    }

    // 3) Fallback 시도
    console.log(`[Fallback] Trying fallback model: ${fallbackModel}`)
    try {
      const result = await apiCall(fallbackModel)
      logEvent('fallback-success', context, fallbackModel)
      return {
        success: true,
        result,
        usedModel: fallbackModel,
        usedFallback: true,
      }
    } catch (fallbackError) {
      const fbError = classifyLLMError(fallbackError)
      logEvent('fallback-failure', context, fallbackModel, fallbackError)
      console.error(
        `[Fallback] Fallback model also failed: ${fbError.type}`
      )
      return {
        success: false,
        usedModel: fallbackModel,
        usedFallback: true,
        error: fbError,
      }
    }
  }
}

// -----------------------------------------------------------------------------
// Public: logFallbackUsage
// -----------------------------------------------------------------------------

/**
 * Fallback 사용 통계 로깅.
 *
 * @description
 * 호출자가 결과를 받은 후 명시적으로 텔레메트리에 송출할 수 있게 한다.
 * 본 함수는 결과 객체에서 fallback이 사용되었을 때만 console에 출력한다.
 * 추후 별도 텔레메트리 백엔드 도입 시 이 지점만 교체하면 된다.
 */
export function logFallbackUsage(result: FallbackResult<unknown>): void {
  if (result.usedFallback) {
    console.log(
      `[Telemetry] Fallback used - Model: ${result.usedModel}, Success: ${result.success}`
    )
  }
}
