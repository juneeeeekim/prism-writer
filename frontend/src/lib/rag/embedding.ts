// =============================================================================
// PRISM Writer - Embedding Generation
// =============================================================================
// 파일: frontend/src/lib/rag/embedding.ts
// 역할: OpenAI API를 사용한 텍스트 임베딩 생성
// =============================================================================

import OpenAI from 'openai'

// =============================================================================
// 상수 및 설정
// =============================================================================

/**
 * 임베딩 모델 설정 (버전 관리용)
 * 
 * @description
 * 임베딩 모델 정보를 중앙화하여 버전 관리 용이
 * DB 저장 시 embedding_model_id, embedding_dim 값으로 사용됨
 */
export const EMBEDDING_CONFIG = {
  /** 임베딩 모델 ID */
  modelId: 'text-embedding-3-small',
  /** 임베딩 벡터 차원 수 */
  dimensions: 1536,
  /** 벤더/제공자 */
  vendor: 'openai',
} as const

/** 임베딩 차원 (하위 호환성을 위한 alias) */
export const EMBEDDING_DIMENSIONS = EMBEDDING_CONFIG.dimensions

/** 배치 처리 최대 크기 */
const MAX_BATCH_SIZE = 100

/** 재시도 최대 횟수 */
const MAX_RETRIES = 3

/** 재시도 대기 시간 (ms) */
const RETRY_DELAY = 1000

// =============================================================================
// OpenAI 클라이언트 초기화
// =============================================================================

let openaiClient: OpenAI | null = null

/**
 * OpenAI 클라이언트 가져오기 (지연 초기화)
 */
function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    const apiKey = process.env.OPENAI_API_KEY

    if (!apiKey) {
      throw new Error(
        'OPENAI_API_KEY 환경 변수가 설정되지 않았습니다. ' +
        '.env.local 파일에 OPENAI_API_KEY를 추가해주세요.'
      )
    }

    openaiClient = new OpenAI({
      apiKey,
    })
  }

  return openaiClient
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
export function estimateTokenCount(text: string): number {
  // 영어: ~4 chars/token, 한글: ~2 chars/token
  // 보수적으로 3으로 계산
  return Math.ceil(text.length / 3)
}

// =============================================================================
// Main Functions
// =============================================================================

/**
 * 단일 텍스트의 임베딩 생성
 * 
 * @param text - 임베딩할 텍스트
 * @returns 임베딩 벡터 (1536 차원)
 * 
 * @example
 * ```typescript
 * const embedding = await embedText("Hello, world!")
 * console.log(embedding.length) // 1536
 * ```
 */
export async function embedText(text: string): Promise<number[]> {
  if (!text || text.trim().length === 0) {
    throw new Error('임베딩할 텍스트가 비어있습니다.')
  }

  const client = getOpenAIClient()
  let lastError: Error | null = null

  // ---------------------------------------------------------------------------
  // 재시도 로직
  // ---------------------------------------------------------------------------
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const response = await client.embeddings.create({
        model: EMBEDDING_CONFIG.modelId,
        input: text,
        encoding_format: 'float',
      })

      if (!response.data || response.data.length === 0) {
        throw new Error('임베딩 응답이 비어있습니다.')
      }

      return response.data[0].embedding
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))

      // 마지막 시도가 아니면 재시도
      if (attempt < MAX_RETRIES - 1) {
        console.warn(`임베딩 생성 실패 (${attempt + 1}/${MAX_RETRIES}), 재시도 중...`, error)
        await sleep(RETRY_DELAY * (attempt + 1)) // Exponential backoff
      }
    }
  }

  // 모든 재시도 실패
  throw new Error(`임베딩 생성 실패: ${lastError?.message}`)
}

/**
 * 여러 텍스트의 임베딩 배치 생성
 * 
 * @param texts - 임베딩할 텍스트 배열
 * @returns 임베딩 벡터 배열
 * 
 * @example
 * ```typescript
 * const embeddings = await embedBatch(["text1", "text2", "text3"])
 * console.log(embeddings.length) // 3
 * ```
 */
export async function embedBatch(texts: string[]): Promise<number[][]> {
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

  const client = getOpenAIClient()
  let lastError: Error | null = null

  // ---------------------------------------------------------------------------
  // 재시도 로직
  // ---------------------------------------------------------------------------
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const response = await client.embeddings.create({
        model: EMBEDDING_CONFIG.modelId,
        input: validTexts,
        encoding_format: 'float',
      })

      if (!response.data || response.data.length !== validTexts.length) {
        throw new Error('임베딩 응답 개수가 일치하지 않습니다.')
      }

      // 순서대로 임베딩 반환
      return response.data.map((item) => item.embedding)
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))

      // 마지막 시도가 아니면 재시도
      if (attempt < MAX_RETRIES - 1) {
        console.warn(`배치 임베딩 생성 실패 (${attempt + 1}/${MAX_RETRIES}), 재시도 중...`, error)
        await sleep(RETRY_DELAY * (attempt + 1))
      }
    }
  }

  // 모든 재시도 실패
  throw new Error(`배치 임베딩 생성 실패: ${lastError?.message}`)
}

/**
 * 대용량 텍스트 배열을 청크로 나누어 임베딩 생성
 * 
 * @param texts - 임베딩할 텍스트 배열
 * @returns 임베딩 벡터 배열
 * 
 * @example
 * ```typescript
 * const largeArray = Array(500).fill("text")
 * const embeddings = await embedLargeBatch(largeArray)
 * ```
 */
export async function embedLargeBatch(texts: string[]): Promise<number[][]> {
  const allEmbeddings: number[][] = []

  // 배치로 나누어 처리
  for (let i = 0; i < texts.length; i += MAX_BATCH_SIZE) {
    const batch = texts.slice(i, i + MAX_BATCH_SIZE)
    const batchEmbeddings = await embedBatch(batch)
    allEmbeddings.push(...batchEmbeddings)

    console.log(`임베딩 진행: ${Math.min(i + MAX_BATCH_SIZE, texts.length)}/${texts.length}`)
  }

  return allEmbeddings
}
