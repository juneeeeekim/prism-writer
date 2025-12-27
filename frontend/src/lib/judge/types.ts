
// =============================================================================
// PRISM Writer - Judge System Types
// =============================================================================
// 파일: frontend/src/lib/judge/types.ts
// 역할: Align Judge 및 Upgrade Planner에서 사용하는 타입 정의
// =============================================================================

/**
 * Stage 1: Align Judge 판정 결과
 */
export interface JudgeResult {
  /** 평가 기준 ID (TemplateSchema.criteria_id) */
  criteria_id: string
  /** 판정 상태 (통과, 실패, 부분 통과) */
  status: 'pass' | 'fail' | 'partial'
  /** 판정 근거 (왜 이렇게 판정했는지) */
  reasoning: string
  /** 원문 인용 (사용자 글에서 관련된 부분) */
  citation?: string
}

/**
 * Stage 2: Upgrade Planner 수정 계획
 */
export interface UpgradePlan {
  /** 평가 기준 ID */
  criteria_id: string
  /** 무엇을 수정해야 하는지 */
  what: string
  /** 왜 수정해야 하는지 (이유) */
  why: string
  /** 어떻게 수정해야 하는지 (구체적 방법) */
  how: string
  /** 수정 예시 (Before/After 또는 모범 예시) */
  example: string
  /** 메타데이터 (모델 정보 등) */
  _meta?: {
    model: string
    quality: string
    isFallback?: boolean
  }
}

/**
 * 통합 평가 결과
 */
export interface EvaluationResult {
  /** 문서 ID */
  document_id: string
  /** 템플릿 ID */
  template_id: string
  /** 평가 일시 */
  evaluated_at: string
  /** 기준별 판정 결과 목록 */
  judgments: JudgeResult[]
  /** 기준별 수정 계획 목록 (Fail/Partial 항목에 대해 생성) */
  upgrade_plans: UpgradePlan[]
  /** 전체 점수 (0~100) */
  overall_score: number
}
