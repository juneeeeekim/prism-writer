import { describe, it, expect } from 'vitest'
import { parseApiError } from '../parseError'

describe('parseApiError', () => {
  it('parses canonical Shape C', () => {
    const body = {
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Login required', requestId: 'req_abc' },
    }
    const parsed = parseApiError(body, 401)
    expect(parsed.code).toBe('UNAUTHORIZED')
    expect(parsed.message).toBe('Login required')
    expect(parsed.requestId).toBe('req_abc')
    expect(parsed.status).toBe(401)
  })

  it('parses Shape C with details', () => {
    const body = {
      success: false,
      error: { code: 'BAD_REQUEST', message: 'invalid', requestId: 'r1', details: { field: 'x' } },
    }
    const parsed = parseApiError(body, 400)
    expect(parsed.details).toEqual({ field: 'x' })
  })

  it('parses Shape B with error code', () => {
    const body = { success: false, error: 'UNAUTHORIZED', message: '로그인 필요' }
    const parsed = parseApiError(body, 401)
    expect(parsed.code).toBe('UNAUTHORIZED')
    expect(parsed.message).toBe('로그인 필요')
  })

  it('parses Shape B with message-only error', () => {
    const body = { success: false, error: '로그인 실패했습니다' }
    const parsed = parseApiError(body, 401)
    expect(parsed.code).toBe('UNAUTHORIZED')
    expect(parsed.message).toBe('로그인 실패했습니다')
  })

  it('parses Shape A simple', () => {
    const body = { error: 'Unauthorized' }
    const parsed = parseApiError(body, 401)
    expect(parsed.message).toBe('Unauthorized')
  })

  it('parses Shape A+ with code and message', () => {
    const body = { error: 'BAD_REQUEST', message: '필드 누락' }
    const parsed = parseApiError(body, 400)
    expect(parsed.code).toBe('BAD_REQUEST')
    expect(parsed.message).toBe('필드 누락')
  })

  it('parses Shape D (message only, no error key)', () => {
    const body = { success: false, message: 'Forbidden access' }
    const parsed = parseApiError(body, 403)
    expect(parsed.code).toBe('FORBIDDEN')
    expect(parsed.message).toBe('Forbidden access')
  })

  it('falls back when body is null', () => {
    const parsed = parseApiError(null, 500)
    expect(parsed.code).toBe('INTERNAL_ERROR')
    expect(parsed.message).toBeTruthy()
  })

  it('maps 429 to RATE_LIMITED', () => {
    const parsed = parseApiError({ message: '한도 초과' }, 429)
    expect(parsed.code).toBe('RATE_LIMITED')
  })

  it('maps 503 to SERVICE_UNAVAILABLE', () => {
    const parsed = parseApiError({ message: '점검 중' }, 503)
    expect(parsed.code).toBe('SERVICE_UNAVAILABLE')
  })

  it('treats lowercase error string as message not code', () => {
    const body = { error: 'something went wrong' }
    const parsed = parseApiError(body, 500)
    expect(parsed.code).toBe('INTERNAL_ERROR')
    expect(parsed.message).toBe('something went wrong')
  })
})
