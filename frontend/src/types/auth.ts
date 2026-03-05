// =============================================================================
// PRISM Writer - 인증 및 사용자 프로필 타입 정의
// =============================================================================
// 파일: frontend/src/types/auth.ts
// 역할: UserRole, UserProfile, UsageSummary 등 회원등급관리시스템 타입
// 버전: v3.0 (월간 질문 횟수 단일 지표)
// =============================================================================

// =============================================================================
// 사용자 역할 타입
// =============================================================================

/**
 * 사용자 역할 타입
 *
 * - pending: 가입 대기 (서비스 불가)
 * - free: 무료 회원 (월간 30회)
 * - premium: 프리미엄 회원 (월간 300회)
 * - special: 스페셜 회원 (무제한)
 * - admin: 관리자 (무제한)
 */
export type UserRole = 'pending' | 'free' | 'premium' | 'special' | 'admin'

// =============================================================================
// 사용량 관련 타입 (v3.0 월간 질문 횟수)
// =============================================================================

/**
 * 사용량 할당 한도
 */
export interface UsageLimits {
  monthlyQuestionLimit: number
}

/**
 * 월간 질문 사용량 정보
 */
export interface MonthlyQuestionUsage {
  /** 이번 달 사용한 질문 횟수 */
  questionCount: number
  /** 남은 질문 횟수 */
  questionsRemaining: number
  /** 리셋 시간 (예: "15일 후") */
  resetAt: string
}

/**
 * 전체 사용량 요약 (v3.0 월간 질문)
 */
export interface UsageSummary {
  /** 월간 질문 사용량 */
  monthlyQuestions: MonthlyQuestionUsage
  /** 전체 사용 비율 (0-100) */
  percentUsed: number
  /** 80% 도달 여부 */
  isNearLimit: boolean
  /** 100% 도달 여부 */
  isAtLimit: boolean
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
  /** 월간 질문 한도 */
  monthlyQuestionLimit: number
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
  monthly_question_limit: number
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
    monthlyQuestionLimit: row.monthly_question_limit ?? 30,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

// =============================================================================
// 역할별 할당량 상수 (v3.0)
// =============================================================================

/**
 * 역할별 기본 할당량
 * DB 트리거에서 자동 설정되지만, 클라이언트 참조용
 */
export const ROLE_LIMITS: Record<UserRole, UsageLimits> = {
  pending: { monthlyQuestionLimit: 0 },
  free: { monthlyQuestionLimit: 30 },
  premium: { monthlyQuestionLimit: 300 },
  special: { monthlyQuestionLimit: 999999 },
  admin: { monthlyQuestionLimit: 999999 },
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
