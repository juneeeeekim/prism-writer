# 🐛 Chat Model Switcher 버그 분석 보고서

> **버전**: 1.0  
> **날짜**: 2026-01-23 21:42  
> **보고자**: 시스템 아키텍처팀  
> **심각도**: 🔴 Critical (핵심 기능 미작동)

---

## 1. 문제 요약

### 사용자 보고

> "Claude 4.5 Sonnet을 선택하고 채팅을 했는데, Anthropic API 사용량이 0입니다."

### 검증 결과

**✅ 사용자 말씀이 맞습니다. 버그가 확인되었습니다.**

---

## 2. 근본 원인 분석 (Root Cause Analysis)

### 🔴 핵심 버그: `StorageEvent`는 같은 탭에서 발생하지 않음

```typescript
// useChat.ts (Line 77-81) - 현재 코드
const handleStorageChange = (e: StorageEvent) => {
  if (e.key === "prism_selected_model") {
    setSelectedModel(e.newValue); // ❌ 같은 탭에서는 호출 안 됨!
  }
};
window.addEventListener("storage", handleStorageChange);
```

**문제점:**

- `StorageEvent`는 **다른 브라우저 탭/창**에서 localStorage가 변경될 때만 발생
- **같은 탭** 내에서 변경하면 이벤트가 발생하지 않음
- `ChatModelSelector`와 `useChat`이 같은 탭에 있으므로, 모델 변경 시 `useChat`의 `selectedModel` 상태가 업데이트되지 않음

### 데이터 흐름 분석

```
[현재 버그 상황]

ChatModelSelector  →  localStorage.setItem('prism_selected_model', 'claude-4.5-sonnet')
     ↓
useChat.ts의 StorageEvent 리스너  →  ❌ 이벤트 발생 안 함 (같은 탭)
     ↓
selectedModel 상태  →  여전히 null (초기값)
     ↓
API 호출: model: null  →  서버에서 기본 모델(Gemini) 사용
     ↓
Anthropic API 사용량: 0  ✅ 사용자 관찰과 일치
```

---

## 3. 코드 추적 증거

### 3.1 ChatModelSelector.tsx (정상)

```typescript
// Line 119-123: localStorage에 저장
if (modelId) {
  localStorage.setItem(STORAGE_KEY, modelId);
}
onModelChange?.(modelId); // 콜백 호출하지만 useChat에서 안 받음
```

### 3.2 useChat.ts (버그 위치)

```typescript
// Line 62: 초기값 null
const [selectedModel, setSelectedModel] = useState<string | null>(null);

// Line 68-74: 마운트 시 1회만 로드
useEffect(() => {
  const storedModel = localStorage.getItem("prism_selected_model");
  setSelectedModel(storedModel); // ✅ 마운트 시에만 로드됨
  // 이후 같은 탭에서 변경해도 useEffect가 다시 실행되지 않음
}, []); // 의존성 배열 빈 배열

// Line 219: API 호출 시 selectedModel 사용
model: selectedModel || undefined; // selectedModel이 null이면 undefined 전송
```

### 3.3 chat/route.ts (정상)

```typescript
// Line 46: 모델 파라미터 수신
const {
  messages,
  model: requestedModel,
  sessionId,
  projectId,
} = await req.json();

// Line 75: 기본값 폴백
const modelId = requestedModel || getModelForUsage("rag.answer");
// requestedModel이 undefined이면 기본 모델(gemini-3-flash-preview) 사용
```

---

## 4. 해결 방안

### Option A: 커스텀 이벤트 사용 (권장)

같은 탭 내에서도 동기화되도록 커스텀 이벤트 발행:

```typescript
// ChatModelSelector.tsx - 수정
localStorage.setItem(STORAGE_KEY, modelId);
window.dispatchEvent(
  new CustomEvent("prism-model-change", { detail: modelId }),
);

// useChat.ts - 수정
useEffect(() => {
  const handleModelChange = (e: CustomEvent) => {
    setSelectedModel(e.detail);
  };
  window.addEventListener("prism-model-change", handleModelChange);
  return () =>
    window.removeEventListener("prism-model-change", handleModelChange);
}, []);
```

### Option B: Context API 사용

`ModelContext`를 생성하여 전역 상태로 관리:

```typescript
const ModelContext = createContext<{
  selectedModel: string | null;
  setSelectedModel: (model: string | null) => void;
}>({ selectedModel: null, setSelectedModel: () => {} });
```

### Option C: Zustand 스토어 사용

전역 상태 관리 라이브러리 활용:

```typescript
const useModelStore = create((set) => ({
  selectedModel: null,
  setSelectedModel: (model) => set({ selectedModel: model }),
}));
```

---

## 5. 영향 범위

| 영향 기능           | 상태    | 설명                                |
| ------------------- | ------- | ----------------------------------- |
| 모델 선택 UI        | ✅ 정상 | 드롭다운에서 선택한 모델이 표시됨   |
| localStorage 저장   | ✅ 정상 | 선택한 모델 ID가 저장됨             |
| useChat 상태 동기화 | ❌ 버그 | 같은 탭에서 변경 시 동기화 안 됨    |
| API 호출            | ❌ 버그 | 기본 모델로 항상 호출됨             |
| 페이지 새로고침 후  | ✅ 정상 | useEffect가 다시 실행되어 정상 동작 |

---

## 6. 재현 단계

1. 채팅 페이지 접속
2. 모델 드롭다운에서 "Claude 4.5 Sonnet" 선택
3. 메시지 전송
4. **예상**: Claude 4.5 Sonnet으로 응답
5. **실제**: Gemini 3 Flash로 응답 (기본 모델)
6. Anthropic API 대시보드에서 사용량 0 확인

---

## 7. 수정 우선순위

🔴 **Critical** - 즉시 수정 필요

사용자가 유료 모델(Claude, GPT-5.2)을 선택해도 항상 기본 모델이 사용되므로, 핵심 기능이 작동하지 않는 상태입니다.

---

## 8. 결론

**사용자의 지적이 100% 정확합니다.**

모델 선택 UI는 정상 작동하지만, 실제 API 호출에는 반영되지 않습니다. `StorageEvent`의 동작 특성(다른 탭에서만 발생)을 간과한 설계 오류입니다. 커스텀 이벤트 또는 Context API를 통해 같은 탭 내 실시간 동기화를 구현해야 합니다.
