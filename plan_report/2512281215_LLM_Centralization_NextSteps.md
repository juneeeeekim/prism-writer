# 📋 LLM 중앙화 후속 작업 계획서 (Phase 17+)

**작성일**: 2025-12-28  
**선행 완료**: Phase 16 - LLM 모델 중앙화 구현  
**상태**: 📝 계획 수립 단계

---

## 📊 현재 상태 요약

### ✅ Phase 16 완료 내역

- `llm-usage-map.ts` 신규 생성 (서비스별 LLM 모델 매핑)
- 5개 파일 마이그레이션 완료 (reranker, templateGates, exampleMiner, ruleMiner, types/rag)
- 개발자 문서 업데이트 (`config/README.md`)
- Vercel 배포 완료

### 📁 관련 파일

- [LLM Centralization Checklist](./2512281137_LLM_Centralization_Checklist.md)
- [JeDebug Analysis](./2512281131_LLM_Centralization_JeDebug.md)
- [Expert Meeting Notes](./2512281121_LLM_Centralization_Expert_Meeting.md)

---

## 🔧 기술적 개선 작업

### Phase 17-A: 환경 변수 기반 모델 오버라이드

**우선순위**: 🟡 Medium  
**예상 소요**: 2시간  
**담당**: 백엔드 개발자

#### 목표

환경 변수로 개별 컨텍스트의 모델을 오버라이드할 수 있도록 지원

#### 구현 상세

```typescript
// llm-usage-map.ts 수정
export function getModelForUsage(context: LLMUsageContext): string {
  // 1. 환경 변수 우선 확인
  const envKey = `MODEL_${context.toUpperCase().replace(".", "_")}`;
  const envModel = process.env[envKey];
  if (envModel) return envModel;

  // 2. 기본 매핑 사용
  return LLM_USAGE_MAP[context]?.modelId ?? getDefaultModelId();
}
```

#### 사용 예시

```bash
# .env.local
MODEL_RAG_ANSWER=gpt-4o
MODEL_PREMIUM_ANSWER=claude-3-opus
```

#### 체크리스트

- [ ] `getModelForUsage` 함수에 환경 변수 체크 로직 추가
- [ ] `.env.example` 파일에 환경 변수 예시 추가
- [ ] 문서 업데이트

---

### Phase 17-B: Fallback 자동 전환 시스템

**우선순위**: 🟡 Medium  
**예상 소요**: 4시간  
**담당**: 백엔드 개발자

#### 목표

API 호출 실패 시 자동으로 fallback 모델로 전환

#### 구현 상세

```typescript
// lib/llm/fallback-handler.ts (신규)
export async function callWithFallback<T>(
  context: LLMUsageContext,
  apiCall: (modelId: string) => Promise<T>
): Promise<T> {
  const primaryModel = getModelForUsage(context);
  const fallbackModel = getFallbackModel(context);

  try {
    return await apiCall(primaryModel);
  } catch (error) {
    if (fallbackModel && isRetryableError(error)) {
      console.warn(`[Fallback] ${context}: ${primaryModel} → ${fallbackModel}`);
      return await apiCall(fallbackModel);
    }
    throw error;
  }
}
```

#### 체크리스트

- [ ] `fallback-handler.ts` 신규 생성
- [ ] 에러 분류 로직 구현 (Quota Exceeded, Rate Limit 등)
- [ ] 기존 LLM 호출 코드에 적용
- [ ] 텔레메트리 로깅 추가

---

### Phase 17-C: 비용 모니터링 대시보드

**우선순위**: 🟢 Low  
**예상 소요**: 6시간  
**담당**: 프론트엔드 + 백엔드 개발자

#### 목표

모델별 사용량과 비용을 추적하는 관리자 대시보드

#### 구현 상세

- DB 테이블: `llm_usage_logs`
- API: `/api/admin/llm-usage`
- UI: 관리자 대시보드 페이지

#### 데이터 수집 항목

| 필드             | 설명            |
| ---------------- | --------------- |
| `context`        | LLMUsageContext |
| `model_id`       | 사용된 모델     |
| `input_tokens`   | 입력 토큰 수    |
| `output_tokens`  | 출력 토큰 수    |
| `latency_ms`     | 응답 시간       |
| `estimated_cost` | 추정 비용       |
| `created_at`     | 타임스탬프      |

#### 체크리스트

- [ ] DB 마이그레이션 스크립트 작성
- [ ] 로깅 미들웨어 구현
- [ ] API 엔드포인트 생성
- [ ] 대시보드 UI 구현

---

## 🚀 신규 기능 개발

### Phase 18-A: 다중 모델 A/B 테스트

**우선순위**: 🟢 Low  
**예상 소요**: 8시간  
**담당**: 풀스택 개발자

#### 목표

같은 컨텍스트에서 여러 모델의 성능을 비교 테스트

#### 구현 상세

```typescript
// config/llm-ab-test.ts (신규)
export interface ABTestConfig {
  context: LLMUsageContext;
  variants: {
    modelId: string;
    weight: number; // 0~100%
  }[];
  startDate: Date;
  endDate: Date;
}

export const AB_TESTS: ABTestConfig[] = [
  {
    context: "rag.answer",
    variants: [
      { modelId: "gemini-3-flash-preview", weight: 50 },
      { modelId: "gpt-4o-mini", weight: 50 },
    ],
    startDate: new Date("2025-01-01"),
    endDate: new Date("2025-01-15"),
  },
];
```

#### 체크리스트

- [ ] A/B 테스트 설정 파일 생성
- [ ] 가중치 기반 모델 선택 로직 구현
- [ ] 결과 수집 및 분석 기능
- [ ] 관리자 UI

---

### Phase 18-B: 사용자별 모델 설정

**우선순위**: 🟡 Medium  
**예상 소요**: 6시간  
**담당**: 풀스택 개발자

#### 목표

Premium 사용자가 선호하는 LLM 모델을 직접 선택

#### 구현 상세

- 사용자 프로필에 `preferred_llm_model` 필드 추가
- 설정 UI 페이지 구현
- 모델 선택 로직에 사용자 설정 반영

#### 사용자 선택 가능 모델

| 모델                     | 설명             | 등급 제한   |
| ------------------------ | ---------------- | ----------- |
| `gemini-3-flash-preview` | 빠른 응답        | 모든 사용자 |
| `gemini-3-pro-preview`   | 고품질 응답      | Premium     |
| `gpt-4o`                 | OpenAI 고급 모델 | Premium     |
| `claude-3-sonnet`        | Anthropic 모델   | Premium     |

#### 체크리스트

- [ ] 사용자 프로필 DB 스키마 확장
- [ ] 설정 API 엔드포인트
- [ ] 설정 UI 컴포넌트
- [ ] `getModelForUsage` 함수에 사용자 설정 반영

---

### Phase 18-C: 모델 성능 로깅 및 분석

**우선순위**: 🟡 Medium  
**예상 소요**: 4시간  
**담당**: 백엔드 개발자

#### 목표

각 LLM 호출의 응답시간, 품질 점수를 기록하고 분석

#### 수집 메트릭

| 메트릭          | 설명            | 수집 방법     |
| --------------- | --------------- | ------------- |
| `latency`       | 응답 시간 (ms)  | 자동 측정     |
| `quality_score` | 품질 점수 (0~1) | Reviewer 결과 |
| `user_feedback` | 사용자 평가     | 👍/👎 버튼    |
| `error_rate`    | 오류 발생률     | 자동 계산     |

#### 체크리스트

- [ ] 로깅 인터페이스 설계
- [ ] 메트릭 수집 미들웨어 구현
- [ ] 분석 쿼리 및 API
- [ ] 시각화 차트 컴포넌트

---

## 🐛 버그 수정 / 유지보수

### Phase 19-A: API Quota 관리 (긴급)

**우선순위**: 🔴 High  
**예상 소요**: 3시간  
**담당**: 백엔드 개발자

#### 문제 상황

현재 Gemini API 할당량 초과 시 사용자에게 에러만 표시됨

#### 해결 방안

1. Rate Limiting 구현
2. Quota 경고 알림
3. Graceful Degradation (fallback 모드)

#### 구현 상세

```typescript
// lib/llm/quota-manager.ts (신규)
export class QuotaManager {
  async checkQuota(provider: string): Promise<QuotaStatus> {
    // Redis 또는 메모리에서 현재 사용량 확인
    const current = await this.getCurrentUsage(provider);
    const limit = this.getLimit(provider);

    return {
      remaining: limit - current,
      resetAt: this.getResetTime(provider),
      isExceeded: current >= limit,
    };
  }

  async handleQuotaExceeded(context: LLMUsageContext): Promise<string> {
    // 1. Fallback 모델로 전환
    // 2. 사용자에게 알림
    // 3. 관리자에게 경고 발송
  }
}
```

#### 체크리스트

- [ ] QuotaManager 클래스 구현
- [ ] Rate Limiting 미들웨어
- [ ] 사용자 친화적 에러 메시지
- [ ] 관리자 알림 시스템

---

### Phase 19-B: 캐싱 전략 개선

**우선순위**: 🟢 Low  
**예상 소요**: 2시간  
**담당**: 백엔드 개발자

#### 문제 상황

`reranker.ts`의 모듈 레벨 캐싱으로 인해 런타임 중 모델 변경 불가

#### 해결 방안

```typescript
// 현재 (문제)
let geminiModel: GenerativeModel | null = null;

// 개선안
const modelCache = new Map<string, GenerativeModel>();

function getGeminiModel(modelId: string): GenerativeModel {
  if (!modelCache.has(modelId)) {
    modelCache.set(modelId, createModel(modelId));
  }
  return modelCache.get(modelId)!;
}
```

#### 체크리스트

- [ ] Map 기반 캐싱으로 전환
- [ ] 캐시 무효화 함수 추가
- [ ] 메모리 누수 방지 (LRU 캐시)

---

## 📊 우선순위 매트릭스

| 작업 ID  | 작업명                 | 우선순위  | 예상 시간 | 의존성 |
| -------- | ---------------------- | --------- | --------- | ------ |
| **19-A** | API Quota 관리         | 🔴 High   | 3시간     | 없음   |
| **17-A** | 환경 변수 오버라이드   | 🟡 Medium | 2시간     | 없음   |
| **17-B** | Fallback 자동 전환     | 🟡 Medium | 4시간     | 없음   |
| **18-B** | 사용자별 모델 설정     | 🟡 Medium | 6시간     | 없음   |
| **18-C** | 모델 성능 로깅         | 🟡 Medium | 4시간     | 없음   |
| **17-C** | 비용 모니터링 대시보드 | 🟢 Low    | 6시간     | 18-C   |
| **18-A** | 다중 모델 A/B 테스트   | 🟢 Low    | 8시간     | 18-C   |
| **19-B** | 캐싱 전략 개선         | 🟢 Low    | 2시간     | 없음   |

---

## 🎯 권장 실행 순서

### 1단계 (긴급)

- [ ] **19-A**: API Quota 관리 - 현재 발생 중인 Quota Exceeded 문제 해결

### 2단계 (단기)

- [ ] **17-A**: 환경 변수 오버라이드 - 빠른 모델 교체 가능
- [ ] **17-B**: Fallback 자동 전환 - 안정성 향상

### 3단계 (중기)

- [ ] **18-C**: 모델 성능 로깅 - 데이터 수집 기반 마련
- [ ] **18-B**: 사용자별 모델 설정 - Premium 사용자 가치 제공

### 4단계 (장기)

- [ ] **17-C**: 비용 모니터링 대시보드 - 운영 효율화
- [ ] **18-A**: 다중 모델 A/B 테스트 - 지속적 개선

---

## 📝 결정 필요 사항

1. **Phase 19-A (API Quota 관리)** 즉시 진행 여부
2. 사용자별 모델 설정 시 **허용할 모델 목록**
3. 비용 모니터링 **예산 한도 설정** 정책
4. A/B 테스트 **첫 번째 실험 대상** 선정

---

_이 문서는 LLM 중앙화 완료 후 후속 작업 계획입니다._
