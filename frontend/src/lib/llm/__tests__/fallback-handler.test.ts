// =============================================================================
// PRISM Writer - Fallback Handler Unit Tests (Phase 3)
// =============================================================================
// 설계 의도: callWithFallback의 3가지 경로(정상/Primary 실패→Fallback 성공/
// 양쪽 실패)를 보장하고, fallback 부적격 에러(CONTEXT_TOO_LONG 등)는 1차에서
// 즉시 실패로 끝나는지 검증한다.
// =============================================================================

import { describe, it, expect, beforeEach, vi } from 'vitest'

const { writeErrorLogMock, getModelForUsageMock, getFallbackModelMock } =
  vi.hoisted(() => ({
    writeErrorLogMock: vi.fn().mockResolvedValue(null),
    getModelForUsageMock: vi.fn(() => 'gemini-3-flash-preview'),
    getFallbackModelMock: vi.fn(() => 'gpt-5-mini' as string | undefined),
  }))

vi.mock('@/lib/error-log', () => ({
  writeErrorLog: writeErrorLogMock,
}))

vi.mock('@/config/llm-usage-map', () => ({
  getModelForUsage: getModelForUsageMock,
  getFallbackModel: getFallbackModelMock,
}))

import { callWithFallback, logFallbackUsage } from '../fallback-handler'
import { resetQuotaState, markQuotaExceeded } from '../quota-manager'

beforeEach(() => {
  vi.clearAllMocks()
  resetQuotaState()
  getModelForUsageMock.mockReturnValue('gemini-3-flash-preview')
  getFallbackModelMock.mockReturnValue('gpt-5-mini')
})

describe('callWithFallback', () => {
  it('returns primary result when primary succeeds', async () => {
    const apiCall = vi.fn().mockResolvedValue('OK')
    const out = await callWithFallback('rag.answer' as any, apiCall)

    expect(out.success).toBe(true)
    expect(out.result).toBe('OK')
    expect(out.usedFallback).toBe(false)
    expect(out.usedModel).toBe('gemini-3-flash-preview')
    expect(apiCall).toHaveBeenCalledTimes(1)
  })

  it('falls back when primary fails with retryable error', async () => {
    const apiCall = vi
      .fn()
      .mockRejectedValueOnce(new Error('429 rate limit'))
      .mockResolvedValueOnce('FALLBACK_OK')

    const out = await callWithFallback('rag.answer' as any, apiCall)

    expect(out.success).toBe(true)
    expect(out.result).toBe('FALLBACK_OK')
    expect(out.usedFallback).toBe(true)
    expect(out.usedModel).toBe('gpt-5-mini')
    expect(apiCall).toHaveBeenCalledTimes(2)
  })

  it('returns failure result when both calls fail', async () => {
    const apiCall = vi
      .fn()
      .mockRejectedValueOnce(new Error('quota exceeded'))
      .mockRejectedValueOnce(new Error('fetch failed'))

    const out = await callWithFallback('rag.answer' as any, apiCall)

    expect(out.success).toBe(false)
    expect(out.usedFallback).toBe(true)
    expect(out.error?.type).toBe('NETWORK_ERROR')
    expect(apiCall).toHaveBeenCalledTimes(2)
  })

  it('does not fall back for non-eligible errors (CONTEXT_TOO_LONG)', async () => {
    const apiCall = vi.fn().mockRejectedValue(new Error('input is too long'))

    const out = await callWithFallback('rag.answer' as any, apiCall)

    expect(out.success).toBe(false)
    expect(out.usedFallback).toBe(false)
    expect(out.error?.type).toBe('CONTEXT_TOO_LONG')
    expect(apiCall).toHaveBeenCalledTimes(1)
  })

  it('does not fall back for INVALID_API_KEY', async () => {
    const apiCall = vi.fn().mockRejectedValue(new Error('invalid api key'))

    const out = await callWithFallback('rag.answer' as any, apiCall)

    expect(out.success).toBe(false)
    expect(out.usedFallback).toBe(false)
    expect(out.error?.type).toBe('INVALID_API_KEY')
    expect(apiCall).toHaveBeenCalledTimes(1)
  })

  it('returns primary failure when no fallback configured', async () => {
    // 주석(시니어): 'judge.align'은 llm-usage-map에서 실제로 fallback 미정의.
    // mock factory가 path alias로 적용되지 않을 때도 안전한 검증을 보장한다.
    getFallbackModelMock.mockReturnValue(undefined)
    const apiCall = vi.fn().mockRejectedValue(new Error('429'))

    const out = await callWithFallback('judge.align' as any, apiCall)

    expect(out.success).toBe(false)
    expect(out.usedFallback).toBe(false)
    expect(out.error?.type).toBe('RATE_LIMITED')
    expect(apiCall).toHaveBeenCalledTimes(1)
  })

  it('uses fallback immediately when provider is pre-blocked', async () => {
    markQuotaExceeded('gemini', 60)
    const apiCall = vi.fn().mockResolvedValue('FALLBACK')

    const out = await callWithFallback('rag.answer' as any, apiCall)

    expect(out.success).toBe(true)
    expect(out.result).toBe('FALLBACK')
    expect(out.usedFallback).toBe(true)
    // primary 호출은 시도되지 않아야 한다.
    expect(apiCall).toHaveBeenCalledTimes(1)
    expect(apiCall).toHaveBeenCalledWith('gpt-5-mini')
  })

  it('marks provider as quota-exceeded after primary quota error', async () => {
    const apiCall = vi
      .fn()
      .mockRejectedValueOnce(new Error('quota exceeded'))
      .mockResolvedValueOnce('OK')

    await callWithFallback('rag.answer' as any, apiCall)

    // 다음 호출에서는 즉시 fallback이 사용되어야 한다.
    const apiCall2 = vi.fn().mockResolvedValue('OK2')
    const out2 = await callWithFallback('rag.answer' as any, apiCall2)
    expect(out2.usedFallback).toBe(true)
  })
})

describe('logFallbackUsage', () => {
  it('only logs when fallback was used', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => undefined)
    try {
      logFallbackUsage({
        success: true,
        usedModel: 'gpt-5-mini',
        usedFallback: false,
      })
      expect(spy).not.toHaveBeenCalled()

      logFallbackUsage({
        success: true,
        usedModel: 'gpt-5-mini',
        usedFallback: true,
      })
      expect(spy).toHaveBeenCalled()
    } finally {
      spy.mockRestore()
    }
  })
})
