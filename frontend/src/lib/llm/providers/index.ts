// =============================================================================
// PRISM Writer - LLM Provider Factory
// =============================================================================
// 파일: frontend/src/lib/llm/providers/index.ts
// 역할: Provider 인스턴스 관리 및 팩토리 함수 제공
// =============================================================================

import { LLMProvider } from "./base";
import { GeminiProvider } from "./gemini";
import { OpenAIProvider } from "./openai";
import { AnthropicProvider } from "./anthropic";
import { getModelConfig } from "@/config/models";

// Provider 인스턴스 캐시 (싱글톤 패턴)
const providerCache: Map<string, LLMProvider> = new Map();

/**
 * Provider 이름으로 Provider 인스턴스를 가져옵니다.
 * 
 * @param providerName - Provider 식별자 ('gemini', 'openai' 등)
 * @returns LLMProvider 인스턴스
 * @throws 지원하지 않는 Provider일 경우 에러
 */
export function getProvider(providerName: string): LLMProvider {
  if (!providerCache.has(providerName)) {
    switch (providerName) {
      case "gemini":
        providerCache.set(providerName, new GeminiProvider());
        break;
      case "openai":
        providerCache.set(providerName, new OpenAIProvider());
        break;
      case "anthropic":
        providerCache.set(providerName, new AnthropicProvider());
        break;
      default:
        throw new Error(`지원하지 않는 LLM Provider입니다: ${providerName}`);
    }
  }
  return providerCache.get(providerName)!;
}

/**
 * 모델 ID로 해당 모델을 지원하는 Provider 인스턴스를 가져옵니다.
 * 
 * @param modelId - 모델 식별자
 * @returns LLMProvider 인스턴스
 * @throws 모델 정보를 찾을 수 없거나 지원하지 않는 Provider일 경우 에러
 */
export function getProviderByModel(modelId: string): LLMProvider {
  const config = getModelConfig(modelId);
  if (!config) {
    throw new Error(`알 수 없는 모델 ID입니다: ${modelId}`);
  }
  return getProvider(config.provider);
}

// 모든 Provider 관련 타입 및 클래스 내보내기
export * from "./base";
export * from "./gemini";
