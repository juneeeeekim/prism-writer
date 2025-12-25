// =============================================================================
// PRISM Writer - Patch System Types
// =============================================================================
// 파일: frontend/src/lib/rag/types/patch.ts
// 역할: Pipeline v5 패치 시스템 타입 정의
// 생성일: 2025-12-25
// 
// 주석(시니어 개발자): 이 파일은 Cursor AI의 "Patch-only 수정" 패턴을 구현합니다.
// 기존 EvaluationResult와 호환성을 유지하면서 패치 기능을 추가합니다.
// =============================================================================

/**
 * 패치 명령 타입 (Cursor AI 스타일)
 * 
 * @description
 * 사용자의 글을 "망치지 않는 선"에서 수정하기 위한 제한된 편집 명령
 */
export type PatchType = 'Replace' | 'Insert' | 'Move' | 'Delete'

/**
 * 부합도 변화 예측 (Shadow Workspace용)
 */
export interface AlignmentDelta {
  /** 기준 ID */
  criteria_id: string
  /** 변경 전 점수 */
  before_score: number
  /** 변경 후 예상 점수 */
  after_score: number
  /** 변화량 */
  delta: number
}

/**
 * 단일 패치 정의
 * 
 * @description
 * Cursor AI의 "Apply/Reject" 패턴을 따름:
 * - 각 패치는 독립적으로 적용/거부 가능
 * - 반드시 근거(citation)가 연결되어야 함
 * - 적용 후 예상 효과를 미리 보여줌
 */
export interface Patch {
  /** 패치 고유 ID */
  id: string
  
  /** 패치 유형 */
  type: PatchType
  
  /** 대상 범위 (문자 인덱스) */
  targetRange: {
    start: number
    end: number
  }
  
  /** 변경 전 텍스트 */
  before: string
  
  /** 변경 후 텍스트 */
  after: string
  
  /** 수정 이유 (사용자에게 표시) */
  reason: string
  
  /** 근거 인용 ID (어떤 규칙에 근거하는지) */
  citationId: string
  
  /** 적용 시 예상되는 부합도 변화 */
  expectedDelta: AlignmentDelta[]
  
  /** 패치 상태 */
  status: 'pending' | 'applied' | 'rejected'
  
  /** 생성 시간 */
  createdAt: string
}

/**
 * Gap 분석 항목 (Top3 추출용)
 */
export interface GapItem {
  /** 기준 ID */
  criteria_id: string
  /** 기준 이름 */
  criteria_name: string
  /** 현재 점수 */
  current_score: number
  /** 목표 점수 */
  target_score: number
  /** 개선 우선순위 (1이 가장 높음) */
  priority: number
}

/**
 * Change Plan (Shadow Workspace 결과물)
 * 
 * @description
 * LLM이 생성하는 구조화된 수정 계획
 * "텍스트가 아니라 구조화된 Change Plan"으로 반환
 */
export interface ChangePlan {
  /** 패치 목록 (최대 3개 권장) */
  patches: Patch[]
  
  /** 전체 부합도 변화 예측 */
  expectedAlignmentDelta: AlignmentDelta[]
  
  /** Gap Top3 분석 결과 */
  gapTop3: GapItem[]
  
  /** 생성 시간 */
  timestamp: string
  
  /** 문서 ID */
  documentId: string
  
  /** 템플릿 ID */
  templateId: string
}

/**
 * 시뮬레이션 결과 (Shadow Workspace)
 */
export interface SimulationResult {
  /** 패치 ID */
  patchId: string
  
  /** 적용 성공 여부 */
  success: boolean
  
  /** 적용 후 전체 텍스트 미리보기 (first 200 chars) */
  previewText: string
  
  /** 부합도 변화 */
  alignmentDelta: AlignmentDelta[]
  
  /** 전체 점수 변화 */
  overallScoreDelta: number
  
  /** 시뮬레이션 시간 */
  simulatedAt: string
}

// =============================================================================
// Adapter 함수: 기존 EvaluationResult와 호환성 유지
// =============================================================================

import type { EvaluationResult as V3EvaluationResult } from '@/lib/judge/types'

/**
 * 패치 기능이 활성화된 평가 결과 (v5)
 * 
 * @description
 * 기존 V3 EvaluationResult를 확장하여 patches[] 필드를 추가
 * 기존 코드와 호환성 유지를 위해 patches는 optional
 */
export interface PatchEnabledEvaluationResult extends V3EvaluationResult {
  /** Pipeline v5: 패치 목록 (optional for backward compatibility) */
  patches?: Patch[]
  
  /** Pipeline v5: Gap Top3 분석 (optional) */
  gapTop3?: GapItem[]
  
  /** Pipeline v5: Change Plan (optional) */
  changePlan?: ChangePlan
}

/**
 * Legacy 평가 결과를 v5 형태로 변환하는 Adapter
 * 
 * @description
 * 기존 V3 결과를 받아서 v5 형태로 래핑합니다.
 * patches[] 필드가 없어도 정상 동작합니다.
 * 
 * @param v3Result - 기존 V3 평가 결과
 * @returns 패치 기능이 활성화된 평가 결과 (patches는 빈 배열)
 */
export function adaptToV5Result(v3Result: V3EvaluationResult): PatchEnabledEvaluationResult {
  return {
    ...v3Result,
    patches: [],
    gapTop3: [],
    changePlan: undefined,
  }
}

/**
 * v5 결과에서 Legacy 필드만 추출하는 Adapter
 * 
 * @description
 * v5 결과를 기존 UI에서 사용할 수 있도록 변환합니다.
 * patches 관련 필드를 제거합니다.
 * 
 * @param v5Result - v5 평가 결과
 * @returns 기존 V3 형태의 평가 결과
 */
export function extractLegacyResult(v5Result: PatchEnabledEvaluationResult): V3EvaluationResult {
  const { patches, gapTop3, changePlan, ...legacyFields } = v5Result
  return legacyFields
}

/**
 * 결과가 v5 형태인지 확인
 * 
 * @param result - 평가 결과
 * @returns patches 필드가 존재하면 true
 */
export function isV5Result(result: V3EvaluationResult | PatchEnabledEvaluationResult): result is PatchEnabledEvaluationResult {
  return 'patches' in result && Array.isArray((result as PatchEnabledEvaluationResult).patches)
}
