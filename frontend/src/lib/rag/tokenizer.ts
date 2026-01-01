// =============================================================================
// PRISM Writer - Tokenizer Utility
// =============================================================================
// 파일: frontend/src/lib/rag/tokenizer.ts
// 역할: 정확한 토큰 계산을 위한 중앙 집중화된 토크나이저 모듈
// Pipeline v5 업그레이드: tiktoken 라이브러리 통합
// =============================================================================

import { getEncoding, type Tiktoken } from 'js-tiktoken'

// =============================================================================
// 타입 정의
// =============================================================================

/** 지원되는 인코딩 타입 */
export type EncodingType = 'cl100k_base' | 'o200k_base'

/** 토크나이저 설정 */
export interface TokenizerConfig {
  /** 인코딩 타입 (기본: cl100k_base - GPT-3.5/4, text-embedding-3-small 용) */
  encoding?: EncodingType
  /** 캐시 활성화 여부 (기본: true) */
  enableCache?: boolean
}

/** 토큰 계산 결과 */
export interface TokenCountResult {
  /** 정확한 토큰 수 */
  count: number
  /** 사용된 인코딩 */
  encoding: EncodingType
  /** tiktoken 사용 여부 (fallback 시 false) */
  accurate: boolean
}

// =============================================================================
// 상수
// =============================================================================

/** 기본 인코딩 (OpenAI text-embedding-3-small, GPT-3.5/4 호환) */
const DEFAULT_ENCODING: EncodingType = 'cl100k_base'

/**
 * Fallback 문자/토큰 비율
 *
 * 주석(시니어 개발자): tiktoken 로딩 실패 시 사용하는 보수적 추정치
 * - 영어: ~4 chars/token
 * - 한글: ~2-3 chars/token (BPE 특성상 한글이 더 많은 토큰 사용)
 * - 혼합 텍스트 기준 보수적으로 2.5 적용
 */
const FALLBACK_CHARS_PER_TOKEN = 2.5

// =============================================================================
// 토크나이저 캐시 (지연 초기화)
// =============================================================================

// 주석(시니어 개발자): 인코딩별로 캐시하여 반복 초기화 방지
const encodingCache: Map<EncodingType, Tiktoken> = new Map()

/**
 * 인코딩 인스턴스 가져오기 (캐시 활용)
 *
 * @param encodingType - 인코딩 타입
 * @returns Tiktoken 인스턴스 또는 null (로딩 실패 시)
 */
function getEncodingInstance(encodingType: EncodingType): Tiktoken | null {
  // 캐시에서 먼저 확인
  const cached = encodingCache.get(encodingType)
  if (cached) {
    return cached
  }

  try {
    const encoding = getEncoding(encodingType)
    encodingCache.set(encodingType, encoding)
    return encoding
  } catch (error) {
    console.warn(
      `[Tokenizer] tiktoken 인코딩 로드 실패 (${encodingType}):`,
      error
    )
    return null
  }
}

// =============================================================================
// 주요 함수
// =============================================================================

/**
 * 정확한 토큰 수 계산 (tiktoken 기반)
 *
 * @description
 * Pipeline v5: tiktoken 라이브러리를 사용하여 정확한 토큰 수를 계산합니다.
 * 로딩 실패 시 fallback 추정치를 사용합니다.
 *
 * @param text - 토큰 수를 계산할 텍스트
 * @param config - 토크나이저 설정
 * @returns 토큰 계산 결과
 *
 * @example
 * ```typescript
 * const result = countTokens("안녕하세요, Hello World!")
 * console.log(result.count)     // 정확한 토큰 수
 * console.log(result.accurate)  // tiktoken 사용 여부
 * ```
 */
export function countTokens(
  text: string,
  config: TokenizerConfig = {}
): TokenCountResult {
  const { encoding = DEFAULT_ENCODING } = config

  // ---------------------------------------------------------------------------
  // 빈 텍스트 처리
  // ---------------------------------------------------------------------------
  if (!text || text.trim().length === 0) {
    return { count: 0, encoding, accurate: true }
  }

  // ---------------------------------------------------------------------------
  // tiktoken으로 정확한 토큰 계산 시도
  // ---------------------------------------------------------------------------
  const enc = getEncodingInstance(encoding)

  if (enc) {
    try {
      const tokens = enc.encode(text)
      return {
        count: tokens.length,
        encoding,
        accurate: true,
      }
    } catch (error) {
      console.warn('[Tokenizer] 토큰 인코딩 실패, fallback 사용:', error)
    }
  }

  // ---------------------------------------------------------------------------
  // Fallback: 문자 수 기반 추정
  // ---------------------------------------------------------------------------
  const estimatedCount = Math.ceil(text.length / FALLBACK_CHARS_PER_TOKEN)

  return {
    count: estimatedCount,
    encoding,
    accurate: false,
  }
}

/**
 * 간편 토큰 수 계산 (숫자만 반환)
 *
 * @description
 * countTokens의 간편 버전으로, 토큰 수만 반환합니다.
 * 기존 estimateTokenCount 함수와 호환됩니다.
 *
 * @param text - 토큰 수를 계산할 텍스트
 * @returns 토큰 수
 *
 * @example
 * ```typescript
 * const tokens = getTokenCount("Hello World!")
 * console.log(tokens)  // 3
 * ```
 */
export function getTokenCount(text: string): number {
  return countTokens(text).count
}

/**
 * 텍스트를 토큰 제한에 맞게 자르기
 *
 * @description
 * 텍스트가 지정된 토큰 제한을 초과할 경우, 제한 내로 잘라서 반환합니다.
 * 문자 단위가 아닌 토큰 단위로 정확하게 자릅니다.
 *
 * @param text - 원본 텍스트
 * @param maxTokens - 최대 토큰 수
 * @param config - 토크나이저 설정
 * @returns 잘린 텍스트
 *
 * @example
 * ```typescript
 * const truncated = truncateToTokenLimit("긴 텍스트...", 100)
 * ```
 */
export function truncateToTokenLimit(
  text: string,
  maxTokens: number,
  config: TokenizerConfig = {}
): string {
  const { encoding = DEFAULT_ENCODING } = config

  if (!text || text.length === 0) {
    return text
  }

  const enc = getEncodingInstance(encoding)

  if (enc) {
    try {
      const tokens = enc.encode(text)

      if (tokens.length <= maxTokens) {
        return text
      }

      // 토큰을 제한까지 자르고 다시 디코딩
      const truncatedTokens = tokens.slice(0, maxTokens)
      return enc.decode(truncatedTokens)
    } catch (error) {
      console.warn('[Tokenizer] 토큰 자르기 실패, 문자 기반 fallback:', error)
    }
  }

  // ---------------------------------------------------------------------------
  // Fallback: 문자 수 기반 추정으로 자르기
  // ---------------------------------------------------------------------------
  const estimatedChars = Math.floor(maxTokens * FALLBACK_CHARS_PER_TOKEN)
  return text.slice(0, estimatedChars)
}

/**
 * 텍스트 배열의 총 토큰 수 계산
 *
 * @param texts - 텍스트 배열
 * @returns 총 토큰 수
 */
export function countTotalTokens(texts: string[]): number {
  return texts.reduce((total, text) => total + getTokenCount(text), 0)
}

/**
 * 토크나이저 캐시 정리
 *
 * @description
 * 메모리 관리를 위해 캐시된 인코딩 인스턴스를 정리합니다.
 * 일반적으로 호출할 필요 없지만, 메모리가 중요한 환경에서 사용할 수 있습니다.
 */
export function clearTokenizerCache(): void {
  encodingCache.clear()
}

// =============================================================================
// 하위 호환성: 기존 estimateTokenCount 대체
// =============================================================================

/**
 * @deprecated getTokenCount 또는 countTokens 사용 권장
 *
 * 기존 estimateTokenCount 함수와의 하위 호환성을 위한 alias
 */
export const estimateTokenCount = getTokenCount
