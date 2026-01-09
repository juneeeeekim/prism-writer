// =============================================================================
// PRISM Writer - Tavily Search API Client
// =============================================================================
// 파일: frontend/src/lib/research/tavilyClient.ts
// 역할: Tavily API를 통한 학술/정부 도메인 검색
// 참고: [Deep Scholar 체크리스트 P1-01]
// =============================================================================

import { logger } from '@/lib/utils/logger'

// =============================================================================
// Types
// =============================================================================

/**
 * Tavily 검색 옵션
 */
export interface TavilySearchOptions {
  /** 검색 쿼리 */
  query: string
  /** 검색 깊이 (basic: 빠름, advanced: 상세) */
  searchDepth?: 'basic' | 'advanced'
  /** 포함할 도메인 (예: ['scholar.google.com', 'arxiv.org']) */
  includeDomains?: string[]
  /** 제외할 도메인 (예: ['medium.com', 'reddit.com']) */
  excludeDomains?: string[]
  /** 최대 결과 수 */
  maxResults?: number
}

/**
 * Tavily 검색 결과 (개별 항목)
 */
export interface TavilySearchResult {
  /** 페이지 제목 */
  title: string
  /** 페이지 URL */
  url: string
  /** 페이지 내용 요약 (Tavily가 자동 추출) */
  content: string
  /** 관련도 점수 (0-1) */
  score: number
  /** 발행일 (옵션) */
  publishedDate?: string
}

/**
 * Tavily API 응답
 */
export interface TavilyResponse {
  /** 검색 결과 배열 */
  results: TavilySearchResult[]
  /** 원본 검색 쿼리 */
  query: string
}

// =============================================================================
// Constants
// =============================================================================

/** Tavily API 엔드포인트 */
const TAVILY_API_URL = 'https://api.tavily.com/search'

/** 기본 제외 도메인 (블로그, SNS 등) */
const DEFAULT_EXCLUDE_DOMAINS = [
  'medium.com',
  'reddit.com',
  'quora.com',
  'twitter.com',
  'facebook.com',
  'linkedin.com',
  'pinterest.com',
  'instagram.com',
  'tiktok.com',
]

/** 학술/정부 신뢰 도메인 */
export const TRUSTED_ACADEMIC_DOMAINS = [
  'scholar.google.com',
  'arxiv.org',
  'pubmed.ncbi.nlm.nih.gov',
  'nature.com',
  'science.org',
  'ieee.org',
  'acm.org',
  'sciencedirect.com',
  'springer.com',
  'wiley.com',
]

export const TRUSTED_GOVERNMENT_DOMAINS = [
  '.gov',
  '.gov.uk',
  '.go.kr',
  '.gc.ca',
  'europa.eu',
]

export const TRUSTED_EDU_DOMAINS = [
  '.edu',
  '.ac.uk',
  '.ac.kr',
  '.edu.au',
]

// =============================================================================
// Main Function: searchTavily
// =============================================================================

/**
 * Tavily API를 통해 검색을 수행합니다.
 *
 * @description
 * [시니어 개발자 주석]
 * - 학술/정부 도메인 검색에 최적화
 * - 블로그/SNS는 기본 제외
 * - API 키 없으면 에러 throw
 *
 * @param options - 검색 옵션
 * @returns 검색 결과
 * @throws Error - API 키 미설정 또는 API 호출 실패 시
 *
 * @example
 * const results = await searchTavily({
 *   query: '2024 AI market size statistics',
 *   includeDomains: ['arxiv.org', '.edu'],
 *   maxResults: 5,
 * });
 */
export async function searchTavily(
  options: TavilySearchOptions
): Promise<TavilyResponse> {
  // ---------------------------------------------------------------------------
  // [P1-01-01] API 키 검증
  // ---------------------------------------------------------------------------
  const apiKey = process.env.TAVILY_API_KEY
  if (!apiKey) {
    logger.error('[Tavily]', 'API 키가 설정되지 않았습니다. TAVILY_API_KEY 환경 변수를 확인하세요.')
    throw new Error('[Tavily] API 키가 설정되지 않았습니다.')
  }

  // ---------------------------------------------------------------------------
  // [P1-01-02] 요청 본문 구성
  // ---------------------------------------------------------------------------
  const requestBody = {
    api_key: apiKey,
    query: options.query,
    search_depth: options.searchDepth || 'advanced',
    include_domains: options.includeDomains || [],
    exclude_domains: options.excludeDomains || DEFAULT_EXCLUDE_DOMAINS,
    max_results: options.maxResults || 5,
    include_answer: false,  // Raw 결과만 받음 (LLM 요약은 별도 처리)
    include_raw_content: false,  // 페이지 전체 내용 제외 (비용 절약)
  }

  logger.info('[Tavily]', `검색 시작: "${options.query}"`)
  logger.debug('[Tavily]', '요청 옵션', {
    searchDepth: requestBody.search_depth,
    includeDomains: requestBody.include_domains,
    maxResults: requestBody.max_results,
  })

  // ---------------------------------------------------------------------------
  // [P1-01-03] API 호출
  // ---------------------------------------------------------------------------
  try {
    const response = await fetch(TAVILY_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    })

    // ---------------------------------------------------------------------------
    // [P1-01-04] 응답 검증
    // ---------------------------------------------------------------------------
    if (!response.ok) {
      const errorText = await response.text()
      logger.error('[Tavily]', `API 호출 실패: ${response.status}`, { errorText })
      throw new Error(`[Tavily] API 호출 실패: ${response.status}`)
    }

    const data = await response.json()

    // ---------------------------------------------------------------------------
    // [P1-01-05] 결과 로깅 및 반환
    // ---------------------------------------------------------------------------
    logger.info('[Tavily]', `검색 완료: ${data.results?.length || 0}개 결과`)

    return {
      results: data.results || [],
      query: options.query,
    }

  } catch (error) {
    // ---------------------------------------------------------------------------
    // [P1-01-06] 에러 핸들링
    // ---------------------------------------------------------------------------
    if (error instanceof Error && error.message.includes('[Tavily]')) {
      throw error  // 이미 포맷된 에러는 그대로 전달
    }

    logger.error('[Tavily]', '네트워크 에러', { error: error instanceof Error ? error.message : String(error) })
    throw new Error(`[Tavily] 검색 중 오류 발생: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

// =============================================================================
// Helper: 학술 검색 프리셋
// =============================================================================

/**
 * 학술 검색 프리셋 (논문, 교육기관, 정부기관)
 *
 * @description
 * [주니어 개발자 주석]
 * - 논문/학술 자료 검색에 최적화된 프리셋
 * - arxiv, pubmed, .edu, .gov 도메인 포함
 */
export async function searchAcademic(query: string, maxResults = 5): Promise<TavilyResponse> {
  return searchTavily({
    query,
    searchDepth: 'advanced',
    includeDomains: [
      ...TRUSTED_ACADEMIC_DOMAINS,
      ...TRUSTED_GOVERNMENT_DOMAINS,
      ...TRUSTED_EDU_DOMAINS,
    ],
    maxResults,
  })
}

/**
 * 뉴스/통계 검색 프리셋
 *
 * @description
 * 신뢰할 수 있는 뉴스 및 통계 기관 검색
 */
export async function searchNews(query: string, maxResults = 5): Promise<TavilyResponse> {
  return searchTavily({
    query,
    searchDepth: 'basic',  // 뉴스는 빠른 검색으로 충분
    includeDomains: [
      'reuters.com',
      'apnews.com',
      'bbc.com',
      'nytimes.com',
      'wsj.com',
      'bloomberg.com',
      'statista.com',
    ],
    maxResults,
  })
}
