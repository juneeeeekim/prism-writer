// =============================================================================
// PRISM Writer - Chat API
// =============================================================================
// 파일: frontend/src/app/api/chat/route.ts
// 역할: RAG 기반 AI 채팅 API (LLM Gateway 사용)
// 수정: 2025-12-23 - OpenAI 하드코딩 제거, Gateway 연동으로 Gemini 기본 사용
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { hybridSearch, type SearchResult } from '@/lib/rag/search'
import { generateTextStream } from '@/lib/llm/gateway'
import { getDefaultModel } from '@/config/llm.config'
import { createClient } from '@/lib/supabase/server'
import { verifyCitation } from '@/lib/rag/citationGate'

export const runtime = 'nodejs'

// -----------------------------------------------------------------------------
// Helper: 재시도 로직이 포함된 메시지 저장 함수
// -----------------------------------------------------------------------------
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
    // 2. RAG 검색 (Hybrid Search + Query Expansion)
    // -------------------------------------------------------------------------
    // [RAG 환각 방지 업그레이드] 2025-12-27
    // Feature Flag: ENABLE_QUERY_EXPANSION으로 쿼리 확장 ON/OFF
    // Promise.all로 병렬 처리하여 응답 시간 최적화
    // -------------------------------------------------------------------------
    let context = ''
    let hasRetrievedDocs = false
    let uniqueResults: SearchResult[] = []
    
    try {
      const enableQueryExpansion = process.env.ENABLE_QUERY_EXPANSION === 'true'
      
      if (enableQueryExpansion) {
        // =======================================================================
        // [Query Expansion Mode] 쿼리 확장 + 병렬 검색
        // =======================================================================
        const { expandQuery } = await import('@/lib/rag/queryExpansion')
        const { calculateDynamicThreshold } = await import('@/lib/rag/dynamicThreshold')
        
        // Step 1: 쿼리 확장 (최대 5개)
        const expandedQueries = expandQuery(query)
        console.log(`[Chat API] Query Expansion: ${expandedQueries.length} queries`)
        console.log(`[Chat API] Expanded: ${expandedQueries.join(' | ')}`)
        
        // Step 2: 동적 임계값 계산
        const dynamicThreshold = calculateDynamicThreshold(query)
        console.log(`[Chat API] Dynamic Threshold: ${dynamicThreshold}`)
        
        // Step 3: 병렬 검색 (Promise.all)
        const searchPromises = expandedQueries.map(q => 
          hybridSearch(q, {
            userId: userId || 'demo-user',
            topK: 3,              // 쿼리당 3개 (총 최대 15개)
            minScore: dynamicThreshold,
            vectorWeight: 0.6,
            keywordWeight: 0.4
          }).catch(err => {
            console.warn(`[Chat API] Search failed for "${q}":`, err)
            return [] // 개별 검색 실패해도 계속 진행
          })
        )
        
        const searchResultsArray = await Promise.all(searchPromises)
        const allResults = searchResultsArray.flat()
        
        // Step 4: 중복 제거 (chunkId 기준) + 점수순 정렬
        const seen = new Set<string>()
        uniqueResults = allResults
          .sort((a, b) => b.score - a.score)
          .filter(result => {
            if (seen.has(result.chunkId)) return false
            seen.add(result.chunkId)
            return true
          })
          .slice(0, 5) // 최종 5개만 사용
        
        console.log(`[Chat API] Query Expansion Results: ${allResults.length} → ${uniqueResults.length} (deduplicated)`)
        
        if (uniqueResults.length > 0) {
          hasRetrievedDocs = true
          context = uniqueResults
            .map((result) => `[참고 문서: ${result.metadata?.title || 'Untitled'}]\n${result.content}`)
            .join('\n\n')
        } else {
          console.log('[Chat API] No relevant documents found via expanded search.')
        }
        
      } else {
        // =======================================================================
        // [Legacy Mode] 기존 단일 쿼리 검색 (Feature Flag OFF)
        // =======================================================================
        console.log('[Chat API] Query Expansion: DISABLED (using legacy search)')
        
        const searchResults = await hybridSearch(query, {
          userId: userId || 'demo-user',
          topK: 5,
          minScore: 0.35,
          vectorWeight: 0.6,
          keywordWeight: 0.4
        })

        if (searchResults.length > 0) {
          hasRetrievedDocs = true
          uniqueResults = searchResults
          context = searchResults
            .map((result) => `[참고 문서: ${result.metadata?.title || 'Untitled'}]\n${result.content}`)
            .join('\n\n')
        } else {
          console.log('[Chat API] No relevant documents found via hybrid search.')
        }
      }
      
    } catch (error) {
      console.warn('RAG search failed:', error)
      // 검색 실패해도 대화는 계속 진행
    }

    // -------------------------------------------------------------------------
    // 3. 시스템 프롬프트 구성
    // -------------------------------------------------------------------------
    // [RAG 환각 방지 업그레이드] 2025-12-27
    // Feature Flag: ENABLE_IMPROVED_PROMPT로 신/구 프롬프트 전환 가능
    // 롤백 시: ENABLE_IMPROVED_PROMPT=false 환경 변수 설정
    // -------------------------------------------------------------------------
    
    // 개선된 프롬프트 (환각 방지 강화)
    const improvedSystemPrompt = `
# 역할
당신은 PRISM Writer의 AI 글쓰기 어시스턴트입니다.

# 핵심 원칙 (반드시 준수)
⚠️ 중요: 아래 참고 자료가 제공된 경우, 당신의 사전 지식보다 참고 자료를 우선해야 합니다.
- 참고 자료의 용어, 구조, 방법론을 그대로 사용하세요
- 일반적인 글쓰기 상식을 먼저 말하지 마세요
- 참고 자료에 없는 내용을 추가할 때는 명확히 구분하세요

# 참고 자료
${context ? context : '(참고 자료 없음 - 일반 지식으로 답변 가능)'}

# 사고 과정 (답변 전 내부적으로 수행)
1. 분석: 참고 자료의 핵심 키워드와 구조를 파악합니다
2. 연결: 사용자 질문이 참고 자료와 어떻게 연결되는지 찾습니다
3. 적용: 참고 자료의 프레임워크를 사용자 질문에 적용합니다
4. 답변: 참고 자료 기반으로 답변을 구성합니다

# 금지 사항
❌ "참고 자료에 관련 내용이 없습니다"라고 즉시 판단하지 마세요
❌ 일반적인 글쓰기 가이드(개요 짜기, 퇴고하기 등)를 먼저 언급하지 마세요
❌ 참고 자료를 무시하고 사전 지식만으로 답변하지 마세요

# 출력 형식
한국어로 답변하되, 참고 자료의 핵심 개념을 인용하며 답변하세요.
`

    // 기존 프롬프트 (롤백용 백업)
    const legacySystemPrompt = `
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

    // Feature Flag로 프롬프트 선택
    const enableImprovedPrompt = process.env.ENABLE_IMPROVED_PROMPT !== 'false'
    const systemPrompt = enableImprovedPrompt ? improvedSystemPrompt : legacySystemPrompt
    
    if (enableImprovedPrompt) {
      console.log('[Chat API] Using IMPROVED prompt (anti-hallucination)')
    } else {
      console.log('[Chat API] Using LEGACY prompt (fallback)')
    }

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
            
            // [Citation Gate] 2025-12-27 Integration
            let citationMetadata = {}
            if (hasRetrievedDocs && uniqueResults && uniqueResults.length > 0) {
              const sourceChunksForVerify = uniqueResults.map(r => ({ id: r.chunkId, content: r.content }))
              // 전체 응답을 하나의 인용으로 간주하여 검증 (임시: 0.6 이상 매칭 시 성공)
              const verificationResult = verifyCitation(fullResponse, sourceChunksForVerify)
              
              citationMetadata = {
                citation_verification: verificationResult,
                source_count: uniqueResults.length
              }
            }

            await saveMessageWithRetry(supabase, {
              session_id: sessionId,
              role: 'assistant',
              content: fullResponse,
              model_id: modelId,
              metadata: citationMetadata
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
