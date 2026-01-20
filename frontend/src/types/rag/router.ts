// =============================================================================
// PRISM Writer - RAG Router Types
// =============================================================================
// 파일: frontend/src/types/rag/router.ts
// 역할: Model Router 관련 타입 정의
// 리팩토링: 2026-01-20
// =============================================================================

import { getDefaultModelId } from '@/config/models'
import { getModelForUsage } from '@/config/llm-usage-map'

// =============================================================================
// Types
// =============================================================================

export type RouterMode = 'cheap' | 'standard' | 'strict'

export interface RouterConfig {
  mode: RouterMode
  answerModel: string
  reviewerModel: string | null
  maxTokens: number
  timeout: number
}

// =============================================================================
// Router Configs
// =============================================================================

function createRouterConfigs(): Record<RouterMode, RouterConfig> {
  const defaultModel = getDefaultModelId()
  const premiumModel = getModelForUsage('premium.answer')

  return {
    cheap: {
      mode: 'cheap',
      answerModel: defaultModel,
      reviewerModel: null,
      maxTokens: 1000,
      timeout: 10000,
    },
    standard: {
      mode: 'standard',
      answerModel: defaultModel,
      reviewerModel: defaultModel,
      maxTokens: 2000,
      timeout: 15000,
    },
    strict: {
      mode: 'strict',
      answerModel: premiumModel,
      reviewerModel: premiumModel,
      maxTokens: 4000,
      timeout: 30000,
    },
  }
}

export const ROUTER_CONFIGS = createRouterConfigs()
