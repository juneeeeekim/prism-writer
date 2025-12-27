
import { GoogleGenerativeAI } from '@google/generative-ai'
import { type GapItem, type Patch } from '../rag/types/patch'
import { type CriteriaPack } from '../rag/cache/criteriaPackCache'

// =============================================================================
// Helper: JSON Sanitization (재사용)
// =============================================================================

function sanitizeJSON(text: string): string {
  let cleaned = text.trim()
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.replace(/^```json\s*/, '').replace(/\s*```$/, '')
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```\s*/, '').replace(/\s*```$/, '')
  }
  // trailing comma 제거
  cleaned = cleaned.replace(/,(\s*[}\]])/g, '$1')
  return cleaned.trim()
}

// =============================================================================
// Run Patch Generator
// =============================================================================

interface PatchGeneratorParams {
  userText: string
  gap: GapItem
  criteriaPack: CriteriaPack
  evidenceContext?: string
}

/**
 * LLM을 사용하여 문제 문장을 수정하는 패치를 생성합니다.
 */
export async function runPatchGenerator({
  userText,
  gap,
  criteriaPack,
  evidenceContext
}: PatchGeneratorParams): Promise<Patch> {
  const apiKey = process.env.GOOGLE_API_KEY
  if (!apiKey) throw new Error('GOOGLE_API_KEY is missing')

  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({ model: 'gemini-3-flash-preview' })

  // 1. 타겟 문맥 추출 (간단히 전체 텍스트 사용하거나, Gap 분석에서 위치를 받아야 함)
  // 현재는 전체 텍스트를 LLM에게 주고 수정을 요청
  // 실제로는 Gap 분석 결과에 위치 정보가 포함되어야 더 정확함.
  // 여기서는 LLM에게 "가장 문제가 되는 부분을 찾아서 고쳐줘"라고 요청

  const prompt = `
당신은 전문 글쓰기 에디터입니다.
사용자 글에서 특정 "평가 기준"을 충족하지 못한 부분을 찾아 수정해주세요.

[평가 기준]
항목: ${gap.criteria_name}
목표: ${criteriaPack.rules.find(r => r.id === gap.criteria_id)?.content || gap.criteria_name} 점수 높이기

[참고 자료 (Style Guide)]
${evidenceContext ? evidenceContext.substring(0, 1000) : '(참고 자료 없음)'}

[사용자 원문]
${userText}

[요청 사항]
1. 위 글에서 "${gap.criteria_name}" 기준을 가장 저해하는 **단 하나의 핵심 문장(또는 문단)**을 찾으세요.
2. 그 부분을 [참고 자료]의 스타일을 반영하여 수정하세요.
3. 수정된 내용은 문맥에 자연스럽게 어울려야 합니다.

[출력 형식 (JSON Only)]
{
  "target_text": "수정할 원본 문장 (반드시 원문에 있는 내용이어야 함)",
  "patched_text": "수정된 문장",
  "reason": "수정 이유 (100자 이내)"
}
`

  try {
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: 'application/json', temperature: 0.2 },
    })

    const rawText = result.response.text()
    const sanitized = sanitizeJSON(rawText)
    const parsed = JSON.parse(sanitized)

    // 원문에서 target_text의 위치 찾기
    const startIndex = userText.indexOf(parsed.target_text)
    
    // 못 찾으면 패치 생성 실패 (또는 전체 교체 등 전략 필요하지만 안전하게 실패 처리)
    if (startIndex === -1) {
      console.warn('[PatchGenerator] Cannot find target text in original content')
      // Fallback: 위치를 0으로 잡고 경고 (실제 적용 시 문제됨)
      // 실제로는 Fuzzy Match가 필요하나 지금은 Exact Match 시도 후 실패 시 맨 앞 0-0 범위(삽입)보다는
      // 그냥 실패 처리하거나, 전체 텍스트 기반으로 동작해야 함. 
      // 여기서는 "패치 생성 실패"로 처리하여 사고 방지.
      
      throw new Error('Target text not found in original content')
    }

    return {
      id: `patch-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: 'Replace',
      targetRange: { start: startIndex, end: startIndex + parsed.target_text.length },
      before: parsed.target_text,
      after: parsed.patched_text,
      reason: parsed.reason,
      citationId: gap.criteria_id,
      expectedDelta: [],
      status: 'pending',
      createdAt: new Date().toISOString()
    }

  } catch (error) {
    console.error('[PatchGenerator] Error:', error)
    // 에러 발생 시 빈 패치 또는 에러 패치 반환?
    // 상위에서 에러 처리를 위해 throw
    throw error
  }
}
