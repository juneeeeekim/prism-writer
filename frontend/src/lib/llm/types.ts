// =============================================================================
// PRISM Writer - LLM Types
// =============================================================================
// 파일: frontend/src/lib/llm/types.ts
// 역할: LLM 관련 공통 타입 정의
// =============================================================================

/** LLM 생성 옵션 */
export interface LLMGenerateOptions {
  /** 모델 이름 (예: gemini-2.0-flash) */
  model?: string;
  /** 최대 출력 토큰 수 */
  maxOutputTokens?: number;
  /** 온도 (0~1, 낮을수록 결정적) */
  temperature?: number;
  /** Top-P (확률 기반 샘플링) */
  topP?: number;
  /** 스트리밍 여부 */
  stream?: boolean;
}

/** LLM 응답 */
export interface LLMResponse {
  /** 생성된 텍스트 */
  text: string;
  /** 사용된 토큰 수 (추정) */
  tokensUsed?: number;
  /** 완료 사유 */
  finishReason?: string;
}

/** 스트리밍 청크 */
export interface LLMStreamChunk {
  /** 청크 텍스트 */
  text: string;
  /** 완료 여부 */
  done: boolean;
}
