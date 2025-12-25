
import { GoogleGenerativeAI } from '@google/generative-ai'
import { type TemplateSchema } from '../rag/templateTypes'
import { type JudgeResult } from './types'

// =============================================================================
// Helper: JSON Sanitization
// =============================================================================

/**
 * LLM이 생성한 JSON 텍스트를 정제합니다.
 * - 마크다운 코드 블록 제거 (```json ... ```)
 * - trailing comma 제거
 * - 불필요한 공백 제거
 */
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
// Align Judge (Stage 1)
// =============================================================================

/**
 * 사용자 글이 템플릿 기준을 충족하는지 판정합니다.
 * - 모델: gemini-1.5-flash (빠른 속도)
 * 
 * @param userText - 사용자가 작성한 글
 * @param criteria - 평가 기준 (템플릿 스키마)
 * @param evidenceContext - P0 Fix: 업로드된 참고자료 컨텍스트 (optional)
 */
export async function runAlignJudge(
  userText: string,
  criteria: TemplateSchema,
  evidenceContext?: string
): Promise<JudgeResult> {
  const apiKey = process.env.GOOGLE_API_KEY
  if (!apiKey) {
    throw new Error('GOOGLE_API_KEY is missing')
  }

  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })

  // ---------------------------------------------------------------------------
  // P0 Fix: 참고자료 섹션 추가 (있는 경우에만)
  // ---------------------------------------------------------------------------
  const evidenceSection = evidenceContext 
    ? `\n[업로드된 참고자료]\n${evidenceContext}\n`
    : ''

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
${evidenceSection}
[사용자 글]
${userText}

[판정 가이드라인]
1. pass: 기준을 명확하게 충족함
2. fail: 기준을 명확하게 위반함
3. partial: 일부만 충족하거나 애매함
${evidenceContext ? '4. 업로드된 참고자료가 있다면, 이를 근거로 활용하여 판정하세요.' : ''}

[CRITICAL: JSON 포맷 준수]
반드시 아래 형식의 순수 JSON만 출력하세요. 마크다운 코드 블록이나 추가 설명 없이 JSON만 반환하세요.
{
  "status": "pass",
  "reasoning": "판정 이유 (한글로 간결하게)",
  "citation": "판정의 근거가 되는 사용자 글의 일부 문장 (없으면 null)"
}
`

  try {
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { 
        responseMimeType: 'application/json',
        temperature: 0.1  // 엄격한 JSON 생성을 위해 낮은 온도
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
      status: parsed.status,
      reasoning: parsed.reasoning,
      citation: parsed.citation || undefined,
    }
  } catch (error) {
    console.error('[AlignJudge] Error:', error)
    console.error('[AlignJudge] Raw response (if available):', error)
    // 에러 발생 시 보수적으로 partial 처리 (사용자에게 혼란을 주지 않기 위해)
    return {
      criteria_id: criteria.criteria_id || 'unknown',
      status: 'partial',
      reasoning: '시스템 오류로 인해 판정을 완료하지 못했습니다.',
    }
  }
}
