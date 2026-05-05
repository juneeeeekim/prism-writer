// =============================================================================
// PRISM Writer - LLM Cost Calculator (Phase 6 골격)
// =============================================================================
// 파일: frontend/src/lib/llm/cost-calculator.ts
// 역할: MODEL_REGISTRY의 단가 정보로 토큰 사용량을 비용으로 환산한다.
// 설계 의도(왜 이 구조인가):
//   - models.ts에 이미 costPerInputToken/costPerOutputToken이 정의되어 있어
//     비용 계산을 별도 데이터 소스 없이 수행할 수 있다.
//   - 입력은 보수적으로 처리: 등록되지 않은 모델 ID는 비용 0으로 반환하고
//     경고 로그를 남긴다(임의 추정으로 잘못된 비용 표시 방지).
// =============================================================================

import { getModelConfig } from '@/config/models'

export interface CostBreakdown {
  modelId: string
  inputTokens: number
  outputTokens: number
  inputCostUsd: number
  outputCostUsd: number
  totalCostUsd: number
}

/**
 * 단일 호출 비용 계산.
 */
export function calculateCallCost(
  modelId: string,
  inputTokens: number,
  outputTokens: number
): CostBreakdown {
  const config = getModelConfig(modelId)
  if (!config) {
    console.warn(`[CostCalculator] Unknown model: ${modelId} — cost set to 0`)
    return {
      modelId,
      inputTokens,
      outputTokens,
      inputCostUsd: 0,
      outputCostUsd: 0,
      totalCostUsd: 0,
    }
  }

  const inputCostUsd = inputTokens * config.costPerInputToken
  const outputCostUsd = outputTokens * config.costPerOutputToken

  return {
    modelId,
    inputTokens,
    outputTokens,
    inputCostUsd,
    outputCostUsd,
    totalCostUsd: inputCostUsd + outputCostUsd,
  }
}

/**
 * 여러 호출의 비용 합산.
 */
export function sumCosts(rows: CostBreakdown[]): {
  totalCostUsd: number
  inputCostUsd: number
  outputCostUsd: number
} {
  return rows.reduce(
    (acc, r) => ({
      totalCostUsd: acc.totalCostUsd + r.totalCostUsd,
      inputCostUsd: acc.inputCostUsd + r.inputCostUsd,
      outputCostUsd: acc.outputCostUsd + r.outputCostUsd,
    }),
    { totalCostUsd: 0, inputCostUsd: 0, outputCostUsd: 0 }
  )
}
