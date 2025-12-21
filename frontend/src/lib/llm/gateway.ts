// =============================================================================
// PRISM Writer - LLM Gateway
// =============================================================================
// 파일: frontend/src/lib/llm/gateway.ts
// 역할: 모든 LLM 요청의 단일 진입점 (Routing & Abstraction)
// =============================================================================

import { getProviderByModel } from "./providers";
import { getDefaultModel } from "@/config/llm.config";
import { getModelConfig } from "@/config/models";
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
 * 모델 ID가 지정되지 않으면 시스템 기본 모델을 사용합니다.
 * 
 * @param prompt - 생성 프롬프트
 * @param options - 생성 옵션 (모델, 토큰 제한 등)
 * @returns LLM 응답
 */
export async function generateText(
  prompt: string,
  options: LLMGenerateOptions = {}
): Promise<LLMResponse> {
  const modelId = options.model || getDefaultModel();
  const provider = getProviderByModel(modelId);

  return provider.generateText(prompt, { ...options, model: modelId });
}

/**
 * LLM Gateway - 통합 스트리밍 API
 * 
 * @description
 * 모델 ID를 기반으로 적절한 Provider를 선택하고 텍스트 스트림을 생성합니다.
 */
export async function* generateTextStream(
  prompt: string,
  options: LLMGenerateOptions = {}
): AsyncGenerator<LLMStreamChunk> {
  const modelId = options.model || getDefaultModel();
  const provider = getProviderByModel(modelId);

  yield* provider.generateStream(prompt, { ...options, model: modelId });
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
