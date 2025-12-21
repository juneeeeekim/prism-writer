// =============================================================================
// PRISM Writer - Judge API
// =============================================================================
// 파일: frontend/src/app/api/llm/judge/route.ts
// 역할: RAG Judge Contract를 사용한 답변 품질 평가 API
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { generateText, isLLMAvailable } from '@/lib/llm/gateway'
import { buildJudgePrompt, buildJudgePromptWithChunks, getDefaultJudgeResult } from '@/lib/rag/judgePrompt'
import { parseJudgeResponse, parseJudgeResponseSafe } from '@/lib/rag/judgeParser'
import { verifyAllCitations, summarizeCitationVerification, type VerifiedEvidence } from '@/lib/rag/citationGate'
import type { JudgeResult } from '@/types/rag'

// =============================================================================
// 타입 정의
// =============================================================================

interface JudgeRequest {
  /** 사용자 질문 */
  query: string
  /** 검색된 컨텍스트 (문자열 배열 또는 청크 객체 배열) */
  context: string[] | Array<{ id: string; content: string }>
  /** 추가 평가 기준 (옵션) */
  rubric?: string
  /** 인용 검증 활성화 (옵션, 기본: true) */
  verifyCitations?: boolean
}

interface JudgeResponse {
  success: boolean
  result: JudgeResult
  /** 검증된 근거 목록 (Phase 4: Citation Gate) */
  verifiedEvidence?: VerifiedEvidence[]
  /** 인용 검증 요약 */
  citationSummary?: {
    total: number
    valid: number
    invalid: number
    averageScore: number
  }
  tokensUsed?: number
  error?: string
}

// =============================================================================
// POST: Judge 평가 실행
// =============================================================================

/**
 * Judge API 엔드포인트
 * 
 * @description
 * 주어진 질문과 컨텍스트에 대해 Judge Contract를 적용하여
 * 답변 품질을 평가합니다.
 * 
 * @example
 * POST /api/llm/judge
 * {
 *   "query": "RAG란 무엇인가요?",
 *   "context": ["RAG는 Retrieval-Augmented Generation입니다.", "..."]
 * }
 */
export async function POST(request: NextRequest): Promise<NextResponse<JudgeResponse>> {
  // ---------------------------------------------------------------------------
  // 1. API 키 확인
  // ---------------------------------------------------------------------------
  if (!isLLMAvailable()) {
    return NextResponse.json(
      {
        success: false,
        result: getDefaultJudgeResult(),
        error: 'LLM API 키가 설정되지 않았습니다.',
      },
      { status: 503 }
    )
  }

  // ---------------------------------------------------------------------------
  // 2. 요청 파싱
  // ---------------------------------------------------------------------------
  let body: JudgeRequest
  
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      {
        success: false,
        result: getDefaultJudgeResult(),
        error: '잘못된 요청 형식입니다.',
      },
      { status: 400 }
    )
  }

  // ---------------------------------------------------------------------------
  // 3. 요청 검증
  // ---------------------------------------------------------------------------
  if (!body.query || !body.context || body.context.length === 0) {
    return NextResponse.json(
      {
        success: false,
        result: getDefaultJudgeResult(),
        error: 'query와 context는 필수입니다.',
      },
      { status: 400 }
    )
  }

  // ---------------------------------------------------------------------------
  // 4. 프롬프트 생성
  // ---------------------------------------------------------------------------
  let prompt: string
  
  // 컨텍스트 타입에 따라 다른 프롬프트 빌더 사용
  if (typeof body.context[0] === 'string') {
    prompt = buildJudgePrompt(body.query, body.context as string[], body.rubric)
  } else {
    prompt = buildJudgePromptWithChunks(
      body.query,
      body.context as Array<{ id: string; content: string }>
    )
  }

  // ---------------------------------------------------------------------------
  // 5. LLM 호출
  // ---------------------------------------------------------------------------
  try {
    const response = await generateText(prompt, {
      temperature: 0.2, // 일관된 JSON 응답을 위해 낮은 temperature
      maxOutputTokens: 2048,
    })

    // ---------------------------------------------------------------------------
    // 6. 응답 파싱 (Phase 3: Judge Contract)
    // ---------------------------------------------------------------------------
    const judgeResult = parseJudgeResponseSafe(response.text)

    // ---------------------------------------------------------------------------
    // 7. 인용 검증 (Phase 4: Citation Gate)
    // ---------------------------------------------------------------------------
    const verifyCitations = body.verifyCitations !== false // 기본값 true
    
    // 청크 객체 배열이 있는 경우에만 인용 검증 수행
    const isChunkArray = typeof body.context[0] !== 'string'
    
    if (verifyCitations && isChunkArray && judgeResult.evidence.length > 0) {
      const sourceChunks = body.context as Array<{ id: string; content: string }>
      const verifiedEvidence = verifyAllCitations(judgeResult.evidence, sourceChunks)
      const citationSummary = summarizeCitationVerification(verifiedEvidence)

      return NextResponse.json({
        success: true,
        result: judgeResult,
        verifiedEvidence,
        citationSummary,
        tokensUsed: response.tokensUsed,
      })
    }

    // 인용 검증 없이 반환
    return NextResponse.json({
      success: true,
      result: judgeResult,
      tokensUsed: response.tokensUsed,
    })
  } catch (error) {
    console.error('[Judge API] LLM 호출 실패:', error)
    
    return NextResponse.json(
      {
        success: false,
        result: getDefaultJudgeResult(),
        error: `LLM 호출 실패: ${error instanceof Error ? error.message : 'Unknown error'}`,
      },
      { status: 500 }
    )
  }
}

// =============================================================================
// GET: API 상태 확인
// =============================================================================

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    message: 'Judge API입니다. POST 요청으로 평가를 실행하세요.',
    apiKeyConfigured: isLLMAvailable(),
    endpoints: {
      POST: '/api/llm/judge - Judge 평가 실행',
    },
    requestFormat: {
      query: 'string (필수)',
      context: 'string[] 또는 {id: string, content: string}[] (필수)',
      rubric: 'string (선택)',
    },
  })
}
