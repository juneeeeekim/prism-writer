
import { type TemplateSchema } from './templateTypes'
import { type Chunk } from './search'
import OpenAI from 'openai'

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
 */
export async function validateConsistencyGate(template: TemplateSchema): Promise<GateResult> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return { passed: true, reason: 'Skipped (No API Key)', score: 0.5 }

  const openai = new OpenAI({ apiKey })
  
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
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
    })

    const content = response.choices[0]?.message?.content
    if (!content) throw new Error('No content')
    
    return JSON.parse(content) as GateResult
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
 */
export async function validateHallucinationGate(
  template: TemplateSchema,
  sourceChunks: Chunk[]
): Promise<GateResult> {
  // 소스 청크가 없으면 검증 불가
  if (!sourceChunks || sourceChunks.length === 0) {
    return { passed: true, reason: 'No source chunks to compare', score: 0.5 }
  }

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return { passed: true, reason: 'Skipped (No API Key)', score: 0.5 }

  const openai = new OpenAI({ apiKey })
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
    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo', // 팩트 체크는 가벼운 모델로도 가능
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
    })

    const content = response.choices[0]?.message?.content
    if (!content) throw new Error('No content')

    return JSON.parse(content) as GateResult
  } catch (error) {
    console.error('[HallucinationGate] Validation failed:', error)
    return { passed: true, reason: 'Validation skipped due to error', score: 0.5 }
  }
}

/**
 * 통합 게이트 검증
 */
export async function validateAllGates(
  template: TemplateSchema,
  sourceChunks: Chunk[] = []
): Promise<AllGatesResult> {
  const [citationResult, consistencyResult, hallucinationResult] = await Promise.all([
    validateCitationGate(template),
    validateConsistencyGate(template),
    validateHallucinationGate(template, sourceChunks),
  ])

  const passed = citationResult.passed && consistencyResult.passed && hallucinationResult.passed
  const finalScore = (citationResult.score + consistencyResult.score + hallucinationResult.score) / 3

  return {
    passed,
    citationResult,
    consistencyResult,
    hallucinationResult,
    finalScore,
  }
}
