
// =============================================================================
// PRISM Writer - Evaluation API
// =============================================================================
// 파일: frontend/src/app/api/rag/evaluate/route.ts
// 역할: 사용자 글을 루브릭 기준으로 평가하는 API 엔드포인트
// =============================================================================

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateText, isLLMAvailable } from '@/lib/llm/gateway'
import { buildEvaluationPrompt } from '@/lib/llm/prompts'
import { parseEvaluationResponse, type EvaluationResult as LegacyEvaluationResult } from '@/lib/llm/parser'
import { vectorSearch } from '@/lib/rag/search'
import { DEFAULT_RUBRICS, getEnabledRubrics, type Rubric } from '@/lib/rag/rubrics'

// v3 Imports
import { runAlignJudge } from '@/lib/judge/alignJudge'
import { runUpgradePlanner } from '@/lib/judge/upgradePlanner'
import { type EvaluationResult, type JudgeResult, type UpgradePlan } from '@/lib/judge/types'
import { type TemplateSchema } from '@/lib/rag/templateTypes'
import { logShadowModeComparison } from '@/lib/rag/shadowModeLogger'
import { RubricAdapter } from '@/lib/rag/rubricAdapter'

// =============================================================================
// 타입 정의
// =============================================================================

/** 평가 요청 바디 */
interface EvaluateRequest {
  /** 평가할 사용자 글 */
  userText: string
  /** 사용할 루브릭 ID 목록 (없으면 전체 기본 루브릭 사용) */
  rubricIds?: string[]
  /** RAG 검색에 사용할 쿼리 (없으면 userText 사용) */
  searchQuery?: string
  /** 검색 결과 개수 */
  topK?: number
  
  // v3 params
  useV3?: boolean
  templateId?: string
}

/** 평가 응답 */
interface EvaluateResponse {
  success: boolean
  result?: LegacyEvaluationResult // Legacy
  v3Result?: EvaluationResult // v3
  message?: string
  error?: string
  /** 사용된 루브릭 개수 */
  rubricCount?: number
  /** 사용된 근거 개수 */
  evidenceCount?: number
}

// =============================================================================
// 상수
// =============================================================================

/** 기본 검색 결과 개수 */
const DEFAULT_TOP_K = 5

/** 최소 글 길이 */
const MIN_TEXT_LENGTH = 50

/** 최대 글 길이 */
const MAX_TEXT_LENGTH = 50000

// =============================================================================
// POST: 글 평가 실행
// =============================================================================

export async function POST(
  request: Request
): Promise<NextResponse<EvaluateResponse>> {
  try {
    // ---------------------------------------------------------------------------
    // 1. LLM 사용 가능 여부 확인
    // ---------------------------------------------------------------------------
    const body = await request.json() as EvaluateRequest
    
    if (!body.useV3 && !isLLMAvailable()) {
      return NextResponse.json(
        {
          success: false,
          message: 'LLM API가 설정되지 않았습니다. GOOGLE_API_KEY를 확인해주세요.',
          error: 'LLM_NOT_CONFIGURED',
        },
        { status: 503 }
      )
    }

    // ---------------------------------------------------------------------------
    // 2. 사용자 인증 확인
    // ---------------------------------------------------------------------------
    const supabase = createClient()
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
      return NextResponse.json(
        {
          success: false,
          message: '로그인이 필요합니다.',
          error: 'UNAUTHORIZED',
        },
        { status: 401 }
      )
    }

    const { userText, rubricIds, searchQuery, topK, useV3, templateId } = body
    const USE_V3_FLAG = process.env.NEXT_PUBLIC_USE_V3_TEMPLATES === 'true'
    const effectiveUseV3 = useV3 !== undefined ? useV3 : USE_V3_FLAG

    // ---------------------------------------------------------------------------
    // 3. 입력 유효성 검사
    // ---------------------------------------------------------------------------
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

    if (userText.length > MAX_TEXT_LENGTH) {
      return NextResponse.json(
        {
          success: false,
          message: `글자 수가 너무 많습니다. 최대 ${MAX_TEXT_LENGTH}자까지 가능합니다.`,
          error: 'TEXT_TOO_LONG',
        },
        { status: 400 }
      )
    }

    // ===========================================================================
    // v3 Evaluation Logic (Align Judge + Upgrade Planner)
    // ===========================================================================
    if (effectiveUseV3) {
      // 1. 템플릿 조회
      let templateSchema: TemplateSchema[] = []
      
      if (templateId) {
        const { data, error } = await supabase
          .from('rag_templates')
          .select('schema')
          .eq('id', templateId)
          .single()
          
        if (error || !data) {
          throw new Error('Template not found')
        }
        templateSchema = data.schema as TemplateSchema[]
      } else {
        // 템플릿 ID가 없으면 가장 최근 승인된 템플릿 사용 (Fallback)
        const { data, error } = await supabase
          .from('rag_templates')
          .select('schema')
          .eq('tenant_id', session.user.id) // 개인 사용자 기준
          .eq('status', 'approved')
          .order('created_at', { ascending: false })
          .limit(1)
          .single()
          
        if (error || !data) {
          // 템플릿이 아예 없으면 에러
          return NextResponse.json({
            success: false,
            message: '사용 가능한 템플릿이 없습니다. 먼저 템플릿을 생성해주세요.',
            error: 'NO_TEMPLATE_FOUND'
          }, { status: 404 })
        }
        templateSchema = data.schema as TemplateSchema[]
      }

      // -----------------------------------------------------------------------
      // P0 Fix: 업로드된 참고자료 검색 (vectorSearch 연동)
      // 템플릿 기준 + 참고자료 근거를 결합하여 평가
      // -----------------------------------------------------------------------
      const searchQuery = body.searchQuery || userText.substring(0, 200)
      const evidenceResults = await vectorSearch(searchQuery, {
        userId: session.user.id,
        topK: topK || DEFAULT_TOP_K,
        minScore: 0.6,
      })

      // 참고자료 컨텍스트 생성
      const evidenceContext = evidenceResults.length > 0
        ? evidenceResults.map((r, i) => `[참고자료 ${i + 1}] ${r.content}`).join('\n\n')
        : ''

      console.log(`[v3 Evaluation] 참고자료 ${evidenceResults.length}개 활용`)

      // 2. 병렬 평가 실행 (Align Judge) - 참고자료 컨텍스트 포함
      const judgePromises = templateSchema.map(criteria => 
        runAlignJudge(userText, criteria, evidenceContext)
      )
      const judgeResults = await Promise.all(judgePromises)

      // 3. 실패 항목에 대해 Upgrade Plan 수립 (Upgrade Planner)
      const planPromises = judgeResults.map(async (result, index) => {
        if (result.status === 'pass') return null
        
        const criteria = templateSchema[index]
        return runUpgradePlanner(result, criteria)
      })
      const plans = (await Promise.all(planPromises)).filter(p => p !== null) as UpgradePlan[]

      // 4. 종합 점수 계산 (단순 평균)
      const passCount = judgeResults.filter(r => r.status === 'pass').length
      const partialCount = judgeResults.filter(r => r.status === 'partial').length
      const totalCount = judgeResults.length
      const score = Math.round(((passCount * 1.0 + partialCount * 0.5) / totalCount) * 100)

      // 5. 결과 반환
      const v3Result: EvaluationResult = {
        document_id: 'latest', // TODO: 실제 문서 ID 연동 필요 시 수정
        template_id: templateId || 'latest',
        evaluated_at: new Date().toISOString(),
        judgments: judgeResults,
        upgrade_plans: plans,
        overall_score: score
      }

      // 6. Shadow Mode (v2 병렬 실행 및 로깅)
      // 주의: 실제 서비스에서는 성능을 위해 비동기로 실행하거나 샘플링할 수 있음
      try {
        const v2Result = await runLegacyEvaluation(userText, rubricIds, searchQuery, topK, session.user.id)
        await logShadowModeComparison(v2Result, v3Result, {
          userId: session.user.id,
          userText,
          templateId: templateId || 'latest'
        })
      } catch (shadowError) {
        console.error('[ShadowMode] Error:', shadowError)
      }

      return NextResponse.json({
        success: true,
        v3Result,
        message: 'Evaluation completed successfully (v3)',
      })
    }

    // ===========================================================================
    // Legacy Evaluation Logic
    // ===========================================================================

    // 5. 실행
    const result = await runLegacyEvaluation(userText, rubricIds, searchQuery, topK, session.user.id)

    // 6. 결과 반환
    return NextResponse.json({
      success: true,
      result,
    })

  } catch (error: any) {
    console.error('[Evaluation API] Error:', error)
    return NextResponse.json(
      {
        success: false,
        message: '평가 중 오류가 발생했습니다.',
        error: error.message || 'INTERNAL_SERVER_ERROR',
      },
      { status: 500 }
    )
  }
}

// =============================================================================
// GET: 루브릭 목록 조회
// =============================================================================

export async function GET(): Promise<NextResponse> {
  const enabledRubrics = getEnabledRubrics()
  
  return NextResponse.json({
    success: true,
    rubrics: enabledRubrics.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      category: r.category,
      weight: r.weight,
    })),
    totalCount: enabledRubrics.length,
  })
}

// =============================================================================
// Internal Helper: Legacy Evaluation
// =============================================================================

async function runLegacyEvaluation(
  userText: string,
  rubricIds: string[] | undefined,
  searchQuery: string | undefined,
  topK: number | undefined,
  userId: string
): Promise<LegacyEvaluationResult> {
  // 1. 루브릭 필터링
  let targetRubrics: Rubric[] = getEnabledRubrics()
  if (rubricIds && rubricIds.length > 0) {
    targetRubrics = DEFAULT_RUBRICS.filter(r => rubricIds.includes(r.id))
  }

  if (targetRubrics.length === 0) {
    throw new Error('No active rubrics found')
  }

  // 2. RAG 검색
  const query = searchQuery || userText.substring(0, 200)
  const searchResults = await vectorSearch(query, {
    userId,
    topK: topK || DEFAULT_TOP_K,
    minScore: 0.7,
  })

  // 3. 프롬프트 생성
  const prompt = buildEvaluationPrompt({
    userText,
    rubrics: targetRubrics.map(r => ({
      id: r.id,
      name: r.name,
      description: r.description,
      weight: r.weight
    })),
    searchResults: searchResults.map(r => ({
      chunkId: r.chunkId,
      content: r.content,
      score: r.score,
      metadata: r.metadata
    }))
  })

  // 4. LLM 호출
  const llmResponse = await generateText(prompt, {
    temperature: 0.2,
    maxOutputTokens: 2000,
  })

  // 5. 파싱
  return parseEvaluationResponse(llmResponse.text)
}
