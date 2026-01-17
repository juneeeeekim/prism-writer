// =============================================================================
// PRISM Writer - Search Module (Backward Compatibility Barrel)
// =============================================================================
// 파일: frontend/src/lib/rag/search.ts
// 역할: 기존 import 경로 호환성 유지를 위한 re-export
// 
// ⚠️ 중요: 이 파일은 하위 호환성을 위해 유지됩니다.
// 모든 실제 구현은 ./search/ 디렉토리에 있습니다.
// 
// 📌 사용법 (기존과 동일):
//   import { hybridSearch, vectorSearch, SearchResult } from '@/lib/rag/search'
// 
// 리팩토링 완료: 2026-01-17
// - 원본 파일: 1431줄 → 현재: ~20줄 (Re-export only)
// - 모듈 분리: types, utils, logger, vector, keyword, pattern, hybrid, wrapper
// =============================================================================

// Re-export all from new modular structure for backward compatibility
export * from './search/index'
