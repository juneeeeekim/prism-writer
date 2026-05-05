// =============================================================================
// PRISM Writer - LLM Gateway
// =============================================================================
// 파일: frontend/src/lib/llm/gateway.ts
// 역할: 모든 LLM 요청의 단일 진입점 (Routing & Abstraction)
// 수정: 2026-01-17 - Gateway Level Fallback 지원 추가
// 수정: 2026-05-03 - Phase 1: 에러 분류·Quota Manager·error-log 통합
//        설계 의도(왜 이 구조인가):
//        - 기존 fallback(2026-01-17)을 그대로 유지하되, 에러를 LLMError로
//          정규화하고 Quota/Rate-Limit를 Provider 단위로 표시해 후속 호출의
//          빠른 우회를 가능하게 한다.
//        - 사용자 친화 메시지로 변환된 Error를 throw하여 UI가 별도 변환
//          로직을 가지지 않도록 한다(EvaluationTab 등 사용처는 수정 불필요).
//        - 로그는 error-log/external/llm-{primary|fallback} 도메인에 기록된다.
//          저장 실패는 writeErrorLog 내부에서 격리되어 본 기능에 영향 없음.
// =============================================================================

import { getProviderByModel } from "./providers";
import { getDefaultModel } from "@/config/llm.config";
import { getModelConfig } from "@/config/models";
// =============================================================================
// [2026-01-17] Gateway Fallback 지원을 위한 import
// llm-usage-map.ts에서 context별 fallback 모델 조회
// =============================================================================
import { getFallbackModel, type LLMUsageContext } from "@/config/llm-usage-map";
import type {
  LLMGenerateOptions,
  LLMResponse,
  LLMStreamChunk,
} from "./types";
// =============================================================================
// [2026-05-03] Phase 1: 에러 분류 / Quota / 구조화 로깅
// =============================================================================
import {
  classifyLLMError,
  getUserFriendlyMessage,
  inferProviderFromModelId,
  type LLMError,
} from "./error-handler";
import {
  markQuotaExceeded,
  markRateLimited,
  isQuotaExceeded,
} from "./quota-manager";
import { writeErrorLog } from "@/lib/error-log";
// =============================================================================
// [2026-05-04] Phase 4: 성능 로깅 통합
// 설계 의도(왜 이 구조인가):
//   - latency·성공 여부·fallback 사용 여부를 Supabase에 기록한다.
//   - logPerformance는 fire-and-forget로 호출되어 본 응답 흐름을 막지 않는다.
//   - 마이그레이션 미적용 환경에서도 logPerformance 내부에서 흡수되므로
//     게이트웨이 호출이 실패하지 않는다.
// =============================================================================
import { logPerformance } from "./performance-logger";

// -----------------------------------------------------------------------------
// 내부 헬퍼: Provider 에러를 분류·기록하고 정책 적용
// -----------------------------------------------------------------------------
// 주석(시니어): primary 실패 시점의 처리(분류·로깅·quota 마킹)를 단일 함수로
// 모았다. generateText/generateTextStream 양쪽에서 동일한 정책을 사용하므로
// 두 곳에 중복하지 않기 위해 분리했다.

function recordPrimaryFailure(
  modelId: string,
  context: LLMUsageContext | undefined,
  error: unknown
): LLMError {
  const llmError = classifyLLMError(error);
  const provider = inferProviderFromModelId(modelId);

  // Quota / Rate Limit는 Provider 단위로 차단 표시한다.
  if (llmError.type === "QUOTA_EXCEEDED" && llmError.retryAfter) {
    markQuotaExceeded(provider, llmError.retryAfter);
  } else if (llmError.type === "RATE_LIMITED" && llmError.retryAfter) {
    markRateLimited(provider, llmError.retryAfter);
  }

  // 구조화 로그 — 본 함수 흐름과 분리되어야 하므로 await 하지 않는다.
  void writeErrorLog({
    category: "external",
    domain: `llm-${provider}`,
    severity: "error",
    source: "gateway.primary",
    operation: context ?? "unknown",
    message: `LLM primary call failed: ${llmError.type}`,
    error,
    metadata: {
      modelId,
      errorType: llmError.type,
      retryable: llmError.retryable,
      retryAfter: llmError.retryAfter,
    },
  });

  return llmError;
}

// -----------------------------------------------------------------------------
// 내부 헬퍼: 성능 로그 기록 (fire-and-forget)
// -----------------------------------------------------------------------------
// 주석(시니어): startTime 기반 latency 측정. 호출자에서 await 하지 않으며,
// logPerformance 내부에서 모든 예외가 흡수되므로 본 응답 흐름에 영향 없음.

function recordPerf(
  context: LLMUsageContext | undefined,
  modelId: string,
  startTime: number,
  isSuccess: boolean,
  usedFallback: boolean,
  errorType?: string
): void {
  // context가 없으면 성능 로그 의미가 약하므로 생략한다(기본 모델 호출 등).
  if (!context) return;
  void logPerformance({
    context,
    modelId,
    usedFallback,
    latencyMs: Date.now() - startTime,
    isSuccess,
    errorType,
  });
}

function recordFallbackOutcome(
  fallbackModelId: string,
  context: LLMUsageContext | undefined,
  outcome: "success" | "failure",
  error?: unknown
): void {
  const provider = inferProviderFromModelId(fallbackModelId);
  void writeErrorLog({
    category: "external",
    domain: "llm-fallback",
    severity: outcome === "success" ? "warn" : "error",
    source: "gateway.fallback",
    operation: context ?? "unknown",
    message:
      outcome === "success"
        ? "LLM fallback succeeded"
        : "LLM fallback also failed",
    error,
    metadata: {
      fallbackModelId,
      provider,
      outcome,
    },
  });
}

// -----------------------------------------------------------------------------
// Quota 사전 체크 — 1차 호출 전에 차단 여부 확인
// -----------------------------------------------------------------------------
// 주석(API/Integration): 차단된 Provider에 그대로 호출하면 무의미한 실패가
// 발생하므로 사전 차단 시 곧바로 fallback으로 우회한다. 차단 정보가 누락된
// 경우(서버리스 인스턴스 차이)는 이전 동작(직접 호출 후 실패 시 fallback)과
// 동일하게 작동한다.

function preflightFallbackIfQuotaBlocked(
  primaryModelId: string,
  fallbackModelId: string | undefined
): string | null {
  if (!fallbackModelId) return null;
  const provider = inferProviderFromModelId(primaryModelId);
  if (isQuotaExceeded(provider)) {
    console.log(
      `[Gateway] Provider ${provider} pre-blocked; using fallback ${fallbackModelId}`
    );
    return fallbackModelId;
  }
  return null;
}

// -----------------------------------------------------------------------------
// Public: generateText
// -----------------------------------------------------------------------------

/**
 * LLM Gateway - 통합 텍스트 생성 API
 *
 * @description
 * 모델 ID를 기반으로 적절한 Provider를 선택하고 텍스트를 생성합니다.
 * - [2026-01-17] Primary 모델 실패 시 fallback 자동 재시도
 * - [2026-05-03] 에러 LLMError로 정규화, Quota/Rate-Limit Provider 단위 차단,
 *                실패는 error-log/external/llm-* 도메인에 구조화 기록
 *
 * @param prompt - 생성 프롬프트
 * @param options - 생성 옵션 (모델, 토큰 제한, context 등)
 * @returns LLM 응답
 * @throws 사용자 친화 메시지를 가진 Error (UI 직접 노출 가능)
 */
export async function generateText(
  prompt: string,
  options: LLMGenerateOptions = {}
): Promise<LLMResponse> {
  const modelId = options.model || getDefaultModel();
  const context = options.context as LLMUsageContext | undefined;
  const fallbackModelId = context ? getFallbackModel(context) : undefined;
  const startTime = Date.now();

  // 1) Quota 사전 차단 시 즉시 fallback 사용
  const preflighted = preflightFallbackIfQuotaBlocked(modelId, fallbackModelId);
  if (preflighted) {
    try {
      const provider = getProviderByModel(preflighted);
      const result = await provider.generateText(prompt, {
        ...options,
        model: preflighted,
      });
      recordFallbackOutcome(preflighted, context, "success");
      recordPerf(context, preflighted, startTime, true, true);
      return result;
    } catch (fallbackError) {
      recordFallbackOutcome(preflighted, context, "failure", fallbackError);
      const llmError = classifyLLMError(fallbackError);
      recordPerf(context, preflighted, startTime, false, true, llmError.type);
      throw new Error(getUserFriendlyMessage(llmError));
    }
  }

  // 2) 1차 시도 (Primary)
  try {
    const provider = getProviderByModel(modelId);
    const result = await provider.generateText(prompt, {
      ...options,
      model: modelId,
    });
    recordPerf(context, modelId, startTime, true, false);
    return result;
  } catch (primaryError) {
    const llmError = recordPrimaryFailure(modelId, context, primaryError);

    // 3) Fallback이 정의되어 있으면 재시도. 비-재시도성 에러는 fallback 의미가
    //    없는 경우(CONTEXT_TOO_LONG/INVALID_API_KEY)이지만 모델별 정책 차이를
    //    고려해 일단 시도한다. 실패해도 동일한 사용자 친화 메시지를 던진다.
    if (fallbackModelId) {
      console.warn(`[Gateway] Primary model (${modelId}) failed:`, primaryError);
      console.log(`[Gateway] Using fallback model: ${fallbackModelId}`);
      try {
        const fallbackProvider = getProviderByModel(fallbackModelId);
        const result = await fallbackProvider.generateText(prompt, {
          ...options,
          model: fallbackModelId,
        });
        recordFallbackOutcome(fallbackModelId, context, "success");
        recordPerf(context, fallbackModelId, startTime, true, true);
        return result;
      } catch (fallbackError) {
        recordFallbackOutcome(fallbackModelId, context, "failure", fallbackError);
        const fbError = classifyLLMError(fallbackError);
        recordPerf(
          context,
          fallbackModelId,
          startTime,
          false,
          true,
          fbError.type
        );
        throw new Error(getUserFriendlyMessage(fbError));
      }
    }

    // 4) Fallback 없음 — 사용자 친화 메시지로 변환하여 throw
    recordPerf(context, modelId, startTime, false, false, llmError.type);
    throw new Error(getUserFriendlyMessage(llmError));
  }
}

// -----------------------------------------------------------------------------
// Public: generateTextStream
// -----------------------------------------------------------------------------

/**
 * LLM Gateway - 통합 스트리밍 API
 *
 * @description
 * 스트리밍 경로는 generator 특성상 catch 블록 안에서 yield* 를 다시 던질 때
 * 생성자 진행 상태가 분기된다. 따라서 generateText와 동일한 에러 분류·로깅
 * 정책을 유지하되, 사용자 친화 메시지로 변환된 Error를 마지막에 throw한다.
 */
export async function* generateTextStream(
  prompt: string,
  options: LLMGenerateOptions = {}
): AsyncGenerator<LLMStreamChunk> {
  const modelId = options.model || getDefaultModel();
  const context = options.context as LLMUsageContext | undefined;
  const fallbackModelId = context ? getFallbackModel(context) : undefined;

  // 1) Quota 사전 차단 시 fallback 직접 사용
  const preflighted = preflightFallbackIfQuotaBlocked(modelId, fallbackModelId);
  if (preflighted) {
    try {
      const provider = getProviderByModel(preflighted);
      yield* provider.generateStream(prompt, {
        ...options,
        model: preflighted,
      });
      recordFallbackOutcome(preflighted, context, "success");
      return;
    } catch (fallbackError) {
      recordFallbackOutcome(preflighted, context, "failure", fallbackError);
      const llmError = classifyLLMError(fallbackError);
      throw new Error(getUserFriendlyMessage(llmError));
    }
  }

  // 2) Primary 시도
  try {
    const provider = getProviderByModel(modelId);
    yield* provider.generateStream(prompt, { ...options, model: modelId });
  } catch (primaryError) {
    const llmError = recordPrimaryFailure(modelId, context, primaryError);

    if (fallbackModelId) {
      console.warn(`[Gateway] Primary model (${modelId}) failed:`, primaryError);
      console.log(`[Gateway] Retrying with fallback model: ${fallbackModelId}`);
      try {
        const fallbackProvider = getProviderByModel(fallbackModelId);
        yield* fallbackProvider.generateStream(prompt, {
          ...options,
          model: fallbackModelId,
        });
        recordFallbackOutcome(fallbackModelId, context, "success");
        return;
      } catch (fallbackError) {
        recordFallbackOutcome(fallbackModelId, context, "failure", fallbackError);
        const fbError = classifyLLMError(fallbackError);
        throw new Error(getUserFriendlyMessage(fbError));
      }
    }

    throw new Error(getUserFriendlyMessage(llmError));
  }
}

// -----------------------------------------------------------------------------
// Public: 가용성 점검
// -----------------------------------------------------------------------------

/**
 * LLM 사용 가능 여부 확인
 *
 * @description
 * 특정 모델 또는 기본 모델의 Provider가 사용 가능한 상태인지 확인합니다.
 *
 * @param modelId - 확인할 모델 ID (선택 사항)
 * @returns 사용 가능 여부
 */
export function isLLMAvailable(modelId?: string): boolean {
  const id = modelId || getDefaultModel();
  const config = getModelConfig(id);

  if (!config) return false;

  try {
    const provider = getProviderByModel(id);
    return provider.isAvailable();
  } catch {
    return false;
  }
}

// [HEALTH AUDIT] 순환 의존성 해소: client.ts → utils.ts로 직접 참조
export { estimateLLMTokenCount } from "./utils";
