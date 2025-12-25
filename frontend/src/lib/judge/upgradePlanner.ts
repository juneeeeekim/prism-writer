
import { GoogleGenerativeAI } from '@google/generative-ai'
import { type TemplateSchema } from '../rag/templateTypes'
import { type JudgeResult, type UpgradePlan } from './types'

// =============================================================================
// Helper: JSON Sanitization
// =============================================================================

function sanitizeJSON(text: string): string {
  let cleaned = text.trim()
  
  // 마크다운 코드 블록 제거
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.replace(/^```json\s*/, '').replace(/\s*```$/, '')
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```\s*/, '').replace(/\s*```$/, '')
  }
  
  // trailing comma 제거 (배열 및 객체)
  cleaned = cleaned.replace(/,(\s*[}\]])/g, '$1')
  
  return cleaned.trim()
}

// =============================================================================
// Upgrade Planner (Stage 2)
// =============================================================================

/**
 * 기준을 충족하지 못한 글에 대해 구체적인 수정 계획을 제안합니다.
 * - 모델: gemini-1.5-pro (정교한 추론)
 */
export async function runUpgradePlanner(
  judgeResult: JudgeResult,
  criteria: TemplateSchema
): Promise<UpgradePlan> {
  // Pass인 경우 계획 수립 불필요
  if (judgeResult.status === 'pass') {
    throw new Error('Cannot create upgrade plan for passed criteria')
  }

  const apiKey = process.env.GOOGLE_API_KEY
  if (!apiKey) {
    throw new Error('GOOGLE_API_KEY is missing')
  }

  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' })

  const prompt = `
당신은 전문 글쓰기 코치(Upgrade Planner)입니다.
사용자가 "평가 기준"을 충족하지 못했습니다(Fail 또는 Partial).
이를 해결하기 위한 구체적이고 실행 가능한 "수정 계획"을 세워주세요.

[평가 기준]
내용: ${criteria.rationale}

[판정 결과]
상태: ${judgeResult.status}
이유: ${judgeResult.reasoning}
문제 문장: ${judgeResult.citation || '(전체적인 문제)'}

[참고: 긍정 예시 (따라야 할 스타일)]
${criteria.positive_examples.join('\n')}

[수정 계획 작성 가이드]
1. What: 무엇을 수정해야 하는지 명확히 지적
2. Why: 왜 수정해야 하는지 (독자 관점의 효과) 설명
3. How: 구체적으로 어떻게 고쳐야 하는지 단계별 설명
4. Example: 문제 문장을 긍정 예시 스타일로 수정한 예시 제시

[CRITICAL: JSON 포맷 준수]
반드시 순수 JSON만 출력하세요. 마크다운 코드 블록이나 추가 설명 없이 JSON만 반환하세요.
{
  "what": "string",
  "why": "string",
  "how": "string",
  "example": "string"
}
`

  try {
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { 
        responseMimeType: 'application/json',
        temperature: 0.1
      },
    })

    const response = result.response
    const rawText = response.text()
    
    if (!rawText) throw new Error('No content generated')

    // JSON 정제 및 파싱
    const sanitizedText = sanitizeJSON(rawText)
    const parsed = JSON.parse(sanitizedText)

    return {
      criteria_id: criteria.criteria_id || 'unknown',
      what: parsed.what,
      why: parsed.why,
      how: parsed.how,
      example: parsed.example,
    }
  } catch (error) {
    console.error('[UpgradePlanner] Error:', error)
    return {
      criteria_id: criteria.criteria_id || 'unknown',
      what: '수정 계획 생성 실패',
      why: '시스템 오류가 발생했습니다.',
      how: '잠시 후 다시 시도해주세요.',
      example: '',
    }
  }
}
