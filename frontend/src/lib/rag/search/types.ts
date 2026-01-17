// =============================================================================
// PRISM Writer - Search Module Types
// =============================================================================
// 파일: frontend/src/lib/rag/search/types.ts
// 역할: 검색 모듈에서 사용하는 모든 타입/인터페이스 정의
// 생성일: 2026-01-17 (리팩토링)
// =============================================================================

import { type ChunkType } from '../chunking'
import { type PatternType } from '../patternExtractor'
import { type EvidenceQuality } from '@/types/rag'

// =============================================================================
// [SECTION 1] RAG 로그 타입
// =============================================================================

/**
 * RAG 검색 로그 엔트리 타입
 * @description rag_logs 테이블에 저장되는 검색 메트릭 정보
 */
export interface RAGLogEntry {
  /** 사용자 ID (선택) */
  userId?: string | null
  /** 프로젝트 ID (선택) */
  projectId?: string | null
  /** 검색 쿼리 (100자 제한) */
  query: string
  /** 검색 방법: 'vector' | 'keyword' | 'hybrid' | 'pattern' */
  searchMethod: 'vector' | 'keyword' | 'hybrid' | 'pattern'
  /** 반환된 결과 수 */
  resultCount: number
  /** 최고 유사도 점수 (0.0 ~ 1.0) */
  topScore?: number | null
  /** 총 응답 시간 (ms) */
  latencyMs: number
  /** 임베딩 생성 시간 (ms) */
  embeddingLatencyMs?: number | null
  /** DB 검색 시간 (ms) */
  searchLatencyMs?: number | null
  /** 캐시 사용 여부 */
  cacheHit: boolean
  /** 캐시 키 (디버깅용) */
  cacheKey?: string | null
  /** 에러 메시지 (있는 경우) */
  error?: string | null
  /** 에러 코드 (분류용) */
  errorCode?: string | null
  /** 추가 메타데이터 */
  metadata?: Record<string, unknown>
}

// =============================================================================
// [SECTION 2] 검색 결과 타입
// =============================================================================

/**
 * 검색 결과 아이템
 * @description 벡터/키워드/하이브리드 검색의 반환 타입
 */
export interface SearchResult {
  /** 청크 ID */
  chunkId: string
  /** 문서 ID */
  documentId: string
  /** 청크 내용 */
  content: string
  /** 유사도 점수 */
  score: number
  /** 메타데이터 */
  metadata: Record<string, any>
  /** 근거 품질 (P1-C) */
  quality?: EvidenceQuality
}

/**
 * Chunk 타입 별칭
 * @description SearchResult와 동일 (하위 호환성 유지)
 */
export type Chunk = SearchResult

// =============================================================================
// [SECTION 3] 검색 옵션 타입
// =============================================================================

/**
 * 기본 검색 옵션
 * @description vectorSearch, fullTextSearch에서 사용
 */
export interface SearchOptions {
  /** 사용자 ID */
  userId: string
  /** 반환할 결과 개수 */
  topK?: number
  /** 문서 ID 필터 */
  documentId?: string
  /** 최소 점수 임계값 (0~1) */
  minScore?: number
  /** 청크 유형 필터 (Pipeline v3 추가) */
  chunkType?: ChunkType
  /** 카테고리 필터 (Phase 14.5: null = 전체) */
  category?: string | null
  /** [RAG-ISOLATION] 프로젝트 ID 필터 (null = 전체) */
  projectId?: string | null
}

/**
 * 하이브리드 검색 옵션
 * @description hybridSearch에서 사용
 */
export interface HybridSearchOptions extends SearchOptions {
  /** 벡터 검색 가중치 (0~1, 기본: 0.7) */
  vectorWeight?: number
  /** 키워드 검색 가중치 (0~1, 기본: 0.3) */
  keywordWeight?: number
  /** [PATTERN] 패턴 타입 필터 (선택적) */
  patternType?: PatternType
}

/**
 * 패턴 기반 검색 옵션 (내부용)
 * @description patternBasedSearch에서 사용
 */
export interface PatternSearchOptions extends SearchOptions {
  /** 패턴 타입 (필수) */
  patternType: PatternType
}

/**
 * 패턴 검색 Wrapper 옵션
 * @description searchByPattern에서 사용
 */
export interface SearchByPatternOptions extends SearchOptions {
  /** 패턴 타입 (null이면 일반 검색으로 폴백) */
  patternType?: PatternType | null
}
