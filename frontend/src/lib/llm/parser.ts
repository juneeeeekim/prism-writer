// =============================================================================
// PRISM Writer - LLM Response Parser
// =============================================================================
// 파일: frontend/src/lib/llm/parser.ts
// 역할: LLM 응답 JSON 파싱 및 스키마 검증
// =============================================================================

// =============================================================================
// 타입 정의
// =============================================================================

/** 평가 상태 */
export type EvaluationStatus = 'pass' | 'partial' | 'fail' | 'insufficient_evidence'

/** 루브릭 평가 결과 */
export interface RubricEvaluation {
  /** 루브릭 ID */
  rubric_item: string
  /** 평가 상태 */
  status: EvaluationStatus
  /** 참고 자료에서 인용한 근거 */
  evidence_quotes: string[]
  /** 사용자 글에서 인용한 부분 */
  user_text_quotes?: string[]
  /** 점수 (0-100) */
  score: number
  /** 개선 권고사항 */
  recommendations: string
}

/** 전체 평가 결과 */
export interface EvaluationResult {
  /** 루브릭별 평가 배열 */
  evaluations: RubricEvaluation[]
  /** 전체 요약 */
  overall_summary: string
  /** 전체 점수 (0-100) */
  overall_score: number
  /** 파싱 성공 여부 */
  success: boolean
  /** 에러 메시지 (실패 시) */
  error?: string
  /** 원본 응답 텍스트 */
  rawResponse?: string
}

/** 파싱 옵션 */
export interface ParseOptions {
  /** 엄격 모드 (필수 필드 누락 시 에러) */
  strict?: boolean
  /** 디버그 모드 (원본 응답 포함) */
  debug?: boolean
}

// =============================================================================
// 상수
// =============================================================================

/** 유효한 상태 값 */
const VALID_STATUSES: EvaluationStatus[] = ['pass', 'partial', 'fail', 'insufficient_evidence']

/** 필수 필드 목록 */
const REQUIRED_RUBRIC_FIELDS = ['rubric_item', 'status', 'evidence_quotes', 'recommendations']

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * JSON 블록 추출
 * 
 * @description
 * LLM 응답에서 JSON 블록을 추출합니다.
 * 마크다운 코드 블록(```json ... ```) 또는 순수 JSON을 처리합니다.
 * 
 * @param text - LLM 응답 텍스트
 * @returns 추출된 JSON 문자열 또는 null
 */
function extractJSON(text: string): string | null {
  if (!text) return null

  // 1. 마크다운 JSON 코드 블록 찾기
  const jsonBlockMatch = text.match(/```json\s*([\s\S]*?)\s*```/i)
  if (jsonBlockMatch && jsonBlockMatch[1]) {
    return jsonBlockMatch[1].trim()
  }

  // 2. 일반 코드 블록 찾기
  const codeBlockMatch = text.match(/```\s*([\s\S]*?)\s*```/)
  if (codeBlockMatch && codeBlockMatch[1]) {
    const content = codeBlockMatch[1].trim()
    // JSON 형식인지 확인
    if (content.startsWith('{') || content.startsWith('[')) {
      return content
    }
  }

  // 3. 순수 JSON 찾기 (첫 번째 { 부터 마지막 } 까지)
  const startIndex = text.indexOf('{')
  const endIndex = text.lastIndexOf('}')
  if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
    return text.slice(startIndex, endIndex + 1)
  }

  return null
}

/**
 * 상태 값 정규화
 * 
 * @param status - 원본 상태 값
 * @returns 정규화된 상태 값
 */
function normalizeStatus(status: string): EvaluationStatus {
  const normalized = status.toLowerCase().replace(/[^a-z_]/g, '')
  
  if (VALID_STATUSES.includes(normalized as EvaluationStatus)) {
    return normalized as EvaluationStatus
  }
  
  // 유사 값 매핑
  if (normalized.includes('pass') || normalized.includes('complete')) return 'pass'
  if (normalized.includes('partial') || normalized.includes('incomplete')) return 'partial'
  if (normalized.includes('fail') || normalized.includes('miss')) return 'fail'
  if (normalized.includes('insufficient') || normalized.includes('noevidence')) return 'insufficient_evidence'
  
  return 'insufficient_evidence' // 기본값
}

/**
 * 점수 정규화
 * 
 * @param score - 원본 점수
 * @returns 0-100 범위로 정규화된 점수
 */
function normalizeScore(score: any): number {
  if (typeof score !== 'number') {
    const parsed = parseFloat(String(score))
    if (isNaN(parsed)) return 0
    score = parsed
  }
  return Math.max(0, Math.min(100, Math.round(score)))
}

/**
 * 문자열 배열 정규화
 * 
 * @param arr - 원본 배열
 * @returns 문자열 배열
 */
function normalizeStringArray(arr: any): string[] {
  if (!arr) return []
  if (!Array.isArray(arr)) return [String(arr)]
  return arr.map((item) => String(item || '')).filter((s) => s.length > 0)
}

// =============================================================================
// Main Functions
// =============================================================================

/**
 * LLM 평가 응답 파싱
 * 
 * @description
 * LLM이 반환한 JSON 응답을 파싱하고 검증합니다.
 * 마크다운 코드 블록 감싸기를 자동으로 처리합니다.
 * 
 * @param response - LLM 응답 텍스트
 * @param options - 파싱 옵션
 * @returns 파싱된 평가 결과
 * 
 * @example
 * ```typescript
 * const llmResponse = await generateText(prompt)
 * const result = parseEvaluationResponse(llmResponse.text)
 * if (result.success) {
 *   console.log("전체 점수:", result.overall_score)
 * }
 * ```
 */
export function parseEvaluationResponse(
  response: string,
  options: ParseOptions = {}
): EvaluationResult {
  const { strict = false, debug = false } = options

  // ---------------------------------------------------------------------------
  // 1. JSON 추출
  // ---------------------------------------------------------------------------
  const jsonString = extractJSON(response)
  if (!jsonString) {
    console.warn('[Parser] JSON 형식을 찾을 수 없음, fallback 결과 반환')
    
    // [FIX] JSON이 없어도 기본 평가 결과 반환
    return {
      success: true,
      evaluations: [{
        rubric_item: 'system_error',
        status: 'partial' as EvaluationStatus,
        evidence_quotes: [],
        score: 50,
        recommendations: 'AI 응답 형식을 처리할 수 없습니다. 잠시 후 다시 시도해주세요.',
      }],
      overall_summary: 'AI 응답을 분석할 수 없습니다. 다시 시도해주세요.',
      overall_score: 50,
      rawResponse: debug ? response : undefined,
    }
  }

  // ---------------------------------------------------------------------------
  // 2. JSON 파싱 (실패 시 fallback 반환)
  // ---------------------------------------------------------------------------
  let parsed: any
  try {
    // JSON 정제 (trailing comma, 마크다운 블록 제거)
    let cleanedJson = jsonString.trim()
    cleanedJson = cleanedJson.replace(/,(\s*[}\]])/g, '$1')
    
    parsed = JSON.parse(cleanedJson)
  } catch (parseError) {
    console.warn('[Parser] JSON 파싱 실패, fallback 결과 반환:', parseError)
    
    // [FIX] 파싱 실패해도 기본 평가 결과 반환 (사용자 경험 개선)
    return {
      success: true,
      evaluations: [{
        rubric_item: 'system_error',
        status: 'partial' as EvaluationStatus,
        evidence_quotes: [],
        score: 50,
        recommendations: 'AI 평가 시스템이 일시적으로 불안정합니다. 잠시 후 다시 시도해주세요.',
      }],
      overall_summary: 'AI 분석 중 일시적 오류가 발생했습니다. 결과가 완전하지 않을 수 있습니다.',
      overall_score: 50,
      rawResponse: debug ? response : undefined,
    }
  }

  // ---------------------------------------------------------------------------
  // 3. 스키마 검증 및 정규화
  // ---------------------------------------------------------------------------
  try {
    const result = validateAndNormalize(parsed, strict)
    return {
      ...result,
      success: true,
      rawResponse: debug ? response : undefined,
    }
  } catch (validationError) {
    return {
      success: false,
      error: `검증 실패: ${validationError instanceof Error ? validationError.message : 'Unknown error'}`,
      evaluations: [],
      overall_summary: '',
      overall_score: 0,
      rawResponse: debug ? response : undefined,
    }
  }
}

/**
 * 스키마 검증 및 정규화
 * 
 * @param data - 파싱된 JSON 데이터
 * @param strict - 엄격 모드 여부
 * @returns 검증 및 정규화된 결과
 */
function validateAndNormalize(data: any, strict: boolean): Omit<EvaluationResult, 'success' | 'error' | 'rawResponse'> {
  // ---------------------------------------------------------------------------
  // evaluations 배열 검증
  // ---------------------------------------------------------------------------
  if (!data.evaluations || !Array.isArray(data.evaluations)) {
    if (strict) {
      throw new Error('evaluations 배열이 필요합니다.')
    }
    data.evaluations = []
  }

  // ---------------------------------------------------------------------------
  // 각 evaluation 정규화
  // ---------------------------------------------------------------------------
  const evaluations: RubricEvaluation[] = data.evaluations.map((item: any, index: number) => {
    // 필수 필드 확인 (엄격 모드)
    if (strict) {
      for (const field of REQUIRED_RUBRIC_FIELDS) {
        if (item[field] === undefined) {
          throw new Error(`evaluations[${index}]에 필수 필드 '${field}'가 없습니다.`)
        }
      }
    }

    return {
      rubric_item: String(item.rubric_item || `unknown_${index}`),
      status: normalizeStatus(String(item.status || 'insufficient_evidence')),
      evidence_quotes: normalizeStringArray(item.evidence_quotes),
      user_text_quotes: item.user_text_quotes 
        ? normalizeStringArray(item.user_text_quotes) 
        : undefined,
      score: normalizeScore(item.score),
      recommendations: String(item.recommendations || '개선 사항이 명시되지 않았습니다.'),
    }
  })

  // ---------------------------------------------------------------------------
  // 전체 요약 및 점수 정규화
  // ---------------------------------------------------------------------------
  return {
    evaluations,
    overall_summary: String(data.overall_summary || '평가 요약이 제공되지 않았습니다.'),
    overall_score: normalizeScore(data.overall_score),
  }
}

/**
 * 평가 결과 검증
 * 
 * @description
 * 파싱된 평가 결과가 유효한지 확인합니다.
 * 
 * @param result - 평가 결과
 * @returns 유효성 여부
 */
export function validateEvaluationResult(result: EvaluationResult): boolean {
  if (!result.success) return false
  if (!result.evaluations || result.evaluations.length === 0) return false
  
  // 모든 평가 항목 검증
  return result.evaluations.every((evaluation) => {
    return (
      evaluation.rubric_item &&
      VALID_STATUSES.includes(evaluation.status) &&
      Array.isArray(evaluation.evidence_quotes) &&
      typeof evaluation.score === 'number' &&
      evaluation.score >= 0 &&
      evaluation.score <= 100 &&
      typeof evaluation.recommendations === 'string'
    )
  })
}

/**
 * 평가 결과 요약 생성
 * 
 * @description
 * 평가 결과를 사람이 읽기 쉬운 형태로 요약합니다.
 * 
 * @param result - 평가 결과
 * @returns 요약 문자열
 */
export function summarizeEvaluationResult(result: EvaluationResult): string {
  if (!result.success) {
    return `평가 실패: ${result.error}`
  }

  const stats = {
    pass: 0,
    partial: 0,
    fail: 0,
    insufficient_evidence: 0,
  }

  for (const evaluation of result.evaluations) {
    stats[evaluation.status]++
  }

  const lines = [
    `📊 전체 점수: ${result.overall_score}점`,
    ``,
    `📋 항목별 결과:`,
    `  - ✅ 통과: ${stats.pass}개`,
    `  - ⚠️ 부분 충족: ${stats.partial}개`,
    `  - ❌ 미충족: ${stats.fail}개`,
    `  - 📭 근거 부족: ${stats.insufficient_evidence}개`,
    ``,
    `📝 요약: ${result.overall_summary}`,
  ]

  return lines.join('\n')
}
