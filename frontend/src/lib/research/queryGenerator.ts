// =============================================================================
// PRISM Writer - Research Query Generator
// =============================================================================
// 파일: frontend/src/lib/research/queryGenerator.ts
// 역할: 사용자 요청을 학술 검색 쿼리로 변환
// 참고: [Deep Scholar 체크리스트 P1-03]
// =============================================================================

import { generateText } from '@/lib/llm/gateway'
import { logger } from '@/lib/utils/logger'

// =============================================================================
// Constants
// =============================================================================

/**
 * 검색 쿼리 생성 프롬프트
 *
 * @description
 * [시니어 개발자 주석]
 * - 영어 쿼리로 변환 (더 많은 학술 결과 확보)
 * - 10단어 이내 간결하게
 * - 연도, 통계 키워드 포함
 */
const QUERY_GENERATION_PROMPT = `당신은 학술 검색 전문가입니다.
사용자의 요청과 문맥을 바탕으로 Google Scholar, arXiv 등에서 검색할 최적의 영어 검색 쿼리를 생성하세요.

[규칙]
1. 검색 쿼리는 영어로 작성 (더 많은 결과를 위해)
2. 핵심 키워드 + 연도 + 통계/논문/데이터 관련 키워드 포함
3. 10단어 이내로 간결하게
4. 반드시 검색 쿼리만 출력 (설명 금지)

[사용자 요청]
{userQuery}

[현재 문맥]
{context}

[검색 쿼리]`

// =============================================================================
// Main Function: generateSearchQuery
// =============================================================================

/**
 * 사용자 요청을 학술 검색 쿼리로 변환합니다.
 *
 * @description
 * [주니어 개발자 주석]
 * - LLM을 사용하여 자연어 요청을 검색 쿼리로 변환
 * - context는 500자로 제한 (토큰 과다 사용 방지)
 * - LLM 실패 시 원본 쿼리 반환 (fallback)
 *
 * @param userQuery - 사용자 요청 (예: "이 주장에 대한 통계 찾아줘")
 * @param context - 에디터 현재 문맥 (드래그한 텍스트 등)
 * @returns 영어 검색 쿼리
 *
 * @example
 * const query = await generateSearchQuery(
 *   "AI 시장 규모 통계 찾아줘",
 *   "인공지능 기술의 발전으로 산업 전반에 큰 변화가..."
 * );
 * // Returns: "2024 AI market size statistics global"
 */
export async function generateSearchQuery(
  userQuery: string,
  context: string
): Promise<string> {
  // ---------------------------------------------------------------------------
  // [P1-03-01] 프롬프트 구성
  // ---------------------------------------------------------------------------
  const prompt = QUERY_GENERATION_PROMPT
    .replace('{userQuery}', userQuery)
    .replace('{context}', context.substring(0, 500))  // 500자 제한

  logger.info('[QueryGenerator]', '검색 쿼리 생성 시작', { userQuery })

  // ---------------------------------------------------------------------------
  // [P1-03-02] LLM 호출
  // ---------------------------------------------------------------------------
  try {
    const response = await generateText(prompt, {
      model: 'gemini-2.0-flash',
      maxOutputTokens: 50,  // 쿼리는 짧으므로 50 토큰으로 충분
      temperature: 0.3,     // 낮은 temperature로 일관성 유지
    })

    const generatedQuery = response.text.trim()

    logger.info('[QueryGenerator]', '쿼리 생성 완료', { generatedQuery })

    return generatedQuery

  } catch (error) {
    // ---------------------------------------------------------------------------
    // [P1-03-03] Fallback: LLM 실패 시 원본 쿼리 반환
    // ---------------------------------------------------------------------------
    logger.warn('[QueryGenerator]', 'LLM 쿼리 생성 실패, 원본 쿼리 사용', {
      error: error instanceof Error ? error.message : String(error),
    })

    // 원본 쿼리가 한국어일 경우 간단한 영어 변환 시도
    // (실제로는 그대로 반환 - Tavily가 자체적으로 처리)
    return userQuery
  }
}
