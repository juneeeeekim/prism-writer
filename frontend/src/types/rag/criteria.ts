// =============================================================================
// PRISM Writer - RAG Criteria Pack Types
// =============================================================================
// 파일: frontend/src/types/rag/criteria.ts
// 역할: Criteria Pack 관련 타입 정의 (Retrieval Pipeline v2)
// 리팩토링: 2026-01-20
// =============================================================================

// =============================================================================
// Retrieved Chunk
// =============================================================================

export interface RetrievedChunk {
  chunk_id: string
  content: string
  score: number
  source: {
    document_id: string
    page?: number
    section?: string
  }
}

// =============================================================================
// Criteria Pack Types
// =============================================================================

export interface CriteriaPackQueries {
  rule_query: string
  example_query: string
  pattern_query: string
}

export interface CriteriaPackEvidence {
  rules: RetrievedChunk[]
  examples: RetrievedChunk[]
  patterns: RetrievedChunk[]
}

export interface CriteriaPackGates {
  citation_verified: boolean
  retrieval_sufficient: boolean
}

export interface CriteriaPackMetadata {
  created_at: string
  search_duration_ms: number
}

export interface CriteriaPackV2 {
  criteria_id: string
  queries: CriteriaPackQueries
  evidence: CriteriaPackEvidence
  gates: CriteriaPackGates
  metadata: CriteriaPackMetadata
}

// =============================================================================
// Helper Function
// =============================================================================

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
