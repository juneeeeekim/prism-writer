// =============================================================================
// PRISM Writer - Agentic Chunking
// =============================================================================
// 파일: frontend/src/lib/rag/agenticChunking.ts
// 역할: LLM 기반 지능형 문서 분할 (AI가 최적 분할 지점 판단)
// Pipeline P3-01: Agentic Chunking
// =============================================================================

import { generateText } from '@/lib/llm/gateway'
import { classifyChunkType, type DocumentChunk, type ChunkType } from './chunking'
import { getTokenCount } from './tokenizer'
import { logger } from '@/lib/utils/logger'
// P2-04-A: LLM 중앙 관리 마이그레이션 (2026-01-10)
import { getModelForUsage } from '@/config/llm-usage-map'

// =============================================================================
// [P3-01] 타입 정의
// =============================================================================

/**
 * Agentic Chunking 옵션
 * 
 * @description
 * 시니어 개발자 주석: LLM 기반 청킹 설정
 * - model: 분석에 사용할 LLM (기본: gemini)
 * - maxChunkTokens: 청크당 최대 토큰 (기본: 512)
 * - minChunkTokens: 청크당 최소 토큰 (기본: 100)
 */
export interface AgenticChunkOptions {
  /** 분석에 사용할 LLM */
  model?: 'gemini' | 'openai'
  /** 청크당 최대 토큰 */
  maxChunkTokens?: number
  /** 청크당 최소 토큰 */
  minChunkTokens?: number
  /** 문맥 보존 모드 */
  preserveContext?: boolean
}

/**
 * 청크 경계 정보 (LLM 응답)
 * 
 * @description
 * 주니어 개발자 주석: LLM이 판단한 분할 지점 정보
 */
export interface ChunkBoundary {
  /** 시작 위치 (문자 인덱스) */
  start: number
  /** 끝 위치 (문자 인덱스) */
  end: number
  /** LLM이 판단한 분할 이유 */
  reason: string
  /** 청크 유형 */
  type: 'rule' | 'example' | 'general'
}

// =============================================================================
// [P3-01] 상수
// =============================================================================

const DEFAULT_MAX_CHUNK_TOKENS = 512
const DEFAULT_MIN_CHUNK_TOKENS = 100
const MAX_TEXT_LENGTH_FOR_LLM = 8000  // LLM 컨텍스트 제한
const LLM_TIMEOUT_MS = 30000  // 30초 타임아웃

// =============================================================================
// [P3-01-01] agenticChunk 함수
// =============================================================================

/**
 * Agentic Chunking - LLM 기반 지능형 문서 분할
 * 
 * @description
 * 시니어 개발자 주석:
 * LLM이 문서 전체를 읽고 "의미가 끊기는 지점"을 판단하여 최적 분할.
 * 기존 semanticChunk()는 정규식 기반이므로 정확도 한계가 있음.
 * 
 * 주의: 실패 시 반드시 throw하여 caller에서 fallback 처리해야 함.
 * 
 * @param text - 원본 문서 텍스트
 * @param options - 청킹 옵션
 * @returns 청크 배열
 * 
 * @example
 * ```typescript
 * const chunks = await agenticChunk(documentText, {
 *   model: 'gemini',
 *   maxChunkTokens: 512
 * })
 * ```
 */
export async function agenticChunk(
  text: string,
  options: AgenticChunkOptions = {}
): Promise<DocumentChunk[]> {
  const {
    model = 'gemini',
    maxChunkTokens = DEFAULT_MAX_CHUNK_TOKENS,
    minChunkTokens = DEFAULT_MIN_CHUNK_TOKENS,
  } = options

  const startTime = Date.now()

  // ---------------------------------------------------------------------------
  // [Step 1] 문서 크기 검증 - 작은 문서는 단일 청크로 반환
  // ---------------------------------------------------------------------------
  const totalTokens = getTokenCount(text)
  
  if (totalTokens <= maxChunkTokens) {
    logger.debug('[AgenticChunk]', 'Small document, returning single chunk', { 
      tokens: totalTokens 
    })
    return [createSingleChunk(text, 0)]
  }

  logger.info('[AgenticChunk]', 'Starting LLM-based chunking', {
    textLength: text.length,
    estimatedTokens: totalTokens,
    model,
  })

  // ---------------------------------------------------------------------------
  // [Step 2] LLM에게 분할 위치 요청
  // ---------------------------------------------------------------------------
  const prompt = buildChunkAnalysisPrompt(text, { maxChunkTokens, minChunkTokens })
  const boundaries = await callLLMForChunking(prompt, model)

  // ---------------------------------------------------------------------------
  // [Step 3] 경계 검증 및 청크 생성
  // ---------------------------------------------------------------------------
  const validBoundaries = validateBoundaries(boundaries, text.length)
  
  if (validBoundaries.length === 0) {
    throw new Error('No valid boundaries returned from LLM')
  }

  const chunks = createChunksFromBoundaries(text, validBoundaries)

  // ---------------------------------------------------------------------------
  // [Step 4] 청크 유형 분류 (LLM 판단 + fallback)
  // ---------------------------------------------------------------------------
  const finalChunks = chunks.map((chunk, index) => ({
    ...chunk,
    index,
    metadata: {
      ...chunk.metadata,
      chunkType: mapBoundaryType(validBoundaries[index]?.type) || classifyChunkType(chunk.content),
      agenticReason: validBoundaries[index]?.reason,
    },
  }))

  const latencyMs = Date.now() - startTime
  logger.info('[AgenticChunk]', 'Chunking completed', {
    chunksCreated: finalChunks.length,
    latencyMs,
    model,
  })

  return finalChunks
}

// =============================================================================
// [P3-01-02] LLM 호출 유틸리티
// =============================================================================

/**
 * LLM 호출하여 청크 경계 분석 요청
 * 
 * @description
 * 주니어 개발자 주석:
 * - temperature 0.1로 결정적 응답 유도
 * - JSON 파싱 실패 시 throw (caller에서 fallback)
 * 
 * @param prompt - 분석 프롬프트
 * @param model - 사용할 LLM
 * @returns 청크 경계 배열
 */
async function callLLMForChunking(
  prompt: string,
  model: 'gemini' | 'openai'
): Promise<ChunkBoundary[]> {
  // P2-04-A: LLM 중앙 관리 마이그레이션 - getModelForUsage 적용
  const modelId = getModelForUsage('rag.chunking')

  logger.debug('[AgenticChunk]', 'Calling LLM for chunk analysis', { model: modelId })

  try {
    const response = await generateText(prompt, {
      model: modelId,
      temperature: 0.1,  // 결정적 응답
      maxOutputTokens: 2000,  // 경계 정보는 길지 않음
    })

    // -------------------------------------------------------------------------
    // 토큰 사용량 로깅 (비용 모니터링)
    // -------------------------------------------------------------------------
    logger.info('[AgenticChunk]', 'LLM call completed', {
      tokensUsed: response.tokensUsed ?? 'N/A',
      model: modelId,
    })

    // -------------------------------------------------------------------------
    // JSON 추출 (마크다운 코드블록 처리)
    // -------------------------------------------------------------------------
    const boundaries = parseChunkBoundariesFromResponse(response.text)

    if (!Array.isArray(boundaries) || boundaries.length === 0) {
      throw new Error('Empty or invalid boundaries array from LLM')
    }

    return boundaries

  } catch (error) {
    logger.error('[AgenticChunk]', 'LLM call failed', {
      error: error instanceof Error ? error.message : String(error),
      model: modelId,
    })
    throw error  // Caller에서 fallback 처리
  }
}

/**
 * LLM 응답에서 청크 경계 JSON 파싱
 * 
 * @description
 * 3단계 파싱 전략:
 * 1. 직접 JSON.parse
 * 2. JSON 배열 패턴 추출
 * 3. 코드블록 내 JSON 추출
 */
function parseChunkBoundariesFromResponse(text: string): ChunkBoundary[] {
  // Strategy 1: 직접 파싱
  try {
    const parsed = JSON.parse(text.trim())
    if (Array.isArray(parsed)) return parsed
  } catch {
    // 다음 전략 시도
  }

  // Strategy 2: JSON 배열 패턴 추출
  const jsonMatch = text.match(/\[[\s\S]*?\]/g)
  if (jsonMatch) {
    for (const match of jsonMatch) {
      try {
        const parsed = JSON.parse(match)
        if (Array.isArray(parsed) && parsed.length > 0 && 'start' in parsed[0]) {
          return parsed
        }
      } catch {
        continue
      }
    }
  }

  // Strategy 3: 코드블록 내 JSON 추출
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (codeBlockMatch) {
    try {
      const parsed = JSON.parse(codeBlockMatch[1].trim())
      if (Array.isArray(parsed)) return parsed
    } catch {
      // 파싱 실패
    }
  }

  throw new Error('Failed to parse chunk boundaries from LLM response')
}

// =============================================================================
// [P3-01-01] 프롬프트 빌더
// =============================================================================

/**
 * 청크 분석 프롬프트 생성
 * 
 * @description
 * 시니어 개발자 주석:
 * - 문서를 8000자로 제한 (LLM 컨텍스트 고려)
 * - 명확한 출력 형식 지정으로 파싱 성공률 향상
 */
function buildChunkAnalysisPrompt(
  text: string,
  options: { maxChunkTokens: number; minChunkTokens: number }
): string {
  const truncatedText = text.substring(0, MAX_TEXT_LENGTH_FOR_LLM)
  const isTruncated = text.length > MAX_TEXT_LENGTH_FOR_LLM

  return `You are a document structure analyst. Analyze the following document and identify optimal chunk boundaries.

RULES:
1. Each chunk should be approximately ${options.minChunkTokens}-${options.maxChunkTokens} tokens (roughly ${options.minChunkTokens * 3}-${options.maxChunkTokens * 3} characters for Korean).
2. Never split in the middle of a concept, rule, or example.
3. Keep related content together (e.g., a rule and its example should be in the same chunk).
4. Identify the chunk type: 'rule', 'example', 'criteria', 'evidence', 'general'.
5. The 'start' and 'end' values are CHARACTER positions (0-indexed).

DOCUMENT${isTruncated ? ' (truncated)' : ''}:
"""
${truncatedText}
"""

OUTPUT FORMAT (JSON array only, no markdown):
[
  { "start": 0, "end": 500, "reason": "Introduction section", "type": "general" },
  { "start": 501, "end": 1200, "reason": "First rule with example", "type": "rule" },
  { "start": 1201, "end": 1800, "reason": "Second rule", "type": "rule" }
]

Return ONLY the JSON array, no other text.`
}

// =============================================================================
// [P3-01-01] 경계 검증 및 청크 생성
// =============================================================================

/**
 * 청크 경계 검증 및 보정
 * 
 * @description
 * 주니어 개발자 주석:
 * - 경계 겹침 제거
 * - 누락된 구간 보정
 * - 텍스트 범위 초과 방지
 */
function validateBoundaries(boundaries: ChunkBoundary[], textLength: number): ChunkBoundary[] {
  if (!boundaries || boundaries.length === 0) return []

  const validBoundaries: ChunkBoundary[] = []
  let lastEnd = 0

  // 시작 위치 기준 정렬
  const sorted = [...boundaries].sort((a, b) => (a.start ?? 0) - (b.start ?? 0))

  for (const boundary of sorted) {
    const start = Math.max(boundary.start ?? 0, lastEnd)
    const end = Math.min(boundary.end ?? textLength, textLength)

    if (start < end && end > lastEnd) {
      validBoundaries.push({
        ...boundary,
        start,
        end,
      })
      lastEnd = end
    }
  }

  // 마지막 경계 이후 남은 텍스트 처리
  if (lastEnd < textLength) {
    validBoundaries.push({
      start: lastEnd,
      end: textLength,
      reason: 'Remaining content',
      type: 'general',
    })
  }

  return validBoundaries
}

/**
 * 경계 정보로부터 청크 생성
 */
function createChunksFromBoundaries(
  text: string,
  boundaries: ChunkBoundary[]
): DocumentChunk[] {
  return boundaries.map((boundary, index) => {
    const content = text.substring(boundary.start, boundary.end).trim()
    
    return {
      index,
      content,
      metadata: {
        tokenCount: getTokenCount(content),
        startPosition: boundary.start,
        endPosition: boundary.end,
      },
    }
  }).filter(chunk => chunk.content.length > 0)  // 빈 청크 제거
}

/**
 * 단일 청크 생성 (작은 문서용)
 */
function createSingleChunk(text: string, index: number): DocumentChunk {
  return {
    index,
    content: text.trim(),
    metadata: {
      tokenCount: getTokenCount(text),
      startPosition: 0,
      endPosition: text.length,
      chunkType: classifyChunkType(text),
    },
  }
}

/**
 * LLM 경계 타입을 ChunkType으로 매핑
 * 
 * @description
 * P3-01: criteria/evidence는 체크리스트에 있으나 ChunkType에는 없음
 * → 가장 유사한 타입으로 fallback
 */
function mapBoundaryType(type?: string): ChunkType | undefined {
  const typeMap: Record<string, ChunkType> = {
    'rule': 'rule',
    'example': 'example',
    'criteria': 'rule',      // criteria → rule로 매핑
    'evidence': 'example',   // evidence → example로 매핑
    'general': 'general',
  }
  return type ? typeMap[type] : undefined
}
