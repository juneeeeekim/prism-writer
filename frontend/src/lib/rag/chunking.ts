// =============================================================================
// PRISM Writer - Document Chunking Utilities
// =============================================================================
// 파일: frontend/src/lib/rag/chunking.ts
// 역할: 문서를 검색 가능한 청크로 분할
// =============================================================================

// =============================================================================
// 타입 정의
// =============================================================================

export interface ChunkOptions {
  /** 청크 크기 (토큰 단위, 기본값: 512) */
  chunkSize?: number
  /** 청크 간 겹치는 토큰 수 (기본값: 50) */
  overlap?: number
  /** 마크다운 헤더를 청크와 함께 유지 (기본값: true) */
  preserveHeaders?: boolean
}

export interface DocumentChunk {
  /** 청크 인덱스 (0부터 시작) */
  index: number
  /** 청크 내용 */
  content: string
  /** 메타데이터 */
  metadata: ChunkMetadata
}

export interface ChunkMetadata {
  /** 섹션 제목 (마크다운 헤더) */
  sectionTitle?: string
  /** 예상 토큰 수 */
  tokenCount: number
  /** 시작 문자 위치 */
  startPosition: number
  /** 끝 문자 위치 */
  endPosition: number
}

// =============================================================================
// 상수
// =============================================================================

const DEFAULT_CHUNK_SIZE = 512
const DEFAULT_OVERLAP = 50
const CHARS_PER_TOKEN = 4 // 대략적인 추정치 (한글 기준)

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * 텍스트의 토큰 수 추정
 * 
 * @param text - 텍스트
 * @returns 예상 토큰 수
 */
function estimateTokenCount(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN)
}

/**
 * 토큰 수를 문자 수로 변환
 * 
 * @param tokens - 토큰 수
 * @returns 문자 수
 */
function tokensToChars(tokens: number): number {
  return tokens * CHARS_PER_TOKEN
}

/**
 * 마크다운 헤더 추출
 * 
 * @param text - 텍스트
 * @param position - 현재 위치
 * @returns 가장 가까운 이전 헤더 또는 undefined
 */
function extractSectionTitle(text: string, position: number): string | undefined {
  const textBeforePosition = text.substring(0, position)
  const lines = textBeforePosition.split('\n')
  
  // 역순으로 헤더 찾기
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].trim()
    const headerMatch = line.match(/^(#{1,6})\s+(.+)$/)
    if (headerMatch) {
      return headerMatch[2] // 헤더 텍스트 반환
    }
  }
  
  return undefined
}

// =============================================================================
// Main Chunking Function
// =============================================================================

/**
 * 문서를 청크로 분할
 * 
 * @param text - 원본 문서 텍스트
 * @param options - 청킹 옵션
 * @returns 청크 배열
 * 
 * @example
 * ```typescript
 * const chunks = chunkDocument(documentText, {
 *   chunkSize: 512,
 *   overlap: 50,
 *   preserveHeaders: true
 * })
 * ```
 */
export function chunkDocument(
  text: string,
  options: ChunkOptions = {}
): DocumentChunk[] {
  // ---------------------------------------------------------------------------
  // 1. 옵션 설정
  // ---------------------------------------------------------------------------
  const {
    chunkSize = DEFAULT_CHUNK_SIZE,
    overlap = DEFAULT_OVERLAP,
    preserveHeaders = true,
  } = options

  // ---------------------------------------------------------------------------
  // 2. 입력 검증
  // ---------------------------------------------------------------------------
  if (!text || text.trim().length === 0) {
    throw new Error('문서 내용이 비어있습니다.')
  }

  const chunkSizeChars = tokensToChars(chunkSize)
  const overlapChars = tokensToChars(overlap)

  // ---------------------------------------------------------------------------
  // 3. 문단 단위로 분할 (더 나은 의미 보존)
  // ---------------------------------------------------------------------------
  const paragraphs = text.split(/\n\n+/) // 빈 줄 2개 이상으로 분할
  const chunks: DocumentChunk[] = []
  let currentChunk = ''
  let currentPosition = 0
  let chunkIndex = 0

  for (const paragraph of paragraphs) {
    const paragraphWithNewline = paragraph + '\n\n'
    
    // 현재 청크에 문단 추가 시 크기 초과 여부 확인
    if (currentChunk.length + paragraphWithNewline.length > chunkSizeChars && currentChunk.length > 0) {
      // 현재 청크 저장
      const sectionTitle = preserveHeaders 
        ? extractSectionTitle(text, currentPosition) 
        : undefined

      chunks.push({
        index: chunkIndex++,
        content: currentChunk.trim(),
        metadata: {
          sectionTitle,
          tokenCount: estimateTokenCount(currentChunk),
          startPosition: currentPosition - currentChunk.length,
          endPosition: currentPosition,
        },
      })

      // 다음 청크 시작 (overlap 적용)
      const overlapText = currentChunk.slice(-overlapChars)
      currentChunk = overlapText + paragraphWithNewline
    } else {
      // 문단 추가
      currentChunk += paragraphWithNewline
    }

    currentPosition += paragraphWithNewline.length
  }

  // ---------------------------------------------------------------------------
  // 4. 마지막 청크 저장
  // ---------------------------------------------------------------------------
  if (currentChunk.trim().length > 0) {
    const sectionTitle = preserveHeaders 
      ? extractSectionTitle(text, currentPosition) 
      : undefined

    chunks.push({
      index: chunkIndex,
      content: currentChunk.trim(),
      metadata: {
        sectionTitle,
        tokenCount: estimateTokenCount(currentChunk),
        startPosition: currentPosition - currentChunk.length,
        endPosition: currentPosition,
      },
    })
  }

  return chunks
}

// =============================================================================
// Metadata Extraction
// =============================================================================

/**
 * 청크에서 메타데이터 추출
 * 
 * @param chunk - 청크 내용
 * @param context - 전체 문서 컨텍스트
 * @returns 메타데이터
 */
export function extractMetadata(
  chunk: string,
  context: { fullText: string; chunkPosition: number }
): ChunkMetadata {
  const { fullText, chunkPosition } = context

  return {
    sectionTitle: extractSectionTitle(fullText, chunkPosition),
    tokenCount: estimateTokenCount(chunk),
    startPosition: chunkPosition,
    endPosition: chunkPosition + chunk.length,
  }
}
