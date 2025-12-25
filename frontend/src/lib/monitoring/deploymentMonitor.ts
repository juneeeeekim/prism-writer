// =============================================================================
// PRISM Writer - Deployment Monitoring Utilities
// =============================================================================
// 파일: frontend/src/lib/monitoring/deploymentMonitor.ts
// 역할: 배포 후 모니터링 지표 수집 및 로깅
// 생성일: 2025-12-25
//
// 주석(시니어 개발자): 
// 배포 직후 1시간 동안 핵심 지표를 모니터링합니다.
// 콘솔 로그와 Supabase에 지표를 기록합니다.
// =============================================================================

import { createClient } from '@/lib/supabase/client'

// =============================================================================
// 타입 정의
// =============================================================================

/**
 * 모니터링 지표 타입
 */
export interface MonitoringMetrics {
  /** 측정 시간 */
  timestamp: string
  /** API 응답 시간 (ms) */
  apiResponseTime?: number
  /** 에러 발생 여부 */
  hasErrors?: boolean
  /** 에러 메시지 */
  errorMessages?: string[]
  /** LLM 호출 횟수 */
  llmCallCount?: number
  /** 예상 LLM 비용 (USD) */
  estimatedLLMCost?: number
  /** 캐시 히트율 (%) */
  cacheHitRate?: number
  /** 평균 쿼리 시간 (ms) */
  avgQueryTime?: number
}

/**
 * 에러 로그 항목
 */
export interface ErrorLogEntry {
  timestamp: string
  level: 'error' | 'warn' | 'info'
  message: string
  context?: Record<string, unknown>
}

// =============================================================================
// 로컬 저장소 (메모리)
// =============================================================================

const metricsHistory: MonitoringMetrics[] = []
const errorLogs: ErrorLogEntry[] = []
let llmCallCounter = 0
let cacheHits = 0
let cacheMisses = 0

// =============================================================================
// 지표 수집 함수
// =============================================================================

/**
 * API 응답 시간 측정 래퍼
 */
export async function measureApiCall<T>(
  apiName: string,
  apiCall: () => Promise<T>
): Promise<{ result: T; duration: number }> {
  const startTime = performance.now()
  
  try {
    const result = await apiCall()
    const duration = Math.round(performance.now() - startTime)
    
    logMetric('API_CALL', {
      apiName,
      duration,
      success: true,
    })
    
    return { result, duration }
  } catch (error) {
    const duration = Math.round(performance.now() - startTime)
    
    logError('API_ERROR', {
      apiName,
      duration,
      error: error instanceof Error ? error.message : 'Unknown error',
    })
    
    throw error
  }
}

/**
 * LLM 호출 카운터 증가
 */
export function trackLLMCall(
  model: string = 'gemini-3-flash-preview',
  inputTokens: number = 0,
  outputTokens: number = 0
): void {
  llmCallCounter++
  
  // 예상 비용 계산 (Gemini 기준)
  // Input: $0.075 / 1M tokens, Output: $0.30 / 1M tokens
  const inputCost = (inputTokens / 1_000_000) * 0.075
  const outputCost = (outputTokens / 1_000_000) * 0.30
  const totalCost = inputCost + outputCost
  
  logMetric('LLM_CALL', {
    model,
    inputTokens,
    outputTokens,
    estimatedCost: totalCost.toFixed(6),
    totalCalls: llmCallCounter,
  })
}

/**
 * 캐시 히트/미스 추적
 */
export function trackCacheAccess(hit: boolean): void {
  if (hit) {
    cacheHits++
  } else {
    cacheMisses++
  }
}

/**
 * 캐시 히트율 계산
 */
export function getCacheHitRate(): number {
  const total = cacheHits + cacheMisses
  if (total === 0) return 0
  return Math.round((cacheHits / total) * 100)
}

// =============================================================================
// 로깅 함수
// =============================================================================

/**
 * 지표 로깅
 */
export function logMetric(
  type: string,
  data: Record<string, unknown>
): void {
  const entry = {
    timestamp: new Date().toISOString(),
    type,
    ...data,
  }
  
  console.log(`[Monitor] ${type}:`, data)
  
  // 메트릭 히스토리에 추가
  metricsHistory.push({
    timestamp: entry.timestamp,
    apiResponseTime: data.duration as number,
    llmCallCount: llmCallCounter,
    cacheHitRate: getCacheHitRate(),
  })
  
  // 최근 100개만 유지
  if (metricsHistory.length > 100) {
    metricsHistory.shift()
  }
}

/**
 * 에러 로깅
 */
export function logError(
  message: string,
  context?: Record<string, unknown>
): void {
  const entry: ErrorLogEntry = {
    timestamp: new Date().toISOString(),
    level: 'error',
    message,
    context,
  }
  
  console.error(`[Monitor] ERROR:`, message, context)
  errorLogs.push(entry)
  
  // 최근 50개만 유지
  if (errorLogs.length > 50) {
    errorLogs.shift()
  }
}

/**
 * 경고 로깅
 */
export function logWarning(
  message: string,
  context?: Record<string, unknown>
): void {
  const entry: ErrorLogEntry = {
    timestamp: new Date().toISOString(),
    level: 'warn',
    message,
    context,
  }
  
  console.warn(`[Monitor] WARN:`, message, context)
  errorLogs.push(entry)
}

// =============================================================================
// 리포트 생성
// =============================================================================

/**
 * 현재 모니터링 상태 요약
 */
export function getMonitoringSummary(): {
  metrics: MonitoringMetrics
  recentErrors: ErrorLogEntry[]
  status: 'healthy' | 'degraded' | 'critical'
} {
  const recentMetrics = metricsHistory.slice(-10)
  const avgResponseTime = recentMetrics.length > 0
    ? recentMetrics.reduce((sum, m) => sum + (m.apiResponseTime || 0), 0) / recentMetrics.length
    : 0

  const recentErrors = errorLogs.filter(e => {
    const logTime = new Date(e.timestamp).getTime()
    const oneHourAgo = Date.now() - (60 * 60 * 1000)
    return logTime > oneHourAgo
  })

  // 상태 판단
  let status: 'healthy' | 'degraded' | 'critical' = 'healthy'
  if (recentErrors.length >= 10) {
    status = 'critical'
  } else if (recentErrors.length >= 3 || avgResponseTime > 5000) {
    status = 'degraded'
  }

  return {
    metrics: {
      timestamp: new Date().toISOString(),
      apiResponseTime: Math.round(avgResponseTime),
      hasErrors: recentErrors.length > 0,
      errorMessages: recentErrors.map(e => e.message),
      llmCallCount: llmCallCounter,
      cacheHitRate: getCacheHitRate(),
    },
    recentErrors,
    status,
  }
}

/**
 * 콘솔에 모니터링 리포트 출력
 */
export function printMonitoringReport(): void {
  const summary = getMonitoringSummary()
  
  console.log('\n========================================')
  console.log('📊 PRISM Writer 모니터링 리포트')
  console.log('========================================')
  console.log(`시간: ${summary.metrics.timestamp}`)
  console.log(`상태: ${summary.status === 'healthy' ? '✅ 정상' : summary.status === 'degraded' ? '⚠️ 주의' : '🚨 위험'}`)
  console.log(`평균 응답 시간: ${summary.metrics.apiResponseTime}ms`)
  console.log(`LLM 호출 횟수: ${summary.metrics.llmCallCount}회`)
  console.log(`캐시 히트율: ${summary.metrics.cacheHitRate}%`)
  console.log(`최근 에러: ${summary.recentErrors.length}건`)
  console.log('========================================\n')
}

// =============================================================================
// Supabase 저장 (선택적)
// =============================================================================

/**
 * 모니터링 지표를 Supabase에 저장
 */
export async function saveMetricsToSupabase(): Promise<boolean> {
  try {
    const supabase = createClient()
    const summary = getMonitoringSummary()
    
    // 참고: monitoring_logs 테이블이 필요합니다
    // 마이그레이션 스크립트는 별도 생성 필요
    const { error } = await supabase
      .from('monitoring_logs')
      .insert({
        timestamp: summary.metrics.timestamp,
        api_response_time: summary.metrics.apiResponseTime,
        llm_call_count: summary.metrics.llmCallCount,
        cache_hit_rate: summary.metrics.cacheHitRate,
        error_count: summary.recentErrors.length,
        status: summary.status,
      })

    if (error) {
      console.warn('[Monitor] Failed to save metrics to Supabase:', error.message)
      return false
    }

    return true
  } catch (error) {
    console.warn('[Monitor] Error saving metrics:', error)
    return false
  }
}

// =============================================================================
// 자동 모니터링 (intervalally)
// =============================================================================

let monitoringInterval: NodeJS.Timeout | null = null

/**
 * 자동 모니터링 시작
 */
export function startMonitoring(intervalMs: number = 60000): void {
  if (monitoringInterval) {
    console.log('[Monitor] Already running')
    return
  }

  console.log(`[Monitor] Starting monitoring (interval: ${intervalMs}ms)`)
  
  monitoringInterval = setInterval(() => {
    printMonitoringReport()
  }, intervalMs)
}

/**
 * 자동 모니터링 중지
 */
export function stopMonitoring(): void {
  if (monitoringInterval) {
    clearInterval(monitoringInterval)
    monitoringInterval = null
    console.log('[Monitor] Stopped monitoring')
  }
}

// =============================================================================
// 초기화 함수 (배포 직후 호출용)
// =============================================================================

/**
 * 배포 후 모니터링 시작
 * 1시간 동안 1분 간격으로 지표 수집
 */
export function startPostDeploymentMonitoring(): void {
  console.log('\n🚀 배포 후 모니터링 시작 (1시간)')
  console.log('- 간격: 1분')
  console.log('- 종료: 자동 (1시간 후)\n')

  startMonitoring(60000) // 1분 간격

  // 1시간 후 자동 중지
  setTimeout(() => {
    stopMonitoring()
    console.log('\n✅ 배포 후 모니터링 완료 (1시간)')
    printMonitoringReport()
  }, 60 * 60 * 1000)
}

// =============================================================================
// 일일 점검 함수 (7일간)
// =============================================================================

/** 패치 적용 통계 */
let patchApplied = 0
let patchRejected = 0
let patchPending = 0

/** 사용자 피드백 저장소 */
const userFeedback: Array<{
  timestamp: string
  rating: number
  comment?: string
}> = []

/**
 * 평균 응답 시간 < 5초 확인
 * 
 * @returns 목표 달성 여부
 */
export function checkResponseTimeTarget(): {
  passed: boolean
  avgMs: number
  target: number
} {
  const recentMetrics = metricsHistory.slice(-100)
  const avgMs = recentMetrics.length > 0
    ? Math.round(recentMetrics.reduce((sum, m) => sum + (m.apiResponseTime || 0), 0) / recentMetrics.length)
    : 0
  
  const target = 5000 // 5초
  const passed = avgMs < target

  console.log(`[DailyCheck] 평균 응답 시간: ${avgMs}ms (목표: < ${target}ms) → ${passed ? '✅ PASS' : '❌ FAIL'}`)

  return { passed, avgMs, target }
}

/**
 * 캐시 히트율 > 80% 확인
 * 
 * @returns 목표 달성 여부
 */
export function checkCacheHitTarget(): {
  passed: boolean
  rate: number
  target: number
} {
  const rate = getCacheHitRate()
  const target = 80 // 80%
  const passed = rate >= target

  console.log(`[DailyCheck] 캐시 히트율: ${rate}% (목표: >= ${target}%) → ${passed ? '✅ PASS' : '❌ FAIL'}`)

  return { passed, rate, target }
}

/**
 * 사용자 피드백 수집
 * 
 * @param rating - 만족도 점수 (1-5)
 * @param comment - 선택적 코멘트
 */
export function collectUserFeedback(rating: number, comment?: string): void {
  const feedback = {
    timestamp: new Date().toISOString(),
    rating: Math.min(5, Math.max(1, rating)),
    comment,
  }

  userFeedback.push(feedback)

  // 최근 1000개만 유지
  if (userFeedback.length > 1000) {
    userFeedback.shift()
  }

  console.log(`[DailyCheck] 피드백 수집: ${rating}/5 ${comment ? `"${comment}"` : ''}`)
}

/**
 * 사용자 피드백 요약
 */
export function getUserFeedbackSummary(): {
  count: number
  avgRating: number
  positiveRate: number
} {
  if (userFeedback.length === 0) {
    return { count: 0, avgRating: 0, positiveRate: 0 }
  }

  const count = userFeedback.length
  const avgRating = userFeedback.reduce((sum, f) => sum + f.rating, 0) / count
  const positiveCount = userFeedback.filter(f => f.rating >= 4).length
  const positiveRate = Math.round((positiveCount / count) * 100)

  return { count, avgRating: Math.round(avgRating * 10) / 10, positiveRate }
}

/**
 * 패치 적용 추적
 * 
 * @param action - 'applied' | 'rejected' | 'pending'
 */
export function trackPatchApplication(action: 'applied' | 'rejected' | 'pending'): void {
  switch (action) {
    case 'applied':
      patchApplied++
      break
    case 'rejected':
      patchRejected++
      break
    case 'pending':
      patchPending++
      break
  }

  console.log(`[DailyCheck] 패치 ${action}: 적용 ${patchApplied}, 거부 ${patchRejected}, 대기 ${patchPending}`)
}

/**
 * 패치 적용률 계산
 * 
 * @returns 적용률 (%)
 */
export function getPatchApplicationRate(): {
  applied: number
  rejected: number
  pending: number
  rate: number
} {
  const total = patchApplied + patchRejected
  const rate = total > 0 ? Math.round((patchApplied / total) * 100) : 0

  return {
    applied: patchApplied,
    rejected: patchRejected,
    pending: patchPending,
    rate,
  }
}

/**
 * 일일 점검 리포트 출력
 */
export function printDailyCheckReport(): void {
  const responseCheck = checkResponseTimeTarget()
  const cacheCheck = checkCacheHitTarget()
  const feedbackSummary = getUserFeedbackSummary()
  const patchStats = getPatchApplicationRate()

  console.log('\n========================================')
  console.log('📋 PRISM Writer 일일 점검 리포트')
  console.log('========================================')
  console.log(`시간: ${new Date().toISOString()}`)
  console.log('')
  console.log('📊 성능 지표')
  console.log(`  - 평균 응답 시간: ${responseCheck.avgMs}ms ${responseCheck.passed ? '✅' : '❌'}`)
  console.log(`  - 캐시 히트율: ${cacheCheck.rate}% ${cacheCheck.passed ? '✅' : '❌'}`)
  console.log('')
  console.log('💬 사용자 피드백')
  console.log(`  - 수집된 피드백: ${feedbackSummary.count}건`)
  console.log(`  - 평균 평점: ${feedbackSummary.avgRating}/5`)
  console.log(`  - 긍정 비율: ${feedbackSummary.positiveRate}%`)
  console.log('')
  console.log('🔧 패치 적용 현황')
  console.log(`  - 적용: ${patchStats.applied}건`)
  console.log(`  - 거부: ${patchStats.rejected}건`)
  console.log(`  - 대기: ${patchStats.pending}건`)
  console.log(`  - 적용률: ${patchStats.rate}%`)
  console.log('========================================\n')
}

/**
 * 일일 점검 결과 객체 반환
 */
export function getDailyCheckReport(): {
  timestamp: string
  responseTime: { passed: boolean; avgMs: number; target: number }
  cacheHitRate: { passed: boolean; rate: number; target: number }
  userFeedback: { count: number; avgRating: number; positiveRate: number }
  patchApplication: { applied: number; rejected: number; pending: number; rate: number }
  overallStatus: 'pass' | 'warning' | 'fail'
} {
  const responseTime = checkResponseTimeTarget()
  const cacheHitRate = checkCacheHitTarget()
  const userFeedbackSummary = getUserFeedbackSummary()
  const patchApplication = getPatchApplicationRate()

  // 전체 상태 판단
  let overallStatus: 'pass' | 'warning' | 'fail' = 'pass'
  if (!responseTime.passed || !cacheHitRate.passed) {
    overallStatus = 'fail'
  } else if (userFeedbackSummary.positiveRate < 70) {
    overallStatus = 'warning'
  }

  return {
    timestamp: new Date().toISOString(),
    responseTime,
    cacheHitRate,
    userFeedback: userFeedbackSummary,
    patchApplication,
    overallStatus,
  }
}

