// =============================================================================
// PRISM Writer - RAG API Client (P2 Phase 4)
// =============================================================================
// 파일: frontend/src/lib/api/rag.ts
// 역할: RAG 검색 API 호출 클라이언트
// =============================================================================

import type { EvidencePack, EvidenceItem } from '@/types/rag'
import { getApiHeaders } from './utils'

// =============================================================================
// 타입 정의
// =============================================================================

/** 검색 요청 옵션 */
export interface SearchOptions {
  /** 반환할 결과 개수 (기본: 5) */
  topK?: number
  /** 최소 유사도 임계값 (기본: 0.5) */
  threshold?: number
  /** [P1-02] 카테고리 필터 (선택 - 생략 시 전체 검색) */
  category?: string
}

/** 검색 API 응답 */
interface SearchAPIResponse {
  success: boolean
  evidencePack?: EvidencePack
  documents?: EvidenceItem[]
  message?: string
  error?: string
}

/** 검색 결과 */
export interface SearchResult {
  /** Evidence Pack */
  evidencePack: EvidencePack
  /** 검색된 문서들 */
  documents: EvidenceItem[]
}

// =============================================================================
// 에러 클래스
// =============================================================================

export class RAGSearchError extends Error {
  constructor(
    message: string,
    public code: string,
    public status?: number
  ) {
    super(message)
    this.name = 'RAGSearchError'
  }
}

// =============================================================================
// API 함수
// =============================================================================

/**
 * 문서 검색 (RAG 벡터 검색)
 * 
 * @description
 * Gemini 임베딩 기반 벡터 유사도 검색을 수행합니다.
 * EvidencePack 형식으로 결과를 반환합니다.
 * 
 * @param query - 검색 쿼리
 * @param options - 검색 옵션
 * @returns 검색 결과 (EvidencePack + documents)
 * 
 * @throws {RAGSearchError} API 호출 실패 시
 * 
 * @example
 * ```typescript
 * try {
 *   const result = await searchDocuments("RAG란?", { topK: 5 })
 *   console.log(result.documents.length)
 * } catch (error) {
 *   if (error instanceof RAGSearchError) {
 *     console.error(error.code, error.message)
 *   }
 * }
 * ```
 */
export async function searchDocuments(
  query: string,
  options: SearchOptions
): Promise<SearchResult> {
  const { topK = 5, threshold = 0.5, category } = options

  // ---------------------------------------------------------------------------
  // 입력 검증
  // ---------------------------------------------------------------------------
  if (!query || query.trim().length === 0) {
    throw new RAGSearchError('검색 쿼리가 비어있습니다.', 'EMPTY_QUERY')
  }

  // ---------------------------------------------------------------------------
  // API 호출
  // ---------------------------------------------------------------------------
  try {
    const response = await fetch('/api/rag/search', {
      method: 'POST',
      headers: getApiHeaders(),
      body: JSON.stringify({
        query: query.trim(),
        topK,
        threshold,
        category,  // [보안] 카테고리 격리 필터
      }),
    })

    const data: SearchAPIResponse = await response.json()

    // ---------------------------------------------------------------------------
    // 에러 처리
    // ---------------------------------------------------------------------------
    if (!response.ok) {
      throw new RAGSearchError(
        data.message || '검색 중 오류가 발생했습니다.',
        data.error || 'SEARCH_FAILED',
        response.status
      )
    }

    if (!data.success) {
      throw new RAGSearchError(
        data.message || '검색 실패',
        data.error || 'UNKNOWN_ERROR'
      )
    }

    // ---------------------------------------------------------------------------
    // 결과 반환
    // ---------------------------------------------------------------------------
    if (!data.evidencePack || !data.documents) {
      throw new RAGSearchError(
        '검색 결과가 없습니다.',
        'NO_RESULTS'
      )
    }

    return {
      evidencePack: data.evidencePack,
      documents: data.documents,
    }
  } catch (error) {
    // RAGSearchError는 그대로 throw
    if (error instanceof RAGSearchError) {
      throw error
    }

    // 네트워크 오류 등
    throw new RAGSearchError(
      error instanceof Error ? error.message : '알 수 없는 오류',
      'NETWORK_ERROR'
    )
  }
}

/**
 * 검색 결과를 Judge API용 컨텍스트로 변환
 * 
 * @param documents - 검색된 문서들
 * @returns Judge API에 전달할 context 배열
 */
export function documentsToContext(
  documents: EvidenceItem[]
): { id: string; content: string }[] {
  return documents.map((doc) => ({
    id: doc.chunkId,
    content: doc.content,
  }))
}
