// =============================================================================
// PRISM Writer - LLM Client (Gemini API)
// =============================================================================
// 파일: frontend/src/lib/llm/client.ts
// 역할: Google Gemini API를 사용한 LLM 텍스트 생성
// =============================================================================

import { generateText as gatewayGenerateText, generateTextStream as gatewayGenerateTextStream, isLLMAvailable as gatewayIsLLMAvailable } from './gateway'
import type { LLMGenerateOptions, LLMResponse, LLMStreamChunk } from './types'

export type { LLMGenerateOptions, LLMResponse, LLMStreamChunk }

// =============================================================================
// Helper Functions — estimateLLMTokenCount는 ./utils.ts로 이동 (순환 의존성 해소)
// =============================================================================
export { estimateLLMTokenCount } from './utils'

// =============================================================================
// Main Functions (Deprecated - Redirected to Gateway)
// =============================================================================

/**
 * LLM 텍스트 생성 (비스트리밍)
 * 
 * @deprecated gateway.ts의 generateText 사용 권장
 * @description
 * 새 LLM Gateway로 요청을 전달합니다.
 */
export async function generateText(
  prompt: string,
  options: LLMGenerateOptions = {}
): Promise<LLMResponse> {
  return gatewayGenerateText(prompt, options)
}

/**
 * LLM 텍스트 스트리밍 생성
 * 
 * @deprecated gateway.ts의 generateTextStream 사용 권장
 * @description
 * 새 LLM Gateway로 요청을 전달합니다.
 */
export async function* generateTextStream(
  prompt: string,
  options: LLMGenerateOptions = {}
): AsyncGenerator<LLMStreamChunk> {
  yield* gatewayGenerateTextStream(prompt, options)
}

/**
 * LLM 사용 가능 여부 확인
 * 
 * @deprecated gateway.ts의 isLLMAvailable 사용 권장
 * @description
 * 새 LLM Gateway를 통해 사용 가능 여부를 확인합니다.
 */
export function isLLMAvailable(): boolean {
  return gatewayIsLLMAvailable()
}
