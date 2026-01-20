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
  type PromptContext,
} from './promptBuilder'
