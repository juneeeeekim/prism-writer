// =============================================================================
// PRISM Writer - LLM Configuration Module
// =============================================================================
// 파일: frontend/src/config/llm.config.ts
// 역할: 환경 변수 기반의 LLM 설정 로드 및 제공
// =============================================================================

import { getDefaultModelId } from "./models";

/**
 * 활성화된 LLM Provider 목록을 가져옵니다.
 * 
 * @description
 * 1. ENABLED_PROVIDERS 환경 변수가 있으면 해당 값을 사용합니다.
 * 2. 없으면 API 키가 설정된 Provider를 자동으로 감지합니다.
 * 3. 모두 없으면 기본값으로 ['gemini']를 반환합니다.
 * 
 * @returns 활성화된 Provider 이름 배열
 */
export function getEnabledProviders(): string[] {
  const envValue = process.env.ENABLED_PROVIDERS;
  
  if (envValue) {
    return envValue.split(",").map((p) => p.trim().toLowerCase());
  }

  // 자동 감지 로직
  const providers: string[] = [];
  if (process.env.GOOGLE_API_KEY) providers.push("gemini");
  if (process.env.OPENAI_API_KEY) providers.push("openai");
  if (process.env.ANTHROPIC_API_KEY) providers.push("anthropic");

  // 최소한 하나는 반환 (기본값)
  return providers.length > 0 ? providers : ["gemini"];
}

/**
 * 시스템 기본 모델 ID를 가져옵니다.
 * 
 * @description
 * 1. DEFAULT_MODEL 환경 변수가 있으면 해당 값을 사용합니다.
 * 2. 없으면 모델 레지스트리의 기본값을 사용합니다.
 * 
 * @returns 기본 모델 ID
 */
export function getDefaultModel(): string {
  return process.env.DEFAULT_MODEL || getDefaultModelId();
}

/**
 * 특정 Provider의 API 키를 가져옵니다.
 * 
 * @param provider - Provider 이름
 * @returns API 키 또는 undefined
 */
export function getProviderApiKey(provider: string): string | undefined {
  switch (provider.toLowerCase()) {
    case "gemini":
      return process.env.GOOGLE_API_KEY;
    case "openai":
      return process.env.OPENAI_API_KEY;
    case "anthropic":
      return process.env.ANTHROPIC_API_KEY;
    default:
      return undefined;
  }
}

/**
 * 특정 Provider가 활성화되어 있는지 확인합니다.
 */
export function isProviderEnabled(provider: string): boolean {
  return getEnabledProviders().includes(provider.toLowerCase());
}
