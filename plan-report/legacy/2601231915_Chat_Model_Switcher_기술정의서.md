# 🔄 Chat Model Switcher 기술 정의서

> **버전**: 1.0  
> **날짜**: 2026-01-23  
> **작성자**: AI 시스템 아키텍처 전문 개발팀

---

## 1. 개요

### 1.1 목표

AI 채팅 프롬프트 창에서 **실시간으로 LLM 모델을 스위칭**할 수 있는 기능 구현  
(ChatGPT의 모델 선택 기능과 유사)

### 1.2 현재 상태

| 항목                        | 상태    | 위치                                                   |
| --------------------------- | ------- | ------------------------------------------------------ |
| 모델 레지스트리 (15개+)     | ✅ 완료 | `frontend/src/config/models.ts`                        |
| Admin 모델 스위칭 UI        | ✅ 완료 | `frontend/src/components/admin/AdminModelSelector.tsx` |
| 채팅 API 모델 파라미터 지원 | ✅ 완료 | `frontend/src/app/api/chat/route.ts`                   |
| localStorage 모델 선택 저장 | ✅ 완료 | `prism_selected_model` 키                              |

---

## 2. 🛡️ Red Team 검증 보고서

### 2.1 기술적 실현 가능성 검증

#### ✅ 검증 항목 1: API 레벨 모델 파라미터 지원

**검증 코드 위치**: `chat/route.ts` Line 46

```typescript
// ✅ 이미 구현되어 있음
const {
  messages,
  model: requestedModel,
  sessionId,
  projectId,
} = await req.json();
// ...
const modelId = requestedModel || getModelForUsage("rag.answer");
```

**Red Team 평가**: ✅ **PASS**

- API는 이미 `model` 파라미터를 받아 처리할 준비가 되어 있음
- 폴백 로직도 존재 (`getModelForUsage` 기본값)

---

#### ✅ 검증 항목 2: 프론트엔드 모델 전송 로직

**검증 코드 위치**: `useChat.ts` Line 172-188

```typescript
// ✅ 이미 구현되어 있음
const selectedModel =
  typeof window !== 'undefined'
    ? localStorage.getItem('prism_selected_model')
    : null

// API 호출 시 model 파라미터 전달
body: JSON.stringify({
  messages: [...],
  model: selectedModel || undefined,  // ✅ 이미 지원!
  sessionId: currentSessionId,
})
```

**Red Team 평가**: ✅ **PASS**

- 클라이언트에서 서버로 모델 ID 전송 로직 완비
- localStorage 기반 저장/로드 완료

---

#### ✅ 검증 항목 3: LLM Gateway 다중 Provider 지원

**검증 코드 위치**: `frontend/src/lib/llm/gateway.ts`

**Red Team 평가**: ✅ **PASS**

- Google Gemini, OpenAI, Anthropic 모두 지원
- 모델별 자동 Provider 라우팅 구현됨

---

### 2.2 리그레션 위험 분석

| 위험 항목                | 위험도  | 분석                                | 대응 방안        |
| ------------------------ | ------- | ----------------------------------- | ---------------- |
| 기존 채팅 기능 깨짐      | 🟢 낮음 | UI 추가만 하며, 기존 로직 변경 없음 | 기존 테스트 실행 |
| Admin Mode 충돌          | 🟢 낮음 | 별도 컴포넌트로 분리                | 조건부 렌더링    |
| 모델 선택 시 미지원 모델 | 🟡 중간 | enabled=false 모델 선택 가능성      | 필터링 적용      |
| localStorage 오염        | 🟢 낮음 | 기존 키 재사용                      | 동일 메커니즘    |
| 새로고침 없이 모델 변경  | 🟡 중간 | 현재 Admin은 새로고침 필요          | 상태 관리 개선   |

**Red Team 결론**: ✅ **구현 승인**  
리그레션 위험 낮음, 주의 사항만 준수하면 안전하게 배포 가능

---

## 3. 제안 변경사항

### 3.1 컴포넌트 구조

```
frontend/src/components/Assistant/
├── ChatTab.tsx              # [MODIFY] 모델 선택 UI 통합
├── ChatModelSelector.tsx    # [NEW] 일반 사용자용 모델 선택 컴포넌트
└── chat/
    └── ChatInput.tsx        # 변경 없음
```

---

### [NEW] ChatModelSelector.tsx

**파일 위치**: `frontend/src/components/Assistant/ChatModelSelector.tsx`

**핵심 기능**:

- MODEL_REGISTRY에서 `enabled: true` 모델만 표시
- 선택 시 localStorage에 저장
- 현재 선택된 모델 표시
- Provider별 아이콘 (Gemini/OpenAI/Anthropic)

**예상 코드 구조**:

```typescript
"use client";

import { useState, useEffect } from "react";
import { MODEL_REGISTRY } from "@/config/models";

interface ChatModelSelectorProps {
  onModelChange?: (modelId: string) => void;
}

export default function ChatModelSelector({
  onModelChange,
}: ChatModelSelectorProps) {
  const [selectedModel, setSelectedModel] = useState<string>("");

  // enabled 모델만 필터링
  const enabledModels = Object.entries(MODEL_REGISTRY)
    .filter(([_, config]) => config.enabled)
    .map(([id, config]) => ({
      id,
      name: config.displayName,
      provider: config.provider,
    }));

  // ... 상태 관리 및 UI 렌더링
}
```

---

### [MODIFY] ChatTab.tsx

**변경 내용**: ChatModelSelector 통합

```diff
 import { useRef, useEffect } from 'react'
 import { useChat } from '@/hooks/useChat'
 import { MessageItem, ChatInput } from './chat'
+import ChatModelSelector from './ChatModelSelector'

 export default function ChatTab({ sessionId, onSessionChange }: ChatTabProps) {
   // ...

   return (
     <div className="flex flex-col h-full bg-white dark:bg-gray-900">
+      {/* Model Selector */}
+      <div className="flex items-center justify-between px-4 py-2 border-b">
+        <ChatModelSelector />
+      </div>

       {/* Messages Area */}
       <div className="flex-1 overflow-y-auto p-4 space-y-4">
```

---

### [MODIFY] useChat.ts (선택적 개선)

**현재**: localStorage 값을 전송 시점에 읽음 (새로고침 필요)  
**개선**: 실시간 상태 반영 (새로고침 불필요)

```diff
 export function useChat({ sessionId, onSessionChange }: UseChatOptions) {
+  const [selectedModel, setSelectedModel] = useState<string | null>(null)
+
+  // 초기값 로드 & 변경 감지
+  useEffect(() => {
+    const stored = localStorage.getItem('prism_selected_model')
+    setSelectedModel(stored)
+
+    // storage 이벤트 리스너로 다른 탭에서의 변경 감지
+    const handleStorage = (e: StorageEvent) => {
+      if (e.key === 'prism_selected_model') {
+        setSelectedModel(e.newValue)
+      }
+    }
+    window.addEventListener('storage', handleStorage)
+    return () => window.removeEventListener('storage', handleStorage)
+  }, [])
```

---

## 4. UI 디자인

### 4.1 모델 선택 드롭다운 UI

```
┌─────────────────────────────────────────────────────────────┐
│  🤖 모델: [Gemini 3.0 Flash Preview     ▼]                  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  💬 대화 내용...                                             │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  [메시지 입력창...]                              [전송]     │
└─────────────────────────────────────────────────────────────┘
```

### 4.2 드롭다운 확장 시

```
┌─────────────────────────────────────────────┐
│  🤖 Google                                   │
│    ├── Gemini 3.0 Flash Preview ⚡ (기본)    │
│    ├── Gemini 3 Pro Preview 🧠               │
│    └── Gemma 3 27B IT 🔬                     │
│  🤖 OpenAI                                   │
│    ├── GPT-5.2 🧠                            │
│    └── GPT-5 mini ⚡                         │
│  🤖 Anthropic                                │
│    ├── Claude 4.5 Opus 🧠                    │
│    └── Claude 4.5 Sonnet                     │
└─────────────────────────────────────────────┘
```

---

## 5. Verification Plan (검증 계획)

### 5.1 Automated Tests

#### 5.1.1 기존 테스트 실행 (Regression)

```bash
# 1. Unit Tests (vitest)
cd frontend
npm run test

# 2. E2E Tests (playwright)
npm run test:e2e
```

**확인 사항**: 모든 기존 테스트 통과 여부

---

### 5.2 Manual Verification

#### 테스트 시나리오 1: 모델 선택 기본 동작

| 단계 | 액션                            | 예상 결과                                   |
| ---- | ------------------------------- | ------------------------------------------- |
| 1    | 채팅 탭 열기                    | 상단에 모델 선택 드롭다운 표시              |
| 2    | 드롭다운 클릭                   | 사용 가능한 모델 목록 표시 (enabled=true만) |
| 3    | 다른 모델 선택 (예: GPT-5 mini) | 드롭다운에 선택한 모델 표시                 |
| 4    | 메시지 전송                     | 선택한 모델로 응답 생성                     |
| 5    | 페이지 새로고침                 | 선택한 모델이 유지됨                        |

#### 테스트 시나리오 2: 대화 중 모델 변경

| 단계 | 액션                       | 예상 결과              |
| ---- | -------------------------- | ---------------------- |
| 1    | Gemini Flash로 질문 전송   | Gemini Flash 응답 수신 |
| 2    | GPT-5 mini로 변경          | 드롭다운 갱신됨        |
| 3    | 같은 세션에서 새 질문 전송 | GPT-5 mini로 응답 생성 |
| 4    | 이전 대화 히스토리 확인    | 정상 유지              |

#### 테스트 시나리오 3: 세션/프로젝트 독립성 확인

| 단계 | 액션                       | 예상 결과                              |
| ---- | -------------------------- | -------------------------------------- |
| 1    | 프로젝트 A에서 모델 X 선택 | 모델 X로 응답                          |
| 2    | 프로젝트 B로 이동          | 동일한 모델 X 유지 (localStorage 기반) |
| 3    | 새 채팅 세션 생성          | 이전 대화 영향 없음                    |

---

## 6. 구현 일정

| Phase     | 작업                              | 예상 시간   |
| --------- | --------------------------------- | ----------- |
| Phase 1   | ChatModelSelector 컴포넌트 생성   | 1시간       |
| Phase 2   | ChatTab 통합                      | 30분        |
| Phase 3   | useChat 실시간 반영 개선 (선택적) | 30분        |
| Phase 4   | UI 스타일링                       | 30분        |
| Phase 5   | 테스트 및 검증                    | 1시간       |
| **Total** |                                   | **3-4시간** |

---

## 7. 결론

### ✅ Red Team 최종 판정: **구현 승인**

| 항목               | 결과                   |
| ------------------ | ---------------------- |
| 기술적 실현 가능성 | ✅ 100% 가능           |
| 기존 인프라 활용도 | ✅ 90% 이상 재사용     |
| 리그레션 위험      | ✅ 낮음                |
| 구현 복잡도        | ✅ 낮음 (UI 추가 위주) |
| 예상 소요 시간     | ✅ 3-4시간             |

> **중요**: 모든 핵심 인프라가 이미 구축되어 있어, **프론트엔드 UI 컴포넌트 추가**만으로 기능 구현이 가능합니다.
