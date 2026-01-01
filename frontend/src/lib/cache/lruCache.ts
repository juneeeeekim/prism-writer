// =============================================================================
// PRISM Writer - LRU Cache with TTL Support
// =============================================================================
// 파일: frontend/src/lib/cache/lruCache.ts
// 역할: 범용 LRU 캐시 (TTL 지원) - 임베딩/검색/사용량 조회 최적화
// Pipeline v5: 성능 최적화 (Section 5.2)
// =============================================================================

// =============================================================================
// Types
// =============================================================================

/** 캐시 항목 */
interface CacheEntry<T> {
  value: T
  expireAt: number
  createdAt: number
}

/** 캐시 설정 */
export interface LRUCacheOptions {
  /** 최대 항목 수 */
  maxSize: number
  /** TTL (밀리초), 0 = 무제한 */
  ttlMs: number
  /** 캐시 이름 (로깅용) */
  name?: string
}

/** 캐시 통계 */
export interface CacheStats {
  hits: number
  misses: number
  size: number
  maxSize: number
  hitRate: number
}

// =============================================================================
// LRU Cache Implementation
// =============================================================================

/**
 * LRU Cache with TTL Support
 *
 * @description
 * 주석(시니어 개발자): 성능 최적화를 위한 범용 LRU 캐시
 * - LRU (Least Recently Used) 퇴거 정책
 * - TTL (Time To Live) 만료 지원
 * - 통계 추적 (hit/miss rate)
 *
 * @example
 * ```typescript
 * const cache = new LRUCache<number[]>({
 *   maxSize: 1000,
 *   ttlMs: 5 * 60 * 1000, // 5분
 *   name: 'embedding'
 * })
 *
 * cache.set('key', [1, 2, 3])
 * const value = cache.get('key')
 * ```
 */
export class LRUCache<T> {
  private cache: Map<string, CacheEntry<T>>
  private readonly maxSize: number
  private readonly ttlMs: number
  private readonly name: string

  // 통계
  private hits = 0
  private misses = 0

  constructor(options: LRUCacheOptions) {
    this.cache = new Map()
    this.maxSize = options.maxSize
    this.ttlMs = options.ttlMs
    this.name = options.name || 'LRUCache'
  }

  // ---------------------------------------------------------------------------
  // Core Methods
  // ---------------------------------------------------------------------------

  /**
   * 캐시에서 값 조회
   *
   * @param key - 캐시 키
   * @returns 캐시된 값 또는 undefined
   */
  get(key: string): T | undefined {
    const entry = this.cache.get(key)

    // 캐시 미스
    if (!entry) {
      this.misses++
      return undefined
    }

    // TTL 만료 확인
    if (this.ttlMs > 0 && Date.now() > entry.expireAt) {
      this.cache.delete(key)
      this.misses++
      return undefined
    }

    // LRU 업데이트: 항목을 맨 뒤로 이동 (가장 최근 사용)
    this.cache.delete(key)
    this.cache.set(key, entry)

    this.hits++
    return entry.value
  }

  /**
   * 캐시에 값 저장
   *
   * @param key - 캐시 키
   * @param value - 저장할 값
   */
  set(key: string, value: T): void {
    // 기존 항목 있으면 삭제 (순서 갱신을 위해)
    if (this.cache.has(key)) {
      this.cache.delete(key)
    }

    // 최대 크기 초과 시 가장 오래된 항목 삭제 (LRU)
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value
      if (oldestKey) {
        this.cache.delete(oldestKey)
      }
    }

    // 새 항목 추가
    const now = Date.now()
    this.cache.set(key, {
      value,
      createdAt: now,
      expireAt: this.ttlMs > 0 ? now + this.ttlMs : Infinity,
    })
  }

  /**
   * 캐시 키 존재 여부 확인
   *
   * @param key - 캐시 키
   * @returns 존재 여부
   */
  has(key: string): boolean {
    const entry = this.cache.get(key)
    if (!entry) return false

    // TTL 만료 확인
    if (this.ttlMs > 0 && Date.now() > entry.expireAt) {
      this.cache.delete(key)
      return false
    }

    return true
  }

  /**
   * 캐시 항목 삭제
   *
   * @param key - 캐시 키
   * @returns 삭제 성공 여부
   */
  delete(key: string): boolean {
    return this.cache.delete(key)
  }

  /**
   * 캐시 전체 삭제
   */
  clear(): void {
    this.cache.clear()
    this.hits = 0
    this.misses = 0
    console.log(`[${this.name}] Cache cleared`)
  }

  // ---------------------------------------------------------------------------
  // Utility Methods
  // ---------------------------------------------------------------------------

  /**
   * 만료된 항목 정리
   *
   * @returns 삭제된 항목 수
   */
  prune(): number {
    if (this.ttlMs <= 0) return 0

    const now = Date.now()
    let pruned = 0

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expireAt) {
        this.cache.delete(key)
        pruned++
      }
    }

    if (pruned > 0) {
      console.log(`[${this.name}] Pruned ${pruned} expired entries`)
    }

    return pruned
  }

  /**
   * 캐시 통계 조회
   *
   * @returns 캐시 통계
   */
  getStats(): CacheStats {
    const total = this.hits + this.misses
    return {
      hits: this.hits,
      misses: this.misses,
      size: this.cache.size,
      maxSize: this.maxSize,
      hitRate: total > 0 ? this.hits / total : 0,
    }
  }

  /**
   * 캐시 크기 조회
   */
  get size(): number {
    return this.cache.size
  }
}

// =============================================================================
// Hash Utility for Cache Keys
// =============================================================================

/**
 * 텍스트의 해시 키 생성
 *
 * @description
 * 긴 텍스트를 캐시 키로 사용하기 위한 간단한 해시 함수
 * 완벽한 해시는 아니지만 캐시 용도로 충분함
 *
 * @param text - 해시할 텍스트
 * @returns 해시 문자열
 */
export function hashText(text: string): string {
  let hash = 0
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // 32비트 정수로 변환
  }
  return hash.toString(36)
}

/**
 * 복합 키 생성
 *
 * @param parts - 키 구성 요소들
 * @returns 조합된 캐시 키
 */
export function createCacheKey(...parts: (string | number | undefined | null)[]): string {
  return parts
    .filter(p => p !== undefined && p !== null)
    .map(p => String(p))
    .join(':')
}
