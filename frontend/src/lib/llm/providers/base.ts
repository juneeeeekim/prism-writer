// =============================================================================
// PRISM Writer - LLM Provider Base Interface
// =============================================================================
// 파일: frontend/src/lib/llm/providers/base.ts
// 역할: 모든 LLM Provider가 구현해야 하는 공통 인터페이스 및 에러 정의
// =============================================================================

import type {
  LLMGenerateOptions,
  LLMResponse,
  LLMStreamChunk,
} from "../client";
import type { ModelConfig } from "@/config/models";

/**
 * LLM Provider 추상 인터페이스
 *
 * @description
 * 모든 LLM Provider(Gemini, OpenAI, Anthropic 등)가 구현해야 하는 공통 인터페이스입니다.
 * 이를 통해 상위 레이어(Gateway)는 구체적인 구현에 의존하지 않고 모델을 전환할 수 있습니다.
 */
export interface LLMProvider {
  /** Provider 이름 (예: 'gemini', 'openai') */
  readonly name: string;

  /**
   * 텍스트 생성 (비스트리밍)
   * 
   * @param prompt - 생성 프롬프트
   * @param options - 생성 옵션 (모델, 토큰 제한 등)
   * @returns LLM 응답 (텍스트, 토큰 사용량 등)
   * @throws LLMProviderError - API 호출 실패 시
   */
  generateText(
    prompt: string,
    options?: LLMGenerateOptions
  ): Promise<LLMResponse>;

  /**
   * 텍스트 생성 (스트리밍)
   * 
   * @param prompt - 생성 프롬프트
   * @param options - 생성 옵션
   * @returns AsyncGenerator of LLMStreamChunk
   */
  generateStream(
    prompt: string,
    options?: LLMGenerateOptions
  ): AsyncGenerator<LLMStreamChunk>;

  /**
   * Provider 사용 가능 여부 확인
   * 
   * @description
   * 해당 Provider의 API 키가 설정되어 있고, 활성화 상태인지 확인합니다.
   * 
   * @returns 사용 가능 여부
   */
  isAvailable(): boolean;

  /**
   * 해당 Provider가 지원하는 모델 목록 조회
   * 
   * @returns ModelConfig 배열
   */
  getSupportedModels(): ModelConfig[];
}

/**
 * LLM Provider 전용 에러 클래스
 * 
 * @description
 * Provider 레벨에서 발생하는 에러를 표준화된 형식으로 캡슐화합니다.
 * 이를 통해 상위 레이어에서 재시도 여부 등을 결정할 수 있습니다.
 */
export class LLMProviderError extends Error {
  /**
   * @param provider - 에러가 발생한 Provider 이름
   * @param code - 에러 코드 (예: 'API_KEY_MISSING', 'RATE_LIMIT_EXCEEDED')
   * @param message - 에러 메시지
   * @param retryable - 재시도 가능 여부 (기본값: false)
   */
  constructor(
    public readonly provider: string,
    public readonly code: string,
    message: string,
    public readonly retryable: boolean = false
  ) {
    super(`[${provider}] ${message}`);
    this.name = "LLMProviderError";
    
    // Error 상속 시 프로토타입 체인 복구 (TypeScript 이슈 대응)
    Object.setPrototypeOf(this, LLMProviderError.prototype);
  }
}
