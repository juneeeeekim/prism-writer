// =============================================================================
// PRISM Writer - Evidence Pack Builder
// =============================================================================
// 파일: frontend/src/lib/rag/evidencePack.ts
// 역할: 검색 결과를 Evidence Pack으로 변환
// P1 Phase 4.2
// =============================================================================

import type { 
  EvidencePack, 
  EvidenceItem, 
  EvidenceMetadata,
  ScoreComponents 
} from '@/types/rag'

// =============================================================================
// 기본값 및 상수
// =============================================================================

const DEFAULT_SCORE_COMPONENTS: ScoreComponents = {
  bm25: 0,
  vector: 0,
  rerank: 0,
}

// =============================================================================
// 검색 결과 타입 (임시 - 실제 구현 시 교체)
// =============================================================================

/**
 * 검색 결과 인터페이스 (임시)
 */
interface SearchResult {
  id: string
  documentId?: string
  content: string
  score?: number
  metadata?: Record<string, unknown>
}

// =============================================================================
// Evidence Pack 빌더
// =============================================================================

/**
 * 검색 결과를 Evidence Pack으로 변환
 * 
 * @description
 * 검색 결과를 표준화된 Evidence Pack 형식으로 변환
 * 원본 결과를 수정하지 않음 (불변성)
 * 
 * @param runId - 실행 ID
 * @param searchResults - 검색 결과 배열
 * @param config - 설정 정보
 * @returns 표준화된 Evidence Pack
 * 
 * @example
 * ```typescript
 * const pack = buildEvidencePack(
 *   'run_123_abc',
 *   searchResults,
 *   { query: '질문', retrievalConfigId: 'default' }
 * )
 * ```
 */
export function buildEvidencePack(
  runId: string,
  searchResults: SearchResult[],
  config: {
    query: string
    retrievalConfigId?: string
    embeddingModelId?: string
    rubricId?: string
  }
): EvidencePack {
  // ---------------------------------------------------------------------------
  // Evidence Items 생성
  // ---------------------------------------------------------------------------
  const items: EvidenceItem[] = searchResults.map((result, index) => ({
    chunkId: result.id || `chunk_${index}`,
    documentId: result.documentId || 'unknown',
    content: result.content,
    spanOffsets: { start: 0, end: result.content.length },
    sourceUri: (result.metadata?.sourceUri as string) || '',
    namespace: (result.metadata?.namespace as string) || 'default',
    docVersion: (result.metadata?.version as string) || '1.0',
    scoreComponents: extractScoreComponents(result),
  }))

  // ---------------------------------------------------------------------------
  // Metadata 생성
  // ---------------------------------------------------------------------------
  const metadata: EvidenceMetadata = {
    searchQuery: config.query,
    retrievalConfigId: config.retrievalConfigId || 'default',
    embeddingModelId: config.embeddingModelId || 'text-embedding-ada-002',
    totalCandidates: searchResults.length,
    selectedCount: items.length,
    createdAt: new Date().toISOString(),
  }

  // ---------------------------------------------------------------------------
  // Evidence Pack 조합
  // ---------------------------------------------------------------------------
  return {
    runId,
    rubricId: config.rubricId,
    items,
    metadata,
  }
}

/**
 * 검색 결과에서 점수 구성 요소 추출
 */
function extractScoreComponents(result: SearchResult): ScoreComponents {
  const metadata = result.metadata || {}
  
  return {
    bm25: (metadata.bm25Score as number) || 0,
    vector: (metadata.vectorScore as number) || result.score || 0,
    rerank: (metadata.rerankScore as number) || 0,
  }
}

// =============================================================================
// Evidence Pack 유틸리티
// =============================================================================

/**
 * Evidence Pack에서 컨텐츠만 추출
 * 
 * @param pack - Evidence Pack
 * @returns 컨텐츠 문자열 배열
 */
export function extractContents(pack: EvidencePack): string[] {
  return pack.items.map(item => item.content)
}

/**
 * Evidence Pack 요약 생성
 * 
 * @param pack - Evidence Pack
 * @returns 요약 문자열
 */
export function summarizeEvidencePack(pack: EvidencePack): string {
  const { metadata, items } = pack
  return `Query: "${metadata.searchQuery}" | Items: ${items.length}/${metadata.totalCandidates} | Config: ${metadata.retrievalConfigId}`
}

/**
 * Evidence Pack을 프롬프트 컨텍스트로 포맷팅
 * 
 * @param pack - Evidence Pack
 * @returns 프롬프트용 포맷된 문자열
 */
export function formatEvidenceForPrompt(pack: EvidencePack): string {
  return pack.items
    .map((item, i) => {
      const scores = item.scoreComponents
      const scoreInfo = `[BM25: ${scores.bm25.toFixed(2)}, Vec: ${scores.vector.toFixed(2)}, Rerank: ${scores.rerank.toFixed(2)}]`
      return `[근거 ${i + 1}] ${scoreInfo}\n${item.content}`
    })
    .join('\n\n')
}

/**
 * 빈 Evidence Pack 생성
 */
export function createEmptyEvidencePack(runId: string, query: string): EvidencePack {
  return {
    runId,
    items: [],
    metadata: {
      searchQuery: query,
      retrievalConfigId: 'default',
      embeddingModelId: 'none',
      totalCandidates: 0,
      selectedCount: 0,
      createdAt: new Date().toISOString(),
    },
  }
}

/**
 * Evidence Pack 유효성 검증
 */
export function isValidEvidencePack(pack: unknown): pack is EvidencePack {
  if (!pack || typeof pack !== 'object') return false
  const p = pack as Record<string, unknown>
  return (
    typeof p.runId === 'string' &&
    Array.isArray(p.items) &&
    typeof p.metadata === 'object'
  )
}
