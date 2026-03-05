// =============================================================================
// PRISM Writer - Brave Search API Client
// =============================================================================
// 파일: frontend/src/lib/research/braveClient.ts
// 역할: Brave Web Search API를 통한 일반 웹 검색
// 참고: [2603060100 WebSearch Chat Integration P1-01~03]
// 생성일: 2026-03-06
// =============================================================================

import { logger } from '@/lib/utils/logger'

// =============================================================================
// Constants
// =============================================================================

const BRAVE_API_URL = 'https://api.search.brave.com/res/v1/web/search'

// =============================================================================
// Types
// =============================================================================

/**
 * Brave Search 검색 옵션
 */
export interface BraveSearchOptions {
  /** 검색 쿼리 */
  query: string
  /** 결과 수 (기본 5) */
  count?: number
  /** 시간 필터: 'pd' (1일), 'pw' (1주), 'pm' (1개월), 'py' (1년) */
  freshness?: string
  /** 국가 코드 (기본 'KR') */
  country?: string
  /** 검색 언어 (기본 'ko') */
  searchLang?: string
}

/**
 * Brave Search 개별 검색 결과
 */
export interface BraveWebResult {
  title: string
  url: string
  description: string
  age?: string
  extra_snippets?: string[]
}

/**
 * Brave Search API 응답 구조
 */
export interface BraveSearchResponse {
  query?: { original: string }
  web?: { results: BraveWebResult[] }
}

// =============================================================================
// Main Function
// =============================================================================

/**
 * Brave Web Search API 호출
 *
 * @description
 * 일반 웹 검색을 수행합니다.
 * API 키 미설정 또는 Rate Limit 시 빈 배열을 반환합니다 (graceful degradation).
 *
 * @param options - 검색 옵션
 * @returns 검색 결과 배열 (실패 시 빈 배열)
 */
export async function searchBrave(options: BraveSearchOptions): Promise<BraveWebResult[]> {
  const apiKey = process.env.BRAVE_API_KEY
  if (!apiKey) {
    logger.warn('[BraveClient]', 'BRAVE_API_KEY not set, skipping')
    return []
  }

  try {
    const params = new URLSearchParams({
      q: options.query,
      count: String(options.count ?? 5),
      country: options.country ?? 'KR',
      search_lang: options.searchLang ?? 'ko',
    })

    if (options.freshness) {
      params.set('freshness', options.freshness)
    }

    const response = await fetch(`${BRAVE_API_URL}?${params}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip',
        'X-Subscription-Token': apiKey,
      },
      signal: AbortSignal.timeout(5000),
    })

    if (!response.ok) {
      if (response.status === 429) {
        logger.warn('[BraveClient]', 'Rate limited (429), skipping')
        return []
      }
      logger.error('[BraveClient]', `API error: ${response.status} ${response.statusText}`)
      return []
    }

    const data: BraveSearchResponse = await response.json()
    const results = data?.web?.results ?? []

    logger.info('[BraveClient]', `Returned ${results.length} results`, { query: options.query })
    return results
  } catch (error) {
    if (error instanceof DOMException && error.name === 'TimeoutError') {
      logger.warn('[BraveClient]', 'Request timed out (5s), skipping')
    } else {
      logger.error('[BraveClient]', 'Search failed', { error: String(error) })
    }
    return []
  }
}
