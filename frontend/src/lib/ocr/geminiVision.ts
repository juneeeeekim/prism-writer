// =============================================================================
// [P10-OCR-02] Gemini Vision 텍스트 추출 모듈
// =============================================================================
// 파일: frontend/src/lib/ocr/geminiVision.ts
// 역할: Gemini 1.5 Flash Vision API를 사용한 이미지 텍스트 추출
// 생성일: 2026-01-01
// =============================================================================
//
// [기술 스택]
// - Gemini 1.5 Flash: Google의 멀티모달 LLM
// - Vision 기능으로 이미지 내 텍스트 인식
// - 한글/영문 모두 높은 정확도
//
// [장점]
// - Tesseract.js보다 높은 정확도 (특히 복잡한 레이아웃)
// - 문맥을 이해하여 텍스트 추출
// - 표, 수식 등 구조화된 콘텐츠 인식
//
// [비용]
// - Gemini 1.5 Flash: $0.075/1M input tokens (이미지 포함)
// - 일반적인 문서 페이지: ~1,000 tokens
//
// =============================================================================

import { GoogleGenerativeAI } from '@google/generative-ai'
// P2-11-A: LLM 중앙 관리 마이그레이션 (2026-01-10)
import { getModelForUsage } from '@/config/llm-usage-map'

// =============================================================================
// 타입 정의
// =============================================================================

export interface VisionExtractionResult {
  success: boolean
  text: string
  error?: string
  tokensUsed?: number
  processingTime?: number
}

export interface VisionExtractionOptions {
  /** 추출 모드 */
  mode?: 'text-only' | 'structured' | 'detailed'
  /** 대상 언어 힌트 */
  languageHint?: string
  /** 최대 출력 토큰 */
  maxTokens?: number
}

// =============================================================================
// 상수
// =============================================================================

// P2-11-A: LLM 중앙 관리 마이그레이션 - getModelForUsage 적용
const GEMINI_VISION_MODEL = getModelForUsage('ocr.vision')

/** 기본 최대 토큰 */
const DEFAULT_MAX_TOKENS = 4096

// =============================================================================
// 프롬프트 템플릿
// =============================================================================

const EXTRACTION_PROMPTS = {
  'text-only': `이 이미지에서 모든 텍스트를 추출해주세요.
- 텍스트만 출력하세요. 설명이나 주석은 제외합니다.
- 원본 레이아웃을 최대한 유지하세요.
- 읽기 순서대로 추출하세요 (위→아래, 왼쪽→오른쪽).
- 인식이 불확실한 부분은 [?]로 표시하세요.`,

  structured: `이 이미지에서 텍스트를 구조화하여 추출해주세요.
- 제목, 본문, 표, 목록 등을 구분하세요.
- 마크다운 형식으로 출력하세요.
- 표는 마크다운 테이블로 변환하세요.
- 읽기 순서대로 추출하세요.`,

  detailed: `이 이미지의 내용을 상세히 분석하고 추출해주세요.
- 모든 텍스트를 추출하세요.
- 레이아웃 구조를 설명하세요.
- 중요한 시각적 요소(도표, 이미지 설명 등)를 포함하세요.
- 마크다운 형식으로 출력하세요.`,
}

// =============================================================================
// Vision 추출 함수
// =============================================================================

/**
 * Gemini Vision을 사용하여 이미지에서 텍스트 추출
 *
 * @param imageBuffer - 이미지 데이터 (Buffer)
 * @param mimeType - 이미지 MIME 타입 (예: 'image/png', 'image/jpeg')
 * @param options - 추출 옵션
 * @returns 추출 결과
 *
 * @example
 * ```typescript
 * const result = await extractTextWithVision(
 *   imageBuffer,
 *   'image/png',
 *   { mode: 'structured' }
 * )
 * if (result.success) {
 *   console.log('추출된 텍스트:', result.text)
 * }
 * ```
 */
export async function extractTextWithVision(
  imageBuffer: Buffer,
  mimeType: string,
  options: VisionExtractionOptions = {}
): Promise<VisionExtractionResult> {
  const startTime = Date.now()
  const { mode = 'text-only', languageHint, maxTokens = DEFAULT_MAX_TOKENS } = options

  try {
    // API 키 확인
    const apiKey = process.env.GOOGLE_API_KEY
    if (!apiKey) {
      return {
        success: false,
        text: '',
        error: 'GOOGLE_API_KEY 환경 변수가 설정되지 않았습니다.',
        processingTime: Date.now() - startTime,
      }
    }

    // Gemini 클라이언트 초기화
    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: GEMINI_VISION_MODEL })

    // 프롬프트 구성
    let prompt = EXTRACTION_PROMPTS[mode]
    if (languageHint) {
      prompt += `\n\n주요 언어: ${languageHint}`
    }

    // 이미지를 Base64로 인코딩
    const base64Image = imageBuffer.toString('base64')

    // Vision API 호출
    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          mimeType,
          data: base64Image,
        },
      },
    ])

    const response = result.response
    const text = response.text()?.trim() || ''

    if (!text) {
      return {
        success: false,
        text: '',
        error: '이미지에서 텍스트를 추출할 수 없습니다.',
        processingTime: Date.now() - startTime,
      }
    }

    // 토큰 사용량 추정 (정확한 값은 API에서 제공하지 않음)
    const estimatedTokens = Math.ceil((base64Image.length / 4) * 0.75) + text.length

    console.log(`[Vision] Extracted ${text.length} characters in ${Date.now() - startTime}ms`)

    return {
      success: true,
      text,
      tokensUsed: estimatedTokens,
      processingTime: Date.now() - startTime,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('[Vision] Extraction error:', error)

    return {
      success: false,
      text: '',
      error: `Vision 추출 실패: ${errorMessage}`,
      processingTime: Date.now() - startTime,
    }
  }
}

/**
 * 여러 이미지에서 텍스트 추출 (PDF 페이지 등)
 *
 * @param images - 이미지 배열 (버퍼와 MIME 타입)
 * @param options - 추출 옵션
 * @returns 전체 텍스트 결과
 */
export async function extractTextFromImages(
  images: Array<{ buffer: Buffer; mimeType: string }>,
  options: VisionExtractionOptions = {}
): Promise<VisionExtractionResult> {
  const startTime = Date.now()
  const results: string[] = []
  let totalTokens = 0

  for (let i = 0; i < images.length; i++) {
    console.log(`[Vision] Processing image ${i + 1}/${images.length}`)

    const { buffer, mimeType } = images[i]
    const result = await extractTextWithVision(buffer, mimeType, options)

    if (result.success && result.text) {
      results.push(`--- 페이지 ${i + 1} ---\n${result.text}`)
      totalTokens += result.tokensUsed || 0
    }

    // Rate limiting (Gemini API 제한 고려)
    if (i < images.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 500))
    }
  }

  const fullText = results.join('\n\n')

  return {
    success: results.length > 0,
    text: fullText,
    tokensUsed: totalTokens,
    error: results.length === 0 ? '모든 이미지에서 텍스트를 추출할 수 없습니다.' : undefined,
    processingTime: Date.now() - startTime,
  }
}

// =============================================================================
// 유틸리티
// =============================================================================

/**
 * Vision 추출 가능 여부 확인
 */
export function isVisionAvailable(): boolean {
  return !!process.env.GOOGLE_API_KEY
}

/**
 * 지원되는 이미지 MIME 타입
 */
export const SUPPORTED_IMAGE_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
] as const
