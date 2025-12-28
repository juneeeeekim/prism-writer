# 📋 Config 디렉토리 가이드

**최종 업데이트**: 2025-12-28  
**수정 이력**: LLM 모델 중앙화 마이그레이션 (Phase 16)

---

## 📁 파일 구조

```
frontend/src/config/
├── models.ts           # LLM 모델 레지스트리 (모델 정의)
├── llm-usage-map.ts    # 🆕 서비스별 LLM 모델 매핑 (모델 할당)
├── llm.config.ts       # 환경 변수 기반 LLM 설정
├── embedding-models.ts # 임베딩 모델 레지스트리
└── README.md           # 이 문서
```

---

## 🎯 llm-usage-map.ts 사용 가이드

### 목적

서비스별로 어떤 LLM 모델을 사용하는지 **한눈에 확인**하고 **중앙에서 관리**합니다.

### 핵심 타입

```typescript
// 서비스 컨텍스트 (어디서 LLM을 사용하는가?)
type LLMUsageContext =
  | "rag.answer" // RAG 답변 생성
  | "rag.reviewer" // RAG 검토자
  | "rag.reranker" // 검색 결과 재순위
  | "template.consistency" // 템플릿 일관성 검증
  | "template.hallucination" // 환각 검증
  | "template.regression" // 템플릿 회귀 검사
  | "example.mining" // 예시 마이닝
  | "rule.mining" // 규칙 마이닝
  | "premium.answer" // 프리미엄 답변
  | "premium.reviewer"; // 프리미엄 검토

// 각 컨텍스트별 설정
interface UsageConfig {
  modelId: string; // 기본 사용 모델 ID
  fallback?: string; // 폴백 모델 ID
  maxTokens?: number; // 최대 출력 토큰 수
  description: string; // 설명 (한글)
}
```

### 사용 방법

```typescript
import { getModelForUsage, getFallbackModel } from "@/config/llm-usage-map";

// 1. 서비스에 맞는 모델 ID 가져오기
const model = getModelForUsage("rag.answer");
// → 'gemini-3-flash-preview'

// 2. 폴백 모델 가져오기 (선택적)
const fallback = getFallbackModel("rag.answer");
// → 'gpt-5-mini-2025-08-07'

// 3. Gemini 초기화 시 사용
const genAI = new GoogleGenerativeAI(apiKey);
const model = genAI.getGenerativeModel({
  model: getModelForUsage("template.consistency"),
  // ...
});
```

---

## 🔧 모델 변경 방법

### 특정 서비스의 모델 변경

`llm-usage-map.ts` 파일에서 해당 컨텍스트의 `modelId` 수정:

```typescript
// Before
'rag.answer': {
  modelId: 'gemini-3-flash-preview',
  // ...
},

// After (예: Pro 모델로 변경)
'rag.answer': {
  modelId: 'gemini-3-pro-preview',
  // ...
},
```

### 전체 기본 모델 변경

`models.ts` 파일에서 `isDefault: true` 플래그 변경 또는 환경 변수 설정:

```bash
# .env.local
DEFAULT_MODEL=gemini-3-pro-preview
```

---

## ➕ 새 기능에 모델 매핑 추가하기

### 1단계: 컨텍스트 타입 추가

```typescript
// llm-usage-map.ts
export type LLMUsageContext =
  | "rag.answer"
  // ... 기존 항목
  | "newfeature.context"; // 🆕 추가
```

### 2단계: 매핑 데이터 추가

```typescript
// llm-usage-map.ts
export const LLM_USAGE_MAP: Record<LLMUsageContext, UsageConfig> = {
  // ... 기존 항목

  // 🆕 새 컨텍스트 추가
  "newfeature.context": {
    modelId: "gemini-3-flash-preview",
    fallback: "gpt-5-mini-2025-08-07",
    maxTokens: 2000,
    description: "새 기능 설명 (한글)",
  },
};
```

### 3단계: 코드에서 사용

```typescript
// 새 기능 파일
import { getModelForUsage } from "@/config/llm-usage-map";

const model = getModelForUsage("newfeature.context");
```

---

## 🔍 디버그 유틸리티

### 현재 매핑 상태 확인

브라우저 콘솔에서:

```javascript
// 전체 매핑 출력
printUsageMap();

// 결과:
// 📋 LLM Usage Map:
// ================
//   rag.answer: gemini-3-flash-preview (fallback: gpt-5-mini-2025-08-07)
//   rag.reviewer: gemini-3-flash-preview
//   ...
```

### 특정 컨텍스트 확인

```typescript
import { getUsageConfig } from "@/config/llm-usage-map";

const config = getUsageConfig("rag.answer");
console.log(config);
// {
//   modelId: 'gemini-3-flash-preview',
//   fallback: 'gpt-5-mini-2025-08-07',
//   maxTokens: 2000,
//   description: 'RAG 기반 답변 생성'
// }
```

---

## 📚 관련 문서

- [LLM Centralization Expert Meeting](../../plan_report/2512281121_LLM_Centralization_Expert_Meeting.md)
- [LLM Centralization Checklist](../../plan_report/2512281137_LLM_Centralization_Checklist.md)
- [JeDebug Analysis](../../plan_report/2512281131_LLM_Centralization_JeDebug.md)

---

## ⚠️ 주의사항

1. **순환 참조 방지**: `llm-usage-map.ts`는 `models.ts`만 import하고, 다른 타입 파일을 import하지 않습니다.
2. **모듈 레벨 캐싱**: 일부 모듈(예: `reranker.ts`)은 모델 인스턴스를 캐싱하므로, 런타임 중 모델 변경이 즉시 반영되지 않을 수 있습니다.
3. **타입 안전성**: 존재하지 않는 컨텍스트를 사용하면 TypeScript 컴파일 에러가 발생합니다.

---

_이 문서는 LLM 중앙화 마이그레이션(Phase 16) 결과물입니다._
