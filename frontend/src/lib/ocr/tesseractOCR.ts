// =============================================================================
// [P10-OCR-01] Tesseract.js OCR 모듈
// =============================================================================
// 파일: frontend/src/lib/ocr/tesseractOCR.ts
// 역할: 스캔된 PDF/이미지에서 텍스트 추출 (무료 OCR)
// 생성일: 2026-01-01
// =============================================================================
//
// [기술 스택]
// - Tesseract.js: 순수 JavaScript OCR 라이브러리
// - 지원 언어: 한국어(kor), 영어(eng) 동시 인식
// - 오프라인 작동 (API 키 불필요)
//
// [제한사항]
// - Vercel Serverless 타임아웃 (10초/60초) 주의
// - 대용량 이미지는 처리 시간이 길 수 있음
// - 품질은 이미지 해상도에 따라 달라짐
//
// =============================================================================

import Tesseract from 'tesseract.js'

// =============================================================================
// 타입 정의
// =============================================================================

export interface OCRResult {
  success: boolean
  text: string
  confidence: number
  language: string
  error?: string
  processingTime?: number
}

export interface OCROptions {
  /** 인식할 언어 (기본: 한국어+영어) */
  languages?: string[]
  /** 이미지 전처리 여부 */
  preprocess?: boolean
}

// =============================================================================
// 상수
// =============================================================================

/** 기본 언어 설정 (한국어 + 영어) */
const DEFAULT_LANGUAGES = ['kor', 'eng']

/** OCR 타임아웃 (45초 - Vercel Pro 타임아웃 고려) */
const OCR_TIMEOUT = 45000

// =============================================================================
// OCR 함수
// =============================================================================

/**
 * 이미지 버퍼에서 텍스트 추출 (Tesseract.js)
 *
 * @param imageBuffer - 이미지 데이터 (Buffer)
 * @param options - OCR 옵션
 * @returns OCR 결과
 *
 * @example
 * ```typescript
 * const result = await extractTextFromImage(imageBuffer)
 * if (result.success) {
 *   console.log('추출된 텍스트:', result.text)
 *   console.log('신뢰도:', result.confidence)
 * }
 * ```
 */
export async function extractTextFromImage(
  imageBuffer: Buffer,
  options: OCROptions = {}
): Promise<OCRResult> {
  const startTime = Date.now()
  const languages = options.languages || DEFAULT_LANGUAGES

  try {
    // Tesseract.js recognize 호출 (Buffer를 Base64 Data URL로 변환)
    const base64 = imageBuffer.toString('base64')
    const dataUrl = `data:image/png;base64,${base64}`
    const result = await Promise.race([
      Tesseract.recognize(dataUrl, languages.join('+'), {
        logger: (m) => {
          // 진행 상황 로깅 (디버그용)
          if (m.status === 'recognizing text') {
            console.log(`[OCR] Progress: ${Math.round((m.progress || 0) * 100)}%`)
          }
        },
      }),
      // 타임아웃 처리
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('OCR timeout')), OCR_TIMEOUT)
      ),
    ])

    const text = result.data.text?.trim() || ''
    const confidence = result.data.confidence || 0

    if (!text) {
      return {
        success: false,
        text: '',
        confidence: 0,
        language: languages.join('+'),
        error: '텍스트를 추출할 수 없습니다. 이미지 품질을 확인해주세요.',
        processingTime: Date.now() - startTime,
      }
    }

    console.log(`[OCR] Extracted ${text.length} characters with ${confidence.toFixed(1)}% confidence`)

    return {
      success: true,
      text,
      confidence,
      language: languages.join('+'),
      processingTime: Date.now() - startTime,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown OCR error'
    console.error('[OCR] Error:', error)

    return {
      success: false,
      text: '',
      confidence: 0,
      language: languages.join('+'),
      error: errorMessage.includes('timeout')
        ? 'OCR 처리 시간이 초과되었습니다. 더 작은 이미지로 시도해주세요.'
        : `OCR 처리 실패: ${errorMessage}`,
      processingTime: Date.now() - startTime,
    }
  }
}

/**
 * PDF 페이지 이미지들에서 텍스트 추출
 *
 * @param pageImages - 페이지별 이미지 버퍼 배열
 * @param options - OCR 옵션
 * @returns 전체 텍스트 (페이지 구분 포함)
 */
export async function extractTextFromPDFPages(
  pageImages: Buffer[],
  options: OCROptions = {}
): Promise<OCRResult> {
  const startTime = Date.now()
  const results: string[] = []
  let totalConfidence = 0

  for (let i = 0; i < pageImages.length; i++) {
    console.log(`[OCR] Processing page ${i + 1}/${pageImages.length}`)

    const pageResult = await extractTextFromImage(pageImages[i], options)

    if (pageResult.success && pageResult.text) {
      results.push(`--- 페이지 ${i + 1} ---\n${pageResult.text}`)
      totalConfidence += pageResult.confidence
    }
  }

  const fullText = results.join('\n\n')
  const avgConfidence = results.length > 0 ? totalConfidence / results.length : 0

  return {
    success: results.length > 0,
    text: fullText,
    confidence: avgConfidence,
    language: (options.languages || DEFAULT_LANGUAGES).join('+'),
    error: results.length === 0 ? '모든 페이지에서 텍스트를 추출할 수 없습니다.' : undefined,
    processingTime: Date.now() - startTime,
  }
}

// =============================================================================
// 유틸리티 함수
// =============================================================================

/**
 * 지원되는 언어 목록
 */
export const SUPPORTED_LANGUAGES = [
  { code: 'kor', name: '한국어' },
  { code: 'eng', name: '영어' },
  { code: 'jpn', name: '일본어' },
  { code: 'chi_sim', name: '중국어 (간체)' },
  { code: 'chi_tra', name: '중국어 (번체)' },
] as const

/**
 * 이미지 MIME 타입 확인
 */
export function isImageMimeType(mimeType: string): boolean {
  return mimeType.startsWith('image/') || mimeType === 'application/pdf'
}
