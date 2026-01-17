// =============================================================================
// PRISM Writer - LLM Gateway
// =============================================================================
// 파일: frontend/src/lib/llm/gateway.ts
// 역할: 모든 LLM 요청의 단일 진입점 (Routing & Abstraction)
// 수정: 2026-01-17 - Gateway Level Fallback 지원 추가
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

/**
 * LLM Gateway - 통합 텍스트 생성 API
 *
 * @description
 * 모델 ID를 기반으로 적절한 Provider를 선택하고 텍스트를 생성합니다.
 * [2026-01-17] Primary 모델 실패 시 context에 해당하는 fallback 모델로 자동 재시도
 * 
 * @param prompt - 생성 프롬프트
 * @param options - 생성 옵션 (모델, 토큰 제한, context 등)
 * @returns LLM 응답
 */
export async function generateText(
  prompt: string,
  options: LLMGenerateOptions = {}
): Promise<LLMResponse> {
  const modelId = options.model || getDefaultModel();
  
  // ===========================================================================
  // [2026-01-17] Fallback 모델 조회 (context가 있을 때만)
  // ===========================================================================
  const fallbackModelId = options.context 
    ? getFallbackModel(options.context as LLMUsageContext) 
    : undefined;
  
  try {
    const provider = getProviderByModel(modelId);
    return await provider.generateText(prompt, { ...options, model: modelId });
  } catch (primaryError) {
    // =========================================================================
    // [2026-01-17] Primary 실패 시 Fallback으로 재시도
    // =========================================================================
    if (fallbackModelId) {
      console.warn(`[Gateway] Primary model (${modelId}) failed:`, primaryError);
      console.log(`[Gateway] Using fallback model: ${fallbackModelId}`);
      
      const fallbackProvider = getProviderByModel(fallbackModelId);
      return await fallbackProvider.generateText(prompt, { ...options, model: fallbackModelId });
    }
    // Fallback 없으면 원래 에러 그대로 throw
    throw primaryError;
  }
}

/**
 * LLM Gateway - 통합 스트리밍 API
 * 
 * @description
 * 모델 ID를 기반으로 적절한 Provider를 선택하고 텍스트 스트림을 생성합니다.
 * [2026-01-17] Primary 모델 실패 시 context에 해당하는 fallback 모델로 자동 재시도
 */
export async function* generateTextStream(
  prompt: string,
  options: LLMGenerateOptions = {}
): AsyncGenerator<LLMStreamChunk> {
  const modelId = options.model || getDefaultModel();
  
  // ===========================================================================
  // [2026-01-17] Fallback 모델 조회 (context가 있을 때만)
  // ===========================================================================
  const fallbackModelId = options.context 
    ? getFallbackModel(options.context as LLMUsageContext) 
    : undefined;
  
  try {
    const provider = getProviderByModel(modelId);
    yield* provider.generateStream(prompt, { ...options, model: modelId });
  } catch (primaryError) {
    // =========================================================================
    // [2026-01-17] Primary 실패 시 Fallback으로 재시도
    // =========================================================================
    if (fallbackModelId) {
      console.warn(`[Gateway] Primary model (${modelId}) failed:`, primaryError);
      console.log(`[Gateway] Retrying with fallback model: ${fallbackModelId}`);
      
      const fallbackProvider = getProviderByModel(fallbackModelId);
      yield* fallbackProvider.generateStream(prompt, { ...options, model: fallbackModelId });
    } else {
      // Fallback 없으면 원래 에러 그대로 throw
      throw primaryError;
    }
  }
}

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

// 기존 client.ts 호환성을 위한 토큰 계산 유틸리티 재내보내기
export { estimateLLMTokenCount } from "./client";
