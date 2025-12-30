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
   * 기본값: true (프로덕션 활성화됨)
   */
  ENABLE_PIPELINE_V5: process.env.ENABLE_PIPELINE_V5 !== 'false',

  /**
   * 3패널 UI 활성화 (에디터 + 부합도 + 제안 카드)
   * 환경 변수: NEXT_PUBLIC_USE_V3_TEMPLATES
   * 기본값: false (2패널 레이아웃 유지)
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
   * 기본값: true (프로덕션 활성화됨)
   */
  ENABLE_DUAL_INDEX: process.env.ENABLE_DUAL_INDEX !== 'false',

  /**
   * Shadow Workspace 시뮬레이션
   * 환경 변수: ENABLE_SHADOW_WORKSPACE
   * 기본값: true (프로덕션 활성화됨)
   */
  ENABLE_SHADOW_WORKSPACE: process.env.ENABLE_SHADOW_WORKSPACE !== 'false',

  /**
   * 패치 제안 기능
   * 환경 변수: ENABLE_PATCH_SUGGESTIONS
   * 기본값: true (프로덕션 활성화됨)
   */
  ENABLE_PATCH_SUGGESTIONS: process.env.ENABLE_PATCH_SUGGESTIONS !== 'false',

  /**
   * 어시스턴트 세션 시스템 활성화 (Outline/Evaluation 탭)
   * 환경 변수: ENABLE_ASSISTANT_SESSIONS
   * 기본값: false (점진적 롤아웃)
   */
  ENABLE_ASSISTANT_SESSIONS: process.env.ENABLE_ASSISTANT_SESSIONS === 'true',

  // ==========================================================================
  // RAG 환각 답변 개선 Feature Flags (2025-12-27 추가)
  // ==========================================================================

  /**
   * 개선된 시스템 프롬프트 활성화
   * 환경 변수: ENABLE_IMPROVED_PROMPT
   * 기본값: true (환각 방지를 위해 기본 활성화)
   * 
   * @description
   * - 참고 자료 우선 지시 강화
   * - 회피형 환각 방지 규칙 추가
   * - Chain of Thought 사고 과정 유도
   */
  ENABLE_IMPROVED_PROMPT: process.env.ENABLE_IMPROVED_PROMPT !== 'false',

  /**
   * Query Expansion 활성화 (검색 쿼리 확장)
   * 환경 변수: ENABLE_QUERY_EXPANSION
   * 기본값: false (성능 테스트 후 활성화)
   * 
   * @description
   * - 사용자 쿼리를 동의어로 확장하여 검색 커버리지 향상
   * - 도메인 특화 용어 매핑 적용
   */
  ENABLE_QUERY_EXPANSION: process.env.ENABLE_QUERY_EXPANSION === 'true',

  /**
   * 환각 탐지 기능 활성화
   * 환경 변수: ENABLE_HALLUCINATION_DETECTION
   * 기본값: false (수동 검증 기간 후 활성화)
   * 
   * @description
   * - LLM 응답에서 회피형 환각 패턴 탐지
   * - 자동 탐지 결과는 로그만 기록 (DB 저장 안 함)
   * - 롤백: OFF 시 탐지 로직 완전 비활성화
   */
  ENABLE_HALLUCINATION_DETECTION: process.env.ENABLE_HALLUCINATION_DETECTION === 'true',

  /**
   * RAFT 파인튜닝 기능 활성화
   * 환경 변수: ENABLE_RAFT_FEATURES
   * 기본값: false (명시적 활성화 필요)
   * 
   * @description
   * - RAFT 데이터셋 관리 API 활성화
   * - 합성 데이터 생성 기능 활성화
   * - 관리자 RAFT 대시보드 활성화
   * - 롤백: OFF 시 모든 RAFT 기능 비활성화
   */
  ENABLE_RAFT_FEATURES: process.env.ENABLE_RAFT_FEATURES === 'true',

  /**
   * 단계형 패치 활성화 (1차 핵심 → 2차 표현 → 3차 디테일)
   * 환경 변수: FF_PATCH_STAGING
   * 기본값: false (점진적 롤아웃)
   */
  FF_PATCH_STAGING: process.env.FF_PATCH_STAGING === 'true',

  /**
   * 근거 강도 표시 (display_only)
   * 환경 변수: FF_EVIDENCE_QUALITY
   * 기본값: false
   */
  FF_EVIDENCE_QUALITY: process.env.FF_EVIDENCE_QUALITY === 'true',

  // ==========================================================================
  // [P3-01] Phase 3 Feature Flags (2025-12-29 추가)
  // ==========================================================================

  /**
   * 채팅에 Template 컨텍스트 사용 여부
   * 환경 변수: USE_TEMPLATE_FOR_CHAT
   * 기본값: false (점진적 롤아웃)
   * 
   * @description
   * - 채팅 RAG 검색 시 사용자 템플릿의 규칙/예시를 참고자료로 활용
   * - 활성화 시 시스템 프롬프트에 템플릿 컨텍스트 추가
   */
  USE_TEMPLATE_FOR_CHAT: process.env.USE_TEMPLATE_FOR_CHAT === 'true',

  /**
   * 평가 결과에 source_citations 포함 여부
   * 환경 변수: ENABLE_SOURCE_CITATIONS
   * 기본값: true (투명성 강화)
   * 
   * @description
   * - 평가 근거의 원문 인용을 결과에 포함
   * - Align Judge 응답에 citation 필드 추가
   */
  ENABLE_SOURCE_CITATIONS: process.env.ENABLE_SOURCE_CITATIONS !== 'false',

  /**
   * Shadow Mode (v2/v3 병렬 실행 및 비교 로깅)
   * 환경 변수: ENABLE_SHADOW_MODE
   * 기본값: false (성능 비용)
   * 
   * @description
   * - v2와 v3 평가를 동시에 실행하여 결과 비교
   * - 마이그레이션 검증용
   */
  ENABLE_SHADOW_MODE: process.env.ENABLE_SHADOW_MODE === 'true',
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
