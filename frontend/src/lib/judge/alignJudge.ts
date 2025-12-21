
import { GoogleGenerativeAI } from '@google/generative-ai'
import { type TemplateSchema } from '../rag/templateTypes'
import { type JudgeResult } from './types'

// =============================================================================
// Align Judge (Stage 1)
// =============================================================================

/**
 * 사용자 글이 템플릿 기준을 충족하는지 판정합니다.
 * - 모델: gemini-1.5-flash (빠른 속도)
 */
export async function runAlignJudge(
  userText: string,
  criteria: TemplateSchema
): Promise<JudgeResult> {
  const apiKey = process.env.GOOGLE_API_KEY
  if (!apiKey) {
    throw new Error('GOOGLE_API_KEY is missing')
  }

  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })

  const prompt = `
당신은 엄격한 글쓰기 평가관(Align Judge)입니다.
사용자의 글이 아래의 "평가 기준"을 충족하는지 판정해주세요.

[평가 기준]
카테고리: ${criteria.category}
내용: ${criteria.rationale}

[참고: 긍정 예시]
${criteria.positive_examples.join('\n')}

[참고: 부정 예시]
${criteria.negative_examples.join('\n')}

[사용자 글]
${userText}

[판정 가이드라인]
1. pass: 기준을 명확하게 충족함
2. fail: 기준을 명확하게 위반함
3. partial: 일부만 충족하거나 애매함

[출력 형식]
JSON 객체로 응답해주세요.
{
  "status": "pass" | "fail" | "partial",
  "reasoning": "판정 이유 (한글로 간결하게)",
  "citation": "판정의 근거가 되는 사용자 글의 일부 문장 (없으면 null)"
}
`

  try {
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: 'application/json' },
    })

    const response = result.response
    const text = response.text()
    
    if (!text) throw new Error('No content generated')

    const parsed = JSON.parse(text)

    return {
      criteria_id: criteria.criteria_id || 'unknown',
      status: parsed.status,
      reasoning: parsed.reasoning,
      citation: parsed.citation || undefined,
    }
  } catch (error) {
    console.error('[AlignJudge] Error:', error)
    // 에러 발생 시 보수적으로 partial 처리 (사용자에게 혼란을 주지 않기 위해)
    return {
      criteria_id: criteria.criteria_id || 'unknown',
      status: 'partial',
      reasoning: '시스템 오류로 인해 판정을 완료하지 못했습니다.',
    }
  }
}
