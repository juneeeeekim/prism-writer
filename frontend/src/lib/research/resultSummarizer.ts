// =============================================================================
// PRISM Writer - Research Result Summarizer
// =============================================================================
// 파일: frontend/src/lib/research/resultSummarizer.ts
// 역할: 검색 결과를 LLM으로 요약하고 핵심 팩트 추출
// 참고: [Deep Scholar 체크리스트 P1-04]
// =============================================================================

import { generateText } from '@/lib/llm/gateway'
import { logger } from '@/lib/utils/logger'
import type { TavilySearchResult } from './tavilyClient'

// =============================================================================
// Types
// =============================================================================

/**
 * 신뢰도 뱃지 유형
 */
export type TrustBadge = 'academic' | 'government' | 'news' | 'other'

/**
 * 요약된 검색 결과
 */
export interface SummarizedResult {
  /** 페이지 제목 */
  title: string
  /** 페이지 URL */
  url: string
  /** 출처명 (예: "Stanford AI Index") */
  source: string
  /** 핵심 팩트 (숫자, 통계 등) */
  keyFact: string
  /** 2-3문장 요약 */
  summary: string
  /** 신뢰도 뱃지 */
  trustBadge: TrustBadge
  /** 발행일 */
  publishedDate?: string
}

// =============================================================================
// Constants
// =============================================================================

/**
 * 결과 요약 프롬프트
 *
 * @description
 * [UX 전문가 주석]
 * - keyFact: 가장 중요한 숫자/통계를 한 문장으로
 * - summary: 2-3문장으로 간결하게
 * - JSON 형식 출력 필수
 */
const SUMMARIZE_PROMPT = `당신은 팩트 체크 전문가입니다.
아래 검색 결과에서 핵심 팩트와 요약을 추출하세요.

[규칙]
1. keyFact: 숫자, 통계, 핵심 주장을 한 문장으로 정리
2. summary: 2-3문장으로 내용 요약
3. source: 출처 기관/저자명
4. 반드시 JSON 형식으로 출력

[검색 결과]
제목: {title}
URL: {url}
내용: {content}

[출력 형식]
{"source": "...", "keyFact": "...", "summary": "..."}`

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * URL에서 신뢰도 뱃지 추출
 *
 * @description
 * [시니어 개발자 주석]
 * - .edu, arxiv.org 등 학술 도메인 → academic
 * - .gov 등 정부 도메인 → government
 * - 신뢰할 수 있는 뉴스 → news
 * - 그 외 → other
 */
export function detectTrustBadge(url: string): TrustBadge {
  const lowerUrl = url.toLowerCase()

  // 학술 도메인
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

  // 정부 도메인
  if (
    lowerUrl.includes('.gov') ||
    lowerUrl.includes('.go.kr') ||
    lowerUrl.includes('europa.eu')
  ) {
    return 'government'
  }

  // 신뢰할 수 있는 뉴스/저널
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

/**
 * URL에서 도메인명 추출
 */
function extractDomain(url: string): string {
  try {
    const hostname = new URL(url).hostname
    // www. 제거
    return hostname.replace(/^www\./, '')
  } catch {
    return '알 수 없음'
  }
}

// =============================================================================
// Main Function: summarizeResults
// =============================================================================

/**
 * 검색 결과를 LLM으로 요약합니다.
 *
 * @description
 * [시니어 개발자 주석]
 * - Top 3만 처리 (비용 절약)
 * - LLM 파싱 실패 시 Raw 데이터 fallback
 * - 병렬 처리로 속도 향상
 *
 * @param results - Tavily 검색 결과 배열
 * @returns 요약된 결과 배열
 *
 * @example
 * const summarized = await summarizeResults(tavilyResults);
 * // [{ title, url, source, keyFact, summary, trustBadge, ... }]
 */
export async function summarizeResults(
  results: TavilySearchResult[]
): Promise<SummarizedResult[]> {
  // ---------------------------------------------------------------------------
  // [P1-04-01] Top 3만 처리 (비용 제어)
  // ---------------------------------------------------------------------------
  const topResults = results.slice(0, 3)

  logger.info('[ResultSummarizer]', '결과 요약 시작', { count: topResults.length })

  // ---------------------------------------------------------------------------
  // [P1-04-02] 병렬 처리
  // ---------------------------------------------------------------------------
  const summarizedPromises = topResults.map(async (result) => {
    try {
      // -------------------------------------------------------------------------
      // [P1-04-03] LLM 프롬프트 구성
      // -------------------------------------------------------------------------
      const prompt = SUMMARIZE_PROMPT
        .replace('{title}', result.title)
        .replace('{url}', result.url)
        .replace('{content}', result.content.substring(0, 1000))  // 1000자 제한

      // -------------------------------------------------------------------------
      // [P1-04-04] LLM 호출
      // -------------------------------------------------------------------------
      const response = await generateText(prompt, {
        model: 'gemini-2.0-flash',
        maxOutputTokens: 200,
        temperature: 0.2,  // 낮은 temperature로 정확성 유지
      })

      // -------------------------------------------------------------------------
      // [P1-04-05] JSON 파싱
      // -------------------------------------------------------------------------
      // JSON 블록 추출 (```json ... ``` 형식 처리)
      let jsonText = response.text.trim()
      if (jsonText.includes('```json')) {
        jsonText = jsonText.replace(/```json\s*/g, '').replace(/```\s*/g, '')
      }
      if (jsonText.includes('```')) {
        jsonText = jsonText.replace(/```/g, '')
      }

      const parsed = JSON.parse(jsonText)

      return {
        title: result.title,
        url: result.url,
        source: parsed.source || extractDomain(result.url),
        keyFact: parsed.keyFact || result.content.substring(0, 100),
        summary: parsed.summary || result.content.substring(0, 200),
        trustBadge: detectTrustBadge(result.url),
        publishedDate: result.publishedDate,
      }

    } catch (error) {
      // -------------------------------------------------------------------------
      // [P1-04-06] Fallback: LLM 파싱 실패 시 Raw 데이터 사용
      // -------------------------------------------------------------------------
      logger.warn('[ResultSummarizer]', 'LLM 요약 실패, Raw 데이터 사용', {
        url: result.url,
        error: error instanceof Error ? error.message : String(error),
      })

      return {
        title: result.title,
        url: result.url,
        source: extractDomain(result.url),
        keyFact: result.content.substring(0, 100) + '...',
        summary: result.content.substring(0, 200) + '...',
        trustBadge: detectTrustBadge(result.url),
        publishedDate: result.publishedDate,
      }
    }
  })

  // ---------------------------------------------------------------------------
  // [P1-04-07] 결과 수집
  // ---------------------------------------------------------------------------
  const summarized = await Promise.all(summarizedPromises)

  logger.info('[ResultSummarizer]', '결과 요약 완료', { count: summarized.length })

  return summarized
}
