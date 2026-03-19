// =============================================================================
// PRISM Writer - AI Coach Service
// =============================================================================
// 파일: frontend/src/lib/services/coachService.ts
// 역할: AI 코치 페르소나의 스타일 분석 및 시스템 프롬프트 생성
// 생성일: 2026-03-19 (Phase C Track 2: P3-04, P3-05)
// =============================================================================

import { generateText } from '@/lib/llm/gateway'
import { getModelForUsage } from '@/config/llm-usage-map'

// =============================================================================
// 타입 정의
// =============================================================================

/**
 * 문서 스타일 프로필
 *
 * @description
 * LLM이 문서 텍스트를 분석하여 추출한 저자의 글쓰기 스타일 정보.
 * AI 코치 페르소나 생성의 기반 데이터로 사용됩니다.
 */
export interface StyleProfile {
  /** 글의 전반적인 어조 (예: "친근하고 격려하는", "냉철하고 분석적인") */
  tone: string
  /** 자주 사용하는 문장 패턴 (예: ["짧은 문장 연속", "질문으로 시작"]) */
  sentence_patterns: string[]
  /** 어휘 수준 (예: "전문 용어 혼합", "평이한 일상어") */
  vocabulary_level: string
  /** 글 구조 선호 (예: "두괄식", "점층적 전개") */
  structure_preference: string
  /** 표현 습관 (예: ["~하지 않을까요?", "핵심은 바로"]) */
  expression_habits: string[]
  /** 글쓰기 강점 (예: ["비유 활용이 탁월", "논리적 전개력"]) */
  strengths: string[]
  /** 코치 시스템 프롬프트에 추가할 문장 */
  system_prompt_addition: string
}

// =============================================================================
// 상수
// =============================================================================

/** 스타일 분석용 최대 입력 문자 수 */
const MAX_INPUT_LENGTH = 8000

// =============================================================================
// P3-04: 스타일 분석 함수
// =============================================================================

/**
 * 문서 텍스트에서 글쓰기 스타일을 분석합니다.
 *
 * @param documentText - 분석할 문서 텍스트
 * @returns StyleProfile 객체
 * @throws Error - LLM 호출 실패 또는 JSON 파싱 실패 시
 *
 * @example
 * const style = await analyzeWritingStyle("독자 여러분, 오늘은...")
 * console.log(style.tone) // "친근하고 대화체"
 */
export async function analyzeWritingStyle(
  documentText: string
): Promise<StyleProfile> {
  // 입력 텍스트 truncate
  const truncated = documentText.slice(0, MAX_INPUT_LENGTH)

  // 프롬프트 구성
  const prompt = buildStyleAnalysisPrompt(truncated)

  // LLM 호출
  const result = await generateText(prompt, {
    model: getModelForUsage('coach.style.analysis'),
    temperature: 0.3,
    maxOutputTokens: 1500,
    context: 'coach.style.analysis',
  })

  // JSON 파싱
  const parsed = parseJsonFromResponse(result.text)

  if (!parsed) {
    console.error(
      '[CoachService] 스타일 분석 JSON 파싱 실패. 응답 미리보기:',
      result.text.substring(0, 300)
    )
    throw new Error(
      `스타일 분석 결과를 파싱할 수 없습니다. 응답 길이: ${result.text.length}`
    )
  }

  // StyleProfile 구조로 정규화 (누락 필드 기본값 처리)
  return normalizeStyleProfile(parsed)
}

// =============================================================================
// P3-05: 시스템 프롬프트 빌더
// =============================================================================

/**
 * 코치 페르소나의 시스템 프롬프트를 생성합니다.
 *
 * @param styleProfile - 분석된 스타일 프로필
 * @param coachName - 코치 이름 (예: "논리 마스터")
 * @returns 시스템 프롬프트 문자열
 *
 * @example
 * const prompt = buildCoachSystemPrompt(styleProfile, "논리 마스터")
 */
export function buildCoachSystemPrompt(
  styleProfile: StyleProfile,
  coachName: string
): string {
  const tone = styleProfile.tone || '균형 잡힌'
  const patterns = styleProfile.sentence_patterns?.length
    ? styleProfile.sentence_patterns.join(', ')
    : '다양한 문장 구조'
  const vocabulary = styleProfile.vocabulary_level || '보통 수준'
  const structure = styleProfile.structure_preference || '자유 형식'
  const expressions = styleProfile.expression_habits?.length
    ? styleProfile.expression_habits.join(', ')
    : '특별한 습관 없음'
  const strengths = styleProfile.strengths?.length
    ? styleProfile.strengths.join(', ')
    : '전반적으로 고른 실력'
  const addition = styleProfile.system_prompt_addition || ''

  return `당신은 "${coachName}"라는 이름의 AI 글쓰기 코치입니다.
${addition ? `\n코칭 스타일: ${addition}\n` : ''}
# 저자의 글쓰기 스타일 특성

- **어조**: ${tone}
- **문장 패턴**: ${patterns}
- **어휘 수준**: ${vocabulary}
- **구조 선호**: ${structure}
- **표현 습관**: ${expressions}
- **강점**: ${strengths}

# 피드백 규칙

1. 저자의 기존 스타일 특성을 기반으로 평가하세요. 저자의 개성을 존중하되, 개선점을 제안하세요.
2. 대안을 제시할 때는 "이 저자라면 이렇게 쓸 것이다"라는 관점에서 작성하세요. 저자의 어조와 표현 습관을 반영한 대안이어야 합니다.
3. 저자의 강점을 먼저 인정하고 구체적으로 칭찬한 뒤, 개선 제안을 하세요.
4. 피드백은 한국어로 작성하며, 구체적인 문장 예시를 포함하세요.
5. 저자의 스타일과 동떨어진 표현은 제안하지 마세요.`
}

// =============================================================================
// 내부 헬퍼 함수
// =============================================================================

/**
 * 스타일 분석용 프롬프트를 생성합니다.
 */
function buildStyleAnalysisPrompt(text: string): string {
  return `# 역할
당신은 글쓰기 스타일 분석 전문가입니다. 주어진 텍스트에서 저자의 글쓰기 스타일을 정밀하게 분석하세요.

# 분석 대상 텍스트
"""
${text}
"""

# 분석 항목
아래 JSON 형식으로 분석 결과를 출력하세요. 모든 값은 한국어로 작성합니다.

\`\`\`json
{
  "tone": "글의 전반적인 어조를 한 문장으로 설명 (예: 친근하고 격려하는, 냉철하고 분석적인)",
  "sentence_patterns": ["자주 사용하는 문장 패턴 3~5개"],
  "vocabulary_level": "어휘 수준 설명 (예: 전문 용어 혼합, 평이한 일상어 위주)",
  "structure_preference": "글 구조 선호 설명 (예: 두괄식, 점층적 전개, 문제-해결 구조)",
  "expression_habits": ["자주 반복되는 표현이나 문구 3~5개"],
  "strengths": ["글쓰기 강점 2~4개"],
  "system_prompt_addition": "이 저자의 스타일에 맞는 코치가 되기 위한 핵심 지침 1~2문장"
}
\`\`\`

# 주의사항
1. 반드시 위 JSON 형식만 출력하세요. 추가 설명을 붙이지 마세요.
2. 텍스트가 짧더라도 최대한 분석하세요.
3. 분석할 수 없는 항목은 빈 문자열("")이나 빈 배열([])로 출력하세요.
4. tone, vocabulary_level, structure_preference, system_prompt_addition은 문자열입니다.
5. sentence_patterns, expression_habits, strengths는 문자열 배열입니다.`
}

/**
 * LLM 응답에서 JSON을 추출하여 파싱합니다.
 * markdown 코드 블록 래핑을 처리합니다.
 */
function parseJsonFromResponse(response: string): Record<string, unknown> | null {
  try {
    let jsonStr = response.trim()

    // ```json ... ``` 블록 제거
    if (jsonStr.startsWith('```json')) {
      jsonStr = jsonStr.slice(7)
    } else if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.slice(3)
    }

    if (jsonStr.endsWith('```')) {
      jsonStr = jsonStr.slice(0, -3)
    }

    jsonStr = jsonStr.trim()

    // { 로 시작하는 위치 찾기
    const objStart = jsonStr.indexOf('{')
    if (objStart > 0) {
      jsonStr = jsonStr.slice(objStart)
    }

    const parsed = JSON.parse(jsonStr)

    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      console.error('[CoachService] 파싱 결과가 객체가 아님:', typeof parsed)
      return null
    }

    return parsed as Record<string, unknown>
  } catch (error) {
    console.error('[CoachService] JSON 파싱 실패:', error)
    return null
  }
}

/**
 * 파싱된 객체를 StyleProfile로 정규화합니다.
 * 누락된 필드에 기본값을 제공합니다.
 */
function normalizeStyleProfile(raw: Record<string, unknown>): StyleProfile {
  return {
    tone: typeof raw.tone === 'string' ? raw.tone : '',
    sentence_patterns: Array.isArray(raw.sentence_patterns)
      ? raw.sentence_patterns.filter((s): s is string => typeof s === 'string')
      : [],
    vocabulary_level:
      typeof raw.vocabulary_level === 'string' ? raw.vocabulary_level : '',
    structure_preference:
      typeof raw.structure_preference === 'string'
        ? raw.structure_preference
        : '',
    expression_habits: Array.isArray(raw.expression_habits)
      ? raw.expression_habits.filter((s): s is string => typeof s === 'string')
      : [],
    strengths: Array.isArray(raw.strengths)
      ? raw.strengths.filter((s): s is string => typeof s === 'string')
      : [],
    system_prompt_addition:
      typeof raw.system_prompt_addition === 'string'
        ? raw.system_prompt_addition
        : '',
  }
}
