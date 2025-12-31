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
// [P3-05] Template 컨텍스트 지원
import { type TemplateSchema } from '@/lib/rag/templateTypes'
import { FEATURE_FLAGS } from '@/config/featureFlags'

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
  /** [P5-04-B] 프로젝트 ID (멀티 프로젝트 시스템) */
  projectId?: string
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
    let { userText, category, topK = DEFAULT_TOP_K, projectId } = body  // [P7-04] let으로 변경 (재할당 가능)

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

    // =========================================================================
    // [P7-04] projectId 처리: 기본 프로젝트 할당 및 소유권 검증
    // =========================================================================

    // -------------------------------------------------------------------------
    // [P7-04] projectId 미제공 시 기본 프로젝트 할당
    // -------------------------------------------------------------------------
    if (!projectId) {
      const { data: defaultProject, error: projectError } = await supabase
        .from('projects')
        .select('id')
        .eq('user_id', userId)
        .order('created_at', { ascending: true })
        .limit(1)
        .single()

      if (projectError || !defaultProject) {
        console.warn('[Holistic Evaluate API] No default project found, proceeding without projectId')
        // projectId null로 진행 (하위 호환)
      } else {
        projectId = defaultProject.id
        console.log(`[Holistic Evaluate API] Using default project: ${projectId}`)
      }
    }

    // -------------------------------------------------------------------------
    // [P7-04] projectId 소유권 검증 (보안 강화)
    // -------------------------------------------------------------------------
    if (projectId) {
      const { data: projectOwnership, error: ownerError } = await supabase
        .from('projects')
        .select('id')
        .eq('id', projectId)
        .eq('user_id', userId)
        .single()

      if (ownerError || !projectOwnership) {
        console.warn(`[Holistic Evaluate API] Unauthorized project access: ${projectId}`)
        return NextResponse.json(
          { success: false, message: '해당 프로젝트에 대한 권한이 없습니다.' },
          { status: 403 }
        )
      }
    }

    console.log(`[Holistic Evaluate API] Category: ${category}, Text length: ${userText.length}, ProjectId: ${projectId || 'none'}`)

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
    // 4. [P3-05] Template 예시 컨텍스트 조회
    // -------------------------------------------------------------------------
    let templateExamplesContext = ''
    if (FEATURE_FLAGS.ENABLE_PIPELINE_V5) {
      try {
        const { data: templateData } = await supabase
          .from('rag_templates')
          .select('criteria_json')
          .eq('user_id', userId)
          .eq('status', 'approved')
          .order('created_at', { ascending: false })
          .limit(1)
          .single()

        if (templateData?.criteria_json) {
          const templates = templateData.criteria_json as TemplateSchema[]
          // 긍정/부정 예시가 있는 템플릿만 컨텍스트로 생성
          const templatesWithExamples = templates.filter(t => t.positive_examples.length > 0)
          if (templatesWithExamples.length > 0) {
            templateExamplesContext = templatesWithExamples
              .map(t => `[평가 기준: ${t.rationale}]\n좋은 예: ${t.positive_examples[0]}\n나쁜 예: ${t.negative_examples[0] || '(없음)'}`)
              .join('\n\n')
            console.log(`[Holistic Evaluate API] P3-05: Template ${templatesWithExamples.length}개 기준 컨텍스트 생성`)
          }
        }
      } catch (templateErr) {
        console.warn('[Holistic Evaluate API] Template fetch failed, continuing without:', templateErr)
      }
    }

    // -------------------------------------------------------------------------
    // 5. 종합 평가 수행
    // -------------------------------------------------------------------------
    console.log('[Holistic Evaluate API] Starting holistic evaluation...')
    
    // [P3-05] templateExamplesContext를 4번째 인자로 전달
    const result = await runHolisticEvaluation(
      userText,
      evidenceContext,
      category,
      templateExamplesContext  // [P3-05] Template 예시 컨텍스트
    )

    console.log(`[Holistic Evaluate API] Evaluation complete - Score: ${result.scoreC.overall}`)

    // =========================================================================
    // [P7-04] 평가 결과 저장 (evaluation_logs 테이블)
    // =========================================================================
    try {
      const { data: savedLog, error: saveError } = await supabase
        .from('evaluation_logs')
        .insert({
          user_id: userId,
          project_id: projectId || null,  // [P7-04] 명시적 null 처리
          category: category,
          user_text: userText.substring(0, 1000),  // 최대 1000자
          result_json: result,
          overall_score: result.scoreC.overall,
          created_at: new Date().toISOString()
        })
        .select('id')
        .single()

      if (saveError) {
        console.error('[Holistic Evaluate API] Save failed:', saveError)
        // 저장 실패해도 평가 결과는 반환 (Graceful Degradation)
      } else {
        console.log(`[Holistic Evaluate API] Saved log: ${savedLog?.id}`)
      }
    } catch (saveErr) {
      console.warn('[Holistic Evaluate API] Save exception:', saveErr)
      // 저장 예외 발생해도 평가 결과는 반환 (Graceful Degradation)
    }

    // -------------------------------------------------------------------------
    // 6. 결과 반환
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
