// =============================================================================
// PRISM Writer - 인증 및 사용자 프로필 타입 정의
// =============================================================================
// 파일: frontend/src/types/auth.ts
// 역할: UserRole, UserProfile, UsageSummary 등 회원등급관리시스템 타입
// 버전: v2.0 (하이브리드 모델 - 일일 요청 + 월간 토큰)
// =============================================================================

// =============================================================================
// 사용자 역할 타입
// =============================================================================

/**
 * 사용자 역할 타입
 * 
 * - pending: 가입 대기 (서비스 불가)
 * - free: 무료 회원 (일일 5회, 월간 10,000 토큰)
 * - premium: 프리미엄 회원 (일일 50회, 월간 30,000 토큰)
 * - special: 스페셜 회원 (무제한 요청, 월간 200,000 토큰)
 * - admin: 관리자 (무제한)
 */
export type UserRole = 'pending' | 'free' | 'premium' | 'special' | 'admin'

// =============================================================================
// 사용량 관련 타입 (v2.0 하이브리드 모델)
// =============================================================================

/**
 * 사용량 할당 한도
 */
export interface UsageLimits {
  monthlyTokenLimit: number
  dailyRequestLimit: number  // v2.0 추가
}

/**
 * 일일 사용량 정보 (v2.0)
 */
export interface DailyUsage {
  /** 오늘 사용한 요청 횟수 */
  requestCount: number
  /** 남은 요청 횟수 */
  requestsRemaining: number
  /** 리셋 시간 (예: "내일 00:00") */
  resetAt: string
}

/**
 * 월간 사용량 정보
 */
export interface MonthlyUsage {
  /** 이번 달 사용한 토큰 수 */
  totalTokensUsed: number
  /** 남은 토큰 수 */
  tokensRemaining: number
  /** 리셋 시간 (예: "다음 달 1일") */
  resetAt: string
}

/**
 * 전체 사용량 요약 (v2.0 하이브리드)
 */
export interface UsageSummary {
  /** 일일 사용량 (v2.0) */
  daily: DailyUsage
  /** 월간 사용량 */
  monthly: MonthlyUsage
  /** 전체 사용 비율 (0-100) */
  percentUsed: number
  /** 일일 80% 도달 여부 (v2.0) */
  isNearDailyLimit: boolean
  /** 일일 100% 도달 여부 (v2.0) */
  isAtDailyLimit: boolean
  /** 월간 80% 도달 여부 */
  isNearMonthlyLimit: boolean
  /** 월간 100% 도달 여부 */
  isAtMonthlyLimit: boolean
}

// =============================================================================
// 사용자 프로필 타입
// =============================================================================

/**
 * 사용자 프로필 인터페이스
 */
export interface UserProfile {
  /** 사용자 ID (auth.users.id) */
  id: string
  /** 사용자 역할 */
  role: UserRole
  /** 등급 레벨 (0-4) */
  tier: number
  /** 승인 여부 */
  isApproved: boolean
  /** 승인 일시 */
  approvedAt: string | null
  /** 구독 만료일 */
  subscriptionExpiresAt: string | null
  /** 월간 토큰 한도 */
  monthlyTokenLimit: number
  /** 일일 요청 한도 (v2.0) */
  dailyRequestLimit: number
  /** 생성일 */
  createdAt: string
  /** 수정일 */
  updatedAt: string
}

/**
 * 데이터베이스에서 가져온 프로필 (snake_case)
 * @internal
 */
export interface ProfileRow {
  id: string
  role: UserRole
  tier: number
  is_approved: boolean
  approved_at: string | null
  subscription_expires_at: string | null
  monthly_token_limit: number
  daily_request_limit: number
  created_at: string
  updated_at: string
}

/**
 * ProfileRow를 UserProfile로 변환
 */
export function mapProfileRowToUserProfile(row: ProfileRow): UserProfile {
  return {
    id: row.id,
    role: row.role,
    tier: row.tier,
    isApproved: row.is_approved,
    approvedAt: row.approved_at,
    subscriptionExpiresAt: row.subscription_expires_at,
    monthlyTokenLimit: row.monthly_token_limit,
    dailyRequestLimit: row.daily_request_limit,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

// =============================================================================
// 역할별 할당량 상수 (v2.0)
// =============================================================================

/**
 * 역할별 기본 할당량
 * DB 트리거에서 자동 설정되지만, 클라이언트 참조용
 */
export const ROLE_LIMITS: Record<UserRole, UsageLimits> = {
  pending: { dailyRequestLimit: 0, monthlyTokenLimit: 0 },
  free: { dailyRequestLimit: 5, monthlyTokenLimit: 10000 },
  premium: { dailyRequestLimit: 50, monthlyTokenLimit: 30000 },
  special: { dailyRequestLimit: 999999, monthlyTokenLimit: 200000 },
  admin: { dailyRequestLimit: 999999, monthlyTokenLimit: 999999999 },
}

/**
 * 역할 계층 (권한 비교용)
 */
export const ROLE_HIERARCHY: Record<UserRole, number> = {
  pending: 0,
  free: 1,
  premium: 2,
  special: 3,
  admin: 4,
}

// =============================================================================
// LLM 사용량 기록 타입
// =============================================================================

/**
 * LLM 사용량 기록
 */
export interface LLMUsageRecord {
  id: string
  userId: string
  requestType: 'chat' | 'summarize' | 'generate' | 'edit'
  modelName: string
  inputTokens: number
  outputTokens: number
  totalTokens: number
  estimatedCostUsd: number
  responseTimeMs: number
  isCached: boolean
  createdAt: string
}

/**
 * 일일 사용량 기록 (v2.0)
 */
export interface DailyUsageRecord {
  id: string
  userId: string
  usageDate: string
  requestCount: number
}
