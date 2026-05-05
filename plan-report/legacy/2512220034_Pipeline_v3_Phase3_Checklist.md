# Phase 3: Alignment Judge 및 UI 통합 체크리스트 (2-Stage System)

> **생성일**: 2025-12-22  
> **담당**: 프론트엔드 개발자, UX 디자이너  
> **예상 기간**: 1.5주  
> **선행 조건**: Phase 2 완료 (템플릿 생성 파이프라인 구축)

---

## ⚠️ 영향받을 수 있는 기존 기능

| 기능          | 파일                                     | 영향도 | 확인 방법                 |
| ------------- | ---------------------------------------- | ------ | ------------------------- |
| 에디터 페이지 | `frontend/src/app/editor/page.tsx`       | 고     | UI 레이아웃 변경 확인     |
| 글 평가 API   | `frontend/src/app/api/evaluate/route.ts` | 고     | 신규 Judge 로직 적용 확인 |

---

## 📋 Task 3.1: 2-Stage Judge 로직 구현

### 🎯 목표

Align Judge (판정)와 Upgrade Planner (수정 계획)로 분리된 평가 시스템 구현

### 📁 수정 파일

- **[NEW]** `frontend/src/lib/judge/alignJudge.ts`
- **[NEW]** `frontend/src/lib/judge/upgradePlanner.ts`
- **[NEW]** `frontend/src/lib/judge/types.ts`

### ✅ 체크리스트

- [x] **3.1.1** `JudgeResult` 인터페이스 정의

  ```typescript
  interface JudgeResult {
    criteria_id: string;
    status: "pass" | "fail" | "partial";
    reasoning: string; // 근거 인용
    citation?: string; // 원문 인용
  }
  ```

- [x] **3.1.2** `UpgradePlan` 인터페이스 정의

  ```typescript
  interface UpgradePlan {
    criteria_id: string;
    what: string; // 무엇을
    why: string; // 왜
    how: string; // 어떻게
    example: string; // 수정 예시
  }
  ```

- [x] **3.1.3** `Align Judge` 구현 (Stage 1)

  - 입력: `userText`, `TemplateSchema`
  - 프롬프트: "사용자 글이 이 기준(`criteria`)을 충족하는가? 근거를 들어 O/X/△로 판정해라."
  - 모델: `gemini-1.5-flash` (빠른 판정)

- [x] **3.1.4** `Upgrade Planner` 구현 (Stage 2)
  - 입력: `JudgeResult` (Fail/Partial인 경우), `TemplateSchema`
  - 프롬프트: "이 기준을 충족하지 못한 글을 어떻게 수정해야 하는지 구체적인 계획을 세워라. 템플릿의 `positive_examples`를 참고해라."
  - 모델: `gemini-1.5-pro` (정교한 계획)

### 🔍 Phase 3.1 검증

- [x] 단위 테스트: Align Judge가 명확한 위반 사례를 잘 잡아내는지 확인
- [x] 단위 테스트: Upgrade Planner가 구체적이고 실행 가능한 조언을 주는지 확인

---

## 📋 Task 3.2: 3-Pane Comparison UI 구현

### 🎯 목표

[원본 문서] - [내 글] - [평가/계획]을 한눈에 비교하는 UI

### 📁 수정 파일

- **[NEW]** `frontend/src/components/editor/ThreePaneLayout.tsx`
- **[NEW]** `frontend/src/components/editor/ReferencePanel.tsx`
- **[NEW]** `frontend/src/components/editor/FeedbackPanel.tsx`

### ✅ 체크리스트

- [x] **3.2.1** `ThreePaneLayout` 컴포넌트 구현

  - 좌측: `ReferencePanel` (원본 문서 / 템플릿 뷰어)
  - 중앙: `Editor` (기존 에디터)
  - 우측: `FeedbackPanel` (평가 결과 및 수정 계획)
  - 반응형: 모바일에서는 탭으로 전환

- [x] **3.2.2** `ReferencePanel` 구현

  - 템플릿의 `positive_examples`와 `negative_examples`를 시각적으로 보여줌
  - 원본 문서의 해당 부분 하이라이팅 기능

- [x] **3.2.3** `FeedbackPanel` 구현
  - Accordion UI로 기준별 평가 결과 표시
  - Pass된 항목은 접어두고, Fail/Partial 항목 강조
  - "수정 계획 보기" 버튼으로 Upgrade Plan 확장

### 🔍 Phase 3.2 검증

- [x] 스토리북 또는 페이지에서 레이아웃 깨짐 확인
- [x] 모바일 뷰에서 탭 전환 정상 동작 확인

---

## 📋 Task 3.3: 에디터 페이지 통합

### 🎯 목표

기존 에디터에 v3 기능 통합

### 📁 수정 파일

- **[MODIFY]** `frontend/src/app/editor/page.tsx`
- **[MODIFY]** `frontend/src/store/editorStore.ts`

### ✅ 체크리스트

- [x] **3.3.1** `useV3Mode` 훅 구현

  - Feature Flag (`NEXT_PUBLIC_USE_V3_TEMPLATES`) 확인
  - v3 모드일 때만 3-Pane 레이아웃 활성화

- [x] **3.3.2** 실시간/수동 평가 트리거 연동

  - "평가하기" 버튼 클릭 시 `Align Judge` 실행
  - 결과 수신 후 `FeedbackPanel` 업데이트

- [x] **3.3.3** "수정 제안 적용" 기능 (선택)
  - Upgrade Plan의 예시를 에디터에 바로 적용하는 버튼 (Diff View)

### 🔍 Phase 3.3 검증

- [x] `npm run build` 성공
- [x] 에디터에서 글 작성 -> 평가 -> 피드백 확인 전체 흐름 테스트

---

## ✅ Phase 3 최종 검증

### 자동화 검증

- [x] `npm run build` (frontend) 성공
- [x] `npx vitest run` 전체 테스트 통과

### 사용자 시나리오 테스트

- [x] 템플릿 선택 -> 글 작성 -> 평가 -> 수정 계획 확인 -> 글 수정 -> 재평가 (Pass)

### 품질 체크

- [x] UI/UX: 직관적인 피드백 표시, 복잡하지 않은 레이아웃
- [x] 성능: 평가 속도 (Streaming 적용 고려)
- [x] 접근성: 스크린 리더 지원, 키보드 네비게이션

---

## 🔗 다음 Phase로 연결

Phase 3 완료 후 **Phase 4: 보안, 운영, 기술 부채 통합**으로 진행합니다.
