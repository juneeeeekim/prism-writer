// =============================================================================
// PRISM Writer - Anthropic LLM Provider
// =============================================================================
// 파일: frontend/src/lib/llm/providers/anthropic.ts
// 역할: Anthropic API를 사용한 LLMProvider 구현
// =============================================================================

import Anthropic from "@anthropic-ai/sdk";
import { LLMProvider, LLMProviderError } from "./base";
import {
  LLMGenerateOptions,
  LLMResponse,
  LLMStreamChunk,
  estimateLLMTokenCount,
} from "../client";
import {
  getModelsByProvider,
  MODEL_REGISTRY,
  ModelConfig,
  getDefaultModelId,
} from "@/config/models";

/**
 * Anthropic Provider 구현체
 */
export class AnthropicProvider implements LLMProvider {
  readonly name = "anthropic";
  private client: Anthropic | null = null;

  /**
   * Anthropic 클라이언트 초기화 (지연 초기화)
   */
  private getClient(): Anthropic {
    if (!this.client) {
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        throw new LLMProviderError(
          "anthropic",
          "API_KEY_MISSING",
          "ANTHROPIC_API_KEY 환경 변수가 설정되지 않았습니다.",
          false
        );
      }
      this.client = new Anthropic({ apiKey });
    }
    return this.client;
  }

  /**
   * 텍스트 생성 (비스트리밍)
   */
  async generateText(
    prompt: string,
    options: LLMGenerateOptions = {}
  ): Promise<LLMResponse> {
    const modelId = options.model || getDefaultModelId();
    const client = this.getClient();

    // =========================================================================
    // [v3.0] Jemiel Ensemble Strategy - P3-02 (2026-01-14)
    // Anthropic은 top_k 파라미터를 지원함 - 조건부 전달
    // =========================================================================
    const {
      maxOutputTokens = 4096,
      temperature = 0.3,
      topP = 1.0,
      topK, // [v3.0] Anthropic top_k 지원
    } = options;

    try {
      const response = await client.messages.create({
        model: modelId,
        messages: [{ role: "user", content: prompt }],
        max_tokens: maxOutputTokens,
        temperature,
        top_p: topP,
        ...(topK !== undefined && { top_k: topK }), // [v3.0] 조건부 추가
      });

      // Anthropic response content is an array of blocks
      const text = response.content
        .filter((block) => block.type === "text")
        .map((block) => (block as any).text)
        .join("");

      if (!text) {
        throw new LLMProviderError(
          "anthropic",
          "EMPTY_RESPONSE",
          "LLM 응답이 비어있습니다.",
          true
        );
      }

      return {
        text,
        tokensUsed: response.usage.input_tokens + response.usage.output_tokens,
        finishReason: response.stop_reason || "UNKNOWN",
      };
    } catch (error) {
      if (error instanceof LLMProviderError) throw error;
      
      const message = error instanceof Error ? error.message : String(error);
      throw new LLMProviderError(
        "anthropic",
        "GENERATION_FAILED",
        `텍스트 생성 실패: ${message}`,
        true
      );
    }
  }

  /**
   * 텍스트 생성 (스트리밍)
   */
  async *generateStream(
    prompt: string,
    options: LLMGenerateOptions = {}
  ): AsyncGenerator<LLMStreamChunk> {
    const modelId = options.model || getDefaultModelId();
    const client = this.getClient();

    // =========================================================================
    // [v3.0] Jemiel Ensemble Strategy - P3-02 (2026-01-14)
    // Anthropic은 top_k 파라미터를 지원함 - 조건부 전달
    // =========================================================================
    const {
      maxOutputTokens = 4096,
      temperature = 0.3,
      topP = 1.0,
      topK, // [v3.0] Anthropic top_k 지원
    } = options;

    try {
      const stream = await client.messages.create({
        model: modelId,
        messages: [{ role: "user", content: prompt }],
        max_tokens: maxOutputTokens,
        temperature,
        top_p: topP,
        ...(topK !== undefined && { top_k: topK }), // [v3.0] 조건부 추가
        stream: true,
      });

      for await (const event of stream) {
        if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
          yield { text: event.delta.text, done: false };
        }
      }

      yield { text: "", done: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new LLMProviderError(
        "anthropic",
        "STREAMING_FAILED",
        `스트리밍 생성 실패: ${message}`,
        true
      );
    }
  }

  /**
   * 사용 가능 여부 확인
   */
  isAvailable(): boolean {
    return !!process.env.ANTHROPIC_API_KEY;
  }

  /**
   * 지원 모델 목록
   */
  getSupportedModels(): ModelConfig[] {
    // [v2.0] 타입 단언으로 string 인덱싱 허용
    const registry = MODEL_REGISTRY as Record<string, ModelConfig>;
    return getModelsByProvider("anthropic")
      .map((id) => registry[id])
      .filter((config): config is ModelConfig => !!config);
  }
}
