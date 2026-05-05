# 📋 Holistic Evaluation Persistence & Re-evaluation Checklist

**Date**: 2025-12-29
**Author**: Tech Lead
**Status**: 🚀 In Progress

---

## 🚨 Critical Fixes

- [ ] **Fix 1:** `HolisticFeedbackPanel` null safety 강화 (이미지 속 에러 방지)
- [ ] **Fix 2:** `V5EvaluationResult` 타입 확장 (`holistic_result` 필드 추가)

## 💾 Persistence (저장 기능)

- [ ] **Task 1:** Backend API (`/api/evaluations`) 확인
  - JSONB 저장이므로 스키마 변경 불필요 확인.
- [ ] **Task 2:** Frontend `EvaluationTab.tsx` - 저장 로직 개선
  - `handleHolisticEvaluate` 성공 시 자동 저장.
  - 상세 평가(`result`)와 종합 평가(`holisticResult`) 병합 저장 로직 구현.
- [ ] **Task 3:** Frontend `EvaluationTab.tsx` - 로드 로직 개선
  - 저장된 평가 불러올 때 `holistic_result`가 있으면 상태 복원.

## 🔄 Re-evaluation (재평가 기능)

- [ ] **Task 4:** `HolisticFeedbackPanel` 내 "재평가" 버튼 추가
  - 또는 상위 `EvaluationTab`에서 종합 평가 탭일 때 "다시 평가하기" 버튼 노출.

---

## 🛠️ Implementation Plan

### 1. Type Definition

`frontend/src/lib/judge/types.ts`

```typescript
export interface EvaluationResult {
  // ... existing fields
  holistic_result?: HolisticEvaluationResult; // [NEW]
}
```

### 2. Frontend Logic (`EvaluationTab.tsx`)

- `saveEvaluation`: `holisticResult` 상태도 함께 Payload에 포함.
- `handleHolisticEvaluate`: 평가 완료 후 `saveEvaluation` 호출.
- `handleLoadEvaluation`: `data.holistic_result`가 있으면 `setHolisticResult` 실행.

### 3. UI Update

`holisticResult`가 있을 때도 "재평가" 버튼을 눌러 `handleHolisticEvaluate`를 다시 호출할 수 있도록 UI 수정.
