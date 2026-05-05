// =============================================================================
// PRISM Writer - LLM Usage Map Unit Tests (Phase 2)
// =============================================================================
// 설계 의도: 환경 변수 오버라이드 우선순위와 잘못된 ENV에 대한 안전 동작을
// 보장한다. 잘못된 모델 ID가 들어와도 기본 경로로 자동 복귀해야 한다.
// =============================================================================

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  getModelForUsage,
  validateEnvModels,
  LLM_USAGE_MAP,
} from '../llm-usage-map'

const ORIGINAL_ENV = { ...process.env }

beforeEach(() => {
  // 각 테스트 시작 시 LLM_* / MODEL_* 키를 정리하여 격리한다.
  for (const key of Object.keys(process.env)) {
    if (key.startsWith('MODEL_')) delete process.env[key]
  }
})

afterEach(() => {
  for (const key of Object.keys(process.env)) {
    if (key.startsWith('MODEL_') && !(key in ORIGINAL_ENV)) delete process.env[key]
  }
})

describe('getModelForUsage — env override', () => {
  it('returns LLM_USAGE_MAP default when no env is set', () => {
    expect(getModelForUsage('rag.answer')).toBe(
      LLM_USAGE_MAP['rag.answer'].modelId
    )
  })

  it('applies valid env override', () => {
    process.env.MODEL_RAG_ANSWER = 'gpt-5-mini'
    expect(getModelForUsage('rag.answer')).toBe('gpt-5-mini')
  })

  it('translates dotted context to UPPER_SNAKE env key', () => {
    process.env.MODEL_COACH_PERSONA_FEEDBACK = 'gemini-3-flash-preview'
    expect(getModelForUsage('coach.persona.feedback')).toBe(
      'gemini-3-flash-preview'
    )
  })

  it('ignores invalid env model id and falls back to default', () => {
    process.env.MODEL_RAG_ANSWER = 'not-a-real-model'
    expect(getModelForUsage('rag.answer')).toBe(
      LLM_USAGE_MAP['rag.answer'].modelId
    )
  })

  it('does not allow empty env to mask defaults', () => {
    process.env.MODEL_RAG_ANSWER = ''
    expect(getModelForUsage('rag.answer')).toBe(
      LLM_USAGE_MAP['rag.answer'].modelId
    )
  })
})

describe('validateEnvModels', () => {
  it('returns valid:true when no env overrides are set', () => {
    const out = validateEnvModels()
    expect(out.valid).toBe(true)
    expect(out.errors).toEqual([])
  })

  it('reports invalid env keys', () => {
    process.env.MODEL_RAG_ANSWER = 'totally-bogus-id'
    process.env.MODEL_TEMPLATE_CONSISTENCY = 'also-bogus'
    const out = validateEnvModels()
    expect(out.valid).toBe(false)
    expect(out.errors).toHaveLength(2)
    expect(out.errors[0]).toMatch(/MODEL_RAG_ANSWER/)
  })

  it('accepts valid env keys', () => {
    process.env.MODEL_RAG_ANSWER = 'gpt-5-mini'
    const out = validateEnvModels()
    expect(out.valid).toBe(true)
  })
})
