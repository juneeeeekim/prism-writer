# 📘 LLM 모델 변경 및 추가 가이드 (v2.0)

**시스템 버전**: LLM Central Management v2.0 (Type-Safe)
**작성일**: 2026-01-10

이 가이드는 안전하게 LLM 모델을 변경하거나 새로운 모델을 추가하는 방법을 설명합니다.

---

## 🛑 핵심 규칙 (Safety First)

1. **`models.ts`에 등록된 모델만 사용 가능합니다.**
   - 등록되지 않은 문자열을 입력하면 **빨간 줄(컴파일 에러)**이 뜹니다.
2. **`llm-usage-map.ts` 한 곳에서만 변경하면 됩니다.**
   - 10개의 파일, 20곳의 코드를 찾아다닐 필요가 없습니다.

---

## 1️⃣ 상황 A: 이미 있는 모델로 바꾸고 싶을 때

(예: Shadow Writer를 `gemini-3-flash` → `gpt-5-mini`로 변경)

1. **파일 열기**: `frontend/src/config/llm-usage-map.ts`
2. **코드 수정**:

   ```typescript
   // 변경 전
   'suggest.completion': {
     modelId: 'gemini-3-flash-preview', // 현재 모델
     ...
   }

   // 변경 후
   'suggest.completion': {
     modelId: 'gpt-5-mini-2025-08-07',  // 오타가 나면 빨간 줄이 뜹니다! 🚫
     ...
   }
   ```

3. **저장**: 저장하면 즉시 반영됩니다. (서버 재시작 불필요)

---

## 2️⃣ 상황 B: 완전히 새로운 모델을 추가하고 싶을 때

(예: Google에서 `gemini-2.0-flash`가 새로 나와서 써보고 싶을 때)

### Step 1: 모델 등록

**파일**: `frontend/src/config/models.ts`
`MODEL_REGISTRY` 안에 새 모델 정보를 추가합니다.

```typescript
export const MODEL_REGISTRY = {
  // ... 기존 모델들 ...

  // 👇 여기에 새 모델 추가
  "gemini-2.0-flash": {
    provider: "gemini",
    displayName: "Gemini 2.0 Flash",
    capabilities: ["text-generation", "vision"],
    costPerInputToken: 0.0000001,
    costPerOutputToken: 0.0000004,
    maxTokens: 32000,
    tier: "free",
    enabled: true,
  },
} as const satisfies ...;
```

### Step 2: 모델 사용

**파일**: `frontend/src/config/llm-usage-map.ts`
이제 `gemini-2.0-flash`가 **자동 완성** 목록에 뜹니다!

```typescript
'suggest.completion': {
  modelId: 'gemini-2.0-flash', // ✅ 이제 사용 가능
}
```

---

## ❓ 자주 묻는 질문

**Q. 오타를 냈는지 어떻게 아나요?**
A. 에디터에서 `modelId` 값에 빨간 밑줄이 그어집니다.
`Type '"gemini-1.5-flsh"' is not assignable to type 'ValidModelId'.` 같은 에러가 뜹니다.

**Q. 변경했는데 적용이 안 되는 것 같아요.**
A. 브라우저 콘솔(F12)을 열고 `printUsageMap()`을 입력해보세요. 현재 설정된 모델 목록이 ✅/❌ 상태와 함께 출력됩니다.
