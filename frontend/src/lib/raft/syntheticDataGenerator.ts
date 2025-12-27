// =============================================================================
// PRISM Writer - Synthetic Data Generator for RAFT Fine-tuning
// =============================================================================
// 파일: frontend/src/lib/raft/syntheticDataGenerator.ts
// 역할: LLM을 사용하여 RAFT 파인튜닝용 합성 Q&A 데이터 생성
// 생성일: 2025-12-27
// 
// [Risk 해결]
// - Risk 1: JSON 파싱 실패 → 재시도 로직 (최대 3회) + Fallback 프롬프트
// - 부분 데이터 저장 지원
// =============================================================================

// =============================================================================
// 타입 정의
// =============================================================================

/** 생성된 Q&A 쌍 */
export interface GeneratedQAPair {
  question: string
  answer: string
}

/** 생성 요청 파라미터 */
export interface GenerationParams {
  context: string       // 참고 자료 내용
  count: number         // 생성할 Q&A 개수
  maxRetries?: number   // 최대 재시도 횟수 (기본 3)
}

/** 생성 결과 */
export interface GenerationResult {
  success: boolean
  data: GeneratedQAPair[]
  errors: string[]
  totalAttempts: number
}

// =============================================================================
// 상수 정의
// =============================================================================

const DEFAULT_MAX_RETRIES = 3
const GENERATION_TIMEOUT_MS = 30000

// =============================================================================
// 프롬프트 템플릿
// =============================================================================

/**
 * LLM에게 Q&A 생성을 요청하는 프롬프트
 * JSON 출력을 명확하게 요청
 */
const GENERATION_PROMPT = `# 역할
당신은 글쓰기 교육 Q&A 데이터를 생성하는 전문가입니다.

# 참고 자료
{context}

# 작업
위 참고 자료를 바탕으로 {count}개의 Q&A 쌍을 생성해주세요.

# 규칙
1. 질문은 참고 자료 내용을 묻는 구체적인 질문이어야 합니다.
2. 정답은 반드시 참고 자료 내용을 인용하거나 참조하여 작성해야 합니다.
3. 각 질문은 최소 10자 이상이어야 합니다.
4. 각 정답은 최소 50자 이상이어야 합니다.

# 출력 형식
반드시 아래 JSON 형식으로만 출력하세요. 다른 텍스트는 포함하지 마세요.

[
  {
    "question": "질문 내용",
    "answer": "참고 자료를 기반으로 한 정답"
  }
]`

/**
 * Fallback 프롬프트 (더 엄격한 JSON 요청)
 * 첫 번째 시도 실패 시 사용
 */
const FALLBACK_PROMPT = `다음 참고 자료를 바탕으로 Q&A를 생성하세요.

참고 자료:
{context}

생성 개수: {count}개

출력:
- 반드시 유효한 JSON 배열만 출력하세요.
- 형식: [{"question": "...", "answer": "..."}]
- JSON 외의 텍스트는 절대 포함하지 마세요.`

// =============================================================================
// 메인 함수
// =============================================================================

/**
 * LLM을 사용하여 합성 Q&A 데이터 생성
 * 
 * @param params - 생성 파라미터 (context, count, maxRetries)
 * @param generateTextFn - 텍스트 생성 함수 (LLM API 호출)
 * @returns GenerationResult - 생성 결과
 * 
 * @description
 * - JSON 파싱 실패 시 재시도 (최대 3회)
 * - 두 번째 시도부터 Fallback 프롬프트 사용
 * - 부분 성공 시에도 유효한 데이터 반환
 */
export async function generateSyntheticData(
  params: GenerationParams,
  generateTextFn: (prompt: string) => Promise<string>
): Promise<GenerationResult> {
  const { context, count, maxRetries = DEFAULT_MAX_RETRIES } = params
  
  const errors: string[] = []
  let totalAttempts = 0
  
  // ---------------------------------------------------------------------------
  // 재시도 루프
  // ---------------------------------------------------------------------------
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    totalAttempts = attempt
    
    try {
      // 첫 번째 시도: 기본 프롬프트, 그 이후: Fallback 프롬프트
      const promptTemplate = attempt === 1 ? GENERATION_PROMPT : FALLBACK_PROMPT
      const prompt = promptTemplate
        .replace('{context}', context)
        .replace('{count}', String(count))
      
      console.log(`[SyntheticDataGenerator] Attempt ${attempt}/${maxRetries}`)
      
      // LLM API 호출
      const rawResponse = await generateTextFn(prompt)
      
      // JSON 파싱 시도
      const parsedData = parseJSONResponse(rawResponse)
      
      // 파싱 성공
      if (parsedData.success && parsedData.data.length > 0) {
        // 품질 검증
        const validatedData = validateGeneratedData(parsedData.data)
        
        if (validatedData.length > 0) {
          console.log(`[SyntheticDataGenerator] Success: ${validatedData.length} Q&A pairs generated`)
          
          return {
            success: true,
            data: validatedData,
            errors,
            totalAttempts,
          }
        } else {
          errors.push(`Attempt ${attempt}: All generated data failed validation`)
        }
      } else {
        errors.push(`Attempt ${attempt}: ${parsedData.error || 'Unknown parsing error'}`)
      }
      
    } catch (error: any) {
      const errorMessage = error.message || 'Unknown error'
      errors.push(`Attempt ${attempt}: ${errorMessage}`)
      console.error(`[SyntheticDataGenerator] Attempt ${attempt} failed:`, errorMessage)
    }
  }
  
  // ---------------------------------------------------------------------------
  // 모든 시도 실패
  // ---------------------------------------------------------------------------
  console.error(`[SyntheticDataGenerator] All ${maxRetries} attempts failed`)
  
  return {
    success: false,
    data: [],
    errors,
    totalAttempts,
  }
}

// =============================================================================
// JSON 파싱 함수
// =============================================================================

interface ParseResult {
  success: boolean
  data: GeneratedQAPair[]
  error?: string
}

/**
 * LLM 응답에서 JSON 배열 추출 및 파싱
 * 
 * @param rawResponse - LLM 원본 응답
 * @returns ParseResult - 파싱 결과
 * 
 * @description
 * - 응답에서 JSON 배열 부분만 추출
 * - 코드 블록 (```json ... ```) 처리
 * - 앞뒤 불필요한 텍스트 제거
 */
function parseJSONResponse(rawResponse: string): ParseResult {
  try {
    // 1. 코드 블록 제거
    let cleaned = rawResponse
      .replace(/```json\s*/gi, '')
      .replace(/```\s*/gi, '')
      .trim()
    
    // 2. JSON 배열 부분만 추출 ([ ... ] 패턴)
    const jsonMatch = cleaned.match(/\[[\s\S]*\]/)
    if (!jsonMatch) {
      return {
        success: false,
        data: [],
        error: 'No JSON array found in response',
      }
    }
    
    cleaned = jsonMatch[0]
    
    // 3. JSON 파싱
    const parsed = JSON.parse(cleaned)
    
    // 4. 배열 타입 검증
    if (!Array.isArray(parsed)) {
      return {
        success: false,
        data: [],
        error: 'Parsed result is not an array',
      }
    }
    
    // 5. 각 항목 구조 검증
    const validItems: GeneratedQAPair[] = []
    for (const item of parsed) {
      if (
        typeof item === 'object' &&
        typeof item.question === 'string' &&
        typeof item.answer === 'string'
      ) {
        validItems.push({
          question: item.question,
          answer: item.answer,
        })
      }
    }
    
    return {
      success: validItems.length > 0,
      data: validItems,
      error: validItems.length === 0 ? 'No valid Q&A pairs found' : undefined,
    }
    
  } catch (error: any) {
    return {
      success: false,
      data: [],
      error: `JSON parse error: ${error.message}`,
    }
  }
}

// =============================================================================
// 품질 검증 함수
// =============================================================================

/**
 * 생성된 Q&A 데이터 품질 검증
 * 
 * @param data - 생성된 Q&A 배열
 * @returns 검증 통과한 Q&A 배열
 * 
 * @description
 * - question: 최소 10자 이상
 * - answer: 최소 50자 이상
 * - 중복 질문 제거
 */
export function validateGeneratedData(data: GeneratedQAPair[]): GeneratedQAPair[] {
  const seenQuestions = new Set<string>()
  const validated: GeneratedQAPair[] = []
  
  for (const item of data) {
    // 길이 검증
    if (item.question.length < 10) {
      console.warn(`[Validation] Question too short: "${item.question.substring(0, 30)}..."`)
      continue
    }
    
    if (item.answer.length < 50) {
      console.warn(`[Validation] Answer too short: "${item.answer.substring(0, 30)}..."`)
      continue
    }
    
    // 중복 검증
    const normalizedQuestion = item.question.toLowerCase().trim()
    if (seenQuestions.has(normalizedQuestion)) {
      console.warn(`[Validation] Duplicate question: "${item.question.substring(0, 30)}..."`)
      continue
    }
    
    seenQuestions.add(normalizedQuestion)
    validated.push(item)
  }
  
  return validated
}

// =============================================================================
// 배치 생성 함수
// =============================================================================

/**
 * 여러 참고 자료에서 배치로 Q&A 생성
 * 
 * @param chunks - 참고 자료 배열
 * @param countPerChunk - 각 chunk당 생성할 Q&A 개수
 * @param generateTextFn - 텍스트 생성 함수
 * @returns 모든 생성된 Q&A 배열 (중복 제거됨)
 */
export async function generateBatch(
  chunks: Array<{ content: string }>,
  countPerChunk: number,
  generateTextFn: (prompt: string) => Promise<string>
): Promise<GenerationResult> {
  const allData: GeneratedQAPair[] = []
  const allErrors: string[] = []
  let totalAttempts = 0
  
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i]
    console.log(`[BatchGeneration] Processing chunk ${i + 1}/${chunks.length}`)
    
    const result = await generateSyntheticData(
      { context: chunk.content, count: countPerChunk },
      generateTextFn
    )
    
    allData.push(...result.data)
    allErrors.push(...result.errors.map(e => `Chunk ${i + 1}: ${e}`))
    totalAttempts += result.totalAttempts
  }
  
  // 전체 중복 제거
  const deduplicated = validateGeneratedData(allData)
  
  return {
    success: deduplicated.length > 0,
    data: deduplicated,
    errors: allErrors,
    totalAttempts,
  }
}
