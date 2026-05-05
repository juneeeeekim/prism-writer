# 📋 LLM 시스템 고도화 실행 체크리스트

**작성일**: 2025-12-28  
**선행 완료**: Phase 16 - LLM 모델 중앙화 구현  
**문서 유형**: 실행 체크리스트 (Implementation Checklist)  
**상태**: 🟡 부분 진행 중 (2026-05-04 완료 항목 점검 반영)

---

> 2026-05-04 점검 기준: `npx.cmd tsc --noEmit` 통과, `npm.cmd run test` 통과(13 files, 111 passed, 1 skipped). DB 마이그레이션 실제 적용 여부와 미구현 API/UI 항목은 완료 처리하지 않음.

## 📊 전체 로드맵

| 단계 | 구분    | 작업                   | 예상 시간 | 우선순위 |
| ---- | ------- | ---------------------- | --------- | -------- |
| 1    | 🔴 긴급 | API Quota 관리         | 3시간     | Critical |
| 2    | 🟡 단기 | 환경 변수 오버라이드   | 2시간     | High     |
| 3    | 🟡 단기 | Fallback 자동 전환     | 4시간     | High     |
| 4    | 🟠 중기 | 모델 성능 로깅         | 4시간     | Medium   |
| 5    | 🟠 중기 | 사용자별 모델 설정     | 6시간     | Medium   |
| 6    | 🟢 장기 | 비용 모니터링 대시보드 | 6시간     | Low      |
| 7    | 🟢 장기 | A/B 테스트 시스템      | 8시간     | Low      |

**총 예상 소요**: 33시간 (약 4~5일)

---

# 🔴 Phase 1: API Quota 관리 (긴급)

**목표**: Gemini API 할당량 초과 시 graceful handling 구현  
**담당**: 백엔드 개발자  
**예상 시간**: 3시간

## Before Start

### 영향받는 기존 파일

| 파일               | 위치                                    | 영향             |
| ------------------ | --------------------------------------- | ---------------- |
| `gateway.ts`       | `frontend/src/lib/llm/gateway.ts`       | LLM 호출 진입점  |
| `reranker.ts`      | `frontend/src/lib/rag/reranker.ts`      | Gemini 직접 호출 |
| `templateGates.ts` | `frontend/src/lib/rag/templateGates.ts` | Gemini 직접 호출 |

### 신규 파일

| 파일                       | 목적                  |
| -------------------------- | --------------------- |
| `lib/llm/quota-manager.ts` | Quota 상태 관리       |
| `lib/llm/error-handler.ts` | LLM 에러 분류 및 처리 |

---

## Implementation Items

### 1.1 에러 핸들러 구현

- [x] **P1-01**: `error-handler.ts` 신규 생성

  - `Target`: `frontend/src/lib/llm/error-handler.ts` (신규)
  - `Detail`:

    ```typescript
    // =============================================================================
    // LLM Error Handler - 에러 분류 및 처리
    // =============================================================================

    export type LLMErrorType =
      | "QUOTA_EXCEEDED" // 할당량 초과
      | "RATE_LIMITED" // 속도 제한
      | "INVALID_API_KEY" // API 키 오류
      | "MODEL_NOT_FOUND" // 모델 없음
      | "CONTEXT_TOO_LONG" // 컨텍스트 초과
      | "NETWORK_ERROR" // 네트워크 오류
      | "UNKNOWN"; // 알 수 없음

    export interface LLMError {
      type: LLMErrorType;
      message: string;
      retryable: boolean;
      retryAfter?: number; // 초 단위
      originalError: unknown;
    }

    /**
     * LLM API 에러를 분류합니다
     */
    export function classifyLLMError(error: unknown): LLMError {
      const errorMessage =
        error instanceof Error
          ? error.message.toLowerCase()
          : String(error).toLowerCase();

      // Quota Exceeded
      if (errorMessage.includes("quota") || errorMessage.includes("exceeded")) {
        return {
          type: "QUOTA_EXCEEDED",
          message: "API 할당량이 초과되었습니다. 잠시 후 다시 시도해주세요.",
          retryable: true,
          retryAfter: 3600, // 1시간 후
          originalError: error,
        };
      }

      // Rate Limited
      if (errorMessage.includes("rate") || errorMessage.includes("429")) {
        return {
          type: "RATE_LIMITED",
          message: "요청이 너무 많습니다. 잠시 후 다시 시도해주세요.",
          retryable: true,
          retryAfter: 60, // 1분 후
          originalError: error,
        };
      }

      // Invalid API Key
      if (
        errorMessage.includes("api key") ||
        errorMessage.includes("unauthorized")
      ) {
        return {
          type: "INVALID_API_KEY",
          message: "API 키가 유효하지 않습니다.",
          retryable: false,
          originalError: error,
        };
      }

      // Model Not Found
      if (
        errorMessage.includes("model") &&
        errorMessage.includes("not found")
      ) {
        return {
          type: "MODEL_NOT_FOUND",
          message: "요청한 모델을 찾을 수 없습니다.",
          retryable: false,
          originalError: error,
        };
      }

      // Context Too Long
      if (errorMessage.includes("context") || errorMessage.includes("token")) {
        return {
          type: "CONTEXT_TOO_LONG",
          message: "입력 텍스트가 너무 깁니다.",
          retryable: false,
          originalError: error,
        };
      }

      // Network Error
      if (errorMessage.includes("network") || errorMessage.includes("fetch")) {
        return {
          type: "NETWORK_ERROR",
          message: "네트워크 연결에 문제가 있습니다.",
          retryable: true,
          retryAfter: 5,
          originalError: error,
        };
      }

      return {
        type: "UNKNOWN",
        message: "LLM 호출 중 오류가 발생했습니다.",
        retryable: false,
        originalError: error,
      };
    }

    /**
     * 사용자 친화적 에러 메시지 생성
     */
    export function getUserFriendlyMessage(error: LLMError): string {
      const messages: Record<LLMErrorType, string> = {
        QUOTA_EXCEEDED:
          "🚫 AI 서비스 사용량이 일시적으로 초과되었습니다. 잠시 후 다시 시도해주세요.",
        RATE_LIMITED: "⏳ 요청이 너무 많습니다. 잠시 기다려주세요.",
        INVALID_API_KEY: "🔑 시스템 설정 오류입니다. 관리자에게 문의해주세요.",
        MODEL_NOT_FOUND: "❓ 요청한 AI 모델을 사용할 수 없습니다.",
        CONTEXT_TOO_LONG:
          "📝 입력 텍스트가 너무 깁니다. 줄여서 다시 시도해주세요.",
        NETWORK_ERROR: "🌐 네트워크 연결을 확인해주세요.",
        UNKNOWN: "⚠️ 일시적인 오류가 발생했습니다. 다시 시도해주세요.",
      };
      return messages[error.type];
    }
    ```

  - `Quality`: JSDoc 주석 필수, 모든 에러 타입 커버

- [x] **P1-02**: Quota Manager 구현
  - `Target`: `frontend/src/lib/llm/quota-manager.ts` (신규)
  - `Detail`:

    ```typescript
    // =============================================================================
    // LLM Quota Manager - 할당량 상태 관리
    // =============================================================================

    import { classifyLLMError, type LLMError } from "./error-handler";
    import {
      getFallbackModel,
      type LLMUsageContext,
    } from "@/config/llm-usage-map";

    interface QuotaState {
      provider: string;
      isExceeded: boolean;
      exceededAt?: Date;
      retryAfter?: number;
    }

    // 메모리 기반 상태 관리 (서버리스 환경 고려)
    const quotaStates = new Map<string, QuotaState>();

    /**
     * Quota 초과 상태 기록
     */
    export function markQuotaExceeded(
      provider: string,
      retryAfter: number
    ): void {
      quotaStates.set(provider, {
        provider,
        isExceeded: true,
        exceededAt: new Date(),
        retryAfter,
      });
      console.warn(
        `[QuotaManager] ${provider} quota exceeded, retry after ${retryAfter}s`
      );
    }

    /**
     * Quota 상태 확인
     */
    export function isQuotaExceeded(provider: string): boolean {
      const state = quotaStates.get(provider);
      if (!state || !state.isExceeded) return false;

      // 재시도 시간이 지났는지 확인
      if (state.exceededAt && state.retryAfter) {
        const elapsed = (Date.now() - state.exceededAt.getTime()) / 1000;
        if (elapsed > state.retryAfter) {
          quotaStates.delete(provider);
          return false;
        }
      }

      return true;
    }

    /**
     * Fallback 필요 여부 확인 및 대체 모델 반환
     */
    export function getFallbackIfNeeded(
      context: LLMUsageContext,
      primaryProvider: string
    ): string | null {
      if (isQuotaExceeded(primaryProvider)) {
        const fallback = getFallbackModel(context);
        if (fallback) {
          console.log(
            `[QuotaManager] Using fallback for ${context}: ${fallback}`
          );
          return fallback;
        }
      }
      return null;
    }

    /**
     * Quota 상태 초기화 (테스트용)
     */
    export function resetQuotaState(provider?: string): void {
      if (provider) {
        quotaStates.delete(provider);
      } else {
        quotaStates.clear();
      }
    }
    ```

  - `Quality`: 서버리스 환경 고려, 메모리 기반 상태 관리

### 1.2 Gateway에 에러 핸들링 적용

- [x] **P1-03**: `gateway.ts` 수정 - 에러 핸들러 통합
  - `Target`: `frontend/src/lib/llm/gateway.ts`
  - `Detail`:
    - import 추가:
      ```typescript
      import {
        classifyLLMError,
        getUserFriendlyMessage,
      } from "./error-handler";
      import {
        markQuotaExceeded,
        isQuotaExceeded,
        getFallbackIfNeeded,
      } from "./quota-manager";
      ```
    - `generateText` 함수 수정:
      ```typescript
      try {
        // 기존 로직
      } catch (error) {
        const llmError = classifyLLMError(error);

        // Quota 초과 시 상태 기록
        if (llmError.type === "QUOTA_EXCEEDED" && llmError.retryAfter) {
          markQuotaExceeded(providerName, llmError.retryAfter);
        }

        // 사용자 친화적 에러 반환
        throw new Error(getUserFriendlyMessage(llmError));
      }
      ```
  - `Dependency`: P1-01, P1-02 완료
  - `Quality`: 기존 동작 보존, 에러 메시지만 개선

### 1.3 UI 에러 메시지 개선

- [x] **P1-04**: 평가 탭 에러 UI 개선
  - `Target`: `frontend/src/components/assistant/EvaluationTab.tsx`
  - `Detail`:
    - 기존 에러 메시지를 `getUserFriendlyMessage` 결과로 대체
    - Quota 초과 시 "다시 시도" 버튼 및 예상 대기 시간 표시
  - `Dependency`: P1-03 완료

---

## Verification (검증)

- [x] **Syntax Check**: `npx tsc --noEmit`
- [x] **Functionality Test**:
  - Quota 초과 에러 시뮬레이션
  - 사용자 친화적 메시지 표시 확인
  - 재시도 시간 후 정상 동작 확인
- [x] **Regression Test**:
  - 기존 LLM 호출 정상 동작
  - 에러 없는 경우 동작 변경 없음

---

# 🟡 Phase 2: 환경 변수 오버라이드 (단기)

**목표**: 환경 변수로 개별 컨텍스트의 모델을 오버라이드  
**담당**: 백엔드 개발자  
**예상 시간**: 2시간

## Before Start

### 영향받는 기존 파일

| 파일               | 수정 내용                    |
| ------------------ | ---------------------------- |
| `llm-usage-map.ts` | `getModelForUsage` 함수 수정 |
| `.env.example`     | 환경 변수 예시 추가          |

---

## Implementation Items

- [x] **P2-01**: `getModelForUsage` 함수 수정

  - `Target`: `frontend/src/config/llm-usage-map.ts`
  - `Detail`:
    ```typescript
    /**
     * 서비스 컨텍스트에 맞는 LLM 모델 ID 반환
     *
     * 우선순위:
     * 1. 환경 변수 (MODEL_RAG_ANSWER 등)
     * 2. LLM_USAGE_MAP 설정
     * 3. 시스템 기본값
     */
    export function getModelForUsage(context: LLMUsageContext): string {
      // 1. 환경 변수 우선 확인 (예: MODEL_RAG_ANSWER)
      const envKey = `MODEL_${context.toUpperCase().replace(/\./g, "_")}`;
      const envModel = process.env[envKey];
      if (envModel) {
        console.log(
          `[LLM-USAGE-MAP] Using env override for ${context}: ${envModel}`
        );
        return envModel;
      }

      // 2. 중앙 매핑 사용
      const config = LLM_USAGE_MAP[context];
      if (!config) {
        console.warn(
          `[LLM-USAGE-MAP] Unknown context: ${context}, using default`
        );
        return getDefaultModelId();
      }

      return config.modelId;
    }
    ```
  - `Quality`: 기존 동작 보존, 로깅 추가

- [x] **P2-02**: 환경 변수 유효성 검증 함수 추가

  - `Target`: `frontend/src/config/llm-usage-map.ts`
  - `Detail`:

    ```typescript
    import { MODEL_REGISTRY, type ModelId } from "./models";

    /**
     * 환경 변수로 설정된 모델 ID가 유효한지 검증
     */
    export function validateEnvModels(): { valid: boolean; errors: string[] } {
      const errors: string[] = [];

      for (const context of getAllUsageContexts()) {
        const envKey = `MODEL_${context.toUpperCase().replace(/\./g, "_")}`;
        const envModel = process.env[envKey];

        if (envModel && !MODEL_REGISTRY[envModel as ModelId]) {
          errors.push(`${envKey}=${envModel} is not a valid model ID`);
        }
      }

      return { valid: errors.length === 0, errors };
    }
    ```

- [x] **P2-03**: `.env.example` 업데이트

  - `Target`: `frontend/.env.example`
  - `Detail`:

    ```bash
    # =============================================================================
    # LLM Model Overrides (Optional)
    # =============================================================================
    # 각 컨텍스트별 모델을 환경 변수로 오버라이드할 수 있습니다.
    # 설정하지 않으면 llm-usage-map.ts의 기본값을 사용합니다.

    # RAG Pipeline
    # MODEL_RAG_ANSWER=gemini-3-pro-preview
    # MODEL_RAG_REVIEWER=gpt-4o
    # MODEL_RAG_RERANKER=gemini-3-flash-preview

    # Template System
    # MODEL_TEMPLATE_CONSISTENCY=gemini-3-flash-preview
    # MODEL_TEMPLATE_HALLUCINATION=gemini-3-flash-preview
    # MODEL_TEMPLATE_REGRESSION=gemini-3-flash-preview

    # Mining Features
    # MODEL_EXAMPLE_MINING=gemini-3-flash-preview
    # MODEL_RULE_MINING=gemini-3-flash-preview

    # Premium Tier
    # MODEL_PREMIUM_ANSWER=gemini-3-pro-preview
    # MODEL_PREMIUM_REVIEWER=gemini-3-pro-preview
    ```

- [x] **P2-04**: README.md 업데이트
  - `Target`: `frontend/src/config/README.md`
  - `Detail`: 환경 변수 오버라이드 사용법 추가

---

## Verification (검증)

- [x] **Syntax Check**: `npx tsc --noEmit`
- [x] **Functionality Test**:
  - 환경 변수 설정 시 해당 모델 사용 확인
  - 환경 변수 미설정 시 기본값 사용 확인
  - 잘못된 모델 ID 설정 시 경고 로그 확인
- [x] **Regression Test**:
  - 기존 동작 변경 없음 확인

---

# 🟡 Phase 3: Fallback 자동 전환 (단기)

**목표**: API 호출 실패 시 자동으로 fallback 모델로 전환  
**담당**: 백엔드 개발자  
**예상 시간**: 4시간

## Before Start

### 영향받는 기존 파일

| 파일               | 수정 내용          |
| ------------------ | ------------------ |
| `gateway.ts`       | Fallback 로직 통합 |
| `reranker.ts`      | Fallback 적용      |
| `templateGates.ts` | Fallback 적용      |

### 신규 파일

| 파일                          | 목적               |
| ----------------------------- | ------------------ |
| `lib/llm/fallback-handler.ts` | Fallback 전환 로직 |

---

## Implementation Items

- [x] **P3-01**: Fallback Handler 구현

  - `Target`: `frontend/src/lib/llm/fallback-handler.ts` (신규)
  - `Detail`:

    ```typescript
    // =============================================================================
    // LLM Fallback Handler - 자동 모델 전환
    // =============================================================================

    import {
      getModelForUsage,
      getFallbackModel,
      type LLMUsageContext,
    } from "@/config/llm-usage-map";
    import {
      classifyLLMError,
      type LLMError,
      type LLMErrorType,
    } from "./error-handler";
    import { markQuotaExceeded } from "./quota-manager";

    // Fallback 시도 가능한 에러 타입
    const FALLBACK_ELIGIBLE_ERRORS: LLMErrorType[] = [
      "QUOTA_EXCEEDED",
      "RATE_LIMITED",
      "MODEL_NOT_FOUND",
      "NETWORK_ERROR",
    ];

    interface FallbackResult<T> {
      success: boolean;
      result?: T;
      usedModel: string;
      usedFallback: boolean;
      error?: LLMError;
    }

    /**
     * Fallback을 포함한 LLM 호출 래퍼
     *
     * @param context - LLM 사용 컨텍스트
     * @param apiCall - 실제 API 호출 함수 (모델 ID를 인자로 받음)
     * @returns FallbackResult
     *
     * @example
     * const result = await callWithFallback('rag.answer', async (modelId) => {
     *   return await generateText({ model: modelId, prompt });
     * });
     */
    export async function callWithFallback<T>(
      context: LLMUsageContext,
      apiCall: (modelId: string) => Promise<T>
    ): Promise<FallbackResult<T>> {
      const primaryModel = getModelForUsage(context);
      const fallbackModel = getFallbackModel(context);

      // 1차 시도: Primary 모델
      try {
        const result = await apiCall(primaryModel);
        return {
          success: true,
          result,
          usedModel: primaryModel,
          usedFallback: false,
        };
      } catch (primaryError) {
        const llmError = classifyLLMError(primaryError);
        console.warn(
          `[Fallback] Primary model failed (${context}): ${llmError.type}`
        );

        // Quota 초과 기록
        if (llmError.type === "QUOTA_EXCEEDED" && llmError.retryAfter) {
          const provider = primaryModel.split("-")[0]; // gemini, gpt 등
          markQuotaExceeded(provider, llmError.retryAfter);
        }

        // Fallback 가능 여부 확인
        if (
          !fallbackModel ||
          !FALLBACK_ELIGIBLE_ERRORS.includes(llmError.type)
        ) {
          return {
            success: false,
            usedModel: primaryModel,
            usedFallback: false,
            error: llmError,
          };
        }

        // 2차 시도: Fallback 모델
        console.log(`[Fallback] Trying fallback model: ${fallbackModel}`);
        try {
          const result = await apiCall(fallbackModel);
          return {
            success: true,
            result,
            usedModel: fallbackModel,
            usedFallback: true,
          };
        } catch (fallbackError) {
          const fallbackLlmError = classifyLLMError(fallbackError);
          console.error(
            `[Fallback] Fallback model also failed: ${fallbackLlmError.type}`
          );

          return {
            success: false,
            usedModel: fallbackModel,
            usedFallback: true,
            error: fallbackLlmError,
          };
        }
      }
    }

    /**
     * Fallback 사용 통계 로깅 (텔레메트리용)
     */
    export function logFallbackUsage(result: FallbackResult<unknown>): void {
      if (result.usedFallback) {
        console.log(
          `[Telemetry] Fallback used - Model: ${result.usedModel}, Success: ${result.success}`
        );
        // TODO: 실제 텔레메트리 시스템에 전송
      }
    }
    ```

- [x] **P3-02**: Gateway에 Fallback 적용

  - `Target`: `frontend/src/lib/llm/gateway.ts`
  - `Detail`:
    - `callWithFallback` import
    - `generateText` 함수에서 `callWithFallback` 사용
    - 결과에서 `usedFallback` 정보 로깅

- [x] **P3-03**: Reranker에 Fallback 적용

  - `Target`: `frontend/src/lib/rag/reranker.ts`
  - `Detail`:
    - `getGeminiModel` 함수에서 Fallback 로직 적용
    - Gemini 실패 시 OpenAI로 전환 시도

- [x] **P3-04**: Template Gates에 Fallback 적용
  - `Target`: `frontend/src/lib/rag/templateGates.ts`
  - `Detail`:
    - 각 gate 함수에 `callWithFallback` 래퍼 적용

---

## Verification (검증)

- [x] **Syntax Check**: `npx tsc --noEmit`
- [x] **Functionality Test**:
  - Primary 모델 실패 시 Fallback 전환 확인
  - Fallback 성공 시 결과 정상 반환 확인
  - 양쪽 모두 실패 시 적절한 에러 반환 확인
- [x] **Regression Test**:
  - Primary 모델 정상 시 Fallback 미사용 확인
  - 기존 응답 품질 동일 확인

---

# 🟠 Phase 4: 모델 성능 로깅 (중기)

**목표**: 각 LLM 호출의 응답시간, 품질 점수 기록  
**담당**: 백엔드 개발자  
**예상 시간**: 4시간

## Before Start

### 신규 파일/테이블

| 항목                            | 유형      | 목적             |
| ------------------------------- | --------- | ---------------- |
| `llm_performance_logs`          | DB 테이블 | 성능 데이터 저장 |
| `lib/llm/performance-logger.ts` | 파일      | 로깅 로직        |
| `api/llm/performance`           | API       | 로그 조회        |

---

## Implementation Items

### 4.1 DB 스키마 생성

- [x] **P4-01**: 성능 로그 테이블 생성
  - `Target`: `supabase/migrations/039_llm_performance_logs.sql` (신규)
  - `Detail`:

    ```sql
    -- =============================================================================
    -- LLM Performance Logs 테이블
    -- =============================================================================

    CREATE TABLE IF NOT EXISTS llm_performance_logs (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

      -- 컨텍스트 정보
      context TEXT NOT NULL,           -- 'rag.answer', 'template.consistency' 등
      model_id TEXT NOT NULL,          -- 사용된 모델 ID
      used_fallback BOOLEAN DEFAULT FALSE,

      -- 성능 메트릭
      latency_ms INTEGER NOT NULL,     -- 응답 시간 (밀리초)
      input_tokens INTEGER,            -- 입력 토큰 수
      output_tokens INTEGER,           -- 출력 토큰 수

      -- 품질 메트릭
      quality_score DECIMAL(3,2),      -- 0.00 ~ 1.00
      user_feedback TEXT,              -- 'positive', 'negative', null

      -- 에러 정보
      is_success BOOLEAN DEFAULT TRUE,
      error_type TEXT,                 -- 'QUOTA_EXCEEDED', 'RATE_LIMITED' 등

      -- 메타데이터
      user_id UUID REFERENCES profiles(id),
      document_id UUID,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- 인덱스
    CREATE INDEX idx_llm_perf_context ON llm_performance_logs(context);
    CREATE INDEX idx_llm_perf_model ON llm_performance_logs(model_id);
    CREATE INDEX idx_llm_perf_created ON llm_performance_logs(created_at);
    CREATE INDEX idx_llm_perf_user ON llm_performance_logs(user_id);

    -- RLS 정책
    ALTER TABLE llm_performance_logs ENABLE ROW LEVEL SECURITY;

    -- 관리자만 조회 가능
    CREATE POLICY "Admins can view all logs" ON llm_performance_logs
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
        )
      );

    -- 시스템은 INSERT 가능
    CREATE POLICY "System can insert logs" ON llm_performance_logs
      FOR INSERT WITH CHECK (true);
    ```

### 4.2 로깅 로직 구현

- [x] **P4-02**: Performance Logger 구현

  - `Target`: `frontend/src/lib/llm/performance-logger.ts` (신규)
  - `Detail`:

    ```typescript
    // =============================================================================
    // LLM Performance Logger
    // =============================================================================

    import { createClient } from "@/lib/supabase/client";
    import type { LLMUsageContext } from "@/config/llm-usage-map";
    import type { LLMError } from "./error-handler";

    export interface PerformanceLog {
      context: LLMUsageContext;
      modelId: string;
      usedFallback: boolean;
      latencyMs: number;
      inputTokens?: number;
      outputTokens?: number;
      qualityScore?: number;
      isSuccess: boolean;
      errorType?: string;
      userId?: string;
      documentId?: string;
    }

    /**
     * 성능 로그 기록
     */
    export async function logPerformance(log: PerformanceLog): Promise<void> {
      try {
        const supabase = createClient();

        await supabase.from("llm_performance_logs").insert({
          context: log.context,
          model_id: log.modelId,
          used_fallback: log.usedFallback,
          latency_ms: log.latencyMs,
          input_tokens: log.inputTokens,
          output_tokens: log.outputTokens,
          quality_score: log.qualityScore,
          is_success: log.isSuccess,
          error_type: log.errorType,
          user_id: log.userId,
          document_id: log.documentId,
        });
      } catch (error) {
        // 로깅 실패는 조용히 처리 (주요 기능에 영향 없도록)
        console.error("[PerformanceLogger] Failed to log:", error);
      }
    }

    /**
     * 성능 측정 래퍼
     */
    export async function measurePerformance<T>(
      context: LLMUsageContext,
      modelId: string,
      operation: () => Promise<T>,
      options?: {
        usedFallback?: boolean;
        userId?: string;
        documentId?: string;
      }
    ): Promise<T> {
      const startTime = Date.now();
      let isSuccess = true;
      let errorType: string | undefined;

      try {
        const result = await operation();
        return result;
      } catch (error) {
        isSuccess = false;
        errorType = error instanceof Error ? error.name : "UnknownError";
        throw error;
      } finally {
        const latencyMs = Date.now() - startTime;

        await logPerformance({
          context,
          modelId,
          usedFallback: options?.usedFallback ?? false,
          latencyMs,
          isSuccess,
          errorType,
          userId: options?.userId,
          documentId: options?.documentId,
        });
      }
    }
    ```

- [x] **P4-03**: Gateway에 성능 로깅 통합
  - `Target`: `frontend/src/lib/llm/gateway.ts`
  - `Detail`: `measurePerformance` 래퍼 적용

---

## Verification (검증)

- [x] **Syntax Check**: `npx tsc --noEmit`
- [ ] **DB Migration**: Supabase에서 마이그레이션 실행
- [x] **Functionality Test**:
  - LLM 호출 시 로그 자동 기록 확인
  - 에러 발생 시 에러 타입 기록 확인
- [x] **Regression Test**:
  - 로깅으로 인한 성능 저하 없음 확인

---

# 🟠 Phase 5: 사용자별 모델 설정 (중기)

**목표**: Premium 사용자가 선호하는 LLM 모델 직접 선택  
**담당**: 풀스택 개발자  
**예상 시간**: 6시간

## Before Start

### 영향받는 기존 파일/테이블

| 항목               | 수정 내용                   |
| ------------------ | --------------------------- |
| `profiles` 테이블  | `preferred_model` 컬럼 추가 |
| `llm-usage-map.ts` | 사용자 설정 반영            |

### 신규 파일

| 파일                                    | 목적          |
| --------------------------------------- | ------------- |
| `components/settings/ModelSelector.tsx` | 모델 선택 UI  |
| `api/user/model-preference`             | 설정 저장 API |

---

## Implementation Items

- [x] **P5-01**: DB 스키마 확장

  - `Target`: `supabase/migrations/040_user_model_preference.sql` (신규)
  - `Detail`:

    ```sql
    -- 사용자 모델 선호도 컬럼 추가
    ALTER TABLE profiles
    ADD COLUMN IF NOT EXISTS preferred_model TEXT;

    -- 허용된 모델 목록 체크
    ALTER TABLE profiles
    ADD CONSTRAINT valid_preferred_model CHECK (
      preferred_model IS NULL OR
      preferred_model IN (
        'gemini-3-flash-preview',
        'gemini-3-pro-preview',
        'gpt-4o',
        'gpt-4o-mini',
        'claude-3-sonnet'
      )
    );
    ```

- [x] **P5-02**: 모델 선택 UI 구현

  - `Target`: `frontend/src/components/settings/ModelSelector.tsx` (신규)
  - `Detail`:
    - 사용자 등급에 따른 선택 가능 모델 필터링
    - 현재 설정 표시
    - 저장 버튼 및 피드백

- [x] **P5-03**: 설정 저장 API 구현

  - `Target`: `frontend/src/app/api/user/model-preference/route.ts` (신규)

- [x] **P5-04**: `getModelForUsage` 수정 - 사용자 설정 반영
  - `Target`: `frontend/src/config/llm-usage-map.ts`
  - `Detail`:
    ```typescript
    export function getModelForUsage(
      context: LLMUsageContext,
      userPreference?: string | null
    ): string {
      // 1. 사용자 선호 모델 (Premium 전용 컨텍스트만)
      if (userPreference && context.startsWith("premium.")) {
        return userPreference;
      }

      // 2. 환경 변수
      // 3. 중앙 매핑
      // ...기존 로직
    }
    ```

---

## Verification (검증)

- [x] **Syntax Check**: `npx tsc --noEmit`
- [ ] **DB Migration**: 스키마 확장 적용
- [x] **Functionality Test**:
  - 모델 선택 UI 정상 동작
  - 선택한 모델로 LLM 호출 확인
- [x] **Regression Test**:
  - Free 사용자 기존 동작 유지

---

# 🟢 Phase 6: 비용 모니터링 대시보드 (장기)

**목표**: 모델별 사용량과 비용을 추적하는 관리자 대시보드  
**담당**: 프론트엔드 + 백엔드 개발자  
**예상 시간**: 6시간  
**의존성**: Phase 4 (모델 성능 로깅) 완료 필수

## Implementation Items

- [x] **P6-01**: 비용 계산 로직 구현
- [x] **P6-02**: 집계 API 구현
- [x] **P6-03**: 대시보드 UI 구현
- [x] **P6-04**: 일별/주별/월별 리포트

---

# 🟢 Phase 7: A/B 테스트 시스템 (장기)

**목표**: 같은 컨텍스트에서 여러 모델의 성능 비교  
**담당**: 풀스택 개발자  
**예상 시간**: 8시간  
**의존성**: Phase 4 (모델 성능 로깅) 완료 필수

## Implementation Items

- [x] **P7-01**: A/B 테스트 설정 파일 생성
- [x] **P7-02**: 가중치 기반 모델 선택 로직
- [x] **P7-03**: 실험 결과 수집 및 분석
- [x] **P7-04**: 관리자 실험 관리 UI

---

## 📝 결정 필요 사항

체크리스트 실행 전 확인이 필요한 사항:

1. [ ] **Phase 1 즉시 시작 승인**
2. [ ] **Fallback 모델 우선순위** (Gemini → OpenAI vs Gemini → Anthropic)
3. [ ] **사용자 모델 선택 허용 범위** (Premium 전용 or 전체 컨텍스트)
4. [ ] **성능 로그 보존 기간** (30일 / 90일 / 무제한)
5. [ ] **A/B 테스트 첫 번째 실험 대상** 선정

---

_이 문서는 LLM 시스템 고도화를 위한 실행 체크리스트입니다._
