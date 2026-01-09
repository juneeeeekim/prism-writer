// =============================================================================
// PRISM Writer - Research API Endpoint
// =============================================================================
// 파일: frontend/src/app/api/research/route.ts
// 역할: Deep Scholar 외부 검색 API
// 기능: Tavily를 통한 학술/정부 자료 검색 + LLM 요약
// 참고: [Deep Scholar 체크리스트 P1-02]
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/utils/logger'

// Research 모듈
// [다국어 검색 P1-02] 언어별 도메인 상수 import (2026-01-09 추가)
import {
  searchTavily,
  TRUSTED_ACADEMIC_DOMAINS,
  TRUSTED_GOVERNMENT_DOMAINS,
  TRUSTED_EDU_DOMAINS,
  INTERNATIONAL_ACADEMIC_DOMAINS,
  KOREAN_ACADEMIC_DOMAINS,
} from '@/lib/research/tavilyClient'
import { generateSearchQuery } from '@/lib/research/queryGenerator'
import { summarizeResults, type SummarizedResult } from '@/lib/research/resultSummarizer'

// =============================================================================
// Types
// =============================================================================

interface ResearchRequest {
  /** 사용자 검색 요청 */
  userQuery: string
  /** 에디터 현재 문맥 (드래그한 텍스트 등) */
  context?: string
  /** 검색 모드 */
  mode?: 'academic' | 'news' | 'all'
  /** [다국어 검색 P1-02] 검색 언어 (2026-01-09 추가) */
  language?: 'ko' | 'en' | 'all'
  /** 최대 결과 수 */
  maxResults?: number
}

interface ResearchResponse {
  success: boolean
  results: SummarizedResult[]
  rawQuery: string
  message?: string
  error?: string
}

// =============================================================================
// Constants
// =============================================================================

/** 학술 검색용 도메인 */
const ACADEMIC_DOMAINS = [
  ...TRUSTED_ACADEMIC_DOMAINS,
  ...TRUSTED_GOVERNMENT_DOMAINS,
  ...TRUSTED_EDU_DOMAINS,
]

// =============================================================================
// POST /api/research
// =============================================================================

/**
 * Deep Scholar 검색 API
 *
 * @description
 * [시니어 개발자 주석]
 * 1. 인증 체크 (로그인 필수)
 * 2. 요청 검증 (빈 쿼리 거부)
 * 3. LLM으로 검색 쿼리 생성
 * 4. Tavily API 검색 (학술/정부 도메인 한정)
 * 5. LLM으로 결과 요약 및 핵심 팩트 추출
 * 6. Graceful Degradation (실패 시 빈 결과 반환)
 *
 * @example
 * POST /api/research
 * {
 *   "userQuery": "AI 시장 규모 통계 찾아줘",
 *   "context": "인공지능 기술의 발전으로..."
 * }
 */
export async function POST(req: NextRequest): Promise<NextResponse<ResearchResponse>> {
  const startTime = Date.now()

  logger.info('[Research API]', '요청 시작')

  // ---------------------------------------------------------------------------
  // [P1-02-01] 인증 체크
  // ---------------------------------------------------------------------------
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    logger.warn('[Research API]', '인증 실패: 로그인 필요')
    return NextResponse.json(
      { 
        success: false, 
        results: [],
        rawQuery: '',
        error: 'Unauthorized' 
      },
      { status: 401 }
    )
  }

  // ---------------------------------------------------------------------------
  // [P1-02-02] 요청 파싱 및 검증
  // ---------------------------------------------------------------------------
  let body: ResearchRequest

  try {
    body = await req.json()
  } catch {
    logger.warn('[Research API]', '잘못된 요청 형식')
    return NextResponse.json(
      { 
        success: false, 
        results: [],
        rawQuery: '',
        error: 'Invalid JSON body' 
      },
      { status: 400 }
    )
  }

  // [다국어 검색 P1-02] language 파라미터 추가 (2026-01-09)
  const { userQuery, context = '', mode = 'academic', language = 'all', maxResults = 5 } = body

  // 빈 쿼리 검증
  if (!userQuery || userQuery.trim().length === 0) {
    logger.warn('[Research API]', '빈 쿼리 요청')
    return NextResponse.json(
      {
        success: false,
        results: [],
        rawQuery: '',
        error: 'userQuery is required'
      },
      { status: 400 }
    )
  }

  logger.info('[Research API]', '요청 파싱 완료', {
    userQuery,
    contextLength: context.length,
    mode,
    language,  // [다국어 검색] 로깅 추가
  })

  // ---------------------------------------------------------------------------
  // [P1-02-03] LLM으로 검색 쿼리 생성
  // [다국어 검색] language 파라미터 전달 (2026-01-09)
  // ---------------------------------------------------------------------------
  let searchQuery: string

  try {
    searchQuery = await generateSearchQuery(userQuery, context, language)
  } catch (error) {
    logger.warn('[Research API]', '쿼리 생성 실패, 원본 쿼리 사용', {
      error: error instanceof Error ? error.message : String(error)
    })
    searchQuery = userQuery  // Fallback
  }

  // ---------------------------------------------------------------------------
  // [P1-02-04] Tavily API 검색
  // [다국어 검색] 언어별 도메인 선택 로직 (2026-01-09)
  // ---------------------------------------------------------------------------
  let tavilyResults

  try {
    // [다국어 검색 P1-02-B] 언어에 따른 도메인 설정
    let includeDomains: string[] | undefined

    if (mode === 'academic') {
      switch (language) {
        case 'ko':
          // 한국어: 한국 학술 도메인만
          includeDomains = KOREAN_ACADEMIC_DOMAINS
          logger.info('[Research API]', '한국어 검색 모드', { domains: includeDomains })
          break
        case 'en':
          // English: 국제 학술 도메인만
          includeDomains = INTERNATIONAL_ACADEMIC_DOMAINS
          logger.info('[Research API]', '영어 검색 모드', { domains: includeDomains })
          break
        case 'all':
        default:
          // 모든 언어: 전체 도메인
          includeDomains = [...KOREAN_ACADEMIC_DOMAINS, ...INTERNATIONAL_ACADEMIC_DOMAINS]
          logger.info('[Research API]', '전체 언어 검색 모드', { domainCount: includeDomains.length })
      }
    }

    tavilyResults = await searchTavily({
      query: searchQuery,
      searchDepth: 'advanced',
      includeDomains,
      maxResults,
    })

    logger.info('[Research API]', 'Tavily 검색 완료', { 
      resultCount: tavilyResults.results.length 
    })

  } catch (error) {
    // Graceful Degradation: Tavily 실패 시 빈 결과 반환
    logger.error('[Research API]', 'Tavily 검색 실패', {
      error: error instanceof Error ? error.message : String(error)
    })

    return NextResponse.json({
      success: true,  // 에러가 아닌 빈 결과로 처리
      results: [],
      rawQuery: searchQuery,
      message: '검색 결과를 가져오는 중 문제가 발생했습니다. 잠시 후 다시 시도해주세요.',
    })
  }

  // ---------------------------------------------------------------------------
  // [P1-02-05] LLM으로 결과 요약
  // ---------------------------------------------------------------------------
  let summarizedResults: SummarizedResult[]

  try {
    summarizedResults = await summarizeResults(tavilyResults.results)
  } catch (error) {
    logger.warn('[Research API]', '결과 요약 실패, Raw 결과 반환', {
      error: error instanceof Error ? error.message : String(error)
    })

    // Fallback: Raw 결과를 그대로 반환
    summarizedResults = tavilyResults.results.map(r => ({
      title: r.title,
      url: r.url,
      source: new URL(r.url).hostname,
      keyFact: r.content.substring(0, 100),
      summary: r.content.substring(0, 200),
      trustBadge: 'other' as const,
      publishedDate: r.publishedDate,
    }))
  }

  // ---------------------------------------------------------------------------
  // [P1-02-06] 응답 반환
  // ---------------------------------------------------------------------------
  const duration = Date.now() - startTime

  logger.info('[Research API]', '요청 완료', { 
    resultCount: summarizedResults.length,
    duration: `${duration}ms`
  })

  return NextResponse.json({
    success: true,
    results: summarizedResults,
    rawQuery: searchQuery,
  })
}
