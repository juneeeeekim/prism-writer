// =============================================================================
// PRISM Writer - Memory Service
// =============================================================================
// 파일: frontend/src/lib/rag/memory.ts
// 역할: 사용자 선호/피드백 메모리 저장 및 검색 (pgvector 기반)
// 설명: Feedback-to-Memory 루프의 핵심 모듈. 사용자의 피드백을 기억하고 RAG에 반영.
// =============================================================================

import { createClient } from '@/lib/supabase/server'
import { embedText } from './embedding'

// =============================================================================
// 타입 정의
// =============================================================================

export interface UserPreference {
  id: string
  question: string
  preferred_answer: string
  similarity: number
  created_at?: string
}

// =============================================================================
// MemoryService
// =============================================================================

export class MemoryService {
  /**
   * 사용자 선호 지식(피드백)을 저장합니다.
   * 
   * @param userId - 사용자 ID
   * @param question - 사용자 질문
   * @param preferredAnswer - 사용자가 좋아한 답변
   * @param embedding - (선택) 미리 생성된 임베딩, 없으면 내부에서 생성
   */
  static async savePreference(
    userId: string,
    question: string,
    preferredAnswer: string,
    embedding?: number[]
  ): Promise<void> {
    const supabase = createClient()
    
    // 임베딩이 없으면 생성
    const vector = embedding || await embedText(question)
    
    // DB 저장
    const { error } = await supabase
      .from('user_preferences')
      .insert({
        user_id: userId,
        question,
        preferred_answer: preferredAnswer,
        embedding: vector
      })
      
    if (error) {
      console.error('[MemoryService] Failed to save preference:', error)
      throw new Error(`Failed to save user preference: ${error.message}`)
    }
    
    console.log(`[MemoryService] Preference saved for user ${userId}`)
  }

  /**
   * 사용자 선호 지식을 유사도 기반으로 검색합니다.
   * 
   * @param userId - 사용자 ID
   * @param query - 검색 쿼리 (텍스트)
   * @param limit - 반환할 결과 개수 (기본: 3)
   * @param threshold - 유사도 임계값 (기본: 0.75)
   */
  static async searchPreferences(
    userId: string, 
    query: string, 
    limit: number = 3,
    threshold: number = 0.75
  ): Promise<UserPreference[]> {
    const supabase = createClient()
    
    // 쿼리 임베딩
    const queryEmbedding = await embedText(query)
    
    // RPC 호출 (match_user_preferences)
    const { data, error } = await supabase.rpc('match_user_preferences', {
      query_embedding: queryEmbedding,
      match_threshold: threshold,
      match_count: limit,
      user_id_param: userId
    })
    
    if (error) {
      console.error('[MemoryService] Failed to search preferences:', error)
      // 검색 실패는 전체 에러로 번지지 않게 빈 배열 반환 (Fail-open)
      return []
    }
    
    return (data || []).map((item: any) => ({
      id: item.id,
      question: item.question,
      preferred_answer: item.preferred_answer,
      similarity: item.similarity
    }))
  }
  
  /**
   * (오버로딩) 임베딩 벡터로 검색
   */
  static async searchPreferencesByVector(
    userId: string,
    queryEmbedding: number[],
    limit: number = 3,
    threshold: number = 0.75
  ): Promise<UserPreference[]> {
    const supabase = createClient()
    
    const { data, error } = await supabase.rpc('match_user_preferences', {
      query_embedding: queryEmbedding,
      match_threshold: threshold,
      match_count: limit,
      user_id_param: userId
    })
    
    if (error) {
      console.error('[MemoryService] Failed to search preferences (vector):', error)
      return []
    }
    
    return (data || []).map((item: any) => ({
      id: item.id,
      question: item.question,
      preferred_answer: item.preferred_answer,
      similarity: item.similarity
    }))
  }
}
