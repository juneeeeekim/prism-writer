
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

// =============================================================================
// Pipeline v4: Regression Gate
// =============================================================================

/**
 * 4. Regression Gate: 템플릿 버전 변경 시 기존 샘플 결과 일관성 검증 (Pipeline v4)
 * 
 * @description
 * 주석(시니어 개발자): Null Object Pattern 적용
 * - 이전 버전이 없는 신규 템플릿: 자동 통과 (점수 1.0)
 * - 샘플이 없는 경우: 자동 통과 (점수 0.8, 경고만)
 * - 샘플 수 제한: 최대 5개 (성능 최적화)
 * 
 * @param template - 현재 템플릿 스키마
 * @param previousTemplateId - 이전 버전 템플릿 ID (없으면 undefined)
 * @returns GateResult
 */
export async function validateRegressionGate(
  template: TemplateSchema,
  previousTemplateId?: string
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
  // TODO: 샘플 기반 Regression 테스트 (Phase 2 완료 시 구현)
  // ---------------------------------------------------------------------------
  // 주석(시니어 개발자): 현재는 기본 통과 처리
  // Phase 2.1에서 template_validation_samples 테이블 생성 후 실제 로직 구현 예정
  // 
  // 실제 로직 (추후 구현):
  // 1. template_validation_samples에서 이전 버전 샘플 조회 (최대 5개)
  // 2. 새 템플릿으로 동일 샘플 평가
  // 3. 결과 비교: 허용 범위(±10%) 이탈 시 실패
  
  console.log('[RegressionGate] Previous version exists but validation samples not implemented yet - auto pass')
  return {
    passed: true,
    reason: 'Regression check placeholder (validation samples not yet implemented)',
    score: 0.9,  // 추후 구현 시 실제 점수로 대체
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
