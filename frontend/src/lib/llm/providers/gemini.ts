// =============================================================================
// PRISM Writer - Gemini LLM Provider
// =============================================================================
// 파일: frontend/src/lib/llm/providers/gemini.ts
// 역할: Google Gemini API를 사용한 LLMProvider 구현
// =============================================================================

import { GoogleGenerativeAI, GenerativeModel } from "@google/generative-ai";
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
 * Gemini Provider 구현체
 * 
 * @description
 * Google Generative AI SDK를 사용하여 텍스트 생성 및 스트리밍을 수행합니다.
 */
export class GeminiProvider implements LLMProvider {
  readonly name = "gemini";
  private client: GoogleGenerativeAI | null = null;

  /**
   * Gemini 클라이언트 초기화 (지연 초기화)
   */
  private getClient(): GoogleGenerativeAI {
    if (!this.client) {
      const apiKey = process.env.GOOGLE_API_KEY;
      if (!apiKey) {
        throw new LLMProviderError(
          "gemini",
          "API_KEY_MISSING",
          "GOOGLE_API_KEY 환경 변수가 설정되지 않았습니다.",
          false
        );
      }
      this.client = new GoogleGenerativeAI(apiKey);
    }
    return this.client;
  }

  /**
   * Gemini 모델 인스턴스 가져오기
   */
  private getModel(modelName: string): GenerativeModel {
    const client = this.getClient();
    return client.getGenerativeModel({ model: modelName });
  }

  /**
   * 텍스트 생성 (비스트리밍)
   */
  async generateText(
    prompt: string,
    options: LLMGenerateOptions = {}
  ): Promise<LLMResponse> {
    const modelId = options.model || getDefaultModelId();
    const genModel = this.getModel(modelId);

    const {
      maxOutputTokens = 4096,
      temperature = 0.3,
      topP = 0.95,
      topK, // [v3.0] Jemiel Strategy
    } = options;

    try {
      const result = await genModel.generateContent({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          maxOutputTokens,
          temperature,
          topP,
          topK,
        },
      });

      const response = result.response;
      const text = response.text();

      if (!text) {
        throw new LLMProviderError(
          "gemini",
          "EMPTY_RESPONSE",
          "LLM 응답이 비어있습니다.",
          true
        );
      }

      return {
        text,
        tokensUsed: estimateLLMTokenCount(prompt) + estimateLLMTokenCount(text),
        finishReason: response.candidates?.[0]?.finishReason || "UNKNOWN",
      };
    } catch (error) {
      if (error instanceof LLMProviderError) throw error;
      
      const message = error instanceof Error ? error.message : String(error);
      throw new LLMProviderError(
        "gemini",
        "GENERATION_FAILED",
        `텍스트 생성 실패: ${message}`,
        true // 대부분의 API 오류는 재시도 가능으로 간주
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
    const genModel = this.getModel(modelId);

    const {
      maxOutputTokens = 4096,
      temperature = 0.3,
      topP = 0.95,
      topK, // [v3.0] Jemiel Strategy
    } = options;

    try {
      const result = await genModel.generateContentStream({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          maxOutputTokens,
          temperature,
          topP,
          topK,
        },
      });

      for await (const chunk of result.stream) {
        const text = chunk.text();
        if (text) {
          yield { text, done: false };
        }
      }

      yield { text: "", done: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new LLMProviderError(
        "gemini",
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
    return !!process.env.GOOGLE_API_KEY;
  }

  /**
   * 지원 모델 목록
   */
  getSupportedModels(): ModelConfig[] {
    // [v2.0] 타입 단언으로 string 인덱싱 허용
    const registry = MODEL_REGISTRY as Record<string, ModelConfig>;
    return getModelsByProvider("gemini")
      .map((id) => registry[id])
      .filter((config): config is ModelConfig => !!config);
  }
}
