// =============================================================================
// PRISM Writer - Single Criteria Evaluation API
// =============================================================================
// 파일: frontend/src/app/api/rag/evaluate-single/route.ts
// 역할: 특정 평가 항목(criteria)만 재평가하는 API 엔드포인트
// 생성일: 2025-12-27 (Phase 8-A)
// =============================================================================

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// v3 Imports
import { runAlignJudge } from '@/lib/judge/alignJudge'
import { runUpgradePlanner } from '@/lib/judge/upgradePlanner'
import { type JudgeResult, type UpgradePlan } from '@/lib/judge/types'
import { type TemplateSchema } from '@/lib/rag/templateTypes'
import { vectorSearch } from '@/lib/rag/search'
import { DEFAULT_RUBRICS } from '@/lib/rag/rubrics'
import { RubricAdapter } from '@/lib/rag/rubricAdapter'

// =============================================================================
// 타입 정의
// =============================================================================

/** 단일 평가 요청 바디 */
interface EvaluateSingleRequest {
  /** 평가할 사용자 글 */
  userText: string
  /** 재평가할 Criteria ID */
  criteriaId: string
  /** RAG 검색 결과 개수 */
  topK?: number
}

/** 단일 평가 응답 */
interface EvaluateSingleResponse {
  success: boolean
  judgment?: JudgeResult
  upgradePlan?: UpgradePlan
  message?: string
  error?: string
}

// =============================================================================
// 상수
// =============================================================================

/** 최소 글 길이 */
const MIN_TEXT_LENGTH = 50

/** 기본 검색 결과 개수 */
const DEFAULT_TOP_K = 5

// =============================================================================
// POST: 단일 Criteria 재평가 실행
// =============================================================================

export async function POST(
  request: Request
): Promise<NextResponse<EvaluateSingleResponse>> {
  try {
    // -------------------------------------------------------------------------
    // 1. 사용자 인증 확인
    // -------------------------------------------------------------------------
    const supabase = createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        {
          success: false,
          message: '로그인이 필요합니다.',
          error: 'UNAUTHORIZED',
        },
        { status: 401 }
      )
    }

    // -------------------------------------------------------------------------
    // 2. 요청 바디 파싱 및 검증
    // -------------------------------------------------------------------------
    const body = (await request.json()) as EvaluateSingleRequest
    const { userText, criteriaId, topK } = body

    if (!userText || userText.length < MIN_TEXT_LENGTH) {
      return NextResponse.json(
        {
          success: false,
          message: `글자 수가 너무 적습니다. 최소 ${MIN_TEXT_LENGTH}자 이상 작성해주세요.`,
          error: 'TEXT_TOO_SHORT',
        },
        { status: 400 }
      )
    }

    if (!criteriaId || criteriaId.trim() === '') {
      return NextResponse.json(
        {
          success: false,
          message: 'criteriaId가 필요합니다.',
          error: 'CRITERIA_ID_REQUIRED',
        },
        { status: 400 }
      )
    }

    // -------------------------------------------------------------------------
    // 3. criteriaId → TemplateSchema 매핑 (P8A-02.5)
    // -------------------------------------------------------------------------
    // 먼저 사용자의 템플릿에서 검색, 없으면 기본 루브릭에서 검색
    let targetCriteria: TemplateSchema | null = null

    // 3-1. rag_templates 테이블에서 사용자 템플릿 조회
    const { data: templateData } = await supabase
      .from('rag_templates')
      .select('schema')
      .eq('tenant_id', user.id)
      .eq('status', 'approved')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (templateData?.schema) {
      const schemas = templateData.schema as TemplateSchema[]
      targetCriteria = schemas.find((s) => s.criteria_id === criteriaId) || null
    }

    // 3-2. 템플릿에 없으면 기본 루브릭에서 검색
    if (!targetCriteria) {
      const matchedRubric = DEFAULT_RUBRICS.find((r) => r.id === criteriaId)
      if (matchedRubric) {
        targetCriteria = RubricAdapter.toTemplate(matchedRubric)
      }
    }

    // 3-3. 여전히 없으면 에러
    if (!targetCriteria) {
      return NextResponse.json(
        {
          success: false,
          message: `criteriaId '${criteriaId}'에 해당하는 평가 기준을 찾을 수 없습니다.`,
          error: 'CRITERIA_NOT_FOUND',
        },
        { status: 404 }
      )
    }

    console.log(`[EvaluateSingle] 재평가 대상: ${targetCriteria.category}`)

    // -------------------------------------------------------------------------
    // 4. 참고자료 검색 (RAG)
    // -------------------------------------------------------------------------
    const searchQuery = userText.substring(0, 200)
    const evidenceResults = await vectorSearch(searchQuery, {
      userId: user.id,
      topK: topK || DEFAULT_TOP_K,
      minScore: 0.6,
    })

    const evidenceContext =
      evidenceResults.length > 0
        ? evidenceResults.map((r, i) => `[참고자료 ${i + 1}] ${r.content}`).join('\n\n')
        : ''

    console.log(`[EvaluateSingle] 참고자료 ${evidenceResults.length}개 활용`)

    // -------------------------------------------------------------------------
    // 5. Align Judge 실행 (단일 Criteria)
    // -------------------------------------------------------------------------
    const judgment = await runAlignJudge(userText, targetCriteria, evidenceContext)

    // -------------------------------------------------------------------------
    // 6. Upgrade Planner 실행 (pass가 아닌 경우)
    // -------------------------------------------------------------------------
    let upgradePlan: UpgradePlan | undefined = undefined

    if (judgment.status !== 'pass') {
      upgradePlan = await runUpgradePlanner(judgment, targetCriteria)
    }

    // -------------------------------------------------------------------------
    // 7. 성공 응답 반환
    // -------------------------------------------------------------------------
    return NextResponse.json({
      success: true,
      judgment,
      upgradePlan,
      message: '재평가가 완료되었습니다.',
    })
  } catch (error: any) {
    console.error('[EvaluateSingle API] Error:', error)
    return NextResponse.json(
      {
        success: false,
        message: '재평가 중 오류가 발생했습니다.',
        error: error.message || 'INTERNAL_SERVER_ERROR',
      },
      { status: 500 }
    )
  }
}
