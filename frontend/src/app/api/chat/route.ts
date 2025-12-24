// =============================================================================
// PRISM Writer - Chat API
// =============================================================================
// 파일: frontend/src/app/api/chat/route.ts
// 역할: RAG 기반 AI 채팅 API (LLM Gateway 사용)
// 수정: 2025-12-23 - OpenAI 하드코딩 제거, Gateway 연동으로 Gemini 기본 사용
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { vectorSearch } from '@/lib/rag/search'
import { generateTextStream } from '@/lib/llm/gateway'
import { getDefaultModel } from '@/config/llm.config'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

// -----------------------------------------------------------------------------
// Helper: 재시도 로직이 포함된 메시지 저장 함수
// -----------------------------------------------------------------------------
async function saveMessageWithRetry(
  supabase: any,
  data: { session_id: string; role: string; content: string; model_id?: string },
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
        // 지수 백오프: 100ms, 200ms, 400ms...
        await new Promise(resolve => setTimeout(resolve, 100 * Math.pow(2, attempt - 1)))
      }
    }
  }
  console.error('All message save attempts failed')
  return false
}

export async function POST(req: NextRequest) {
  try {
    // -------------------------------------------------------------------------
    // 요청 본문 파싱 (messages + 선택적 model + sessionId)
    // -------------------------------------------------------------------------
    const { messages, model: requestedModel, sessionId } = await req.json()
    const lastMessage = messages[messages.length - 1]
    const query = lastMessage.content

    // -------------------------------------------------------------------------
    // 1. 사용자 ID 확인
    // -------------------------------------------------------------------------
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const userId = user?.id

    // -------------------------------------------------------------------------
    // 1.5. 사용자 메시지 저장 (세션 ID가 있는 경우) - 재시도 로직 포함
    // -------------------------------------------------------------------------
    if (userId && sessionId && lastMessage.role === 'user') {
      await saveMessageWithRetry(supabase, {
        session_id: sessionId,
        role: 'user',
        content: lastMessage.content,
        model_id: requestedModel
      })
    }

    // -------------------------------------------------------------------------
    // 2. RAG 검색 (Vector Search)
    // -------------------------------------------------------------------------
    let context = ''
    try {
      const searchResults = await vectorSearch(query, {
        userId: userId || 'demo-user', // Fallback for RAG if not logged in
        topK: 3,
        minScore: 0.5,
      })

      if (searchResults.length > 0) {
        context = searchResults
          .map((result) => `[참고 문서: ${result.metadata?.title || 'Untitled'}]\n${result.content}`)
          .join('\n\n')
      }
    } catch (error) {
      console.warn('RAG search failed:', error)
      // 검색 실패해도 대화는 계속 진행
    }

    // -------------------------------------------------------------------------
    // 3. 시스템 프롬프트 구성
    // -------------------------------------------------------------------------
    const systemPrompt = `
당신은 PRISM Writer의 AI 글쓰기 어시스턴트입니다.
사용자의 질문에 대해 친절하고 전문적인 답변을 제공하세요.

[참고 자료]
${context ? context : '관련된 참고 자료가 없습니다.'}

[지침]
1. 참고 자료가 있다면 이를 바탕으로 답변하세요.
2. 참고 자료가 질문과 관련이 없다면, 일반적인 지식을 바탕으로 답변하되 "제공된 자료에는 관련 내용이 없지만..."이라고 언급하세요.
3. 글쓰기, 문법, 아이디어 생성 등에 도움을 주세요.
4. 한국어로 답변하세요.
`

    // -------------------------------------------------------------------------
    // 4. 대화 히스토리를 포함한 프롬프트 구성
    // -------------------------------------------------------------------------
    const conversationHistory = messages.map((m: any) => 
      `${m.role === 'user' ? '사용자' : 'AI'}: ${m.content}`
    ).join('\n')

    const fullPrompt = `${systemPrompt}\n\n[대화 기록]\n${conversationHistory}\n\nAI:`

    // -------------------------------------------------------------------------
    // 5. LLM Gateway를 통한 스트리밍 응답
    // Admin Mode에서 선택한 모델이 있으면 사용, 없으면 기본값 (Gemini 3.0 Flash)
    // -------------------------------------------------------------------------
    const modelId = requestedModel || getDefaultModel()
    console.log(`[Chat API] Using model: ${modelId} (requested: ${requestedModel || 'none'})`)

    const stream = new ReadableStream({
      async start(controller) {
        let fullResponse = ''
        try {
          for await (const chunk of generateTextStream(fullPrompt, { model: modelId })) {
            if (chunk.text) {
              fullResponse += chunk.text
              controller.enqueue(new TextEncoder().encode(chunk.text))
            }
            if (chunk.done) {
              break
            }
          }
          
          // -----------------------------------------------------------------------
          // 6. AI 응답 저장 (세션 ID가 있는 경우) - 재시도 로직 포함
          // -----------------------------------------------------------------------
          if (userId && sessionId && fullResponse) {
            await saveMessageWithRetry(supabase, {
              session_id: sessionId,
              role: 'assistant',
              content: fullResponse,
              model_id: modelId
            })
            
            // 세션 업데이트 시간 갱신
            try {
              await supabase.from('chat_sessions')
                .update({ updated_at: new Date().toISOString() })
                .eq('id', sessionId)
            } catch (error) {
              console.warn('Failed to update session timestamp:', error)
            }
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
