import { NextResponse } from 'next/server'

export type ErrorCode =
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'BAD_REQUEST'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'UNPROCESSABLE'
  | 'RATE_LIMITED'
  | 'PROCESSING_FAILED'
  | 'INTERNAL_ERROR'
  | 'SERVICE_UNAVAILABLE'

export interface ErrorBody<TDetails = unknown> {
  success: false
  error: {
    code: ErrorCode
    message: string
    requestId: string
    details?: TDetails
  }
}

export function createRequestId(prefix = 'req'): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}

export function getRequestId(request: Request, prefix = 'req'): string {
  const fromHeader = request.headers.get('x-request-id')
  return fromHeader && fromHeader.length > 0 ? fromHeader : createRequestId(prefix)
}

export function errorResponse<TDetails = unknown>(
  status: number,
  code: ErrorCode,
  message: string,
  requestId: string,
  details?: TDetails,
): NextResponse<ErrorBody<TDetails>> {
  const body: ErrorBody<TDetails> = {
    success: false,
    error: details === undefined
      ? { code, message, requestId }
      : { code, message, requestId, details },
  }
  return NextResponse.json(body, { status })
}
