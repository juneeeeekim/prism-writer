// =============================================================================
// PRISM Writer - Pattern Extractor
// =============================================================================
// 파일: frontend/src/lib/rag/patternExtractor.ts
// 역할: 업로드 문서에서 형식 패턴(훅/CTA/비유 등)을 LLM으로 추출
// 생성일: 2026-01-03
// =============================================================================

import { generateText } from '../llm/gateway'
import { FEATURE_FLAGS } from '../../config/featureFlags'

// =============================================================================
// [PATTERN] 타입 정의
// =============================================================================

/** 패턴 타입 (DB pattern_type 컨럼과 매칭) - 확장됨 (12 → 20개) */
export type PatternType = 
  | 'hook'            // 도입 훅
  | 'problem'         // 문제 정의
  | 'cause'           // 원인 분석
  | 'solution'        // 해결책 제시
  | 'evidence'        // 근거/증거
  | 'cta'             // 행동 유도
  | 'metaphor'        // 비유/은유
  | 'contrast'        // 대비/비교
  | 'statistics'      // 숫자/통계
  | 'rebuttal'        // 반박 선제처리
  | 'question'        // 질문 활용
  | 'repetition'      // 반복 구조
  // [NEW] 확장된 패턴 타입 (8개 추가)
  | 'story'           // 스토리텔링/일화
  | 'analogy'         // 유추/비교 논증
  | 'authority'       // 권위 인용
  | 'social_proof'    // 사회적 증거
  | 'scarcity'        // 희소성/긴급성
  | 'transition'      // 전환 문구
  | 'summary'         // 요약/정리
  | 'callback'        // 콜백/연결

/** 청크 데이터 (검색 결과에서 가져옴) */
export interface ChunkData {
  chunkId: string
  content: string
  documentId?: string
  metadata?: Record<string, unknown>
}

/** 패턴 추출 결과 (LLM 출력) */
export interface RuleCandidate {
  pattern_type: PatternType
  rule_text: string
  why_it_works: string
  query_hints: string[]
  evidence_quote: string
  evidence_chunk_id?: string
}

/** 패턴 추출 옵션 */
export interface PatternExtractionOptions {
  targetCount: number
  patternScope: 'script' | 'lecture' | 'both'
  existingPatterns?: string[]  // [NEW] 제외할 기존 패턴 목록
}

// =============================================================================
// [PATTERN] 메인 함수: 패턴 추출
// =============================================================================

/**
 * 청크에서 형식 패턴을 추출합니다.
 * 
 * @param chunks - 분석할 청크 배열
 * @param options - 추출 옵션 (targetCount, patternScope)
 * @returns 추출된 RuleCandidate 배열
 * @throws Error - Feature Flag 비활성화, LLM 실패, 빈 응답 시
 */
export async function extractPatterns(
  chunks: ChunkData[],
  options: PatternExtractionOptions
): Promise<RuleCandidate[]> {
  // [SAFETY] Feature Flag 확인
  if (!FEATURE_FLAGS.ENABLE_PATTERN_EXTRACTION) {
    throw new Error('Pattern extraction is disabled. Set ENABLE_PATTERN_EXTRACTION=true')
  }

  // [SAFETY] 빈 청크 확인
  if (!chunks || chunks.length === 0) {
    throw new Error('Pattern extraction failed: no chunks provided')
  }

  // 1. 프롬프트 생성
  const prompt = buildPatternExtractionPrompt(chunks, options)

  // 2. LLM 호출 (재시도 로직 포함)
  let response: string | null = null
  let lastError: Error | null = null

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const result = await generateText(prompt, {
        model: 'gemini-3-flash-preview',
      })
      response = result.text
      break
    } catch (error) {
      lastError = error as Error
      console.warn(`[PatternExtractor] Attempt ${attempt}/3 failed:`, error)
      if (attempt < 3) {
        await delay(1000 * attempt) // 점진적 대기
      }
    }
  }

  // [SAFETY] LLM 호출 실패
  if (!response) {
    throw new Error(`Pattern extraction failed after 3 attempts: ${lastError?.message}`)
  }

  // [DEBUG] LLM 응답 로깅
  console.log('[PatternExtractor] LLM response length:', response.length)
  console.log('[PatternExtractor] LLM response preview:', response.substring(0, 200))

  // 3. JSON 파싱
  const candidates = parsePatternResponse(response)

  // [SAFETY] 빈 응답 확인 - 더 자세한 에러
  if (!candidates || candidates.length === 0) {
    console.error('[PatternExtractor] Empty candidates. Full response:', response)
    throw new Error(`Pattern extraction failed: LLM returned no valid patterns. Response length: ${response.length}, Preview: ${response.substring(0, 100)}`)
  }

  // 4. 청크 ID 매핑 (evidence_quote이 포함된 청크 찾기)
  const mappedCandidates = candidates.map(candidate => ({
    ...candidate,
    evidence_chunk_id: findChunkByQuote(chunks, candidate.evidence_quote),
  }))

  return mappedCandidates
}

// =============================================================================
// [PATTERN] 프롬프트 빌더
// =============================================================================

/**
 * 패턴 추출용 프롬프트를 생성합니다.
 */
function buildPatternExtractionPrompt(
  chunks: ChunkData[],
  options: PatternExtractionOptions
): string {
  const { targetCount, patternScope, existingPatterns } = options

  const scopeDescription = {
    script: '이 텍스트는 실제 스크립트/글입니다. 글에서 사용된 패턴을 분석하세요.',
    lecture: '이 텍스트는 강의 내용입니다. 강사가 설명하는 글쓰기 규칙/원칙을 추출하세요.',
    both: '이 텍스트는 스크립트와 강의가 혼합되어 있습니다. 실제 사용된 패턴과 설명된 규칙 모두 추출하세요.',
  }

  const chunksText = chunks
    .map((c, i) => `[청크 ${i + 1}]\n${c.content}`)
    .join('\n\n---\n\n')

  // [NEW] 기존 패턴 제외 목록
  const exclusionSection = existingPatterns && existingPatterns.length > 0
    ? `\n# ⚠️ 이미 추출된 패턴 (중복 금지)\n다음 규칙들은 이미 있습니다. 이와 다른 새로운 패턴만 추출하세요:\n${existingPatterns.map((p, i) => `${i + 1}. ${p}`).join('\n')}\n`
    : ''

  return `# 역할
당신은 글쓰기 패턴 분석 전문가입니다. 
${scopeDescription[patternScope]}
${exclusionSection}
# 입력 청크
${chunksText}

# 추출할 패턴 유형 (주제 무관, 형식만 분석) - 20가지
- hook: 도입 훅 (질문/통계/도발로 시작)
- problem: 문제 정의
- cause: 원인 분석
- solution: 해결책 제시
- evidence: 근거/증거 제시
- cta: 행동 유도 (구체적 요청)
- metaphor: 비유/은유 활용
- contrast: 대비/비교 프레임
- statistics: 숫자/통계 활용
- rebuttal: 반박 선제처리
- question: 질문 활용
- repetition: 반복 구조
- story: 스토리텔링/일화
- analogy: 유추/비교 논증
- authority: 권위 인용
- social_proof: 사회적 증거 (사례/후기)
- scarcity: 희소성/긴급성
- transition: 전환 문구
- summary: 요약/정리
- callback: 콜백/연결 (앞뒤 내용 참조)

# 출력 형식 (JSON 배열)
반드시 아래 JSON 형식으로 ${targetCount}개의 **새로운** 패턴을 출력하세요.
각 패턴은 **주제와 무관하게 다른 글에도 적용 가능한 형식적 규칙**이어야 합니다.
${existingPatterns && existingPatterns.length > 0 ? '⚠️ 위에서 제외한 패턴과 유사한 것은 출력하지 마세요.\n' : ''}
\`\`\`json
[
  {
    "pattern_type": "hook",
    "rule_text": "도입부 첫 문장에 독자의 이익을 명시한다",
    "why_it_works": "독자가 계속 읽어야 할 이유를 즉시 제공",
    "query_hints": ["도입", "첫 문장", "이익"],
    "evidence_quote": "원문에서 발췌한 예시 문장..."
  }
]
\`\`\`

중요:
1. pattern_type은 위 20개 중 하나여야 함
2. rule_text는 주제어 없이 형식만 설명
3. evidence_quote는 반드시 입력 청크에 있는 원문 그대로
4. JSON만 출력 (추가 설명 금지)
5. 이미 있는 패턴과 중복되지 않는 새로운 규칙만 출력`
}

// =============================================================================
// [PATTERN] Helper Functions
// =============================================================================

/**
 * LLM 응답을 JSON으로 파싱합니다.
 * [FIX] 더 관대한 파싱 + 기본값 처리 + 상세 로깅
 */
function parsePatternResponse(response: string): RuleCandidate[] {
  try {
    // 1. 코드 블록 제거 (더 강력한 방식)
    let jsonStr = response.trim()
    
    console.log('[PatternExtractor] Raw response length:', jsonStr.length)
    console.log('[PatternExtractor] Raw response first 100:', jsonStr.substring(0, 100))
    
    // ```json 또는 ``` 시작 제거 (단순 문자열 방식)
    if (jsonStr.startsWith('```json')) {
      jsonStr = jsonStr.slice(7)
    } else if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.slice(3)
    }
    
    // 끝에 ``` 제거 (있는 경우만)
    if (jsonStr.endsWith('```')) {
      jsonStr = jsonStr.slice(0, -3)
    }
    
    jsonStr = jsonStr.trim()
    
    // [ 로 시작하는지 확인, 아니면 [ 찾기
    const arrayStart = jsonStr.indexOf('[')
    if (arrayStart > 0) {
      jsonStr = jsonStr.slice(arrayStart)
      console.log('[PatternExtractor] Trimmed to array start')
    }

    console.log('[PatternExtractor] Cleaned JSON length:', jsonStr.length)
    console.log('[PatternExtractor] JSON preview (first 300):', jsonStr.substring(0, 300))

    // 2. JSON 파싱 시도
    let parsed: unknown
    try {
      parsed = JSON.parse(jsonStr)
    } catch (parseError) {
      // 잘린 JSON 복구 시도 (마지막 유효한 객체까지)
      console.warn('[PatternExtractor] JSON parse failed, attempting recovery...')
      const lastValidIndex = jsonStr.lastIndexOf('}')
      if (lastValidIndex > 0) {
        const truncatedJson = jsonStr.substring(0, lastValidIndex + 1) + ']'
        try {
          parsed = JSON.parse(truncatedJson)
          console.log('[PatternExtractor] Recovery successful with truncated JSON')
        } catch {
          console.error('[PatternExtractor] Recovery also failed')
          throw parseError
        }
      } else {
        throw parseError
      }
    }
    
    // 3. 배열 확인
    if (!Array.isArray(parsed)) {
      console.error('[PatternExtractor] Response is not an array:', typeof parsed)
      return []
    }

    console.log('[PatternExtractor] Parsed array length:', parsed.length)

    // 4. 각 항목 검증 (관대한 검증 + 기본값)
    const validCandidates: RuleCandidate[] = []
    
    for (let i = 0; i < parsed.length; i++) {
      const item = parsed[i] as Record<string, unknown>
      
      // 필수 필드: pattern_type, rule_text
      if (typeof item.pattern_type !== 'string' || typeof item.rule_text !== 'string') {
        console.warn(`[PatternExtractor] Item ${i} missing required fields:`, {
          hasPatternType: typeof item.pattern_type,
          hasRuleText: typeof item.rule_text,
        })
        continue
      }

      // 관대한 처리: 선택 필드에 기본값 제공
      validCandidates.push({
        pattern_type: item.pattern_type as PatternType,
        rule_text: item.rule_text as string,
        why_it_works: typeof item.why_it_works === 'string' ? item.why_it_works : '',
        query_hints: Array.isArray(item.query_hints) ? item.query_hints : [],
        evidence_quote: typeof item.evidence_quote === 'string' ? item.evidence_quote : '',
      })
    }

    console.log('[PatternExtractor] Valid candidates after filtering:', validCandidates.length)
    
    return validCandidates
  } catch (error) {
    console.error('[PatternExtractor] JSON parse failed:', error)
    console.error('[PatternExtractor] Raw response length:', response.length)
    console.error('[PatternExtractor] Raw response first 500 chars:', response.substring(0, 500))
    return []
  }
}

/**
 * evidence_quote가 포함된 청크를 찾습니다.
 */
function findChunkByQuote(chunks: ChunkData[], quote: string): string | undefined {
  if (!quote || quote.length < 10) return undefined

  for (const chunk of chunks) {
    if (chunk.content.includes(quote.substring(0, 50))) {
      return chunk.chunkId
    }
  }
  return undefined
}

/**
 * 지연 함수 (재시도 간 대기)
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}
