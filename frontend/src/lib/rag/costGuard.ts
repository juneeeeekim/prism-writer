// =============================================================================
// PRISM Writer - Cost Guard (Embedding Usage Limits)
// =============================================================================
// 파일: frontend/src/lib/rag/costGuard.ts
// 역할: 임베딩 생성 비용 제한 및 사용량 추적
// =============================================================================

import { createClient } from '@/lib/supabase/client'
import { estimateTokenCount } from './embedding'

// =============================================================================
// 타입 정의
// =============================================================================

export interface UsageLimits {
  dailyTokenLimit: number
  maxDocumentSize: number
}

export interface UsageStats {
  tokensUsedToday: number
  remainingTokens: number
  limitExceeded: boolean
}

type UserTier = 'free' | 'premium' | 'enterprise'

// =============================================================================
// 상수: 등급별 일일 토큰 한도
// =============================================================================

const TIER_LIMITS: Record<UserTier, UsageLimits> = {
  free: {
    dailyTokenLimit: 50_000, // ~100 pages
    maxDocumentSize: 100_000, // ~200 pages
  },
  premium: {
    dailyTokenLimit: 500_000, // ~1,000 pages
    maxDocumentSize: 1_000_000, // ~2,000 pages
  },
  enterprise: {
    dailyTokenLimit: 5_000_000, // ~10,000 pages
    maxDocumentSize: 10_000_000, // ~20,000 pages
  },
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * 사용자 등급 가져오기
 * 
 * @param userId - 사용자 ID
 * @returns 사용자 등급
 */
async function getUserTier(userId: string): Promise<UserTier> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('users')
    .select('role')
    .eq('id', userId)
    .single()

  if (error || !data) {
    console.warn('Failed to fetch user tier, defaulting to free:', error)
    return 'free'
  }

  // role을 tier로 매핑
  const role = data.role as string
  if (role === 'premium' || role === 'enterprise') {
    return role as UserTier
  }

  return 'free'
}

/**
 * 오늘 사용한 토큰 수 가져오기
 * 
 * @param userId - 사용자 ID
 * @returns 오늘 사용한 토큰 수
 */
async function getTodayUsage(userId: string): Promise<number> {
  const supabase = createClient()

  // 오늘 자정
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const { data, error } = await supabase
    .from('embedding_usage')
    .select('tokens_used')
    .eq('user_id', userId)
    .gte('created_at', today.toISOString())

  if (error) {
    console.warn('Failed to fetch usage stats:', error)
    return 0
  }

  // 합계 계산
  return data.reduce((sum, record) => sum + record.tokens_used, 0)
}

/**
 * 사용량 기록
 * 
 * @param userId - 사용자 ID
 * @param tokensUsed - 사용한 토큰 수
 * @param metadata - 추가 메타데이터
 */
async function recordUsage(
  userId: string,
  tokensUsed: number,
  metadata?: Record<string, any>
): Promise<void> {
  const supabase = createClient()

  const { error } = await supabase
    .from('embedding_usage')
    .insert({
      user_id: userId,
      tokens_used: tokensUsed,
      metadata,
      created_at: new Date().toISOString(),
    })

  if (error) {
    console.error('Failed to record usage:', error)
    // 기록 실패는 치명적이지 않음 (로그만 남김)
  }
}

// =============================================================================
// Main Functions
// =============================================================================

/**
 * 사용자의 현재 사용량 및 한도 확인
 * 
 * @param userId - 사용자 ID
 * @returns 사용량 통계
 * 
 * @example
 * ```typescript
 * const stats = await checkUsage(userId)
 * if (stats.limitExceeded) {
 *   throw new Error("일일 한도를 초과했습니다")
 * }
 * ```
 */
export async function checkUsage(userId: string): Promise<UsageStats> {
  const [tier, todayUsage] = await Promise.all([
    getUserTier(userId),
    getTodayUsage(userId),
  ])

  const limits = TIER_LIMITS[tier]

  return {
    tokensUsedToday: todayUsage,
    remainingTokens: Math.max(0, limits.dailyTokenLimit - todayUsage),
    limitExceeded: todayUsage >= limits.dailyTokenLimit,
  }
}

/**
 * 임베딩 생성 전 검증 (사용 가능 여부 및 한도 확인)
 * 
 * @param userId - 사용자 ID
 * @param estimatedTokens - 예상 토큰 수
 * @throws Error - 한도 초과 시
 * 
 * @example
 * ```typescript
 * const tokens = estimateTokenCount(text)
 * await validateUsage(userId, tokens)
 * // 한도 내에 있으면 계속 진행
 * ```
 */
export async function validateUsage(
  userId: string,
  estimatedTokens: number
): Promise<void> {
  const stats = await checkUsage(userId)

  if (stats.limitExceeded) {
    throw new Error(
      `일일 임베딩 한도를 초과했습니다. ` +
      `오늘 사용량: ${stats.tokensUsedToday.toLocaleString()} 토큰`
    )
  }

  if (stats.remainingTokens < estimatedTokens) {
    throw new Error(
      `요청한 작업이 일일 한도를 초과합니다. ` +
      `남은 토큰: ${stats.remainingTokens.toLocaleString()}, ` +
      `필요 토큰: ${estimatedTokens.toLocaleString()}`
    )
  }
}

/**
 * 임베딩 생성 후 사용량 기록
 * 
 * @param userId - 사용자 ID
 * @param tokensUsed - 사용한 토큰 수
 * @param documentId - 문서 ID (옵션)
 * 
 * @example
 * ```typescript
 * const tokens = estimateTokenCount(text)
 * await trackUsage(userId, tokens, documentId)
 * ```
 */
export async function trackUsage(
  userId: string,
  tokensUsed: number,
  documentId?: string
): Promise<void> {
  await recordUsage(userId, tokensUsed, {
    document_id: documentId,
    timestamp: new Date().toISOString(),
  })
}

/**
 * 문서 크기 검증 (너무 큰 문서 방지)
 * 
 * @param userId - 사용자 ID
 * @param estimatedTokens - 예상 토큰 수
 * @throws Error - 문서 크기 초과 시
 */
export async function validateDocumentSize(
  userId: string,
  estimatedTokens: number
): Promise<void> {
  const tier = await getUserTier(userId)
  const limits = TIER_LIMITS[tier]

  if (estimatedTokens > limits.maxDocumentSize) {
    throw new Error(
      `문서 크기가 너무 큽니다. ` +
      `최대 크기: ${limits.maxDocumentSize.toLocaleString()} 토큰, ` +
      `현재 크기: ${estimatedTokens.toLocaleString()} 토큰`
    )
  }
}
