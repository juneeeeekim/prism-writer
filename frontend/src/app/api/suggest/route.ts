// =============================================================================
// PRISM Writer - Shadow Writer Suggest API
// =============================================================================
// 파일: frontend/src/app/api/suggest/route.ts
// 역할: 실시간 문장 완성 제안을 위한 API 엔드포인트
// 기능: 커서 앞 문맥을 분석하여 다음 문장을 제안
// 참고: [Shadow Writer 체크리스트 P1-01]
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { hybridSearch } from '@/lib/rag/search'
import { generateText } from '@/lib/llm/gateway'
import { logger } from '@/lib/utils/logger'

// =============================================================================
// 타입 정의
// =============================================================================

/** 요청 바디 타입 */
interface SuggestRequest {
  text: string           // 현재 에디터 전체 텍스트
  cursorPosition: number // 커서 위치 (문자 인덱스)
  projectId?: string     // 프로젝트 ID (RAG 컨텍스트용)
}

/** 응답 타입 */
interface SuggestResponse {
  success: boolean
  suggestion: string     // 제안된 다음 문장
  error?: string
}

// =============================================================================
// 상수
// =============================================================================

/** 커서 앞에서 가져올 최대 문자 수 */
const CONTEXT_BEFORE_LENGTH = 200

/** RAG 검색 결과 개수 */
const RAG_TOP_K = 3

/** LLM 최대 토큰 수 (짧은 문장용) */
const MAX_TOKENS = 100

/** LLM 온도 (약간의 창의성) */
const TEMPERATURE = 0.7

// =============================================================================
// 헬퍼 함수: 첫 번째 문장만 추출
// =============================================================================

/**
 * 텍스트에서 첫 번째 완전한 문장만 추출
 * @param text - LLM 응답 텍스트
 * @returns 첫 번째 문장
 */
function extractFirstSentence(text: string): string {
  if (!text || text.trim().length === 0) {
    return ''
  }

  // 마침표, 물음표, 느낌표로 끝나는 첫 문장 추출
  const match = text.match(/^[^.!?]*[.!?]/)
  if (match) {
    return match[0].trim()
  }

  // 문장 종결 부호가 없으면 전체 텍스트 반환 (최대 100자)
  return text.trim().substring(0, 100)
}

// =============================================================================
// 헬퍼 함수: 제안 프롬프트 생성
// =============================================================================

/**
 * Shadow Writer용 프롬프트 생성
 * @param contextBefore - 커서 앞 문맥
 * @param ragContext - RAG 검색 결과 (선택)
 * @returns 프롬프트 문자열
 */
function buildSuggestionPrompt(
  contextBefore: string,
  ragContext: Array<{ content: string }> = []
): string {
  const ragSection = ragContext.length > 0
    ? ragContext.map((r) => r.content).join('\n---\n')
    : '(참고 자료 없음)'

  return `# 역할
당신은 글쓰기 어시스턴트입니다. 사용자가 작성 중인 글의 다음 문장을 제안하세요.

# 참고 자료
${ragSection}

# 현재 작성 중인 글 (커서 앞 부분)
${contextBefore}

# 지시사항
1. 위 맥락에 자연스럽게 이어지는 **1개의 문장만** 작성하세요.
2. 참고 자료가 있다면 활용하되, 그대로 베끼지 마세요.
3. 너무 길지 않게 (50자 이내 권장)
4. 설명 없이 문장만 출력하세요.

# 출력`
}

// =============================================================================
// POST /api/suggest - 문장 제안 API
// =============================================================================

export async function POST(
  request: NextRequest
): Promise<NextResponse<SuggestResponse>> {
  const startTime = Date.now()

  try {
    // -------------------------------------------------------------------------
    // 1. 인증 확인
    // -------------------------------------------------------------------------
    const supabase = await createClient()
    const { data: { session }, error: authError } = await supabase.auth.getSession()

    if (authError || !session) {
      logger.warn('[Suggest API]', '인증 실패')
      return NextResponse.json(
        { success: false, suggestion: '', error: '인증이 필요합니다.' },
        { status: 401 }
      )
    }

    const userId = session.user.id

    // -------------------------------------------------------------------------
    // 2. 요청 파싱
    // -------------------------------------------------------------------------
    let body: SuggestRequest
    try {
      body = await request.json()
    } catch (parseError) {
      logger.warn('[Suggest API]', '요청 파싱 실패')
      return NextResponse.json(
        { success: false, suggestion: '', error: '잘못된 요청 형식입니다.' },
        { status: 400 }
      )
    }

    const { text, cursorPosition, projectId } = body

    // -------------------------------------------------------------------------
    // 3. 입력 검증
    // -------------------------------------------------------------------------
    if (!text || typeof text !== 'string') {
      logger.warn('[Suggest API]', 'text 필드 누락')
      return NextResponse.json(
        { success: false, suggestion: '', error: 'text 필드가 필요합니다.' },
        { status: 400 }
      )
    }

    if (cursorPosition === undefined || typeof cursorPosition !== 'number') {
      logger.warn('[Suggest API]', 'cursorPosition 필드 누락')
      return NextResponse.json(
        { success: false, suggestion: '', error: 'cursorPosition 필드가 필요합니다.' },
        { status: 400 }
      )
    }

    // 커서 위치가 텍스트 범위 내인지 확인
    if (cursorPosition < 0 || cursorPosition > text.length) {
      logger.warn('[Suggest API]', `잘못된 cursorPosition: ${cursorPosition}`)
      return NextResponse.json(
        { success: false, suggestion: '', error: 'cursorPosition이 유효하지 않습니다.' },
        { status: 400 }
      )
    }

    // -------------------------------------------------------------------------
    // 4. 문맥 추출 (커서 앞 200자)
    // -------------------------------------------------------------------------
    const contextStart = Math.max(0, cursorPosition - CONTEXT_BEFORE_LENGTH)
    const contextBefore = text.substring(contextStart, cursorPosition)

    // 문맥이 너무 짧으면 제안하지 않음
    if (contextBefore.trim().length < 10) {
      logger.info('[Suggest API]', '문맥이 너무 짧음, 제안 없음')
      return NextResponse.json({
        success: true,
        suggestion: '',
      })
    }

    logger.info('[Suggest API]', `문맥 추출 완료: ${contextBefore.length}자`)

    // -------------------------------------------------------------------------
    // 5. RAG 검색 (선택적, projectId 있을 때만)
    // -------------------------------------------------------------------------
    let ragContext: Array<{ content: string }> = []

    if (projectId) {
      try {
        const searchResults = await hybridSearch(contextBefore, {
          userId,
          projectId,
          topK: RAG_TOP_K,
        })

        ragContext = searchResults.map((r) => ({ content: r.content }))
        logger.info('[Suggest API]', `RAG 검색 완료: ${ragContext.length}건`)
      } catch (ragError) {
        // RAG 실패해도 계속 진행 (Graceful Degradation)
        logger.warn('[Suggest API]', 'RAG 검색 실패, 계속 진행', { 
          error: ragError instanceof Error ? ragError.message : String(ragError) 
        })
      }
    }

    // -------------------------------------------------------------------------
    // 6. LLM 호출 (Gemini 3.0 Flash 사용)
    // -------------------------------------------------------------------------
    const prompt = buildSuggestionPrompt(contextBefore, ragContext)

    let suggestion = ''
    try {
      const llmResponse = await generateText(prompt, {
        model: 'gemini-1.5-flash',  // Gemini 1.5 Flash (안정적)
        maxOutputTokens: MAX_TOKENS,
        temperature: TEMPERATURE,
      })

      suggestion = extractFirstSentence(llmResponse.text || '')
      logger.info('[Suggest API]', `LLM 응답 완료: "${suggestion.substring(0, 30)}..."`)
    } catch (llmError) {
      // LLM 실패 시 빈 제안 반환 (Graceful Degradation)
      logger.error('[Suggest API]', 'LLM 호출 실패', { 
        error: llmError instanceof Error ? llmError.message : String(llmError) 
      })
      return NextResponse.json({
        success: true,
        suggestion: '',
      })
    }

    // -------------------------------------------------------------------------
    // 7. 성공 응답
    // -------------------------------------------------------------------------
    const latencyMs = Date.now() - startTime
    logger.info('[Suggest API]', `완료 (${latencyMs}ms)`)

    return NextResponse.json({
      success: true,
      suggestion,
    })

  } catch (error) {
    // -------------------------------------------------------------------------
    // 예외 처리
    // -------------------------------------------------------------------------
    logger.error('[Suggest API]', '예상치 못한 오류', { 
      error: error instanceof Error ? error.message : String(error) 
    })
    return NextResponse.json(
      { success: false, suggestion: '', error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
