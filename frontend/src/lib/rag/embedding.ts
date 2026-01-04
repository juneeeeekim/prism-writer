// =============================================================================
// PRISM Writer - Embedding Generation
// =============================================================================
// 파일: frontend/src/lib/rag/embedding.ts
// 역할: OpenAI API를 사용한 텍스트 임베딩 생성
// Pipeline v5 업그레이드: tiktoken 기반 정확한 토큰 계산 통합
// =============================================================================

import OpenAI from 'openai'
import { createHash } from 'crypto'
import { getTokenCount } from './tokenizer'
import { createClient } from '@/lib/supabase/server'

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
 * 텍스트의 토큰 수 계산 (Pipeline v5: tiktoken 기반 정확한 계산)
 *
 * @description
 * 주석(시니어 개발자): Pipeline v5에서 tiktoken 통합으로 정확도 향상
 * - 기존: 문자 수 / 3 (±30% 오차)
 * - 개선: tiktoken cl100k_base 인코딩 (OpenAI 모델 호환)
 *
 * @param text - 텍스트
 * @returns 정확한 토큰 수
 */
export function estimateTokenCount(text: string): number {
  return getTokenCount(text)
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

// =============================================================================
// [P-C01-02] 임베딩 캐시 시스템
// =============================================================================
// 목적: 검색 쿼리 임베딩을 캐싱하여 API 호출 비용 절감 및 응답 속도 향상
// - 캐시 히트: Supabase에서 즉시 반환 (API 호출 없음)
// - 캐시 미스: API 호출 후 캐시에 저장
// - TTL 기반 만료: 24시간 후 자동 무효화
// - 안전성: 캐시 실패 시 원본 embedText() 로직으로 fallback
// =============================================================================

/** 캐시 TTL (시간 단위) - 24시간 */
const CACHE_TTL_HOURS = 24

/**
 * 쿼리 텍스트의 SHA256 해시 생성
 *
 * @description
 * 동일한 쿼리는 동일한 해시를 생성하여 캐시 키로 사용
 *
 * @param text - 해시할 텍스트
 * @returns SHA256 해시 (hex 문자열)
 */
function hashQuery(text: string): string {
  return createHash('sha256').update(text.trim()).digest('hex')
}

/**
 * 캐시를 활용한 텍스트 임베딩 생성
 *
 * @description
 * [P-C01-02] 검색 쿼리 임베딩을 캐싱하여 성능 최적화
 *
 * 1. 캐시 조회: query_hash로 캐시 테이블 검색
 * 2. 캐시 히트: 저장된 임베딩 반환 (hit_count 증가)
 * 3. 캐시 미스: API 호출 → 캐시 저장 → 임베딩 반환
 *
 * @param text - 임베딩할 텍스트
 * @param userId - 사용자 ID (선택, 사용자별 캐시 격리)
 * @returns 임베딩 벡터 (1536 차원)
 *
 * @example
 * ```typescript
 * // 기본 사용 (전역 캐시)
 * const embedding = await embedTextWithCache("RAG란 무엇인가요?")
 *
 * // 사용자별 캐시
 * const embedding = await embedTextWithCache("RAG란 무엇인가요?", userId)
 * ```
 */
export async function embedTextWithCache(
  text: string,
  userId?: string
): Promise<number[]> {
  // ---------------------------------------------------------------------------
  // 입력 검증
  // ---------------------------------------------------------------------------
  if (!text || text.trim().length === 0) {
    throw new Error('임베딩할 텍스트가 비어있습니다.')
  }

  const queryHash = hashQuery(text)
  const now = new Date()

  // ---------------------------------------------------------------------------
  // [STEP 1] 캐시 조회
  // ---------------------------------------------------------------------------
  try {
    const supabase = await createClient()

    // 캐시 조회 쿼리 (만료되지 않은 항목만)
    let query = supabase
      .from('embedding_cache')
      .select('id, embedding')
      .eq('query_hash', queryHash)
      .gt('expires_at', now.toISOString())

    // 사용자별 캐시 또는 전역 캐시
    if (userId) {
      query = query.eq('user_id', userId)
    } else {
      query = query.is('user_id', null)
    }

    const { data: cached, error: cacheError } = await query.maybeSingle()

    // 캐시 조회 에러 (경고만 출력, fallback 진행)
    if (cacheError) {
      console.warn('[embedTextWithCache] 캐시 조회 실패, API 호출로 진행:', cacheError.message)
    }

    // -------------------------------------------------------------------------
    // [STEP 2] 캐시 히트 - 저장된 임베딩 반환
    // -------------------------------------------------------------------------
    if (cached?.embedding) {
      // 히트 카운트 증가 (비동기, 실패해도 무시)
      // Supabase update()는 .select()가 없으면 void 반환하므로 별도 처리
      void (async () => {
        try {
          await supabase
            .from('embedding_cache')
            .update({ hit_count: (cached as any).hit_count + 1 || 1 })
            .eq('id', cached.id)
        } catch {
          // 무시
        }
      })()

      console.debug('[embedTextWithCache] 캐시 히트:', queryHash.substring(0, 8))
      return cached.embedding as number[]
    }

    // -------------------------------------------------------------------------
    // [STEP 3] 캐시 미스 - API 호출 후 캐시 저장
    // -------------------------------------------------------------------------
    console.debug('[embedTextWithCache] 캐시 미스, API 호출:', queryHash.substring(0, 8))

    // 원본 embedText 호출
    const embedding = await embedText(text)

    // 캐시 저장 (비동기, 실패해도 무시)
    // Supabase upsert()는 .select()가 없으면 void 반환하므로 별도 처리
    const expiresAt = new Date(now.getTime() + CACHE_TTL_HOURS * 60 * 60 * 1000)

    void (async () => {
      try {
        await supabase
          .from('embedding_cache')
          .upsert({
            query_hash: queryHash,
            embedding,
            user_id: userId || null,
            expires_at: expiresAt.toISOString(),
            hit_count: 0,
          }, {
            onConflict: 'query_hash,user_id',
          })
        console.debug('[embedTextWithCache] 캐시 저장 완료:', queryHash.substring(0, 8))
      } catch (err) {
        console.warn('[embedTextWithCache] 캐시 저장 실패:', err instanceof Error ? err.message : String(err))
      }
    })()

    return embedding

  } catch (error) {
    // -------------------------------------------------------------------------
    // [FALLBACK] 캐시 시스템 전체 실패 시 원본 로직으로 진행
    // -------------------------------------------------------------------------
    console.warn(
      '[embedTextWithCache] 캐시 시스템 오류, 원본 API 호출로 진행:',
      error instanceof Error ? error.message : String(error)
    )

    // 원본 embedText 호출 (캐시 없이)
    return embedText(text)
  }
}
