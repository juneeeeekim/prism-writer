// =============================================================================
// PRISM Writer - Holistic Advisor
// =============================================================================
// 파일: frontend/src/lib/judge/holisticAdvisor.ts
// 역할: 전체 글에 대한 종합 평가 생성 (A + B + C)
// 작성일: 2025-12-28
// =============================================================================
// [P2-02] 종합 평가 LLM 호출 모듈
// - A: 한 문단 종합 피드백
// - B: 영역별 조언 (구조/내용/표현)
// - C: 점수 + 상세 액션 아이템
// =============================================================================

import { GoogleGenerativeAI } from '@google/generative-ai'
import { 
  type HolisticEvaluationResult, 
  type HolisticSummary, 
  type AreaAdvice, 
  type DetailedScore 
} from './types'

// =============================================================================
// Helper: JSON Sanitization (alignJudge.ts 패턴 참조)
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
// Default Fallback Result (에러 시 기본값)
// =============================================================================

/**
 * 에러 발생 시 반환할 기본 종합 평가 결과
 * Graceful Degradation을 위해 사용
 */
function getDefaultHolisticResult(category: string): HolisticEvaluationResult {
  return {
    summaryA: {
      overview: '평가 과정에서 오류가 발생했습니다. 잠시 후 다시 시도해주세요.'
    },
    adviceB: {
      structure: '구조 분석을 완료하지 못했습니다.',
      content: '내용 분석을 완료하지 못했습니다.',
      expression: '표현 분석을 완료하지 못했습니다.'
    },
    scoreC: {
      overall: 0,
      breakdown: {
        structure: 0,
        content: 0,
        expression: 0,
        logic: 0
      },
      actionItems: ['평가를 다시 시도해주세요.']
    },
    evaluated_at: new Date().toISOString(),
    category
  }
}

// =============================================================================
// Holistic Evaluation Prompt
// =============================================================================

/**
 * 종합 평가를 위한 프롬프트 생성
 * [P3-05] templateExamplesContext 지원 추가
 */
function buildHolisticPrompt(
  userText: string, 
  evidenceContext: string, 
  category: string,
  templateExamplesContext?: string  // [P3-05]
): string {
  return `
당신은 ${category} 분야의 전문 글쓰기 컨설턴트입니다.
아래 사용자의 글을 분석하고, 세 가지 형태의 피드백을 JSON으로 제공해주세요.

[사용자 글]
${userText}

${evidenceContext ? `[참고자료 (평가 기준)]
${evidenceContext}

참고자료를 기준으로 사용자 글이 해당 카테고리에 맞게 작성되었는지 평가해주세요.
` : ''}

[카테고리]
${category}

${templateExamplesContext ? `[평가 기준 및 예시 (Template)]
${templateExamplesContext}

위 예시를 참고하여 좋은 글과 나쁜 글의 차이점을 평가해주세요.
` : ''}

[평가 가이드라인]
1. summaryA.overview: 전체 글에 대한 종합 평가를 100-200자 내외로 작성
   - 장점과 개선점을 균형있게 언급
   - 구체적이고 건설적인 피드백 제공

2. adviceB: 각 영역별로 한 문장씩 구체적인 조언 제공
   - structure: 글의 구조와 흐름에 대한 조언
   - content: 내용의 충실도와 정확성에 대한 조언
   - expression: 문장 표현과 가독성에 대한 조언

3. scoreC: 객관적인 점수와 실행 가능한 액션 아이템
   - overall: 종합 점수 (0-100)
   - breakdown: 각 영역별 점수
   - actionItems: 즉시 실행 가능한 3-5개의 구체적인 개선 항목

[CRITICAL: JSON 포맷 준수]
반드시 아래 형식의 순수 JSON만 출력하세요. 마크다운 코드 블록이나 추가 설명 없이 JSON만 반환하세요.

{
  "summaryA": { 
    "overview": "종합 피드백 텍스트 (100-200자)" 
  },
  "adviceB": { 
    "structure": "구조에 대한 조언", 
    "content": "내용에 대한 조언", 
    "expression": "표현에 대한 조언" 
  },
  "scoreC": {
    "overall": 72,
    "breakdown": { 
      "structure": 80, 
      "content": 70, 
      "expression": 60, 
      "logic": 80 
    },
    "actionItems": [
      "구체적인 액션 아이템 1",
      "구체적인 액션 아이템 2",
      "구체적인 액션 아이템 3"
    ]
  }
}
`
}

// =============================================================================
// Main Function: runHolisticEvaluation
// =============================================================================

/**
 * 전체 글에 대한 종합 평가를 수행합니다.
 * 
 * @param userText - 사용자가 작성한 전체 글
 * @param evidenceContext - 해당 카테고리의 참고자료 컨텍스트
 * @param category - 글의 카테고리
 * @param templateExamplesContext - [P3-05] 템플릿 예시 컨텍스트 (optional)
 * @returns HolisticEvaluationResult - A + B + C 종합 평가 결과
 */
export async function runHolisticEvaluation(
  userText: string,
  evidenceContext: string,
  category: string,
  templateExamplesContext?: string  // [P3-05]
): Promise<HolisticEvaluationResult> {
  // ---------------------------------------------------------------------------
  // 1. API Key 확인
  // ---------------------------------------------------------------------------
  const apiKey = process.env.GOOGLE_API_KEY
  if (!apiKey) {
    console.error('[HolisticAdvisor] GOOGLE_API_KEY is missing')
    return getDefaultHolisticResult(category)
  }

  // ---------------------------------------------------------------------------
  // 2. Gemini 모델 초기화
  // ---------------------------------------------------------------------------
  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })

  // ---------------------------------------------------------------------------
  // 3. 프롬프트 생성 및 LLM 호출
  // ---------------------------------------------------------------------------
  // [P3-05] templateExamplesContext 전달
  const prompt = buildHolisticPrompt(userText, evidenceContext, category, templateExamplesContext)

  try {
    console.log('[HolisticAdvisor] Starting holistic evaluation...')
    console.log(`[HolisticAdvisor] Category: ${category}, Text length: ${userText.length}`)

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { 
        responseMimeType: 'application/json',
        temperature: 0.3  // 일관된 평가를 위해 낮은 온도
      },
    })

    const response = result.response
    const rawText = response.text()
    
    if (!rawText) {
      console.error('[HolisticAdvisor] No content generated')
      return getDefaultHolisticResult(category)
    }

    // ---------------------------------------------------------------------------
    // 4. JSON 파싱 및 결과 구성
    // ---------------------------------------------------------------------------
    const sanitizedText = sanitizeJSON(rawText)
    const parsed = JSON.parse(sanitizedText)

    // 결과 구조 검증 및 기본값 적용
    const summaryA: HolisticSummary = {
      overview: parsed.summaryA?.overview || '평가 결과를 생성하지 못했습니다.'
    }

    const adviceB: AreaAdvice = {
      structure: parsed.adviceB?.structure || '구조 분석 결과가 없습니다.',
      content: parsed.adviceB?.content || '내용 분석 결과가 없습니다.',
      expression: parsed.adviceB?.expression || '표현 분석 결과가 없습니다.'
    }

    const scoreC: DetailedScore = {
      overall: Number(parsed.scoreC?.overall) || 50,
      breakdown: {
        structure: Number(parsed.scoreC?.breakdown?.structure) || 50,
        content: Number(parsed.scoreC?.breakdown?.content) || 50,
        expression: Number(parsed.scoreC?.breakdown?.expression) || 50,
        logic: Number(parsed.scoreC?.breakdown?.logic) || 50
      },
      actionItems: Array.isArray(parsed.scoreC?.actionItems) 
        ? parsed.scoreC.actionItems 
        : ['개선 사항을 확인해주세요.']
    }

    console.log(`[HolisticAdvisor] Evaluation complete - Overall score: ${scoreC.overall}`)

    return {
      summaryA,
      adviceB,
      scoreC,
      evaluated_at: new Date().toISOString(),
      category
    }

  } catch (error) {
    // ---------------------------------------------------------------------------
    // 5. 에러 처리 (Graceful Degradation)
    // ---------------------------------------------------------------------------
    console.error('[HolisticAdvisor] Error:', error)
    return getDefaultHolisticResult(category)
  }
}
