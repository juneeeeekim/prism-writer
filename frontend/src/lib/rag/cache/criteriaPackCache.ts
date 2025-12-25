// =============================================================================
// PRISM Writer - Criteria Pack Cache (Pipeline v5)
// =============================================================================
// 파일: frontend/src/lib/rag/cache/criteriaPackCache.ts
// 역할: CriteriaPack 캐싱으로 LLM 호출 3-5배 증가 문제 해결
// 생성일: 2025-12-25
//
// 주석(시니어 개발자): 
// Shadow Workspace 시뮬레이션에서 LLM 호출이 반복되는 문제를 해결합니다.
// 동일 문서에 대한 2회차 이상 요청 시 캐시를 사용하여 비용 절감.
// 목표: 캐시 히트율 > 80%
// =============================================================================

import { isFeatureEnabled } from '@/config/featureFlags'

// =============================================================================
// 타입 정의
// =============================================================================

/**
 * 캐시 항목 인터페이스
 */
interface CacheEntry<T> {
  /** 저장된 데이터 */
  data: T
  /** 생성 시간 (timestamp) */
  createdAt: number
  /** TTL 만료 시간 (timestamp) */
  expiresAt: number
  /** 히트 카운트 */
  hitCount: number
}

/**
 * CriteriaPack 인터페이스
 */
export interface CriteriaPack {
  /** 규칙 목록 */
  rules: Array<{
    id: string
    content: string
    score: number
  }>
  /** 예시 목록 */
  examples: Array<{
    id: string
    content: string
    score: number
  }>
  /** 고정된 항목 ID 목록 */
  pinnedIds: string[]
  /** 문서 ID */
  documentId: string
  /** 템플릿 ID */
  templateId: string
}

/**
 * 캐시 통계 인터페이스
 */
export interface CacheStats {
  /** 총 히트 수 */
  hits: number
  /** 총 미스 수 */
  misses: number
  /** 캐시 히트율 (0-100) */
  hitRate: number
  /** 현재 캐시 크기 */
  size: number
  /** 최대 캐시 크기 */
  maxSize: number
}

// =============================================================================
// 캐시 설정
// =============================================================================

/** 캐시 설정 인터페이스 */
interface CacheConfig {
  /** TTL (밀리초), 기본 5분 */
  ttlMs: number
  /** 최대 캐시 항목 수 */
  maxSize: number
  /** 자동 정리 활성화 */
  autoCleanup: boolean
  /** 정리 주기 (밀리초) */
  cleanupIntervalMs: number
}

const DEFAULT_CONFIG: CacheConfig = {
  ttlMs: 5 * 60 * 1000, // 5분
  maxSize: 100, // 최대 100개 문서
  autoCleanup: true,
  cleanupIntervalMs: 60 * 1000, // 1분마다 정리
}

// =============================================================================
// CriteriaPackCache 클래스
// =============================================================================

/**
 * CriteriaPack 캐시 관리 클래스
 * 
 * @description
 * LLM 호출 비용을 절감하기 위한 인메모리 캐시입니다.
 * 동일 문서에 대한 반복 요청 시 캐시된 CriteriaPack을 반환합니다.
 * 
 * @example
 * ```typescript
 * const cache = CriteriaPackCache.getInstance()
 * 
 * // 캐시 저장
 * cache.set('doc-123', criteriaPack)
 * 
 * // 캐시 조회
 * const cached = cache.get('doc-123')
 * if (cached) {
 *   console.log('Cache hit!')
 * }
 * ```
 */
class CriteriaPackCache {
  // ---------------------------------------------------------------------------
  // 싱글톤 인스턴스
  // ---------------------------------------------------------------------------
  private static instance: CriteriaPackCache | null = null
  
  // ---------------------------------------------------------------------------
  // 캐시 저장소
  // ---------------------------------------------------------------------------
  private cache: Map<string, CacheEntry<CriteriaPack>> = new Map()
  private config: CacheConfig
  private cleanupTimer: NodeJS.Timeout | null = null
  
  // ---------------------------------------------------------------------------
  // 통계
  // ---------------------------------------------------------------------------
  private stats = {
    hits: 0,
    misses: 0,
  }

  // ---------------------------------------------------------------------------
  // 생성자 (private - 싱글톤)
  // ---------------------------------------------------------------------------
  private constructor(config: Partial<CacheConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
    
    // 자동 정리 시작
    if (this.config.autoCleanup && typeof window !== 'undefined') {
      this.startAutoCleanup()
    }
  }

  // ---------------------------------------------------------------------------
  // 싱글톤 접근자
  // ---------------------------------------------------------------------------
  /**
   * 싱글톤 인스턴스 가져오기
   */
  public static getInstance(config?: Partial<CacheConfig>): CriteriaPackCache {
    if (!CriteriaPackCache.instance) {
      CriteriaPackCache.instance = new CriteriaPackCache(config)
    }
    return CriteriaPackCache.instance
  }

  /**
   * 인스턴스 리셋 (테스트용)
   */
  public static resetInstance(): void {
    if (CriteriaPackCache.instance) {
      CriteriaPackCache.instance.destroy()
      CriteriaPackCache.instance = null
    }
  }

  // ---------------------------------------------------------------------------
  // 캐시 키 생성
  // ---------------------------------------------------------------------------
  /**
   * 문서 ID와 템플릿 ID로 캐시 키 생성
   */
  private generateKey(documentId: string, templateId?: string): string {
    return templateId ? `${documentId}:${templateId}` : documentId
  }

  // ---------------------------------------------------------------------------
  // 캐시 CRUD
  // ---------------------------------------------------------------------------
  
  /**
   * 캐시에 CriteriaPack 저장
   */
  public set(
    documentId: string, 
    criteriaPack: CriteriaPack,
    templateId?: string,
    ttlMs?: number
  ): void {
    const key = this.generateKey(documentId, templateId)
    const now = Date.now()
    const ttl = ttlMs || this.config.ttlMs
    
    // 캐시 크기 제한 확인
    if (this.cache.size >= this.config.maxSize) {
      this.evictOldest()
    }
    
    this.cache.set(key, {
      data: criteriaPack,
      createdAt: now,
      expiresAt: now + ttl,
      hitCount: 0,
    })
  }

  /**
   * 캐시에서 CriteriaPack 조회
   */
  public get(documentId: string, templateId?: string): CriteriaPack | null {
    const key = this.generateKey(documentId, templateId)
    const entry = this.cache.get(key)
    
    if (!entry) {
      this.stats.misses++
      return null
    }
    
    // TTL 만료 확인
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key)
      this.stats.misses++
      return null
    }
    
    // 히트 카운트 증가
    entry.hitCount++
    this.stats.hits++
    
    return entry.data
  }

  /**
   * 특정 캐시 항목 삭제
   */
  public delete(documentId: string, templateId?: string): boolean {
    const key = this.generateKey(documentId, templateId)
    return this.cache.delete(key)
  }

  /**
   * 캐시 전체 삭제
   */
  public clear(): void {
    this.cache.clear()
    this.stats.hits = 0
    this.stats.misses = 0
  }

  /**
   * 캐시 존재 여부 확인
   */
  public has(documentId: string, templateId?: string): boolean {
    const key = this.generateKey(documentId, templateId)
    const entry = this.cache.get(key)
    
    if (!entry) return false
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key)
      return false
    }
    
    return true
  }

  // ---------------------------------------------------------------------------
  // 캐시 관리
  // ---------------------------------------------------------------------------
  
  /**
   * 만료된 항목 정리
   */
  public cleanup(): number {
    const now = Date.now()
    let removed = 0
    
    Array.from(this.cache.entries()).forEach(([key, entry]) => {
      if (now > entry.expiresAt) {
        this.cache.delete(key)
        removed++
      }
    })
    
    return removed
  }

  /**
   * 가장 오래된 항목 제거 (LRU)
   */
  private evictOldest(): void {
    let oldestKey: string | null = null
    let oldestTime = Infinity
    
    Array.from(this.cache.entries()).forEach(([key, entry]) => {
      if (entry.createdAt < oldestTime) {
        oldestTime = entry.createdAt
        oldestKey = key
      }
    })
    
    if (oldestKey) {
      this.cache.delete(oldestKey)
    }
  }

  /**
   * 자동 정리 시작
   */
  private startAutoCleanup(): void {
    if (this.cleanupTimer) return
    
    this.cleanupTimer = setInterval(() => {
      this.cleanup()
    }, this.config.cleanupIntervalMs)
  }

  /**
   * 캐시 정리 및 타이머 해제
   */
  public destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
      this.cleanupTimer = null
    }
    this.cache.clear()
  }

  // ---------------------------------------------------------------------------
  // 통계
  // ---------------------------------------------------------------------------
  
  /**
   * 캐시 통계 조회
   */
  public getStats(): CacheStats {
    const total = this.stats.hits + this.stats.misses
    const hitRate = total > 0 ? (this.stats.hits / total) * 100 : 0
    
    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRate: Math.round(hitRate * 10) / 10,
      size: this.cache.size,
      maxSize: this.config.maxSize,
    }
  }

  /**
   * 통계 리셋
   */
  public resetStats(): void {
    this.stats.hits = 0
    this.stats.misses = 0
  }
}

// =============================================================================
// 편의 함수 Export
// =============================================================================

/**
 * CriteriaPack 캐시 인스턴스 가져오기
 */
export function getCriteriaPackCache(): CriteriaPackCache {
  return CriteriaPackCache.getInstance()
}

/**
 * CriteriaPack 캐시 조회 (Feature Flag 적용)
 */
export function getCachedCriteriaPack(
  documentId: string,
  templateId?: string
): CriteriaPack | null {
  // Pipeline v5가 비활성화되면 캐시 사용 안함
  if (!isFeatureEnabled('ENABLE_PIPELINE_V5')) {
    return null
  }
  
  return getCriteriaPackCache().get(documentId, templateId)
}

/**
 * CriteriaPack 캐시 저장 (Feature Flag 적용)
 */
export function setCachedCriteriaPack(
  documentId: string,
  criteriaPack: CriteriaPack,
  templateId?: string
): void {
  // Pipeline v5가 비활성화되면 캐시 저장 안함
  if (!isFeatureEnabled('ENABLE_PIPELINE_V5')) {
    return
  }
  
  getCriteriaPackCache().set(documentId, criteriaPack, templateId)
}

/**
 * 캐시 통계 로그 출력
 */
export function logCacheStats(): void {
  const stats = getCriteriaPackCache().getStats()
  console.log('[CriteriaPackCache] Stats:', stats)
}

export { CriteriaPackCache }
