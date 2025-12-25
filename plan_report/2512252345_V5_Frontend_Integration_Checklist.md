# Pipeline v5 프론트엔드 통합 체크리스트

**작성일**: 2025-12-25
**작성자**: PrismLM Dev Team
**목표**: `EvaluationTab` 컴포넌트를 v5 호환 `FeedbackPanel`로 교체하여 사용자에게 "구체적 수정 제안(Upgrade Plan)" 기능을 제공합니다.

---

## 📂 파일 구성 및 전략

**선택한 구성**: **단일 파일 (Single File)**
**근거**:

1. **작업 범위 집중**: 변경 사항이 `EvaluationTab.tsx`와 `FeedbackPanel.tsx` 간의 통합에 집중되어 있어, 문서를 분리하면 컨텍스트 파편화가 발생할 수 있습니다.
2. **협업 효율성**: 개발(기능 구현)과 디자인(UI 확인)이 긴밀하게 연결된 작업이므로, 한 문서에서 흐름을 따라가는 것이 오해를 줄이고 피드백 루프를 단축시킵니다.
3. **유지보수**: 작업 완료 후 하나의 "구현 명세서"로 활용하기 좋습니다.

---

## Phase 1: 사전 분석 및 타입 호환성 점검 (Analysis)

이 단계는 작업을 시작하기 전에 데이터 구조의 일치 여부를 확인함으로써 런타임 에러를 방지합니다.

### 1-1. 데이터 모델 확인

- [x] **백엔드 응답 구조 확인** (`/api/rag/evaluate/route.ts`)
  - [x] `v3Result` 필드 존재 여부 확인 (Line 115)
  - [x] `ENABLE_PIPELINE_V5` 플래그 활성화 확인
- [x] **프론트엔드 타입 정의 확인**
  - [x] Legacy: `EvaluationResult` in `lib/llm/parser.ts`
  - [x] V5: `EvaluationResult` in `lib/judge/types.ts`
  - [x] **[연결성]** 두 타입 간의 주요 차이점(필드명 등)을 파악하고, `FeedbackPanel`이 요구하는 필수 필드(`upgrade_plans`)가 API 응답에 포함되는지 확인.

### 1-2. 기존 기능 영향 분석

- [x] **2-Panel 모드 영향**
  - [x] `EvaluationTab`이 현재 `EvaluationResult` 컴포넌트(Legacy)를 사용 중임을 확인.
  - [x] **[영향]** 교체 시 기존의 "통과/실패" 단순 뷰는 사라지고, 3-Panel 스타일의 상세 뷰로 변경됨을 인지.

---

## Phase 2: 컴포넌트 교체 및 통합 구현 (Implementation)

실제 코드를 수정하여 기능을 통합합니다.

### 2-1. EvaluationTab.tsx 수정

**대상 파일**: `frontend/src/components/Assistant/EvaluationTab.tsx`

- [x] **Import 문 수정** (Line 9-15)
  - [x] `EvaluationResult` (Legacy) 제거
  - [x] `FeedbackPanel` (V5) 추가: `import FeedbackPanel from '@/components/Editor/FeedbackPanel'`
  - [x] 타입 Import 변경: `import type { EvaluationResult as V5EvaluationResult } from '@/lib/judge/types'`
- [x] **State 타입 변경** (Line 31)
  - [x] `useState<V5EvaluationResult | null>(null)`로 변경하여 v5 데이터 수용.
- [x] **API 응답 처리 로직 개선** (Line 78)
  - [x] **[연결성]** API 호출 후 `data.v3Result`를 우선적으로 확인하는 로직 추가.
  - [x] `setResult(data.v3Result)` 호출.
  - [x] `EvaluationTab` 내부의 자체 헤더/버튼을 `FeedbackPanel` 위임 여부 결정 (결정: `FeedbackPanel`에 위임하되 컨테이너 역할 유지).

### 2-2. 렌더링 로직 통합

**대상 파일**: `frontend/src/components/Assistant/EvaluationTab.tsx`

- [x] **JSX 구조 변경** (Line 104~)
  - [x] 기존 `EvaluationResult` 컴포넌트를 `FeedbackPanel`로 교체.
  - [x] **[Props 전달]** `evaluation={result}`, `isLoading={isLoading}`, `onEvaluate={handleEvaluate}` 전달.
  - [x] 에러 메시지(`error` state) 표시 영역 유지 (사용자 피드백 보장).

**Phase 2 검증**:

- [ ] **구문 오류**: `npm run lint` 또는 편집기 내 에러 없음 확인.
- [ ] **빌드 테스트**: `npm run build` 성공 확인.

---

## Phase 3: UI/UX 최적화 및 스타일 조정 (Refinement)

2-Panel 컨텍스트(좁은 폭 등)에서 v5 UI가 어색하지 않은지 확인합니다.

### 3-1. 레이아웃 적합성

**대상 파일**: `frontend/src/components/Editor/FeedbackPanel.tsx`

- [ ] **헤더 중복 제거 검토**
  - [ ] `EvaluationTab`의 "글 평가" 헤더와 `FeedbackPanel` 내부의 "피드백" 헤더가 중복되는지 시각적 확인.
  - [ ] 필요 시 `EvaluationTab`의 헤더를 제거하거나 `FeedbackPanel`에 `hideHeader` prop 추가 고려 (현재는 `EvaluationTab`이 컨테이너 역할만 수행).
- [ ] **반응형 대응**
  - [ ] 사이드바 폭을 줄였을 때(300px 이하) `FeedbackPanel`의 내용이 깨지지 않는지 확인.
  - [ ] **[접근성]** 글자 크기가 가독성을 유지하는지 확인.

### 3-2. 로딩 및 에러 상태 (UX)

- [ ] **로딩 인디케이터**
  - [ ] 평가 중일 때 `FeedbackPanel`의 로딩 상태가 명확한지 확인 (기존 `isLoading` prop 활용).
- [ ] **에러 피드백**
  - [ ] API 실패 시 `EvaluationTab` 상단에 붉은색 에러 배너가 잘 보이는지 확인.

---

## Phase 4: 최종 통합 테스트 (Verification)

모든 기능이 유기적으로 작동하는지 최종 확인합니다.

### 4-1. 기능 테스트 시나리오

1. **초기 진입**:
   - [ ] 평가 탭 클릭 시 "평가 결과가 없습니다" (또는 초기 안내) 화면 표시.
   - [ ] "평가하기" 버튼 활성화 상태 확인.
2. **평가 실행**:
   - [ ] 에디터에 50자 이상 작성 후 버튼 클릭.
   - [ ] 로딩 스피너 표시 확인.
   - [ ] 콘솔에 API 호출 로그 확인 (`[EvaluationTab] API Response`).
3. **결과 확인**:
   - [ ] **점수 표시**: 종합 점수가 상단에 표시됨.
   - [ ] **피드백 항목**: 각 항목(카드)별로 '통과/보완필요/미충족' 뱃지 확인.
   - [ ] **Upgrade Plan**: 카드를 펼쳤을 때 "개선 방향(What/Why/How)" 텍스트가 보이는지 확인. **(핵심 목표)**
4. **재평가 및 리셋**:
   - [ ] 글 수정 후 다시 평가하기 클릭 시 새로운 결과로 갱신됨.

### 4-2. 품질 체크리스트

- [ ] **코딩 스타일**: 불필요한 console.log 제거 (프로덕션 배포 시).
- [ ] **접근성**: 버튼 및 입력 필드에 `aria-label`이 적절한지 점검.
- [ ] **성능**: 렌더링 시 불필요한 리렌더링이 발생하지 않는지 React DevTools로 확인.

---

## 🚀 배포 준비

- [x] 변경 사항 Git Commit (`feat(frontend): EvaluationTab에 v5 FeedbackPanel 통합`)
- [x] Main 브랜치 Push
- [x] Vercel 배포 상태 확인
