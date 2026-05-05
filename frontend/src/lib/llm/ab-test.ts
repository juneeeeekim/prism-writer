// =============================================================================
// PRISM Writer - LLM A/B Test (Phase 7 골격)
// =============================================================================
// 파일: frontend/src/lib/llm/ab-test.ts
// 역할: 동일 컨텍스트에서 가중치 기반 모델 선택을 제공한다.
// 설계 의도(왜 이 구조인가):
//   - 실험 정의는 코드 상수로 시작해 단순함을 유지한다. 외부 설정 파일이나
//     DB 의존성 없이 시작 가능 → 실험을 빠르게 활성/비활성화할 수 있다.
//   - 가중치 합이 1.0이 아니어도 정상 동작하도록 normalize한다.
//   - userId를 시드로 일관된 분기를 유지하려면 hash 기반으로 확장 가능
//     (현재는 단순 random — 실험 도입 시 점차 고도화).
// =============================================================================

import type { LLMUsageContext } from '@/config/llm-usage-map'

export interface ABVariant {
  modelId: string
  weight: number
}

export interface ABExperiment {
  enabled: boolean
  context: LLMUsageContext
  variants: ABVariant[]
}

/**
 * 실험 등록 자리.
 *
 * @description
 * 실제 실험은 디렉터 승인 후 이 객체에 추가한다. 비활성 상태(enabled:false)로
 * 시작하여 점진 활성화하는 것이 안전하다.
 */
export const AB_EXPERIMENTS: ABExperiment[] = [
  // {
  //   enabled: false,
  //   context: 'rag.answer',
  //   variants: [
  //     { modelId: 'gemini-3-flash-preview', weight: 0.7 },
  //     { modelId: 'gpt-5-mini', weight: 0.3 },
  //   ],
  // },
]

/**
 * 활성화된 실험에서 가중치 기반으로 variant를 선택한다.
 * 활성 실험이 없으면 null을 반환하여 호출자가 기본값으로 진행하도록 한다.
 */
export function pickVariantModel(context: LLMUsageContext): string | null {
  const experiment = AB_EXPERIMENTS.find(
    (e) => e.enabled && e.context === context
  )
  if (!experiment || experiment.variants.length === 0) return null

  const total = experiment.variants.reduce((sum, v) => sum + v.weight, 0)
  if (total <= 0) return null

  const r = Math.random() * total
  let acc = 0
  for (const v of experiment.variants) {
    acc += v.weight
    if (r <= acc) return v.modelId
  }
  return experiment.variants[experiment.variants.length - 1].modelId
}
