// =============================================================================
// PRISM Writer - LLM Client (Gemini API)
// =============================================================================
// 파일: frontend/src/lib/llm/client.ts
// 역할: Google Gemini API를 사용한 LLM 텍스트 생성
// =============================================================================

import { GoogleGenerativeAI, GenerativeModel, GenerateContentStreamResult } from '@google/generative-ai'

// =============================================================================
// 타입 정의
// =============================================================================

/** LLM 생성 옵션 */
export interface LLMGenerateOptions {
  /** 모델 이름 (기본: gemini-2.0-flash) */
  model?: string
  /** 최대 출력 토큰 수 */
  maxOutputTokens?: number
  /** 온도 (0~1, 낮을수록 결정적) */
  temperature?: number
  /** Top-P (확률 기반 샘플링) */
  topP?: number
  /** 스트리밍 여부 */
  stream?: boolean
}

/** LLM 응답 */
export interface LLMResponse {
  /** 생성된 텍스트 */
  text: string
  /** 사용된 토큰 수 (추정) */
  tokensUsed?: number
  /** 완료 사유 */
  finishReason?: string
}

/** 스트리밍 청크 */
export interface LLMStreamChunk {
  /** 청크 텍스트 */
  text: string
  /** 완료 여부 */
  done: boolean
}

// =============================================================================
// 상수
// =============================================================================

/** 기본 Gemini 모델 */
const DEFAULT_MODEL = 'gemini-2.0-flash'

/** 기본 최대 출력 토큰 */
const DEFAULT_MAX_TOKENS = 4096

/** 기본 온도 */
const DEFAULT_TEMPERATURE = 0.3

/** 재시도 최대 횟수 */
const MAX_RETRIES = 3

/** 재시도 대기 시간 (ms) */
const RETRY_DELAY = 1000

// =============================================================================
// Gemini 클라이언트 초기화
// =============================================================================

let genAI: GoogleGenerativeAI | null = null

/**
 * Google Generative AI 클라이언트 가져오기 (지연 초기화)
 * 
 * @returns GoogleGenerativeAI 인스턴스
 * @throws API 키가 설정되지 않은 경우
 */
function getGenAIClient(): GoogleGenerativeAI {
  if (!genAI) {
    const apiKey = process.env.GOOGLE_API_KEY

    if (!apiKey) {
      throw new Error(
        'GOOGLE_API_KEY 환경 변수가 설정되지 않았습니다. ' +
        '.env.local 파일에 GOOGLE_API_KEY를 추가해주세요.'
      )
    }

    genAI = new GoogleGenerativeAI(apiKey)
  }

  return genAI
}

/**
 * Gemini 모델 인스턴스 가져오기
 * 
 * @param modelName - 모델 이름
 * @returns GenerativeModel 인스턴스
 */
function getModel(modelName: string = DEFAULT_MODEL): GenerativeModel {
  const client = getGenAIClient()
  return client.getGenerativeModel({ model: modelName })
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * 재시도 로직이 포함된 sleep 함수
 * 
 * @param ms - 대기 시간 (밀리초)
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * 텍스트의 토큰 수 추정 (대략적)
 * 
 * @param text - 텍스트
 * @returns 예상 토큰 수
 */
export function estimateLLMTokenCount(text: string): number {
  // 영어: ~4 chars/token, 한글: ~2 chars/token
  // 보수적으로 3으로 계산
  return Math.ceil(text.length / 3)
}

// =============================================================================
// Main Functions
// =============================================================================

/**
 * LLM 텍스트 생성 (비스트리밍)
 * 
 * @description
 * Gemini API를 사용하여 텍스트를 생성합니다.
 * 재시도 로직이 포함되어 있어 일시적인 오류에 대응합니다.
 * 
 * @param prompt - 생성 프롬프트
 * @param options - 생성 옵션
 * @returns LLM 응답
 * 
 * @example
 * ```typescript
 * const response = await generateText("안녕하세요, 자기소개를 해주세요.")
 * console.log(response.text)
 * ```
 */
export async function generateText(
  prompt: string,
  options: LLMGenerateOptions = {}
): Promise<LLMResponse> {
  if (!prompt || prompt.trim().length === 0) {
    throw new Error('프롬프트가 비어있습니다.')
  }

  const {
    model = DEFAULT_MODEL,
    maxOutputTokens = DEFAULT_MAX_TOKENS,
    temperature = DEFAULT_TEMPERATURE,
    topP = 0.95,
  } = options

  const genModel = getModel(model)
  let lastError: Error | null = null

  // ---------------------------------------------------------------------------
  // 재시도 로직
  // ---------------------------------------------------------------------------
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const result = await genModel.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          maxOutputTokens,
          temperature,
          topP,
        },
      })

      const response = result.response
      const text = response.text()

      if (!text) {
        throw new Error('LLM 응답이 비어있습니다.')
      }

      return {
        text,
        tokensUsed: estimateLLMTokenCount(prompt) + estimateLLMTokenCount(text),
        finishReason: response.candidates?.[0]?.finishReason || 'UNKNOWN',
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))

      // 마지막 시도가 아니면 재시도
      if (attempt < MAX_RETRIES - 1) {
        console.warn(`LLM 생성 실패 (${attempt + 1}/${MAX_RETRIES}), 재시도 중...`, error)
        await sleep(RETRY_DELAY * (attempt + 1)) // Exponential backoff
      }
    }
  }

  // 모든 재시도 실패
  throw new Error(`LLM 텍스트 생성 실패: ${lastError?.message}`)
}

/**
 * LLM 텍스트 스트리밍 생성
 * 
 * @description
 * Gemini API를 사용하여 텍스트를 스트리밍으로 생성합니다.
 * 실시간으로 응답을 받아 처리할 수 있습니다.
 * 
 * @param prompt - 생성 프롬프트
 * @param options - 생성 옵션
 * @returns AsyncIterable of LLMStreamChunk
 * 
 * @example
 * ```typescript
 * for await (const chunk of generateTextStream("장문의 글을 작성해주세요.")) {
 *   process.stdout.write(chunk.text)
 *   if (chunk.done) {
 *     console.log("\n완료!")
 *   }
 * }
 * ```
 */
export async function* generateTextStream(
  prompt: string,
  options: LLMGenerateOptions = {}
): AsyncGenerator<LLMStreamChunk> {
  if (!prompt || prompt.trim().length === 0) {
    throw new Error('프롬프트가 비어있습니다.')
  }

  const {
    model = DEFAULT_MODEL,
    maxOutputTokens = DEFAULT_MAX_TOKENS,
    temperature = DEFAULT_TEMPERATURE,
    topP = 0.95,
  } = options

  const genModel = getModel(model)

  try {
    const result: GenerateContentStreamResult = await genModel.generateContentStream({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        maxOutputTokens,
        temperature,
        topP,
      },
    })

    // ---------------------------------------------------------------------------
    // 스트리밍 응답 처리
    // ---------------------------------------------------------------------------
    for await (const chunk of result.stream) {
      const text = chunk.text()
      if (text) {
        yield { text, done: false }
      }
    }

    // 완료 신호
    yield { text: '', done: true }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    throw new Error(`LLM 스트리밍 생성 실패: ${errorMessage}`)
  }
}

/**
 * LLM 사용 가능 여부 확인
 * 
 * @description
 * API 키가 설정되어 있는지 확인합니다.
 * 
 * @returns API 키 설정 여부
 */
export function isLLMAvailable(): boolean {
  return !!process.env.GOOGLE_API_KEY
}
