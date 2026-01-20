// =============================================================================
// PRISM Writer - RAG Document Types
// =============================================================================
// 파일: frontend/src/types/rag/document.ts
// 역할: 문서 관련 타입 정의 (Status, DB Entities)
// 리팩토링: 2026-01-20
// =============================================================================

// =============================================================================
// Document Status
// =============================================================================

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
// Chunk Metadata
// =============================================================================

export interface ChunkMetadata {
  sectionTitle?: string
  pageNumber?: number
  tokenCount?: number
  embeddingModelId?: string
}

// =============================================================================
// DB Entity Types
// =============================================================================

export interface RagChunk {
  id: string
  document_id: string
  chunk_index: number
  content: string
  embedding?: number[]
  metadata: ChunkMetadata
  created_at: string
  embedding_model_id?: string
  embedding_dim?: number
  embedded_at?: string
  tenant_id?: string
  chunk_type?: string
}

export interface UserDocument {
  id: string
  user_id: string
  title: string
  content: string
  created_at: string
  updated_at: string
  category?: string
  sort_order?: number
  metadata?: Record<string, unknown>
  source?: string
  file_path?: string
  file_type?: string
  status?: string
  error_message?: string
  file_size?: number
  started_at?: string
}

// =============================================================================
// RPC Types
// =============================================================================

export interface MatchDocumentChunksParams {
  query_embedding: number[]
  match_threshold: number
  match_count: number
  user_id_param: string
  category_param?: string
}

export interface MatchDocumentChunksResult {
  id: string
  document_id: string
  content: string
  metadata: Record<string, unknown>
  similarity: number
}
