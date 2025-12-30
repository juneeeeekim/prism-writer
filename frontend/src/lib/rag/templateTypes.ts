
// @ts-ignore
import { z } from 'zod'

// =============================================================================
// 1. Template Schema (JSON 구조)
// =============================================================================

/**
 * 템플릿 스키마 (JSON)
 * @description
 * 각 평가 기준(Criteria)에 대한 상세 정의를 포함합니다.
 * 이 스키마는 rag_templates 테이블의 criteria_json 컬럼에 저장됩니다.
 */
export interface TemplateSchema {
  /** 기준 ID (UUID) */
  criteria_id: string
  /** 카테고리 (톤, 구조, 표현, 금지) */
  category: 'tone' | 'structure' | 'expression' | 'prohibition'
  /** 기준에 대한 설명 및 근거 */
  rationale: string
  /** 긍정적인 예시 (Rule을 잘 지킨 경우) */
  positive_examples: string[]
  /** 부정적인 예시 (Rule을 어긴 경우) */
  negative_examples: string[]
  /** 수정 가이드 (부정적 예시를 긍정적으로 바꾸는 방법) */
  remediation_steps: string[]
  /** 원본 문서 인용 (근거가 되는 텍스트) */
  source_citations: string[]
  /** 신뢰도 점수 (0.0 ~ 1.0) */
  confidence_score?: number
}

// =============================================================================
// [P2-04] Template Schema V2 (Lineage 추적 포함)
// =============================================================================

/**
 * Gate-Keeper 검증 결과
 * @description 템플릿 생성 시 수행되는 검증 결과
 */
export interface GateKeeperResult {
  /** Citation Gate: 원문 인용 검증 */
  citation_passed: boolean
  /** Consistency Gate: 규칙 간 일관성 검증 */
  consistency_passed: boolean
  /** Hallucination Gate: 환각 검증 */
  hallucination_passed: boolean
}

/**
 * [P2-04] Template Schema V2 (Lineage 추적 포함)
 * @version 2.0.0
 * @description TemplateSchema의 확장 버전, 원본 추적 및 검증 결과 포함
 */
export interface TemplateSchemaV2 extends TemplateSchema {
  // ---------------------------------------------------------------------------
  // Lineage (원본 추적)
  // ---------------------------------------------------------------------------
  /** 원본 규칙 ID (rag_rules.id) */
  source_rule_id?: string
  /** 원본 청크 ID 목록 (rag_chunks.id[]) */
  source_chunk_ids?: string[]

  // ---------------------------------------------------------------------------
  // Gate-Keeper 검증 결과
  // ---------------------------------------------------------------------------
  /** Gate-Keeper 검증 결과 */
  gate_results?: GateKeeperResult

  // ---------------------------------------------------------------------------
  // 생성 메타데이터
  // ---------------------------------------------------------------------------
  /** 생성 방법 */
  created_by?: 'llm' | 'manual' | 'migration'
  /** 사용된 LLM 모델 */
  model_used?: string
}

// =============================================================================
// 2. Template Entity (DB 구조)
// =============================================================================

/** 템플릿 상태 */
export type TemplateStatus = 'draft' | 'pending' | 'approved' | 'rejected'

/**
 * 템플릿 엔티티 (DB Row)
 * @description
 * rag_templates 테이블의 레코드와 매핑됩니다.
 */
export interface Template {
  /** 템플릿 ID (UUID) */
  id: string
  /** 테넌트 ID */
  tenant_id: string
  /** 원본 문서 ID (Optional) */
  document_id?: string
  /** 템플릿 이름 */
  name: string
  /** 템플릿 설명 */
  description?: string
  /** 버전 (기본값: 1) */
  version: number
  /** 상태 */
  status: TemplateStatus
  /** 공개 여부 */
  is_public: boolean
  /** 평가 기준 목록 (JSONB) */
  criteria_json: TemplateSchema[]
  /** 생성 일시 */
  created_at: string
  /** 승인 일시 */
  approved_at?: string
  /** 승인자 ID */
  approved_by?: string
  /** 거절 사유 */
  rejection_reason?: string
}

// =============================================================================
// 3. Builder Result
// =============================================================================

/**
 * 템플릿 빌더 결과
 * @description
 * TemplateBuilder.build() 메서드의 반환값입니다.
 */
export interface TemplateBuilderResult {
  /** 성공 여부 */
  success: boolean
  /** 생성된 템플릿 (성공 시) */
  template?: Template
  /** 에러 메시지 (실패 시) */
  error?: string
  /** 처리 단계별 로그 (디버깅용) */
  logs?: string[]
}

// =============================================================================
// 4. Zod Validators (Runtime Validation)
// =============================================================================

/** TemplateSchema 검증기 */
export const templateSchemaValidator = z.object({
  criteria_id: z.string().uuid({ message: '유효하지 않은 기준 ID입니다.' }),
  category: z.enum(['tone', 'structure', 'expression', 'prohibition']),
  rationale: z.string().min(1, { message: '근거(rationale)는 필수입니다.' }),
  positive_examples: z.array(z.string()).min(1, { message: '최소 1개의 긍정 예시가 필요합니다.' }),
  negative_examples: z.array(z.string()).min(1, { message: '최소 1개의 부정 예시가 필요합니다.' }),
  remediation_steps: z.array(z.string()).min(1, { message: '최소 1개의 수정 단계가 필요합니다.' }),
  source_citations: z.array(z.string()),
  confidence_score: z.number().min(0).max(1).optional(),
})

/** Template 검증기 (DB 저장 전 검증용) */
export const templateValidator = z.object({
  name: z.string().min(1, { message: '템플릿 이름은 필수입니다.' }),
  version: z.number().int().positive(),
  status: z.enum(['draft', 'pending', 'approved', 'rejected']),
  criteria_json: z.array(templateSchemaValidator).min(1, { message: '최소 1개의 평가 기준이 필요합니다.' }),
})
