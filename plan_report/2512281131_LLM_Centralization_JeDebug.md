# 🛡️ JeDebug Analysis: LLM Centralization (Phase 16)

**분석일**: 2025-12-28  
**대상 문서**: [2512281127_LLM_Centralization_Checklist.md](./2512281127_LLM_Centralization_Checklist.md)  
**원본 요구사항**: [2512281121_LLM_Centralization_Expert_Meeting.md](./2512281121_LLM_Centralization_Expert_Meeting.md)

---

## 1️⃣ 🔧 로직 및 구현 보완 (Logic Fixes)

### Critical Issues

- [ ] **(Critical) P1-01 누락: `getDefaultModelId` import 필요하나 실제 사용처 불분명**

  - [ ] 원인: P1-01에서 `getDefaultModelId` import를 언급하지만, `getModelForUsage()` 함수 구현에서 실제로 사용하는지 명시 안됨
  - [ ] **수정 제안**: P1-01 Detail 항목 4번 `getModelForUsage` 함수 구현에 다음 추가:
    ```typescript
    export function getModelForUsage(context: LLMUsageContext): string {
      return LLM_USAGE_MAP[context]?.modelId ?? getDefaultModelId();
    }
    ```
  - [ ] 파일/위치: 체크리스트 Line 87 영역

- [ ] **(Critical) P2-03과 geminiModel 캐싱 충돌**

  - [ ] 원인: `reranker.ts` Line 72에 `let geminiModel: GenerativeModel | null = null` 모듈 레벨 캐싱이 있음. `getModelForUsage()`가 매 호출마다 다른 값을 반환할 수 있지만, 캐시된 모델은 최초 생성 시점의 모델 ID를 유지함
  - [ ] **수정 제안**: P2-03 이후에 새 항목 추가:
    ```
    - [ ] **P2-03-1**: geminiModel 캐시 무효화 로직 검토
        - `Target`: `frontend/src/lib/rag/reranker.ts` (Line 72-100)
        - `Detail`: 현재 모듈 레벨 캐싱으로 인해 모델 변경 시 재초기화 필요.
          옵션 1: 캐싱 제거 (성능 저하 우려)
          옵션 2: 모델 ID 변경 감지 로직 추가
          옵션 3: 현재 상태 유지 (동일 모델 사용 중이므로 문제 없음) ← 권장
        - `Quality`: 현재는 옵션 3 선택, 향후 다중 모델 지원 시 재검토 필요
    ```
  - [ ] 파일/위치: 체크리스트 Line 232 이후

- [ ] **(Critical) P3-02 순환 참조 위험**
  - [ ] 원인: `types/rag.ts`가 `@/config/llm-usage-map`을 import하고, `llm-usage-map.ts`가 `@/config/models`를 import. 만약 `models.ts`가 `types/rag.ts`를 참조한다면 순환 참조 발생
  - [ ] **수정 제안**: P3-01 이전에 검증 단계 추가:
    ```
    - [ ] **P3-00**: 순환 참조 사전 검증
        - `Target`: `frontend/src/config/models.ts`
        - `Detail`: `models.ts` 파일에서 `types/rag.ts` 또는 RAG 관련 import가 없는지 확인
        - `Dependency`: P1-02 완료
        - `Quality`: 순환 참조 발생 시 P3 진행 불가, 대안 아키텍처 검토 필요
    ```
  - [ ] 파일/위치: 체크리스트 Line 381 이전

### Major Issues

- [ ] **(Major) P1-02 fallback 모델 ID 오류**

  - [ ] 원인: `gpt-5-mini-2025-08-07`는 `models.ts`에 `gpt-5-mini-2025-08-07`로 정의되어 있으나, 체크리스트에서는 `gpt-5-mini-2025-08-07` 사용. 실제 `models.ts` Line 108 확인 필요
  - [ ] **수정 제안**: P1-02에 검증 단계 추가:
    ```
    - `Quality` 추가: fallback 모델 ID가 MODEL_REGISTRY에 존재하는지 컴파일 타임 검증 권장
    ```
  - [ ] 파일/위치: 체크리스트 Line 154-156 영역

- [ ] **(Major) P2-09 미사용 import 처리 불완전**

  - [ ] 원인: Line 311에서 `OpenAI` import 제거 검토라고만 언급. 실제 코드(`exampleMiner.ts` Line 7)에서 `import OpenAI from 'openai'` 존재하지만 사용되지 않음
  - [ ] **수정 제안**: P2-09 Quality에 명확한 지시 추가:
    ```
    - `Quality`:
      - Line 7의 `import OpenAI from 'openai'` 삭제 (미사용 확인됨)
      - ESLint no-unused-imports 규칙으로 자동 검증
    ```
  - [ ] 파일/위치: 체크리스트 Line 311

- [ ] **(Major) Phase 2 Verification - tsc 명령어 경로 오류**

  - [ ] 원인: `npx tsc --noEmit frontend/src/lib/rag/reranker.ts` 형식은 단일 파일 컴파일이 tsconfig 설정을 무시할 수 있음
  - [ ] **수정 제안**: Phase 2 Verification 수정:

    ````
    - [ ] **Syntax Check**:
      ```bash
      cd frontend
      npx tsc --noEmit
    ````

    (전체 프로젝트 타입 체크로 변경)

    ```

    ```

  - [ ] 파일/위치: 체크리스트 Line 352-358

---

## 2️⃣ 🚨 리스크 및 안전장치 (Risk Guardrails)

### High Risk

- [ ] **(High) 기존 기능 회귀 - reranker 함수 시그니처 변경**

  - [ ] 위험 요소: `rerank()` 함수의 `options.model` 기본값이 상수에서 함수 호출로 변경. 호출 시점마다 평가되므로 기존 동작과 동일하나, 타입 추론에 영향 가능
  - [ ] **방어 코드 추가 제안**: P2-04에 타입 검증 추가
    ```typescript
    // rerank 함수 시그니처 유지 확인
    // Before: model = DEFAULT_MODEL (string literal)
    // After: model = getModelForUsage('rag.reranker') (string 반환 함수)
    // 타입 호환성: string = string ✅
    ```

- [ ] **(High) 런타임 에러 - 잘못된 context 전달 시**
  - [ ] 위험 요소: `getModelForUsage('invalid.context' as any)` 호출 시 undefined 반환 후 LLM 호출 실패 가능
  - [ ] **방어 코드 추가 제안**: P1-01 `getModelForUsage` 함수에 방어 로직 추가
    ```typescript
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
  - [ ] 파일/위치: 체크리스트 Line 87 영역

### Mid Risk

- [ ] **(Mid) 성능 이슈 - 함수 호출 오버헤드**

  - [ ] 위험 요소: 기존 상수 참조에서 함수 호출로 변경. 매 LLM 호출마다 `getModelForUsage()` 실행
  - [ ] **방어 로직 제안**: 현재 함수가 단순 객체 조회이므로 성능 영향 無. 단, 향후 복잡한 로직(DB 조회 등) 추가 시 캐싱 고려 필요. 현재는 조치 불필요.

- [ ] **(Mid) 배포 시 환경 변수 누락**
  - [ ] 위험 요소: `llm-usage-map.ts`에서 환경 변수 기반 오버라이드를 지원하지 않음. 회의록에서 Sarah Kim이 제안한 "환경 변수 우선순위" 미반영
  - [ ] **방어 로직 제안**: Phase 1에 환경 변수 오버라이드 지원 여부 결정 항목 추가 (Optional Enhancement)
    ```
    - [ ] **P1-03** (Optional): 환경 변수 기반 모델 오버라이드 지원
        - `Detail`: `MODEL_RAG_ANSWER` 등 환경 변수로 개별 모델 오버라이드 가능하도록 확장
        - `Priority`: Low (향후 확장)
    ```

---

## 3️⃣ 🧪 검증 기준 구체화 (Test Criteria)

### Happy Path 테스트

- [ ] **HP-01**: `getModelForUsage('rag.answer')` 호출 시 `'gemini-3-flash-preview'` 반환
- [ ] **HP-02**: `getModelForUsage('premium.answer')` 호출 시 `'gemini-3-pro-preview'` 반환
- [ ] **HP-03**: `ROUTER_CONFIGS.strict.answerModel` 값이 `'gemini-3-pro-preview'`
- [ ] **HP-04**: `ROUTER_CONFIGS.cheap.answerModel` 값이 `getDefaultModelId()` 반환값과 동일
- [ ] **HP-05**: RAG 채팅에서 질문 입력 → 답변 정상 생성 (LLM 호출 성공)
- [ ] **HP-06**: 템플릿 검증 (Consistency/Hallucination/Regression Gate) 정상 동작
- [ ] **HP-07**: `printUsageMap()` 호출 시 10개 context 모두 출력

### Edge Case 테스트

- [ ] **EC-01**: `getModelForUsage` 함수에 타입 에러 유도 - TypeScript 컴파일 에러 발생 확인
  ```typescript
  getModelForUsage("invalid.context"); // ❌ 컴파일 에러 발생해야 함
  ```
- [ ] **EC-02**: `LLM_USAGE_MAP`에 없는 context 접근 시 기본값 반환 (방어 로직 적용 시)
- [ ] **EC-03**: `llm-usage-map.ts` 파일 삭제 후 빌드 시 import 에러 발생 확인
- [ ] **EC-04**: Gemini API 키 미설정 시 에러 메시지 정상 출력 (기존 동작 유지)

### 회귀 테스트 체크포인트

- [ ] **REG-01**: 기존 `rerank()` 함수 호출 코드 수정 없이 동작 확인
- [ ] **REG-02**: 기존 `validateAllGates()` 함수 호출 코드 수정 없이 동작 확인
- [ ] **REG-03**: 기존 `mineRulesByCategory()` 함수 호출 코드 수정 없이 동작 확인
- [ ] **REG-04**: 기존 `processExamplesForRule()` 함수 호출 코드 수정 없이 동작 확인

---

## 4️⃣ 🎯 최종 판단 (Decision)

- [x] 상태: **✅ 즉시 진행 가능** (체크리스트 수정 완료: 2025-12-28)

### 수정 완료된 항목

> ✅ P1-01에 `getModelForUsage` 함수 구현 코드 및 방어 로직 추가  
> ✅ P2-03 이후 캐싱 검토 항목(P2-03-1) 추가  
> ✅ P3 이전 순환 참조 검증 항목(P3-00) 추가  
> ✅ Phase 2 Verification의 tsc 명령어 수정  
> ✅ P2-09 OpenAI import 삭제 명시

---

## 📋 수정 권장 항목 요약

| 우선순위    | 항목                  | 수정 내용                              | 영향           |
| ----------- | --------------------- | -------------------------------------- | -------------- |
| 🔴 Critical | P1-01                 | `getModelForUsage` 함수 구현 코드 명시 | 기능 구현      |
| 🔴 Critical | P2-03-1 신규          | geminiModel 캐싱 검토 항목 추가        | 회귀 방지      |
| 🔴 Critical | P3-00 신규            | 순환 참조 사전 검증 항목 추가          | 빌드 에러 방지 |
| 🟡 Major    | P2-09                 | OpenAI import 삭제 명시                | 코드 정리      |
| 🟡 Major    | Phase 2 Verification  | tsc 명령어 수정                        | 검증 정확성    |
| 🟢 Low      | P1-03 신규 (Optional) | 환경 변수 오버라이드 지원              | 유연성 확장    |

---

## ✅ 수정 완료 시 진행 가능 조건

1. [ ] P1-01에 `getModelForUsage` 함수 구현 코드 추가
2. [ ] P2-03 이후 캐싱 검토 항목(P2-03-1) 추가
3. [ ] P3 이전 순환 참조 검증 항목(P3-00) 추가
4. [ ] Phase 2 Verification의 tsc 명령어 수정

위 4개 항목 수정 후 **✅ 즉시 진행 가능** 상태로 전환됩니다.

---

_JeDebug Analysis by Senior Lead Developer_
