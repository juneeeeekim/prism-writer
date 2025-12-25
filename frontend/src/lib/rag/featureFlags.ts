// =============================================================================
// PRISM Writer - Pipeline v4 Feature Flags
// =============================================================================
// 파일: frontend/src/lib/rag/featureFlags.ts
// 역할: Pipeline v4 기능 토글 (긴급 롤백용)
// =============================================================================

// =============================================================================
// Pipeline v4 Feature Flag
// =============================================================================

/**
 * Pipeline v4 기능 활성화 여부
 * 
 * @description
 * 주석(시니어 개발자): 환경 변수로 v4 기능 즉시 비활성화 가능
 * - 프로덕션 장애 시 환경 변수만 변경하면 v3로 롤백
 * - ENABLE_PIPELINE_V4 = 'false' 설정 시 v3 로직 사용
 * 
 * 기본값: true (v4 활성화)
 */
export const ENABLE_PIPELINE_V4 = process.env.NEXT_PUBLIC_ENABLE_PIPELINE_V4 !== 'false'

/**
 * Pipeline v4 각 기능별 세부 토글
 * 
 * @description
 * 주석(주니어 개발자): 특정 기능만 개별 비활성화 가능
 */
export const PIPELINE_V4_FLAGS = {
  /** chunk_type DB 레벨 필터링 사용 */
  useChunkTypeFilter: ENABLE_PIPELINE_V4,
  
  /** Regression Gate 활성화 */
  enableRegressionGate: ENABLE_PIPELINE_V4,
  
  /** Validation Sample 자동 생성 */
  autoGenerateValidationSamples: ENABLE_PIPELINE_V4,
  
  /** 청크 분류 로깅 (개발 환경만) */
  enableClassificationLogging: process.env.NODE_ENV === 'development',
  
  /** LLM 프롬프트 길이 제한 적용 */
  enablePromptLengthLimit: ENABLE_PIPELINE_V4,
}

/**
 * 현재 파이프라인 버전 반환
 */
export function getPipelineVersion(): 'v3' | 'v4' {
  return ENABLE_PIPELINE_V4 ? 'v4' : 'v3'
}

/**
 * Feature Flag 상태 로깅 (앱 시작 시 호출)
 */
export function logFeatureFlagStatus(): void {
  if (typeof window !== 'undefined') {
    console.log(`[FeatureFlags] Pipeline Version: ${getPipelineVersion()}`)
    console.log('[FeatureFlags] Flags:', PIPELINE_V4_FLAGS)
  }
}
