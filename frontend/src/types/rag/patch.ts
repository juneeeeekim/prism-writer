// =============================================================================
// PRISM Writer - RAG Patch Types
// =============================================================================
// 파일: frontend/src/types/rag/patch.ts
// 역할: Patch Staging 관련 타입 정의
// 리팩토링: 2026-01-20
// =============================================================================

export type PatchStage = 'core' | 'expression' | 'detail'

export interface StagedPatch {
  id: string
  stage: PatchStage
  description: string
  originalText: string
  patchedText: string
  status: 'pending' | 'accepted' | 'rejected'
  reasoning?: string
}

export interface PatchGroup {
  stage: PatchStage
  patches: StagedPatch[]
  isExpanded: boolean
}
