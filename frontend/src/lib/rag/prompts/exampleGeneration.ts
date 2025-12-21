
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

export function generateExampleGenerationPrompt(ruleContent: string, sourceStyleChunks: string[]): string {
  const styleContext = sourceStyleChunks.join('\n\n---\n\n')
  
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
