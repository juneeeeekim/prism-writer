// =============================================================================
// PRISM Writer - Embedding Generation
// =============================================================================
// 파일: frontend/src/lib/ai/embedding.ts
// 역할: OpenAI text-embedding-3-small 모델을 사용한 텍스트 임베딩 생성
// 차원: 1536 (OpenAI 임베딩 기본) - DB 스키마(vector(1536))와 일치
// Pipeline v5: LRU 캐시 추가 (Section 5.2 - 예상 히트율 70%+)
// =============================================================================

import OpenAI from 'openai'
import { LRUCache, hashText } from '@/lib/cache/lruCache'

// =============================================================================
// 상수 및 설정
// =============================================================================

/**
 * 임베딩 모델 설정
 * 
 * @description
 * 임베딩 모델 정보를 중앙화하여 버전 관리 용이
 * DB 저장 시 embedding_model_id, embedding_dim 값으로 사용됨
 */
export const EMBEDDING_CONFIG = {
  /** 임베딩 모델 ID (OpenAI) */
  modelId: 'text-embedding-3-small',
  /** 임베딩 벡터 차원 수 (1536) */
  dimensions: 1536,
  /** 벤더/제공자 */
  vendor: 'openai',
} as const

/** 임베딩 차원 (편의를 위한 alias) */
export const EMBEDDING_DIMENSIONS = EMBEDDING_CONFIG.dimensions

/** 배치 처리 최대 크기 */
const MAX_BATCH_SIZE = 100

/** 재시도 최대 횟수 */
const MAX_RETRIES = 3

/** 재시도 대기 시간 (ms) */
const RETRY_DELAY = 1000

// =============================================================================
// [Pipeline v5] 임베딩 캐시 (Section 5.2)
// =============================================================================
// 주석(시니어 개발자): 동일 텍스트 반복 임베딩 방지
// - 최대 5000개 항목 (약 1536*5000*8 = 60MB 메모리)
// - 30분 TTL (임베딩은 변하지 않으므로 길게 설정)

const embeddingCache = new LRUCache<number[]>({
  maxSize: 5000,
  ttlMs: 30 * 60 * 1000, // 30분
  name: 'EmbeddingCache',
})

// =============================================================================
// OpenAI 클라이언트 초기화
// =============================================================================

let openai: OpenAI | null = null

/**
 * OpenAI 클라이언트 가져오기 (지연 초기화)
 */
function getOpenAIClient(): OpenAI {
  if (!openai) {
    const apiKey = process.env.OPENAI_API_KEY

    // 클라이언트 사이드에서는 API 키 노출 방지를 위해 체크하지 않음 (서버 사이드 전용)
    if (!apiKey && typeof window === 'undefined') {
      console.warn('OPENAI_API_KEY 환경 변수가 설정되지 않았습니다.')
    }

    openai = new OpenAI({
      apiKey: apiKey || 'dummy', // 빌드/테스트 시 오류 방지
      dangerouslyAllowBrowser: false, // 브라우저 사용 금지
    })
  }

  return openai
}

// =============================================================================
// Helper Functions
// =============================================================================

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function preprocessText(text: string): string {
  if (!text) return ''
  return text.trim().replace(/\s+/g, ' ')
}

export function estimateTokenCount(text: string): number {
  return Math.ceil(text.length / 3)
}

// =============================================================================
// Main Functions
// =============================================================================

/**
 * 단일 텍스트의 임베딩 생성 (OpenAI text-embedding-3-small)
 * 
 * @param text - 임베딩할 텍스트
 * @returns 임베딩 벡터 (1536 차원)
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  // 1. 입력 검증 및 전처리
  const processedText = preprocessText(text)

  if (!processedText || processedText.length === 0) {
    throw new Error('임베딩할 텍스트가 비어있습니다.')
  }

  // 2. 캐시 확인
  const cacheKey = hashText(processedText)
  const cached = embeddingCache.get(cacheKey)
  if (cached) return cached

  // 3. OpenAI 클라이언트 초기화
  const client = getOpenAIClient()
  let lastError: Error | null = null

  // 4. 재시도 로직
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const response = await client.embeddings.create({
        model: EMBEDDING_CONFIG.modelId,
        input: processedText,
        dimensions: EMBEDDING_CONFIG.dimensions, // v3 모델은 차원 지정 가능
      })

      const embedding = response.data[0].embedding

      // 차원 수 검증
      if (embedding.length !== EMBEDDING_CONFIG.dimensions) {
        console.warn(
          `임베딩 차원 불일치: 예상 ${EMBEDDING_CONFIG.dimensions}, ` +
          `실제 ${embedding.length}`
        )
      }

      // 캐시 저장
      embeddingCache.set(cacheKey, embedding)

      return embedding
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      if (attempt < MAX_RETRIES - 1) {
        await sleep(RETRY_DELAY * (attempt + 1))
      }
    }
  }

  throw new Error(`임베딩 생성 실패: ${lastError?.message}`)
}

/**
 * 여러 텍스트의 임베딩 배치 생성 (OpenAI는 배치 지원)
 */
export async function generateEmbeddingBatch(texts: string[]): Promise<number[][]> {
  if (!texts || texts.length === 0) {
    throw new Error('임베딩할 텍스트 배열이 비어있습니다.')
  }

  if (texts.length > MAX_BATCH_SIZE) {
    throw new Error(`배치 크기 초과: ${texts.length} > ${MAX_BATCH_SIZE}`)
  }

  const validTexts = texts.filter((t) => t && t.trim().length > 0)
  if (validTexts.length === 0) {
    throw new Error('유효한 텍스트가 없습니다.')
  }

  // OpenAI는 API 레벨에서 배치를 지원하지만, 
  // 여기서는 generateEmbedding을 사용하여 캐시 효율성을 높이고 개별 오류 처리를 단순화함
  // (성능 최적화가 필요하면 embeddings.create에 배열 전달로 변경 가능)
  // 일단 기존 인터페이스 호환성을 위해 순차/병렬 처리
  
  // 병렬 처리 (OpenAI 속도 제한 주의)
  const embeddings = await Promise.all(
    validTexts.map(text => generateEmbedding(text))
  )

  return embeddings
}

export async function generateLargeBatchEmbedding(texts: string[]): Promise<number[][]> {
  const allEmbeddings: number[][] = []
  for (let i = 0; i < texts.length; i += MAX_BATCH_SIZE) {
    const batch = texts.slice(i, i + MAX_BATCH_SIZE)
    const batchEmbeddings = await generateEmbeddingBatch(batch)
    allEmbeddings.push(...batchEmbeddings)
  }
  return allEmbeddings
}

export function isEmbeddingAvailable(): boolean {
  return !!process.env.OPENAI_API_KEY
}

// 호환성 유지 (Gemini 함수 이름 alias)
export const isGeminiEmbeddingAvailable = isEmbeddingAvailable

export function getEmbeddingCacheStats() {
  return embeddingCache.getStats()
}

export function clearEmbeddingCache(): void {
  embeddingCache.clear()
}
