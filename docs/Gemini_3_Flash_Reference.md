# Gemini 3.0 Flash - LLM 레퍼런스 문서

> **PRISM Writer 서비스 기본 LLM 모델**
>
> 문서 작성일: 2025년 12월 25일
>
> 출처: [Google AI - Gemini 3 Developer Guide](https://ai.google.dev/gemini-api/docs/gemini-3)

---

## 📋 목차

1. [모델 개요](#모델-개요)
2. [가격 정보](#가격-정보)
3. [성능 특징](#성능-특징)
4. [API 사용법](#api-사용법)
5. [Thinking Level 설정](#thinking-level-설정)
6. [권장 설정](#권장-설정)
7. [프롬프트 모범 사례](#프롬프트-모범-사례)
8. [FAQ](#faq)

---

## 모델 개요

### Gemini 3 시리즈

| 모델               | API ID                       | 특징                                      | 상태            |
| ------------------ | ---------------------------- | ----------------------------------------- | --------------- |
| **Gemini 3 Pro**   | `gemini-3-pro-preview`       | 복잡한 작업, 광범위한 지식, 멀티모달 추론 | Preview         |
| **Gemini 3 Flash** | `gemini-3-flash-preview`     | **Pro급 지능 + Flash 속도/가격**          | Preview ✅ 기본 |
| Nano Banana Pro    | `gemini-3-pro-image-preview` | 최고 품질 이미지 생성                     | Preview         |

### 주요 스펙

| 항목                     | Gemini 3 Flash                 |
| ------------------------ | ------------------------------ |
| **Model ID**             | `gemini-3-flash-preview`       |
| **Knowledge Cutoff**     | 2025년 1월                     |
| **Input Context Window** | 1,000,000 tokens (1M)          |
| **Max Output Tokens**    | 65,536 tokens                  |
| **지원 입력**            | 텍스트, 이미지, 오디오, 비디오 |
| **Free Tier**            | ✅ 사용 가능                   |

---

## 가격 정보

### Gemini 3 Flash 가격 (per 1M tokens)

| 항목            | 가격 (USD)        |
| --------------- | ----------------- |
| **입력 토큰**   | $0.50 / 1M tokens |
| **출력 토큰**   | $3.00 / 1M tokens |
| **오디오 입력** | $1.00 / 1M tokens |

### 비교: Gemini 3 Flash vs Gemini 2.5 Pro

| 항목      | Gemini 3 Flash | Gemini 2.5 Pro | 절감율       |
| --------- | -------------- | -------------- | ------------ |
| 입력 토큰 | $0.50          | $1.25          | **60% 저렴** |
| 출력 토큰 | $3.00          | $10.00         | **70% 저렴** |

> **참고**: Gemini 3 Flash는 Gemini 3 Pro보다 1/4 비용

---

## 성능 특징

### 벤치마크 성능

| 벤치마크                 | Gemini 3 Flash | 비고            |
| ------------------------ | -------------- | --------------- |
| **GPQA Diamond**         | 90.4%          | PhD급 추론/지식 |
| **Humanity's Last Exam** | 33.7%          | (without tools) |
| **MMMU Pro**             | 81.2%          | 멀티모달 이해   |
| **SWE-bench Verified**   | 78%            | 코딩 능력       |
| **LiveCodeBench**        | 2316 Elo       | 코딩 벤치마크   |

### 속도 및 효율성

| 항목            | Gemini 3 Flash      | vs Gemini 2.5 Pro      |
| --------------- | ------------------- | ---------------------- |
| **출력 속도**   | 218 tokens/sec      | **3배 빠름**           |
| **토큰 효율성** | -                   | **30% 적은 토큰 사용** |
| **평가 성능**   | 18/20 카테고리 우수 | -                      |

### 핵심 기능

- ✅ **Dynamic Thinking**: 기본적으로 동적 추론 사용
- ✅ **멀티모달**: 텍스트, 이미지, 오디오, 비디오 입력 지원
- ✅ **고급 시각/공간 추론**: 복잡한 비디오 분석, 데이터 추출
- ✅ **Batch API 지원**
- ✅ **Context Caching 지원** (최소 2,048 토큰)

---

## API 사용법

### JavaScript (Node.js)

```javascript
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({});

async function run() {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview", // ← Flash 모델
    contents: "사용자 입력 텍스트",
  });
  console.log(response.text);
}

run();
```

### Python

```python
from google import genai

client = genai.Client()

response = client.models.generate_content(
    model="gemini-3-flash-preview",  # ← Flash 모델
    contents="사용자 입력 텍스트",
)
print(response.text)
```

### REST API

```bash
curl "https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent" \
  -H "x-goog-api-key: $GEMINI_API_KEY" \
  -H 'Content-Type: application/json' \
  -X POST \
  -d '{
    "contents": [{
      "parts": [{"text": "사용자 입력 텍스트"}]
    }]
  }'
```

---

## Thinking Level 설정

### Flash 전용 Thinking Levels

Gemini 3 Flash는 Pro보다 더 많은 thinking level을 지원합니다:

| Level     | 설명                                           | 사용 사례                    |
| --------- | ---------------------------------------------- | ---------------------------- |
| `minimal` | "no thinking"과 동일 (복잡한 코딩만 최소 사고) | 채팅, 고처리량 앱            |
| `low`     | 최소 레이턴시/비용                             | 단순 지시, 채팅, 고처리량 앱 |
| `medium`  | 균형 잡힌 사고                                 | 대부분의 일반 작업           |
| `high`    | **기본값** - 최대 추론 깊이                    | 복잡한 추론 작업             |

### JavaScript 예시

```javascript
const response = await ai.models.generateContent({
  model: "gemini-3-flash-preview",
  contents: "How does AI work?",
  config: {
    thinkingConfig: {
      thinkingLevel: "low", // 빠른 응답용
    },
  },
});
```

### Python 예시

```python
from google.genai import types

response = client.models.generate_content(
    model="gemini-3-flash-preview",
    contents="How does AI work?",
    config=types.GenerateContentConfig(
        thinking_config=types.ThinkingConfig(thinking_level="low")
    ),
)
```

---

## 권장 설정

### Temperature 설정

> ⚠️ **중요**: Gemini 3에서는 **temperature = 1.0 (기본값)** 유지를 **강력 권장**합니다.
>
> temperature를 1.0 미만으로 설정하면 **루핑** 또는 **성능 저하**가 발생할 수 있습니다.
> 특히 복잡한 수학이나 추론 작업에서 문제가 될 수 있습니다.

### PRISM Writer 권장 설정

| 설정                | 권장값                    | 이유              |
| ------------------- | ------------------------- | ----------------- |
| **Model**           | `gemini-3-flash-preview`  | 비용/성능 최적    |
| **Temperature**     | `1.0` (기본값)            | 공식 권장         |
| **Thinking Level**  | `low` 또는 `medium`       | 빠른 응답 필요 시 |
| **Context Caching** | ✅ 활성화 (2,048+ tokens) | 비용 절감         |

---

## 프롬프트 모범 사례

### 1. 간결한 지시

```
❌ 잘못된 예: "이것은 중요한 작업입니다. 먼저 이런 점을 생각하고, 그 다음에..."
✅ 올바른 예: "다음 코드의 버그를 찾아 수정하세요: [코드]"
```

Gemini 3은 **직접적이고 명확한** 지시에 가장 잘 반응합니다.

### 2. 출력 상세도 조절

기본적으로 Gemini 3은 **간결한 답변**을 선호합니다.

```
✅ 더 자세한 답변 필요 시: "친근하고 대화적인 어시스턴트로서 설명해주세요."
```

### 3. 대용량 데이터 처리

긴 문서/코드베이스/비디오 작업 시:

```
[데이터 컨텍스트...]

위 정보를 기반으로, [구체적인 질문]
```

**질문/지시를 데이터 뒤에 배치**하세요.

---

## FAQ

### Q1. Knowledge cutoff는 언제인가요?

**2025년 1월**입니다. 최신 정보가 필요하면 Search Grounding 도구를 사용하세요.

### Q2. Context window 제한은?

- **입력**: 1,000,000 tokens (1M)
- **출력**: 최대 64,000 tokens

### Q3. 무료 티어가 있나요?

- **Gemini 3 Flash**: ✅ 무료 티어 있음
- **Gemini 3 Pro**: ❌ API에서 무료 티어 없음 (Google AI Studio에서는 무료 테스트 가능)

### Q4. 지원 도구는?

| 도구             | 지원 여부        |
| ---------------- | ---------------- |
| Google Search    | ✅               |
| File Search      | ✅               |
| Code Execution   | ✅               |
| URL Context      | ✅               |
| Function Calling | ✅ (개별 도구만) |
| Maps Grounding   | ❌               |
| Computer Use     | ❌               |

### Q5. Batch API 지원?

✅ 지원됩니다.

### Q6. Context Caching 지원?

✅ 지원됩니다. 최소 2,048 토큰 필요.

---

## Thought Signatures (중요)

### 개요

Gemini 3은 **Thought Signatures**를 사용하여 API 호출 간 추론 컨텍스트를 유지합니다.

### 필수 적용 케이스

| 사용 케이스              | Signature 필수           |
| ------------------------ | ------------------------ |
| Function Calling         | ✅ **Strict** (400 에러) |
| Text/Chat                | ⚠️ 권장 (품질 저하)      |
| Image Generation/Editing | ✅ **Strict** (400 에러) |

> ⚠️ `thinking_level`이 `minimal`로 설정되어도 Gemini 3 Flash에서는 **Thought Signatures 순환이 필수**입니다.

### 코드 예시 (Function Calling)

```javascript
// 모델 응답에서 signature 저장
const response = await ai.models.generateContent({...});
const signature = response.parts[0].thoughtSignature; // ← 저장 필수

// 다음 요청에 signature 포함
const nextResponse = await ai.models.generateContent({
  contents: [
    previousResponse,  // signature 포함
    userFunctionResponse,
  ]
});
```

---

## 변경 이력

| 날짜       | 변경 내용      |
| ---------- | -------------- |
| 2025-12-25 | 초기 문서 생성 |

---

> **PRISM Writer 개발팀**
>
> 이 문서는 프로젝트의 LLM 레퍼런스 자료로 사용됩니다.
