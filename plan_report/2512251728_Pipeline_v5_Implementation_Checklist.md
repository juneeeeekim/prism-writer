# <!--

# Pipeline v5 구현 체크리스트 - Cursor식 Human-in-the-loop 적용

파일명: 2512251728_Pipeline_v5_Implementation_Checklist.md
버전: v5.0.0 (계획)
생성일: 2025-12-25
최종 수정일: 2025-12-25

선행 조건: Pipeline v4 + Gemini 3 Flash 안정화 완료 필요
참고 문서: 2512251659_rag시스템업글.md

=============================================================================
📁 체크리스트 파일 구성 결정
=============================================================================

[결정]: 단일 파일 (1개)

[근거]:

1. 협업 효율: 모든 개발자가 하나의 문서에서 진행 상황 파악 가능
2. 의존성 추적: Phase 간 연결성이 높아 분리 시 누락 위험
3. 검증 용이: 전체 맥락에서 검증 가능
4. 유지보수: 한 곳에서 관리

# [구조]: Phase 1-6으로 나누어 독립적 검증 가능하도록 구성

-->

# Pipeline v5 구현 체크리스트

> **버전**: v5.0.0 (계획)
>
> **현재 상태**: ⏳ 대기 - Pipeline v4 안정화 후 진행
>
> **예상 기간**: 3-4주
>
> **참고 모델**: Cursor AI (Human-in-the-loop + Shadow Workspace)

---

## 📋 Phase 개요

| Phase | 이름                     | 담당                  | 예상 기간 | 의존성     |
| ----- | ------------------------ | --------------------- | --------- | ---------- |
| **1** | Backend: Patch 시스템    | 시니어/LLM 개발자     | 1주       | -          |
| **2** | Search: 듀얼 인덱스      | IR 엔지니어           | 3일       | Phase 1    |
| **3** | LLM: Change Plan 생성    | LLM/프롬프트 엔지니어 | 1주       | Phase 1, 2 |
| **4** | UI: 3패널 + Apply/Reject | UX/UI 개발자          | 1주       | Phase 3    |
| **5** | Gates: 안전 검증         | Eval/QA 리드          | 3일       | Phase 3, 4 |
| **6** | Ops: 캐싱 + 최적화       | SRE/MLOps             | 3일       | Phase 5    |

---

## 🎯 품질 기준 (모든 Phase 공통)

- [ ] 코딩 스타일 일치 여부 (ESLint/Prettier)
- [ ] 명확한 함수명/변수명 (camelCase, 의미 있는 이름)
- [ ] 에러 처리 존재 여부 (try-catch, 사용자 피드백)
- [ ] 성능 이슈 없음 (과도한 반복문 등)
- [ ] 접근성 고려 (aria-label 등)

---

# Phase 1: Backend - Patch 시스템 구현

## 📌 영향받을 수 있는 기존 기능

| 기능             | 파일                   | 영향             |
| ---------------- | ---------------------- | ---------------- |
| 기존 평가 시스템 | `templateGates.ts`     | 호환성 유지 필요 |
| 검색 시스템      | `search.ts`            | 인터페이스 확장  |
| 평가 결과 표시   | `EvaluationResult.tsx` | UI 확장 필요     |

---

## 1.1 Patch 타입 정의

- [ ] **파일**: `frontend/src/lib/rag/types/patch.ts` (신규)
- [ ] **내용**: Patch 인터페이스 정의
  ```typescript
  interface Patch {
    id: string;
    type: "Replace" | "Insert" | "Move" | "Delete";
    targetRange: { start: number; end: number };
    before: string;
    after: string;
    reason: string;
    citationId: string;
    expectedDelta: AlignmentDelta;
  }
  ```
- [ ] **품질 체크**:
  - [ ] 타입 명확성
  - [ ] JSDoc 주석 포함
  - [ ] export 구문 확인

---

## 1.2 Change Plan 타입 정의

- [ ] **파일**: `frontend/src/lib/rag/types/changePlan.ts` (신규)
- [ ] **연결**: Patch 타입 import
- [ ] **내용**: Change Plan 인터페이스 정의
  ```typescript
  interface ChangePlan {
    patches: Patch[];
    expectedAlignmentDelta: AlignmentDelta;
    gapTop3: GapItem[];
    timestamp: string;
  }
  ```

---

## 1.3 Patch Generator 함수 구현

- [ ] **파일**: `frontend/src/lib/rag/patchGenerator.ts` (신규)
- [ ] **연결**: types/patch.ts, types/changePlan.ts import
- [ ] **함수**: `generatePatches(content: string, gaps: GapItem[], template: Template): Promise<Patch[]>`
- [ ] **품질 체크**:
  - [ ] 에러 처리 존재
  - [ ] 최대 3개 패치로 제한
  - [ ] 각 패치에 citation 연결

---

## 1.4 Shadow Workspace 시뮬레이터 구현

- [ ] **파일**: `frontend/src/lib/rag/shadowWorkspace.ts` (신규)
- [ ] **연결**: patchGenerator.ts에서 호출
- [ ] **함수**: `simulatePatchEffect(content: string, patch: Patch): Promise<SimulationResult>`
- [ ] **내용**:
  - [ ] 패치 적용 시 예상 부합도 변화 계산
  - [ ] 변경 전/후 diff 생성
  - [ ] 예상 점수 반환

---

## Phase 1 검증

### Syntax 검증

```bash
cd frontend && npx tsc --noEmit
```

- [ ] TypeScript 오류 0개 확인

### 단위 테스트

- [ ] `__tests__/patchGenerator.test.ts` 작성
- [ ] `__tests__/shadowWorkspace.test.ts` 작성
- [ ] 테스트 통과 확인

### 기존 기능 동작 확인

- [ ] 기존 평가 시스템 정상 동작
- [ ] 기존 검색 시스템 정상 동작
- [ ] 빌드 성공

---

# Phase 2: Search - 듀얼 인덱스 구현

## 📌 영향받을 수 있는 기존 기능

| 기능           | 파일          | 영향            |
| -------------- | ------------- | --------------- |
| fullTextSearch | `search.ts`   | 확장 필요       |
| hybridSearch   | `search.ts`   | 확장 필요       |
| chunking       | `chunking.ts` | chunk_type 활용 |

---

## 2.1 Rule Index 검색 함수

- [ ] **파일**: `frontend/src/lib/rag/search.ts` (수정)
- [ ] **함수**: `searchRuleIndex(query: string, options: SearchOptions): Promise<SearchResult[]>`
- [ ] **내용**:
  - [ ] chunk_type = 'rule' 필터
  - [ ] TopK=10 자동 검색
  - [ ] Pin 가능 결과 반환

---

## 2.2 Example Index 검색 함수

- [ ] **파일**: `frontend/src/lib/rag/search.ts` (수정)
- [ ] **함수**: `searchExampleIndex(query: string, options: SearchOptions): Promise<SearchResult[]>`
- [ ] **내용**:
  - [ ] chunk_type = 'example' 필터
  - [ ] 예시 특화 리랭킹 적용

---

## 2.3 Criteria Pack 자동 구성

- [ ] **파일**: `frontend/src/lib/rag/criteriaPack.ts` (신규)
- [ ] **연결**: searchRuleIndex, searchExampleIndex 호출
- [ ] **함수**: `buildCriteriaPack(content: string, userId: string): Promise<CriteriaPack>`
- [ ] **내용**:
  - [ ] 규칙 10개 + 예시 5개 자동 구성
  - [ ] 사용자 Pin/Unpin 상태 반영

---

## Phase 2 검증

### Syntax 검증

```bash
cd frontend && npx tsc --noEmit
```

- [ ] TypeScript 오류 0개 확인

### 통합 테스트

- [ ] 규칙 검색 결과 반환 확인
- [ ] 예시 검색 결과 반환 확인
- [ ] CriteriaPack 생성 확인

### 기존 기능 동작 확인

- [ ] 기존 hybridSearch 정상 동작
- [ ] 기존 fullTextSearch 정상 동작

---

# Phase 3: LLM - Change Plan 생성

## 📌 영향받을 수 있는 기존 기능

| 기능          | 파일               | 영향        |
| ------------- | ------------------ | ----------- |
| templateGates | `templateGates.ts` | 호환성 유지 |
| ruleMiner     | `ruleMiner.ts`     | 확장 가능   |
| exampleMiner  | `exampleMiner.ts`  | 확장 가능   |

---

## 3.1 Patch 생성 프롬프트 작성

- [ ] **파일**: `frontend/src/lib/rag/prompts/patchGeneration.ts` (신규)
- [ ] **내용**:
  - [ ] 시스템 프롬프트: Patch-only 출력 강제
  - [ ] 출력 형식: JSON (patches[])
  - [ ] 근거 인용 강제 지시

---

## 3.2 Change Plan API 구현

- [ ] **파일**: `frontend/src/app/api/rag/change-plan/route.ts` (신규)
- [ ] **연결**: patchGenerator, criteriaPack, shadowWorkspace 호출
- [ ] **API**: `POST /api/rag/change-plan`
- [ ] **응답**:
  ```json
  {
    "patches": [...],
    "expectedAlignmentDelta": {...},
    "gapTop3": [...]
  }
  ```

---

## 3.3 Gap Top3 추출 로직

- [ ] **파일**: `frontend/src/lib/rag/gapAnalyzer.ts` (신규)
- [ ] **함수**: `extractGapTop3(evaluationResult: EvaluationResult): GapItem[]`
- [ ] **내용**:
  - [ ] 부합도 가장 낮은 3개 축 추출
  - [ ] 각 축별 개선 제안 연결

---

## Phase 3 검증

### Syntax 검증

```bash
cd frontend && npx tsc --noEmit
```

- [ ] TypeScript 오류 0개 확인

### API 테스트

- [ ] `/api/rag/change-plan` 엔드포인트 응답 확인
- [ ] JSON 형식 검증
- [ ] Patch 3개 이하 확인

### LLM 응답 품질

- [ ] 근거 인용 포함 확인
- [ ] Patch 형식 준수 확인

---

# Phase 4: UI - 3패널 + Apply/Reject

## 📌 영향받을 수 있는 기존 기능

| 기능            | 파일                   | 영향      |
| --------------- | ---------------------- | --------- |
| 에디터 레이아웃 | `EditorPage.tsx`       | 패널 확장 |
| 평가 결과       | `EvaluationResult.tsx` | 리디자인  |
| 평가 탭         | `EvaluationTab.tsx`    | 확장      |

---

## 4.1 3패널 레이아웃 구현

- [ ] **파일**: `frontend/src/components/Editor/ThreePanelLayout.tsx` (신규)
- [ ] **구조**:
  1. 내 글 (편집기)
  2. 부합도 프로필 (축별 Fit/Gap)
  3. 제안 카드 (패치 단위)
- [ ] **접근성**:
  - [ ] aria-label 추가
  - [ ] 키보드 탐색 지원

---

## 4.2 제안 카드 컴포넌트

- [ ] **파일**: `frontend/src/components/Editor/PatchCard.tsx` (신규)
- [ ] **연결**: ThreePanelLayout에서 사용
- [ ] **UI 요소**:
  - [ ] 변경 내용 하이라이트
  - [ ] 근거 링크
  - [ ] 예상 변화 표시
  - [ ] Apply 버튼 (Tab 단축키)
  - [ ] Reject 버튼

---

## 4.3 Apply/Reject 핸들러

- [ ] **파일**: `frontend/src/hooks/usePatchActions.ts` (신규)
- [ ] **연결**: PatchCard에서 호출
- [ ] **함수**:
  - [ ] `applyPatch(patchId: string): void`
  - [ ] `rejectPatch(patchId: string): void`
  - [ ] `applyAllPatches(): void`
- [ ] **키보드 단축키**:
  - [ ] Tab = Apply
  - [ ] Shift+Tab = Undo

---

## 4.4 부합도 프로필 시각화

- [ ] **파일**: `frontend/src/components/Editor/AlignmentProfile.tsx` (신규)
- [ ] **연결**: ThreePanelLayout에서 사용
- [ ] **UI 요소**:
  - [ ] 축별 막대그래프
  - [ ] Fit/Gap 색상 구분
  - [ ] 예상 변화 애니메이션

---

## Phase 4 검증

### Syntax 검증

```bash
cd frontend && npx tsc --noEmit
```

- [ ] TypeScript 오류 0개 확인

### 브라우저 테스트

- [ ] 3패널 레이아웃 렌더링 확인
- [ ] 제안 카드 표시 확인
- [ ] Apply 버튼 클릭 동작 확인
- [ ] Reject 버튼 클릭 동작 확인
- [ ] Tab 키 단축키 동작 확인

### 접근성 테스트

- [ ] 스크린 리더 테스트
- [ ] 키보드 탐색 테스트

### 기존 기능 동작 확인

- [ ] 기존 에디터 기능 정상 동작
- [ ] 기존 평가 요청 정상 동작

---

# Phase 5: Gates - 안전 검증

## 📌 영향받을 수 있는 기존 기능

| 기능          | 파일               | 영향 |
| ------------- | ------------------ | ---- |
| citationGate  | `citationGate.ts`  | 확장 |
| templateGates | `templateGates.ts` | 확장 |

---

## 5.1 Diff Safety Gate 구현

- [ ] **파일**: `frontend/src/lib/rag/gates/diffSafetyGate.ts` (신규)
- [ ] **함수**: `validateDiffSafety(original: string, patched: string): GateResult`
- [ ] **기준**: 변경량 > 20% 시 경고

---

## 5.2 Upgrade Effect Gate 구현

- [ ] **파일**: `frontend/src/lib/rag/gates/upgradeEffectGate.ts` (신규)
- [ ] **함수**: `validateUpgradeEffect(patch: Patch, simulation: SimulationResult): GateResult`
- [ ] **기준**: 부합도 개선 없으면 "효과 없음" 표시

---

## 5.3 Gate 통합

- [ ] **파일**: `frontend/src/lib/rag/patchGates.ts` (신규)
- [ ] **함수**: `validateAllPatchGates(patch: Patch, context: PatchContext): AllGatesResult`
- [ ] **게이트 순서**:
  1. Citation Gate (기존)
  2. Diff Safety Gate (신규)
  3. Upgrade Effect Gate (신규)

---

## Phase 5 검증

### Syntax 검증

```bash
cd frontend && npx tsc --noEmit
```

- [ ] TypeScript 오류 0개 확인

### 게이트 테스트

- [ ] Diff Safety 경고 동작 확인
- [ ] Upgrade Effect 필터 동작 확인
- [ ] Citation 검증 동작 확인

---

# Phase 6: Ops - 캐싱 + 최적화

## 📌 영향받을 수 있는 기존 기능

| 기능      | 파일               | 영향      |
| --------- | ------------------ | --------- |
| 검색 캐시 | -                  | 신규 구현 |
| 평가 성능 | `templateGates.ts` | 최적화    |

---

## 6.1 Criteria Pack 캐싱

- [ ] **파일**: `frontend/src/lib/rag/cache/criteriaPackCache.ts` (신규)
- [ ] **내용**:
  - [ ] 문서별 CriteriaPack 캐시
  - [ ] TTL 설정 (5분)
  - [ ] 수동 무효화 함수

---

## 6.2 부분 재평가 구현

- [ ] **파일**: `frontend/src/lib/rag/partialEvaluator.ts` (신규)
- [ ] **함수**: `evaluateAffectedAxes(patch: Patch, currentResult: EvaluationResult): PartialResult`
- [ ] **내용**:
  - [ ] 패치 영향받는 축만 재평가
  - [ ] 비용 절감

---

## Phase 6 검증

### Syntax 검증

```bash
cd frontend && npx tsc --noEmit
```

- [ ] TypeScript 오류 0개 확인

### 성능 테스트

- [ ] 캐시 히트율 확인
- [ ] 부분 평가 시간 측정
- [ ] 전체 응답 시간 < 3초 확인

### 비용 확인

- [ ] LLM 호출 횟수 최적화 확인
- [ ] 예상 월간 비용 계산

---

# 🏁 최종 검증

## E2E 테스트

- [ ] 글 입력 → 평가 → Gap 표시 플로우
- [ ] 패치 제안 → Apply → 반영 플로우
- [ ] 패치 제안 → Reject → 삭제 플로우
- [ ] Tab 키로 빠른 적용 플로우

## 성능 기준

- [ ] 평가 응답 시간 < 5초
- [ ] 패치 생성 시간 < 3초
- [ ] UI 렌더링 FCP < 2초

## 보안 체크

- [ ] 사용자 텍스트 마스킹 옵션
- [ ] 로그 최소화 확인
- [ ] RLS 정책 적용 확인

---

## 📦 배포 체크리스트

- [ ] 모든 Phase 검증 완료
- [ ] TypeScript 빌드 성공
- [ ] 단위 테스트 통과
- [ ] E2E 테스트 통과
- [ ] Git Tag 생성 (`v5.0.0-shadow-workspace`)
- [ ] Vercel 배포 성공

---

## 📋 변경 이력

| 날짜       | 버전   | 변경 내용            |
| ---------- | ------ | -------------------- |
| 2025-12-25 | v5.0.0 | 초기 체크리스트 작성 |
