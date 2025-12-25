
export const EXAMPLE_GENERATION_SYSTEM_PROMPT = `
당신은 글쓰기 예시 생성 전문가입니다.
주어진 "글쓰기 규칙"을 바탕으로, 해당 규칙을 잘 지킨 "긍정적 예시(Positive)"와 어긴 "부정적 예시(Negative)"를 생성해야 합니다.
이때, 제공된 "원본 텍스트 스타일"을 최대한 모방하여 예시를 작성해야 합니다.

[생성 가이드라인]
1. **Positive Example**: 규칙을 완벽하게 준수하면서, 원본 텍스트의 어조와 스타일을 반영하세요.
2. **Negative Example**: 규칙을 명확하게 위반하되, 여전히 원본 텍스트와 유사한 맥락을 유지하세요. (너무 억지스럽지 않게)
3. **Remediation**: 부정적 예시를 긍정적 예시로 수정하는 구체적인 단계를 설명하세요.
4. 예시는 1~2문장 길이로 간결하게 작성하세요.
`

// =============================================================================
// Pipeline v4: 민감 정보 노출 방지
// =============================================================================

/**
 * Pipeline v4: 프롬프트에 포함되는 원문 청크 최대 길이
 * 
 * @description
 * 주석(시니어 개발자): 민감 정보 노출 방지를 위해 1000자로 제한
 * OpenAI로 전송되는 데이터 양을 최소화하여 보안 위험 감소
 */
const MAX_SOURCE_CHUNK_LENGTH = 1000

/**
 * 청크 텍스트를 최대 길이로 자르고 "..." 추가
 * 
 * @param chunk - 원본 청크
 * @param maxLength - 최대 길이
 * @returns 잘린 청크 (또는 원본)
 */
function truncateChunk(chunk: string, maxLength: number = MAX_SOURCE_CHUNK_LENGTH): string {
  if (chunk.length <= maxLength) {
    return chunk
  }
  // 주석(주니어 개발자): 단어 중간에서 자르지 않도록 마지막 공백 위치에서 자름
  const truncated = chunk.substring(0, maxLength)
  const lastSpace = truncated.lastIndexOf(' ')
  if (lastSpace > maxLength * 0.8) {
    return truncated.substring(0, lastSpace) + '...'
  }
  return truncated + '...'
}

/**
 * 예시 생성 프롬프트 생성 (Pipeline v4: 길이 제한 적용)
 * 
 * @description
 * 주석(시니어 개발자): 각 청크를 1000자로 제한하여 민감 정보 노출 최소화
 * 
 * @param ruleContent - 규칙 내용
 * @param sourceStyleChunks - 스타일 참조용 원본 청크들
 * @returns 프롬프트 문자열
 */
export function generateExampleGenerationPrompt(ruleContent: string, sourceStyleChunks: string[]): string {
  // ---------------------------------------------------------------------------
  // Pipeline v4: 각 청크를 MAX_SOURCE_CHUNK_LENGTH로 제한
  // ---------------------------------------------------------------------------
  const truncatedChunks = sourceStyleChunks.map(chunk => truncateChunk(chunk))
  const styleContext = truncatedChunks.join('\n\n---\n\n')
  
  // 로깅: 개발 환경에서 길이 제한 적용 여부 확인
  if (process.env.NODE_ENV === 'development') {
    const originalLength = sourceStyleChunks.reduce((sum, c) => sum + c.length, 0)
    const truncatedLength = truncatedChunks.reduce((sum, c) => sum + c.length, 0)
    if (originalLength !== truncatedLength) {
      console.log(`[exampleGeneration] Chunks truncated: ${originalLength} -> ${truncatedLength} chars`)
    }
  }
  
  return `
다음 "글쓰기 규칙"에 대한 예시를 생성해주세요.

[규칙]
${ruleContent}

[참고할 원본 텍스트 스타일]
${styleContext}

[출력 형식]
JSON 객체 형태로 출력해주세요.
예시:
{
  "positive_examples": ["규칙을 잘 지킨 예시 문장 1", "규칙을 잘 지킨 예시 문장 2"],
  "negative_examples": ["규칙을 어긴 예시 문장 1", "규칙을 어긴 예시 문장 2"],
  "remediation_steps": ["부정적 예시를 수정하는 방법 1", "부정적 예시를 수정하는 방법 2"]
}
`
}

