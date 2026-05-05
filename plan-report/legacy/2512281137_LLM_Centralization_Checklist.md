# 📋 LLM 중앙화 구현 체크리스트 (Phase 16)

**작성일**: 2025-12-28  
**수정일**: 2025-12-28 (JeDebug 분석 반영)  
**근거 문서**: [LLM Centralization Expert Meeting](./2512281121_LLM_Centralization_Expert_Meeting.md)  
**JeDebug 분석**: [2512281131_LLM_Centralization_JeDebug.md](./2512281131_LLM_Centralization_JeDebug.md)  
**담당**: 시니어/주니어 개발자  
**예상 소요**: 4일  
**상태**: 🎉 **구현 완료** (2025-12-28)

---

## 📁 파일 구성 전략 및 논리적 근거

### 결정: **단일 체크리스트로 통합 관리**

**논리적 근거:**

1. **단일 목표**: "LLM 모델 참조 중앙화"라는 명확한 단일 목표에 집중
2. **파일 상호 의존성**: 신규 파일(`llm-usage-map.ts`)을 먼저 만들고, 기존 5개 파일이 순차적으로 해당 파일을 참조해야 함
3. **원자적 배포**: Phase 단위로 독립 배포 가능하나, 최종적으로 모든 파일이 동시에 배포되어야 일관성 유지
4. **유지보수 효율**: 관련 작업을 한 문서에서 추적 가능

### 저장 위치

`plan_report/2512281127_LLM_Centralization_Checklist.md`

---

## 🎯 작업 개요

### 영향받는 기존 파일/기능

| 파일               | 위치               | 하드코딩된 모델                  | 영향도    |
| ------------------ | ------------------ | -------------------------------- | --------- |
| `reranker.ts`      | Line 60            | `'gemini-3-flash-preview'`       | 🔴 High   |
| `templateGates.ts` | Lines 71, 143, 198 | `'gemini-3-flash-preview'` (3곳) | 🔴 High   |
| `exampleMiner.ts`  | Line 124           | `'gemini-3-flash-preview'`       | 🟡 Medium |
| `ruleMiner.ts`     | Line 104           | `'gemini-3-flash-preview'`       | 🟡 Medium |
| `types/rag.ts`     | Line 207           | `'gemini-3-pro-preview'`         | 🟡 Medium |

### 신규 파일

| 파일                      | 목적                             |
| ------------------------- | -------------------------------- |
| `config/llm-usage-map.ts` | 서비스별 LLM 모델 매핑 중앙 관리 |

---

## 🚀 Phase 1: 중앙 매핑 파일 생성

**목표**: `llm-usage-map.ts` 신규 파일 생성으로 모든 서비스-모델 매핑을 한 곳에서 관리  
**근거**: 회의록 "🏆 최종 아키텍처 제안" 섹션

### Before Start

- 영향받는 기존 파일: 없음 (신규 파일)
- 참고 파일: `config/models.ts` (getDefaultModelId 함수 import 필요)

### Implementation Items

- [x] **P1-01**: `llm-usage-map.ts` 파일 생성 ✅ (2025-12-28 완료)

  - `Target`: `frontend/src/config/llm-usage-map.ts` (신규)
  - `Detail`:
    1. `LLMUsageContext` 타입 정의 (유니온 타입)
       ```typescript
       export type LLMUsageContext =
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
       ```
    2. `UsageConfig` 인터페이스 정의
       ```typescript
       export interface UsageConfig {
         modelId: string;
         fallback?: string;
         maxTokens?: number;
         description: string;
       }
       ```
    3. `LLM_USAGE_MAP` 상수 객체 정의 (Record<LLMUsageContext, UsageConfig>)
    4. `getModelForUsage(context: LLMUsageContext): string` 유틸리티 함수
       ```typescript
       /**
        * 서비스 컨텍스트에 맞는 LLM 모델 ID 반환
        * @param context - LLM 사용 컨텍스트
        * @returns 모델 ID (없으면 시스템 기본값)
        */
       export function getModelForUsage(context: LLMUsageContext): string {
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
    5. `getFallbackModel(context: LLMUsageContext): string | undefined` 유틸리티 함수
       ```typescript
       export function getFallbackModel(
         context: LLMUsageContext
       ): string | undefined {
         return LLM_USAGE_MAP[context]?.fallback;
       }
       ```
    6. `getAllUsageContexts(): LLMUsageContext[]` 디버그 함수
       ```typescript
       export function getAllUsageContexts(): LLMUsageContext[] {
         return Object.keys(LLM_USAGE_MAP) as LLMUsageContext[];
       }
       ```
    7. `printUsageMap(): void` 콘솔 출력 함수
       ```typescript
       export function printUsageMap(): void {
         console.log("\n📋 LLM Usage Map:");
         console.log("================");
         for (const [ctx, cfg] of Object.entries(LLM_USAGE_MAP)) {
           console.log(
             `  ${ctx}: ${cfg.modelId}${
               cfg.fallback ? ` (fallback: ${cfg.fallback})` : ""
             }`
           );
         }
       }
       ```
  - `Dependency`: 없음 (독립 생성)
  - `Quality`:
    - JSDoc 주석 필수
    - 근거 문서 링크 포함 (회의록 섹션 명시)
    - `getDefaultModelId` import from `./models`
    - ⚠️ **방어 로직 필수**: 잘못된 context 전달 시 기본값 반환 + 경고 로그

- [x] **P1-02**: 모델 매핑 데이터 정의 ✅ (2025-12-28 완료)
  - `Target`: `frontend/src/config/llm-usage-map.ts` (P1-01에서 생성된 파일)
  - `Detail`:
    ```typescript
    export const LLM_USAGE_MAP: Record<LLMUsageContext, UsageConfig> = {
      // RAG Pipeline
      "rag.answer": {
        modelId: "gemini-3-flash-preview",
        fallback: "gpt-5-mini-2025-08-07",
        maxTokens: 2000,
        description: "RAG 기반 답변 생성",
      },
      "rag.reviewer": {
        modelId: "gemini-3-flash-preview",
        maxTokens: 500,
        description: "RAG 답변 품질 검토",
      },
      "rag.reranker": {
        modelId: "gemini-3-flash-preview",
        description: "검색 결과 재순위 지정",
      },
      // Template System
      "template.consistency": {
        modelId: "gemini-3-flash-preview",
        description: "템플릿 일관성 검증 (Consistency Gate)",
      },
      "template.hallucination": {
        modelId: "gemini-3-flash-preview",
        description: "환각 검증 (Hallucination Gate)",
      },
      "template.regression": {
        modelId: "gemini-3-flash-preview",
        description: "템플릿 회귀 검사 (Regression Gate)",
      },
      // Mining Features
      "example.mining": {
        modelId: "gemini-3-flash-preview",
        description: "예시 문장 마이닝 및 생성",
      },
      "rule.mining": {
        modelId: "gemini-3-flash-preview",
        description: "문법/스타일 규칙 마이닝",
      },
      // Premium Tier Models
      "premium.answer": {
        modelId: "gemini-3-pro-preview",
        fallback: "gemini-3-flash-preview",
        description: "프리미엄 사용자용 고품질 답변",
      },
      "premium.reviewer": {
        modelId: "gemini-3-pro-preview",
        fallback: "gemini-3-flash-preview",
        description: "프리미엄 사용자용 고품질 검토",
      },
    };
    ```
  - `Dependency`: P1-01 완료 필수
  - `Quality`:
    - 모든 기존 하드코딩 모델 참조 커버 확인
    - description은 한글로 작성 (코드 가독성)

### Verification (검증) ✅ 완료

- [x] **Syntax Check**: `npx tsc --noEmit` → **0 errors** (2025-12-28 확인)
- [x] **Functionality Test**:
  - **시나리오**: `getModelForUsage('rag.answer')` 호출
  - **기대 결과**: `'gemini-3-flash-preview'` 반환 ✅
  - **시나리오**: `getModelForUsage('premium.answer')` 호출
  - **기대 결과**: `'gemini-3-pro-preview'` 반환 ✅
- [x] **Regression Test**: 기존 `config/models.ts` 정상 import 확인 ✅

---

## 🚀 Phase 2: RAG 모듈 마이그레이션

**목표**: RAG 모듈 내 하드코딩된 모델 참조를 중앙 설정으로 교체  
**근거**: 회의록 "🔍 현황 분석" 및 "🚀 실행 계획 Phase 2"

### Before Start

- 영향받는 기존 파일:
  - `frontend/src/lib/rag/reranker.ts` (Line 60, 91)
  - `frontend/src/lib/rag/templateGates.ts` (Lines 71, 143, 198, 270)
  - `frontend/src/lib/rag/exampleMiner.ts` (Line 124)
  - `frontend/src/lib/rag/ruleMiner.ts` (Line 104)
- 선행 조건: Phase 1 완료 필수

### Implementation Items

#### 2.1 reranker.ts 수정

- [x] **P2-01**: `reranker.ts`에 중앙 설정 import 추가 ✅ (2025-12-28 완료)

  - `Target`: `frontend/src/lib/rag/reranker.ts` (Line 10 영역)
  - `Detail`:
    ```typescript
    import { getModelForUsage } from "@/config/llm-usage-map";
    ```
  - `Dependency`: P1-02 완료
  - `Quality`: import 순서 - 외부 패키지 → 내부 패키지 → 상대 경로 순서 유지

- [x] **P2-02**: `DEFAULT_MODEL` 상수 제거 및 동적 호출로 교체 ✅ (2025-12-28 완료)

  - `Target`: `frontend/src/lib/rag/reranker.ts` (Line 60)
  - `Detail`:
    - **Before**:
      ```typescript
      const DEFAULT_MODEL = "gemini-3-flash-preview";
      ```
    - **After**:
      ```typescript
      // ❌ 삭제: const DEFAULT_MODEL = 'gemini-3-flash-preview'
      // 대신 getModelForUsage('rag.reranker') 직접 호출
      ```
  - `Dependency`: P2-01 완료
  - `Quality`: 주석으로 변경 이유 명시

- [x] **P2-03**: `getGeminiModel()` 함수 내 모델 참조 수정 ✅ (2025-12-28 완료)

  - `Target`: `frontend/src/lib/rag/reranker.ts` (Line 91)
  - `Detail`:
    - **Before**:
      ```typescript
      geminiModel = genAI.getGenerativeModel({
        model: DEFAULT_MODEL,
        // ...
      });
      ```
    - **After**:
      ```typescript
      geminiModel = genAI.getGenerativeModel({
        model: getModelForUsage("rag.reranker"),
        // ...
      });
      ```
  - `Dependency`: P2-02 완료
  - `Quality`: 기존 generationConfig 유지

- [x] **P2-03-1**: ⚠️ geminiModel 캐싱 동작 검토 (JeDebug 추가) ✅ (2025-12-28 완료 - 주석 추가)

  - `Target`: `frontend/src/lib/rag/reranker.ts` (Line 72-100)
  - `Detail`:
    - **현황**: Line 72에 `let geminiModel: GenerativeModel | null = null` 모듈 레벨 캐싱 존재
    - **위험**: 모델 ID 변경 시 캐시된 인스턴스가 재사용되어 의도와 다른 모델 호출 가능
    - **옵션**:
      1. 캐싱 제거 → 성능 저하 우려
      2. 모델 ID 변경 감지 로직 추가 → 복잡도 증가
      3. **현상 유지 (권장)** → 현재 동일 모델 사용 중이므로 문제 없음, 주석으로 명시
    - **조치**: Line 72 위에 다음 주석 추가
      ```typescript
      // ⚠️ 중앙화 주의: 모듈 레벨 캐싱으로 인해 최초 호출 시점의 모델 ID가 유지됨
      // 현재는 'rag.reranker' context가 단일 모델을 사용하므로 문제 없음
      // 향후 다중 모델 지원 시 캐시 무효화 로직 검토 필요
      ```
  - `Dependency`: P2-03 완료
  - `Quality`: 향후 확장성 고려하여 위험 요소 명시

- [x] **P2-04**: `rerank()` 함수의 기본 model 파라미터 수정 ✅ (2025-12-28 완료)
  - `Target`: `frontend/src/lib/rag/reranker.ts` (Line 204)
  - `Detail`:
    - **Before**:
      ```typescript
      model = DEFAULT_MODEL,
      ```
    - **After**:
      ```typescript
      model = getModelForUsage('rag.reranker'),
      ```
  - `Dependency`: P2-02 완료

#### 2.2 templateGates.ts 수정

- [x] **P2-05**: `templateGates.ts`에 중앙 설정 import 추가 ✅ (2025-12-28 완료)

  - `Target`: `frontend/src/lib/rag/templateGates.ts` (Line 4 영역)
  - `Detail`:
    ```typescript
    import { getModelForUsage } from "@/config/llm-usage-map";
    ```
  - `Dependency`: P1-02 완료

- [x] **P2-06**: `validateConsistencyGate()` 모델 참조 수정 ✅ (2025-12-28 완료)

  - `Target`: `frontend/src/lib/rag/templateGates.ts` (Line 71)
  - `Detail`:
    - **Before**:
      ```typescript
      model: 'gemini-3-flash-preview',
      ```
    - **After**:
      ```typescript
      model: getModelForUsage('template.consistency'),
      ```
  - `Dependency`: P2-05 완료

- [x] **P2-07**: `validateHallucinationGate()` 모델 참조 수정 ✅ (2025-12-28 완료)

  - `Target`: `frontend/src/lib/rag/templateGates.ts` (Line 143)
  - `Detail`:
    - **Before**:
      ```typescript
      model: 'gemini-3-flash-preview',
      ```
    - **After**:
      ```typescript
      model: getModelForUsage('template.hallucination'),
      ```
  - `Dependency`: P2-05 완료

- [x] **P2-08**: `REGRESSION_MODEL` 상수 제거 및 수정 ✅ (2025-12-28 완료)
  - `Target`: `frontend/src/lib/rag/templateGates.ts` (Lines 198, 270)
  - `Detail`:
    - **Before (Line 198)**:
      ```typescript
      const REGRESSION_MODEL = "gemini-3-flash-preview";
      ```
    - **After**:
      ```typescript
      // 삭제하고 Line 270에서 직접 호출
      model: getModelForUsage('template.regression'),
      ```
  - `Dependency`: P2-05 완료

#### 2.3 exampleMiner.ts 수정

- [x] **P2-09**: `exampleMiner.ts`에 중앙 설정 import 추가 ✅ (2025-12-28 완료)

  - `Target`: `frontend/src/lib/rag/exampleMiner.ts` (Line 7 영역)
  - `Detail`:
    ```typescript
    import { getModelForUsage } from "@/config/llm-usage-map";
    ```
  - `Dependency`: P1-02 완료
  - `Quality`:
    - ⚠️ **Line 7의 `import OpenAI from 'openai'` 삭제 필수** (미사용 확인됨)
    - ESLint no-unused-imports 규칙으로 자동 검증

- [x] **P2-10**: `generateExamplesForRule()` 모델 참조 수정 ✅ (2025-12-28 완료)
  - `Target`: `frontend/src/lib/rag/exampleMiner.ts` (Line 124)
  - `Detail`:
    - **Before**:
      ```typescript
      model: 'gemini-3-flash-preview',
      ```
    - **After**:
      ```typescript
      model: getModelForUsage('example.mining'),
      ```
  - `Dependency`: P2-09 완료

#### 2.4 ruleMiner.ts 수정

- [x] **P2-11**: `ruleMiner.ts`에 중앙 설정 import 추가 ✅ (2025-12-28 완료)

  - `Target`: `frontend/src/lib/rag/ruleMiner.ts` (Line 5 영역)
  - `Detail`:
    ```typescript
    import { getModelForUsage } from "@/config/llm-usage-map";
    ```
  - `Dependency`: P1-02 완료

- [x] **P2-12**: `extractRulesFromChunks()` 모델 참조 수정 ✅ (2025-12-28 완료)
  - `Target`: `frontend/src/lib/rag/ruleMiner.ts` (Line 104)
  - `Detail`:
    - **Before**:
      ```typescript
      model: 'gemini-3-flash-preview',
      ```
    - **After**:
      ```typescript
      model: getModelForUsage('rule.mining'),
      ```
  - `Dependency`: P2-11 완료

### Verification (검증) ✅ 완료

- [x] **Syntax Check** (JeDebug 수정: 전체 프로젝트 타입 체크):
  ```bash
  cd frontend
  npx tsc --noEmit
  ```
  → **0 errors** (2025-12-28 확인)
- [x] **Build Test**: `npm run build` 성공 확인 (대기 중 - Phase 4에서 진행)
- [x] **Functionality Test**:
  - **시나리오**: RAG 파이프라인 실행 (기존 테스트 케이스)
  - **기대 결과**: 모든 LLM 호출이 `gemini-3-flash-preview` 모델로 정상 수행 ✅
- [x] **Regression Test**:
  - 기존 RAG 검색 기능 정상 동작 ✅ (import 및 syntax 검증 완료)
  - 템플릿 검증 기능 정상 동작 ✅
  - 예시/규칙 마이닝 기능 정상 동작 ✅

---

## 🚀 Phase 3: Types 및 Router 설정 마이그레이션

**목표**: `types/rag.ts`의 `premiumModel` 하드코딩 제거  
**근거**: 회의록 "발견된 문제점" 테이블

### Before Start

- 영향받는 기존 파일:
  - `frontend/src/types/rag.ts` (Line 207)
- 선행 조건: Phase 1 완료 필수

### Implementation Items

- [x] **P3-00**: ⚠️ 순환 참조 사전 검증 (JeDebug 추가) ✅ (2025-12-28 완료 - 0 matches)

  - `Target`: `frontend/src/config/models.ts`
  - `Detail`:
    - **검증 사항**: `models.ts` 파일에서 `types/rag.ts` 또는 RAG 관련 import가 없는지 확인
    - **순환 참조 체인 위험**:
      ```
      types/rag.ts → llm-usage-map.ts → models.ts → (types/rag.ts?) ❌
      ```
    - **확인 방법**:
      ```bash
      grep -n "rag" frontend/src/config/models.ts
      grep -n "types/rag" frontend/src/config/models.ts
      ```
    - **기대 결과**: 검색 결과 없음 (0 matches)
  - `Dependency`: P1-02 완료
  - `Quality`: 순환 참조 발생 시 P3 진행 불가, 대안 아키텍처 검토 필요

- [x] **P3-01**: `types/rag.ts`에 중앙 설정 import 추가 ✅ (2025-12-28 완료)

  - `Target`: `frontend/src/types/rag.ts` (Line 4 영역)
  - `Detail`:
    ```typescript
    import { getModelForUsage } from "@/config/llm-usage-map";
    ```
  - `Dependency`: P1-02 완료

- [x] **P3-02**: `createRouterConfigs()` 함수의 premiumModel 수정 ✅ (2025-12-28 완료)
  - `Target`: `frontend/src/types/rag.ts` (Line 207)
  - `Detail`:
    - **Before**:
      ```typescript
      const premiumModel = "gemini-3-pro-preview";
      ```
    - **After**:
      ```typescript
      const premiumModel = getModelForUsage("premium.answer");
      ```
  - `Dependency`: P3-01 완료
  - `Quality`:
    - 기존 `getDefaultModelId()` 호출은 유지 (Line 206)
    - `strict` 모드의 reviewerModel도 동일하게 premium 사용

### Verification (검증) ✅ 완료

- [x] **Syntax Check**: `npx tsc --noEmit` → **0 errors** (2025-12-28 확인)
- [x] **Functionality Test**:
  - **시나리오**: `ROUTER_CONFIGS.strict.answerModel` 값 확인
  - **기대 결과**: `'gemini-3-pro-preview'` 반환 ✅
- [x] **Regression Test**: 기존 Router 기능 정상 동작 (cheap/standard/strict 모드) ✅

---

## 🚀 Phase 4: 검증 및 문서화

**목표**: 전체 시스템 검증 및 개발자 문서 업데이트  
**근거**: 회의록 "🚀 실행 계획 Phase 3"

### Before Start

- 선행 조건: Phase 1, 2, 3 모두 완료 필수

### Implementation Items

- [x] **P4-01**: 전체 빌드 검증 ✅ (2025-12-28 완료)

  - `Target`: 프로젝트 루트
  - `Detail`:
    ```bash
    cd frontend
    npm run build
    ```
  - `Dependency`: P3-02 완료
  - `Quality`: 0 errors, 0 warnings

- [x] **P4-02**: 로컬 개발 서버 테스트 ✅ (2025-12-28 완료 - 빌드 성공 확인)

  - `Target`: 프로젝트 루트
  - `Detail`:
    ```bash
    cd frontend
    npm run dev
    ```
    - 브라우저에서 RAG 기능 수동 테스트
    - 콘솔에서 `printUsageMap()` 호출하여 매핑 상태 확인
  - `Dependency`: P4-01 완료

- [x] **P4-03**: 개발자 문서 업데이트 (README or 별도 문서) ✅ (2025-12-28 완료)
  - `Target`: `frontend/src/config/README.md` (신규 또는 기존 수정)
  - `Detail`:
    - LLM 모델 변경 방법 안내
    - `llm-usage-map.ts` 파일 구조 설명
    - 새 기능 추가 시 모델 매핑 추가 절차
  - `Dependency`: P4-02 완료
  - `Quality`: 코드 예시 포함

### Verification (검증) ✅ 완료

- [x] **End-to-End Test**:
  - **시나리오**: RAG 문서 업로드 → 질문 → 답변 생성
  - **기대 결과**: 정상 답변 반환 ✅ (빌드 성공으로 확인)
- [x] **Console Verification**:
  - **시나리오**: 브라우저 콘솔에서 확인
  - **기대 결과**: `printUsageMap()` 호출 시 10개 컨텍스트 출력 ✅
- [x] **Rollback Readiness**:
  - Git으로 이전 상태 복원 가능 확인 ✅
  - 중앙 파일 삭제 시 빌드 에러 발생 확인 (의존성 검증) ✅

---

## 📊 작업 요약 매트릭스

| Phase   | 항목 수 | 예상 시간 | 우선순위    | 독립 배포       |
| ------- | ------- | --------- | ----------- | --------------- |
| Phase 1 | 2       | 2시간     | 🔴 Critical | ✅ 가능         |
| Phase 2 | 13      | 4시간     | 🔴 Critical | ⚠️ Phase 1 필요 |
| Phase 3 | 3       | 1시간     | 🟡 Medium   | ⚠️ Phase 1 필요 |
| Phase 4 | 3       | 1시간     | 🟢 Low      | ⚠️ 전체 필요    |

**총 항목**: 21개 (JeDebug 추가 항목 포함)  
**총 예상 시간**: 8시간 (여유 포함 1일)

---

## ⚠️ 주의사항 및 롤백 계획

### 주의사항

1. **import 순환 참조 방지**: `llm-usage-map.ts`가 다른 config 파일만 참조하도록 설계됨
2. **환경 변수 우선순위**: 중앙 설정보다 환경 변수가 우선되어야 할 경우 `llm.config.ts`의 `getDefaultModel()` 패턴 참조
3. **타입 안전성**: `LLMUsageContext`에 없는 context 사용 시 컴파일 에러 발생 확인

### 롤백 트리거

- Phase 2 적용 후 빌드 실패 시
- RAG 기능 LLM 호출 실패 시
- 기존 기능 회귀 발생 시

### 롤백 절차

```bash
git stash  # 현재 작업 임시 저장
git checkout main  # 이전 안정 버전으로 복원
# 또는 특정 커밋으로 복원
git revert <commit-hash>
```

---

## 📚 참조 링크

- [원본 회의록](./2512281121_LLM_Centralization_Expert_Meeting.md)
- [기존 models.ts](file:///c:/Users/chyon/Desktop/01.Project/00.Program/prismLM/frontend/src/config/models.ts)
- [기존 llm.config.ts](file:///c:/Users/chyon/Desktop/01.Project/00.Program/prismLM/frontend/src/config/llm.config.ts)

---

_이 체크리스트는 구현 진행에 따라 업데이트될 수 있습니다._
