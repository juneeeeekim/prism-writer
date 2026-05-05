# 🏛️ LLM 모델 중앙화 전문가 회의록

📅 **일시**: 2025년 12월 28일 11:21 KST  
📍 **장소**: PRISM Writer 기술 아키텍처 회의실 (Virtual)  
🎯 **주제**: LLM 모델 적용 및 관리의 중앙화 (Centralized LLM Model Management)  
📝 **기록**: AI 기술 리더

---

## 📋 회의 안건

1. 현재 LLM 모델 관리 현황 분석
2. 중앙화의 가능성 및 기술적 타당성 검토
3. 중앙화 시 장점 및 위험 요소 분석
4. 대기업 및 타사 레퍼런스 조사
5. 최적의 중앙화 아키텍처 설계
6. 투표 및 결론 도출

---

## 👥 참석자 및 자기소개

### 🔵 Dr. Alex Chen - **시스템 아키텍트**

> "안녕하세요, 저는 분산 시스템과 마이크로서비스 아키텍처 전문가 Alex입니다. 10년간 Netflix, Spotify 등에서 대규모 설정 관리 시스템을 설계해왔습니다. 오늘 이 자리에서 시스템 아키텍처 관점에서 중앙화의 장단점을 분석하겠습니다."

### 🟢 Sarah Kim - **MLOps 엔지니어**

> "반갑습니다. MLOps와 LLMOps 분야에서 5년간 일해온 Sarah입니다. OpenAI, Anthropic, Google AI 등 다양한 LLM 프로바이더와의 통합 경험이 있습니다. 운영 관점에서 중앙화가 가져올 실질적인 이점을 공유드리겠습니다."

### 🟡 Marcus Lee - **보안 엔지니어**

> "보안 엔지니어 Marcus입니다. OWASP LLM Top 10 보안 취약점 대응 경험이 있으며, API 키 관리와 접근 제어 시스템 설계를 담당해왔습니다. 중앙화 시 보안 관점에서의 고려사항을 짚어드리겠습니다."

### 🟣 Dr. Emma Park - **비용 최적화 전문가**

> "안녕하세요, FinOps와 클라우드 비용 최적화 전문가 Emma입니다. LLM 비용이 서비스 운영비의 상당 부분을 차지하는 요즘, 중앙화가 비용 관리에 어떤 영향을 미치는지 분석드리겠습니다."

### 🔴 James Wang - **레드팀 리더 / Devil's Advocate**

> "레드팀 리더 James입니다. 저는 의도적으로 반대 의견을 제시하여 결정의 견고함을 검증하는 역할을 맡고 있습니다. 오늘도 날카로운 질문으로 논의를 더욱 심화시키겠습니다."

---

## 🔍 현황 분석 (Current State Analysis)

### 현재 PRISM Writer의 LLM 설정 구조

```
frontend/
├── src/
│   ├── config/
│   │   ├── models.ts            # ✅ LLM 모델 레지스트리 (부분 중앙화)
│   │   ├── embedding-models.ts  # ✅ 임베딩 모델 레지스트리
│   │   ├── llm.config.ts        # ✅ LLM 환경설정
│   │   └── featureFlags.ts      # ⚠️ 기능 플래그
│   ├── lib/
│   │   ├── llm/
│   │   │   ├── gateway.ts       # ✅ LLM 통합 게이트웨이
│   │   │   ├── providers/       # ✅ Provider 추상화
│   │   │   └── modelSelector.ts # ⚠️ 모델 선택 로직
│   │   └── rag/
│   │       ├── reranker.ts      # ⚠️ 하드코딩된 모델 참조
│   │       ├── templateGates.ts # ⚠️ 하드코딩된 모델 참조
│   │       ├── exampleMiner.ts  # ⚠️ 하드코딩된 모델 참조
│   │       └── ruleMiner.ts     # ⚠️ 하드코딩된 모델 참조
│   └── types/
│       └── rag.ts               # ⚠️ RouterConfig에 모델명 분산
```

### 발견된 문제점

| 파일                   | 문제                                                | 영향도    |
| ---------------------- | --------------------------------------------------- | --------- |
| `rag/reranker.ts`      | `DEFAULT_MODEL = 'gemini-3-flash-preview'` 하드코딩 | 🔴 High   |
| `rag/templateGates.ts` | 여러 곳에 `gemini-3-flash-preview` 직접 참조        | 🔴 High   |
| `rag/exampleMiner.ts`  | `model: 'gemini-3-flash-preview'` 직접 지정         | 🟡 Medium |
| `rag/ruleMiner.ts`     | `model: 'gemini-3-flash-preview'` 직접 지정         | 🟡 Medium |
| `types/rag.ts`         | `premiumModel = 'gemini-3-pro-preview'` 하드코딩    | 🟡 Medium |

---

## 💡 전문가 아이디어 제출

### 🔵 Dr. Alex Chen (시스템 아키텍트)

#### 제안: **Unified Model Registry with Role-Based Configuration**

```typescript
// 제안: config/llm-registry.ts
export const LLM_REGISTRY = {
  // 모델 정의
  models: {
    "gemini-3-flash-preview": {
      /* ... */
    },
    "gemini-3-pro-preview": {
      /* ... */
    },
  },

  // 역할별 매핑 (핵심!)
  roleMapping: {
    "rag.answer": "gemini-3-flash-preview",
    "rag.reviewer": "gemini-3-flash-preview",
    "rag.reranking": "gemini-3-flash-preview",
    "template.extraction": "gemini-3-flash-preview",
    "example.mining": "gemini-3-flash-preview",
    "rule.mining": "gemini-3-flash-preview",
    "premium.answer": "gemini-3-pro-preview",
    "premium.reviewer": "gemini-3-pro-preview",
  },

  // 티어별 기본값
  tierDefaults: {
    free: { answer: "gemini-3-flash-preview", reviewer: null },
    standard: {
      answer: "gemini-3-flash-preview",
      reviewer: "gemini-3-flash-preview",
    },
    premium: {
      answer: "gemini-3-pro-preview",
      reviewer: "gemini-3-pro-preview",
    },
  },
};
```

**장점**:

- 한 파일에서 모든 역할-모델 매핑을 확인 가능
- 역할 기반 추상화로 비즈니스 로직과 모델 선택 분리
- A/B 테스트나 모델 교체 시 단일 파일만 수정

---

### 🟢 Sarah Kim (MLOps 엔지니어)

#### 제안: **Environment-Driven Configuration with Fallback Chain**

```typescript
// 제안: config/model-orchestrator.ts
export interface ModelOrchestrator {
  // 우선순위: ENV → Config → Default
  getModel(role: ModelRole): string {
    return (
      process.env[`MODEL_${role.toUpperCase()}`] ||
      this.configuredModels[role] ||
      this.defaultModel
    );
  }

  // Fallback Chain 정의
  fallbackChains: {
    "gemini-3-pro-preview": ["gemini-3-flash-preview", "gpt-5-mini"],
    "gpt-5.2": ["gpt-5-mini", "gemini-3-flash-preview"],
  }
}
```

**장점**:

- 배포 환경별(dev/staging/prod) 다른 모델 사용 가능
- 모델 장애 시 자동 폴백으로 서비스 연속성 보장
- CI/CD 파이프라인에서 환경 변수만으로 모델 전환 가능

---

### 🟡 Marcus Lee (보안 엔지니어)

#### 제안: **Centralized API Key Vault with Model Binding**

```typescript
// 제안: lib/llm/secure-registry.ts
export class SecureModelRegistry {
  // 모델-API 키 매핑 (Vault에서 로드)
  private static keyBindings: Map<string, SecureKey>;

  // 모델 사용 시 자동으로 올바른 키 주입
  static getModelWithCredentials(role: ModelRole): AuthenticatedModel {
    const modelId = this.getModelForRole(role);
    const key = this.keyBindings.get(this.getProvider(modelId));
    return { modelId, credentials: key };
  }

  // 접근 로깅 (감사 추적)
  static auditLog(userId: string, role: ModelRole, modelId: string): void;
}
```

**장점**:

- API 키와 모델 설정의 일원화로 보안 강화
- 접근 로그 중앙화로 감사(Audit) 용이
- 권한 기반 모델 접근 제어 가능

---

### 🟣 Dr. Emma Park (비용 최적화 전문가)

#### 제안: **Cost-Aware Model Router with Budget Controls**

```typescript
// 제안: config/cost-registry.ts
export const COST_OPTIMIZED_REGISTRY = {
  models: MODEL_REGISTRY, // 기존 레지스트리 재사용

  // 비용 제어 정책
  budgetPolicies: {
    daily: { limit: 100, currency: "USD" },
    perUser: { limit: 1, currency: "USD" },
  },

  // 비용 기반 자동 모델 선택
  costOptimizedSelection(role: ModelRole, budget: Budget): string {
    const candidates = this.getModelsForRole(role);
    return candidates
      .filter((m) => this.estimateCost(m) <= budget.remaining)
      .sort((a, b) => this.qualityScore(b) - this.qualityScore(a))[0];
  },
};
```

**장점**:

- 모델 비용을 한 곳에서 관리하여 예산 초과 방지
- 비용-품질 트레이드오프 자동화
- 실시간 비용 모니터링 및 알림 가능

---

## ⚔️ 레드팀 평가 (Red Team Review)

### 🔴 James Wang (레드팀 리더)

#### Alex의 제안에 대한 질문:

> "역할별 매핑이 정적으로 고정되어 있다면, 런타임에 특정 사용자에게만 다른 모델을 적용하는 실험은 어떻게 진행하시겠습니까?"

**Alex 응답**:

> "좋은 지적입니다. `roleMapping`을 함수 형태로 변경하여 런타임 컨텍스트(사용자 ID, 실험 그룹 등)를 받아 동적으로 결정할 수 있습니다."

#### Sarah의 제안에 대한 질문:

> "환경 변수 기반 설정은 설정 drift 문제를 야기할 수 있습니다. 프로덕션 환경 변수와 코드의 기본값이 달라지면 추적이 어려워지지 않을까요?"

**Sarah 응답**:

> "유효한 우려입니다. 이를 해결하기 위해 부팅 시 모든 환경 변수를 로깅하고, 설정 대시보드를 통해 현재 활성화된 설정을 시각화하는 방안을 추가 제안합니다."

#### Marcus의 제안에 대한 질문:

> "Vault 의존성이 추가되면 시스템 복잡도가 증가합니다. 현재 PRISM Writer 규모에서 이 레벨의 보안이 필요할까요?"

**Marcus 응답**:

> "현재 규모에서는 과할 수 있지만, API 키 중앙화와 감사 로깅만이라도 먼저 적용하고 Vault는 확장 시 도입하는 점진적 접근을 제안합니다."

#### Emma의 제안에 대한 질문:

> "비용 기반 자동 선택이 품질 저하를 가져올 수 있습니다. 사용자가 예산 때문에 저품질 모델을 받게 된다면 서비스 신뢰도에 영향이 있지 않을까요?"

**Emma 응답**:

> "맞습니다. 최소 품질 임계값(Quality Floor)을 설정하여 해당 임계값 이하의 모델은 선택되지 않도록 가드레일을 추가해야 합니다."

---

## 🌍 Enterprise 레퍼런스 조사

### 1. **OpenAI - Model Gateway Pattern**

- **구현**: 모든 모델 요청이 단일 Gateway 엔드포인트를 통과
- **장점**: 사용량 추적, 속도 제한, 버저닝 중앙화
- **적용 가능 요소**: Gateway 패턴 (현재 `gateway.ts` 확장)

### 2. **Anthropic - Constitution-Based Configuration**

- **구현**: 각 모델의 "헌법"(제약 조건)을 중앙 정의
- **장점**: 안전성과 일관성 보장
- **적용 가능 요소**: 모델별 제약 조건 중앙 관리

### 3. **Google Cloud - Vertex AI Model Registry**

- **구현**: 모든 ML 모델을 단일 레지스트리에서 버전 관리
- **장점**: 모델 라이프사이클 추적, 배포 이력 관리
- **적용 가능 요소**: 모델 버전 관리 및 이력 추적

### 4. **AWS Bedrock - Unified API Layer**

- **구현**: 멀티 프로바이더(Anthropic, Meta, Cohere 등)를 단일 API로 추상화
- **장점**: 프로바이더 독립적 코드 작성 가능
- **적용 가능 요소**: Provider 추상화 (현재 `providers/` 확장)

### 5. **LangChain - Model Factory Pattern**

- **구현**: `ChatOpenAI`, `ChatAnthropic` 등을 Factory로 생성
- **장점**: 일관된 인터페이스, 쉬운 전환
- **적용 가능 요소**: Factory 패턴을 통한 모델 인스턴스 관리

### 6. **Stripe - Feature Flag 기반 모델 전환**

- **구현**: LaunchDarkly와 연동하여 모델을 Feature Flag로 제어
- **장점**: 점진적 롤아웃, 즉시 롤백 가능
- **적용 가능 요소**: `featureFlags.ts` 확장하여 모델 플래그 추가

---

## 📊 레퍼런스 통합 시너지 분석

| 레퍼런스               | 핵심 패턴       | PRISM Writer 적용 우선순위        |
| ---------------------- | --------------- | --------------------------------- |
| OpenAI Gateway         | 단일 진입점     | 🟢 **이미 적용됨** (`gateway.ts`) |
| Vertex AI Registry     | 중앙 레지스트리 | 🟢 **부분 적용됨** (`models.ts`)  |
| AWS Bedrock            | Provider 추상화 | 🟢 **이미 적용됨** (`providers/`) |
| LangChain Factory      | 모델 팩토리     | 🟡 확장 필요                      |
| Stripe Feature Flags   | 동적 전환       | 🟡 확장 필요                      |
| Anthropic Constitution | 제약 관리       | 🔴 향후 검토                      |

---

## 🏆 최종 아키텍처 제안: Unified LLM Configuration Hub

모든 전문가 의견과 레퍼런스를 종합한 **통합 설계안**:

```
config/
├── models.ts                    # (기존) 모델 레지스트리
├── embedding-models.ts          # (기존) 임베딩 모델
├── llm.config.ts               # (기존) 환경 설정
└── llm-usage-map.ts            # [NEW] 서비스별 모델 매핑 (핵심!)
```

### 핵심 신규 파일: `llm-usage-map.ts`

```typescript
// =============================================================================
// PRISM Writer - LLM Usage Map (중앙화된 서비스-모델 매핑)
// =============================================================================

import { getDefaultModelId } from "./models";

export type LLMUsageContext =
  | "rag.answer" // RAG 답변 생성
  | "rag.reviewer" // RAG 검토자
  | "rag.reranker" // 검색 결과 재순위
  | "template.extraction" // 템플릿 추출
  | "template.regression" // 템플릿 회귀 검사
  | "example.mining" // 예시 마이닝
  | "rule.mining" // 규칙 마이닝
  | "judge.evaluation"; // 품질 평가

export interface UsageConfig {
  modelId: string;
  fallback?: string;
  maxTokens?: number;
  description: string;
}

/**
 * 🎯 서비스별 LLM 모델 매핑 - 한눈에 확인 가능!
 *
 * 이 파일 하나로 모든 기능의 LLM 모델을 관리합니다.
 * 모델 변경이 필요하면 이 파일만 수정하세요.
 */
export const LLM_USAGE_MAP: Record<LLMUsageContext, UsageConfig> = {
  // -------------------------------------------------------------------------
  // RAG Pipeline
  // -------------------------------------------------------------------------
  "rag.answer": {
    modelId: "gemini-3-flash-preview",
    fallback: "gpt-5-mini-2025-08-07",
    maxTokens: 2000,
    description: "RAG 기반 답변 생성",
  },
  "rag.reviewer": {
    modelId: "gemini-3-flash-preview",
    fallback: undefined, // 리뷰어 실패 시 스킵
    maxTokens: 500,
    description: "RAG 답변 품질 검토",
  },
  "rag.reranker": {
    modelId: "gemini-3-flash-preview",
    description: "검색 결과 재순위 지정",
  },

  // -------------------------------------------------------------------------
  // Template System
  // -------------------------------------------------------------------------
  "template.extraction": {
    modelId: "gemini-3-flash-preview",
    description: "문서에서 템플릿 추출",
  },
  "template.regression": {
    modelId: "gemini-3-flash-preview",
    description: "템플릿 회귀 검사",
  },

  // -------------------------------------------------------------------------
  // Mining Features
  // -------------------------------------------------------------------------
  "example.mining": {
    modelId: "gemini-3-flash-preview",
    description: "예시 문장 마이닝",
  },
  "rule.mining": {
    modelId: "gemini-3-flash-preview",
    description: "문법/스타일 규칙 마이닝",
  },

  // -------------------------------------------------------------------------
  // Quality Assurance
  // -------------------------------------------------------------------------
  "judge.evaluation": {
    modelId: "gemini-3-flash-preview",
    description: "콘텐츠 품질 평가",
  },
};

// =============================================================================
// 유틸리티 함수
// =============================================================================

export function getModelForUsage(context: LLMUsageContext): string {
  return LLM_USAGE_MAP[context]?.modelId ?? getDefaultModelId();
}

export function getFallbackModel(context: LLMUsageContext): string | undefined {
  return LLM_USAGE_MAP[context]?.fallback;
}

export function getAllUsageContexts(): LLMUsageContext[] {
  return Object.keys(LLM_USAGE_MAP) as LLMUsageContext[];
}

// 디버그용: 현재 모델 매핑 상태 출력
export function printUsageMap(): void {
  console.log("\n📋 LLM Usage Map:");
  console.log("================");
  for (const [context, config] of Object.entries(LLM_USAGE_MAP)) {
    console.log(
      `  ${context}: ${config.modelId}${
        config.fallback ? ` (fallback: ${config.fallback})` : ""
      }`
    );
  }
}
```

---

## 🗳️ 투표

### 질문: 위 통합 아키텍처를 채택하시겠습니까?

| 투표자           | 찬성/반대        | 코멘트                          |
| ---------------- | ---------------- | ------------------------------- |
| 🔵 Dr. Alex Chen | ✅ 찬성          | "역할 기반 추상화가 잘 반영됨"  |
| 🟢 Sarah Kim     | ✅ 찬성          | "Fallback 지원이 포함되어 만족" |
| 🟡 Marcus Lee    | ✅ 찬성 (조건부) | "감사 로깅 추가 권장"           |
| 🟣 Dr. Emma Park | ✅ 찬성          | "비용 추적 연동 용이"           |
| 🔴 James Wang    | ✅ 찬성          | "레드팀 검증 통과"              |

**최종 결과**: ✅ **만장일치 채택**

---

## 📝 결론 및 실행 계획

### ✅ 결론

1. **가능성 확인**: LLM 모델 중앙화는 기술적으로 **가능하며 권장됨**
2. **현재 상태**: PRISM Writer는 이미 **부분적으로 중앙화**되어 있음 (`config/models.ts`, `gateway.ts`)
3. **개선 필요**: RAG 모듈 내 하드코딩된 모델 참조를 중앙 설정으로 **마이그레이션 필요**

### 🎯 중앙화의 핵심 장점

| 장점          | 설명                               | 비즈니스 가치 |
| ------------- | ---------------------------------- | ------------- |
| **가시성**    | 모든 LLM 사용처를 한 파일에서 확인 | 관리 효율 ↑   |
| **일관성**    | 모델 변경 시 누락 방지             | 버그 감소 ↓   |
| **유연성**    | 환경별/티어별 다른 모델 적용 용이  | 실험 속도 ↑   |
| **비용 제어** | 모델별 비용을 한곳에서 추적        | 비용 절감 ↓   |
| **보안**      | API 키 및 접근 관리 중앙화         | 보안 강화 ↑   |

### 🚀 실행 계획 (Action Items)

#### Phase 1: 중앙 매핑 파일 생성 (1일)

- [ ] `config/llm-usage-map.ts` 파일 생성
- [ ] 모든 `LLMUsageContext` 열거 및 매핑 정의
- [ ] 유틸리티 함수 구현

#### Phase 2: RAG 모듈 마이그레이션 (2일)

- [ ] `rag/reranker.ts` - 하드코딩 제거, `getModelForUsage('rag.reranker')` 사용
- [ ] `rag/templateGates.ts` - 모든 모델 참조 중앙화
- [ ] `rag/exampleMiner.ts` - 중앙 설정 참조로 변경
- [ ] `rag/ruleMiner.ts` - 중앙 설정 참조로 변경
- [ ] `types/rag.ts` - `RouterConfig`에서 중앙 설정 import

#### Phase 3: 검증 및 문서화 (1일)

- [ ] 기존 기능 회귀 테스트
- [ ] 개발자 문서 업데이트
- [ ] `printUsageMap()` 통한 현재 상태 로깅

---

## 📚 부록: 참고 자료

### 대기업 중앙화 사례

- [OpenAI API Best Practices](https://platform.openai.com/docs/guides/production-best-practices)
- [Google Cloud Vertex AI Model Registry](https://cloud.google.com/vertex-ai/docs/model-registry/introduction)
- [AWS Bedrock Multi-Model Inference](https://aws.amazon.com/bedrock/)
- [LangChain Model Factory Documentation](https://python.langchain.com/docs/concepts/chat_models/)

---

**회의 종료**: 11:50 KST  
**다음 회의**: 실행 계획 Phase 1 완료 후 리뷰 미팅 예정

---

_이 문서는 prismLM 기술 아키텍처 회의의 공식 회의록입니다._
