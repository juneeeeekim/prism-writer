// =============================================================================
// PRISM Writer - Chat Service
// =============================================================================
// 파일: frontend/src/lib/services/chat/chatService.ts
// 역할: 채팅 비즈니스 로직 (메시지 저장, Memory/Template 검색)
// 리팩토링: 2026-01-20
// =============================================================================

import { MemoryService } from '@/lib/rag/memory'
import { FEATURE_FLAGS } from '@/config/featureFlags'
import { type TemplateSchema } from '@/lib/rag/templateTypes'

// =============================================================================
// Types
// =============================================================================

export interface UserPreference {
  question: string
  preferred_answer: string
}

// =============================================================================
// Message Save with Retry
// =============================================================================

export async function saveMessageWithRetry(
  supabase: any,
  data: {
    session_id: string
    role: string
    content: string
    model_id?: string
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
        await new Promise((resolve) =>
          setTimeout(resolve, 100 * Math.pow(2, attempt - 1))
        )
      }
    }
  }
  console.error('All message save attempts failed')
  return false
}

// =============================================================================
// Memory Search (User Preferences)
// =============================================================================

export async function searchUserPreferences(
  userId: string,
  query: string
): Promise<UserPreference[]> {
  try {
    return await MemoryService.searchPreferences(userId, query, 3, 0.72)
  } catch (err) {
    console.warn('[ChatService] Memory search failed:', err)
    return []
  }
}

export function formatUserPreferences(preferences: UserPreference[]): string {
  if (!preferences || preferences.length === 0) return ''

  return preferences
    .map(
      (p, i) =>
        `[Style Preference ${i + 1}] (사용자 선호 답변 스타일)\nQ: ${p.question}\nA: ${p.preferred_answer}`
    )
    .join('\n\n')
}

// =============================================================================
// Template Context Search
// =============================================================================

export async function searchTemplateContext(
  supabase: any,
  userId: string,
  query: string
): Promise<string> {
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
    const relevantTemplates = templates
      .filter(
        (t) =>
          query.includes(t.category) ||
          t.rationale.toLowerCase().includes(query.toLowerCase().split(' ')[0])
      )
      .slice(0, 2)

    if (relevantTemplates.length === 0) return ''

    console.log(
      `[ChatService] Applied ${relevantTemplates.length} template criteria`
    )

    return relevantTemplates
      .map((t) => {
        let ctx = `[평가 기준: ${t.rationale}]`
        if (t.positive_examples.length > 0)
          ctx += `\n좋은 예: ${t.positive_examples[0]}`
        if (t.negative_examples.length > 0)
          ctx += `\n나쁜 예: ${t.negative_examples[0]}`
        return ctx
      })
      .join('\n\n')
  } catch (err) {
    console.warn('[ChatService] Template fetch failed:', err)
    return ''
  }
}

// =============================================================================
// Session Update
// =============================================================================

export async function touchSession(
  supabase: any,
  sessionId: string
): Promise<void> {
  try {
    await supabase
      .from('chat_sessions')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', sessionId)
  } catch (e) {
    console.warn('Session touch failed', e)
  }
}

// =============================================================================
// [L2-01] Lazy Self-RAG 조건 판단 함수 (2026-01-21 추가)
// 목적: 고위험 응답에만 Self-RAG 검증 실행하여 LLM 비용 70% 절감
// =============================================================================

/**
 * Lazy Self-RAG 조건 판단
 * 
 * @description
 * 모든 응답이 아닌 고위험 응답에만 Self-RAG 검증을 적용합니다.
 * 조건: 참고 자료 있음 + 응답 길이 충분 + 질문 길이 충분
 * 
 * @param query - 사용자 질문
 * @param fullResponse - LLM 응답 전문
 * @param hasRetrievedDocs - 참고 자료 존재 여부
 * @returns true면 Self-RAG 실행, false면 스킵
 */
export function shouldRunLazySelfRAG(
  query: string,
  fullResponse: string,
  hasRetrievedDocs: boolean
): boolean {
  // Lazy 모드 비활성화 시 기존 ENABLE_SELF_RAG 따름
  if (!FEATURE_FLAGS.LAZY_SELF_RAG_MODE) {
    return FEATURE_FLAGS.ENABLE_SELF_RAG
  }

  // 참고 자료가 없으면 스킵 (근거 검증 불가)
  if (!hasRetrievedDocs) {
    return false
  }

  // 짧은 응답은 스킵 (기본값: 500자 미만)
  if (fullResponse.length < FEATURE_FLAGS.LAZY_SELF_RAG_MIN_RESPONSE_LENGTH) {
    return false
  }

  // 짧은 질문은 스킵 (기본값: 50자 미만)
  if (query.length < FEATURE_FLAGS.LAZY_SELF_RAG_MIN_QUERY_LENGTH) {
    return false
  }

  return true
}
