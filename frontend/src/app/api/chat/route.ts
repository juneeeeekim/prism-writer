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
} from '@/lib/services/chat'

export const runtime = 'nodejs'

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
    // 2. Parallel Fetch: Memory + Template + RAG
    // =========================================================================
    const [userPreferences, templateContext, ragResult] = await Promise.all([
      searchUserPreferences(userId, query),
      searchTemplateContext(supabase, userId, query),
      performRAGSearch(query, { userId, projectId }),
    ])

    console.log(`[Chat API] Parallel fetch: ${(performance.now() - startTime).toFixed(0)}ms`)

    // =========================================================================
    // 3. Build Prompt
    // =========================================================================
    const userPreferencesContext = formatUserPreferences(userPreferences)
    const { context, hasRetrievedDocs, uniqueResults } = ragResult

    const systemPrompt = buildSystemPrompt({
      userPreferences: userPreferencesContext,
      templateContext,
      ragContext: context,
    })

    const fullPrompt = buildFullPrompt(systemPrompt, messages)
    const modelId = requestedModel || getModelForUsage('rag.answer')

    // =========================================================================
    // 4. Streaming Response
    // =========================================================================
    const stream = new ReadableStream({
      async start(controller) {
        let fullResponse = ''
        let firstTokenLogged = false

        try {
          for await (const chunk of generateTextStream(fullPrompt, { model: modelId, context: 'rag.answer' })) {
            if (chunk.text) {
              if (!firstTokenLogged) {
                console.log(`[Chat API] TTFT: ${(performance.now() - startTime).toFixed(0)}ms`)
                firstTokenLogged = true
              }
              fullResponse += chunk.text
              controller.enqueue(new TextEncoder().encode(chunk.text))
            }
            if (chunk.done) break
          }

          // Groundedness Check (Self-RAG)
          if (FEATURE_FLAGS.ENABLE_SELF_RAG && hasRetrievedDocs && uniqueResults.length > 0 && fullResponse.length > 100) {
            const verification = await verifyGroundedness(fullResponse, uniqueResults, {
              supabase,
              userId,
              projectId,
            })

            if (!verification.isGrounded) {
              const warningMsg = '\n\n⚠️ 주의: 일부 내용이 문서에서 확인되지 않았습니다.'
              fullResponse += warningMsg
              controller.enqueue(new TextEncoder().encode(warningMsg))
            }
          }

          // Save Assistant Message
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
              controller.enqueue(new TextEncoder().encode(warningMsg))
            }

            await touchSession(supabase, sessionId)
          }

          controller.close()
        } catch (error) {
          console.error('Streaming error:', error)
          controller.error(error)
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
