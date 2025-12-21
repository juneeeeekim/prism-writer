// =============================================================================
// PRISM Writer - LLM Gateway Unit Tests
// =============================================================================
// 파일: frontend/src/lib/llm/__tests__/gateway.test.ts
// 역할: LLM Gateway의 라우팅 및 통합 기능 테스트
// =============================================================================

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { generateText, generateTextStream, isLLMAvailable } from '../gateway'
import { getProviderByModel } from '../providers'
import { getDefaultModel } from '@/config/llm.config'

// providers 모킹
vi.mock('../providers', () => ({
  getProviderByModel: vi.fn(),
}))

// llm.config 모킹
vi.mock('@/config/llm.config', () => ({
  getDefaultModel: vi.fn(() => 'gemini-2.0-flash'),
}))

// models 모킹
vi.mock('@/config/models', () => ({
  getModelConfig: vi.fn((id) => {
    if (id === 'gemini-2.0-flash') return { enabled: true }
    if (id === 'invalid-model') return null
    return { enabled: true }
  }),
}))

describe('LLM Gateway', () => {
  const mockProvider = {
    generateText: vi.fn(),
    generateStream: vi.fn(),
    isAvailable: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    ;(getProviderByModel as any).mockReturnValue(mockProvider)
  })

  // ---------------------------------------------------------------------------
  // generateText 테스트
  // ---------------------------------------------------------------------------
  describe('generateText', () => {
    it('기본 모델을 사용하여 텍스트를 생성해야 함', async () => {
      mockProvider.generateText.mockResolvedValue({ text: 'Hello World' })
      
      const result = await generateText('Hi')
      
      expect(getDefaultModel).toHaveBeenCalled()
      expect(getProviderByModel).toHaveBeenCalledWith('gemini-2.0-flash')
      expect(mockProvider.generateText).toHaveBeenCalledWith('Hi', expect.objectContaining({ model: 'gemini-2.0-flash' }))
      expect(result.text).toBe('Hello World')
    })

    it('지정된 모델을 사용하여 텍스트를 생성해야 함', async () => {
      mockProvider.generateText.mockResolvedValue({ text: 'Premium Hello' })
      
      const result = await generateText('Hi', { model: 'gemini-3-pro-preview' })
      
      expect(getProviderByModel).toHaveBeenCalledWith('gemini-3-pro-preview')
      expect(mockProvider.generateText).toHaveBeenCalledWith('Hi', expect.objectContaining({ model: 'gemini-3-pro-preview' }))
      expect(result.text).toBe('Premium Hello')
    })
  })

  // ---------------------------------------------------------------------------
  // generateTextStream 테스트
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
  // isLLMAvailable 테스트
  // ---------------------------------------------------------------------------
  describe('isLLMAvailable', () => {
    it('모델이 사용 가능하면 true를 반환해야 함', () => {
      mockProvider.isAvailable.mockReturnValue(true)
      
      const result = isLLMAvailable('gemini-2.0-flash')
      
      expect(result).toBe(true)
    })

    it('존재하지 않는 모델이면 false를 반환해야 함', () => {
      const result = isLLMAvailable('invalid-model')
      
      expect(result).toBe(false)
    })

    it('Provider가 사용 불가능하면 false를 반환해야 함', () => {
      mockProvider.isAvailable.mockReturnValue(false)
      
      const result = isLLMAvailable('gemini-2.0-flash')
      
      expect(result).toBe(false)
    })
  })
})
