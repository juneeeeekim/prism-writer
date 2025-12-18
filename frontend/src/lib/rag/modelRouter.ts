// =============================================================================
// PRISM Writer - Model Router
// =============================================================================
// 파일: frontend/src/lib/rag/modelRouter.ts
// 역할: RouterMode 기반 LLM 모델 선택
// P1 Phase 2.2
// =============================================================================

import { RouterMode, RouterConfig, ROUTER_CONFIGS } from '@/types/rag'

// =============================================================================
// 라우터 함수
// =============================================================================

/**
 * 모드에 따른 Router 구성 반환
 * 
 * @param mode - Router 모드 (기본값: 'standard')
 * @returns 해당 모드의 RouterConfig
 */
export function getRouterConfig(mode: RouterMode = 'standard'): RouterConfig {
  return ROUTER_CONFIGS[mode]
}

/**
 * 단계별 모델 선택
 * 
 * @param step - 파이프라인 단계 ('answer' | 'reviewer')
 * @param config - Router 구성
 * @returns 사용할 모델명 또는 null (비활성화)
 */
export function selectModel(
  step: 'answer' | 'reviewer',
  config: RouterConfig
): string | null {
  if (step === 'answer') {
    return config.answerModel
  }
  return config.reviewerModel
}

/**
 * 모드 유효성 검증
 * 
 * @param mode - 검증할 모드 값
 * @returns 유효한 RouterMode 또는 기본값 'standard'
 */
export function validateMode(mode: unknown): RouterMode {
  if (
    typeof mode === 'string' &&
    ['cheap', 'standard', 'strict'].includes(mode)
  ) {
    return mode as RouterMode
  }
  return 'standard'
}

/**
 * 모드별 설명 반환
 * 
 * @param mode - Router 모드
 * @returns 사용자 친화적 설명
 */
export function getModeDescription(mode: RouterMode): string {
  const descriptions: Record<RouterMode, string> = {
    cheap: '💰 경제 모드 - 빠른 응답, 검토 없음',
    standard: '⚖️ 표준 모드 - 균형 잡힌 품질',
    strict: '🔒 정밀 모드 - 최고 품질, 상세 검토',
  }
  return descriptions[mode]
}

/**
 * 모드별 예상 응답 시간 반환
 * 
 * @param mode - Router 모드
 * @returns 예상 응답 시간 (초)
 */
export function getEstimatedTime(mode: RouterMode): number {
  const times: Record<RouterMode, number> = {
    cheap: 3,
    standard: 5,
    strict: 10,
  }
  return times[mode]
}

// =============================================================================
// 로깅 유틸리티
// =============================================================================

/**
 * 라우팅 결정 로깅 (개발용)
 */
export function logRoutingDecision(
  mode: RouterMode,
  step: 'answer' | 'reviewer',
  selectedModel: string | null
): void {
  if (process.env.NODE_ENV === 'development') {
    console.log(`[ModelRouter] Mode: ${mode}, Step: ${step}, Model: ${selectedModel ?? 'disabled'}`)
  }
}
