// =============================================================================
// PRISM Writer - RAG Types Index
// =============================================================================
// 파일: frontend/src/types/rag/index.ts
// 역할: RAG 타입 re-export
// 리팩토링: 2026-01-20
// =============================================================================

// Document Types
export {
  DocumentStatus,
  type ChunkMetadata,
  type RagChunk,
  type UserDocument,
  type MatchDocumentChunksParams,
  type MatchDocumentChunksResult,
} from './document'

// Search Types
export {
  type ACLFilter,
  type ACLValidationResult,
  type ScoreComponents,
  type EvidenceItem,
  type EvidenceMetadata,
  type EvidencePack,
  EvidenceQualityGrade,
  type EvidenceQuality,
} from './search'

// Judge Types
export {
  type JudgeVerdict,
  type JudgeEvidence,
  type JudgeResult,
  type ReviewBadge,
  type ReviewResult,
} from './judge'

// Router Types
export {
  type RouterMode,
  type RouterConfig,
  ROUTER_CONFIGS,
} from './router'

// Patch Types
export {
  type PatchStage,
  type StagedPatch,
  type PatchGroup,
} from './patch'

// Template Types
export {
  type RuleCategory,
  type ExtractionMethod,
  type ExampleType,
  type ExampleSourceType,
  type RagTemplateStatus,
  type RagRule,
  type RagExample,
  type RagTemplate,
} from './template'

// Criteria Types
export {
  type RetrievedChunk,
  type CriteriaPackQueries,
  type CriteriaPackEvidence,
  type CriteriaPackGates,
  type CriteriaPackMetadata,
  type CriteriaPackV2,
  createDefaultCriteriaPackV2,
} from './criteria'
