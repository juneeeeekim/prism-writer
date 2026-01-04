// =============================================================================
// PRISM Writer - Hooks Index
// =============================================================================
// 파일: frontend/src/hooks/index.ts
// 역할: 커스텀 훅 export 통합
// =============================================================================

export { useAuth, default as useAuthDefault } from './useAuth'
export { useLLMUsage, default as useLLMUsageDefault } from './useLLMUsage'
export { useAssistantSessions } from './useAssistantSessions'
// =============================================================================
// [P-A05-01] 검색 히스토리 훅 export
// =============================================================================
export { useSearchHistory, default as useSearchHistoryDefault } from './useSearchHistory'
export type { SearchHistoryItem, UseSearchHistoryReturn } from './useSearchHistory'

