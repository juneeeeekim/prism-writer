# Chat Model Switcher 버그 수정 구현 정의서

> **버전**: 1.0  
> **날짜**: 2026-01-23 21:50  
> **작성자**: 기술 리더 / 백엔드 시니어 / UX 개발자  
> **선택 방안**: Option A (커스텀 이벤트)

---

## 1. 개요

### 1.1 문제 요약

`StorageEvent`가 같은 탭에서 발생하지 않아, `ChatModelSelector`에서 모델을 변경해도 `useChat`의 `selectedModel` 상태가 업데이트되지 않음.

### 1.2 해결 방안

`CustomEvent`를 사용하여 같은 탭 내에서도 모델 변경을 실시간 동기화.

---

## 2. 수정 대상 파일

| 파일                    | 수정 내용               |
| ----------------------- | ----------------------- |
| `ChatModelSelector.tsx` | CustomEvent 발행 추가   |
| `useChat.ts`            | CustomEvent 리스너 추가 |

---

## 3. 구현 상세

### 3.1 이벤트 명세

| 항목             | 값                                                                 |
| ---------------- | ------------------------------------------------------------------ |
| 이벤트 이름      | `prism-model-change`                                               |
| 이벤트 타입      | `CustomEvent<string>`                                              |
| payload (detail) | 선택된 모델 ID (예: `"claude-4.5-sonnet-20250929"`) 또는 빈 문자열 |

---

### 3.2 ChatModelSelector.tsx 수정

**파일 위치**: `frontend/src/components/Assistant/ChatModelSelector.tsx`

**수정 위치**: `handleModelChange` 함수 (Line 114-127)

**Before:**

```typescript
const handleModelChange = (e: ChangeEvent<HTMLSelectElement>) => {
  const modelId = e.target.value;
  setSelectedModel(modelId);

  if (modelId) {
    localStorage.setItem(STORAGE_KEY, modelId);
  } else {
    localStorage.removeItem(STORAGE_KEY);
  }

  onModelChange?.(modelId);
};
```

**After:**

```typescript
const handleModelChange = (e: ChangeEvent<HTMLSelectElement>) => {
  const modelId = e.target.value;
  setSelectedModel(modelId);

  if (modelId) {
    localStorage.setItem(STORAGE_KEY, modelId);
  } else {
    localStorage.removeItem(STORAGE_KEY);
  }

  // [BUG-FIX] 같은 탭 내 실시간 동기화를 위한 CustomEvent 발행
  window.dispatchEvent(
    new CustomEvent("prism-model-change", { detail: modelId }),
  );

  onModelChange?.(modelId);
};
```

**변경 사항**: +1줄 (CustomEvent 발행)

---

### 3.3 useChat.ts 수정

**파일 위치**: `frontend/src/hooks/useChat.ts`

**수정 위치**: useEffect 훅 (Line 68-85)

**Before:**

```typescript
useEffect(() => {
  if (typeof window === "undefined") return;

  const storedModel = localStorage.getItem("prism_selected_model");
  setSelectedModel(storedModel);

  const handleStorageChange = (e: StorageEvent) => {
    if (e.key === "prism_selected_model") {
      setSelectedModel(e.newValue);
    }
  };

  window.addEventListener("storage", handleStorageChange);
  return () => window.removeEventListener("storage", handleStorageChange);
}, []);
```

**After:**

```typescript
useEffect(() => {
  if (typeof window === "undefined") return;

  const storedModel = localStorage.getItem("prism_selected_model");
  setSelectedModel(storedModel);

  // [기존] 다른 탭에서의 변경 감지
  const handleStorageChange = (e: StorageEvent) => {
    if (e.key === "prism_selected_model") {
      setSelectedModel(e.newValue);
    }
  };

  // [BUG-FIX] 같은 탭 내 실시간 동기화를 위한 CustomEvent 리스너
  const handleModelChange = (e: Event) => {
    const customEvent = e as CustomEvent<string>;
    setSelectedModel(customEvent.detail || null);
  };

  window.addEventListener("storage", handleStorageChange);
  window.addEventListener("prism-model-change", handleModelChange);

  return () => {
    window.removeEventListener("storage", handleStorageChange);
    window.removeEventListener("prism-model-change", handleModelChange);
  };
}, []);
```

**변경 사항**: +9줄 (CustomEvent 리스너 및 cleanup)

---

## 4. 검증 계획

### 4.1 빌드 테스트

```bash
cd frontend
npm run build
```

### 4.2 수동 검증 시나리오

| 단계 | 액션                                        | 예상 결과                       |
| ---- | ------------------------------------------- | ------------------------------- |
| 1    | 채팅 페이지 접속                            | 기본 모델(Default) 선택됨       |
| 2    | 드롭다운에서 "Claude 4.5 Sonnet" 선택       | UI에 선택 반영                  |
| 3    | **새로고침 없이** 메시지 전송               | Claude 4.5 Sonnet으로 응답 생성 |
| 4    | Anthropic API 대시보드 확인                 | 사용량 증가 확인                |
| 5    | 다른 모델(GPT-5 mini)로 변경 후 메시지 전송 | OpenAI로 응답 생성              |

---

## 5. 롤백 계획

문제 발생 시:

1. CustomEvent 발행/리스너 코드 주석 처리
2. 기존 StorageEvent 방식으로 복구
3. 사용자에게 "새로고침 후 모델 변경 반영" 안내

---

## 6. 예상 소요 시간

| 단계        | 시간     |
| ----------- | -------- |
| 코드 수정   | 15분     |
| 빌드 테스트 | 5분      |
| 수동 검증   | 10분     |
| 배포        | 5분      |
| **총합**    | **35분** |

---

## 7. 승인

- [x] 기술 리더 승인
- [ ] 디렉터 승인 → **대기 중**
