// 역할: RAG 시스템 관련 타입 정의
// =============================================================================

import { getDefaultModelId } from '@/config/models'

// =============================================================================
// 문서 상태 관련 타입 (Phase 1: Foundation)
// =============================================================================

/**
 * 문서 처리 상태 Enum
 * 
 * @description
 * RAG 문서 처리 파이프라인의 각 단계를 정의합니다.
 * - QUEUED: 대기열 등록 (기존 pending)
 * - PARSING: 텍스트 추출 중 (기존 processing 세분화)
 * - CHUNKING: 청킹 중 (기존 processing 세분화)
 * - EMBEDDING: 임베딩 생성 중 (기존 processing 세분화)
 * - COMPLETED: 완료 (기존 ready)
 * - FAILED: 실패 (기존 error)
 */
export enum DocumentStatus {
  QUEUED = 'queued',
  PARSING = 'processing_parsing',
  CHUNKING = 'processing_chunking',
  EMBEDDING = 'processing_embedding',
  COMPLETED = 'completed',
  FAILED = 'failed'
}

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

// =============================================================================
// Model Router 관련 타입 (P1 Phase 2)
// =============================================================================

/**
 * Router 모드 타입
 * 
 * @description
 * - cheap: 경제 모드 (빠름, Reviewer 없음)
 * - standard: 표준 모드 (균형)
 * - strict: 정밀 모드 (느림, 고품질)
 */
export type RouterMode = 'cheap' | 'standard' | 'strict'

/**
 * Router 구성 인터페이스
 * 
 * @description
 * 각 모드별 LLM 호출 설정
 */
export interface RouterConfig {
  /** 모드 식별자 */
  mode: RouterMode
  /** 답변 생성 모델 */
  answerModel: string
  /** Reviewer 모델 (null = 비활성화) */
  reviewerModel: string | null
  /** 최대 토큰 수 */
  maxTokens: number
  /** 타임아웃 (밀리초) */
  timeout: number
}

/**
 * 모드별 Router 설정
 * 
 * @description
 * - cheap: 빠른 응답, Reviewer 없음
 * - standard: 균형 잡힌 설정
 * - strict: 최고 품질, 상세 Reviewer
 */
function createRouterConfigs(): Record<RouterMode, RouterConfig> {
  const defaultModel = getDefaultModelId()
  const premiumModel = 'gemini-3-pro-preview'

  return {
    cheap: {
      mode: 'cheap',
      answerModel: defaultModel,
      reviewerModel: null,
      maxTokens: 1000,
      timeout: 10000,
    },
    standard: {
      mode: 'standard',
      answerModel: defaultModel,
      reviewerModel: defaultModel,
      maxTokens: 2000,
      timeout: 15000,
    },
    strict: {
      mode: 'strict',
      answerModel: premiumModel,
      reviewerModel: premiumModel,
      maxTokens: 4000,
      timeout: 30000,
    },
  }
}

export const ROUTER_CONFIGS = createRouterConfigs()

// =============================================================================
// Evidence Pack 관련 타입 (P1 Phase 4)
// =============================================================================

/**
 * 점수 구성 요소
 * 
 * @description
 * 검색 결과의 점수 분해 (디버깅 용이)
 */
export interface ScoreComponents {
  /** BM25 키워드 점수 */
  bm25: number
  /** 벡터 유사도 점수 */
  vector: number
  /** 리랭킹 점수 */
  rerank: number
}

/**
 * 근거 항목 인터페이스
 * 
 * @description
 * 개별 검색 결과를 표준화된 형식으로 표현
 */
export interface EvidenceItem {
  /** 청크 ID */
  chunkId: string
  /** 문서 ID */
  documentId: string
  /** 청크 내용 */
  content: string
  /** 원본 문서 내 위치 */
  spanOffsets: { start: number; end: number }
  /** 원본 문서 URI */
  sourceUri: string
  /** 네임스페이스 */
  namespace: string
  /** 문서 버전 */
  docVersion: string
  /** 점수 구성 요소 */
  scoreComponents: ScoreComponents
}

/**
 * 근거 메타데이터 인터페이스
 * 
 * @description
 * 검색 설정 및 결과 요약 (재현성 보장)
 */
export interface EvidenceMetadata {
  /** 검색 쿼리 */
  searchQuery: string
  /** 검색 설정 ID */
  retrievalConfigId: string
  /** 임베딩 모델 ID */
  embeddingModelId: string
  /** 총 후보 수 */
  totalCandidates: number
  /** 선택된 수 */
  selectedCount: number
  /** 생성 시간 */
  createdAt: string
}

/**
 * Evidence Pack 인터페이스
 * 
 * @description
 * 검색 결과를 표준화된 형식으로 패키징
 * Judge/Reviewer에 전달되는 근거 데이터
 */
export interface EvidencePack {
  /** 실행 ID (Telemetry 연결) */
  runId: string
  /** 평가 기준 ID (옵션) */
  rubricId?: string
  /** 근거 항목 목록 */
  items: EvidenceItem[]
  /** 검색 메타데이터 */
  metadata: EvidenceMetadata
}
