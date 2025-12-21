// =============================================================================
// PRISM Writer - LLM Model Registry
// =============================================================================
// 파일: frontend/src/config/models.ts
// 역할: 서비스에서 사용하는 모든 LLM 모델의 중앙 설정 및 관리
// =============================================================================

/**
 * 모델 기능 타입
 */
export type ModelCapability =
  | "text-generation"
  | "streaming"
  | "vision"
  | "reasoning";

/**
 * 모델 설정 인터페이스
 */
export interface ModelConfig {
  /** Provider 식별자 (예: gemini, openai, anthropic) */
  provider: "gemini" | "openai" | "anthropic";
  /** UI에 표시될 이름 */
  displayName: string;
  /** 모델이 지원하는 기능 목록 */
  capabilities: ModelCapability[];
  /** 입력 토큰당 비용 (USD / 1K tokens 기준 아님, 순수 토큰당 비용) */
  costPerInputToken: number;
  /** 출력 토큰당 비용 (USD / 1K tokens 기준 아님, 순수 토큰당 비용) */
  costPerOutputToken: number;
  /** 모델의 최대 컨텍스트 토큰 수 */
  maxTokens: number;
  /** 시스템 기본 모델 여부 */
  isDefault?: boolean;
  /** 서비스 티어 (무료/유료 사용자 구분용) */
  tier?: "free" | "premium";
  /** 모델 활성화 여부 */
  enabled?: boolean;
}

// =============================================================================
// 모델 레지스트리 데이터
// =============================================================================

/**
 * 서비스에서 지원하는 모든 LLM 모델 목록
 */
export const MODEL_REGISTRY: Record<string, ModelConfig> = {
  // ---------------------------------------------------------------------------
  // Google Gemini 모델
  // ---------------------------------------------------------------------------
  "gemini-2.0-flash": {
    provider: "gemini",
    displayName: "Gemini 2.0 Flash",
    capabilities: ["text-generation", "streaming"],
    costPerInputToken: 0.000075, // $0.075 per 1K tokens
    costPerOutputToken: 0.0003,   // $0.30 per 1K tokens
    maxTokens: 8192,
    isDefault: true,
    tier: "free",
    enabled: true,
  },
  "gemini-3-pro-preview": {
    provider: "gemini",
    displayName: "Gemini 3 Pro Preview",
    capabilities: ["text-generation", "streaming", "reasoning"],
    costPerInputToken: 0.00125,  // $1.25 per 1K tokens
    costPerOutputToken: 0.005,    // $5.00 per 1K tokens
    maxTokens: 32768,
    tier: "premium",
    enabled: true,
  },

  // ---------------------------------------------------------------------------
  // OpenAI 모델 (향후 확장 대비)
  // ---------------------------------------------------------------------------
  "gpt-4o": {
    provider: "openai",
    displayName: "GPT-4o",
    capabilities: ["text-generation", "vision", "streaming"],
    costPerInputToken: 0.005,
    costPerOutputToken: 0.015,
    maxTokens: 128000,
    tier: "premium",
    enabled: false, // 아직 구현 전이므로 비활성화
  },
};

// =============================================================================
// 유틸리티 함수
// =============================================================================

/**
 * 특정 모델의 설정을 가져옵니다.
 * 
 * @param modelId - 모델 식별자
 * @returns 모델 설정 또는 undefined
 */
export function getModelConfig(modelId: string): ModelConfig | undefined {
  return MODEL_REGISTRY[modelId];
}

/**
 * 시스템의 기본 모델 ID를 가져옵니다.
 * 
 * @returns 기본 모델 ID (없을 경우 gemini-2.0-flash 반환)
 */
export function getDefaultModelId(): string {
  const defaultEntry = Object.entries(MODEL_REGISTRY).find(
    ([_, config]) => config.isDefault
  );
  return defaultEntry ? defaultEntry[0] : "gemini-2.0-flash";
}

/**
 * 현재 활성화된 모든 모델 ID 목록을 가져옵니다.
 * 
 * @returns 활성화된 모델 ID 배열
 */
export function getEnabledModels(): string[] {
  return Object.entries(MODEL_REGISTRY)
    .filter(([_, config]) => config.enabled !== false)
    .map(([id]) => id);
}

/**
 * 특정 Provider가 제공하는 모델 ID 목록을 가져옵니다.
 * 
 * @param provider - Provider 이름
 * @returns 해당 Provider의 모델 ID 배열
 */
export function getModelsByProvider(provider: string): string[] {
  return Object.entries(MODEL_REGISTRY)
    .filter(([_, config]) => config.provider === provider)
    .map(([id]) => id);
}

/**
 * 모델별 예상 비용을 계산합니다.
 * 
 * @param modelId - 모델 식별자
 * @param inputTokens - 입력 토큰 수
 * @param outputTokens - 출력 토큰 수
 * @returns 예상 비용 (USD)
 */
export function estimateModelCost(
  modelId: string,
  inputTokens: number,
  outputTokens: number
): number {
  const config = MODEL_REGISTRY[modelId];
  if (!config) return 0;
  return inputTokens * config.costPerInputToken + outputTokens * config.costPerOutputToken;
}
