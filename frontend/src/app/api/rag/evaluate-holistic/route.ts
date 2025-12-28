// =============================================================================
// PRISM Writer - Holistic Evaluation API
// =============================================================================
// 파일: frontend/src/app/api/rag/evaluate-holistic/route.ts
// 역할: 전체 글에 대한 종합 평가 API (A + B + C)
// 작성일: 2025-12-28
// =============================================================================
// [P2-04] 종합 평가 API 엔드포인트
// - POST: 사용자 글을 받아 종합 평가 결과 반환
// - 인증 필수 (session.user.id)
// - 입력 유효성 검사 (최소 50자)
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { vectorSearch } from '@/lib/rag/search'
import { runHolisticEvaluation } from '@/lib/judge/holisticAdvisor'
import { type HolisticEvaluationResult } from '@/lib/judge/types'

// =============================================================================
// 타입 정의
// =============================================================================

/** 종합 평가 요청 바디 */
interface HolisticEvaluateRequest {
  /** 평가할 사용자 글 */
  userText: string
  /** 글의 카테고리 */
  category: string
  /** 검색 결과 개수 (기본값: 5) */
  topK?: number
}

/** 종합 평가 응답 */
interface HolisticEvaluateResponse {
  success: boolean
  result?: HolisticEvaluationResult
  message?: string
  error?: string
}

// =============================================================================
// 상수
// =============================================================================

const DEFAULT_TOP_K = 5
const MIN_TEXT_LENGTH = 50

// =============================================================================
// POST: 종합 평가 수행
// =============================================================================

export async function POST(request: NextRequest): Promise<NextResponse<HolisticEvaluateResponse>> {
  console.log('[Holistic Evaluate API] Request received')

  try {
    // -------------------------------------------------------------------------
    // 1. 인증 체크
    // -------------------------------------------------------------------------
    const supabase = await createClient()
    const { data: { session }, error: authError } = await supabase.auth.getSession()

    if (authError || !session) {
      console.error('[Holistic Evaluate API] Auth error:', authError)
      return NextResponse.json(
        { success: false, message: '로그인이 필요합니다.' },
        { status: 401 }
      )
    }

    const userId = session.user.id
    console.log(`[Holistic Evaluate API] User: ${userId}`)

    // -------------------------------------------------------------------------
    // 2. 요청 바디 파싱 및 유효성 검사
    // -------------------------------------------------------------------------
    const body: HolisticEvaluateRequest = await request.json()
    const { userText, category, topK = DEFAULT_TOP_K } = body

    // 필수 필드 검증
    if (!userText) {
      return NextResponse.json(
        { success: false, message: '평가할 글(userText)이 필요합니다.' },
        { status: 400 }
      )
    }

    if (!category) {
      return NextResponse.json(
        { success: false, message: '카테고리(category)가 필요합니다.' },
        { status: 400 }
      )
    }

    // 최소 글자 수 검증
    if (userText.trim().length < MIN_TEXT_LENGTH) {
      return NextResponse.json(
        { 
          success: false, 
          message: `글이 너무 짧습니다. 최소 ${MIN_TEXT_LENGTH}자 이상 입력해주세요.` 
        },
        { status: 400 }
      )
    }

    console.log(`[Holistic Evaluate API] Category: ${category}, Text length: ${userText.length}`)

    // -------------------------------------------------------------------------
    // 3. 참고자료 검색 (카테고리 격리 적용)
    // -------------------------------------------------------------------------
    const searchQuery = userText.substring(0, 200) // 검색 쿼리로 앞 200자 사용
    
    let evidenceContext = ''
    try {
      const evidenceResults = await vectorSearch(searchQuery, {
        userId,
        topK,
        minScore: 0.5,
        category: category || null  // 카테고리 격리 적용
      })

      if (evidenceResults.length > 0) {
        evidenceContext = evidenceResults
          .map((r, i) => `[참고자료 ${i + 1}] ${r.content}`)
          .join('\n\n')
        console.log(`[Holistic Evaluate API] Found ${evidenceResults.length} evidence chunks`)
      } else {
        console.log('[Holistic Evaluate API] No evidence found for this category')
      }
    } catch (searchError) {
      console.warn('[Holistic Evaluate API] Evidence search failed:', searchError)
      // 참고자료 검색 실패 시에도 평가는 진행
    }

    // -------------------------------------------------------------------------
    // 4. 종합 평가 수행
    // -------------------------------------------------------------------------
    console.log('[Holistic Evaluate API] Starting holistic evaluation...')
    
    const result = await runHolisticEvaluation(
      userText,
      evidenceContext,
      category
    )

    console.log(`[Holistic Evaluate API] Evaluation complete - Score: ${result.scoreC.overall}`)

    // -------------------------------------------------------------------------
    // 5. 결과 반환
    // -------------------------------------------------------------------------
    return NextResponse.json({
      success: true,
      result
    })

  } catch (error) {
    console.error('[Holistic Evaluate API] Unexpected error:', error)
    return NextResponse.json(
      { 
        success: false, 
        message: '평가 중 오류가 발생했습니다.',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
