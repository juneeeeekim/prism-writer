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

// =============================================================================
// [P-B03-01] Intersection Observer 훅 export
// 무한 스크롤, 레이지 로딩, 요소 가시성 추적에 활용
// =============================================================================
export { useIntersectionObserver, default as useIntersectionObserverDefault } from './useIntersectionObserver'
export type { UseIntersectionObserverOptions, UseIntersectionObserverReturn } from './useIntersectionObserver'

// =============================================================================
// [REFACTOR] 평가 비즈니스 로직 훅
// =============================================================================
export { useEvaluation } from './useEvaluation'
export type { SavedEvaluation, UseEvaluationReturn } from './useEvaluation'

// =============================================================================
// [REFACTOR] 채팅 비즈니스 로직 훅
// =============================================================================
export { useChat } from './useChat'
export type { UseChatOptions, UseChatReturn } from './useChat'

