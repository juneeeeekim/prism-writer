# Phase 8: 개별 평가 항목 재평가 기능 체크리스트

**작성일**: 2025-12-27  
**작성자**: Tech Lead  
**원본 문서**: `idea_meeting_reevaluate.md` (아이디어 회의 결과)

---

## 1. File & Structure Decision

### 파일 구성 전략

**결정: Backend API 1개 + Frontend 2개 수정**

| 구분          | 파일                                                  | 역할                       |
| :------------ | :---------------------------------------------------- | :------------------------- |
| **BE (신규)** | `frontend/src/app/api/rag/evaluate-single/route.ts`   | 단일 Criteria 평가 API     |
| **FE (수정)** | `frontend/src/components/Editor/FeedbackPanel.tsx`    | 재평가 버튼 UI 추가        |
| **FE (수정)** | `frontend/src/components/Assistant/EvaluationTab.tsx` | handleReevaluate 콜백 구현 |

### 근거

1. **관심사 분리**: BE/FE 각각의 역할에 맞게 분리
2. **재사용성**: 단일 API는 다른 곳에서도 활용 가능
3. **테스트 용이성**: API는 독립적으로 테스트 가능

---

## 2. Phase 8-A: 단일 평가 API 생성

### Before Start

- **영향받는 기존 파일**:
  - `frontend/src/app/api/rag/evaluate/route.ts` (참고용 - 기존 평가 API)
  - `frontend/src/lib/judge/types.ts` (JudgeResult, UpgradePlan 타입)
  - `frontend/src/lib/judge/align-judge.ts` (평가 로직)

### Implementation Items

- [ ] **P8A-01**: 단일 평가 API 라우트 파일 생성

  - `Target`: `frontend/src/app/api/rag/evaluate-single/route.ts` (신규)
  - `Detail`:
    1. POST 핸들러 생성
    2. Request Body: `{ userText: string, criteriaId: string, topK?: number }`
    3. Response: `{ success: boolean, judgment: JudgeResult, upgradePlan: UpgradePlan }`
  - `Dependency`: 없음 (Phase 시작점)
  - `Quality`: 표준 에러 응답 형식 준수 (`{ error, message }`)

- [ ] **P8A-02**: 인증 및 입력 검증 로직

  - `Target`: `route.ts` 상단
  - `Detail`:
    1. Supabase 인증 확인
    2. `userText` 최소 50자 검증
    3. `criteriaId` 필수값 검증
  - `Dependency`: P8A-01
  - `Quality`: 401/400 상태 코드 적절히 반환

- [ ] **P8A-03**: 단일 Criteria 평가 로직 구현

  - `Target`: `route.ts` 핵심 로직
  - `Detail`:
    1. 기존 `align-judge.ts` 로직 참고
    2. 단일 criteria에 대해서만 LLM 호출
    3. JudgeResult + UpgradePlan 생성
  - `Dependency`: P8A-02
  - `Quality`: LLM 타임아웃 30초 설정

- [ ] **P8A-04**: 응답 형식 정의 및 반환
  - `Target`: `route.ts` 응답부
  - `Detail`:
    ```typescript
    return NextResponse.json({
      success: true,
      judgment: { criteria_id, status, reasoning, citation },
      upgradePlan: { criteria_id, what, why, how, example },
    });
    ```
  - `Dependency`: P8A-03
  - `Quality`: 타입 일관성 유지 (기존 EvaluationResult 구조와 호환)

### Verification (검증)

- [ ] Syntax Check: `npx tsc --noEmit` 통과
- [ ] Functionality Test:
  - Postman/curl로 API 호출
  - 입력: 샘플 텍스트 + criteriaId
  - 기대 결과: judgment.status가 'pass'|'partial'|'fail' 중 하나
- [ ] Error Test: criteriaId 누락 시 400 반환 확인

---

## 3. Phase 8-B: 프론트엔드 재평가 버튼

### Before Start

- **영향받는 기존 파일**:
  - `frontend/src/components/Editor/FeedbackPanel.tsx` (FeedbackItem 컴포넌트)
  - `frontend/src/components/Assistant/EvaluationTab.tsx` (handleRetryPlan 이미 존재)

### Implementation Items

- [ ] **P8B-01**: FeedbackPanelProps에 onReevaluate 추가

  - `Target`: `FeedbackPanel.tsx` (Line 8-14)
  - `Detail`:
    ```typescript
    interface FeedbackPanelProps {
      // ... 기존 props
      onReevaluate?: (criteriaId: string) => Promise<{
        judgment: JudgeResult;
        upgradePlan: UpgradePlan;
      } | null>;
    }
    ```
  - `Dependency`: P8A-04 완료 후
  - `Quality`: 기존 onRetryPlan과 혼동 방지 위해 명확한 네이밍

- [ ] **P8B-02**: FeedbackItem에 onReevaluate prop 전달

  - `Target`: `FeedbackPanel.tsx` (Line 89-96)
  - `Detail`: `<FeedbackItem onReevaluate={onReevaluate} ... />`
  - `Dependency`: P8B-01
  - `Quality`: props drilling 최소화

- [ ] **P8B-03**: FeedbackItem 내 재평가 상태 추가

  - `Target`: `FeedbackPanel.tsx` FeedbackItem 컴포넌트
  - `Detail`:
    ```typescript
    const [isReevaluating, setIsReevaluating] = useState(false);
    const [localJudgment, setLocalJudgment] = useState(judge);
    const [localPlan, setLocalPlan] = useState(initialPlan);
    ```
  - `Dependency`: P8B-02
  - `Quality`: 로컬 상태로 관리하여 부분 업데이트 지원

- [ ] **P8B-04**: handleReevaluate 함수 구현

  - `Target`: `FeedbackPanel.tsx` FeedbackItem 내부
  - `Detail`:
    ```typescript
    const handleReevaluate = async () => {
      if (!onReevaluate || isReevaluating) return;
      setIsReevaluating(true);
      try {
        const result = await onReevaluate(judge.criteria_id);
        if (result) {
          setLocalJudgment(result.judgment);
          setLocalPlan(result.upgradePlan);
        }
      } finally {
        setIsReevaluating(false);
      }
    };
    ```
  - `Dependency`: P8B-03
  - `Quality`: try-finally로 로딩 상태 보장

- [ ] **P8B-05**: 재평가 버튼 UI 추가

  - `Target`: `FeedbackPanel.tsx` Upgrade Plan 헤더 영역 (Line 222-262)
  - `Detail`:
    1. 기존 "🔄 재시도" 버튼 옆에 "🔁 재평가" 버튼 추가
    2. 파란색(blue) 스타일로 구분
    3. 로딩 시 스피너 표시
  - `Dependency`: P8B-04
  - `Quality`: aria-label="이 항목 재평가" 추가

- [ ] **P8B-06**: 카드 색상 동적 업데이트
  - `Target`: `FeedbackPanel.tsx` statusColors 사용 부분
  - `Detail`: `localJudgment.status` 기반으로 색상 결정
  - `Dependency`: P8B-05
  - `Quality`: 애니메이션 transition 적용 (0.3s)

### Verification (검증)

- [ ] Syntax Check: `npx tsc --noEmit` 통과
- [ ] Functionality Test:
  - PARTIAL 카드에서 "🔁 재평가" 클릭
  - 기대 결과: 로딩 후 카드가 PASS(초록) 또는 FAIL(빨강)로 변경
- [ ] Regression Test: 기존 "⚡ 자동 수정" 기능 정상 동작 확인

---

## 4. Phase 8-C: EvaluationTab 콜백 연동

### Before Start

- **영향받는 기존 파일**:
  - `frontend/src/components/Assistant/EvaluationTab.tsx` (handleRetryPlan 이미 존재)

### Implementation Items

- [ ] **P8C-01**: handleReevaluate 콜백 함수 생성

  - `Target`: `EvaluationTab.tsx` (handleRetryPlan 아래)
  - `Detail`:
    ```typescript
    const handleReevaluate = useCallback(
      async (criteriaId: string) => {
        const res = await fetch("/api/rag/evaluate-single", {
          method: "POST",
          headers: getApiHeaders(),
          body: JSON.stringify({
            userText: content,
            criteriaId,
            topK: 5,
          }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) return null;
        return { judgment: data.judgment, upgradePlan: data.upgradePlan };
      },
      [content]
    );
    ```
  - `Dependency`: P8A-04, P8B-06
  - `Quality`: useCallback 의존성 배열 정확히 지정

- [ ] **P8C-02**: FeedbackPanel에 onReevaluate prop 전달

  - `Target`: `EvaluationTab.tsx` (Line 370-376)
  - `Detail`:
    ```tsx
    <FeedbackPanel
      evaluation={result}
      isLoading={isLoading}
      onEvaluate={handleEvaluate}
      onApplyPlan={handleApplyPlan}
      onRetryPlan={handleRetryPlan}
      onReevaluate={handleReevaluate} // 추가
    />
    ```
  - `Dependency`: P8C-01
  - `Quality`: prop 순서 일관성 유지

- [ ] **P8C-03**: 전체 점수 재계산 로직 (선택)
  - `Target`: `EvaluationTab.tsx` 또는 `FeedbackPanel.tsx`
  - `Detail`:
    1. 개별 항목 상태 변경 시 overall_score 재계산
    2. 수식: `(pass_count * 100 + partial_count * 50) / total_count`
    3. [확인 필요: 기존 점수 계산 로직과 일치하는지 검증]
  - `Dependency`: P8C-02
  - `Quality`: 점수 표시 헤더 실시간 업데이트

### Verification (검증)

- [ ] Syntax Check: `npm run build` 성공
- [ ] E2E Test:
  1. 글 작성 → 평가 실행
  2. PARTIAL 항목 "🔁 재평가" 클릭
  3. 기대 결과: 카드 상태/색상 변경, 점수 갱신
- [ ] Regression Test: 평가 저장/로드 기능 정상 확인

---

## 5. 리스크 관리

| ID  | 리스크          | 영향도 | 완화 방안                             |
| :-- | :-------------- | :----: | :------------------------------------ |
| R1  | LLM 응답 불일치 |   중   | 동일 criteria_id 반환 강제            |
| R2  | 반복 호출 비용  |   중   | 30초 쿨다운 (P8B-04에서 구현)         |
| R3  | 상태 불일치     |   하   | 로컬 상태 우선, 새로고침 시 DB 동기화 |

---

## 6. 완료 기준

- [ ] 모든 Phase 체크리스트 완료
- [ ] `npm run build` 성공
- [ ] PARTIAL → PASS 전환 시나리오 테스트 통과
- [ ] 기존 평가/저장 기능 회귀 없음

---

## 7. Traceability

| 체크리스트 ID | 원본 문서 참조                   |
| :------------ | :------------------------------- |
| P8A-01~04     | 아이디어 B: 단일 API 신규 생성   |
| P8B-01~06     | 아이디어 D: 클라이언트 부분 병합 |
| P8C-01~03     | 최종 방향성: B + D 조합          |
