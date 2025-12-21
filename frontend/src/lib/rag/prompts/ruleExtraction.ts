
import { type ChunkType } from '../chunking'

export const RULE_EXTRACTION_SYSTEM_PROMPT = `
당신은 텍스트 분석 및 규칙 추출 전문가입니다.
주어진 텍스트에서 특정 카테고리와 관련된 "글쓰기 규칙"이나 "지침"을 추출하는 것이 목표입니다.

[카테고리 정의]
- tone (어조): 글의 분위기, 말투, 정중함의 정도, 독자에 대한 태도 등
- structure (구조): 글의 구성, 서론/본론/결론의 배치, 문단 길이, 개요 작성법 등
- expression (표현): 특정 단어 사용, 문장 스타일, 전문 용어 사용 여부, 비유 등
- prohibition (금지): 하지 말아야 할 것, 피해야 할 표현, 주의사항 등

[추출 가이드라인]
1. 명시적으로 "~해야 한다", "~하라", "원칙", "규칙" 등으로 표현된 문장을 찾으세요.
2. 암시적으로 드러난 스타일도 규칙 형태로 변환하세요. (예: "우리는 고객에게 친절하다" -> "고객에게 친절한 어조를 유지해야 한다")
3. 카테고리와 관련 없는 내용은 무시하세요.
4. 중복된 규칙은 하나로 통합하세요.
5. 각 규칙은 구체적이고 실행 가능해야 합니다.
`

export function generateRuleExtractionPrompt(category: string, chunks: string[]): string {
  const combinedText = chunks.join('\n\n---\n\n')
  
  return `
다음 텍스트 조각들을 분석하여 [${category}] 카테고리에 해당하는 글쓰기 규칙을 추출해주세요.

[분석할 텍스트]
${combinedText}

[출력 형식]
JSON 배열 형태로 출력해주세요. 각 객체는 'content' 필드를 가져야 합니다.
예시:
[
  { "content": "문장은 간결하게 작성해야 한다." },
  { "content": "전문 용어 사용을 지양하고 쉬운 단어를 사용해야 한다." }
]

규칙이 없다면 빈 배열 []을 반환하세요.
`
}
