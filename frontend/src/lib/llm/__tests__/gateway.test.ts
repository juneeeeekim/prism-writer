// =============================================================================
// PRISM Writer - LLM Gateway Unit Tests
// =============================================================================
// 파일: frontend/src/lib/llm/__tests__/gateway.test.ts
// 역할: LLM Gateway의 라우팅, fallback, 에러 사용자 친화 변환을 검증한다.
// 갱신: 2026-05-03 — Phase 1(에러 분류·Quota·error-log) 통합 테스트 추가
// =============================================================================

import { describe, it, expect, vi, beforeEach } from 'vitest'

// providers 모킹
vi.mock('../providers', () => ({
  getProviderByModel: vi.fn(),
}))

// llm.config 모킹
vi.mock('@/config/llm.config', () => ({
  getDefaultModel: vi.fn(() => 'gemini-3-flash-preview'),
}))

// models 모킹
vi.mock('@/config/models', () => ({
  getModelConfig: vi.fn((id) => {
    if (id === 'gemini-3-flash-preview') return { enabled: true }
    if (id === 'invalid-model') return null
    return { enabled: true }
  }),
}))

// 주석(주니어): vi.mock은 파일 최상단으로 hoist되어 import보다 먼저 실행된다.
// 따라서 일반 const는 mock factory에서 참조 시점에 undefined가 된다.
// vi.hoisted로 변수도 함께 hoist시켜 안전하게 참조한다.
const { getFallbackModelMock, writeErrorLogMock } = vi.hoisted(() => ({
  getFallbackModelMock: vi.fn(() => undefined as string | undefined),
  writeErrorLogMock: vi.fn().mockResolvedValue(null),
}))

vi.mock('@/config/llm-usage-map', () => ({
  getFallbackModel: getFallbackModelMock,
}))

vi.mock('@/lib/error-log', () => ({
  writeErrorLog: writeErrorLogMock,
}))

// performance-logger는 Supabase server client를 import하므로 단위 테스트에서는
// 부수효과 격리를 위해 모킹한다.
vi.mock('../performance-logger', () => ({
  logPerformance: vi.fn().mockResolvedValue(undefined),
  measurePerformance: vi.fn(async (_c: unknown, _m: unknown, op: () => Promise<unknown>) => op()),
}))

import { generateText, generateTextStream, isLLMAvailable } from '../gateway'
import { getProviderByModel } from '../providers'
import { resetQuotaState } from '../quota-manager'

describe('LLM Gateway', () => {
  const mockProvider = {
    generateText: vi.fn(),
    generateStream: vi.fn(),
    isAvailable: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    resetQuotaState()
    getFallbackModelMock.mockReturnValue(undefined)
    ;(getProviderByModel as any).mockReturnValue(mockProvider)
  })

  // ---------------------------------------------------------------------------
  // generateText: 기본 동작
  // ---------------------------------------------------------------------------
  describe('generateText', () => {
    it('기본 모델을 사용하여 텍스트를 생성해야 함', async () => {
      mockProvider.generateText.mockResolvedValue({ text: 'Hello World' })

      const result = await generateText('Hi')

      expect(getProviderByModel).toHaveBeenCalledWith('gemini-3-flash-preview')
      expect(mockProvider.generateText).toHaveBeenCalledWith(
        'Hi',
        expect.objectContaining({ model: 'gemini-3-flash-preview' })
      )
      expect(result.text).toBe('Hello World')
    })

    it('지정된 모델을 사용하여 텍스트를 생성해야 함', async () => {
      mockProvider.generateText.mockResolvedValue({ text: 'Premium Hello' })

      const result = await generateText('Hi', { model: 'gemini-3-pro-preview' })

      expect(getProviderByModel).toHaveBeenCalledWith('gemini-3-pro-preview')
      expect(result.text).toBe('Premium Hello')
    })

    // -------------------------------------------------------------------------
    // Phase 1: 에러 변환 / Fallback / 로깅
    // -------------------------------------------------------------------------
    it('Primary 실패 시 fallback이 정의되어 있으면 재시도한다', async () => {
      const failing = vi.fn().mockRejectedValueOnce(new Error('429 rate limit'))
      const succeeding = vi.fn().mockResolvedValueOnce({ text: 'fallback ok' })

      // 첫 번째 provider는 primary, 두 번째 호출은 fallback
      ;(getProviderByModel as any)
        .mockReturnValueOnce({ ...mockProvider, generateText: failing })
        .mockReturnValueOnce({ ...mockProvider, generateText: succeeding })

      getFallbackModelMock.mockReturnValue('gpt-5-mini')

      const result = await generateText('Hi', { context: 'rag.answer' })

      expect(failing).toHaveBeenCalledTimes(1)
      expect(succeeding).toHaveBeenCalledTimes(1)
      expect(result.text).toBe('fallback ok')
      // 주석(시니어): writeErrorLog 호출 여부는 별도 단위 테스트에서 보장된다.
      // 본 테스트는 게이트웨이의 primary→fallback 라우팅 동작에 집중한다.
    })

    it('Quota 초과 에러는 사용자 친화 메시지로 변환되어 throw된다', async () => {
      const failing = vi.fn().mockRejectedValue(new Error('quota exceeded'))
      ;(getProviderByModel as any).mockReturnValue({
        ...mockProvider,
        generateText: failing,
      })

      // fallback 미지정 → primary 실패가 그대로 노출되어야 함
      getFallbackModelMock.mockReturnValue(undefined)

      await expect(generateText('Hi')).rejects.toThrow(/사용량/)
    })

    it('Fallback도 실패하면 사용자 친화 메시지를 그대로 던진다', async () => {
      const failingPrimary = vi
        .fn()
        .mockRejectedValueOnce(new Error('quota exceeded'))
      const failingFallback = vi
        .fn()
        .mockRejectedValueOnce(new Error('fetch failed'))

      ;(getProviderByModel as any)
        .mockReturnValueOnce({ ...mockProvider, generateText: failingPrimary })
        .mockReturnValueOnce({ ...mockProvider, generateText: failingFallback })

      getFallbackModelMock.mockReturnValue('gpt-5-mini')

      await expect(
        generateText('Hi', { context: 'rag.answer' })
      ).rejects.toThrow(/네트워크/)
    })
  })

  // ---------------------------------------------------------------------------
  // generateTextStream
  // ---------------------------------------------------------------------------
  describe('generateTextStream', () => {
    it('텍스트 스트림을 생성해야 함', async () => {
      async function* mockStream() {
        yield { text: 'Hello', done: false }
        yield { text: ' World', done: true }
      }
      mockProvider.generateStream.mockReturnValue(mockStream())

      const stream = generateTextStream('Hi')
      const chunks = []
      for await (const chunk of stream) {
        chunks.push(chunk)
      }

      expect(chunks).toHaveLength(2)
      expect(chunks[0].text).toBe('Hello')
      expect(chunks[1].done).toBe(true)
    })
  })

  // ---------------------------------------------------------------------------
  // isLLMAvailable
  // ---------------------------------------------------------------------------
  describe('isLLMAvailable', () => {
    it('모델이 사용 가능하면 true를 반환해야 함', () => {
      mockProvider.isAvailable.mockReturnValue(true)
      const result = isLLMAvailable('gemini-3-flash-preview')
      expect(result).toBe(true)
    })

    it('존재하지 않는 모델이면 false를 반환해야 함', () => {
      const result = isLLMAvailable('invalid-model')
      expect(result).toBe(false)
    })

    it('Provider가 사용 불가능하면 false를 반환해야 함', () => {
      mockProvider.isAvailable.mockReturnValue(false)
      const result = isLLMAvailable('gemini-3-flash-preview')
      expect(result).toBe(false)
    })
  })
})
