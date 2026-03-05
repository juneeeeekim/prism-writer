// =============================================================================
// PRISM Writer - LLM Utility Functions
// =============================================================================
// 파일: frontend/src/lib/llm/utils.ts
// 역할: LLM 관련 유틸리티 함수 (순환 의존성 방지용 독립 모듈)
// 생성: 2026-03-05 Health Audit — client.ts ↔ gateway.ts 순환 의존성 해소
// =============================================================================

/**
 * 텍스트의 토큰 수 추정 (대략적)
 *
 * @param text - 텍스트
 * @returns 예상 토큰 수
 * @description
 * 영어: ~4 chars/token, 한글: ~2 chars/token
 * 보수적으로 3으로 계산
 */
export function estimateLLMTokenCount(text: string): number {
  return Math.ceil(text.length / 3)
}
