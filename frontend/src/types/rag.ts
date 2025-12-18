// =============================================================================
// PRISM Writer - RAG Types
// =============================================================================
// 파일: frontend/src/types/rag.ts
// 역할: RAG 시스템 관련 타입 정의
// =============================================================================

// =============================================================================
// ACL (Access Control List) 관련 타입
// =============================================================================

/**
 * ACL 필터 인터페이스
 * 
 * @description
 * 검색 시 사용자 권한을 검증하기 위한 필터 옵션
 */
export interface ACLFilter {
  /** 사용자 ID (필수) */
  userId: string
  /** 네임스페이스 필터 (옵션) */
  namespaces?: string[]
  /** 문서 ID 필터 (옵션) */
  documentIds?: string[]
  /** 관리자 여부 (옵션) - true면 모든 문서 접근 가능 */
  isAdmin?: boolean
}

/**
 * ACL 검증 결과 인터페이스
 * 
 * @description
 * validateACL 함수의 반환 타입
 */
export interface ACLValidationResult {
  /** 검증 성공 여부 */
  valid: boolean
  /** 접근 가능한 문서 ID 목록 */
  allowedDocumentIds: string[]
  /** 에러 메시지 (검증 실패 시) */
  error?: string
}

// =============================================================================
// 검색 관련 타입 (추후 확장용)
// =============================================================================

/**
 * RAG 청크 메타데이터
 */
export interface ChunkMetadata {
  /** 섹션 제목 */
  sectionTitle?: string
  /** 페이지 번호 */
  pageNumber?: number
  /** 토큰 수 */
  tokenCount?: number
  /** 임베딩 모델 ID */
  embeddingModelId?: string
}

// =============================================================================
// Judge Contract 관련 타입 (Phase 3)
// =============================================================================

/**
 * Judge 판정 결과 타입
 * 
 * @description
 * - pass: 충분한 근거로 질문에 답변 가능
 * - fail: 근거가 질문과 맞지 않음
 * - insufficient_evidence: 근거가 부족함
 */
export type JudgeVerdict = 'pass' | 'fail' | 'insufficient_evidence'

/**
 * Judge 근거 인터페이스
 * 
 * @description
 * LLM이 답변에 사용한 근거(인용문) 정보
 */
export interface JudgeEvidence {
  /** 청크 ID */
  chunkId: string
  /** 실제 인용문 */
  quote: string
  /** 관련성 점수 (0~1) */
  relevance: number
}

/**
 * Judge 판정 결과 인터페이스
 * 
 * @description
 * LLM의 답변 품질 평가 결과
 */
export interface JudgeResult {
  /** 판정 결과 */
  verdict: JudgeVerdict
  /** 점수 (0~100) */
  score: number
  /** 사용된 근거 목록 */
  evidence: JudgeEvidence[]
  /** 판정 이유 */
  reasoning: string
  /** 부족한 근거 목록 (옵션) */
  missingEvidence?: string[]
}

// =============================================================================
// Reviewer 관련 타입 (P1 Phase 1)
// =============================================================================

/**
 * Reviewer 배지 타입
 * 
 * @description
 * - ✅: 검증됨 (신뢰도 높음)
 * - ⚠️: 주의 필요 (일부 이슈 있음)
 * - ⛔: 거부 (환각 또는 오류 감지)
 */
export type ReviewBadge = '✅' | '⚠️' | '⛔'

/**
 * Reviewer 결과 인터페이스
 * 
 * @description
 * Reviewer 모델의 검토 결과
 */
export interface ReviewResult {
  /** 검토 배지 */
  badge: ReviewBadge
  /** 신뢰도 점수 (0~1) */
  confidence: number
  /** 발견된 이슈 목록 (옵션) */
  issues?: string[]
  /** 검토 이유 */
  reasoning: string
}
