// =============================================================================
// PRISM Writer - Chunk Extractor Utility
// =============================================================================
// 파일: frontend/src/lib/raft/chunkExtractor.ts
// 역할: 카테고리별 청크 데이터 추출 유틸리티
// 생성일: 2025-12-28
//
// [Phase B] B-01: 청크 추출 유틸리티 함수
// - user_documents에서 카테고리별 문서 ID 조회
// - document_chunks에서 해당 문서들의 청크 조회
// - 토큰 한도 체크 및 truncate
// =============================================================================

import { createClient } from '@/lib/supabase/server'

// =============================================================================
// 상수 정의
// =============================================================================

/** 최대 청크 수 (성능 보호) */
const MAX_CHUNKS = 100

/** 최대 토큰 수 (안전 마진 포함) */
const MAX_TOKENS = 80000

/** 문자 → 토큰 추정 비율 */
const CHARS_PER_TOKEN = 4

// =============================================================================
// 타입 정의
// =============================================================================

export interface ChunkExtractionResult {
  /** 결합된 청크 텍스트 */
  text: string
  /** 추출된 청크 개수 */
  chunkCount: number
  /** 문서 개수 */
  documentCount: number
  /** 추정 토큰 수 */
  estimatedTokens: number
  /** 제한으로 인해 잘린 경우 true */
  truncated: boolean
  /** 경고 메시지 (있는 경우) */
  warning?: string
}

// =============================================================================
// [Phase B] B-01 + B-03: 카테고리별 청크 추출 함수
// =============================================================================

/**
 * 특정 카테고리의 모든 문서 청크를 추출합니다.
 * 
 * @param category - 추출할 카테고리명
 * @param maxChunks - 최대 청크 수 (기본값: 100)
 * @returns 결합된 텍스트와 메타데이터
 * 
 * @example
 * ```typescript
 * const result = await extractCategoryChunks('마케팅', 100)
 * if (result.text.length > 0) {
 *   // 청크 활용
 * }
 * ```
 */
export async function extractCategoryChunks(
  category: string,
  maxChunks: number = MAX_CHUNKS
): Promise<ChunkExtractionResult> {
  const supabase = createClient()

  // ---------------------------------------------------------------------------
  // Step 1: user_documents에서 해당 카테고리 문서 ID 조회
  // ---------------------------------------------------------------------------
  const { data: docs, error: docError } = await supabase
    .from('user_documents')
    .select('id')
    .eq('category', category)

  if (docError) {
    console.error('[chunkExtractor] user_documents query error:', docError)
    return {
      text: '',
      chunkCount: 0,
      documentCount: 0,
      estimatedTokens: 0,
      truncated: false,
      warning: `문서 조회 오류: ${docError.message}`
    }
  }

  if (!docs || docs.length === 0) {
    return {
      text: '',
      chunkCount: 0,
      documentCount: 0,
      estimatedTokens: 0,
      truncated: false,
      warning: `카테고리 '${category}'에 등록된 문서가 없습니다.`
    }
  }

  const docIds = docs.map(d => d.id)

  // ---------------------------------------------------------------------------
  // Step 2: document_chunks에서 해당 문서들의 청크 조회
  // ---------------------------------------------------------------------------
  const { data: chunks, error: chunkError } = await supabase
    .from('document_chunks')
    .select('content, chunk_content')
    .in('document_id', docIds)
    .limit(maxChunks)

  if (chunkError) {
    console.error('[chunkExtractor] document_chunks query error:', chunkError)
    return {
      text: '',
      chunkCount: 0,
      documentCount: docs.length,
      estimatedTokens: 0,
      truncated: false,
      warning: `청크 조회 오류: ${chunkError.message}`
    }
  }

  if (!chunks || chunks.length === 0) {
    return {
      text: '',
      chunkCount: 0,
      documentCount: docs.length,
      estimatedTokens: 0,
      truncated: false,
      warning: `카테고리 '${category}'의 문서에 처리된 청크가 없습니다.`
    }
  }

  // ---------------------------------------------------------------------------
  // Step 3: 컨텍스트 결합
  // ---------------------------------------------------------------------------
  const combinedText = chunks
    .map(c => c.content || c.chunk_content)
    .filter(Boolean)
    .join('\n\n---\n\n')

  // ---------------------------------------------------------------------------
  // [Phase B] B-03: 토큰 한도 체크 및 truncate
  // ---------------------------------------------------------------------------
  const estimatedTokens = Math.ceil(combinedText.length / CHARS_PER_TOKEN)
  let finalText = combinedText
  let truncated = chunks.length >= maxChunks
  let warning: string | undefined

  if (estimatedTokens > MAX_TOKENS) {
    const maxChars = MAX_TOKENS * CHARS_PER_TOKEN
    finalText = combinedText.substring(0, maxChars) + '\n\n[... 토큰 한도 초과로 이하 생략됨 ...]'
    truncated = true
    warning = `토큰 한도(${MAX_TOKENS.toLocaleString()})를 초과하여 일부만 사용됩니다.`
  } else if (truncated) {
    warning = `최대 청크 수(${maxChunks}개)에 도달했습니다. 일부 청크가 제외될 수 있습니다.`
  }

  return {
    text: finalText,
    chunkCount: chunks.length,
    documentCount: docs.length,
    estimatedTokens: Math.ceil(finalText.length / CHARS_PER_TOKEN),
    truncated,
    warning
  }
}

// =============================================================================
// [Phase B] B-04 지원: 청크 개수 조회 (경량 버전)
// =============================================================================

/**
 * 카테고리별 청크 개수와 추정 토큰을 조회합니다.
 * (실제 청크 내용을 불러오지 않고 count만 조회)
 * 
 * @param category - 조회할 카테고리명
 * @returns 청크 개수와 추정 토큰 정보
 */
export async function getCategoryChunkStats(
  category: string
): Promise<{ count: number; estimatedTokens: number; warning: string | null }> {
  const supabase = createClient()

  // user_documents에서 문서 ID 조회
  const { data: docs } = await supabase
    .from('user_documents')
    .select('id')
    .eq('category', category)

  if (!docs || docs.length === 0) {
    return { count: 0, estimatedTokens: 0, warning: null }
  }

  // 청크 수 count (head: true로 효율적 조회)
  const { count } = await supabase
    .from('document_chunks')
    .select('*', { count: 'exact', head: true })
    .in('document_id', docs.map(d => d.id))

  // 평균 청크당 500토큰 가정
  const estimatedTokens = (count || 0) * 500

  return {
    count: count || 0,
    estimatedTokens,
    warning: estimatedTokens > MAX_TOKENS ? '토큰 한도 초과 가능성' : null
  }
}
