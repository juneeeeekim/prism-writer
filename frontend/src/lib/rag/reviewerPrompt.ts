// =============================================================================
// PRISM Writer - Reviewer Prompt Builder
// =============================================================================
// 파일: frontend/src/lib/rag/reviewerPrompt.ts
// 역할: Reviewer 모델용 프롬프트 생성
// P1 Phase 1.2
// =============================================================================

import type { JudgeResult } from '@/types/rag'

// =============================================================================
// 상수 정의
// =============================================================================

const REVIEWER_SYSTEM_INSTRUCTION = `당신은 AI 생성 답변의 품질을 검토하는 Reviewer입니다.

당신의 역할:
1. 답변이 제공된 근거와 일치하는지 검증
2. 환각(hallucination) 여부 감지
3. 논리적 비약 또는 과장된 주장 식별
4. 신뢰도 점수 산정

검토 기준:
- 답변의 모든 주장이 근거에서 직접 도출 가능한가?
- 근거에 없는 정보를 답변이 포함하고 있는가?
- 답변이 근거를 정확히 반영하고 있는가?

반드시 다음 JSON 형식으로 응답하세요:
{
  "badge": "✅" | "⚠️" | "⛔",
  "confidence": 0.0 ~ 1.0,
  "issues": ["발견된 이슈 1", "발견된 이슈 2"],
  "reasoning": "검토 결과 설명"
}

배지 기준:
- ✅ (검증됨): 신뢰도 0.8 이상, 이슈 없음
- ⚠️ (주의 필요): 신뢰도 0.5~0.8, 경미한 이슈 있음
- ⛔ (거부): 신뢰도 0.5 미만, 환각 또는 심각한 오류 감지`

// =============================================================================
// 프롬프트 빌더 함수
// =============================================================================

/**
 * Reviewer 프롬프트 생성
 * 
 * @param answer - 검토할 AI 생성 답변
 * @param evidenceChunks - 답변 생성에 사용된 근거 청크들
 * @param judgeResult - Judge 모델의 평가 결과
 * @returns Reviewer 모델용 프롬프트 문자열
 */
export function buildReviewerPrompt(
  answer: string,
  evidenceChunks: string[],
  judgeResult: JudgeResult
): string {
  // ---------------------------------------------------------------------------
  // 근거 정리
  // ---------------------------------------------------------------------------
  const formattedEvidence = evidenceChunks
    .map((chunk, i) => `[근거 ${i + 1}]\n${chunk}`)
    .join('\n\n')

  // ---------------------------------------------------------------------------
  // Judge 결과 요약
  // ---------------------------------------------------------------------------
  const judgeInfo = `
Judge 평가 결과:
- 판정: ${judgeResult.verdict}
- 점수: ${judgeResult.score}/100
- 근거 수: ${judgeResult.evidence.length}
- 평가 이유: ${judgeResult.reasoning}
`

  // ---------------------------------------------------------------------------
  // 최종 프롬프트 조합
  // ---------------------------------------------------------------------------
  return `${REVIEWER_SYSTEM_INSTRUCTION}

====================
검토 대상
====================

[AI 생성 답변]
${answer}

[제공된 근거]
${formattedEvidence}

[Judge 평가 정보]
${judgeInfo}

====================
검토를 시작하세요. 반드시 JSON 형식으로 응답하세요.
`
}

/**
 * 간소화된 Reviewer 프롬프트 생성 (Judge 결과 없이)
 * 
 * @param answer - 검토할 AI 생성 답변
 * @param evidenceChunks - 답변 생성에 사용된 근거 청크들
 * @returns Reviewer 모델용 프롬프트 문자열
 */
export function buildSimpleReviewerPrompt(
  answer: string,
  evidenceChunks: string[]
): string {
  const formattedEvidence = evidenceChunks
    .map((chunk, i) => `[근거 ${i + 1}]\n${chunk}`)
    .join('\n\n')

  return `${REVIEWER_SYSTEM_INSTRUCTION}

====================
검토 대상
====================

[AI 생성 답변]
${answer}

[제공된 근거]
${formattedEvidence}

====================
검토를 시작하세요. 반드시 JSON 형식으로 응답하세요.
`
}
