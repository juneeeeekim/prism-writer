// =============================================================================
// PRISM Writer - RAG Types Barrel Export
// =============================================================================
// 파일: frontend/src/lib/rag/types/index.ts
// 역할: RAG 타입들을 통합 export하여 import 단순화
// 생성일: 2025-12-25
// =============================================================================

// Patch System Types (Pipeline v5)
export type {
  PatchType,
  AlignmentDelta,
  Patch,
  GapItem,
  ChangePlan,
  SimulationResult,
  PatchEnabledEvaluationResult,
} from './patch'

// Adapter Functions
export {
  adaptToV5Result,
  extractLegacyResult,
  isV5Result,
} from './patch'

// Re-export Judge Types for convenience
export type {
  JudgeResult,
  UpgradePlan,
  EvaluationResult,
} from '@/lib/judge/types'
