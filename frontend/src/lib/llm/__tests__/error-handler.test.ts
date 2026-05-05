// =============================================================================
// PRISM Writer - LLM Error Handler Unit Tests
// =============================================================================
// 파일: frontend/src/lib/llm/__tests__/error-handler.test.ts
// 설계 의도: 분류 함수가 Provider별 표현(429, quota exceeded, ECONNRESET 등)에
// 안정적으로 매칭되는지, 우선순위(quota > rate > auth ...)가 보존되는지 검증.
// =============================================================================

import { describe, it, expect } from 'vitest'
import {
  classifyLLMError,
  getUserFriendlyMessage,
  inferProviderFromModelId,
  type LLMErrorType,
} from '../error-handler'

const cases: Array<{ label: string; input: unknown; expected: LLMErrorType }> = [
  { label: 'quota exceeded', input: new Error('Resource has been exhausted (e.g. quota)'), expected: 'QUOTA_EXCEEDED' },
  { label: 'resource_exhausted code', input: new Error('RESOURCE_EXHAUSTED'), expected: 'QUOTA_EXCEEDED' },
  { label: '429 rate limit', input: new Error('Request failed: 429 Too Many Requests'), expected: 'RATE_LIMITED' },
  { label: 'rate_limit string', input: new Error('rate_limit_exceeded for tier'), expected: 'RATE_LIMITED' },
  { label: 'invalid api key', input: new Error('Authentication failed: invalid api key'), expected: 'INVALID_API_KEY' },
  { label: 'unauthorized', input: new Error('401 Unauthorized'), expected: 'INVALID_API_KEY' },
  { label: 'model not found', input: new Error('The model "abc" was not found'), expected: 'MODEL_NOT_FOUND' },
  { label: 'context too long', input: new Error('input is too long'), expected: 'CONTEXT_TOO_LONG' },
  { label: 'token limit', input: new Error('token limit exceeded'), expected: 'CONTEXT_TOO_LONG' },
  { label: 'network ECONNRESET', input: new Error('socket hang up ECONNRESET'), expected: 'NETWORK_ERROR' },
  { label: 'fetch failed', input: new Error('fetch failed'), expected: 'NETWORK_ERROR' },
  { label: 'unknown', input: new Error('something unexpected happened'), expected: 'UNKNOWN' },
  { label: 'non-Error string', input: 'plain string error', expected: 'UNKNOWN' },
]

describe('classifyLLMError', () => {
  for (const { label, input, expected } of cases) {
    it(`classifies "${label}" as ${expected}`, () => {
      const out = classifyLLMError(input)
      expect(out.type).toBe(expected)
    })
  }

  // 주석(API/Integration): "quota"와 "429"가 동시에 등장하는 메시지에서
  // 더 보수적인 QUOTA_EXCEEDED를 우선 적용해야 차단 시간이 충분히 길어진다.
  it('prefers QUOTA over RATE when both keywords present', () => {
    const out = classifyLLMError(new Error('429 quota exceeded for project'))
    expect(out.type).toBe('QUOTA_EXCEEDED')
    expect(out.retryAfter).toBe(3600)
  })

  it('marks retryable correctly per type', () => {
    expect(classifyLLMError(new Error('quota')).retryable).toBe(true)
    expect(classifyLLMError(new Error('429')).retryable).toBe(true)
    expect(classifyLLMError(new Error('invalid api key')).retryable).toBe(false)
    expect(classifyLLMError(new Error('input is too long')).retryable).toBe(false)
  })
})

describe('getUserFriendlyMessage', () => {
  it('returns Korean user-friendly text for every type', () => {
    const types: LLMErrorType[] = [
      'QUOTA_EXCEEDED',
      'RATE_LIMITED',
      'INVALID_API_KEY',
      'MODEL_NOT_FOUND',
      'CONTEXT_TOO_LONG',
      'NETWORK_ERROR',
      'UNKNOWN',
    ]
    for (const t of types) {
      const msg = getUserFriendlyMessage({
        type: t,
        message: '',
        retryable: false,
        originalError: null,
      })
      expect(typeof msg).toBe('string')
      expect(msg.length).toBeGreaterThan(0)
    }
  })
})

describe('inferProviderFromModelId', () => {
  it('maps model id to provider group', () => {
    expect(inferProviderFromModelId('gemini-3-flash-preview')).toBe('gemini')
    expect(inferProviderFromModelId('gemma-3-2b-it')).toBe('gemini')
    expect(inferProviderFromModelId('gpt-5-mini')).toBe('openai')
    expect(inferProviderFromModelId('o3-pro')).toBe('openai')
    expect(inferProviderFromModelId('claude-sonnet-4-5-20250929')).toBe('anthropic')
    expect(inferProviderFromModelId('mystery-model')).toBe('unknown')
  })
})
