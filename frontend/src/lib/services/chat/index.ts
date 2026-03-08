// =============================================================================
// PRISM Writer - Chat Services Index
// =============================================================================

export {
  saveMessageWithRetry,
  searchUserPreferences,
  formatUserPreferences,
  searchTemplateContext,
  touchSession,
  shouldRunLazySelfRAG,
} from './chatService'

export { performRAGSearch, type RAGSearchResult, type RAGSearchOptions } from './ragSearchService'

export {
  buildSystemPrompt,
  buildFullPrompt,
  buildImprovedSystemPrompt,
  buildLegacySystemPrompt,
  formatWebContext,
  type PromptContext,
} from './promptBuilder'

export { performWebSearch, shouldPerformWebSearch } from './webSearchService'
export type { WebSearchResult, WebSearchOptions } from './webSearchService'
