// 디렉토리 경로: frontend/src/lib/research/
// 파일명: resultMetadata.ts
// 파일 코드의 역할/설명: 검색 결과 표시에서 브라우저와 서버가 함께 쓰는 타입과 순수 유틸을 제공한다.

/**
 * Reliability badge for a search result source.
 */
export type TrustBadge = 'academic' | 'government' | 'news' | 'other'

/**
 * Summarized search result displayed in research UI and persisted in history.
 */
export interface SummarizedResult {
  title: string
  url: string
  source: string
  keyFact: string
  summary: string
  trustBadge: TrustBadge
  publishedDate?: string
}

/**
 * Infers a source reliability badge from a result URL.
 */
export function detectTrustBadge(url: string): TrustBadge {
  const lowerUrl = url.toLowerCase()

  if (
    lowerUrl.includes('.edu') ||
    lowerUrl.includes('arxiv.org') ||
    lowerUrl.includes('scholar.google') ||
    lowerUrl.includes('pubmed') ||
    lowerUrl.includes('nature.com') ||
    lowerUrl.includes('science.org') ||
    lowerUrl.includes('ieee.org') ||
    lowerUrl.includes('acm.org') ||
    lowerUrl.includes('springer.com') ||
    lowerUrl.includes('wiley.com') ||
    lowerUrl.includes('sciencedirect.com')
  ) {
    return 'academic'
  }

  if (
    lowerUrl.includes('.gov') ||
    lowerUrl.includes('.go.kr') ||
    lowerUrl.includes('europa.eu')
  ) {
    return 'government'
  }

  if (
    lowerUrl.includes('reuters.com') ||
    lowerUrl.includes('apnews.com') ||
    lowerUrl.includes('bbc.com') ||
    lowerUrl.includes('nytimes.com') ||
    lowerUrl.includes('wsj.com') ||
    lowerUrl.includes('bloomberg.com') ||
    lowerUrl.includes('statista.com')
  ) {
    return 'news'
  }

  return 'other'
}

export function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return 'unknown'
  }
}
