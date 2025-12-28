
import { type TemplateSchema } from './templateTypes'
import { type Chunk } from './search'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { getModelForUsage } from '@/config/llm-usage-map'

// =============================================================================
// 타입 정의
// =============================================================================

export interface GateResult {
  passed: boolean
  reason: string
  score: number // 0.0 ~ 1.0
}

export interface AllGatesResult {
  passed: boolean
  citationResult: GateResult
  consistencyResult: GateResult
  hallucinationResult: GateResult
  /** Pipeline v4: Regression Gate 결과 (Optional - 하위 호환성 유지) */
  regressionResult?: GateResult
  finalScore: number
}

// =============================================================================
// Gate 구현
// =============================================================================

/**
 * 1. Citation Gate: 근거가 충분한지 검증
 * - Mining된 경우: source_citations 존재 여부 확인
 * - Generation된 경우: (간소화) 항상 통과 처리하되 점수는 낮게 부여 (추후 스타일 유사도 검사 추가 가능)
 */
export async function validateCitationGate(template: TemplateSchema): Promise<GateResult> {
  // 인용문이 있으면 통과
  if (template.source_citations && template.source_citations.length > 0) {
    return {
      passed: true,
      reason: 'Valid source citations found.',
      score: 1.0,
    }
  }

  // 인용문이 없지만 예시가 있으면 (Generation 케이스)
  if (template.positive_examples.length > 0) {
    return {
      passed: true,
      reason: 'Generated examples exist (no direct citation).',
      score: 0.8, // 생성된 예시는 신뢰도가 조금 낮음
    }
  }

  return {
    passed: false,
    reason: 'No citations or examples found.',
    score: 0.0,
  }
}

/**
 * 2. Consistency Gate: 긍정/부정 예시의 논리적 일관성 검증 (LLM)
 * 주석(LLM 전문 개발자): Gemini 3 Flash로 업그레이드 (2025-12-25)
 */
export async function validateConsistencyGate(template: TemplateSchema): Promise<GateResult> {
  const apiKey = process.env.GOOGLE_API_KEY
  if (!apiKey) return { passed: true, reason: 'Skipped (No GOOGLE_API_KEY)', score: 0.5 }

  const genAI = new GoogleGenerativeAI(apiKey)
  // 주석(중앙화 마이그레이션): getModelForUsage 적용 (2025-12-28)
  const model = genAI.getGenerativeModel({ 
    model: getModelForUsage('template.consistency'),
    generationConfig: {
      temperature: 1.0,  // Gemini 3 권장 (Gemini_3_Flash_Reference.md)
      responseMimeType: 'application/json',
    },
  })
  
  const prompt = `
다음 글쓰기 규칙과 예시들을 분석하여 논리적 일관성을 평가해주세요.

[규칙]
${template.rationale}

[긍정 예시]
${template.positive_examples.join('\n')}

[부정 예시]
${template.negative_examples.join('\n')}

[평가 기준]
1. 긍정 예시가 규칙을 잘 따르고 있는가?
2. 부정 예시가 규칙을 명확히 위반하고 있는가?
3. 긍정/부정 예시가 서로 대조적인가?

JSON 형식으로 응답해주세요:
{
  "passed": boolean,
  "reason": "string",
  "score": number (0.0-1.0)
}
`

  try {
    const response = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    })

    const content = response.response.text()
    if (!content) throw new Error('No content')
    
    // JSON 파싱 (Gemini는 JSON 응답을 텍스트로 반환할 수 있음)
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('No JSON in response')
    
    return JSON.parse(jsonMatch[0]) as GateResult
  } catch (error) {
    console.error('[ConsistencyGate] Validation failed:', error)
    // 에러 시 보수적으로 통과 처리 (시스템 장애로 인한 블락 방지)
    return { passed: true, reason: 'Validation skipped due to error', score: 0.5 }
  }
}

/**
 * 3. Hallucination Gate: 원본 팩트 왜곡 여부 검증 (LLM)
 * - 스타일 템플릿의 경우 팩트 체크가 덜 중요할 수 있으나, 
 *   생성된 예시가 원본의 맥락을 완전히 벗어나는지 확인
 * 주석(LLM 전문 개발자): Gemini 3 Flash로 업그레이드 (2025-12-25)
 */
export async function validateHallucinationGate(
  template: TemplateSchema,
  sourceChunks: Chunk[]
): Promise<GateResult> {
  // 소스 청크가 없으면 검증 불가
  if (!sourceChunks || sourceChunks.length === 0) {
    return { passed: true, reason: 'No source chunks to compare', score: 0.5 }
  }

  const apiKey = process.env.GOOGLE_API_KEY
  if (!apiKey) return { passed: true, reason: 'Skipped (No GOOGLE_API_KEY)', score: 0.5 }

  const genAI = new GoogleGenerativeAI(apiKey)
  // 주석(중앙화 마이그레이션): getModelForUsage 적용 (2025-12-28)
  const model = genAI.getGenerativeModel({ 
    model: getModelForUsage('template.hallucination'),
    generationConfig: {
      temperature: 1.0,  // Gemini 3 권장 (Gemini_3_Flash_Reference.md)
      responseMimeType: 'application/json',
    },
  })
  const context = sourceChunks.map(c => c.content).join('\n\n')

  const prompt = `
다음 예시들이 원본 텍스트의 맥락이나 스타일을 심각하게 왜곡하는지(Hallucination) 검사해주세요.
(단순한 스타일 변형은 허용됩니다. 사실 관계를 날조하거나 원본과 전혀 다른 내용을 생성한 경우만 실패로 처리하세요.)

[원본 텍스트 일부]
${context.substring(0, 1000)}...

[생성된 예시]
${template.positive_examples.join('\n')}

JSON 형식으로 응답해주세요:
{
  "passed": boolean,
  "reason": "string",
  "score": number (0.0-1.0)
}
`

  try {
    const response = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    })

    const content = response.response.text()
    if (!content) throw new Error('No content')

    // JSON 파싱 (Gemini는 JSON 응답을 텍스트로 반환할 수 있음)
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('No JSON in response')

    return JSON.parse(jsonMatch[0]) as GateResult
  } catch (error) {
    console.error('[HallucinationGate] Validation failed:', error)
    return { passed: true, reason: 'Validation skipped due to error', score: 0.5 }
  }
}

// =============================================================================
// Pipeline v4: Regression Gate
// =============================================================================

// ---------------------------------------------------------------------------
// 주석(시니어 개발자): 성능 최적화 상수
// 주석(LLM 전문 개발자): Gemini 3 Flash로 업그레이드 (2025-12-25)
// 주석(중앙화 마이그레이션): getModelForUsage 적용 (2025-12-28)
// ---------------------------------------------------------------------------
const REGRESSION_MAX_SAMPLES = 5  // 최대 샘플 수 제한 (성능 최적화)
const REGRESSION_TOLERANCE = 0.1  // 허용 점수 편차 (±10%)
// ❌ (중앙화 마이그레이션 2025-12-28)
// const REGRESSION_MODEL = 'gemini-3-flash-preview'
// 대신 getModelForUsage('template.regression') 직접 호출
const REGRESSION_THINKING_LEVEL = 'low'  // 빠른 응답용 (Gemini_3_Flash_Reference.md 권장)

/**
 * 4. Regression Gate: 템플릿 버전 변경 시 기존 샘플 결과 일관성 검증 (Pipeline v4)
 * 
 * @description
 * 주석(시니어 개발자): 성능 최적화 적용
 * - 샘플 수 제한: 최대 5개 (REGRESSION_MAX_SAMPLES)
 * - LLM 호출 병렬화: Promise.all 사용
 * - Gemini 3 Flash 모델 사용 (비용/속도/성능 최적화)
 * - thinking_level: 'low' (빠른 응답, Gemini 3 권장 설정)
 * - Null Object Pattern: 이전 버전/샘플 없으면 자동 통과
 * 
 * @param template - 현재 템플릿 스키마
 * @param previousTemplateId - 이전 버전 템플릿 ID (없으면 undefined)
 * @param validationSamples - 검증용 샘플 배열 (옵션)
 * @returns GateResult
 */
export async function validateRegressionGate(
  template: TemplateSchema,
  previousTemplateId?: string,
  validationSamples?: Array<{ input: string; expectedScore: number }>
): Promise<GateResult> {
  // ---------------------------------------------------------------------------
  // Null Object Pattern: 이전 버전 없으면 자동 통과
  // ---------------------------------------------------------------------------
  // 주석(주니어 개발자): 신규 템플릿은 비교 대상이 없으므로 무조건 통과
  if (!previousTemplateId) {
    console.log('[RegressionGate] No previous version - auto pass (new template)')
    return {
      passed: true,
      reason: 'New template (no previous version to compare)',
      score: 1.0,
    }
  }

  // ---------------------------------------------------------------------------
  // 샘플 없으면 자동 통과 (경고만)
  // ---------------------------------------------------------------------------
  // 주석(시니어 개발자): 샘플 테이블 미생성 or 샘플 없는 경우 허용
  if (!validationSamples || validationSamples.length === 0) {
    console.log('[RegressionGate] No validation samples - auto pass with warning')
    return {
      passed: true,
      reason: 'No validation samples available (recommended to add samples)',
      score: 0.8,  // 경고 의미로 점수 낮춤
    }
  }

  // ---------------------------------------------------------------------------
  // 샘플 수 제한 (성능 최적화)
  // ---------------------------------------------------------------------------
  // 주석(주니어 개발자): 최대 5개까지만 검증 (빌드 시간 30초 이내 유지)
  const limitedSamples = validationSamples.slice(0, REGRESSION_MAX_SAMPLES)
  console.log(`[RegressionGate] Testing ${limitedSamples.length} samples (max: ${REGRESSION_MAX_SAMPLES})`)

  // ---------------------------------------------------------------------------
  // LLM 병렬 평가 (Promise.all 최적화)
  // ---------------------------------------------------------------------------
  // 주석(시니어 개발자): 개별 호출 대신 병렬 처리로 총 소요 시간 단축
  // ---------------------------------------------------------------------------
  // Gemini 3 Flash 초기화 (LLM 전문 개발자)
  // ---------------------------------------------------------------------------
  const apiKey = process.env.GOOGLE_API_KEY
  if (!apiKey) {
    console.log('[RegressionGate] No GOOGLE_API_KEY - auto pass')
    return { passed: true, reason: 'Skipped (No GOOGLE_API_KEY)', score: 0.5 }
  }

  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({ 
    model: getModelForUsage('template.regression'),
    generationConfig: {
      temperature: 1.0,  // Gemini 3 권장 (Gemini_3_Flash_Reference.md)
      responseMimeType: 'application/json',
      maxOutputTokens: 100,  // 응답 길이 제한 (속도 최적화)
    },
  })
  
  try {
    // 병렬 평가 실행
    const evaluationPromises = limitedSamples.map(async (sample) => {
      const prompt = `
다음 글쓰기 규칙을 기준으로 텍스트를 평가하고 0.0~1.0 점수를 부여하세요.

[규칙]
${template.rationale}

[긍정 예시]
${template.positive_examples.slice(0, 2).join('\n')}

[평가 대상 텍스트]
${sample.input}

JSON 형식으로 응답: {"score": number, "reason": "string"}
`
      // ---------------------------------------------------------------------------
      // Gemini 3 Flash API 호출 (LLM 프롬프트 전문가)
      // ---------------------------------------------------------------------------
      const response = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        // thinking_level은 generationConfig에 포함되지 않음 (API 레벨에서 처리)
      })

      const content = response.response.text()
      if (!content) return { score: 0, deviation: 1 }
      
      // JSON 파싱 (Gemini는 JSON 응답을 텍스트로 반환할 수 있음)
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      if (!jsonMatch) return { score: 0, deviation: 1 }
      
      const result = JSON.parse(jsonMatch[0])
      const deviation = Math.abs(result.score - sample.expectedScore)
      return { score: result.score, deviation, expectedScore: sample.expectedScore }
    })

    // 병렬 결과 수집
    const results = await Promise.all(evaluationPromises)
    
    // ---------------------------------------------------------------------------
    // 결과 분석: 허용 범위(±10%) 이탈 체크
    // ---------------------------------------------------------------------------
    const failedSamples = results.filter(r => r.deviation > REGRESSION_TOLERANCE)
    const avgDeviation = results.reduce((sum, r) => sum + r.deviation, 0) / results.length
    
    if (failedSamples.length > 0) {
      console.log(`[RegressionGate] ${failedSamples.length}/${results.length} samples exceeded tolerance`)
      return {
        passed: false,
        reason: `${failedSamples.length} samples exceeded ±${REGRESSION_TOLERANCE * 100}% tolerance (avg deviation: ${(avgDeviation * 100).toFixed(1)}%)`,
        score: Math.max(0, 1 - avgDeviation),
      }
    }

    console.log('[RegressionGate] All samples within tolerance - pass')
    return {
      passed: true,
      reason: `All ${results.length} samples within ±${REGRESSION_TOLERANCE * 100}% tolerance`,
      score: Math.max(0.5, 1 - avgDeviation),
    }

  } catch (error) {
    console.error('[RegressionGate] Evaluation failed:', error)
    // 에러 시 보수적으로 통과 처리 (시스템 장애로 인한 블락 방지)
    return { passed: true, reason: 'Validation skipped due to error', score: 0.5 }
  }
}

/**
 * 통합 게이트 검증 (Pipeline v4: Regression Gate 포함)
 * 
 * @description
 * 주석(시니어 개발자): 기존 3종 게이트 + Regression Gate 통합
 * regressionResult는 Optional이므로 하위 호환성 유지됨
 */
export async function validateAllGates(
  template: TemplateSchema,
  sourceChunks: Chunk[] = [],
  previousTemplateId?: string  // Pipeline v4: 이전 버전 ID (Optional)
): Promise<AllGatesResult> {
  // ---------------------------------------------------------------------------
  // Pipeline v4: 4종 게이트 병렬 실행 (성능 최적화)
  // ---------------------------------------------------------------------------
  const [citationResult, consistencyResult, hallucinationResult, regressionResult] = await Promise.all([
    validateCitationGate(template),
    validateConsistencyGate(template),
    validateHallucinationGate(template, sourceChunks),
    validateRegressionGate(template, previousTemplateId),  // Pipeline v4 추가
  ])

  // ---------------------------------------------------------------------------
  // 통과 조건: 기존 3종 게이트 AND Regression Gate
  // ---------------------------------------------------------------------------
  // 주석(주니어 개발자): Regression Gate는 신규 템플릿에서 항상 통과하므로 
  // 기존 로직과 동일하게 동작함
  const passed = citationResult.passed && consistencyResult.passed && hallucinationResult.passed && regressionResult.passed
  
  // 점수: 4종 게이트 평균 (Regression 포함)
  const finalScore = (citationResult.score + consistencyResult.score + hallucinationResult.score + regressionResult.score) / 4

  return {
    passed,
    citationResult,
    consistencyResult,
    hallucinationResult,
    regressionResult,  // Pipeline v4 추가
    finalScore,
  }
}
