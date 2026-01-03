// 역할: RAG 시스템 관련 타입 정의
// =============================================================================

import { getDefaultModelId } from '@/config/models'
import { getModelForUsage } from '@/config/llm-usage-map'

// =============================================================================
// 문서 상태 관련 타입 (Phase 1: Foundation)
// =============================================================================

/**
 * 문서 처리 상태 Enum
 *
 * @description
 * RAG 문서 처리 파이프라인의 각 단계를 정의합니다.
 * - PENDING: 업로드 완료, 처리 대기 (DB 초기값)
 * - QUEUED: 대기열 등록 (레거시 호환)
 * - PARSING: 텍스트 추출 중
 * - CHUNKING: 청킹 중
 * - EMBEDDING: 임베딩 생성 중
 * - COMPLETED: 완료
 * - FAILED: 실패
 *
 * @updated 2026-01-01 - [P9-CRON] PENDING 상태 추가, Cron 처리 지원
 */
export enum DocumentStatus {
  PENDING = 'pending',
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
  // 주석(중앙화 마이그레이션): getModelForUsage 적용 (2025-12-28)
  const premiumModel = getModelForUsage('premium.answer')

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

// =============================================================================
// Patch Staging 관련 타입 (P1 Phase 2)
// =============================================================================

/**
 * 패치 단계 Enum
 * 
 * @description
 * - core: 핵심 수정 (사실 관계, 주요 논리)
 * - expression: 표현/톤 수정 (문체, 어조)
 * - detail: 디테일 수정 (맞춤법, 서식)
 */
export type PatchStage = 'core' | 'expression' | 'detail'

/**
 * 단계별 패치 인터페이스
 */
export interface StagedPatch {
  id: string
  stage: PatchStage
  description: string
  originalText: string
  patchedText: string
  status: 'pending' | 'accepted' | 'rejected'
  reasoning?: string
}

/**
 * 패치 그룹 인터페이스
 */
export interface PatchGroup {
  stage: PatchStage
  patches: StagedPatch[]
  isExpanded: boolean
}

// =============================================================================
// Evidence Quality 관련 타입 (P1 Phase 3)
// =============================================================================

/**
 * 근거 품질 등급 Enum
 */
export enum EvidenceQualityGrade {
  HIGH = 'high',     // 신뢰도 높음
  MEDIUM = 'medium', // 보통
  LOW = 'low'        // 낮음 (검증 필요)
}

/**
 * 근거 품질 인터페이스
 */
export interface EvidenceQuality {
  grade: EvidenceQualityGrade
  score: number      // 0~100
  factors: {
    relevance: number    // 관련성
    recency?: number     // 최신성
    authority?: number   // 권위/출처 신뢰도
  }
}

// =============================================================================
// [P1-03] RPC 함수 계약 타입 (API 계약 - 변경 금지)
// =============================================================================

/**
 * [P1-03] RPC match_document_chunks 입력 파라미터
 * @version 1.0.0
 * @frozen 이 인터페이스는 API 계약으로 고정됨 - 변경 금지
 */
export interface MatchDocumentChunksParams {
  /** 쿼리 임베딩 벡터 (1536 dimensions) */
  query_embedding: number[]
  /** 유사도 임계값 (0.0 ~ 1.0) */
  match_threshold: number
  /** 반환할 최대 청크 수 (Top-K) */
  match_count: number
  /** 사용자 ID (UUID) */
  user_id_param: string
  /** 카테고리 필터 (옵션) */
  category_param?: string
}

/**
 * [P1-03] RPC match_document_chunks 반환 타입
 * @version 1.0.0
 * @frozen 이 인터페이스는 API 계약으로 고정됨 - 변경 금지
 */
export interface MatchDocumentChunksResult {
  /** 청크 UUID */
  id: string
  /** 문서 UUID (Required) */
  document_id: string
  /** 청크 텍스트 내용 */
  content: string
  /** 메타데이터 (JSONB) */
  metadata: Record<string, unknown>
  /** 유사도 점수 (0.0 ~ 1.0) */
  similarity: number
}

// =============================================================================
// [P1-04] DB 스키마 동기화 타입
// =============================================================================

/**
 * [P1-04] RAG Chunk 타입 (DB 스키마와 동기화)
 * @description rag_chunks 테이블과 1:1 매핑
 */
export interface RagChunk {
  /** 청크 UUID */
  id: string
  /** 문서 UUID (FK → user_documents) */
  document_id: string
  /** 청크 순서 (0부터 시작) */
  chunk_index: number
  /** 청크 텍스트 내용 */
  content: string
  /** 임베딩 벡터 (Optional - 대용량) */
  embedding?: number[]
  /** 메타데이터 */
  metadata: ChunkMetadata
  /** 생성일 */
  created_at: string
  /** 임베딩 모델 ID */
  embedding_model_id?: string
  /** 임베딩 차원 */
  embedding_dim?: number
  /** 임베딩 생성일 */
  embedded_at?: string
  /** 테넌트 ID (옵션) */
  tenant_id?: string
  /** 청크 타입 */
  chunk_type?: string
}

/**
 * [P1-04] User Document 타입 (DB 스키마와 동기화)
 * @description user_documents 테이블과 1:1 매핑
 */
export interface UserDocument {
  /** 문서 UUID */
  id: string
  /** 사용자 UUID (FK → auth.users) */
  user_id: string
  /** 문서 제목 */
  title: string
  /** 문서 내용 */
  content: string
  /** 생성일 */
  created_at: string
  /** 수정일 */
  updated_at: string
  /** 카테고리 */
  category?: string
  /** 정렬 순서 */
  sort_order?: number
  /** 메타데이터 */
  metadata?: Record<string, unknown>
  /** 소스 (upload, etc.) */
  source?: string
  /** 파일 경로 */
  file_path?: string
  /** 파일 타입 */
  file_type?: string
  /** 처리 상태 */
  status?: string
  /** 에러 메시지 */
  error_message?: string
  /** 파일 크기 (bytes) */
  file_size?: number
  /** 처리 시작 시간 */
  started_at?: string
}

// =============================================================================
// [P2-05] Phase 2 DB 엔티티 타입 (Template Builder)
// =============================================================================

/** 규칙 카테고리 타입 */
export type RuleCategory = 'structure' | 'expression' | 'tone' | 'prohibition'

/** 규칙 추출 방법 */
export type ExtractionMethod = 'llm' | 'manual' | 'rule-based'

/** 예시 타입 */
export type ExampleType = 'positive' | 'negative'

/** 예시 소스 타입 */
export type ExampleSourceType = 'mined' | 'generated' | 'manual'

/** 템플릿 상태 */
export type RagTemplateStatus = 'draft' | 'pending' | 'approved' | 'rejected'

/**
 * [P2-05] RAG Rule 엔티티 (rag_rules 테이블)
 * @description 문서에서 추출된 원자적 규칙
 */
export interface RagRule {
  /** 규칙 UUID */
  id: string
  /** 원본 문서 ID (FK → user_documents) */
  document_id?: string
  /** 원본 청크 ID (FK → rag_chunks) */
  chunk_id?: string
  /** 사용자 ID (FK → auth.users) */
  user_id: string
  /** 규칙 텍스트 */
  rule_text: string
  /** 카테고리 */
  category: RuleCategory
  /** 추출 신뢰도 (0.0 ~ 1.0) */
  confidence: number
  /** 원문 인용 */
  source_quote?: string
  /** 추출 방법 */
  extraction_method: ExtractionMethod
  /** 메타데이터 */
  metadata?: Record<string, unknown>
  /** 생성일 */
  created_at: string
  /** 수정일 */
  updated_at: string
}

/**
 * [P2-05] RAG Example 엔티티 (rag_examples 테이블)
 * @description 좋은/나쁜 예시
 */
export interface RagExample {
  /** 예시 UUID */
  id: string
  /** 규칙 ID (FK → rag_rules) */
  rule_id: string
  /** 사용자 ID (FK → auth.users) */
  user_id: string
  /** 예시 유형 */
  example_type: ExampleType
  /** 예시 텍스트 */
  example_text: string
  /** 나쁜 예 → 좋은 예 힌트 */
  diff_hint?: string
  /** 소스 타입 */
  source_type: ExampleSourceType
  /** 소스 청크 ID (FK → rag_chunks) */
  source_chunk_id?: string
  /** 신뢰도 (0.0 ~ 1.0) */
  confidence: number
  /** 메타데이터 */
  metadata?: Record<string, unknown>
  /** 생성일 */
  created_at: string
}

/**
 * [P2-05] RAG Template 엔티티 (rag_templates 테이블)
 * @description 최종 평가 템플릿
 */
export interface RagTemplate {
  /** 템플릿 UUID */
  id: string
  /** 테넌트 ID */
  tenant_id?: string
  /** 사용자 ID (FK → auth.users) */
  user_id: string
  /** 원본 문서 ID (FK → user_documents) */
  document_id?: string
  /** 템플릿 이름 */
  name: string
  /** 템플릿 설명 */
  description?: string
  /** 버전 */
  version: number
  /** 상태 */
  status: RagTemplateStatus
  /** 공개 여부 */
  is_public: boolean
  /** 평가 기준 JSON (TemplateSchemaV2[]) */
  criteria_json: unknown[]
  /** 승인일 */
  approved_at?: string
  /** 승인자 ID */
  approved_by?: string
  /** 거절 사유 */
  rejection_reason?: string
  /** 생성일 */
  created_at: string
  /** 수정일 */
  updated_at: string
}

// =============================================================================
// [R-07] Criteria Pack 관련 타입 (Retrieval Pipeline v2)
// =============================================================================

/**
 * [R-07] 검색된 청크 인터페이스
 * 
 * @description
 * hybridSearch 또는 패턴 검색에서 반환된 개별 청크 정보입니다.
 * CriteriaPack의 evidence 필드에 저장됩니다.
 */
export interface RetrievedChunk {
  /** 청크 ID */
  chunk_id: string
  /** 청크 내용 */
  content: string
  /** 유사도 점수 (0.0 ~ 1.0) */
  score: number
  /** 출처 정보 */
  source: {
    /** 문서 ID */
    document_id: string
    /** 페이지 번호 (옵션) */
    page?: number
    /** 섹션명 (옵션) */
    section?: string
  }
}

/**
 * [R-07] 검색 쿼리 정보 인터페이스
 * 
 * @description
 * Query Builder가 생성한 3종 쿼리 정보입니다.
 */
export interface CriteriaPackQueries {
  /** 규칙 검색 쿼리 */
  rule_query: string
  /** 예시 검색 쿼리 */
  example_query: string
  /** 패턴 검색 쿼리 */
  pattern_query: string
}

/**
 * [R-07] 검색된 근거 인터페이스
 * 
 * @description
 * 각 쿼리 타입별 검색 결과를 구조화합니다.
 */
export interface CriteriaPackEvidence {
  /** 규칙 청크 목록 (기본값: []) */
  rules: RetrievedChunk[]
  /** 예시 청크 목록 (기본값: []) */
  examples: RetrievedChunk[]
  /** 패턴 청크 목록 (기본값: []) */
  patterns: RetrievedChunk[]
}

/**
 * [R-07] 게이트 결과 인터페이스
 * 
 * @description
 * Citation Gate와 Sufficiency Gate의 검증 결과입니다.
 */
export interface CriteriaPackGates {
  /** Citation Gate 검증 결과 (기본값: false) */
  citation_verified: boolean
  /** Sufficiency Gate 검증 결과 (기본값: false) */
  retrieval_sufficient: boolean
}

/**
 * [R-07] 메타데이터 인터페이스
 * 
 * @description
 * CriteriaPack 생성 관련 메타데이터입니다.
 */
export interface CriteriaPackMetadata {
  /** 생성 시간 (ISO 8601) */
  created_at: string
  /** 검색 소요 시간 (밀리초) */
  search_duration_ms: number
}

/**
 * [R-07] Judge에 전달할 구조화된 근거 패키지
 * 
 * @description
 * Retrieval Pipeline v2에서 사용하는 확장된 CriteriaPack입니다.
 * Query Builder → 검색 → Gate 검증을 거쳐 Judge에 전달됩니다.
 * 
 * @example
 * ```typescript
 * const criteriaPack: CriteriaPackV2 = {
 *   criteria_id: 'rubric-001',
 *   queries: {
 *     rule_query: '서론의 흡입력 규칙 정의',
 *     example_query: '서론의 흡입력 좋은 예시',
 *     pattern_query: '훅 문장 패턴'
 *   },
 *   evidence: {
 *     rules: [],
 *     examples: [],
 *     patterns: []
 *   },
 *   gates: {
 *     citation_verified: false,
 *     retrieval_sufficient: false
 *   },
 *   metadata: {
 *     created_at: new Date().toISOString(),
 *     search_duration_ms: 0
 *   }
 * }
 * ```
 */
export interface CriteriaPackV2 {
  /** 루브릭(평가 기준) ID */
  criteria_id: string
  
  /** 검색 쿼리 정보 */
  queries: CriteriaPackQueries
  
  /** 검색된 근거 */
  evidence: CriteriaPackEvidence
  
  /** 게이트 결과 */
  gates: CriteriaPackGates
  
  /** 메타데이터 */
  metadata: CriteriaPackMetadata
}

// =============================================================================
// [R-07] CriteriaPack 헬퍼 함수
// =============================================================================

/**
 * [R-07] 기본 CriteriaPackV2 생성
 * 
 * @description
 * 모든 배열 필드와 gates에 안전한 기본값이 설정된 CriteriaPackV2를 생성합니다.
 * 
 * @param criteriaId - 루브릭 ID
 * @returns 기본값이 설정된 CriteriaPackV2
 */
export function createDefaultCriteriaPackV2(criteriaId: string): CriteriaPackV2 {
  return {
    criteria_id: criteriaId,
    queries: {
      rule_query: '',
      example_query: '',
      pattern_query: '',
    },
    evidence: {
      rules: [],
      examples: [],
      patterns: [],
    },
    gates: {
      citation_verified: false,
      retrieval_sufficient: false,
    },
    metadata: {
      created_at: new Date().toISOString(),
      search_duration_ms: 0,
    },
  }
}
