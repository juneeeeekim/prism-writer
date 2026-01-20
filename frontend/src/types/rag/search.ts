// =============================================================================
// PRISM Writer - RAG Search Types
// =============================================================================
// 파일: frontend/src/types/rag/search.ts
// 역할: 검색/ACL/Evidence 관련 타입 정의
// 리팩토링: 2026-01-20
// =============================================================================

// =============================================================================
// ACL Types
// =============================================================================

export interface ACLFilter {
  userId: string
  namespaces?: string[]
  documentIds?: string[]
  isAdmin?: boolean
}

export interface ACLValidationResult {
  valid: boolean
  allowedDocumentIds: string[]
  error?: string
}

// =============================================================================
// Score Components
// =============================================================================

export interface ScoreComponents {
  bm25: number
  vector: number
  rerank: number
}

// =============================================================================
// Evidence Types
// =============================================================================

export interface EvidenceItem {
  chunkId: string
  documentId: string
  content: string
  spanOffsets: { start: number; end: number }
  sourceUri: string
  namespace: string
  docVersion: string
  scoreComponents: ScoreComponents
}

export interface EvidenceMetadata {
  searchQuery: string
  retrievalConfigId: string
  embeddingModelId: string
  totalCandidates: number
  selectedCount: number
  createdAt: string
}

export interface EvidencePack {
  runId: string
  rubricId?: string
  items: EvidenceItem[]
  metadata: EvidenceMetadata
}

// =============================================================================
// Evidence Quality
// =============================================================================

export enum EvidenceQualityGrade {
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low'
}

export interface EvidenceQuality {
  grade: EvidenceQualityGrade
  score: number
  factors: {
    relevance: number
    recency?: number
    authority?: number
  }
}
