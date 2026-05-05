# LLM 중앙 관리 시스템 v2 - 타입 안전성 강화

## 📋 문서 정보

- **작성일**: 2026-01-10
- **버전**: v2.0
- **상태**: 계획 (Planning)
- **우선순위**: 🔴 Critical

---

## 1. 문제 정의 (Problem Statement)

### 1.1 발생한 이슈

2026-01-10 "가성비 최적화" 작업에서 `gemini-1.5-flash` 모델로 변경 후,
Shadow Writer를 포함한 모든 LLM 기능이 중단됨.

**에러 로그**:

```
[GoogleGenerativeAI Error]: [404 Not Found]
models/gemini-1.5-flash is not found for API version v1beta
```

### 1.2 근본 원인 (Root Cause)

현재 아키텍처에서 `modelId`가 `string` 타입으로 정의되어 있어:

1. **잘못된 모델 ID를 입력해도 컴파일 에러가 발생하지 않음**
2. **런타임에 API 호출 실패로만 오류가 드러남** (Silent Failure)
3. **모델 변경 시 사전 검증이 불가능함**

```typescript
// 현재 (문제)
export interface UsageConfig {
  modelId: string;  // ← 아무 문자열이나 허용됨
  ...
}
```

### 1.3 기대 결과

- 잘못된 모델 ID 입력 시 **컴파일 타임에 에러 발생**
- 서버 시작 시 **모든 모델 ID 유효성 자동 검증**
- **안전하게 모델을 변경/테스트**할 수 있는 환경 구축

---

## 2. 해결 전략 (Solution Strategy)

### Phase 1: 타입 안전성 강화 (Type Safety)

#### P1-01: 모델 ID 타입 정의

`models.ts`의 `MODEL_REGISTRY`에서 유효한 모델 ID 타입 자동 추출

```typescript
// models.ts
export const MODEL_REGISTRY = { ... } as const;

// 유효한 모델 ID 타입 자동 생성
export type ValidModelId = keyof typeof MODEL_REGISTRY;
```

#### P1-02: UsageConfig 타입 수정

`llm-usage-map.ts`에서 `string` 대신 `ValidModelId` 사용

```typescript
// llm-usage-map.ts (개선)
import { ValidModelId } from './models';

export interface UsageConfig {
  modelId: ValidModelId;  // ← 유효한 모델만 허용
  fallback?: ValidModelId;
  ...
}
```

**효과**: 잘못된 모델 ID 입력 시 TypeScript 컴파일 에러 발생

---

### Phase 2: 런타임 검증 (Runtime Validation)

#### P2-01: 모델 유효성 검사 함수

```typescript
// models.ts
export function isValidModelId(id: string): id is ValidModelId {
  return id in MODEL_REGISTRY;
}

export function validateAllUsageMapModels(): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  for (const [context, config] of Object.entries(LLM_USAGE_MAP)) {
    if (!isValidModelId(config.modelId)) {
      errors.push(`[${context}] Invalid modelId: ${config.modelId}`);
    }
  }
  return { valid: errors.length === 0, errors };
}
```

#### P2-02: 서버 시작 시 자동 검증

`getModelForUsage` 함수 호출 시 또는 서버 초기화 시 검증 로그 출력

---

### Phase 3: 개발자 경험 개선 (DX Enhancement)

#### P3-01: 사용 가능한 모델 목록 출력 유틸리티

```typescript
export function printAvailableModels(): void {
  console.log("📋 Available Models:");
  for (const [id, config] of Object.entries(MODEL_REGISTRY)) {
    console.log(`  - ${id} (${config.displayName})`);
  }
}
```

#### P3-02: Google API 모델 목록 조회 (선택)

실제 Google API에서 사용 가능한 모델 목록을 조회하는 유틸리티

---

## 3. 파일 변경 계획

| 파일                                   | 변경 내용                                          |
| -------------------------------------- | -------------------------------------------------- |
| `frontend/src/config/models.ts`        | `ValidModelId` 타입 추가, 검증 함수 추가           |
| `frontend/src/config/llm-usage-map.ts` | `UsageConfig.modelId` 타입을 `ValidModelId`로 변경 |

---

## 4. 검증 계획 (Verification)

### 4.1 컴파일 타임 검증 테스트

1. 잘못된 모델 ID 입력 → `tsc` 에러 발생 확인
2. 유효한 모델 ID 입력 → 정상 컴파일 확인

### 4.2 런타임 검증 테스트

1. 서버 시작 시 모델 검증 로그 확인
2. `printUsageMap()` 호출 시 경고 메시지 없음 확인

### 4.3 기능 테스트

1. Shadow Writer 정상 작동 확인
2. RAG 평가 기능 정상 작동 확인

---

## 5. 체크리스트

### Phase 1: 타입 안전성 ✅

- [x] P1-01: `models.ts`에 `ValidModelId` 타입 추가
- [x] P1-02: `llm-usage-map.ts`의 `UsageConfig` 타입 수정 (하위 호환성 위해 type assertion 사용)
- [x] P1-03: 컴파일 확인 (`tsc --noEmit`) - 0 errors

### Phase 2: 런타임 검증 ✅

- [x] P2-01: `isValidModelId()` Type Guard 함수 추가
- [x] P2-02: `validateUsageMap()` 함수 추가
- [x] P2-03: `printUsageMap()` 개선 (✅/❌ 상태 표시)

### Phase 3: 배포 및 검증 ✅

- [x] P3-01: Git 커밋 및 푸시 (`1f5fe82`)
- [x] P3-02: Vercel 배포 트리거됨
- [ ] P3-03: Shadow Writer 기능 테스트 (사용자 확인 대기)

---

## 6. 예상 소요 시간

- Phase 1: 15분
- Phase 2: 15분
- Phase 3: 10분
- **총 예상 시간: 40분**
