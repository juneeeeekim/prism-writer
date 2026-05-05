import type { ErrorCode } from './error'

export interface ParsedApiError {
  code: ErrorCode | string
  message: string
  requestId?: string
  details?: unknown
  status?: number
}

const FALLBACK_MESSAGE = '요청 처리 중 오류가 발생했습니다.'

function statusToCode(status?: number): ErrorCode {
  switch (status) {
    case 400: return 'BAD_REQUEST'
    case 401: return 'UNAUTHORIZED'
    case 403: return 'FORBIDDEN'
    case 404: return 'NOT_FOUND'
    case 409: return 'CONFLICT'
    case 422: return 'UNPROCESSABLE'
    case 429: return 'RATE_LIMITED'
    case 503: return 'SERVICE_UNAVAILABLE'
    default:  return 'INTERNAL_ERROR'
  }
}

export function parseApiError(body: unknown, status?: number): ParsedApiError {
  if (!body || typeof body !== 'object') {
    return { code: statusToCode(status), message: FALLBACK_MESSAGE, status }
  }

  const obj = body as Record<string, unknown>

  // Shape C: { success: false, error: { code, message, requestId, details? } }
  if (
    obj.success === false &&
    obj.error &&
    typeof obj.error === 'object' &&
    'code' in (obj.error as Record<string, unknown>)
  ) {
    const e = obj.error as Record<string, unknown>
    return {
      code: typeof e.code === 'string' ? (e.code as ErrorCode) : statusToCode(status),
      message: typeof e.message === 'string' ? e.message : FALLBACK_MESSAGE,
      requestId: typeof e.requestId === 'string' ? e.requestId : undefined,
      details: e.details,
      status,
    }
  }

  // Shape B: { success: false, error: 'CODE_OR_MSG', message?: '...' }
  if (obj.success === false && typeof obj.error === 'string') {
    return {
      code: looksLikeCode(obj.error) ? (obj.error as ErrorCode) : statusToCode(status),
      message: typeof obj.message === 'string' ? obj.message : obj.error,
      status,
    }
  }

  // Shape A / A+: { error: 'CODE_OR_MSG', message?: '...' }
  if (typeof obj.error === 'string') {
    return {
      code: looksLikeCode(obj.error) ? (obj.error as ErrorCode) : statusToCode(status),
      message: typeof obj.message === 'string' ? obj.message : obj.error,
      status,
    }
  }

  // Shape D: { success: false, message: '...' } (no error key)
  if (typeof obj.message === 'string') {
    return { code: statusToCode(status), message: obj.message, status }
  }

  return { code: statusToCode(status), message: FALLBACK_MESSAGE, status }
}

function looksLikeCode(value: string): boolean {
  return /^[A-Z][A-Z0-9_]+$/.test(value)
}
