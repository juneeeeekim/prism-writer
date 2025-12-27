# Phase 10: Multi-Model Strategy Implementation Checklist

## 1. File & Structure Decision

- **전략**: `ModelSelector.ts` 유틸리티 분리
- **근거**: 현재 `upgradePlanner.ts`, `patchGenerator.ts` 등 여러 곳에서 모델을 호출하고 있습니다. 이를 각각 하드코딩하면 유지보수가 어렵고, 추후 모델이 추가될 때마다 모든 파일을 수정해야 합니다. 따라서 모델 선택 로직을 중앙화하여 `taskType`과 `qualityLevel`만 주면 최적의 모델 ID를 반환하도록 추상화하는 것이 좋습니다.
- **저장 위치**: `plan_report/2512280230_Phase10_MultiModel_Checklist.md`

---

## [Phase 10: Multi-Model Routing]

### **Before Start:**

- 영향받는 기존 파일/기능:
  - `frontend/src/lib/judge/upgradePlanner.ts` (현재 Flash 하드코딩)
  - `frontend/src/lib/judge/patchGenerator.ts` (현재 Flash 하드코딩)
  - `frontend/src/app/api/rag/evaluate-single/route.ts` (API 엔드포인트)
  - `frontend/src/components/Editor/FeedbackPanel.tsx` (UI)

### **Implementation Items:**

#### 1. Backend: ModelSelector Utility 구현

- [x] **P10-01**: `ModelSelector.ts` 생성
  - `Target`: `frontend/src/lib/llm/modelSelector.ts` (신규 생성)
  - `Detail`:
    - `ModelQuality` 타입 정의 ('standard' | 'high_quality')
    - `selectModel(task: string, quality: ModelQuality): string` 함수 구현
    - Standard: `gemini-3-flash-preview`
    - High-Quality: `gemini-3-pro-preview` (추후 Opus 등 확장 가능 구조)
  - `Dependency`: 없음
  - `Quality`: 모델 ID 하드코딩 제거 및 중앙 관리

#### 2. API: Quality Level 파라미터 수신

- [x] **P10-02**: `evaluate-single` API 업데이트
  - `Target`: `frontend/src/app/api/rag/evaluate-single/route.ts`
  - `Detail`:
    - Request Body에 `qualityLevel` (optional) 추가
    - `runUpgradePlanner` 호출 시 `qualityLevel` 전달
  - `Dependency`: P10-01
- [x] **P10-02-B**: API Timeout 설정
  - `Target`: `frontend/src/app/api/rag/evaluate-single/route.ts`
  - `Detail`: High-Quality 모델의 응답 지연을 고려하여 Vercel Function Timeout (`maxDuration`)을 60초로 설정
  - `Dependency`: P10-02
- [x] **P10-03**: `upgradePlanner.ts` 리팩토링
  - `Target`: `frontend/src/lib/judge/upgradePlanner.ts`
  - `Detail`:
    - `runUpgradePlanner` 인자에 `qualityLevel` 추가
    - `ModelSelector.selectModel`을 사용하여 모델 ID 결정
    - 기존 하드코딩된 fallback 로직을 `ModelSelector` 또는 호출부로 위임 (High Quality 요청 실패 시 Flash Fallback 정책 적용)
- [x] **P10-03-B**: `patchGenerator.ts` 리팩토링 및 API 연결
  - `Target`: `frontend/src/lib/judge/patchGenerator.ts`, `frontend/src/app/api/rag/change-plan/route.ts`
  - `Detail`:
    - `runPatchGenerator`에 `qualityLevel` 파라미터 추가
    - `change-plan` API에서 `qualityLevel` 파라미터 수신 및 전달
    - **Note**: Auto-Fix는 보통 "Deep Analysis" 버튼이 아니라 "Plan Apply" 시점에 일어나므로, 일단은 Plan 생성 시의 품질 설정을 따라가거나 별도 설정이 필요한지 확인 필요. (MVP에서는 Standard 유지 또는 Plan과 동일 설정 적용)
  - `Dependency`: P10-01

#### 3. Frontend: Deep Analysis UI 추가

- [x] **P10-04**: `FeedbackPanel.tsx`에 Deep Analysis 버튼 추가
  - `Target`: `frontend/src/components/Editor/FeedbackPanel.tsx`
  - `Detail`:
    - `Upgrade Plan` 영역 우측 상단(또는 하단)에 "[🧠 깊게 생각하기]" (또는 "Pro 모델로 재평가") 버튼 추가
    - 버튼 클릭 시 `handleReevaluate({ quality: 'high_quality' })` 호출
  - `Dependency`: P10-02
  - `Quality`: 로딩 상태 표시 (Pro 모델은 느리므로 스피너 필수)

#### 4. Policy: Error Handling & Fallback

- [x] **P10-05**: High Quality 실패 시 대응 로직
  - `Target`: `frontend/src/lib/judge/upgradePlanner.ts` (또는 API 레벨)
  - `Detail`:
    - Pro 모델 429/500 에러 발생 시, 자동으로 Flash 모델로 재시도할지 vs 에러 메시지를 띄울지 결정
    - (아이디어 회의 결과): **"명시적 에러 메시지 + Flash 유도"** 또는 **"자동 Flash Fallback feat. 알림"**
    - 구현: Pro 실패 시 catch 블록에서 Flash로 재시도하되, 결과에 `meta: { isFallback: true }`를 포함하여 UI에서 "Pro 모델 사용량이 많아 Flash로 처리되었습니다" 알림 표시.

### **Verification (검증):**

- [x] **Syntax Check**: `npx tsc --noEmit` 수행하여 타입 에러 확인
- [x] **Functional Test (Standard)**: 기존 "재평가" 버튼 클릭 -> Flash 모델 동작 확인 (빠른 응답)
- [x] **Functional Test (High-Quality)**: 신규 "Deep Analysis" 버튼 클릭 -> Pro 모델 동작 확인 (느린 응답, 더 긴 출력)
- [x] **Error Handling Test**: Pro 모델 강제 에러(API Key 변조 등) 시 Flash로 Fallback 되며 알림 뜨는지 확인
