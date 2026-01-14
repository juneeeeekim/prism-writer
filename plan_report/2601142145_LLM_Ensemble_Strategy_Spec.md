# 기술 개발 정의서: LLM 파라미터 최적화 (Jemiel 앙상블 전략)

**문서 번호**: 260114_LLM_Ensemble_Strategy_v2
**작성일**: 2026년 1월 14일
**작성자**: Antigravity (Agent)
**수정자**: Claude Opus 4.5 (Code Review Agent)
**관련 프로젝트**: PRISM Writer (LLM Engine Optimization)

---

## 1. 개요 (Overview)

### 1.1 배경

현재 PRISM Writer 서비스는 LLM을 다양한 목적(단순 답변, 검색 결과 검토, 창의적 글쓰기 제안 등)으로 사용하고 있으나, 생성 파라미터(`temperature`, `topP`, `topK`)가 각 코드에 하드코딩되어 있거나 기본값(Default)에 의존하고 있습니다. 이는 서비스의 목적에 부합하지 않는 품질 저하(예: 창의성이 필요한 곳에서 너무 뻔한 답변, 정확성이 필요한 곳에서 환각 발생)를 유발할 수 있습니다.

### 1.2 목적

LLM 아키텍처 전문가 "Jemiel"이 제안한 **'앙상블(Ensemble)' 전략**을 도입하여, 각 파이프라인 단계별로 최적화된 생성 파라미터를 중앙에서 관리하고 적용합니다. 이를 통해 **"무손실 추출(Lossless Extraction)"**과 **"창의적 생성(Creative Generation)"**이라는 두 마리 토끼를 모두 잡는 것을 목표로 합니다.

---

## 2. 현황 분석 (As-Is)

### 2.1 코드베이스 분석 결과 (2026-01-14 실사)

#### ✅ 이미 적용 완료된 부분

| 파일/모듈 | 적용 상태 | 세부 사항 |
|-----------|-----------|-----------|
| `llm-usage-map.ts` | ✅ 완료 | `generationConfig` 인터페이스 정의 및 18개 컨텍스트 설정 |
| `selfRAG.ts` | ✅ 완료 | `getUsageConfig('rag.selfrag')` 사용, Jemiel 전략 적용 |
| `suggest/route.ts` | ✅ 완료 | `getUsageConfig('suggest.completion')` 사용 |
| `alignJudge.ts` | ⚠️ 부분 | `config?.generationConfig?.temperature` 사용, 직접 SDK 호출 |
| `GeminiProvider` | ✅ 완료 | `topK` 파라미터 지원 |

#### ❌ 미적용 / 문제 발견

| 파일/모듈 | 문제 | 위치 |
|-----------|------|------|
| `holisticAdvisor.ts` | 하드코딩 `temperature: 0.3` | L260 |
| `queryGenerator.ts` | 하드코딩 `temperature: 0.3` | L130 |
| `premium.answer` | `generationConfig` 누락 | `llm-usage-map.ts` |
| `premium.reviewer` | `generationConfig` 누락 | `llm-usage-map.ts` |
| `raft.generation` | `generationConfig` 누락 | `llm-usage-map.ts` |
| `rag.rerank` | `generationConfig` 누락 | `llm-usage-map.ts` |
| `pattern.extraction` | `generationConfig` 누락 | `llm-usage-map.ts` |
| `outline.generation` | `generationConfig` 누락 | `llm-usage-map.ts` |
| `ocr.vision` | `generationConfig` 누락 | `llm-usage-map.ts` |

### 2.2 원본 문제점 (유지)

1. **설정 분산**: `GeminiProvider`, `SelfRAG`, `AlignJudge` 등 여러 파일에 `temperature` 등의 값이 산재되어 있음.
2. **획일적 적용**: 대부분 `0.3` (Gemini 기본값) 또는 `0.1`, `0.7` 등으로 각 개발자의 임의 판단에 의해 설정됨.
3. **Top-K 미활용**: 창의적 글쓰기에 중요한 `Top-K` 파라미터가 명시적으로 제어되지 않고 있음.

---

## 3. 기술 목표 (To-Be)

Jemiel의 전략에 따라 다음 두 가지 모드로 파라미터를 이원화 및 최적화합니다.

### 3.1 전략 1: 무손실 추출 및 검증 (Deterministic)

- **목적**: 데이터의 무결성 확보, 논리적 판단, 엄격한 검증
- **대상**:
  - `rag.reviewer` (RAG 답변 품질 검토)
  - `judge.*` (루브릭 평가, Align Judge)
  - `template.*` (템플릿 게이트 검증)
  - `rag.selfrag` (검색 필요 여부 판단)
- **파라미터 설정**:
  - `Temperature`: **0.0** (완전한 결정론적 동작, Greedy Decoding)
  - `Top-P`: **1.0** (모든 확률 분포 고려하되 Temp 0으로 인해 의미 축소)
  - `Top-K`: **1** (가장 확률 높은 단어만 선택)

### 3.2 전략 2: 창의적 생성 (Creative)

- **목적**: 시청자의 심리를 자극하는 파격적 아이디어, 풍부한 표현력
- **대상**:
  - `rag.answer` (RAG 기반 답변 생성 - _사용자 설정에 따라 변동 가능_)
  - `suggest.completion` (Shadow Writer 문장 제안)
  - `research.query` (다양한 검색어 생성)
- **파라미터 설정**:
  - `Temperature`: **0.9 ~ 1.2** (확률 분포를 평평하게 하여 다양성 확보)
  - `Top-P`: **0.9 ~ 0.95** (Nucleus Sampling, 쌩뚱맞은 노이즈 제거)
  - `Top-K`: **40 ~ 50** (선택 후보군 제한으로 안정적인 창의성 확보)

---

## 4. 상세 설계 (Detailed Design)

### 4.1 설정 구조 (현재 구현됨)

`UsageConfig` 인터페이스가 이미 확장되어 있습니다 (`frontend/src/config/llm-usage-map.ts`):

```typescript
export interface UsageConfig {
  modelId: string;
  fallback?: string;
  maxTokens?: number;
  description: string;
  // [v3.0] 생성 파라미터 (Jemiel 전략)
  generationConfig?: {
    temperature: number;
    topP: number;
    topK?: number;
  };
}
```

### 4.2 누락된 컨텍스트 보완 (ACTION REQUIRED)

아래 컨텍스트에 `generationConfig`를 추가해야 합니다:

```typescript
// 추가 필요: premium 티어
'premium.answer': {
  modelId: 'gemini-3-pro-preview',
  fallback: 'gemini-3-flash-preview',
  description: '프리미엄 사용자용 고품질 답변',
  // [NEW] Creative 설정
  generationConfig: {
    temperature: 0.9,
    topP: 0.95,
    topK: 40,
  },
},
'premium.reviewer': {
  modelId: 'gemini-3-pro-preview',
  fallback: 'gemini-3-flash-preview',
  description: '프리미엄 사용자용 고품질 검토',
  // [NEW] Lossless 설정
  generationConfig: {
    temperature: 0.0,
    topP: 1.0,
    topK: 1,
  },
},

// 추가 필요: RAFT, rerank, etc.
'raft.generation': {
  modelId: 'gemma-3-12b-it',
  fallback: 'gemini-3-flash-preview',
  description: 'RAFT 합성 데이터 생성',
  // [NEW] Semi-Creative (학습 데이터 다양성 필요)
  generationConfig: {
    temperature: 0.6,
    topP: 0.95,
    topK: 30,
  },
},
'rag.rerank': {
  modelId: 'gemma-3-2b-it',
  description: '검색 결과 재순위 (rerank.ts 전용)',
  // [NEW] Lossless 설정
  generationConfig: {
    temperature: 0.0,
    topP: 1.0,
    topK: 1,
  },
},
'pattern.extraction': {
  modelId: 'gemini-3-flash-preview',
  description: '문서 패턴 추출',
  // [NEW] Lossless 설정
  generationConfig: {
    temperature: 0.0,
    topP: 1.0,
    topK: 1,
  },
},
'outline.generation': {
  modelId: 'gemma-3-2b-it',
  description: '목차 생성',
  // [NEW] Semi-Creative (다양한 목차 구조)
  generationConfig: {
    temperature: 0.5,
    topP: 0.95,
    topK: 20,
  },
},
'ocr.vision': {
  modelId: 'gemma-3-4b-it',
  description: 'OCR 이미지 텍스트 추출',
  // [NEW] Lossless 설정 (정확한 추출)
  generationConfig: {
    temperature: 0.0,
    topP: 1.0,
    topK: 1,
  },
},
```

### 4.3 하드코딩 제거 마이그레이션

#### 4.3.1 `holisticAdvisor.ts` (L252-262)

**Before:**
```typescript
const result = await model.generateContent({
  contents: [{ role: 'user', parts: [{ text: prompt }] }],
  generationConfig: {
    responseMimeType: 'application/json',
    temperature: 0.3  // 하드코딩
  },
})
```

**After:**
```typescript
// import 추가
import { getUsageConfig } from '@/config/llm-usage-map'

// 호출부 수정
const config = getUsageConfig('judge.holistic')

const result = await model.generateContent({
  contents: [{ role: 'user', parts: [{ text: prompt }] }],
  generationConfig: {
    responseMimeType: 'application/json',
    temperature: config?.generationConfig?.temperature ?? 0.1,
    topP: config?.generationConfig?.topP,
    topK: config?.generationConfig?.topK,
  },
})
```

#### 4.3.2 `queryGenerator.ts` (L127-131)

**Before:**
```typescript
const response = await generateText(prompt, {
  model: getModelForUsage('research.query'),
  maxOutputTokens: 50,
  temperature: 0.3,  // 하드코딩
})
```

**After:**
```typescript
const config = getUsageConfig('research.query')

const response = await generateText(prompt, {
  model: config?.modelId,
  maxOutputTokens: config?.maxTokens ?? 50,
  temperature: config?.generationConfig?.temperature,
  topP: config?.generationConfig?.topP,
  topK: config?.generationConfig?.topK,
})
```

### 4.4 주요 컨텍스트별 적용 값 (최종)

| Context              | Role        | Model     | Temp    | Top-P | Top-K | 설명                     |
| :------------------- | :---------- | :-------- | :------ | :---- | :---- | :----------------------- |
| `rag.answer`         | 창의적 답변 | Flash/Pro | **0.9** | 0.95  | 40    | 풍부하고 자연스러운 답변 |
| `rag.reviewer`       | 품질 검토   | Gemma 12B | **0.0** | 1.0   | 1     | 냉정하고 일관된 평가     |
| `suggest.completion` | 문장 제안   | Gemma 4B  | **0.8** | 0.9   | 40    | 다양한 문장 완성 제안    |
| `judge.align`        | 루브릭 판정 | Gemma 27B | **0.0** | 1.0   | 1     | 언제나 동일한 판정 결과  |
| `judge.holistic`     | 종합 평가   | Flash     | **0.1** | 0.95  | 10    | 약간의 유연성 허용       |
| `research.query`     | 검색 쿼리   | Gemma 4B  | **0.8** | 0.95  | 40    | 다양한 검색어 조합       |
| `premium.answer`     | 프리미엄    | Pro       | **0.9** | 0.95  | 40    | 고품질 창의적 답변       |
| `raft.generation`    | 데이터 생성 | Gemma 12B | **0.6** | 0.95  | 30    | 학습 데이터 다양성       |
| `ocr.vision`         | OCR 추출    | Gemma 4B  | **0.0** | 1.0   | 1     | 정확한 텍스트 추출       |

---

## 5. 예측된 문제점 및 해결 방안

### 5.1 다중 벤더 파라미터 호환성

**문제**: OpenAI와 Anthropic은 `topK`를 지원하지 않거나 다른 방식으로 처리함.

**해결**:
```typescript
// providers/openai.ts
async generateText(prompt: string, options: LLMGenerateOptions) {
  const { temperature, topP, topK } = options;

  // OpenAI는 topK 미지원 - topP로 대체 효과
  return this.client.chat.completions.create({
    model: modelId,
    messages: [{ role: 'user', content: prompt }],
    temperature,
    top_p: topP,
    // topK는 무시 (OpenAI 미지원)
  });
}

// providers/anthropic.ts
async generateText(prompt: string, options: LLMGenerateOptions) {
  const { temperature, topP, topK } = options;

  return this.client.messages.create({
    model: modelId,
    messages: [{ role: 'user', content: prompt }],
    temperature,
    top_p: topP,
    top_k: topK, // Anthropic은 top_k 지원
  });
}
```

### 5.2 사용자 오버라이드 메커니즘 부재

**문제**: 현재 설정은 시스템 전역 적용만 가능, 사용자별/프로젝트별 커스터마이징 불가.

**해결 (향후 구현)**:
```typescript
// 사용자 설정 오버라이드 레이어
export interface UserGenerationPreference {
  userId: string;
  context: LLMUsageContext;
  overrides: Partial<UsageConfig['generationConfig']>;
}

export async function getEffectiveConfig(
  context: LLMUsageContext,
  userId?: string,
  projectId?: string
): Promise<UsageConfig> {
  const baseConfig = getUsageConfig(context);

  if (!userId) return baseConfig;

  // 1. 사용자 전역 설정 조회
  const userPref = await getUserPreference(userId, context);

  // 2. 프로젝트별 설정 조회 (우선순위 높음)
  const projectPref = projectId
    ? await getProjectPreference(userId, projectId, context)
    : null;

  // 3. 병합 (project > user > system)
  return {
    ...baseConfig,
    generationConfig: {
      ...baseConfig.generationConfig,
      ...userPref?.overrides,
      ...projectPref?.overrides,
    },
  };
}
```

### 5.3 Temperature 0.0 시 모델별 동작 차이

**문제**: 일부 모델에서 temperature=0.0은 지원되지 않거나 경고 발생.

**해결**:
```typescript
function normalizeTemperature(temp: number, provider: string): number {
  // Gemini: 0.0 지원
  if (provider === 'gemini') return temp;

  // OpenAI: 0.0 대신 0.01 권장
  if (provider === 'openai' && temp === 0.0) return 0.01;

  // Anthropic: 0.0 지원
  if (provider === 'anthropic') return temp;

  return temp;
}
```

### 5.4 런타임 검증 강화

**문제**: 잘못된 파라미터 값이 설정될 경우 API 오류 발생.

**해결 (validateUsageMap 확장)**:
```typescript
export function validateUsageMap(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  for (const [context, config] of Object.entries(LLM_USAGE_MAP)) {
    const cfg = config as UsageConfig;

    // 기존: modelId 검증
    if (!isValidModelId(cfg.modelId)) {
      errors.push(`[❌ ${context}] Invalid modelId: "${cfg.modelId}"`);
    }

    // [NEW] generationConfig 범위 검증
    const gen = cfg.generationConfig;
    if (gen) {
      if (gen.temperature < 0 || gen.temperature > 2) {
        errors.push(`[❌ ${context}] temperature out of range: ${gen.temperature}`);
      }
      if (gen.topP < 0 || gen.topP > 1) {
        errors.push(`[❌ ${context}] topP out of range: ${gen.topP}`);
      }
      if (gen.topK !== undefined && (gen.topK < 1 || gen.topK > 100)) {
        errors.push(`[❌ ${context}] topK out of range: ${gen.topK}`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}
```

---

## 6. 구현 계획 (Updated)

### Phase 1: 설정 보완 (즉시 실행)
- [ ] `llm-usage-map.ts`에 누락된 8개 컨텍스트 `generationConfig` 추가
- [ ] `validateUsageMap()` 함수 확장 (범위 검증)

### Phase 2: 하드코딩 제거 (1주 내)
- [ ] `holisticAdvisor.ts` 마이그레이션
- [ ] `queryGenerator.ts` 마이그레이션
- [ ] 기타 하드코딩 파일 전수 조사 및 수정

### Phase 3: 다중 벤더 호환성 (2주 내)
- [ ] `OpenAIProvider`에 파라미터 변환 레이어 추가
- [ ] `AnthropicProvider`에 파라미터 변환 레이어 추가
- [ ] 벤더별 통합 테스트 작성

### Phase 4: 사용자 오버라이드 (향후)
- [ ] `user_generation_preferences` 테이블 설계
- [ ] `getEffectiveConfig()` 함수 구현
- [ ] 설정 UI 컴포넌트 개발

---

## 7. 기대 효과

1. **품질 신뢰도 향상**: 검증/평가 단계에서 항상 동일한 결과를 보장하여 시스템 신뢰도 상승.
2. **사용자 경험 개선**: 글쓰기 제안 및 답변 생성 시 로봇 같은 어투를 탈피하고 더욱 창의적인 표현 제공.
3. **유지보수 용이성**: 모든 생성 파라미터가 `llm-usage-map.ts` 한 곳에서 관리되므로, 향후 모델 변경이나 튜닝 시 신속한 대응 가능.
4. **확장성**: 사용자 오버라이드 메커니즘 도입으로 개인화된 글쓰기 경험 제공 가능.

---

## 8. 관련 파일

| 파일 경로 | 역할 |
|-----------|------|
| `frontend/src/config/llm-usage-map.ts` | 중앙 설정 (수정 대상) |
| `frontend/src/lib/llm/providers/gemini.ts` | Gemini Provider (완료) |
| `frontend/src/lib/rag/selfRAG.ts` | Self-RAG (완료) |
| `frontend/src/lib/judge/alignJudge.ts` | Align Judge (부분 완료) |
| `frontend/src/lib/judge/holisticAdvisor.ts` | Holistic Advisor (수정 필요) |
| `frontend/src/lib/research/queryGenerator.ts` | Query Generator (수정 필요) |
| `frontend/src/app/api/suggest/route.ts` | Suggest API (완료) |

---

**End of Document**
