// =============================================================================
// PRISM Writer - Chat API (Refactored)
// =============================================================================
// 파일: frontend/src/app/api/chat/route.ts
// 역할: RAG 기반 AI 채팅 API 엔드포인트
// 리팩토링: 2026-01-20 - 601줄 → ~200줄
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { generateTextStream } from '@/lib/llm/gateway'
import { getModelForUsage } from '@/config/llm-usage-map'
import { createClient } from '@/lib/supabase/server'
import { verifyCitation, hasCitationMarkers } from '@/lib/rag/citationGate'
import { verifyGroundedness } from '@/lib/rag/selfRAG'
import { FEATURE_FLAGS } from '@/config/featureFlags'
import { type RubricTier } from '@/lib/rag/rubrics'
import { validateChatRequestBody } from './requestValidation'
import {
  saveMessageWithRetry,
  searchUserPreferences,
  formatUserPreferences,
  searchTemplateContext,
  performRAGSearch,
  performWebSearch,
  shouldPerformWebSearch,
  buildSystemPrompt,
  buildFullPrompt,
  formatWebContext,
  touchSession,
  shouldRunLazySelfRAG,
} from '@/lib/services/chat'
import { buildCoachSystemPrompt, type StyleProfile } from '@/lib/services/coachService'

export const runtime = 'nodejs'

// =============================================================================
// [P1-02] 상태 메시지 상수 정의 (Progressive Streaming)
// =============================================================================
const STATUS_MESSAGES = {
  SEARCHING: '[STATUS]🔍 자료 검색 중...\n',
  WEB_SEARCHING: '[STATUS]🌐 웹 검색 중...\n',
  GENERATING: '[STATUS]📚 답변 생성 중...\n',
} as const

export async function POST(req: NextRequest) {
  const startTime = performance.now()

  try {
    // =========================================================================
    // 1. Request Parsing & Auth
    // =========================================================================
    let rawBody: unknown
    try {
      rawBody = await req.json()
    } catch {
      return NextResponse.json(
        { error: 'BAD_REQUEST', message: '요청 JSON 형식이 올바르지 않습니다.' },
        { status: 400 }
      )
    }

    const parsedBody = validateChatRequestBody(rawBody)
    if (!parsedBody.ok) {
      return NextResponse.json(
        { error: parsedBody.error, message: parsedBody.message },
        { status: 400 }
      )
    }

    const { messages, model: requestedModel, sessionId, projectId, coachId } = parsedBody.value
    const lastMessage = messages[messages.length - 1]
    const query = lastMessage.content

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const userId = user?.id

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized', message: '로그인이 필요합니다.' },
        { status: 401 }
      )
    }

    // =========================================================================
    // 1.5. 월간 질문 한도 체크 + 카운트 증가 (원자적 RPC)
    // =========================================================================
    const { data: usageResult, error: usageError } = await supabase.rpc(
      'check_and_increment_monthly_questions',
      { p_user_id: userId }
    )

    if (usageError) {
      console.error('[Chat API] Usage check RPC error:', usageError)
      // RPC 에러 시에도 서비스는 계속 제공 (graceful degradation)
    } else if (usageResult && !usageResult.allowed) {
      return NextResponse.json(
        {
          error: 'usage_limit_exceeded',
          message: `이번 달 질문 한도(${usageResult.limit}회)를 초과했습니다.`,
          limit: usageResult.limit,
          current: usageResult.current_count,
        },
        { status: 429 }
      )
    }

    // Save user message
    if (sessionId && lastMessage.role === 'user') {
      await saveMessageWithRetry(supabase, {
        session_id: sessionId,
        role: 'user',
        content: lastMessage.content,
        model_id: requestedModel,
      })
    }

    // =========================================================================
    // 2. [FIX] Progressive Streaming - 즉시 상태 메시지 전송으로 타임아웃 방지
    // 2026-01-21: Promise.all을 스트림 내부로 이동
    // =========================================================================
    const modelId = requestedModel || getModelForUsage('rag.answer')

    const stream = new ReadableStream({
      async start(controller) {
        const encode = (text: string) => new TextEncoder().encode(text)
        let fullResponse = ''
        let firstTokenLogged = false

        try {
          // ---------------------------------------------------------------------
          // Step 1: 즉시 상태 메시지 전송 (클라이언트 타임아웃 방지)
          // ---------------------------------------------------------------------
          controller.enqueue(encode(STATUS_MESSAGES.SEARCHING))

          // ---------------------------------------------------------------------
          // Step 2: Parallel Fetch - RAG + 웹 검색 (스트림 내에서 실행)
          // [2603060100] 웹 검색을 Parallel Fetch에 추가
          // ---------------------------------------------------------------------
          // 웹 검색: 사용자가 "웹검색" 등 명시적 키워드를 사용한 경우에만 실행
          const useWebSearch = FEATURE_FLAGS.ENABLE_WEB_SEARCH_IN_CHAT && shouldPerformWebSearch(query)

          const [userPreferences, templateContext, ragResult, webResults] = await Promise.all([
            searchUserPreferences(userId, query),
            searchTemplateContext(supabase, userId, query),
            performRAGSearch(query, { userId, projectId }),
            useWebSearch
              ? performWebSearch(query)
              : Promise.resolve([]),
          ])

          console.log(`[Chat API] Parallel fetch: ${(performance.now() - startTime).toFixed(0)}ms`)

          // ---------------------------------------------------------------------
          // Step 3: Build Prompt (+ 웹 검색 컨텍스트)
          // [2603060100] 웹 검색 결과를 프롬프트에 주입
          // ---------------------------------------------------------------------
          const userPreferencesContext = formatUserPreferences(userPreferences)
          const { context, hasRetrievedDocs, uniqueResults } = ragResult
          const webContext = formatWebContext(webResults)

          let systemPrompt = buildSystemPrompt({
            userPreferences: userPreferencesContext,
            templateContext,
            ragContext: context,
            webContext,
          })

          // -------------------------------------------------------------------
          // [P3-09] Coach persona injection
          // coachId가 있으면 해당 코치의 style_profile로 시스템 프롬프트 보강
          // 코치가 없거나 오류 시 기존 동작 그대로 유지 (graceful fallback)
          // -------------------------------------------------------------------
          if (coachId) {
            try {
              const { data: coachData } = await supabase
                .from('writing_coaches')
                .select('name, style_profile')
                .eq('id', coachId)
                .eq('user_id', userId)
                .maybeSingle()

              if (coachData?.style_profile?.system_prompt_addition) {
                const coachPrompt = buildCoachSystemPrompt(
                  coachData.style_profile as StyleProfile,
                  coachData.name
                )
                systemPrompt = systemPrompt + '\n\n' + coachPrompt
                console.log(`[Chat API] Coach persona injected: ${coachData.name} (${coachId})`)
              }
            } catch (coachErr) {
              console.warn('[Chat API] Coach lookup failed (continuing without coach):', coachErr)
            }
          }

          const fullPrompt = buildFullPrompt(systemPrompt, messages)

          // ---------------------------------------------------------------------
          // Step 4: 웹 검색 결과 + LLM 응답 생성 상태 전송
          // [2603060100] 웹 검색 결과가 있으면 상태 메시지 추가
          // ---------------------------------------------------------------------
          if (webResults.length > 0) {
            controller.enqueue(encode(STATUS_MESSAGES.WEB_SEARCHING))
          }
          controller.enqueue(encode(STATUS_MESSAGES.GENERATING))

          // ---------------------------------------------------------------------
          // Step 5: LLM Streaming (기존 로직 유지)
          // [2026-01-21] 디버그 로깅 추가 - LLM 스트리밍 시작점 추적
          // ---------------------------------------------------------------------
          console.log(`[Chat API] Starting LLM stream with model: ${modelId}`)
          
          let llmChunkCount = 0
          for await (const chunk of generateTextStream(fullPrompt, { model: modelId, context: 'rag.answer' })) {
            if (chunk.text) {
              llmChunkCount++
              if (!firstTokenLogged) {
                console.log(`[Chat API] TTFT: ${(performance.now() - startTime).toFixed(0)}ms`)
                firstTokenLogged = true
              }
              fullResponse += chunk.text
              controller.enqueue(encode(chunk.text))
            }
            if (chunk.done) break
          }
          
          console.log(`[Chat API] LLM stream completed. Chunks: ${llmChunkCount}, Total chars: ${fullResponse.length}`)

          // ---------------------------------------------------------------------
          // Step 6: Groundedness Check (Self-RAG) - [L2-02] Lazy Self-RAG 적용
          // [2026-01-21] 조건부 검증: 고위험 응답에만 Self-RAG 실행
          // ---------------------------------------------------------------------
          const shouldVerify = shouldRunLazySelfRAG(query, fullResponse, hasRetrievedDocs)
          
          // [L4-01] 검증 스킵/실행 로깅
          console.log(`[Chat API] Lazy Self-RAG: ${shouldVerify ? 'VERIFY' : 'SKIP'}`, {
            queryLength: query.length,
            responseLength: fullResponse.length,
            hasRetrievedDocs,
          })
          
          if (shouldVerify && uniqueResults.length > 0 && fullResponse.length > 100) {
            const verification = await verifyGroundedness(fullResponse, uniqueResults, {
              supabase,
              userId,
              projectId,
            })

            if (!verification.isGrounded) {
              const warningMsg = '\n\n⚠️ 주의: 일부 내용이 문서에서 확인되지 않았습니다.'
              fullResponse += warningMsg
              controller.enqueue(encode(warningMsg))
            }
          }

          // ---------------------------------------------------------------------
          // Step 7: Save Assistant Message - 기존 로직 유지
          // ---------------------------------------------------------------------
          if (sessionId && fullResponse) {
            const citationMetadata = buildCitationMetadata(fullResponse, hasRetrievedDocs, uniqueResults)

            // [2603060100] 웹 출처 메타데이터 추가
            if (webResults.length > 0) {
              citationMetadata.web_sources = webResults.map(r => ({
                title: r.title,
                url: r.url,
                source: r.source,
                trustBadge: r.trustBadge,
              }))
            }

            const saveSuccess = await saveMessageWithRetry(supabase, {
              session_id: sessionId,
              role: 'assistant',
              content: fullResponse,
              model_id: modelId,
              metadata: citationMetadata,
            })

            if (!saveSuccess) {
              const warningMsg = '\n\n⚠️ _메시지가 서버에 저장되지 않았습니다._'
              controller.enqueue(encode(warningMsg))
            }

            await touchSession(supabase, sessionId)
          }

          controller.close()
        } catch (error: any) {
          // [2026-01-21] 에러 발생 시 사용자에게 메시지 전송 (디버깅 용이)
          console.error('Streaming error:', error)
          const errorMsg = error?.message || 'Unknown error'
          console.error('[Chat API] LLM Error Details:', JSON.stringify({
            message: errorMsg,
            name: error?.name,
            stack: error?.stack?.slice(0, 500),
          }))
          
          // 사용자에게 에러 메시지 전송 후 정상 종료
          try {
            controller.enqueue(encode('\n\n❌ 오류가 발생했습니다. 잠시 후 다시 시도해주세요.'))
            controller.close()
          } catch {
            controller.error(error)
          }
        }
      },
    })

    return new NextResponse(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })
  } catch (error: any) {
    console.error('Chat API Error:', error)
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }
}

// =============================================================================
// Helper: Build Citation Metadata
// =============================================================================

function buildCitationMetadata(
  fullResponse: string,
  hasRetrievedDocs: boolean,
  uniqueResults: any[]
): Record<string, any> {
  if (!hasRetrievedDocs || !uniqueResults || uniqueResults.length === 0) {
    return {}
  }

  const sourceChunksForVerify = uniqueResults.map((r) => ({
    id: r.chunkId,
    content: r.content,
  }))

  const verificationResult = verifyCitation(fullResponse, sourceChunksForVerify)
  const hasMarkers = hasCitationMarkers(fullResponse)
  const adjustedScore = hasMarkers
    ? Math.min(verificationResult.matchScore + 0.15, 1.0)
    : verificationResult.matchScore

  const topResult = uniqueResults[0]
  const rubricTier = topResult?.metadata?.tier as RubricTier | undefined

  const sources = uniqueResults.slice(0, 5).map((r) => ({
    title: r.metadata?.title || 'Untitled',
    chunkId: r.chunkId,
    score: Math.round(r.score * 100) / 100,
  }))

  return {
    citation_verification: {
      ...verificationResult,
      matchScore: Math.round(adjustedScore * 100) / 100,
      valid: adjustedScore >= 0.7,
    },
    source_count: uniqueResults.length,
    rubric_tier: rubricTier,
    sources,
  }
}
