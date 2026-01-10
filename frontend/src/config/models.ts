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
  | "reasoning"
  | "thinking"
  | "search-grounding"
  | "code-execution";

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
  /** 입력 컨텍스트 윈도우 크기 (참고용) */
  inputContextWindow?: number;
  /** 시스템 기본 모델 여부 */
  isDefault?: boolean;
  /** 서비스 티어 (무료/유료/개발자 구분용) */
  tier?: "free" | "premium" | "developer";
  /** 모델 활성화 여부 */
  enabled?: boolean;
}

// =============================================================================
// 모델 레지스트리 데이터
// =============================================================================

/**
 * 서비스에서 지원하는 모든 LLM 모델 목록
 * @remarks `as const satisfies`로 타입 안전성 강화 (v2.0)
 */
export const MODEL_REGISTRY = {
  // ---------------------------------------------------------------------------
  // Google Gemini 모델
  // ---------------------------------------------------------------------------
  "gemini-1.5-flash-002": {
    provider: "gemini",
    displayName: "gemini-1.5-flash-002",
    capabilities: [
      "text-generation",
      "streaming",
      "vision",
    ],
    costPerInputToken: 0.000000075,
    costPerOutputToken: 0.0000003,
    maxTokens: 8192,
    inputContextWindow: 1048576,
    tier: "free",
    enabled: true,
  },
  "gemini-3-flash-preview": {
    provider: "gemini",
    displayName: "Gemini 3.0 Flash Preview",
    capabilities: [
      "text-generation",
      "streaming",
      "thinking",
      "search-grounding",
      "code-execution",
    ],
    costPerInputToken: 0.0000005,
    costPerOutputToken: 0.000003,
    maxTokens: 65536,
    inputContextWindow: 1048576,
    isDefault: true,
    tier: "developer",
    enabled: true,
  },
  "gemini-3-pro-preview": {
    provider: "gemini",
    displayName: "Gemini 3 Pro Preview",
    capabilities: ["text-generation", "streaming", "reasoning"],
    costPerInputToken: 0.00125,
    costPerOutputToken: 0.005,
    maxTokens: 32768,
    tier: "premium",
    enabled: true,
  },

  // ---------------------------------------------------------------------------
  // OpenAI 모델
  // ---------------------------------------------------------------------------
  "gpt-5.2-2025-12-11": {
    provider: "openai",
    displayName: "GPT-5.2",
    capabilities: [
      "text-generation",
      "vision",
      "streaming",
      "reasoning",
      "thinking",
      "search-grounding",
      "code-execution",
    ],
    costPerInputToken: 0.00000175,
    costPerOutputToken: 0.000014,
    maxTokens: 128000,
    inputContextWindow: 400000,
    tier: "premium",
    enabled: true,
  },
  "gpt-5-mini-2025-08-07": {
    provider: "openai",
    displayName: "GPT-5 mini",
    capabilities: ["text-generation", "vision", "streaming"],
    costPerInputToken: 0.00000025,
    costPerOutputToken: 0.000002,
    maxTokens: 128000,
    inputContextWindow: 400000,
    tier: "free",
    enabled: true,
  },

  // ---------------------------------------------------------------------------
  // Anthropic 모델
  // ---------------------------------------------------------------------------
  "claude-4.5-opus-20251124": {
    provider: "anthropic",
    displayName: "Claude 4.5 Opus",
    capabilities: ["text-generation", "vision", "streaming", "reasoning"],
    costPerInputToken: 0.000005,
    costPerOutputToken: 0.000025,
    maxTokens: 128000,
    inputContextWindow: 200000,
    tier: "premium",
    enabled: true,
  },
  "claude-4.5-sonnet-20250929": {
    provider: "anthropic",
    displayName: "Claude 4.5 Sonnet",
    capabilities: ["text-generation", "vision", "streaming"],
    costPerInputToken: 0.000003,
    costPerOutputToken: 0.000015,
    maxTokens: 128000,
    inputContextWindow: 200000,
    tier: "premium",
    enabled: true,
  },
  "claude-4.5-haiku-20251015": {
    provider: "anthropic",
    displayName: "Claude 4.5 Haiku",
    capabilities: ["text-generation", "streaming"],
    costPerInputToken: 0.000001,
    costPerOutputToken: 0.000005,
    maxTokens: 128000,
    inputContextWindow: 200000,
    tier: "free",
    enabled: true,
  },
};

// =============================================================================
// [v2.0] 타입 안전성 강화 - ValidModelId 타입
// =============================================================================

/**
 * MODEL_REGISTRY에 등록된 유효한 모델 ID 타입
 * @description 이 타입을 사용하면 잘못된 모델 ID 입력 시 컴파일 에러 발생
 */
export type ValidModelId = keyof typeof MODEL_REGISTRY;

/**
 * [v2.0] 주어진 문자열이 유효한 모델 ID인지 확인 (Type Guard)
 * @param id - 검사할 모델 ID 문자열
 * @returns id가 ValidModelId 타입인지 여부
 * @example
 * if (isValidModelId(modelId)) {
 *   // modelId가 ValidModelId로 타입 추론됨
 * }
 */
export function isValidModelId(id: string): id is ValidModelId {
  return Object.hasOwn(MODEL_REGISTRY, id);
}

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
  // [v2.0] 타입 단언으로 string 인덱싱 허용 (하위 호환성)
  return (MODEL_REGISTRY as Record<string, ModelConfig>)[modelId];
}

/**
 * 시스템의 기본 모델 ID를 가져옵니다.
 * 
 * @returns 기본 모델 ID (없을 경우 gemini-3-flash-preview 반환)
 */
export function getDefaultModelId(): string {
  // [v2.0] 타입 단언으로 Object.entries 타입 추론 허용
  const registry = MODEL_REGISTRY as Record<string, ModelConfig>;
  const defaultEntry = Object.entries(registry).find(
    ([_, config]) => config.isDefault
  );
  return defaultEntry ? defaultEntry[0] : "gemini-3-flash-preview";
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
  // [v2.0] 타입 단언으로 string 인덱싱 허용 (하위 호환성)
  const config = (MODEL_REGISTRY as Record<string, ModelConfig>)[modelId];
  if (!config) return 0;
  return inputTokens * config.costPerInputToken + outputTokens * config.costPerOutputToken;
}
