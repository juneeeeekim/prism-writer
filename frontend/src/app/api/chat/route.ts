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
import {
  saveMessageWithRetry,
  searchUserPreferences,
  formatUserPreferences,
  searchTemplateContext,
  performRAGSearch,
  buildSystemPrompt,
  buildFullPrompt,
  touchSession,
  shouldRunLazySelfRAG,
} from '@/lib/services/chat'

export const runtime = 'nodejs'

// =============================================================================
// [P1-02] 상태 메시지 상수 정의 (Progressive Streaming)
// =============================================================================
const STATUS_MESSAGES = {
  SEARCHING: '[STATUS]🔍 자료 검색 중...\n',
  GENERATING: '[STATUS]📚 답변 생성 중...\n',
} as const

export async function POST(req: NextRequest) {
  const startTime = performance.now()

  try {
    // =========================================================================
    // 1. Request Parsing & Auth
    // =========================================================================
    const { messages, model: requestedModel, sessionId, projectId } = await req.json()
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
          // Step 2: Parallel Fetch - RAG 검색 (스트림 내에서 실행)
          // ---------------------------------------------------------------------
          const [userPreferences, templateContext, ragResult] = await Promise.all([
            searchUserPreferences(userId, query),
            searchTemplateContext(supabase, userId, query),
            performRAGSearch(query, { userId, projectId }),
          ])

          console.log(`[Chat API] Parallel fetch: ${(performance.now() - startTime).toFixed(0)}ms`)

          // ---------------------------------------------------------------------
          // Step 3: Build Prompt
          // ---------------------------------------------------------------------
          const userPreferencesContext = formatUserPreferences(userPreferences)
          const { context, hasRetrievedDocs, uniqueResults } = ragResult

          const systemPrompt = buildSystemPrompt({
            userPreferences: userPreferencesContext,
            templateContext,
            ragContext: context,
          })

          const fullPrompt = buildFullPrompt(systemPrompt, messages)

          // ---------------------------------------------------------------------
          // Step 4: LLM 응답 생성 상태 전송
          // ---------------------------------------------------------------------
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
            controller.enqueue(encode(`\n\n❌ 오류가 발생했습니다: ${errorMsg}`))
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
      { error: 'Internal Server Error', details: error.message },
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
