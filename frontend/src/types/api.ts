// =============================================================================
// PRISM Writer - API Response Types
// =============================================================================
// 파일: frontend/src/types/api.ts
// 역할: API 표준 응답 타입 정의 및 에러 코드 상수
// 버전: v1.0.0 (P1-09)
// =============================================================================

// =============================================================================
// [P1-09] 에러 코드 상수
// =============================================================================

/**
 * API 에러 코드 상수
 * @description 모든 API 에러 응답에 사용되는 표준 에러 코드
 */
export const ErrorCodes = {
  /** 인증이 필요함 */
  UNAUTHORIZED: 'UNAUTHORIZED',
  /** 리소스를 찾을 수 없음 */
  NOT_FOUND: 'NOT_FOUND',
  /** 요청 데이터 유효성 검증 실패 */
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  /** 서버 내부 오류 */
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  /** 요청 횟수 제한 초과 */
  RATE_LIMITED: 'RATE_LIMITED',
  /** 잘못된 요청 */
  BAD_REQUEST: 'BAD_REQUEST',
  /** 권한 없음 (인증됨, 권한 부족) */
  FORBIDDEN: 'FORBIDDEN',
} as const

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes]

// =============================================================================
// [P1-09] 표준 API 응답 타입
// =============================================================================

/**
 * API 에러 상세 정보
 */
export interface ApiError {
  /** 에러 코드 */
  code: ErrorCode
  /** 사용자 친화적 에러 메시지 */
  message: string
  /** 개발자용 상세 정보 (옵션) */
  details?: unknown
}

/**
 * API 실패 응답 타입
 */
export interface ApiErrorResponse {
  success: false
  error: ApiError
}

/**
 * API 성공 응답 타입
 */
export interface ApiSuccessResponse<T = unknown> {
  success: true
  data?: T
  message?: string
}

/**
 * API 응답 통합 타입
 */
export type ApiResponse<T = unknown> = ApiSuccessResponse<T> | ApiErrorResponse

// =============================================================================
// [P1-09] HTTP 상태 코드 매핑
// =============================================================================

/**
 * 에러 코드별 HTTP 상태 코드 매핑
 */
export const ErrorHttpStatus: Record<ErrorCode, number> = {
  [ErrorCodes.UNAUTHORIZED]: 401,
  [ErrorCodes.NOT_FOUND]: 404,
  [ErrorCodes.VALIDATION_ERROR]: 422,
  [ErrorCodes.INTERNAL_ERROR]: 500,
  [ErrorCodes.RATE_LIMITED]: 429,
  [ErrorCodes.BAD_REQUEST]: 400,
  [ErrorCodes.FORBIDDEN]: 403,
}
