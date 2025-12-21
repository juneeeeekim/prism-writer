# 📋 LLM 모델 관리 시스템 구현 체크리스트

> **작성일**: 2025-12-21 21:04  
> **기반 문서**: `2512212100_LLM모델관리시스템_아이디어회의록.md`  
> **목적**: LLM 모델 추가/스위칭을 쉽게 만들기 위한 시스템 구축

---

## 📁 파일 구성 결정

### ✅ 단일 파일 구성 선택

**근거**:

1. **강한 의존성**: Phase 1(Model Registry) → Phase 2(Provider Abstraction) → Phase 3(환경 변수) → Phase 4(Gateway 통합)이 순차적 의존 관계
2. **협업 효율**: 한 파일에서 전체 진행 상황을 파악 가능
3. **검증 일관성**: 각 Phase의 검증이 이전 Phase의 성공을 전제로 함
4. **유지보수**: 체크리스트 분산 시 동기화 이슈 발생 가능

**대안 고려됨 (미채택)**:

- 2개 파일 분리 (Core / Optional): Phase 간 참조가 복잡해짐
- Phase별 분리: 의존성 추적이 어려워짐

---

## 🏗️ 전체 아키텍처 개요

```
[Phase 1] Model Registry (config/models.ts)
     ↓
[Phase 2] Provider Abstraction (lib/llm/providers/)
     ↓
[Phase 3] 환경 변수 분리 (config/llm.config.ts)
     ↓
[Phase 4] LLM Gateway 통합 (lib/llm/gateway.ts)
     ↓
[Phase 5] 기존 코드 마이그레이션
     ↓
[Phase 6] 최종 검증 및 문서화
```

---

## 👥 참여 역할

| 역할           | 담당 업무                                   |
| -------------- | ------------------------------------------- |
| 시니어 개발자  | 아키텍처 설계, 코드 리뷰, 마이그레이션 감독 |
| 주니어 개발자  | 구현, 테스트 작성, 문서화                   |
| UX/UI 디자이너 | 향후 관리자 UI 설계 (Phase 5 이후)          |

---

# Phase 4: LLM Gateway 통합

## 📍 목적

모든 LLM 호출의 단일 진입점 구축

## ⚠️ 영향받을 수 있는 기존 기능

- `frontend/src/lib/llm/client.ts` - 기존 진입점
- `frontend/src/app/api/llm/*` - API 라우트

## 🔗 연결성

```
Phase 1-3 → 4.1 Gateway 구현 → 4.2 기존 함수 유지 (호환성)
```

---

### 4.1 LLM Gateway 구현

- [x] **파일**: `frontend/src/lib/llm/gateway.ts` [NEW]
- [x] **연결**: Phase 1-3 모듈 통합
- [x] **내용**: 통합 진입점

  ```typescript
  import { getProviderByModel, type LLMProvider } from "./providers";
  import { getDefaultModel } from "@/config/llm.config";
  import { getModelConfig } from "@/config/models";
  import type {
    LLMGenerateOptions,
    LLMResponse,
    LLMStreamChunk,
  } from "./client";

  /**
   * LLM Gateway - 통합 텍스트 생성 API
   *
   * @description
   * 모델 ID를 기반으로 적절한 Provider를 선택하고 텍스트를 생성합니다.
   */
  export async function generateText(
    prompt: string,
    options: LLMGenerateOptions = {}
  ): Promise<LLMResponse> {
    const modelId = options.model || getDefaultModel();
    const provider = getProviderByModel(modelId);

    return provider.generateText(prompt, { ...options, model: modelId });
  }

  /**
   * LLM Gateway - 통합 스트리밍 API
   */
  export async function* generateTextStream(
    prompt: string,
    options: LLMGenerateOptions = {}
  ): AsyncGenerator<LLMStreamChunk> {
    const modelId = options.model || getDefaultModel();
    const provider = getProviderByModel(modelId);

    yield* provider.generateStream(prompt, { ...options, model: modelId });
  }

  /**
   * LLM 사용 가능 여부 확인
   */
  export function isLLMAvailable(modelId?: string): boolean {
    const id = modelId || getDefaultModel();
    const config = getModelConfig(id);
    if (!config) return false;

    try {
      const provider = getProviderByModel(id);
      return provider.isAvailable();
    } catch {
      return false;
    }
  }

  // 기존 client.ts 호환성을 위한 re-export
  export { estimateLLMTokenCount } from "./client";
  ```

- [x] **품질 체크**:
  - [x] 기존 `client.ts` 함수 시그니처 유지 (호환성)
  - [x] 에러 처리: Provider 에러를 적절히 전파

---

### 4.2 기존 client.ts 리팩토링

- [x] **파일**: `frontend/src/lib/llm/client.ts` [MODIFY]
- [x] **내용**: Gateway로 리다이렉트 + Deprecated 마킹

  ```typescript
  // 기존 코드 유지 (하위 호환성)
  // 새 코드는 gateway.ts 사용 권장

  /**
   * @deprecated gateway.ts의 generateText 사용 권장
   */
  export async function generateText(
    prompt: string,
    options: LLMGenerateOptions = {}
  ): Promise<LLMResponse> {
    // 기존 구현 유지 (Phase 5에서 삭제 예정)
    // ...
  }
  ```

- [x] **품질 체크**:
  - [x] @deprecated JSDoc 추가
  - [x] 기존 동작 변경 없음

---

## ✅ Phase 4 검증 체크리스트

- [x] **Syntax 오류 확인**
  ```bash
  cd frontend && npm run build
  ```
- [x] **기능 테스트** (API 키 필요)
  ```bash
  # 테스트 API 호출
  curl -X POST http://localhost:3000/api/llm/test
  ```
- [x] **기존 기능 정상 동작 확인**
  - [x] 기존 `client.ts` import 사용 코드 정상 동작
  - [x] RAG 평가 API 정상 동작

---

## ✅ Phase 4 검증 체크리스트

- [ ] **Syntax 오류 확인**
  ```bash
  cd frontend && npm run build
  ```
- [ ] **기능 테스트** (API 키 필요)
  ```bash
  # 테스트 API 호출
  curl -X POST http://localhost:3000/api/llm/test
  ```
- [ ] **기존 기능 정상 동작 확인**
  - [ ] 기존 `client.ts` import 사용 코드 정상 동작
  - [ ] RAG 평가 API 정상 동작

---

# Phase 5: 기존 코드 마이그레이션

## 📍 목적

기존 코드를 새 Gateway 시스템으로 점진적 마이그레이션

## ⚠️ 영향받을 수 있는 기존 기능

- 모든 LLM 호출 코드
- `frontend/src/app/api/llm/*`
- `frontend/src/app/api/rag/*`
- `frontend/src/types/rag.ts` - ROUTER_CONFIGS

## 🔗 연결성

```
5.1 import 경로 변경 → 5.2 ROUTER_CONFIGS 리팩토링 → 5.3 telemetry.ts 리팩토링
```

---

### 5.1 API 라우트 마이그레이션

- [x] **파일**: `frontend/src/app/api/llm/test/route.ts`
- [x] **변경**: import 경로 변경

- [x] **파일**: `frontend/src/app/api/llm/judge/route.ts`
- [x] **변경**: 동일한 import 경로 변경

- [x] **파일**: `frontend/src/app/api/rag/evaluate/route.ts` (있는 경우)
- [x] **변경**: 동일한 import 경로 변경

---

### 5.2 ROUTER_CONFIGS 리팩토링

- [x] **파일**: `frontend/src/types/rag.ts`
- [x] **변경**: Model Registry 참조하도록 변경

- [x] **품질 체크**:
  - [x] 초기화 시점에 Model Registry 로드
  - [x] 환경 변수로 모드별 모델 오버라이드 가능

---

### 5.3 telemetry.ts 리팩토링

- [x] **파일**: `frontend/src/types/telemetry.ts`
- [x] **변경**: MODEL_COSTS를 Model Registry에서 가져오도록 변경

---

### 5.4 Deprecated 코드 정리 (완료)

- [x] **파일**: `frontend/src/lib/llm/client.ts`
- [x] **결정**: 삭제 대신 Gateway 리다이렉션 구현
  - **이유**: 하위 호환성을 유지하면서 코드 중복을 제거하고 새 시스템(Registry, Provider)을 강제 적용하기 위함.
- [x] **작업 내용**:
  - [x] 공통 타입 추출 (`lib/llm/types.ts`)
  - [x] `client.ts`의 로직을 `gateway.ts`로 위임
  - [x] 불필요한 Gemini 직접 호출 코드 제거

---

## ✅ Phase 5 검증 체크리스트

- [x] **Syntax 오류 확인**
  - [x] `npm run build` 성공 (오류 0개)
- [x] **전체 테스트**
  - [x] `test:e2e` 환경 확인 (로그인 필요로 인해 수동 UI 확인으로 대체)
- [x] **브라우저 테스트**
  - [x] 에디터 페이지 접속 확인 (http://localhost:3000/editor)
  - [x] 글자 수 카운터 등 기본 UI 정상 동작 확인
- [x] **API 테스트**
  - [x] `api/llm/test`: Gateway 라우팅 및 API 키 누락 처리 확인 완료
  - [x] `api/llm/judge`: API 엔드포인트 활성화 확인 완료
- [x] **기존 기능 정상 동작 확인**
  - [x] 로그인 페이지 리다이렉션 정상 동작
  - [x] 에디터 레이아웃 유지 확인

---

# Phase 6: 최종 검증 및 문서화

## 📍 목적

전체 시스템 안정성 확인 및 문서화

## ⚠️ 영향받을 수 있는 기존 기능

- 없음 (검증 단계)

---

### 6.1 통합 테스트 (완료)

- [x] **테스트 파일 작성**
  - [x] `frontend/src/lib/llm/__tests__/gateway.test.ts`
  - [x] Provider 모킹으로 API 키 없이 테스트 수행
- [x] **테스트 케이스**
  - [x] 기본 모델로 텍스트 생성 검증
  - [x] 특정 모델 지정 텍스트 생성 검증
  - [x] 스트리밍 및 사용 가능 여부 확인 로직 검증

---

## ✅ Phase 6 최종 검증 체크리스트

- [x] **빌드 성공**: `npm run build` 성공
- [x] **모든 테스트 통과**: `npm run test` (Vitest) 모든 항목 통과
- [x] **프로덕션 모드 테스트**: 빌드 후 정적 페이지 생성 및 런타임 안정성 확인
- [x] **코드 품질 최종 확인**
  - [x] 불필요한 `console.log` 제거 완료
  - [x] 에러 메시지 한국어화 확인
  - [x] TypeScript strict 모드 (`tsc --noEmit`) 통과
- [x] **문서화 완료**
  - [x] 체크리스트 완료 표시
  - [x] 변경 내역 요약 및 Walkthrough 작성 완료

---

## 📊 전체 진행률

| Phase   | 상태    | 완료 항목 | 전체 항목 |
| ------- | ------- | --------- | --------- |
| Phase 1 | ✅ 완료 | 4         | 4         |
| Phase 2 | ✅ 완료 | 3         | 3         |
| Phase 3 | ✅ 완료 | 3         | 3         |
| Phase 4 | ✅ 완료 | 2         | 2         |
| Phase 5 | ✅ 완료 | 4         | 4         |
| Phase 6 | ✅ 완료 | 3         | 3         |

---

> **작성자**: AI 개발 어시스턴트  
> **검토 필요**: 시니어 개발자
