// =============================================================================
// PRISM Writer - Chat API
// =============================================================================
// 파일: frontend/src/app/api/chat/route.ts
// 역할: RAG 기반 AI 채팅 API (LLM Gateway 사용)
// 수정: 2025-12-23 - OpenAI 하드코딩 제거, Gateway 연동으로 Gemini 기본 사용
// 수정: 2025-12-28 - Phase 14 Feedback-to-Memory 통합 (MemoryService, Prompt Injection)
// 수정: Pipeline v5 - 비로그인 사용자 명시적 차단 + 메시지 저장 실패 시 클라이언트 알림
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { hybridSearch, type SearchResult } from '@/lib/rag/search'
import { generateTextStream } from '@/lib/llm/gateway'
import { getDefaultModel } from '@/config/llm.config'
import { createClient } from '@/lib/supabase/server'
import { verifyCitation } from '@/lib/rag/citationGate'
import { MemoryService } from '@/lib/rag/memory'
import { FEATURE_FLAGS } from '@/config/featureFlags'
import { type TemplateSchema } from '@/lib/rag/templateTypes'

export const runtime = 'nodejs'

// -----------------------------------------------------------------------------
// Helper: 재시도 로직이 포함된 메시지 저장 함수
// -----------------------------------------------------------------------------
async function saveMessageWithRetry(
  supabase: any,
  data: { 
    session_id: string; 
    role: string; 
    content: string; 
    model_id?: string;
    metadata?: Record<string, any> 
  },
  maxRetries: number = 3
): Promise<boolean> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const { error } = await supabase.from('chat_messages').insert(data)
      if (error) throw error
      return true
    } catch (error) {
      console.warn(`Message save attempt ${attempt}/${maxRetries} failed:`, error)
      if (attempt < maxRetries) {
        // 지수 백오프
        await new Promise(resolve => setTimeout(resolve, 100 * Math.pow(2, attempt - 1)))
      }
    }
  }
  console.error('All message save attempts failed')
  return false
}

export async function POST(req: NextRequest) {
  try {
    // =========================================================================
    // [P7-03] 성능 측정 시작
    // =========================================================================
    const startTime = performance.now()

    // -------------------------------------------------------------------------
    // 요청 본문 파싱
    // -------------------------------------------------------------------------
    // [Phase 14.5] Category-Scoped Personalization
    const { messages, model: requestedModel, sessionId } = await req.json()
    const lastMessage = messages[messages.length - 1]
    const query = lastMessage.content

    // =========================================================================
    // [Pipeline v5] 1. 사용자 인증 확인 (비로그인 명시적 차단)
    // =========================================================================
    // 주석(시니어 개발자): 기존 'demo-user' fallback 패턴 제거
    // - API 레벨에서 명시적으로 401 반환
    // - RLS만으로 보호하던 것을 이중 검증으로 강화
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const userId = user?.id

    if (!userId) {
      console.warn('[Chat API] Unauthorized access attempt - no user ID')
      return NextResponse.json(
        { error: 'Unauthorized', message: '로그인이 필요합니다.' },
        { status: 401 }
      )
    }

    // -------------------------------------------------------------------------
    // 1.5. 사용자 메시지 저장 (세션 ID가 있는 경우)
    // -------------------------------------------------------------------------
    if (userId && sessionId && lastMessage.role === 'user') {
      await saveMessageWithRetry(supabase, {
        session_id: sessionId,
        role: 'user',
        content: lastMessage.content,
        model_id: requestedModel
      })
    }

    // =========================================================================
    // [P7-03] 병렬 처리: Memory, Template, RAG 동시 실행
    // =========================================================================
    // 기존: Memory → Template → RAG (순차)
    // 개선: Memory + Template + RAG (병렬)
    // =========================================================================

    // -------------------------------------------------------------------------
    // [P7-03] Promise 1: Memory Search (P14-04 Feedback-to-Memory)
    // -------------------------------------------------------------------------
    const memoryPromise = userId
      ? MemoryService.searchPreferences(userId, query, 3, 0.72)
          .catch(err => {
            console.warn('[Chat API] Memory search failed:', err)
            return []
          })
      : Promise.resolve([])

    // -------------------------------------------------------------------------
    // [P7-03] Promise 2: Template Context Search (P3-07)
    // -------------------------------------------------------------------------
    const templatePromise = (async (): Promise<string> => {
      if (!FEATURE_FLAGS.USE_TEMPLATE_FOR_CHAT || !userId) return ''
      try {
        const { data: templateData } = await supabase
          .from('rag_templates')
          .select('criteria_json, name')
          .eq('user_id', userId)
          .eq('status', 'approved')
          .limit(1)
          .single()

        if (!templateData?.criteria_json) return ''

        const templates = templateData.criteria_json as TemplateSchema[]
        // 관련된 기준 2개까지 추출
        const relevantTemplates = templates.filter(t =>
          query.includes(t.category) ||
          t.rationale.toLowerCase().includes(query.toLowerCase().split(' ')[0])
        ).slice(0, 2)

        if (relevantTemplates.length === 0) return ''

        console.log(`[Chat API] Applied ${relevantTemplates.length} template criteria from "${templateData.name}"`)
        return relevantTemplates.map(t => {
          let ctx = `[평가 기준: ${t.rationale}]`
          if (t.positive_examples.length > 0)
            ctx += `\n좋은 예: ${t.positive_examples[0]}`
          if (t.negative_examples.length > 0)
            ctx += `\n나쁜 예: ${t.negative_examples[0]}`
          return ctx
        }).join('\n\n')
      } catch (err) {
        console.warn('[Chat API] Template fetch failed:', err)
        return ''
      }
    })()

    // -------------------------------------------------------------------------
    // [P7-03] Promise 3: RAG Search (Hybrid Search + Query Expansion)
    // -------------------------------------------------------------------------
    const ragPromise = (async (): Promise<{ context: string; hasRetrievedDocs: boolean; uniqueResults: SearchResult[] }> => {
      try {
        const enableQueryExpansion = process.env.ENABLE_QUERY_EXPANSION === 'true'

        if (enableQueryExpansion) {
          // [Query Expansion Mode]
          const { expandQuery } = await import('@/lib/rag/queryExpansion')
          const { calculateDynamicThreshold } = await import('@/lib/rag/dynamicThreshold')

          // Step 1: 쿼리 확장
          const expandedQueries = expandQuery(query)
          console.log(`[Chat API] Query Expansion: ${expandedQueries.length} queries`)

          // Step 2: 동적 임계값
          const dynamicThreshold = calculateDynamicThreshold(query)

          // Step 3: 병렬 검색 (Phase 14.5: with category filter)
          const searchPromises = expandedQueries.map(q =>
            hybridSearch(q, {
              userId,
              topK: 3,
              minScore: dynamicThreshold,
              vectorWeight: 0.6,
              keywordWeight: 0.4,
            }).catch(err => {
              console.warn(`[Chat API] Search failed for "${q}":`, err)
              return []
            })
          )

          const searchResultsArray = await Promise.all(searchPromises)
          const allResults = searchResultsArray.flat()

          // Step 4: 중복 제거 및 정렬
          const seen = new Set<string>()
          const uniqueResults = allResults
            .sort((a, b) => b.score - a.score)
            .filter(result => {
              if (seen.has(result.chunkId)) return false
              seen.add(result.chunkId)
              return true
            })
            .slice(0, 5)

          if (uniqueResults.length > 0) {
            return {
              context: uniqueResults
                .map((result) => `[참고 문서: ${result.metadata?.title || 'Untitled'}]\n${result.content}`)
                .join('\n\n'),
              hasRetrievedDocs: true,
              uniqueResults
            }
          }
        }

        // [Legacy Mode]
        console.log(`[Chat API] Query Expansion: DISABLED`)

        const searchResults = await hybridSearch(query, {
          userId,
          topK: 5,
          minScore: 0.35,
          vectorWeight: 0.6,
          keywordWeight: 0.4,
        })

        if (searchResults.length > 0) {
          return {
            context: searchResults
              .map((result) => `[참고 문서: ${result.metadata?.title || 'Untitled'}]\n${result.content}`)
              .join('\n\n'),
            hasRetrievedDocs: true,
            uniqueResults: searchResults
          }
        }

        return { context: '', hasRetrievedDocs: false, uniqueResults: [] }
      } catch (error) {
        console.warn('RAG search failed:', error)
        return { context: '', hasRetrievedDocs: false, uniqueResults: [] }
      }
    })()

    // =========================================================================
    // [P7-03] Promise.all 병렬 실행
    // =========================================================================
    const [userPreferences, templateContext, ragResult] = await Promise.all([
      memoryPromise,
      templatePromise,
      ragPromise
    ])

    // [P7-03] 병렬 처리 완료 시간 로깅
    const parallelTime = performance.now() - startTime
    console.log(`[Chat API] Parallel fetch completed in ${parallelTime.toFixed(0)}ms`)

    // RAG 결과 추출
    const { context, hasRetrievedDocs, uniqueResults } = ragResult
    let userPreferencesContext = ''
    
    if (userPreferences && userPreferences.length > 0) {
      userPreferencesContext = userPreferences
        .map((p, i) => `[Style Preference ${i+1}] (사용자 선호 답변 스타일)\nQ: ${p.question}\nA: ${p.preferred_answer}`)
        .join('\n\n')
      console.log(`[Chat API] Applied ${userPreferences.length} user preferences`)
    }

    // -------------------------------------------------------------------------
    // 3. 시스템 프롬프트 구성
    // -------------------------------------------------------------------------
    // [P14-05 System Prompt Update] - 선호 지식 반영
    
    const improvedSystemPrompt = `
# 역할
당신은 PRISM Writer의 AI 글쓰기 어시스턴트입니다.

# 핵심 원칙
⚠️ 중요: 아래 참고 자료가 제공된 경우, 당신의 사전 지식보다 참고 자료를 우선해야 합니다.
- 참고 자료의 용어, 구조, 방법론을 그대로 사용하세요
- 일반적인 글쓰기 상식을 먼저 말하지 마세요

# User Preferences (최우선 반영)
⚠️ 아래 내용은 사용자가 과거에 '좋아요'를 표시한 선호 스타일입니다.
⚠️ 다른 참고 자료보다 **가장 최우선으로** 이 스타일과 내용을 반영하여 답변하세요.
${userPreferencesContext ? userPreferencesContext : '(별도 선호 사항 없음)'}

# 평가 기준 템플릿 (P3-07)
${templateContext ? templateContext : '(템플릿 기준 없음)'}

# 참고 자료
${context ? context : '(참고 자료 없음 - 일반 지식으로 답변 가능)'}

# 사고 과정
1. 우선순위 확인: "User Preferences"가 있다면 답변 톤과 구조의 기준으로 삼습니다.
2. 분석: 참고 자료의 핵심 키워드와 구조를 파악합니다.
3. 연결: 사용자 질문이 참고 자료와 어떻게 연결되는지 찾습니다.
4. 답변: 참고 자료 기반으로 답변을 구성합니다.

# 금지 사항
❌ "참고 자료에 관련 내용이 없습니다"라고 즉시 판단하지 마세요
❌ 일반적인 글쓰기 가이드(개요 짜기, 퇴고하기 등)를 먼저 언급하지 마세요

# 출력 형식
한국어로 답변하되, 참고 자료의 핵심 개념을 인용하며 답변하세요.
`

    const legacySystemPrompt = `
당신은 PRISM Writer의 AI 글쓰기 어시스턴트입니다.
사용자의 질문에 대해 친절하고 전문적인 답변을 제공하세요.

[User Preferences (최우선 반영)]
${userPreferencesContext ? userPreferencesContext : '없음'}

[평가 기준 템플릿]
${templateContext ? templateContext : '없음'}

[참고 자료]
${context ? context : '관련된 참고 자료가 없습니다.'}

[지침]
1. "User Preferences"가 있다면 이를 최우선으로 반영하여 답변 스타일을 조정하세요.
2. 참고 자료가 있다면 이를 바탕으로 답변하세요.
3. 참고 자료가 질문과 관련이 없다면, 일반적인 지식을 바탕으로 답변하되 "제공된 자료에는 관련 내용이 없지만..."이라고 언급하세요.
4. 한국어로 답변하세요.
`

    const enableImprovedPrompt = process.env.ENABLE_IMPROVED_PROMPT !== 'false'
    const systemPrompt = enableImprovedPrompt ? improvedSystemPrompt : legacySystemPrompt
    
    // -------------------------------------------------------------------------
    // 4. 대화 히스토리 및 스트리밍 응답
    // -------------------------------------------------------------------------
    const conversationHistory = messages.map((m: any) => 
      `${m.role === 'user' ? '사용자' : 'AI'}: ${m.content}`
    ).join('\n')

    const fullPrompt = `${systemPrompt}\n\n[대화 기록]\n${conversationHistory}\n\nAI:`
    
    const modelId = requestedModel || getDefaultModel()
    console.log(`[Chat API] Using model: ${modelId}`)

    // =========================================================================
    // [P7-03] TTFT 측정을 위한 스트리밍 응답
    // =========================================================================
    const stream = new ReadableStream({
      async start(controller) {
        let fullResponse = ''
        let firstTokenLogged = false  // [P7-03] 첫 토큰 로깅 플래그
        try {
          for await (const chunk of generateTextStream(fullPrompt, { model: modelId })) {
            if (chunk.text) {
              // [P7-03] 첫 토큰 수신 시 TTFT 로깅
              if (!firstTokenLogged) {
                const ttft = performance.now() - startTime
                console.log(`[Chat API] TTFT: ${ttft.toFixed(0)}ms (target: <2000ms)`)
                firstTokenLogged = true
              }
              fullResponse += chunk.text
              controller.enqueue(new TextEncoder().encode(chunk.text))
            }
            if (chunk.done) break
          }
          
          // =====================================================================
          // [Pipeline v5] 메시지 저장 및 실패 시 클라이언트 알림
          // =====================================================================
          if (userId && sessionId && fullResponse) {
            let citationMetadata = {}
            if (hasRetrievedDocs && uniqueResults && uniqueResults.length > 0) {
                const sourceChunksForVerify = uniqueResults.map(r => ({ id: r.chunkId, content: r.content }))
                const verificationResult = verifyCitation(fullResponse, sourceChunksForVerify)
                citationMetadata = {
                  citation_verification: verificationResult,
                  source_count: uniqueResults.length
                }
            }

            // 주석(주니어 개발자): 메시지 저장 시도 및 실패 시 알림
            const saveSuccess = await saveMessageWithRetry(supabase, {
              session_id: sessionId,
              role: 'assistant',
              content: fullResponse,
              model_id: modelId,
              metadata: citationMetadata
            })

            // [Pipeline v5] 저장 실패 시 스트림 끝에 경고 메시지 추가
            if (!saveSuccess) {
              const warningMsg = '\n\n⚠️ _메시지가 서버에 저장되지 않았습니다. 로컬에 백업됩니다._'
              controller.enqueue(new TextEncoder().encode(warningMsg))
              console.error('[Chat API] Message save failed, client notified')
            }

            try {
              await supabase.from('chat_sessions')
                .update({ updated_at: new Date().toISOString() })
                .eq('id', sessionId)
            } catch (e) { console.warn('Session touch failed', e) }
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
