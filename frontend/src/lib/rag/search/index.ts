// =============================================================================
// PRISM Writer - Search Module Entry Point (Barrel File)
// =============================================================================
// 파일: frontend/src/lib/rag/search/index.ts
// 역할: 모든 검색 모듈 public API를 re-export (Barrel File 패턴)
// 생성일: 2026-01-17 (리팩토링)
// 
// 📌 사용법: 
//   import { hybridSearch, vectorSearch, SearchResult } from '@/lib/rag/search'
// 
// ⚠️ 주의: 순환 참조 방지를 위해 import 순서가 중요합니다.
//    types → utils → logger → vector → keyword → pattern → hybrid → wrapper
// =============================================================================

// =============================================================================
// [SECTION 1] 타입 정의 (Types)
// =============================================================================
export type {
  RAGLogEntry,
  SearchResult,
  Chunk,
  SearchOptions,
  HybridSearchOptions,
  PatternSearchOptions,
  SearchByPatternOptions,
} from './types'

// =============================================================================
// [SECTION 2] 유틸리티 함수 및 상수 (Utils)
// =============================================================================
export {
  // 상수
  RRF_K,
  DEFAULT_TOP_K,
  DEFAULT_VECTOR_WEIGHT,
  DEFAULT_KEYWORD_WEIGHT,
  MAX_RETRY_COUNT,
  INITIAL_BACKOFF_MS,
  EMBEDDING_DIMENSION,
  // 함수
  withRetry,
  calculateEvidenceQuality,
  calculateEvidenceQualityBatch,
  weightedScoreFusion,
  reciprocalRankFusion,
} from './utils'

// =============================================================================
// [SECTION 3] 로거 (Logger)
// =============================================================================
export { logRAGSearch } from './logger'

// =============================================================================
// [SECTION 4] 검색 함수 (Search Functions)
// =============================================================================
// 벡터 검색
export { vectorSearch } from './vector'

// 키워드 검색
export { fullTextSearch, fullTextSearchWithRank } from './keyword'

// 패턴 검색 (구현체)
export { patternBasedSearch } from './pattern'

// 하이브리드 검색 (통합)
export { hybridSearch, searchCache } from './hybrid'

// 패턴 검색 래퍼
export { searchByPattern } from './wrapper'
