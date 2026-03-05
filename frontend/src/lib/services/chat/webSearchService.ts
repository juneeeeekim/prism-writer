// =============================================================================
// PRISM Writer - Unified Web Search Service
// =============================================================================
// 파일: frontend/src/lib/services/chat/webSearchService.ts
// 역할: Brave Search + Tavily를 통합하여 채팅 내 웹 검색 수행
// 참고: [2603060100 WebSearch Chat Integration P2-01~06]
// 생성일: 2026-03-06
// =============================================================================

import { logger } from '@/lib/utils/logger'
import { searchBrave } from '@/lib/research/braveClient'
import type { BraveWebResult } from '@/lib/research/braveClient'
import { searchTavily } from '@/lib/research/tavilyClient'
import type { TavilySearchResult } from '@/lib/research/tavilyClient'
import { detectTrustBadge } from '@/lib/research/resultSummarizer'
import type { TrustBadge } from '@/lib/research/resultSummarizer'

// =============================================================================
// Types
// =============================================================================

/**
 * 통합 웹 검색 결과
 */
export interface WebSearchResult {
  /** 페이지 제목 */
  title: string
  /** 페이지 URL */
  url: string
  /** 내용 요약 (description 또는 snippet) */
  content: string
  /** 검색 소스 */
  source: 'brave' | 'tavily'
  /** 신뢰도 배지 */
  trustBadge: TrustBadge
  /** 관련도 점수 (0.0 ~ 1.0) */
  score: number
}

/**
 * 웹 검색 옵션
 */
export interface WebSearchOptions {
  /** 검색 쿼리 */
  query: string
  /** Brave Search 활성화 (기본 true) */
  enableBrave?: boolean
  /** Tavily 활성화 (기본: shouldSearchAcademic() 결과) */
  enableTavily?: boolean
  /** 최대 결과 수 (기본 5) */
  maxResults?: number
}

// =============================================================================
// Academic Keyword Detection
// =============================================================================

const ACADEMIC_KEYWORDS_KO = [
  '논문', '연구', '학술', '실험', '통계', '분석', '이론',
  '메타분석', '피어리뷰', '학회', '저널',
]

const ACADEMIC_KEYWORDS_EN = [
  'paper', 'research', 'study', 'journal', 'peer-review',
  'arxiv', 'pubmed', 'doi', 'thesis', 'academic',
]

/**
 * 학술 키워드 감지
 * 쿼리에 학술 관련 키워드가 포함되어 있으면 true 반환
 */
export function shouldSearchAcademic(query: string): boolean {
  const lower = query.toLowerCase()
  return [...ACADEMIC_KEYWORDS_KO, ...ACADEMIC_KEYWORDS_EN]
    .some(kw => lower.includes(kw))
}

// =============================================================================
// Result Converters
// =============================================================================

/**
 * Brave 검색 결과 → WebSearchResult 변환
 */
function convertBraveResults(results: BraveWebResult[]): WebSearchResult[] {
  return results.map((r, i) => ({
    title: r.title ?? '',
    url: r.url ?? '',
    content: r.description ?? r.extra_snippets?.[0] ?? '',
    source: 'brave' as const,
    trustBadge: detectTrustBadge(r.url ?? ''),
    score: Math.max(0.5 - i * 0.05, 0.1),
  }))
}

/**
 * Tavily 검색 결과 → WebSearchResult 변환
 */
function convertTavilyResults(results: TavilySearchResult[]): WebSearchResult[] {
  return results.map(r => ({
    title: r.title ?? '',
    url: r.url ?? '',
    content: r.content ?? '',
    source: 'tavily' as const,
    trustBadge: detectTrustBadge(r.url ?? ''),
    score: r.score ?? 0.3,
  }))
}

// =============================================================================
// Main Function
// =============================================================================

/**
 * 통합 웹 검색 수행
 *
 * @description
 * Brave Search(일반 웹) + Tavily(학술/정부)를 병렬 호출하고
 * 결과를 통합하여 중복 제거 후 반환합니다.
 *
 * - Brave: 항상 호출 (enableBrave=true 기본)
 * - Tavily: 학술 키워드 감지 시에만 호출
 * - URL 기준 중복 제거
 * - score 내림차순 정렬
 *
 * @param query - 검색 쿼리
 * @param options - 검색 옵션 (선택)
 * @returns 통합 검색 결과 배열
 */
export async function performWebSearch(
  query: string,
  options?: Partial<WebSearchOptions>
): Promise<WebSearchResult[]> {
  const maxResults = options?.maxResults ?? 5
  const useBrave = options?.enableBrave ?? true
  const useTavily = options?.enableTavily ?? shouldSearchAcademic(query)

  logger.info('[WebSearch]', `Starting search: brave=${useBrave}, tavily=${useTavily}`, { query: query.slice(0, 50) })

  try {
    // 1. 병렬 호출
    const [braveRaw, tavilyRaw] = await Promise.all([
      useBrave
        ? searchBrave({ query, count: maxResults })
        : Promise.resolve([]),
      useTavily
        ? searchTavily({ query, maxResults }).then(r => r.results)
        : Promise.resolve([]),
    ])

    // 2. 결과 변환
    const braveResults = convertBraveResults(braveRaw)
    const tavilyResults = convertTavilyResults(tavilyRaw)

    // 3. 병합 + URL 중복 제거
    const merged = [...braveResults, ...tavilyResults]
    const seen = new Set<string>()
    const deduped = merged.filter(r => {
      if (!r.url || seen.has(r.url)) return false
      seen.add(r.url)
      return true
    })

    // 4. score 내림차순 정렬 + maxResults 제한
    const final = deduped
      .sort((a, b) => b.score - a.score)
      .slice(0, maxResults)

    logger.info('[WebSearch]', `Completed: brave=${braveRaw.length}, tavily=${tavilyRaw.length}, merged=${final.length}`)
    return final
  } catch (error) {
    logger.error('[WebSearch]', 'Search failed', { error: String(error) })
    return []
  }
}
