// =============================================================================
// PRISM Writer - API Error Handler
// =============================================================================
// 파일: frontend/src/lib/api/errorHandler.ts
// 역할: 공통 API 에러 핸들링 유틸리티
// 버전: v1.0.0 (P1-10)
// =============================================================================

import { NextResponse } from 'next/server'
import { ErrorCodes, ErrorHttpStatus, type ApiErrorResponse, type ErrorCode } from '@/types/api'

// =============================================================================
// [P1-10] 공통 에러 핸들러
// =============================================================================

/**
 * API 에러를 표준 응답으로 변환
 * @param error - 발생한 에러
 * @param context - 에러 발생 컨텍스트 (로깅용)
 * @returns NextResponse with standardized error format
 */
export function handleApiError(error: unknown, context?: string): NextResponse<ApiErrorResponse> {
  // 컨텍스트와 함께 에러 로깅
  console.error(`[API Error]${context ? ` ${context}:` : ''}`, error)

  // 에러 타입에 따른 분류
  if (error instanceof Error) {
    // 인증 에러
    if (error.message.toLowerCase().includes('unauthorized') || 
        error.message.toLowerCase().includes('authentication')) {
      return createErrorResponse(ErrorCodes.UNAUTHORIZED, '인증이 필요합니다.')
    }

    // Not Found 에러
    if (error.message.toLowerCase().includes('not found')) {
      return createErrorResponse(ErrorCodes.NOT_FOUND, '요청한 리소스를 찾을 수 없습니다.')
    }

    // Rate Limit 에러
    if (error.message.toLowerCase().includes('rate limit')) {
      return createErrorResponse(ErrorCodes.RATE_LIMITED, '요청 횟수를 초과했습니다. 잠시 후 다시 시도해주세요.')
    }

    // 기타 에러는 메시지 포함
    return createErrorResponse(ErrorCodes.INTERNAL_ERROR, '서버 오류가 발생했습니다.', error.message)
  }

  // 알 수 없는 에러
  return createErrorResponse(ErrorCodes.INTERNAL_ERROR, '알 수 없는 오류가 발생했습니다.')
}

/**
 * 표준 에러 응답 생성
 */
export function createErrorResponse(
  code: ErrorCode,
  message: string,
  details?: unknown
): NextResponse<ApiErrorResponse> {
  const status = ErrorHttpStatus[code] || 500

  return NextResponse.json(
    {
      success: false as const,
      error: {
        code,
        message,
        ...(details !== undefined && { details }),
      },
    },
    { status }
  )
}

/**
 * 표준 성공 응답 생성
 */
export function createSuccessResponse<T>(
  data?: T,
  message?: string
): NextResponse {
  return NextResponse.json({
    success: true,
    ...(data !== undefined && { data }),
    ...(message !== undefined && { message }),
  })
}

// =============================================================================
// [P1-10] 유틸리티 함수
// =============================================================================

/**
 * 인증 에러 응답 (401)
 */
export function unauthorizedResponse(message = '로그인이 필요합니다.'): NextResponse<ApiErrorResponse> {
  return createErrorResponse(ErrorCodes.UNAUTHORIZED, message)
}

/**
 * 권한 없음 응답 (403)
 */
export function forbiddenResponse(message = '접근 권한이 없습니다.'): NextResponse<ApiErrorResponse> {
  return createErrorResponse(ErrorCodes.FORBIDDEN, message)
}

/**
 * Not Found 응답 (404)
 */
export function notFoundResponse(message = '요청한 리소스를 찾을 수 없습니다.'): NextResponse<ApiErrorResponse> {
  return createErrorResponse(ErrorCodes.NOT_FOUND, message)
}

/**
 * Bad Request 응답 (400)
 */
export function badRequestResponse(message: string, details?: unknown): NextResponse<ApiErrorResponse> {
  return createErrorResponse(ErrorCodes.BAD_REQUEST, message, details)
}
