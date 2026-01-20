// =============================================================================
// PRISM Writer - RAG Template Types
// =============================================================================
// 파일: frontend/src/types/rag/template.ts
// 역할: Template Builder 관련 타입 정의
// 리팩토링: 2026-01-20
// =============================================================================

// =============================================================================
// Enums & Base Types
// =============================================================================

export type RuleCategory = 'structure' | 'expression' | 'tone' | 'prohibition'
export type ExtractionMethod = 'llm' | 'manual' | 'rule-based'
export type ExampleType = 'positive' | 'negative'
export type ExampleSourceType = 'mined' | 'generated' | 'manual'
export type RagTemplateStatus = 'draft' | 'pending' | 'approved' | 'rejected'

// =============================================================================
// Entity Types
// =============================================================================

export interface RagRule {
  id: string
  document_id?: string
  chunk_id?: string
  user_id: string
  rule_text: string
  category: RuleCategory
  confidence: number
  source_quote?: string
  extraction_method: ExtractionMethod
  metadata?: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface RagExample {
  id: string
  rule_id: string
  user_id: string
  example_type: ExampleType
  example_text: string
  diff_hint?: string
  source_type: ExampleSourceType
  source_chunk_id?: string
  confidence: number
  metadata?: Record<string, unknown>
  created_at: string
}

export interface RagTemplate {
  id: string
  tenant_id?: string
  user_id: string
  document_id?: string
  name: string
  description?: string
  version: number
  status: RagTemplateStatus
  is_public: boolean
  criteria_json: unknown[]
  approved_at?: string
  approved_by?: string
  rejection_reason?: string
  created_at: string
  updated_at: string
}
