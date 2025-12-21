import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { vectorSearch } from '@/lib/rag/search'

// =============================================================================
// PRISM Writer - Chat API
// =============================================================================
// 파일: frontend/src/app/api/chat/route.ts
// 역할: RAG 기반 AI 채팅 API
// =============================================================================

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const { messages } = await req.json()
    const lastMessage = messages[messages.length - 1]
    const query = lastMessage.content

    // 1. 사용자 ID 확인 (데모용 하드코딩 또는 세션에서 가져오기)
    // TODO: 실제 인증 연동 시 req.headers 또는 session에서 가져오기
    const userId = 'demo-user' 

    // 2. RAG 검색 (Vector Search)
    // Phase 3 초기 구현: Vector Search만 사용 (Hybrid는 추후 적용)
    let context = ''
    try {
      const searchResults = await vectorSearch(query, {
        userId,
        topK: 3,
        minScore: 0.5, // 적절한 임계값 설정
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

    // 3. 시스템 프롬프트 구성
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

    // 4. OpenAI API 호출 (Streaming)
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })

    const response = await openai.chat.completions.create({
      model: 'gpt-4-turbo-preview', // 또는 gpt-3.5-turbo
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages.map((m: any) => ({
          role: m.role,
          content: m.content,
        })),
      ],
      stream: true,
      temperature: 0.7,
    })

    // 5. 스트림 응답 반환
    // Vercel AI SDK나 단순 ReadableStream 사용 가능. 여기서는 단순 스트림 변환.
    const stream = new ReadableStream({
      async start(controller) {
        for await (const chunk of response) {
          const content = chunk.choices[0]?.delta?.content || ''
          if (content) {
            controller.enqueue(new TextEncoder().encode(content))
          }
        }
        controller.close()
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
