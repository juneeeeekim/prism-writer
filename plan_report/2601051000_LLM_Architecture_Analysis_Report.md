# LLM 아키텍처 분석 보고서

---

| 항목 | 내용 |
|------|------|
| **문서 버전** | v1.1 |
| **작성일** | 2026년 01월 05일 |
| **작성자** | PRISM Writer 기술팀 |
| **문서 목적** | PRISM Writer LLM 모델 관리 아키텍처 분석 및 현황 보고 |
| **대상 독자** | 개발팀, 기술 리더, 프로젝트 매니저 |
| **관련 파일** | `config/models.ts`, `config/llm.config.ts`, `lib/llm/gateway.ts`, `lib/llm/providers/index.ts` |

---

## 1. 개요

본 문서는 PRISM Writer 서비스의 LLM(Large Language Model) 모델 관리 아키텍처를 분석한 결과입니다. 사용자 요구사항인 "쉽고 심플한 LLM 모델 관리"와 "모델 교체/스위칭 용이성"을 기준으로 현재 아키텍처를 평가합니다.

---

## 2. 현재 아키텍처 구조

```
┌─────────────────────────────────────────────────────────────┐
│                    사용자 요청 (UI)                          │
└─────────────────────────┬───────────────────────────────────┘
                          ▼
┌─────────────────────────────────────────────────────────────┐
│              gateway.ts (단일 진입점)                        │
│         generateText() / generateTextStream()               │
└─────────────────────────┬───────────────────────────────────┘
                          ▼
┌─────────────────────────────────────────────────────────────┐
│            providers/index.ts (Provider Factory)            │
│              getProvider() / getProviderByModel()           │
└─────────────────────────┬───────────────────────────────────┘
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                 models.ts (MODEL_REGISTRY)                  │
│    Gemini | OpenAI | Anthropic 모델 정의                    │
└─────────────────────────┬───────────────────────────────────┘
                          ▼
┌─────────────────────────────────────────────────────────────┐
│              llm.config.ts (환경 설정)                       │
│     API Keys, Default Model, Enabled Providers              │
└─────────────────────────────────────────────────────────────┘
```

### 2.1 계층별 역할

| 계층 | 파일 | 역할 |
|------|------|------|
| **API Gateway** | `lib/llm/gateway.ts` | 모든 LLM 요청의 단일 진입점 |
| **Provider Factory** | `lib/llm/providers/index.ts` | Provider 인스턴스 생성 및 캐싱 |
| **Model Registry** | `config/models.ts` | 모든 모델 정의 및 메타데이터 |
| **Configuration** | `config/llm.config.ts` | 환경 변수 기반 설정 관리 |
| **Model Selector** | `lib/llm/modelSelector.ts` | 작업별 최적 모델 자동 선택 |

---

## 3. 중앙 집중식 관리 현황

### 3.1 평가 결과: ✅ 매우 우수

| 파일 | 역할 | 평가 |
|------|------|------|
| `config/models.ts` | 모든 모델 정의 (MODEL_REGISTRY) | ✅ 단일 소스 |
| `config/llm.config.ts` | 환경 설정 (API Key, 기본 모델) | ✅ 중앙 관리 |
| `lib/llm/gateway.ts` | 모든 LLM 요청의 단일 진입점 | ✅ Gateway 패턴 |
| `lib/llm/providers/index.ts` | Provider 생성/캐싱 | ✅ Factory 패턴 |

### 3.2 MODEL_REGISTRY 구조

```typescript
// config/models.ts
export const MODEL_REGISTRY: Record<string, ModelConfig> = {
  'gemini-2.0-flash-exp': {
    provider: 'gemini',
    displayName: 'Gemini 2.0 Flash',
    capabilities: ['text', 'code', 'reasoning'],
    maxTokens: 8192,
    tier: 'standard',
    enabled: true,
    // ...
  },
  'gpt-4o': { ... },
  'claude-3-5-sonnet': { ... },
  // 모든 모델이 한 곳에서 정의됨
}
```

---

## 4. 모델 교체/스위칭 용이성

### 4.1 평가 결과: ✅ 매우 편리

#### 4.1.1 기본 모델 결정 로직

기본 모델은 **우선순위 기반**으로 결정됩니다:

```
┌─────────────────────────────────────────────────────────────┐
│  getDefaultModel() 함수 (llm.config.ts:46)                  │
├─────────────────────────────────────────────────────────────┤
│  1순위: process.env.DEFAULT_MODEL 환경 변수                  │
│         ↓ (없으면)                                          │
│  2순위: getDefaultModelId() → models.ts에서                 │
│         isDefault: true 인 모델 탐색                        │
│         ↓ (없으면)                                          │
│  3순위: 폴백 값 "gemini-3-flash-preview"                    │
└─────────────────────────────────────────────────────────────┘
```

**현재 기본 모델:** `gemini-3-flash-preview` (models.ts에서 `isDefault: true` 설정됨)

#### 4.1.2 기본 모델 변경 방법

**방법 1: 환경 변수 설정 (재배포 필요)**

```bash
# .env.local (또는 Vercel/서버 환경 변수)
DEFAULT_MODEL=gpt-5.2-2025-12-11
```

- 위치: 프로젝트 루트의 `.env.local` 파일 또는 배포 플랫폼의 환경 변수 설정
- 적용: 서버 재시작 또는 재배포 후 적용
- 장점: 코드 수정 없이 모델 변경 가능

**방법 2: 코드에서 isDefault 변경**

```typescript
// config/models.ts
"gemini-3-flash-preview": {
  // ...
  isDefault: false,  // 기존 기본 모델 해제
},
"gpt-5.2-2025-12-11": {
  // ...
  isDefault: true,   // 새 기본 모델로 설정
},
```

- 위치: `frontend/src/config/models.ts` 파일
- 적용: 빌드 및 배포 후 적용
- 장점: 버전 관리에 기록됨

#### 4.1.3 런타임에서 모델 지정

```typescript
// gateway.ts를 통한 간단한 모델 지정
const response = await generateText({
  modelId: 'gpt-5.2-2025-12-11',  // 원하는 모델 ID 직접 지정
  prompt: '...',
})
```

- 기본 모델과 관계없이 호출 시점에 원하는 모델 지정 가능
- MODEL_REGISTRY에 등록된 모든 활성화 모델 사용 가능

#### 4.1.4 새 모델 추가 절차

```typescript
// models.ts에 추가하기만 하면 됨
'new-model-id': {
  provider: 'openai',  // 기존 provider 사용
  displayName: 'New Model',
  capabilities: ['text-generation', 'streaming'],
  costPerInputToken: 0.000001,
  costPerOutputToken: 0.000005,
  maxTokens: 4096,
  tier: 'premium',
  enabled: true,
}
```

#### 4.1.5 새 Provider 추가 절차

1. `lib/llm/providers/` 폴더에 새 provider 파일 생성
2. `providers/index.ts`의 Factory에 등록
3. `models.ts`에 해당 provider의 모델 추가

---

## 5. 아키텍처 강점

| 항목 | 설명 |
|------|------|
| **단일 진입점** | `gateway.ts`가 모든 LLM 요청을 처리 → 일관성 보장 |
| **Provider 추상화** | 각 provider가 동일한 인터페이스 구현 → 교체 용이 |
| **싱글톤 캐싱** | Provider 인스턴스 재사용 → 성능 최적화 |
| **환경 변수 분리** | 코드 수정 없이 설정 변경 가능 |
| **타입 안전성** | TypeScript로 모델 설정 오류 방지 |
| **Task 기반 선택** | `modelSelector.ts`로 작업별 최적 모델 자동 선택 |

---

## 6. 개선 가능 사항 (선택적)

| 항목 | 현재 상태 | 개선 방향 | 우선순위 |
|------|-----------|-----------|----------|
| **UI 모델 선택** | 환경 변수/코드 수준 | 관리자 UI에서 실시간 변경 | 중 |
| **모델 헬스 체크** | 없음 | 모델 가용성 자동 확인 | 낮 |
| **Fallback 체인** | `modelSelector`에 부분 구현 | 자동 failover 강화 | 중 |
| **사용량 모니터링** | 부분 구현 | 대시보드 통합 | 낮 |

---

## 7. 최종 평가

```
┌────────────────────────────────────────────────────────────┐
│  LLM 모델 관리 아키텍처 평가                                │
├────────────────────────────────────────────────────────────┤
│  ✅ 중앙 집중식 관리:     매우 우수 (MODEL_REGISTRY)        │
│  ✅ 모델 교체 용이성:     매우 우수 (환경 변수 + Gateway)   │
│  ✅ Provider 확장성:     우수 (Factory 패턴)               │
│  ✅ 코드 일관성:         우수 (단일 진입점)                │
│  ⚪ 런타임 동적 변경:    보통 (재배포 필요)                │
├────────────────────────────────────────────────────────────┤
│  종합:  현재 아키텍처는 사용자의 요구사항을 잘 충족합니다.   │
│        LLM 모델을 한 곳에서 관리하고, 쉽게 교체/스위칭      │
│        할 수 있는 구조로 잘 설계되어 있습니다.              │
└────────────────────────────────────────────────────────────┘
```

---

## 8. 결론

현재 PRISM Writer의 LLM 아키텍처는 사용자께서 원하시는 **"쉽고 심플한 모델 관리"**를 잘 지원하고 있습니다.

- **Gateway 패턴**: 모든 LLM 요청이 단일 진입점을 통해 처리
- **Provider Factory**: Provider 인스턴스의 효율적인 관리
- **중앙 MODEL_REGISTRY**: 모든 모델 정보가 한 곳에서 관리
- **환경 변수 기반 설정**: 코드 수정 없이 모델 변경 가능

이러한 구조를 통해 **모델 교체와 스위칭이 매우 용이한 상태**입니다.

---

## 변경 이력

| 버전 | 날짜 | 작성자 | 변경 내용 |
|------|------|--------|-----------|
| v1.0 | 2026-01-05 | 기술팀 | 최초 작성 |
| v1.1 | 2026-01-05 | 기술팀 | 기본 모델 결정 로직 상세 설명 추가, 환경 변수명 수정 (DEFAULT_MODEL) |
