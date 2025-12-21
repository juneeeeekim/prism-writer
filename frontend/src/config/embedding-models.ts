// =============================================================================
// PRISM Writer - Embedding Model Registry
// =============================================================================
// 파일: frontend/src/config/embedding-models.ts
// 역할: 서비스에서 사용하는 모든 임베딩 모델의 중앙 설정 및 관리
// =============================================================================

/**
 * 임베딩 모델 설정 인터페이스
 */
export interface EmbeddingConfig {
  /** Provider 식별자 (예: gemini, openai) */
  provider: "gemini" | "openai";
  /** 벡터 차원 수 */
  dimensions: number;
  /** 토큰당 비용 (USD) */
  costPerToken: number;
  /** 시스템 기본 임베딩 모델 여부 */
  isDefault?: boolean;
  /** 모델 활성화 여부 */
  enabled?: boolean;
}

// =============================================================================
// 임베딩 모델 레지스트리 데이터
// =============================================================================

/**
 * 서비스에서 지원하는 모든 임베딩 모델 목록
 */
export const EMBEDDING_REGISTRY: Record<string, EmbeddingConfig> = {
  // ---------------------------------------------------------------------------
  // Google Gemini 임베딩 모델
  // ---------------------------------------------------------------------------
  "text-embedding-004": {
    provider: "gemini",
    dimensions: 768,
    costPerToken: 0.00001 / 1000, // $0.01 per 1M tokens -> $0.00001 per 1K tokens
    isDefault: true,
    enabled: true,
  },

  // ---------------------------------------------------------------------------
  // OpenAI 임베딩 모델 (향후 확장 대비)
  // ---------------------------------------------------------------------------
  "text-embedding-3-small": {
    provider: "openai",
    dimensions: 1536,
    costPerToken: 0.00002 / 1000, // $0.02 per 1M tokens
    enabled: false, // 아직 구현 전
  },
};
