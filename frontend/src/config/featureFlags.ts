// =============================================================================
// PRISM Writer - Feature Flags Configuration
// =============================================================================
// 파일: frontend/src/config/featureFlags.ts
// 역할: 전역 Feature Flag 관리 (Pipeline v4/v5 전환, UI 레이아웃 등)
// 생성일: 2025-12-25
// 
// 주석(시니어 개발자): 이 파일은 모든 Feature Flag를 중앙 집중 관리합니다.
// 비상 시 환경 변수만 변경하여 기능을 끄거나 이전 버전으로 롤백할 수 있습니다.
// =============================================================================

// =============================================================================
// Feature Flags 정의
// =============================================================================

/**
 * 전역 Feature Flag 객체
 * 
 * @description
 * 모든 환경 변수 기반 Feature Flag를 한 곳에서 관리합니다.
 * 기본값은 모두 true (최신 기능 활성화)이며,
 * 환경 변수를 'false'로 설정하면 비활성화됩니다.
 */
export const FEATURE_FLAGS = {
  /**
   * Pipeline v4 활성화 (Gemini 3 Flash)
   * 환경 변수: ENABLE_PIPELINE_V4
   * 기본값: true
   */
  ENABLE_PIPELINE_V4: process.env.ENABLE_PIPELINE_V4 !== 'false',

  /**
   * Pipeline v5 활성화 (Shadow Workspace + Patch 시스템)
   * 환경 변수: ENABLE_PIPELINE_V5
   * 기본값: false (아직 개발 중)
   */
  ENABLE_PIPELINE_V5: process.env.ENABLE_PIPELINE_V5 === 'true',

  /**
   * 3패널 UI 활성화 (에디터 + 부합도 + 제안 카드)
   * 환경 변수: NEXT_PUBLIC_USE_V3_TEMPLATES
   * 기본값: false
   * 
   * 주석(UX 전문가): 기존 2패널 레이아웃과 호환성 유지
   */
  ENABLE_THREE_PANEL_UI: process.env.NEXT_PUBLIC_USE_V3_TEMPLATES === 'true',

  /**
   * Gemini LLM 사용 (OpenAI fallback 대신)
   * 환경 변수: ENABLE_GEMINI_LLM
   * 기본값: true
   */
  ENABLE_GEMINI_LLM: process.env.ENABLE_GEMINI_LLM !== 'false',

  /**
   * 듀얼 인덱스 검색 (Rule + Example 분리)
   * 환경 변수: ENABLE_DUAL_INDEX
   * 기본값: false (Pipeline v5에서 활성화)
   */
  ENABLE_DUAL_INDEX: process.env.ENABLE_DUAL_INDEX === 'true',

  /**
   * Shadow Workspace 시뮬레이션
   * 환경 변수: ENABLE_SHADOW_WORKSPACE
   * 기본값: false (Pipeline v5에서 활성화)
   */
  ENABLE_SHADOW_WORKSPACE: process.env.ENABLE_SHADOW_WORKSPACE === 'true',

  /**
   * 패치 제안 기능
   * 환경 변수: ENABLE_PATCH_SUGGESTIONS
   * 기본값: false (Pipeline v5에서 활성화)
   */
  ENABLE_PATCH_SUGGESTIONS: process.env.ENABLE_PATCH_SUGGESTIONS === 'true',
} as const

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Feature Flag 활성화 여부 확인
 * 
 * @param flag - 확인할 플래그 이름
 * @returns 플래그 활성화 여부
 * 
 * @example
 * ```typescript
 * if (isFeatureEnabled('ENABLE_PIPELINE_V5')) {
 *   // v5 전용 로직
 * }
 * ```
 */
export function isFeatureEnabled(flag: keyof typeof FEATURE_FLAGS): boolean {
  return FEATURE_FLAGS[flag]
}

/**
 * 현재 Pipeline 버전 확인
 * 
 * @returns 'v3' | 'v4' | 'v5'
 */
export function getPipelineVersion(): 'v3' | 'v4' | 'v5' {
  if (FEATURE_FLAGS.ENABLE_PIPELINE_V5) return 'v5'
  if (FEATURE_FLAGS.ENABLE_PIPELINE_V4) return 'v4'
  return 'v3'
}

/**
 * UI 레이아웃 타입 확인
 * 
 * @returns 'dual' (2패널) | 'three' (3패널)
 */
export function getUILayoutType(): 'dual' | 'three' {
  return FEATURE_FLAGS.ENABLE_THREE_PANEL_UI ? 'three' : 'dual'
}

/**
 * LLM Provider 확인
 * 
 * @returns 'gemini' | 'openai'
 */
export function getLLMProvider(): 'gemini' | 'openai' {
  return FEATURE_FLAGS.ENABLE_GEMINI_LLM ? 'gemini' : 'openai'
}

/**
 * 모든 Feature Flag 상태를 로그 출력 (디버깅용)
 * 
 * @returns void
 */
export function logFeatureFlags(): void {
  console.log('[FeatureFlags] Current state:')
  console.log('  Pipeline Version:', getPipelineVersion())
  console.log('  UI Layout:', getUILayoutType())
  console.log('  LLM Provider:', getLLMProvider())
  console.log('  Flags:', FEATURE_FLAGS)
}

// =============================================================================
// Type Exports
// =============================================================================

export type FeatureFlagKey = keyof typeof FEATURE_FLAGS
export type PipelineVersion = 'v3' | 'v4' | 'v5'
export type UILayoutType = 'dual' | 'three'
