// =============================================================================
// PRISM Writer - 권한 체크 유틸리티
// =============================================================================
// 파일: frontend/src/lib/permissions.ts
// 역할: 역할 기반 권한 확인, LLM 사용 가능 여부 체크
// 버전: v2.0 (하이브리드 모델 - 일일 요청 + 월간 토큰)
// =============================================================================

import { UserRole, UsageSummary, ROLE_HIERARCHY } from '@/types/auth'

// =============================================================================
// 역할 관련 유틸리티
// =============================================================================

/**
 * 특정 역할 이상인지 확인
 * 
 * @param currentRole - 현재 사용자 역할
 * @param minimumRole - 최소 필요 역할
 * @returns 최소 역할 이상이면 true
 * 
 * @example
 * ```ts
 * hasMinimumRole('premium', 'free')  // true
 * hasMinimumRole('free', 'premium')  // false
 * hasMinimumRole('admin', 'pending') // true
 * ```
 */
export function hasMinimumRole(
  currentRole: UserRole | null,
  minimumRole: UserRole
): boolean {
  if (!currentRole) return false
  return ROLE_HIERARCHY[currentRole] >= ROLE_HIERARCHY[minimumRole]
}

/**
 * 관리자 여부 확인
 */
export function isAdminRole(role: UserRole | null): boolean {
  return role === 'admin'
}

/**
 * 프리미엄 이상 여부 확인 (premium, special, admin)
 */
export function isPremiumOrAbove(role: UserRole | null): boolean {
  return hasMinimumRole(role, 'premium')
}

/**
 * 서비스 이용 가능 여부 (pending이 아님)
 */
export function canAccessService(role: UserRole | null): boolean {
  return hasMinimumRole(role, 'free')
}

// =============================================================================
// LLM 사용 관련 유틸리티 (v2.0)
// =============================================================================

/**
 * LLM 요청 제한 체크 결과
 */
export interface LLMRequestCheckResult {
  /** 요청 허용 여부 */
  allowed: boolean
  /** 차단 이유 */
  reason: 'ok' | 'daily_limit' | 'monthly_limit' | 'not_approved' | 'pending'
  /** 사용자에게 표시할 메시지 */
  message: string
}

/**
 * LLM 요청 가능 여부 확인 (v2.0 하이브리드)
 * 
 * 일일 제한 → 월간 제한 순서로 체크
 * (일일 제한이 더 빨리 리셋되므로 먼저 표시)
 * 
 * @param usage - 현재 사용량 요약
 * @param role - 사용자 역할
 * @param isApproved - 승인 여부
 * @returns 요청 가능 여부 및 차단 이유
 * 
 * @example
 * ```ts
 * const { allowed, reason, message } = canMakeLLMRequest(usage, 'free', true)
 * if (!allowed) {
 *   showError(message)
 * }
 * ```
 */
export function canMakeLLMRequest(
  usage: UsageSummary | null,
  role: UserRole | null = null,
  isApproved: boolean = false
): LLMRequestCheckResult {
  // 역할 체크
  if (role === 'pending') {
    return {
      allowed: false,
      reason: 'pending',
      message: '계정 승인 대기 중입니다. 관리자 승인 후 사용 가능합니다.',
    }
  }

  if (!isApproved) {
    return {
      allowed: false,
      reason: 'not_approved',
      message: '계정이 아직 승인되지 않았습니다.',
    }
  }

  // 사용량 체크
  if (!usage) {
    return { allowed: true, reason: 'ok', message: '' }
  }

  // v2.0: 일일 제한 먼저 체크 (더 빠른 리셋)
  if (usage.isAtDailyLimit) {
    return {
      allowed: false,
      reason: 'daily_limit',
      message: `오늘의 AI 사용 횟수를 모두 사용했습니다. ${usage.daily.resetAt}에 리셋됩니다.`,
    }
  }

  // 월간 제한 체크
  if (usage.isAtMonthlyLimit) {
    return {
      allowed: false,
      reason: 'monthly_limit',
      message: `이번 달 AI 토큰을 모두 사용했습니다. ${usage.monthly.resetAt}에 리셋됩니다.`,
    }
  }

  return { allowed: true, reason: 'ok', message: '' }
}

/**
 * 사용량 경고 메시지 생성
 * 
 * @param usage - 현재 사용량 요약
 * @returns 경고 메시지 또는 null
 */
export function getUsageWarningMessage(usage: UsageSummary | null): string | null {
  if (!usage) return null

  // 일일 경고 (더 빠른 리셋이므로 먼저)
  if (usage.isNearDailyLimit && !usage.isAtDailyLimit) {
    const remaining = usage.daily.requestsRemaining
    return `오늘 AI 사용량이 ${remaining}회 남았습니다. (${usage.daily.resetAt}에 리셋)`
  }

  // 월간 경고
  if (usage.isNearMonthlyLimit && !usage.isAtMonthlyLimit) {
    const remaining = usage.monthly.tokensRemaining
    return `이번 달 토큰이 ${remaining.toLocaleString()}개 남았습니다.`
  }

  return null
}

// =============================================================================
// 기능별 권한 체크
// =============================================================================

/**
 * 기능별 필요 역할 정의
 */
export const FEATURE_REQUIREMENTS: Record<string, UserRole> = {
  // 기본 기능
  'editor.basic': 'free',
  'editor.save': 'free',
  
  // AI 기능
  'ai.chat': 'free',
  'ai.summarize': 'premium',
  'ai.generate': 'premium',
  'ai.edit': 'premium',
  
  // 고급 기능
  'ai.priority': 'special',    // 우선 처리
  'admin.dashboard': 'admin',
  'admin.users': 'admin',
}

/**
 * 특정 기능 사용 가능 여부
 * 
 * @param feature - 기능 키
 * @param role - 사용자 역할
 */
export function canUseFeature(feature: string, role: UserRole | null): boolean {
  const requiredRole = FEATURE_REQUIREMENTS[feature]
  if (!requiredRole) return false
  return hasMinimumRole(role, requiredRole)
}
