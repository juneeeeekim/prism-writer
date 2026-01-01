// =============================================================================
// PRISM Writer - Usage Tracker
// =============================================================================
// 파일: frontend/src/lib/monitoring/usageTracker.ts
// 역할: LLM/임베딩 사용량 추적 및 비용 모니터링
// =============================================================================

import { createClient } from '@/lib/supabase/server'

// =============================================================================
// 타입 정의
// =============================================================================

/** 사용량 타입 */
export type UsageType = 'embedding' | 'llm_evaluation' | 'llm_chat' | 'search'

/** 사용량 기록 항목 */
export interface UsageRecord {
  /** 사용자 ID */
  userId: string
  /** 사용량 타입 */
  usageType: UsageType
  /** 토큰 수 */
  tokensUsed: number
  /** 예상 비용 (USD) */
  estimatedCost: number
  /** 모델명 */
  model?: string
  /** 추가 메타데이터 */
  metadata?: Record<string, unknown>
}

/** 사용량 통계 */
export interface UsageStats {
  /** 총 토큰 사용량 */
  totalTokens: number
  /** 총 예상 비용 (USD) */
  totalCost: number
  /** 타입별 사용량 */
  byType: Record<UsageType, { tokens: number; cost: number }>
  /** 기간 */
  period: 'daily' | 'monthly'
  /** 시작일 */
  startDate: string
  /** 종료일 */
  endDate: string
}

/** 사용량 한도 */
export interface UsageLimits {
  /** 일일 토큰 한도 */
  dailyTokenLimit: number
  /** 월간 토큰 한도 */
  monthlyTokenLimit: number
  /** 일일 비용 한도 (USD) */
  dailyCostLimit: number
  /** 월간 비용 한도 (USD) */
  monthlyCostLimit: number
}

// =============================================================================
// 비용 상수 (2025년 기준 예상)
// =============================================================================

const COST_PER_1K_TOKENS: Record<string, number> = {
  // OpenAI Embedding
  'text-embedding-3-small': 0.00002,
  'text-embedding-3-large': 0.00013,
  // Gemini
  'gemini-3-flash-preview': 0.0005,
  'gemini-3-pro-preview': 0.005,
  // Default
  'default': 0.0003,
}

// =============================================================================
// 기본 한도 설정
// =============================================================================

const DEFAULT_LIMITS: UsageLimits = {
  dailyTokenLimit: 100000,    // 일일 10만 토큰
  monthlyTokenLimit: 1000000, // 월간 100만 토큰
  dailyCostLimit: 1.0,        // 일일 $1
  monthlyCostLimit: 10.0,     // 월간 $10
}

// =============================================================================
// 사용량 기록 함수
// =============================================================================

/**
 * 사용량 기록
 */
export async function trackUsage(record: UsageRecord): Promise<void> {
  console.log(`[UsageTracker] ${record.usageType}: ${record.tokensUsed} tokens, $${record.estimatedCost.toFixed(4)}`)

  try {
    const supabase = await createClient()
    
    await supabase.from('usage_records').insert({
      user_id: record.userId,
      usage_type: record.usageType,
      tokens_used: record.tokensUsed,
      estimated_cost: record.estimatedCost,
      model: record.model,
      metadata: record.metadata || {},
      created_at: new Date().toISOString(),
    })
  } catch (error) {
    console.warn('[UsageTracker] Failed to save usage record:', error)
  }
}

/**
 * 비용 계산
 */
export function calculateCost(tokens: number, model: string = 'default'): number {
  const costPer1K = COST_PER_1K_TOKENS[model] || COST_PER_1K_TOKENS.default
  return (tokens / 1000) * costPer1K
}

/**
 * LLM 사용량 기록
 */
export async function trackLLMUsage(
  userId: string,
  tokensUsed: number,
  model: string = 'gemini-3-flash-preview'
): Promise<void> {
  await trackUsage({
    userId,
    usageType: 'llm_evaluation',
    tokensUsed,
    estimatedCost: calculateCost(tokensUsed, model),
    model,
  })
}

/**
 * 임베딩 사용량 기록
 */
export async function trackEmbeddingUsage(
  userId: string,
  tokensUsed: number,
  model: string = 'text-embedding-3-small'
): Promise<void> {
  await trackUsage({
    userId,
    usageType: 'embedding',
    tokensUsed,
    estimatedCost: calculateCost(tokensUsed, model),
    model,
  })
}

// =============================================================================
// 사용량 조회 함수
// =============================================================================

/**
 * 일일 사용량 조회
 */
export async function getDailyUsage(userId: string): Promise<UsageStats | null> {
  return getUsageStats(userId, 'daily')
}

/**
 * 월간 사용량 조회
 */
export async function getMonthlyUsage(userId: string): Promise<UsageStats | null> {
  return getUsageStats(userId, 'monthly')
}

/**
 * 사용량 통계 조회
 */
async function getUsageStats(
  userId: string,
  period: 'daily' | 'monthly'
): Promise<UsageStats | null> {
  try {
    const supabase = await createClient()
    
    const now = new Date()
    let startDate: Date
    
    if (period === 'daily') {
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    } else {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1)
    }

    const { data: records, error } = await supabase
      .from('usage_records')
      .select('*')
      .eq('user_id', userId)
      .gte('created_at', startDate.toISOString())

    if (error || !records) {
      console.warn('[UsageTracker] Failed to fetch usage:', error)
      return null
    }

    // 집계
    const stats: UsageStats = {
      totalTokens: 0,
      totalCost: 0,
      byType: {
        embedding: { tokens: 0, cost: 0 },
        llm_evaluation: { tokens: 0, cost: 0 },
        llm_chat: { tokens: 0, cost: 0 },
        search: { tokens: 0, cost: 0 },
      },
      period,
      startDate: startDate.toISOString(),
      endDate: now.toISOString(),
    }

    for (const record of records) {
      stats.totalTokens += record.tokens_used || 0
      stats.totalCost += record.estimated_cost || 0

      const type = record.usage_type as UsageType
      if (stats.byType[type]) {
        stats.byType[type].tokens += record.tokens_used || 0
        stats.byType[type].cost += record.estimated_cost || 0
      }
    }

    return stats
  } catch (error) {
    console.warn('[UsageTracker] Failed to get usage stats:', error)
    return null
  }
}

// =============================================================================
// 한도 체크 함수
// =============================================================================

/**
 * 한도 초과 여부 확인
 */
export async function checkUsageLimits(
  userId: string,
  limits: UsageLimits = DEFAULT_LIMITS
): Promise<{
  dailyTokensExceeded: boolean
  monthlyTokensExceeded: boolean
  dailyCostExceeded: boolean
  monthlyCostExceeded: boolean
  warnings: string[]
}> {
  const daily = await getDailyUsage(userId)
  const monthly = await getMonthlyUsage(userId)

  const warnings: string[] = []

  const dailyTokensExceeded = daily ? daily.totalTokens >= limits.dailyTokenLimit : false
  const monthlyTokensExceeded = monthly ? monthly.totalTokens >= limits.monthlyTokenLimit : false
  const dailyCostExceeded = daily ? daily.totalCost >= limits.dailyCostLimit : false
  const monthlyCostExceeded = monthly ? monthly.totalCost >= limits.monthlyCostLimit : false

  // 80% 경고
  if (daily && daily.totalTokens >= limits.dailyTokenLimit * 0.8) {
    warnings.push(`일일 토큰 사용량이 ${Math.round(daily.totalTokens / limits.dailyTokenLimit * 100)}%에 도달했습니다.`)
  }
  if (monthly && monthly.totalCost >= limits.monthlyCostLimit * 0.8) {
    warnings.push(`월간 비용이 $${monthly.totalCost.toFixed(2)} / $${limits.monthlyCostLimit}에 도달했습니다.`)
  }

  return {
    dailyTokensExceeded,
    monthlyTokensExceeded,
    dailyCostExceeded,
    monthlyCostExceeded,
    warnings,
  }
}

/**
 * 사용 가능 여부 확인
 */
export async function canUseService(userId: string): Promise<boolean> {
  const limits = await checkUsageLimits(userId)
  return !limits.dailyTokensExceeded && !limits.monthlyTokensExceeded
}
