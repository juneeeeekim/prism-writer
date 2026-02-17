# Prompt Engineering

> PRISM Writer에서 사용하는 모든 시스템 프롬프트, LLM 프롬프트 템플릿, 파싱 전략 명세
> 최종 갱신: 2026-02-14

---

## 목차

1. [프롬프트 아키텍처 개요](#1-프롬프트-아키텍처-개요)
2. [Chat 시스템 프롬프트](#2-chat-시스템-프롬프트)
3. [Align Judge 프롬프트](#3-align-judge-프롬프트)
4. [Holistic Advisor 프롬프트](#4-holistic-advisor-프롬프트)
5. [Patch Generator 프롬프트](#5-patch-generator-프롬프트)
6. [RAG Judge 프롬프트](#6-rag-judge-프롬프트)
7. [RAG Reviewer 프롬프트](#7-rag-reviewer-프롬프트)
8. [Self-RAG 4단계 프롬프트](#8-self-rag-4단계-프롬프트)
9. [Rule Extraction 프롬프트](#9-rule-extraction-프롬프트)
10. [Example Generation 프롬프트](#10-example-generation-프롬프트)
11. [Outline Generation 프롬프트 (Backend)](#11-outline-generation-프롬프트)
12. [Shadow Writer (Suggest) 프롬프트](#12-shadow-writer-프롬프트)
13. [환각 탐지 (Hallucination Detector)](#13-환각-탐지)
14. [JSON 파싱 전략](#14-json-파싱-전략)
15. [프롬프트 설계 원칙](#15-프롬프트-설계-원칙)

---

## 1. 프롬프트 아키텍처 개요

```
사용자 입력
    │
    ├─→ Chat Prompt Builder ──→ 시스템 프롬프트 + RAG 컨텍스트 + 대화 이력
    │
    ├─→ Align Judge ──────────→ 기준별 pass/fail/partial 판정
    │
    ├─→ Holistic Advisor ─────→ 종합 평가 (A+B+C)
    │
    ├─→ Patch Generator ──────→ 문장 단위 수정 패치
    │
    ├─→ RAG Judge ────────────→ 증거 기반 판정
    │
    ├─→ RAG Reviewer ─────────→ 응답 품질 리뷰
    │
    ├─→ Self-RAG (4단계) ─────→ 검색 필요성 → 비평 → 생성 → 근거 검증
    │
    ├─→ Rule Extraction ──────→ 문서에서 규칙 추출
    │
    └─→ Example Generation ───→ 긍정/부정 예시 생성
```

**모델 라우팅 전략**: `llm-usage-map.ts`에서 용도별 모델을 중앙 관리합니다.

| 용도 | 설정 키 | 기본 모델 | temperature |
|------|---------|-----------|-------------|
| Chat | `chat.general` | gemini-3-flash-preview | 0.7 |
| Align Judge | `judge.align` | gemini-3-flash-preview | 0.1 |
| Holistic Advisor | `judge.holistic` | gemini-3-flash-preview | 0.1 |
| Self-RAG | `selfrag.*` | gemini-3-flash-preview | 0.0 |
| Outline | `outline.generation` | gemini-3-flash-preview | 0.3 |

---

## 2. Chat 시스템 프롬프트

파일: `frontend/src/services/chat/promptBuilder.ts`

### 시스템 프롬프트 구조

```
[시스템 역할 정의]
당신은 PRISM Writer의 AI 글쓰기 어시스턴트입니다.
사용자의 글쓰기를 돕고, 업로드된 참고 자료를 기반으로 정확한 조언을 제공합니다.

[가드레일]
1. 참고 자료에 없는 내용은 만들어내지 마세요
2. 인용 시 반드시 출처를 표기하세요 [1], [2] 형식
3. 확실하지 않은 정보는 "확인이 필요합니다"라고 표시하세요
4. 한국어로 응답하세요 (사용자가 영어로 질문하면 영어로)

[RAG 컨텍스트] (검색 결과가 있는 경우)
다음은 사용자의 업로드된 문서에서 검색된 관련 내용입니다:
---
{evidenceContext}
---
위 자료를 참고하여 답변하되, 자료에 없는 내용은 명시하세요.

[대화 이력]
{이전 대화 메시지들}
```

### 프롬프트 빌드 함수

```typescript
// frontend/src/services/chat/promptBuilder.ts

export function buildChatPrompt(params: {
  messages: Array<{ role: string; content: string }>
  evidenceContext?: string
  projectId?: string
  model?: string
}): {
  systemPrompt: string
  userMessages: Array<{ role: string; content: string }>
}
```

### 인용 메타데이터 빌드

```typescript
// frontend/src/app/api/chat/route.ts

function buildCitationMetadata(
  fullResponse: string,
  hasRetrievedDocs: boolean,
  uniqueResults: any[]
): Record<string, any>
// → [1], [2] 형태의 인용 마커를 파싱하여 메타데이터 생성
```

---

## 3. Align Judge 프롬프트

파일: `frontend/src/lib/judge/alignJudge.ts`

### 역할

개별 평가 기준(criteria)에 대해 사용자 글의 충족 여부를 판정합니다.

### 프롬프트 템플릿

```
당신은 엄격한 글쓰기 평가관(Align Judge)입니다.
사용자의 글이 아래의 "평가 기준"을 충족하는지 판정해주세요.

[평가 기준]
카테고리: {criteria.category}
내용: {criteria.rationale}

[참고: 긍정 예시]
{criteria.positive_examples.join('\n')}

[참고: 부정 예시]
{criteria.negative_examples.join('\n')}

{evidenceSection}  ← 업로드된 참고자료 (있는 경우에만)

[사용자 글]
{userText}

[판정 가이드라인]
1. pass: 기준을 명확하게 충족함
2. fail: 기준을 명확하게 위반함
3. partial: 일부만 충족하거나 애매함
4. 업로드된 참고자료가 있다면, 이를 근거로 활용하여 판정하세요.

[CRITICAL: JSON 포맷 준수]
반드시 아래 형식의 순수 JSON만 출력하세요.

// ENABLE_SOURCE_CITATIONS 플래그 활성 시:
{
  "status": "pass" | "fail" | "partial",
  "reasoning": "판정 이유 (한글로 간결하게)",
  "citation": "원문에서 근거가 된 부분 인용 (없으면 null)"
}

// 비활성 시:
{
  "status": "pass" | "fail" | "partial",
  "reasoning": "판정 이유 (한글로 간결하게)"
}

[CRITICAL INSTRUCTION]
DO NOT use markdown code blocks (like ```json).
Output raw JSON object only.
```

### 함수 시그니처

```typescript
export async function runAlignJudge(
  userText: string,
  criteria: TemplateSchema,
  evidenceContext?: string
): Promise<JudgeResult>
```

### 모델 설정

```typescript
const config = getUsageConfig('judge.align')
// temperature: 0.1 (엄격한 판정)
// model: gemini-3-flash-preview
```

### 에러 처리

- 에러 발생 시 `status: 'partial'`, `reasoning: '시스템 오류로 인해 판정을 완료하지 못했습니다.'` 반환
- 보수적 접근: 사용자에게 혼란을 주지 않기 위해 fail 대신 partial 처리

---

## 4. Holistic Advisor 프롬프트

파일: `frontend/src/lib/judge/holisticAdvisor.ts`

### 역할

전체 글에 대한 종합 평가를 3가지 축(A+B+C)으로 제공합니다.

### 프롬프트 템플릿

```
당신은 {category} 분야의 전문 글쓰기 컨설턴트입니다.
아래 사용자의 글을 분석하고, 세 가지 형태의 피드백을 JSON으로 제공해주세요.

[사용자 글]
{userText}

[필수 평가 기준 - Core Rubrics]   ← H-01: Core 티어 루브릭
다음 5가지 핵심 기준을 반드시 평가에 반영하세요:
{coreRubricsContext}

[참고자료 (평가 기준)]
{evidenceContext}

[카테고리]
{category}

[평가 기준 및 예시 (Template)]     ← P3-05: 템플릿 예시
{templateExamplesContext}

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

[JSON 출력 형식]
{
  "summaryA": { "overview": "종합 피드백 (100-200자)" },
  "adviceB": {
    "structure": "구조 조언",
    "content": "내용 조언",
    "expression": "표현 조언"
  },
  "scoreC": {
    "overall": 72,
    "breakdown": {
      "structure": 80, "content": 70, "expression": 60,
      "logic": 80, "trust": 75, "persuasion": 70
    },
    "actionItems": ["개선 항목 1", "개선 항목 2", "개선 항목 3"]
  }
}
```

### 함수 시그니처

```typescript
export async function runHolisticEvaluation(
  userText: string,
  evidenceContext: string,
  category: string,
  templateExamplesContext?: string
): Promise<HolisticEvaluationResult>
```

### Core 루브릭 필터링

```typescript
export function getCoreRubricsContext(): string
// → DEFAULT_RUBRICS에서 structure, trust, persuasion 카테고리를 최대 5개 추출
```

### 모델 설정

```typescript
const holisticConfig = getUsageConfig('judge.holistic')
// responseMimeType: 'application/json'  (Gemini JSON 모드)
// temperature: 중앙 설정값 (fallback: 0.1)
```

---

## 5. Patch Generator 프롬프트

파일: `frontend/src/lib/judge/patchGenerator.ts`

### 역할

평가에서 부족한 부분을 자동으로 수정하는 패치를 생성합니다.

### 프롬프트 템플릿

```
당신은 전문 글쓰기 에디터입니다.
사용자 글에서 특정 "평가 기준"을 충족하지 못한 부분을 찾아 수정해주세요.

[평가 기준]
항목: {gap.criteria_name}
목표: {관련 규칙 내용} 점수 높이기

[참고 자료 (Style Guide)]
{evidenceContext (최대 1000자)}

[사용자 원문]
{userText}

[요청 사항]
1. 위 글에서 "{gap.criteria_name}" 기준을 가장 저해하는 단 하나의 핵심 문장을 찾으세요.
2. 그 부분을 [참고 자료]의 스타일을 반영하여 수정하세요.
3. 수정된 내용은 문맥에 자연스럽게 어울려야 합니다.

[출력 형식 (JSON Only)]
{
  "target_text": "수정할 원본 문장 (반드시 원문에 있는 내용)",
  "patched_text": "수정된 문장",
  "reason": "수정 이유 (100자 이내)"
}
```

### 함수 시그니처

```typescript
export async function runPatchGenerator(
  userText: string,
  gap: GapItem,
  criteriaPack: CriteriaPack,
  evidenceContext: string | null = null,
  qualityLevel: ModelQuality = 'standard'
): Promise<Patch>
```

### 패치 적용 검증

```typescript
// 원문에서 target_text의 정확한 위치를 찾음
const startIndex = userText.indexOf(parsed.target_text)
if (startIndex === -1) {
  throw new Error('Target text not found in original content')
}
// → Exact Match 실패 시 패치 생성 실패 (안전 장치)
```

---

## 6. RAG Judge 프롬프트

파일: `frontend/src/lib/rag/judgePrompt.ts`

### 역할

검색된 증거를 바탕으로 사용자 글의 품질을 판정합니다.

### 프롬프트 구조

```
당신은 글쓰기 평가 전문가입니다.
검색된 참고자료를 근거로 사용자 글을 평가하세요.

[평가 원칙]
1. 증거 기반: 반드시 참고자료에서 근거를 인용하세요
2. 객관적: 사실에 기반한 판단을 내리세요
3. 건설적: 개선 방향을 제시하세요
4. 정밀: 정확한 인용문을 추출하세요

[가드레일]
⚠️ 근거 불충분: "insufficient_evidence"로 표기
⚠️ 절대 날조 금지: 확실하지 않으면 "lacking evidence"로 표기

[평가 기준 (루브릭)]
{rubricItems}

[참고자료]
{searchResults}

[사용자 글]
{userText}

[출력 형식]
{
  "verdict": "pass" | "fail" | "insufficient_evidence",
  "score": 0-100,
  "evidence": [
    { "chunkId": "...", "quote": "인용문", "relevance": 0.0-1.0 }
  ],
  "reasoning": "판정 이유",
  "missingEvidence": ["부족한 근거 1", ...]
}
```

---

## 7. RAG Reviewer 프롬프트

파일: `frontend/src/lib/rag/reviewerPrompt.ts`

### 역할

RAG 파이프라인이 생성한 응답의 품질을 2차 검증합니다.

### 프롬프트 구조

```
당신은 글쓰기 평가 결과의 품질 검수관입니다.
아래 평가 결과가 적절한지 리뷰해주세요.

[원래 질문]
{originalQuery}

[생성된 평가 결과]
{generatedAnswer}

[참고자료]
{evidenceItems}

[리뷰 기준]
1. 평가 결과가 참고자료와 일치하는가?
2. 인용이 정확한가?
3. 판정이 논리적인가?

[출력 형식]
{
  "badge": "✅" | "⚠️" | "⛔",
  "confidence": 0.0-1.0,
  "issues": ["문제점 1", ...],
  "reasoning": "리뷰 이유"
}
```

### 배지 의미

| 배지 | 의미 | 동작 |
|------|------|------|
| ✅ | 검증 통과 | 결과 그대로 반환 |
| ⚠️ | 경미한 문제 | 경고와 함께 반환 |
| ⛔ | 심각한 문제 | 재평가 트리거 또는 에러 처리 |

---

## 8. Self-RAG 4단계 프롬프트

파일: `frontend/src/lib/rag/selfRAG.ts`

### 아키텍처

```
사용자 쿼리
    │
    ▼
[Stage 1] 검색 필요성 판단 ──→ { needed: boolean, confidence, reason }
    │
    ▼ (needed = true)
[Stage 2] 검색 결과 비평 ────→ [{ index, score, critique }]
    │
    ▼ (score > 0.7인 결과만 통과)
[Stage 3] 응답 생성 ──────────→ 자연어 응답
    │
    ▼
[Stage 4] 근거 검증 ──────────→ { isGrounded, groundednessScore, citations, hallucinations }
```

### Stage 1: 검색 필요성 판단

```
다음 질문에 대해 외부 문서 검색이 필요한지 판단하세요.

[질문]
{query}

[판단 기준]
- 사실 확인이 필요한 질문 → 검색 필요
- 일반적인 대화/인사 → 검색 불필요
- 이미 제공된 맥락으로 충분한 경우 → 검색 불필요

[출력 형식 (JSON)]
{
  "needed": true/false,
  "confidence": 0.0-1.0,
  "reason": "판단 이유"
}
```

**파싱**: `parseSelfRAGResponse(text) → { needed, confidence, reason }`

### Stage 2: 검색 결과 비평

```
검색된 문서가 질문에 적절한지 평가하세요.

[질문]
{query}

[검색 결과]
{indexedResults}

각 결과에 대해 다음을 평가하세요:
- 관련성 점수 (0.0-1.0)
- 비평 (왜 관련있는지/없는지)

[출력 형식 (JSON 배열)]
[
  { "index": 0, "score": 0.85, "critique": "주제와 직접 관련됨" },
  ...
]
```

**파싱**: `parseCritiqueResponse(text) → Array<{ index, score, critique }>`
**필터링**: `score > 0.7`인 결과만 Stage 3으로 전달

### Stage 3: 응답 생성

```
다음 질문에 대해 검증된 참고자료만을 사용하여 답변하세요.

[질문]
{query}

[검증된 참고자료]
{filteredResults}

[지시사항]
1. 반드시 참고자료에 있는 내용만 사용하세요
2. 참고자료에 없는 내용은 "확인이 필요합니다"라고 표시하세요
3. 인용 시 번호를 표기하세요 [1], [2]
```

### Stage 4: 근거 검증 (Groundedness Check)

```
아래 응답이 참고자료에 근거하고 있는지 검증하세요.

[응답]
{generatedAnswer}

[참고자료]
{originalResults}

[검증 항목]
1. 각 주장이 참고자료에서 확인되는가?
2. 참고자료에 없는 내용이 추가되었는가?
3. 인용이 정확한가?

[출력 형식 (JSON)]
{
  "score": 0.0-1.0,
  "citations": ["정확한 인용 1", ...],
  "hallucinations": ["근거 없는 주장 1", ...]
}
```

**파싱**: `parseGroundednessResponse(text) → { score, citations, hallucinations }`

### 함수 시그니처

```typescript
// 전체 Self-RAG 파이프라인
export async function runSelfRAGPipeline(
  query: string,
  searchFn: (query: string) => Promise<SearchResult[]>,
  config?: Partial<SelfRAGConfig>
): Promise<SelfRAGResult>

// 개별 스테이지
export async function checkRetrievalNecessity(query: string, config: UsageConfig): Promise<RetrievalDecision>
export async function critiqueResults(query: string, results: SearchResult[], config: UsageConfig): Promise<CritiquedResult[]>
export async function generateWithEvidence(query: string, filteredResults: SearchResult[], config: UsageConfig): Promise<string>
export async function checkGroundedness(answer: string, results: SearchResult[], config: UsageConfig): Promise<GroundednessResult>
```

### Lazy Self-RAG 모드

```typescript
// FEATURE_FLAGS.LAZY_SELF_RAG_MODE = true (기본)
// → Stage 1 + Stage 4만 실행 (비용 70% 절감)
// Stage 2, 3은 스킵하고 기존 응답 생성 로직 사용
```

---

## 9. Rule Extraction 프롬프트

파일: `frontend/src/lib/rag/prompts/ruleExtraction.ts`

### 역할

업로드된 문서에서 글쓰기 규칙을 자동으로 추출합니다.

### 프롬프트 템플릿

```
다음 텍스트에서 글쓰기 규칙과 지침을 추출하세요.

[텍스트]
{chunkContent}

[추출 지침]
1. 명시적으로 언급된 규칙을 우선 추출하세요
2. 암묵적인 패턴도 규칙으로 정리하세요
3. 각 규칙에 카테고리를 지정하세요:
   - structure: 글의 구조, 문단 구성
   - expression: 문장 표현, 어휘 선택
   - tone: 어조, 격식 수준
   - prohibition: 금지 사항, 피해야 할 것

[출력 형식 (JSON)]
{
  "rules": [
    {
      "rule_text": "규칙 내용",
      "category": "structure|expression|tone|prohibition",
      "confidence": 0.0-1.0,
      "source_quote": "원문에서의 근거 인용"
    }
  ],
  "chunk_type": "rule|example|general"
}
```

---

## 10. Example Generation 프롬프트

파일: `frontend/src/lib/rag/prompts/exampleGeneration.ts`

### 역할

추출된 규칙에 대한 긍정/부정 예시를 생성합니다.

### 프롬프트 템플릿

```
다음 글쓰기 규칙에 대한 예시를 생성하세요.

[규칙]
{rule.rule_text}

[카테고리]
{rule.category}

[원본 문맥]
{sourceContext}

[생성 지침]
1. 긍정 예시: 규칙을 잘 따르는 문장/문단
2. 부정 예시: 규칙을 위반하는 문장/문단
3. 각 예시는 실제 글쓰기에서 나올 수 있는 자연스러운 문장이어야 합니다
4. diff_hint: 긍정/부정 예시의 핵심 차이점을 설명

[출력 형식 (JSON)]
{
  "positive_examples": [
    {
      "text": "좋은 예시 문장",
      "diff_hint": "이 문장이 좋은 이유"
    }
  ],
  "negative_examples": [
    {
      "text": "나쁜 예시 문장",
      "diff_hint": "이 문장이 나쁜 이유"
    }
  ]
}
```

---

## 11. Outline Generation 프롬프트

파일: `backend/src/infrastructure/prompts/outline_prompt.py`

### 역할

주제와 참고 문서를 기반으로 목차를 생성합니다.

### 프롬프트 템플릿

```python
OUTLINE_SYSTEM_PROMPT = """
당신은 전문적인 글쓰기 구조화 전문가입니다.
주어진 주제와 참고 자료를 바탕으로 체계적인 목차를 생성합니다.

[목차 생성 규칙]
1. depth 1: 대제목 (H1) - 3~7개
2. depth 2: 소제목 (H2) - 각 대제목 아래 2~4개
3. depth 3: 세부항목 (H3) - 필요 시 추가
4. 논리적 흐름: 서론 → 본론 → 결론 구조
5. 참고 자료의 핵심 주제를 반영

[출력 형식 (JSON)]
{
  "outline": [
    { "title": "제목", "depth": 1 },
    { "title": "소제목", "depth": 2 },
    ...
  ]
}
"""
```

### 사전 정의 템플릿

| ID | 이름 | 구조 |
|----|------|------|
| `academic` | 학술 논문 | 서론 → 문헌 검토 → 연구 방법 → 결과 → 논의 → 결론 |
| `blog` | 블로그 포스트 | 도입부 → 핵심 내용 → 예시/사례 → 마무리 |
| `report` | 보고서 | 개요 → 현황 분석 → 문제점 → 해결 방안 → 기대 효과 → 결론 |

---

## 12. Shadow Writer 프롬프트

파일: `frontend/src/app/api/suggest/route.ts`

### 역할

사용자가 타이핑할 때 다음 문장을 자동완성으로 제안합니다.

### 프롬프트 빌드 함수

```typescript
function buildSuggestionPrompt(
  contextBefore: string,    // 커서 앞 200자
  ragContext: Array<{ content: string }>  // RAG 검색 결과 (최대 3개)
): string
```

### 프롬프트 템플릿

```
다음 글의 이어질 내용을 자연스럽게 완성하세요.

[현재까지의 글]
{contextBefore (최대 200자)}

[참고 자료]
{ragContext (최대 3개 청크)}

[지시사항]
1. 한 문장만 완성하세요
2. 앞 문맥과 자연스럽게 이어지도록 하세요
3. 참고 자료의 스타일과 내용을 반영하세요
4. 새로운 주제를 갑자기 도입하지 마세요
```

### 설정값

| 항목 | 값 | 설명 |
|------|-----|------|
| `CONTEXT_BEFORE_LENGTH` | 200 | 커서 앞 컨텍스트 길이 |
| `RAG_TOP_K` | 3 | RAG 검색 결과 수 |
| `MAX_TOKENS` | 100 | 최대 생성 토큰 수 |

---

## 13. 환각 탐지

파일: `frontend/src/lib/rag/hallucinationDetector.ts`

### 역할

LLM 응답에서 회피형 환각(Evasion Hallucination)을 탐지합니다.

### 탐지 원리

참고 자료가 실제로 존재하는데도 "자료에 내용이 없다"고 답변하는 패턴을 감지합니다.

### 패턴 목록 및 신뢰도

**높은 신뢰도 (0.85+)**

| 패턴 (정규식) | 신뢰도 | 설명 |
|---------------|--------|------|
| `참고\s*자료에\s*(관련)?\s*내용이\s*없` | 0.90 | 명시적 회피 |
| `제공된\s*자료에는?\s*(관련)?\s*내용이?\s*없` | 0.90 | 명시적 회피 |
| `자료를?\s*찾을\s*수\s*없` | 0.85 | 자료 접근 실패 주장 |

**중간 신뢰도 (0.7~0.84)**

| 패턴 (정규식) | 신뢰도 | 설명 |
|---------------|--------|------|
| `관련\s*문서가?\s*없` | 0.80 | 간접적 회피 |
| `참고할\s*(만한)?\s*내용이?\s*없` | 0.75 | 간접적 회피 |
| `자료에서?\s*(관련)?\s*정보를?\s*찾지\s*못` | 0.75 | 간접적 회피 |

**낮은 신뢰도 (0.5~0.69)** — 수동 검증 필요

| 패턴 (정규식) | 신뢰도 | 설명 |
|---------------|--------|------|
| `일반적인\s*(글쓰기)?\s*방법(으로\|을)` | 0.60 | 참고 자료 무시 가능성 |
| `기본적으로\s*글(을)?\s*쓸\s*때` | 0.55 | 참고 자료 무시 가능성 |

### 함수 시그니처

```typescript
export function detectEvasionHallucination(
  hasRetrievedDocs: boolean,    // 검색 결과 존재 여부
  modelResponse: string,        // LLM 응답
  confidenceThreshold: number = 0.7  // 임계값
): HallucinationCheckResult

// 반환 타입
interface HallucinationCheckResult {
  isHallucination: boolean
  type: 'evasion' | 'fabrication' | 'none'
  confidence: number
  matchedPattern: string | null
  description: string | null
}
```

### 탐지 로직

1. `hasRetrievedDocs === false` → 환각 아님 (정상)
2. 패턴 매칭 순회 (높은 신뢰도 먼저)
3. `confidence >= confidenceThreshold` → 환각으로 판정
4. 매칭 없음 → 환각 아님

---

## 14. JSON 파싱 전략

### sanitizeJSON

모든 Judge/Advisor 모듈에서 공통으로 사용하는 JSON 정제 함수:

```typescript
function sanitizeJSON(text: string): string {
  let cleaned = text.trim()
  // 1. 마크다운 코드 블록 제거 (```json ... ```)
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.replace(/^```json\s*/, '').replace(/\s*```$/, '')
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```\s*/, '').replace(/\s*```$/, '')
  }
  // 2. trailing comma 제거
  cleaned = cleaned.replace(/,(\s*[}\]])/g, '$1')
  return cleaned.trim()
}
```

### extractJSON (parser.ts)

더 robust한 JSON 추출기 (Gemma 3 등 호환):

```typescript
export function extractJSON(text: string): string | null
// 1. 직접 JSON.parse 시도
// 2. 코드 블록 내 JSON 추출
// 3. 중괄호/대괄호 매칭으로 추출
// 4. 모두 실패 시 null 반환
```

### parseSelfRAGResponse

Self-RAG 전용 파서:

```typescript
function parseSelfRAGResponse(text: string): { needed: boolean; confidence: number; reason: string }
// 1. JSON 직접 파싱
// 2. 코드 블록 내 JSON 추출
// 3. 실패 시 기본값: { needed: true, confidence: 0.5, reason: 'Parse failed' }
```

---

## 15. 프롬프트 설계 원칙

### 1. 구조화된 출력 강제

- **JSON Only 지시**: `"반드시 순수 JSON만 출력하세요"`
- **마크다운 금지**: `"DO NOT use markdown code blocks"`
- **Gemini JSON 모드**: `responseMimeType: 'application/json'` (가능한 경우)

### 2. 가드레일 패턴

```
[가드레일]
⚠️ 근거 불충분: "insufficient_evidence"로 표기
⚠️ 절대 날조 금지: 확실하지 않으면 "lacking evidence"로 표기
```

### 3. 보수적 에러 처리

| 모듈 | 에러 시 기본값 |
|------|---------------|
| Align Judge | `status: 'partial'` |
| Holistic Advisor | `overall: 0`, 에러 메시지 포함 |
| Patch Generator | throw (상위에서 처리) |
| Self-RAG | `needed: true`, `score: 0.5` |

### 4. Temperature 전략

| 용도 | temperature | 이유 |
|------|-------------|------|
| 판정/평가 | 0.0 ~ 0.1 | 일관된 결과 필요 |
| 패치 생성 | 0.2 | 약간의 창의성 허용 |
| 채팅 | 0.7 | 자연스러운 대화 |
| 연구/검색 | 0.3 | 정확성과 다양성 균형 |

### 5. 비용 최적화 전략

- **Lazy Self-RAG**: Stage 2, 3 스킵으로 70% 비용 절감
- **모델 라우팅**: `llm-usage-map.ts`에서 용도별 최적 모델 할당
- **컨텍스트 제한**: Shadow Writer는 200자, 패치는 1000자로 컨텍스트 제한
- **캐싱**: CriteriaPack 캐시로 반복 검색 방지
