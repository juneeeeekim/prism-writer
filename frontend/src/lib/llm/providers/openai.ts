// =============================================================================
// PRISM Writer - OpenAI LLM Provider
// =============================================================================
// 파일: frontend/src/lib/llm/providers/openai.ts
// 역할: OpenAI API를 사용한 LLMProvider 구현
// =============================================================================


import OpenAI from "openai";
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
  getModelConfig, // [FIX] Import getModelConfig
} from "@/config/models";

/**
 * OpenAI Provider 구현체
 */
export class OpenAIProvider implements LLMProvider {
  readonly name = "openai";
  private client: OpenAI | null = null;

  /**
   * OpenAI 클라이언트 초기화 (지연 초기화)
   */
  private getClient(): OpenAI {
    if (!this.client) {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        throw new LLMProviderError(
          "openai",
          "API_KEY_MISSING",
          "OPENAI_API_KEY 환경 변수가 설정되지 않았습니다.",
          false
        );
      }
      this.client = new OpenAI({ apiKey });
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
    // [v3.0] Jemiel Ensemble Strategy - P3-01 (2026-01-14)
    // OpenAI는 top_k 파라미터를 지원하지 않으므로 의도적으로 무시
    // =========================================================================
    const {
      maxOutputTokens = 4096,
      temperature = 0.3,
      topP = 1.0,
      topK, // [v3.0] OpenAI 미지원 - 의도적 무시 (API 호출에 전달 안 함)
    } = options;

    // [v3.2] Fix: Check capabilities for reasoning models (e.g. gpt-5, o1, o3)
    const config = getModelConfig(modelId);
    const hasReasoningCap = config?.capabilities.includes('reasoning') || config?.capabilities.includes('thinking');
    // Safety check for legacy models or unregistered fallback usage
    const isLegacyO1 = modelId.startsWith('o1') || modelId.startsWith('o3');
    
    // Use max_completion_tokens if model is reasoning/thinking type
    const useCompletionTokens = hasReasoningCap || isLegacyO1;

    const tokenParam = useCompletionTokens 
      ? { max_completion_tokens: maxOutputTokens } 
      : { max_tokens: maxOutputTokens };

    try {
      const response = await client.chat.completions.create({
        model: modelId,
        messages: [{ role: "user", content: prompt }],
        ...tokenParam,
        temperature,
        top_p: topP,
      });

      const text = response.choices[0]?.message?.content;

      if (text === null || text === undefined) {
        throw new LLMProviderError(
          "openai",
          "EMPTY_RESPONSE",
          "LLM 응답이 비어있습니다.",
          true
        );
      }

      return {
        text,
        tokensUsed: response.usage?.total_tokens || (estimateLLMTokenCount(prompt) + estimateLLMTokenCount(text)),
        finishReason: response.choices[0]?.finish_reason || "UNKNOWN",
      };
    } catch (error) {
      if (error instanceof LLMProviderError) throw error;
      
      const message = error instanceof Error ? error.message : String(error);
      throw new LLMProviderError(
        "openai",
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
    // [v3.0] Jemiel Ensemble Strategy - P3-01 (2026-01-14)
    // OpenAI는 top_k 파라미터를 지원하지 않으므로 의도적으로 무시
    // =========================================================================
    const {
      maxOutputTokens = 4096,
      temperature = 0.3,
      topP = 1.0,
      topK, // [v3.0] OpenAI 미지원 - 의도적 무시 (API 호출에 전달 안 함)
    } = options;

    // [v3.2] Fix: Check capabilities for reasoning models (e.g. gpt-5, o1, o3)
    const config = getModelConfig(modelId);
    const hasReasoningCap = config?.capabilities.includes('reasoning') || config?.capabilities.includes('thinking');
    // Safety check for legacy models or unregistered fallback usage
    const isLegacyO1 = modelId.startsWith('o1') || modelId.startsWith('o3');
    
    // Use max_completion_tokens if model is reasoning/thinking type
    const useCompletionTokens = hasReasoningCap || isLegacyO1;

    const tokenParam = useCompletionTokens 
      ? { max_completion_tokens: maxOutputTokens } 
      : { max_tokens: maxOutputTokens };

    try {
      const stream = await client.chat.completions.create({
        model: modelId,
        messages: [{ role: "user", content: prompt }],
        ...tokenParam,
        temperature,
        top_p: topP,
        stream: true,
      });

      for await (const chunk of stream) {
        const text = chunk.choices[0]?.delta?.content || "";
        if (text) {
          yield { text, done: false };
        }
      }

      yield { text: "", done: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new LLMProviderError(
        "openai",
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
    return !!process.env.OPENAI_API_KEY;
  }

  /**
   * 지원 모델 목록
   */
  getSupportedModels(): ModelConfig[] {
    // [v2.0] 타입 단언으로 string 인덱싱 허용
    const registry = MODEL_REGISTRY as Record<string, ModelConfig>;
    return getModelsByProvider("openai")
      .map((id) => registry[id])
      .filter((config): config is ModelConfig => !!config);
  }
}
