// =============================================================================
// PRISM Writer - RAG Judge Types
// =============================================================================
// 파일: frontend/src/types/rag/judge.ts
// 역할: Judge/Reviewer 관련 타입 정의
// 리팩토링: 2026-01-20
// =============================================================================

// =============================================================================
// Judge Types
// =============================================================================

export type JudgeVerdict = 'pass' | 'fail' | 'insufficient_evidence'

export interface JudgeEvidence {
  chunkId: string
  quote: string
  relevance: number
}

export interface JudgeResult {
  verdict: JudgeVerdict
  score: number
  evidence: JudgeEvidence[]
  reasoning: string
  missingEvidence?: string[]
}

// =============================================================================
// Reviewer Types
// =============================================================================

export type ReviewBadge = '✅' | '⚠️' | '⛔'

export interface ReviewResult {
  badge: ReviewBadge
  confidence: number
  issues?: string[]
  reasoning: string
}
