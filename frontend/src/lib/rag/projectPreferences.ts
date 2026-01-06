/**
 * =============================================================================
 * P4: Project RAG Preferences Service
 * =============================================================================
 * 
 * @description 프로젝트별 개인화된 RAG 임계값을 관리하는 서비스
 * @module projectPreferences
 * @since 2026-01-06
 * @related 2601062127_Adaptive_Threshold_System_체크리스트.md
 * 
 * 주요 기능:
 * - getProjectThreshold: 프로젝트별 임계값 조회/생성
 * - applyLearningEvent: 학습 이벤트 적용 및 임계값 업데이트
 * - SIGNAL_CONFIG: 신호 유형별 가중치 설정
 * 
 * 프로젝트 격리:
 * - 각 프로젝트는 독립적인 임계값을 가짐
 * - A 프로젝트의 학습이 B 프로젝트에 영향 없음
 */

import { SupabaseClient } from '@supabase/supabase-js'
import { logger } from '@/lib/utils/logger'

// =============================================================================
// Types & Interfaces
// =============================================================================

/**
 * 프로젝트별 RAG 설정 인터페이스
 */
export interface ProjectRAGPreferences {
  id: string
  user_id: string
  project_id: string
  groundedness_threshold: number
  critique_threshold: number
  retrieval_threshold: number
  feedback_count: number
  positive_ratio: number
  created_at?: string
  updated_at?: string
}

/**
 * 학습 이벤트 적용 결과
 */
export interface LearningEventResult {
  success: boolean
  newThreshold: number
  adjustment?: number
  error?: string
}

// =============================================================================
// Constants
// =============================================================================

/**
 * 기본 임계값 설정
 * @description 새 프로젝트 생성 시 사용되는 기본값
 */
export const DEFAULT_PREFS: Omit<ProjectRAGPreferences, 'id' | 'user_id' | 'project_id' | 'created_at' | 'updated_at'> = {
  groundedness_threshold: 0.7,
  critique_threshold: 0.6,
  retrieval_threshold: 0.5,
  feedback_count: 0,
  positive_ratio: 0.5,
}

/**
 * 임계값 범위 제한
 */
export const THRESHOLD_BOUNDS = {
  MIN: 0.4,   // 최소 임계값 (너무 관대하지 않도록)
  MAX: 0.95,  // 최대 임계값 (너무 엄격하지 않도록)
} as const

/**
 * 학습 신호 유형별 설정
 * @description 각 신호 유형의 가중치(weight)와 조정값(adjustment) 정의
 * 
 * - weight: 신호의 중요도 (0.0 ~ 1.0)
 * - adjustment: 임계값 조정 방향 (+: 엄격하게, -: 유연하게)
 * 
 * 유효 조정 = adjustment × weight × learningRate
 */
export const SIGNAL_CONFIG = {
  // 평가 관련 (주요 신호)
  eval_override: { weight: 0.8, adjustment: 0.05 },   // 평가 점수 수정: 가장 강력한 신호
  rubric_adopt: { weight: 0.5, adjustment: 0.03 },    // 루브릭 채택
  doc_reupload: { weight: 0.4, adjustment: 0.02 },    // 문서 재업로드
  example_pin: { weight: 0.3, adjustment: 0.02 },     // 예시 Pin

  // 채팅 피드백 (보조 신호)
  chat_helpful: { weight: 0.3, adjustment: -0.02 },   // 👍 도움됨: 유연하게
  chat_not_helpful: { weight: 0.3, adjustment: 0 },   // 👎 아니요: 중립
  chat_hallucination: { weight: 0.5, adjustment: 0.05 }, // 🚨 틀린 정보: 엄격하게
} as const

/**
 * 학습 신호 유형
 */
export type SignalType = keyof typeof SIGNAL_CONFIG

// =============================================================================
// Learning Rate Functions
// =============================================================================

/**
 * 적응형 Learning Rate 계산
 * @description 피드백 수에 따라 학습률을 조정
 * - 신규 사용자: 빠른 학습 (0.2) - 초기 개인화 빠르게
 * - 중간 사용자: 중간 학습 (0.1)
 * - 기존 사용자: 안정화 (0.05) - 급격한 변화 방지
 * 
 * @param feedbackCount 누적 피드백/이벤트 수
 * @returns Learning Rate (0.05 ~ 0.2)
 */
export function getAdaptiveLearningRate(feedbackCount: number): number {
  if (feedbackCount < 10) return 0.2   // 빠른 학습 (신규)
  if (feedbackCount < 50) return 0.1   // 중간
  return 0.05                          // 안정화 (기존)
}

/**
 * 임계값 조정 계산
 * @description 신호 유형과 피드백 수를 바탕으로 조정값 계산
 * 
 * @param signalType 학습 신호 유형
 * @param feedbackCount 누적 피드백 수
 * @returns 계산된 조정값 (양수: 엄격, 음수: 유연)
 */
export function calculateAdjustment(
  signalType: SignalType,
  feedbackCount: number
): number {
  const config = SIGNAL_CONFIG[signalType]
  const learningRate = getAdaptiveLearningRate(feedbackCount)
  return config.adjustment * config.weight * learningRate
}

/**
 * 임계값 범위 제한
 * @description 임계값이 정의된 범위 내에 있도록 보장
 * 
 * @param value 원래 값
 * @returns 범위 내로 제한된 값
 */
export function clampThreshold(value: number): number {
  return Math.max(THRESHOLD_BOUNDS.MIN, Math.min(THRESHOLD_BOUNDS.MAX, value))
}

// =============================================================================
// Database Operations
// =============================================================================

/**
 * 프로젝트별 RAG 임계값 조회
 * @description 프로젝트의 개인화된 임계값을 조회하거나, 없으면 기본값으로 생성
 * 
 * @param supabase Supabase 클라이언트
 * @param userId 사용자 ID
 * @param projectId 프로젝트 ID
 * @returns 프로젝트 RAG 설정
 * 
 * @example
 * const prefs = await getProjectThreshold(supabase, userId, projectId)
 * console.log(prefs.groundedness_threshold) // 0.7
 */
export async function getProjectThreshold(
  supabase: SupabaseClient,
  userId: string,
  projectId: string
): Promise<ProjectRAGPreferences> {
  try {
    // 1. 기존 preferences 조회 시도
    const { data, error } = await supabase
      .from('project_rag_preferences')
      .select('*')
      .eq('user_id', userId)
      .eq('project_id', projectId)
      .single()

    // 2. 데이터가 있으면 반환
    if (data) {
      logger.debug('[ProjectPrefs]', 'Found existing preferences', { 
        projectId, 
        threshold: data.groundedness_threshold 
      })
      return data as ProjectRAGPreferences
    }

    // 3. PGRST116 = not found → 새로 생성
    if (error?.code === 'PGRST116') {
      logger.info('[ProjectPrefs]', 'Creating new preferences', { userId, projectId })
      
      const { data: newData, error: insertError } = await supabase
        .from('project_rag_preferences')
        .insert({ user_id: userId, project_id: projectId })
        .select()
        .single()

      if (newData) {
        return newData as ProjectRAGPreferences
      }

      // Insert 실패 시에도 기본값 반환
      if (insertError) {
        logger.warn('[ProjectPrefs]', 'Insert failed, using defaults', { error: insertError.message })
      }
    } else if (error) {
      // 다른 에러 로깅
      logger.error('[ProjectPrefs]', 'Query error', { error: error.message })
    }

    // 4. 에러 발생 시 기본값 반환 (fallback)
    return {
      ...DEFAULT_PREFS,
      id: '',
      user_id: userId,
      project_id: projectId,
    }
  } catch (err) {
    // 예외 발생 시 기본값 반환
    logger.error('[ProjectPrefs]', 'Unexpected error', { error: err instanceof Error ? err.message : String(err) })
    return {
      ...DEFAULT_PREFS,
      id: '',
      user_id: userId,
      project_id: projectId,
    }
  }
}

/**
 * 학습 이벤트 적용 및 임계값 업데이트
 * @description 사용자 행동(피드백, 점수 수정 등)을 기반으로 임계값을 조정
 * 
 * @param supabase Supabase 클라이언트
 * @param userId 사용자 ID
 * @param projectId 프로젝트 ID
 * @param signalType 학습 신호 유형
 * @param eventData 추가 이벤트 데이터 (선택)
 * @returns 적용 결과 { success, newThreshold, adjustment }
 * 
 * @example
 * const result = await applyLearningEvent(
 *   supabase, userId, projectId, 
 *   'chat_helpful', 
 *   { messageId: 'xxx' }
 * )
 * console.log(result.newThreshold) // 0.68
 */
export async function applyLearningEvent(
  supabase: SupabaseClient,
  userId: string,
  projectId: string,
  signalType: SignalType,
  eventData?: Record<string, unknown>
): Promise<LearningEventResult> {
  try {
    // 1. 현재 preferences 조회
    const prefs = await getProjectThreshold(supabase, userId, projectId)

    // 2. 조정값 계산
    const adjustment = calculateAdjustment(signalType, prefs.feedback_count)

    // 3. 새 임계값 계산 (범위 제한 적용)
    const newThreshold = clampThreshold(prefs.groundedness_threshold + adjustment)

    logger.info('[LearningEvent]', 'Applying adjustment', {
      projectId,
      signalType,
      oldThreshold: prefs.groundedness_threshold,
      adjustment,
      newThreshold,
      feedbackCount: prefs.feedback_count + 1,
    })

    // 4. DB 업데이트
    const { error: updateError } = await supabase
      .from('project_rag_preferences')
      .update({
        groundedness_threshold: newThreshold,
        feedback_count: prefs.feedback_count + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .eq('project_id', projectId)

    if (updateError) {
      logger.error('[LearningEvent]', 'Update failed', { error: updateError.message })
      return {
        success: false,
        newThreshold: prefs.groundedness_threshold,
        error: updateError.message,
      }
    }

    // 5. 이벤트 로그 저장 (실패해도 메인 로직에 영향 없음)
    try {
      await supabase.from('learning_events').insert({
        user_id: userId,
        project_id: projectId,
        event_type: signalType,
        event_data: eventData || {},
        influence_weight: SIGNAL_CONFIG[signalType].weight,
        applied_adjustment: adjustment,
      })
    } catch (logError) {
      // 로그 저장 실패는 무시 (핵심 로직에 영향 없음)
      logger.warn('[LearningEvent]', 'Log insert failed', { error: logError instanceof Error ? logError.message : String(logError) })
    }

    return {
      success: true,
      newThreshold,
      adjustment,
    }
  } catch (err) {
    logger.error('[LearningEvent]', 'Unexpected error', { error: err instanceof Error ? err.message : String(err) })
    return {
      success: false,
      newThreshold: DEFAULT_PREFS.groundedness_threshold,
      error: err instanceof Error ? err.message : 'Unknown error',
    }
  }
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * 신호 유형 유효성 검사
 * @param signalType 검사할 신호 유형
 * @returns 유효한 신호 유형인지 여부
 */
export function isValidSignalType(signalType: string): signalType is SignalType {
  return signalType in SIGNAL_CONFIG
}

/**
 * 신호 유형별 설명 조회
 * @param signalType 신호 유형
 * @returns 한국어 설명
 */
export function getSignalDescription(signalType: SignalType): string {
  const descriptions: Record<SignalType, string> = {
    eval_override: '평가 점수 수정',
    rubric_adopt: '루브릭 채택',
    doc_reupload: '문서 재업로드',
    example_pin: '예시 Pin',
    chat_helpful: '채팅 도움됨',
    chat_not_helpful: '채팅 아니요',
    chat_hallucination: '틀린 정보 신고',
  }
  return descriptions[signalType]
}
