// =============================================================================
// PRISM Writer - Gemini Embedding Generation
// =============================================================================
// 파일: frontend/src/lib/ai/embedding.ts
// 역할: Google Gemini text-embedding-004 모델을 사용한 텍스트 임베딩 생성
// 차원: 768 (Gemini 임베딩 기본)
// =============================================================================

import { GoogleGenerativeAI } from '@google/generative-ai'

// =============================================================================
// 상수 및 설정
// =============================================================================

/**
 * Gemini 임베딩 모델 설정 (버전 관리용)
 * 
 * @description
 * 임베딩 모델 정보를 중앙화하여 버전 관리 용이
 * DB 저장 시 embedding_model_id, embedding_dim 값으로 사용됨
 */
export const GEMINI_EMBEDDING_CONFIG = {
  /** 임베딩 모델 ID */
  modelId: 'text-embedding-004',
  /** 임베딩 벡터 차원 수 */
  dimensions: 768,
  /** 벤더/제공자 */
  vendor: 'google',
} as const

/** 임베딩 차원 (편의를 위한 alias) */
export const GEMINI_EMBEDDING_DIMENSIONS = GEMINI_EMBEDDING_CONFIG.dimensions

/** 배치 처리 최대 크기 */
const MAX_BATCH_SIZE = 100

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
 * 텍스트 전처리 (공백 제거 및 정규화)
 * 
 * @param text - 원본 텍스트
 * @returns 전처리된 텍스트
 */
function preprocessText(text: string): string {
  if (!text) return ''
  
  // 앞뒤 공백 제거 및 연속 공백 정규화
  return text.trim().replace(/\s+/g, ' ')
}

/**
 * 텍스트의 토큰 수 추정 (대략적)
 * 
 * @param text - 텍스트
 * @returns 예상 토큰 수
 */
export function estimateTokenCount(text: string): number {
  // 영어: ~4 chars/token, 한글: ~2 chars/token
  // 보수적으로 3으로 계산
  return Math.ceil(text.length / 3)
}

// =============================================================================
// Main Functions
// =============================================================================

/**
 * 단일 텍스트의 임베딩 생성 (Gemini text-embedding-004)
 * 
 * @description
 * Google Gemini API를 사용하여 텍스트를 768차원 벡터로 변환합니다.
 * 재시도 로직이 포함되어 있어 일시적인 오류에 대응합니다.
 * 
 * @param text - 임베딩할 텍스트
 * @returns 임베딩 벡터 (768 차원)
 * 
 * @example
 * ```typescript
 * const embedding = await generateEmbedding("안녕하세요")
 * console.log(embedding.length) // 768
 * ```
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  // ---------------------------------------------------------------------------
  // 1. 입력 검증 및 전처리
  // ---------------------------------------------------------------------------
  const processedText = preprocessText(text)
  
  if (!processedText || processedText.length === 0) {
    throw new Error('임베딩할 텍스트가 비어있습니다.')
  }

  // ---------------------------------------------------------------------------
  // 2. Gemini 임베딩 모델 초기화
  // ---------------------------------------------------------------------------
  const client = getGenAIClient()
  const model = client.getGenerativeModel({ model: GEMINI_EMBEDDING_CONFIG.modelId })
  
  let lastError: Error | null = null

  // ---------------------------------------------------------------------------
  // 3. 재시도 로직이 포함된 임베딩 생성
  // ---------------------------------------------------------------------------
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const result = await model.embedContent(processedText)

      if (!result.embedding || !result.embedding.values) {
        throw new Error('임베딩 응답이 비어있습니다.')
      }

      const embedding = result.embedding.values

      // 차원 수 검증
      if (embedding.length !== GEMINI_EMBEDDING_CONFIG.dimensions) {
        console.warn(
          `임베딩 차원 불일치: 예상 ${GEMINI_EMBEDDING_CONFIG.dimensions}, ` +
          `실제 ${embedding.length}`
        )
      }

      return embedding
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))

      // 마지막 시도가 아니면 재시도
      if (attempt < MAX_RETRIES - 1) {
        console.warn(`임베딩 생성 실패 (${attempt + 1}/${MAX_RETRIES}), 재시도 중...`, error)
        await sleep(RETRY_DELAY * (attempt + 1)) // Exponential backoff
      }
    }
  }

  // ---------------------------------------------------------------------------
  // 4. 모든 재시도 실패
  // ---------------------------------------------------------------------------
  throw new Error(`임베딩 생성 실패: ${lastError?.message}`)
}

/**
 * 여러 텍스트의 임베딩 배치 생성
 * 
 * @description
 * 여러 텍스트를 순차적으로 임베딩합니다.
 * Gemini API는 현재 배치 임베딩을 직접 지원하지 않으므로 순차 처리합니다.
 * 
 * @param texts - 임베딩할 텍스트 배열
 * @returns 임베딩 벡터 배열
 * 
 * @example
 * ```typescript
 * const embeddings = await generateEmbeddingBatch(["text1", "text2", "text3"])
 * console.log(embeddings.length) // 3
 * ```
 */
export async function generateEmbeddingBatch(texts: string[]): Promise<number[][]> {
  if (!texts || texts.length === 0) {
    throw new Error('임베딩할 텍스트 배열이 비어있습니다.')
  }

  // ---------------------------------------------------------------------------
  // 배치 크기 검증
  // ---------------------------------------------------------------------------
  if (texts.length > MAX_BATCH_SIZE) {
    throw new Error(
      `배치 크기가 너무 큽니다. 최대 ${MAX_BATCH_SIZE}개까지 처리 가능합니다. ` +
      `${texts.length}개가 제공되었습니다.`
    )
  }

  // ---------------------------------------------------------------------------
  // 빈 텍스트 필터링
  // ---------------------------------------------------------------------------
  const validTexts = texts.filter((t) => t && t.trim().length > 0)
  if (validTexts.length === 0) {
    throw new Error('유효한 텍스트가 없습니다.')
  }

  // ---------------------------------------------------------------------------
  // 순차적으로 임베딩 생성 (Gemini API 배치 미지원)
  // ---------------------------------------------------------------------------
  const embeddings: number[][] = []
  
  for (let i = 0; i < validTexts.length; i++) {
    const embedding = await generateEmbedding(validTexts[i])
    embeddings.push(embedding)
    
    // 진행 상황 로깅 (10개 단위)
    if ((i + 1) % 10 === 0 || i === validTexts.length - 1) {
      console.log(`임베딩 진행: ${i + 1}/${validTexts.length}`)
    }
  }

  return embeddings
}

/**
 * 대용량 텍스트 배열을 청크로 나누어 임베딩 생성
 * 
 * @description
 * MAX_BATCH_SIZE를 초과하는 대용량 배열도 처리할 수 있습니다.
 * 
 * @param texts - 임베딩할 텍스트 배열
 * @returns 임베딩 벡터 배열
 * 
 * @example
 * ```typescript
 * const largeArray = Array(500).fill("text")
 * const embeddings = await generateLargeBatchEmbedding(largeArray)
 * ```
 */
export async function generateLargeBatchEmbedding(texts: string[]): Promise<number[][]> {
  const allEmbeddings: number[][] = []

  // 배치로 나누어 처리
  for (let i = 0; i < texts.length; i += MAX_BATCH_SIZE) {
    const batch = texts.slice(i, i + MAX_BATCH_SIZE)
    const batchEmbeddings = await generateEmbeddingBatch(batch)
    allEmbeddings.push(...batchEmbeddings)

    console.log(`대용량 임베딩 진행: ${Math.min(i + MAX_BATCH_SIZE, texts.length)}/${texts.length}`)
  }

  return allEmbeddings
}

/**
 * Gemini 임베딩 API 사용 가능 여부 확인
 * 
 * @description
 * API 키가 설정되어 있는지 확인합니다.
 * 
 * @returns API 키 설정 여부
 */
export function isGeminiEmbeddingAvailable(): boolean {
  return !!process.env.GOOGLE_API_KEY
}
