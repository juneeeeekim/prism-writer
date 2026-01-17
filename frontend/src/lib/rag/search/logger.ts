// =============================================================================
// PRISM Writer - Search Module Logger
// =============================================================================
// 파일: frontend/src/lib/rag/search/logger.ts
// 역할: RAG 검색 메트릭 로깅 (rag_logs 테이블)
// 생성일: 2026-01-17 (리팩토링)
// =============================================================================

import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/utils/logger'
import type { RAGLogEntry } from './types'

// =============================================================================
// [SECTION 1] RAG 검색 로그 저장 함수
// =============================================================================
// 목적: RAG 검색 요청의 성능 및 사용 패턴 추적
// 특징:
//   - 비동기 저장: 로그 실패가 검색 기능에 영향 없음
//   - 개인정보 보호: 쿼리 100자 제한
//   - 세분화된 메트릭: embedding_latency, search_latency 분리
// 테이블: public.rag_logs (074_rag_logs.sql)
// =============================================================================

/**
 * [P-C03-02] RAG 검색 로그 저장 함수
 *
 * @description
 * RAG 검색 메트릭을 rag_logs 테이블에 비동기로 저장합니다.
 * 로그 저장 실패는 검색 기능에 영향을 주지 않습니다 (fire-and-forget).
 *
 * @param entry - 로그 엔트리
 * @returns Promise<void> (실패 시에도 reject하지 않음)
 *
 * @example
 * ```typescript
 * // 성공 로그
 * logRAGSearch({
 *   userId,
 *   query: 'RAG란?',
 *   searchMethod: 'hybrid',
 *   resultCount: 5,
 *   latencyMs: 150,
 *   cacheHit: false
 * }).catch(() => {})  // fire-and-forget
 *
 * // 에러 로그
 * logRAGSearch({
 *   query: 'RAG란?',
 *   searchMethod: 'hybrid',
 *   resultCount: 0,
 *   latencyMs: 50,
 *   cacheHit: false,
 *   error: 'Embedding API timeout',
 *   errorCode: 'EMBEDDING_TIMEOUT'
 * }).catch(() => {})
 * ```
 */
export async function logRAGSearch(entry: RAGLogEntry): Promise<void> {
  try {
    // -------------------------------------------------------------------------
    // [STEP 1] 개인정보 보호: 쿼리 100자 제한
    // -------------------------------------------------------------------------
    const sanitizedQuery = entry.query.substring(0, 100)

    // -------------------------------------------------------------------------
    // [STEP 2] Supabase 클라이언트 생성
    // -------------------------------------------------------------------------
    const supabase = await createClient()

    // -------------------------------------------------------------------------
    // [STEP 3] rag_logs 테이블에 INSERT (비동기, 결과 무시)
    // -------------------------------------------------------------------------
    const { error } = await supabase
      .from('rag_logs')
      .insert({
        user_id: entry.userId || null,
        project_id: entry.projectId || null,
        query: sanitizedQuery,
        search_method: entry.searchMethod,
        result_count: entry.resultCount,
        top_score: entry.topScore || null,
        latency_ms: entry.latencyMs,
        embedding_latency_ms: entry.embeddingLatencyMs || null,
        search_latency_ms: entry.searchLatencyMs || null,
        cache_hit: entry.cacheHit,
        cache_key: entry.cacheKey || null,
        error: entry.error || null,
        error_code: entry.errorCode || null,
        metadata: entry.metadata || {},
      })

    if (error) {
      // 로그 저장 실패는 경고만 출력 (검색 기능에 영향 없음)
      logger.warn('[logRAGSearch]', 'Failed to save log', {
        error: error.message,
        searchMethod: entry.searchMethod,
      })
    } else {
      logger.debug('[logRAGSearch]', 'Log saved', {
        searchMethod: entry.searchMethod,
        latencyMs: entry.latencyMs,
        cacheHit: entry.cacheHit,
      })
    }
  } catch (err) {
    // -------------------------------------------------------------------------
    // [STEP 4] 예외 처리: 검색 기능에 영향 없음
    // -------------------------------------------------------------------------
    logger.warn('[logRAGSearch]', 'Unexpected error', {
      error: err instanceof Error ? err.message : String(err),
    })
  }
}
