// =============================================================================
// PRISM Writer - Evaluation Logger
// =============================================================================
// 파일: frontend/src/lib/logging/evaluationLogger.ts
// 역할: 평가 실행 로그 기록 및 감사 추적
// =============================================================================

import { createClient } from '@/lib/supabase/server'

// =============================================================================
// 타입 정의
// =============================================================================

/** 로그 수준 */
export type LogLevel = 'info' | 'warn' | 'error' | 'debug'

/** 평가 로그 항목 */
export interface EvaluationLog {
  /** 로그 ID (자동 생성) */
  id?: string
  /** 사용자 ID */
  userId: string
  /** 로그 수준 */
  level: LogLevel
  /** 이벤트 타입 */
  eventType: EvaluationEventType
  /** 상세 메시지 */
  message: string
  /** 메타데이터 */
  metadata?: Record<string, unknown>
  /** 생성 시간 */
  createdAt?: string
}

/** 평가 이벤트 타입 */
export type EvaluationEventType =
  | 'evaluation_started'
  | 'evaluation_completed'
  | 'evaluation_failed'
  | 'rubric_applied'
  | 'search_completed'
  | 'llm_called'
  | 'usage_limit_reached'

/** 평가 통계 */
export interface EvaluationStats {
  /** 총 평가 횟수 */
  totalEvaluations: number
  /** 성공 횟수 */
  successCount: number
  /** 실패 횟수 */
  failureCount: number
  /** 성공률 (%) */
  successRate: number
  /** 평균 점수 */
  averageScore: number
}

// =============================================================================
// 로그 기록 함수
// =============================================================================

/**
 * 평가 로그 기록
 * 
 * @description
 * 서버 사이드에서 Supabase에 로그를 기록합니다.
 * 클라이언트에서 호출 시 콘솔 로그로 대체됩니다.
 */
export async function logEvaluationEvent(log: Omit<EvaluationLog, 'id' | 'createdAt'>): Promise<void> {
  // 콘솔 로그 (개발 환경)
  const prefix = `[Evaluation:${log.level.toUpperCase()}]`
  console.log(prefix, log.eventType, log.message, log.metadata || '')

  // Supabase 로그 저장 시도
  try {
    const supabase = await createClient()
    
    await supabase.from('evaluation_logs').insert({
      user_id: log.userId,
      level: log.level,
      event_type: log.eventType,
      message: log.message,
      metadata: log.metadata || {},
      created_at: new Date().toISOString(),
    })
  } catch (error) {
    // 로그 저장 실패는 조용히 처리 (로그 실패로 메인 기능 중단 방지)
    console.warn('[EvaluationLogger] Failed to save log:', error)
  }
}

// =============================================================================
// 편의 함수
// =============================================================================

/**
 * 평가 시작 로그
 */
export async function logEvaluationStarted(
  userId: string,
  rubricCount: number,
  textLength: number
): Promise<void> {
  await logEvaluationEvent({
    userId,
    level: 'info',
    eventType: 'evaluation_started',
    message: `평가 시작: ${rubricCount}개 루브릭, ${textLength}자 텍스트`,
    metadata: { rubricCount, textLength },
  })
}

/**
 * 평가 완료 로그
 */
export async function logEvaluationCompleted(
  userId: string,
  overallScore: number,
  duration: number
): Promise<void> {
  await logEvaluationEvent({
    userId,
    level: 'info',
    eventType: 'evaluation_completed',
    message: `평가 완료: 점수 ${overallScore}, 소요시간 ${duration}ms`,
    metadata: { overallScore, duration },
  })
}

/**
 * 평가 실패 로그
 */
export async function logEvaluationFailed(
  userId: string,
  errorCode: string,
  errorMessage: string
): Promise<void> {
  await logEvaluationEvent({
    userId,
    level: 'error',
    eventType: 'evaluation_failed',
    message: `평가 실패: ${errorCode} - ${errorMessage}`,
    metadata: { errorCode, errorMessage },
  })
}

/**
 * LLM 호출 로그
 */
export async function logLLMCalled(
  userId: string,
  model: string,
  tokensUsed: number
): Promise<void> {
  await logEvaluationEvent({
    userId,
    level: 'debug',
    eventType: 'llm_called',
    message: `LLM 호출: ${model}, ${tokensUsed} 토큰`,
    metadata: { model, tokensUsed },
  })
}

// =============================================================================
// 통계 조회 함수
// =============================================================================

/**
 * 사용자별 평가 통계 조회
 */
export async function getEvaluationStats(
  userId: string,
  days: number = 30
): Promise<EvaluationStats | null> {
  try {
    const supabase = await createClient()
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    const { data: logs, error } = await supabase
      .from('evaluation_logs')
      .select('*')
      .eq('user_id', userId)
      .in('event_type', ['evaluation_completed', 'evaluation_failed'])
      .gte('created_at', startDate.toISOString())

    if (error || !logs) {
      console.warn('[EvaluationLogger] Failed to fetch stats:', error)
      return null
    }

    const completed = logs.filter((l) => l.event_type === 'evaluation_completed')
    const failed = logs.filter((l) => l.event_type === 'evaluation_failed')

    const totalEvaluations = completed.length + failed.length
    const successCount = completed.length
    const failureCount = failed.length
    const successRate = totalEvaluations > 0 ? (successCount / totalEvaluations) * 100 : 0

    // 평균 점수 계산
    const scores = completed
      .map((l) => l.metadata?.overallScore)
      .filter((s): s is number => typeof s === 'number')
    const averageScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0

    return {
      totalEvaluations,
      successCount,
      failureCount,
      successRate: Math.round(successRate * 10) / 10,
      averageScore: Math.round(averageScore * 10) / 10,
    }
  } catch (error) {
    console.warn('[EvaluationLogger] Failed to get stats:', error)
    return null
  }
}

/**
 * 실패율 모니터링 알림
 */
export async function checkFailureRate(
  userId: string,
  threshold: number = 20
): Promise<boolean> {
  const stats = await getEvaluationStats(userId, 7) // 최근 7일
  if (!stats) return false

  const isHighFailureRate = stats.failureCount > 0 && 
    (stats.failureCount / stats.totalEvaluations) * 100 > threshold

  if (isHighFailureRate) {
    console.warn(`[EvaluationLogger] High failure rate detected for user ${userId}: ${stats.successRate}%`)
  }

  return isHighFailureRate
}
