// =============================================================================
// PRISM Writer - Evaluation API
// =============================================================================
// 파일: frontend/src/app/api/rag/evaluate/route.ts
// 역할: 사용자 글을 루브릭 기준으로 평가하는 API 엔드포인트
// =============================================================================

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateText, isLLMAvailable } from '@/lib/llm/gateway'
import { buildEvaluationPrompt, type SearchResult } from '@/lib/llm/prompts'
import { parseEvaluationResponse, type EvaluationResult } from '@/lib/llm/parser'
import { vectorSearch } from '@/lib/rag/search'
import { DEFAULT_RUBRICS, getEnabledRubrics, type Rubric } from '@/lib/rag/rubrics'

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
}

/** 평가 응답 */
interface EvaluateResponse {
  success: boolean
  result?: EvaluationResult
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

/**
 * 사용자 글 평가 API
 * 
 * @description
 * 1. 사용자 글을 받아 RAG 검색으로 관련 근거를 수집
 * 2. 루브릭 기준으로 LLM에게 평가 요청
 * 3. JSON 형식 평가 결과 반환
 */
export async function POST(
  request: Request
): Promise<NextResponse<EvaluateResponse>> {
  try {
    // ---------------------------------------------------------------------------
    // 1. LLM 사용 가능 여부 확인
    // ---------------------------------------------------------------------------
    if (!isLLMAvailable()) {
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

    const userId = session.user.id

    // ---------------------------------------------------------------------------
    // 3. 요청 바디 파싱 및 검증
    // ---------------------------------------------------------------------------
    let body: EvaluateRequest
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        {
          success: false,
          message: '요청 형식이 올바르지 않습니다.',
          error: 'INVALID_REQUEST',
        },
        { status: 400 }
      )
    }

    const {
      userText,
      rubricIds,
      searchQuery,
      topK = DEFAULT_TOP_K,
    } = body

    // 글 길이 검증
    if (!userText || userText.trim().length < MIN_TEXT_LENGTH) {
      return NextResponse.json(
        {
          success: false,
          message: `평가할 글이 너무 짧습니다. 최소 ${MIN_TEXT_LENGTH}자 이상 입력해주세요.`,
          error: 'TEXT_TOO_SHORT',
        },
        { status: 400 }
      )
    }

    if (userText.length > MAX_TEXT_LENGTH) {
      return NextResponse.json(
        {
          success: false,
          message: `글이 너무 깁니다. 최대 ${MAX_TEXT_LENGTH}자까지 가능합니다.`,
          error: 'TEXT_TOO_LONG',
        },
        { status: 400 }
      )
    }

    // ---------------------------------------------------------------------------
    // 4. 루브릭 선택
    // ---------------------------------------------------------------------------
    let selectedRubrics: Rubric[]
    if (rubricIds && rubricIds.length > 0) {
      // 지정된 루브릭만 사용
      selectedRubrics = DEFAULT_RUBRICS.filter((r) => rubricIds.includes(r.id))
      if (selectedRubrics.length === 0) {
        return NextResponse.json(
          {
            success: false,
            message: '유효한 루브릭이 없습니다.',
            error: 'INVALID_RUBRICS',
          },
          { status: 400 }
        )
      }
    } else {
      // 전체 활성 루브릭 사용
      selectedRubrics = getEnabledRubrics()
    }

    // ---------------------------------------------------------------------------
    // 5. RAG 검색 (근거 수집)
    // ---------------------------------------------------------------------------
    let searchResults: SearchResult[] = []
    try {
      const query = searchQuery || userText.substring(0, 500) // 검색 쿼리 제한
      const results = await vectorSearch(query, {
        userId,
        topK,
        minScore: 0.5, // 최소 유사도 0.5
      })

      searchResults = results.map((r) => ({
        chunkId: r.chunkId,
        content: r.content,
        score: r.score,
        metadata: r.metadata,
      }))
    } catch (searchError) {
      console.warn('RAG 검색 실패, 근거 없이 진행:', searchError)
      // 검색 실패해도 평가는 계속 진행 (근거 부족으로 처리됨)
    }

    // ---------------------------------------------------------------------------
    // 6. 평가 프롬프트 생성
    // ---------------------------------------------------------------------------
    const prompt = buildEvaluationPrompt({
      userText: userText.trim(),
      rubrics: selectedRubrics.map((r) => ({
        id: r.id,
        name: r.name,
        description: r.description,
        weight: r.weight,
      })),
      searchResults,
    })

    // ---------------------------------------------------------------------------
    // 7. LLM 평가 실행
    // ---------------------------------------------------------------------------
    let llmResponse: string
    try {
      const response = await generateText(prompt, {
        temperature: 0.3, // 일관된 평가를 위해 낮은 온도
        maxOutputTokens: 4096,
      })
      llmResponse = response.text
    } catch (llmError) {
      console.error('LLM 평가 실패:', llmError)
      return NextResponse.json(
        {
          success: false,
          message: 'AI 평가 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
          error: 'LLM_ERROR',
        },
        { status: 500 }
      )
    }

    // ---------------------------------------------------------------------------
    // 8. 결과 파싱
    // ---------------------------------------------------------------------------
    const evaluationResult = parseEvaluationResponse(llmResponse, { debug: false })

    if (!evaluationResult.success) {
      console.error('평가 결과 파싱 실패:', evaluationResult.error)
      return NextResponse.json(
        {
          success: false,
          message: 'AI 응답을 처리하는 중 오류가 발생했습니다.',
          error: 'PARSE_ERROR',
        },
        { status: 500 }
      )
    }

    // ---------------------------------------------------------------------------
    // 9. 성공 응답
    // ---------------------------------------------------------------------------
    return NextResponse.json({
      success: true,
      result: evaluationResult,
      rubricCount: selectedRubrics.length,
      evidenceCount: searchResults.length,
    })
  } catch (error) {
    console.error('Unexpected error in evaluate API:', error)
    return NextResponse.json(
      {
        success: false,
        message: '서버 오류가 발생했습니다.',
        error: 'INTERNAL_SERVER_ERROR',
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
