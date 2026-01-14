# LLM 중앙 관리 v2 - 구현 체크리스트

## 📋 문서 정보

- **작성일**: 2026-01-10 17:28
- **기반 문서**: `2601101730_LLM_Central_Management_v2.md`
- **작성자**: Tech Lead (Antigravity)
- **상태**: 구현 대기

---

## [Phase 1: 타입 안전성 강화 (Type Safety)]

**Before Start:**

- ⚠️ **회귀 주의**: `MODEL_REGISTRY` 객체 구조 변경 금지 (기존 키-값 유지)
- ⚠️ **레거시 보존**: `getModelConfig()`, `getDefaultModelId()` 함수 시그니처 유지

---

### [P1-01] `ValidModelId` 타입 정의

- `Target`: `frontend/src/config/models.ts` > 파일 최하단 (export 섹션)
- `Logic (Pseudo)`:

  ```
  // MODEL_REGISTRY를 as const로 선언되어 있으므로
  // keyof typeof로 유효한 모델 ID 타입 자동 추출

  export type ValidModelId = keyof typeof MODEL_REGISTRY;
  ```

- `Key Variables`:
  - `MODEL_REGISTRY`: 기존 모델 레지스트리 객체 (Line 53)
  - `ValidModelId`: 새로 추가할 타입 (string 리터럴 유니온)
- `Safety`:
  - `as const` 어서션 확인 필수 (없으면 타입 추론 불가)
  - 기존 `MODEL_REGISTRY` 선언에 `as const` 추가 필요

---

### [P1-02] `MODEL_REGISTRY`에 `as const` 추가

- `Target`: `frontend/src/config/models.ts` > `MODEL_REGISTRY` 선언부 (Line 53)
- `Logic (Pseudo)`:

  ```typescript
  // BEFORE
  export const MODEL_REGISTRY: Record<string, ModelConfig> = { ... };

  // AFTER
  export const MODEL_REGISTRY = { ... } as const satisfies Record<string, ModelConfig>;
  ```

- `Key Variables`:
  - `MODEL_REGISTRY`: 변경 대상
- `Safety`:
  - `satisfies` 키워드로 타입 체크 유지 (TypeScript 4.9+)
  - 런타임 동작에 영향 없음

---

### [P1-03] `UsageConfig` 인터페이스 수정

- `Target`: `frontend/src/config/llm-usage-map.ts` > `UsageConfig` 인터페이스 (Line 58-67)
- `Logic (Pseudo)`:

  ```typescript
  // BEFORE
  export interface UsageConfig {
    modelId: string;
    fallback?: string;
    ...
  }

  // AFTER
  import { ValidModelId } from './models';

  export interface UsageConfig {
    modelId: ValidModelId;
    fallback?: ValidModelId;
    ...
  }
  ```

- `Key Variables`:
  - `ValidModelId`: import 필요
  - `modelId`, `fallback`: 타입 변경 대상
- `Safety`:
  - import 문 파일 상단에 추가
  - 기존 `LLM_USAGE_MAP` 값들이 `ValidModelId`에 호환되는지 자동 검증됨

---

### [P1-DoD] Phase 1 검증

- [x] **Test**: `npx tsc --noEmit` 실행 → 에러 없음 확인
- [x] **Test**: `llm-usage-map.ts`에 `'invalid-model'` 입력 → 컴파일 에러 발생 확인
- [x] **Review**: 불필요한 `console.log` 없음 확인

---

## [Phase 2: 런타임 검증 (Runtime Validation)]

**Before Start:**

- ⚠️ **성능 주의**: 매 API 호출마다 검증하지 말 것 (서버 시작 시 1회만)
- ⚠️ **레거시 보존**: `getModelForUsage()` 함수 시그니처 변경 금지

---

### [P2-01] `isValidModelId()` Type Guard 함수 추가

- `Target`: `frontend/src/config/models.ts` > 유틸리티 함수 섹션 (Line 175 근처)
- `Logic (Pseudo)`:
  ```typescript
  /**
   * 주어진 문자열이 유효한 모델 ID인지 확인 (Type Guard)
   * @param id - 검사할 모델 ID 문자열
   * @returns id가 ValidModelId 타입인지 여부
   */
  export function isValidModelId(id: string): id is ValidModelId {
    return Object.hasOwn(MODEL_REGISTRY, id);
  }
  ```
- `Key Variables`:
  - `MODEL_REGISTRY`: 검증 기준 객체
  - `ValidModelId`: 반환 타입 (Type Narrowing)
- `Safety`:
  - `Object.hasOwn()` 사용 (ES2022, 프로토타입 오염 방지)
  - Fallback: `id in MODEL_REGISTRY` (ES5 호환)

---

### [P2-02] `validateUsageMap()` 전체 검증 함수 추가

- `Target`: `frontend/src/config/llm-usage-map.ts` > 파일 최하단
- `Logic (Pseudo)`:

  ```typescript
  import { MODEL_REGISTRY, isValidModelId } from "./models";

  /**
   * LLM_USAGE_MAP의 모든 모델 ID 유효성 검증
   * @returns { valid: boolean, errors: string[] }
   */
  export function validateUsageMap(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    for (const [context, config] of Object.entries(LLM_USAGE_MAP)) {
      // Primary modelId 검증
      if (!isValidModelId(config.modelId)) {
        errors.push(`[${context}] Invalid modelId: "${config.modelId}"`);
      }
      // Fallback modelId 검증 (있는 경우)
      if (config.fallback && !isValidModelId(config.fallback)) {
        errors.push(`[${context}] Invalid fallback: "${config.fallback}"`);
      }
    }

    return { valid: errors.length === 0, errors };
  }
  ```

- `Key Variables`:
  - `LLM_USAGE_MAP`: 검증 대상
  - `isValidModelId`: 검증 함수 (import)
  - `errors`: 에러 메시지 배열
- `Safety`:
  - `Object.entries()` 사용 (타입 안전)
  - `fallback` 옵셔널 필드 null check 필수

---

### [P2-03] `printUsageMapWithValidation()` 디버그 함수 개선

- `Target`: `frontend/src/config/llm-usage-map.ts` > `printUsageMap()` 함수 (Line 307)
- `Logic (Pseudo)`:

  ```typescript
  export function printUsageMap(): void {
    const { valid, errors } = validateUsageMap();

    console.log("\n📋 LLM Usage Map:");
    console.log("================");

    for (const [ctx, cfg] of Object.entries(LLM_USAGE_MAP)) {
      const fallbackInfo = cfg.fallback ? ` (fallback: ${cfg.fallback})` : "";
      const status = isValidModelId(cfg.modelId) ? "✅" : "❌";
      console.log(`  ${status} ${ctx}: ${cfg.modelId}${fallbackInfo}`);
    }

    console.log("================");

    if (!valid) {
      console.warn("⚠️ Validation Errors:");
      errors.forEach((e) => console.warn(`  - ${e}`));
    } else {
      console.log("✅ All model IDs are valid.\n");
    }
  }
  ```

- `Key Variables`:
  - `validateUsageMap()`: 검증 결과 가져오기
  - `isValidModelId()`: 개별 상태 표시
- `Safety`:
  - `console.warn` 사용 (에러 레벨 분리)

---

### [P2-DoD] Phase 2 검증

- [x] **Test**: `npx tsc --noEmit` → 에러 없음
- [x] **Test**: 브라우저 콘솔에서 `printUsageMap()` 호출 → 모든 ✅ 표시 확인
- [x] **Test**: 임시로 잘못된 모델 입력 후 `validateUsageMap()` → `errors` 배열에 메시지 있음 확인
- [x] **Review**: 함수별 JSDoc 주석 작성 확인

---

## [Phase 3: 빌드 및 배포]

**Before Start:**

- ⚠️ **배포 전**: 로컬에서 Shadow Writer 기능 테스트 필수

---

### [P3-01] 최종 빌드 검증

- `Target`: 터미널
- `Logic`:
  ```bash
  cd frontend
  npx tsc --noEmit
  npm run build
  ```
- `Safety`: 빌드 에러 0개 확인

---

### [P3-02] Git 커밋 및 푸시

- `Target`: 터미널
- `Logic`:
  ```bash
  git add frontend/src/config/models.ts frontend/src/config/llm-usage-map.ts
  git commit -m "feat(config): Add type-safe LLM model validation (v2)"
  git push origin main
  ```

---

### [P3-03] 기능 검증

- [x] **Test (Shadow Writer)**: 로컬/프로덕션에서 문장 제안 생성 확인
- [x] **Test (Evaluation)**: 평가 기능 정상 작동 확인
- [x] **Test (Deep Scholar)**: RAG 검색/요약 기능 확인

---

### [P3-DoD] Phase 3 최종 검증

- [x] **Vercel 배포 성공** (빌드 로그 확인)
- [x] **콘솔 에러 없음** (브라우저 개발자 도구)
- [x] **LLM 기능 전체 정상 작동**

---

## 📊 예상 소요 시간

| Phase                 | 예상 시간 |
| --------------------- | --------- |
| Phase 1 (타입 안전성) | 10분      |
| Phase 2 (런타임 검증) | 15분      |
| Phase 3 (배포)        | 10분      |
| **총 합계**           | **35분**  |
