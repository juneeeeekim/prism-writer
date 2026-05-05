// =============================================================================
// PRISM Writer - Quota Manager Unit Tests
// =============================================================================
// 설계 의도: 메모리 기반 차단/해제 동작과 만료 시 자동 복구를 보장한다.
// =============================================================================

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// 주석(API/Integration): writeErrorLog는 fs를 사용하므로 단위 테스트에서는
// 부수효과 격리를 위해 모킹한다. 본 매니저의 책임은 메모리 상태 관리이고
// 로깅은 best-effort 비동기이므로 호출 횟수만 검증한다.
const { writeErrorLogMock, getFallbackModelMock } = vi.hoisted(() => ({
  writeErrorLogMock: vi.fn().mockResolvedValue(null),
  getFallbackModelMock: vi.fn(),
}))

vi.mock('@/lib/error-log', () => ({
  writeErrorLog: writeErrorLogMock,
}))

vi.mock('@/config/llm-usage-map', () => ({
  // 주석(시니어): factory에서 함수 자체를 export. 구현은 beforeEach에서 매번 재설정.
  getFallbackModel: (...args: unknown[]) =>
    (getFallbackModelMock as any)(...args),
}))

import {
  markQuotaExceeded,
  markRateLimited,
  isQuotaExceeded,
  resetQuotaState,
  getFallbackIfNeeded,
  getQuotaSnapshot,
} from '../quota-manager'

beforeEach(() => {
  resetQuotaState()
  vi.clearAllMocks()
  // 주석(주니어, 2026-05-04): vi.clearAllMocks가 초기 vi.fn(impl)을 리셋시킬 수
  // 있어 매 테스트마다 명시적으로 구현을 다시 설정해 mock 안정성을 보장한다.
  getFallbackModelMock.mockImplementation((ctx: string) =>
    ctx === 'rag.answer' ? 'gpt-5-mini' : undefined
  )
})

afterEach(() => {
  resetQuotaState()
})

describe('quota-manager', () => {
  it('marks and detects quota exceeded', () => {
    markQuotaExceeded('gemini', 60)
    expect(isQuotaExceeded('gemini')).toBe(true)
  })

  it('automatically clears state once retryAfter elapses', () => {
    vi.useFakeTimers()
    try {
      markQuotaExceeded('gemini', 1)
      expect(isQuotaExceeded('gemini')).toBe(true)
      vi.advanceTimersByTime(1500)
      expect(isQuotaExceeded('gemini')).toBe(false)
    } finally {
      vi.useRealTimers()
    }
  })

  it('returns null fallback when provider not blocked', () => {
    expect(getFallbackIfNeeded('rag.answer', 'gemini')).toBeNull()
  })

  it('returns fallback model when provider blocked and context has fallback', () => {
    markQuotaExceeded('gemini', 60)
    expect(getFallbackIfNeeded('rag.answer' as any, 'gemini')).toBe('gpt-5-mini')
  })

  it('returns null fallback when context has no fallback configured', () => {
    // 주석(시니어): vitest의 vi.mock factory가 path alias 환경에서 일관되게
    // 적용되지 않아, 실제로 fallback이 정의되지 않은 컨텍스트('judge.align')를
    // 사용해 양쪽(mock/real) 모두에서 의미 있는 검증이 되도록 한다.
    markQuotaExceeded('gemini', 60)
    expect(getFallbackIfNeeded('judge.align' as any, 'gemini')).toBeNull()
  })

  it('rate-limit mark is independent per provider', () => {
    markRateLimited('openai', 30)
    expect(isQuotaExceeded('openai')).toBe(true)
    expect(isQuotaExceeded('gemini')).toBe(false)
  })

  it('snapshot reflects only blocked providers and remaining time', () => {
    markQuotaExceeded('gemini', 120)
    const snap = getQuotaSnapshot()
    expect(snap).toHaveLength(1)
    expect(snap[0].provider).toBe('gemini')
    expect(snap[0].remainingSec).toBeGreaterThan(0)
    expect(snap[0].remainingSec).toBeLessThanOrEqual(120)
  })

  it('resetQuotaState by provider only clears the targeted entry', () => {
    markQuotaExceeded('gemini', 60)
    markRateLimited('openai', 30)
    resetQuotaState('gemini')
    expect(isQuotaExceeded('gemini')).toBe(false)
    expect(isQuotaExceeded('openai')).toBe(true)
  })
})
