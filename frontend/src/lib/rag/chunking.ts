// =============================================================================
// PRISM Writer - Document Chunking Utilities
// =============================================================================
// 파일: frontend/src/lib/rag/chunking.ts
// 역할: 문서를 검색 가능한 청크로 분할
// Pipeline v3 업그레이드: Semantic Chunking 및 chunk_type 메타데이터 추가
// =============================================================================

// =============================================================================
// 타입 정의 (확장됨 - Pipeline v3)
// =============================================================================

/** 청크 유형 (Pipeline v3 추가) */
export type ChunkType = 'rule' | 'example' | 'general';

export interface ChunkOptions {
  /** 청크 크기 (토큰 단위, 기본값: 512) */
  chunkSize?: number
  /** 청크 간 겹치는 토큰 수 (기본값: 50) */
  overlap?: number
  /** 마크다운 헤더를 청크와 함께 유지 (기본값: true) */
  preserveHeaders?: boolean
  /** Semantic Chunking 사용 여부 (Pipeline v3, 기본값: true) */
  useSemanticChunking?: boolean
  /** 자동 타입 분류 여부 (Pipeline v3, 기본값: true) */
  autoClassifyType?: boolean
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
  /** 청크 유형 (Pipeline v3 추가) */
  chunkType?: ChunkType
}

// =============================================================================
// 상수
// =============================================================================

const DEFAULT_CHUNK_SIZE = 512
const DEFAULT_OVERLAP = 50
const CHARS_PER_TOKEN = 4 // 대략적인 추정치 (한글 기준)

// =============================================================================
// Pipeline v4: 패턴 감지 상수 (개선됨)
// =============================================================================
// 주석(시니어 개발자): 한글/영어 혼용 문서 및 엣지 케이스 대응 강화

/** 규칙/원칙 패턴 (Korean & English) - Pipeline v4 확장 */
const RULE_PATTERNS = [
  // 한글 규칙 패턴
  /해야\s*(합니다|한다|함)/,
  /하지\s*(마|말아야|않아야)/,
  /금지/,
  /원칙/,
  /규칙/,
  /필수/,
  /반드시/,
  /~(어|아)야\s*한다/,
  /권장/,
  /지양/,
  /준수/,
  /의무/,
  // 영어 규칙 패턴
  /should\s+(always|never)/i,
  /must\s+(be|have|not)/i,
  /do\s+not/i,
  /avoid/i,
  /rule:/i,
  /principle:/i,
  /guideline:/i,
  /requirement:/i,
  /mandatory/i,
  /prohibited/i,
  // Pipeline v4: 번호/불릿 리스트 규칙 패턴
  /^\d+\.\s*.+(해야|하지|금지|필수)/m,
  /^[-•]\s*.+(해야|하지|금지|필수)/m,
]

/** 예시/사례 패턴 (Korean & English) - Pipeline v4 확장 */
const EXAMPLE_PATTERNS = [
  // 한글 예시 패턴
  /예를\s*들어/,
  /예시/,
  /사례/,
  /다음과\s*같/,
  /예컨대/,
  /가령/,
  // 따옴표 패턴
  /"[^"]{10,}"/,  // 10자 이상의 따옴표 문장
  /'[^']{10,}'/,  // 10자 이상의 작은따옴표 문장
  /「[^」]+」/,    // 한국식 따옴표
  // 영어 예시 패턴
  /before\s*[:/]/i,
  /after\s*[:/]/i,
  /good\s*example/i,
  /bad\s*example/i,
  /for\s*example/i,
  /e\.g\./i,
  /such\s+as/i,
  /like\s+this:/i,
  /instance:/i,
  // Pipeline v4: 비교 패턴
  /[OX]\s*[:\-]/,  // O: 좋은예 / X: 나쁜예
  /[✓✗]\s*/,       // 체크마크 예시
  /좋은\s*예|나쁜\s*예/,
]

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
// Pipeline v4: 청크 유형 분류 함수 (개선됨)
// =============================================================================

// 분류 결과 로깅 설정
const ENABLE_CLASSIFICATION_LOGGING = process.env.NODE_ENV === 'development'

/**
 * 텍스트의 청크 유형 자동 분류 (Pipeline v4 개선)
 * 
 * @description
 * 주석(시니어 개발자): Pipeline v4에서 개선된 분류 로직
 * - 한글/영어 혼용 문서 패턴 강화
 * - 엣지 케이스 처리 (너무 짧은 텍스트 등)
 * - Fallback 보장 ('general' 기본값)
 * - 분류 결과 로깅 (개발 환경)
 * 
 * @param text - 분류할 텍스트
 * @param enableLogging - 로깅 활성화 여부 (기본: development 환경에서만)
 * @returns 청크 유형
 */
export function classifyChunkType(
  text: string, 
  enableLogging: boolean = ENABLE_CLASSIFICATION_LOGGING
): ChunkType {
  // ---------------------------------------------------------------------------
  // Pipeline v4: 엣지 케이스 처리
  // ---------------------------------------------------------------------------
  // 주석(주니어 개발자): 너무 짧은 텍스트는 general로 처리
  if (!text || text.trim().length < 10) {
    if (enableLogging) {
      console.log('[classifyChunkType] Text too short, defaulting to general')
    }
    return 'general'  // Fallback 보장
  }
  
  // ---------------------------------------------------------------------------
  // 패턴 매칭
  // ---------------------------------------------------------------------------
  const hasRulePattern = RULE_PATTERNS.some(pattern => pattern.test(text))
  const hasExamplePattern = EXAMPLE_PATTERNS.some(pattern => pattern.test(text))
  
  // ---------------------------------------------------------------------------
  // 분류 결정 + 로깅
  // ---------------------------------------------------------------------------
  let result: ChunkType = 'general'  // Fallback 기본값
  
  // 우선순위: 규칙 > 예시 > 일반
  // (규칙 안에 예시가 포함될 수 있으므로 규칙 우선)
  if (hasRulePattern) {
    result = 'rule'
  } else if (hasExamplePattern) {
    result = 'example'
  }
  
  // Pipeline v4: 분류 결과 로깅 (수동 검토용)
  if (enableLogging) {
    const preview = text.substring(0, 50).replace(/\n/g, ' ')
    console.log(`[classifyChunkType] "${preview}..." -> ${result} (rule:${hasRulePattern}, example:${hasExamplePattern})`)
  }
  
  return result
}

/**
 * 텍스트에 따옴표가 포함되어 있는지 확인 (리랭킹용)
 */
export function hasQuotes(text: string): boolean {
  return /"[^"]{10,}"/.test(text) || /'[^']{10,}'/.test(text) || /「[^」]+」/.test(text)
}

/**
 * 텍스트에 대화체가 포함되어 있는지 확인 (리랭킹용)
 */
export function hasDialogue(text: string): boolean {
  return /"[^"]*"\s*라고\s*(말|했|said)/i.test(text) || 
         /A:\s*.+\nB:\s*.+/i.test(text) ||
         /질문:\s*.+\n답변:/i.test(text)
}

/**
 * 텍스트에 구체적 수치가 포함되어 있는지 확인 (리랭킹용)
 */
export function hasNumericData(text: string): boolean {
  return /\d+(\.\d+)?%/.test(text) ||  // 퍼센트
         /\d{1,3}(,\d{3})+/.test(text) || // 천단위 숫자
         /\d+개|\d+명|\d+건/.test(text)   // 수량 표현
}

// =============================================================================
// Pipeline v3: Semantic Chunking
// =============================================================================

/**
 * Semantic Chunking - 의미 단위로 문서 분할 (Pipeline v3)
 * 
 * @description
 * 고정 크기 분할 대신 문단, 규칙 설명 등 의미 단위로 청킹하여
 * 규칙과 예시의 맥락을 완벽히 보존합니다.
 * 
 * @param text - 원본 문서 텍스트
 * @param options - 청킹 옵션
 * @returns 청크 배열
 */
export function semanticChunk(
  text: string,
  options: ChunkOptions = {}
): DocumentChunk[] {
  const {
    chunkSize = DEFAULT_CHUNK_SIZE,
    overlap = DEFAULT_OVERLAP,
    preserveHeaders = true,
    autoClassifyType = true,
  } = options

  if (!text || text.trim().length === 0) {
    return []
  }

  const chunkSizeChars = tokensToChars(chunkSize)
  const overlapChars = tokensToChars(overlap)
  const chunks: DocumentChunk[] = []
  
  // ---------------------------------------------------------------------------
  // 1. 의미 단위로 분할 (마크다운 섹션 우선)
  // ---------------------------------------------------------------------------
  // 마크다운 헤더(#, ##, ### 등)를 기준으로 섹션 분리
  const sections = text.split(/(?=^#{1,6}\s+)/m)
  
  let currentChunk = ''
  let currentPosition = 0
  let chunkIndex = 0
  let currentSectionTitle: string | undefined = undefined

  for (const section of sections) {
    if (!section.trim()) continue
    
    // 섹션 제목 추출
    const headerMatch = section.match(/^(#{1,6})\s+(.+)$/m)
    if (headerMatch) {
      currentSectionTitle = headerMatch[2]
    }
    
    // 섹션 내 문단 분할
    const paragraphs = section.split(/\n\n+/)
    
    for (const paragraph of paragraphs) {
      if (!paragraph.trim()) continue
      
      const paragraphWithNewline = paragraph.trim() + '\n\n'
      
      // 현재 청크에 문단 추가 시 크기 초과 여부 확인
      if (currentChunk.length + paragraphWithNewline.length > chunkSizeChars && currentChunk.length > 0) {
        // 현재 청크 저장
        const chunkType = autoClassifyType ? classifyChunkType(currentChunk) : undefined
        
        chunks.push({
          index: chunkIndex++,
          content: currentChunk.trim(),
          metadata: {
            sectionTitle: preserveHeaders ? currentSectionTitle : undefined,
            tokenCount: estimateTokenCount(currentChunk),
            startPosition: currentPosition - currentChunk.length,
            endPosition: currentPosition,
            chunkType,
          },
        })
        
        // 오버랩 적용하여 다음 청크 시작
        const overlapText = overlapChars > 0 ? currentChunk.slice(-overlapChars) : ''
        currentChunk = overlapText + paragraphWithNewline
      } else {
        currentChunk += paragraphWithNewline
      }
      
      currentPosition += paragraphWithNewline.length
    }
  }
  
  // ---------------------------------------------------------------------------
  // 2. 마지막 청크 저장
  // ---------------------------------------------------------------------------
  if (currentChunk.trim().length > 0) {
    const chunkType = autoClassifyType ? classifyChunkType(currentChunk) : undefined
    
    chunks.push({
      index: chunkIndex,
      content: currentChunk.trim(),
      metadata: {
        sectionTitle: preserveHeaders ? currentSectionTitle : undefined,
        tokenCount: estimateTokenCount(currentChunk),
        startPosition: currentPosition - currentChunk.length,
        endPosition: currentPosition,
        chunkType,
      },
    })
  }
  
  return chunks
}

// =============================================================================
// Main Chunking Function (Updated for Pipeline v3)
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
 * // Pipeline v3: Semantic Chunking 사용 (기본값)
 * const chunks = chunkDocument(documentText, {
 *   chunkSize: 512,
 *   overlap: 50,
 *   preserveHeaders: true,
 *   useSemanticChunking: true,
 *   autoClassifyType: true
 * })
 * 
 * // 기존 방식 (고정 크기 분할)
 * const legacyChunks = chunkDocument(documentText, {
 *   useSemanticChunking: false
 * })
 * ```
 */
export function chunkDocument(
  text: string,
  options: ChunkOptions = {}
): DocumentChunk[] {
  // ---------------------------------------------------------------------------
  // Pipeline v3: Semantic Chunking 분기
  // ---------------------------------------------------------------------------
  const { useSemanticChunking = true, autoClassifyType = true, ...restOptions } = options
  
  if (useSemanticChunking) {
    return semanticChunk(text, { ...restOptions, autoClassifyType })
  }
  
  // ---------------------------------------------------------------------------
  // 기존 로직 (하위 호환성 유지)
  // ---------------------------------------------------------------------------
  const {
    chunkSize = DEFAULT_CHUNK_SIZE,
    overlap = DEFAULT_OVERLAP,
    preserveHeaders = true,
  } = restOptions

  if (!text || text.trim().length === 0) {
    throw new Error('문서 내용이 비어있습니다.')
  }

  const chunkSizeChars = tokensToChars(chunkSize)
  const overlapChars = tokensToChars(overlap)
  const paragraphs = text.split(/\n\n+/)
  const chunks: DocumentChunk[] = []
  let currentChunk = ''
  let currentPosition = 0
  let chunkIndex = 0

  for (const paragraph of paragraphs) {
    const paragraphWithNewline = paragraph + '\n\n'
    
    if (currentChunk.length + paragraphWithNewline.length > chunkSizeChars && currentChunk.length > 0) {
      const sectionTitle = preserveHeaders 
        ? extractSectionTitle(text, currentPosition) 
        : undefined
      
      // Pipeline v3: 자동 타입 분류 추가
      const chunkType = autoClassifyType ? classifyChunkType(currentChunk) : undefined

      chunks.push({
        index: chunkIndex++,
        content: currentChunk.trim(),
        metadata: {
          sectionTitle,
          tokenCount: estimateTokenCount(currentChunk),
          startPosition: currentPosition - currentChunk.length,
          endPosition: currentPosition,
          chunkType,
        },
      })

      const overlapText = currentChunk.slice(-overlapChars)
      currentChunk = overlapText + paragraphWithNewline
    } else {
      currentChunk += paragraphWithNewline
    }

    currentPosition += paragraphWithNewline.length
  }

  if (currentChunk.trim().length > 0) {
    const sectionTitle = preserveHeaders 
      ? extractSectionTitle(text, currentPosition) 
      : undefined
    
    const chunkType = autoClassifyType ? classifyChunkType(currentChunk) : undefined

    chunks.push({
      index: chunkIndex,
      content: currentChunk.trim(),
      metadata: {
        sectionTitle,
        tokenCount: estimateTokenCount(currentChunk),
        startPosition: currentPosition - currentChunk.length,
        endPosition: currentPosition,
        chunkType,
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
    chunkType: classifyChunkType(chunk),
  }
}
