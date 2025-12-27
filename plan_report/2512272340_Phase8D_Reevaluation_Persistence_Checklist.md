# Phase 8-D: 재평가 결과 영속성 체크리스트

**작성일**: 2025-12-27  
**작성자**: Tech Lead  
**원본 문서**: `implementation_plan.md` (재평가 결과 영속성 문제 해결)

---

## 1. File & Structure Decision

### 파일 구성 전략

**결정: 기존 파일 1개 수정만 필요**

| 구분          | 파일                                                  | 역할                                              |
| :------------ | :---------------------------------------------------- | :------------------------------------------------ |
| **FE (수정)** | `frontend/src/components/Assistant/EvaluationTab.tsx` | handleReevaluate에 result 업데이트 + DB 저장 추가 |

### 근거

1. **최소 변경**: FeedbackPanel은 이미 로컬 상태 관리, EvaluationTab에서만 영속성 처리 추가
2. **관심사 분리**: DB 저장은 EvaluationTab의 책임 (saveEvaluation 함수 이미 존재)

---

## 2. Phase 8-D: 재평가 결과 영속성

### Before Start

- **영향받는 기존 파일**:
  - `frontend/src/components/Assistant/EvaluationTab.tsx`
    - `handleReevaluate` 함수 (Line 320-356)
    - `saveEvaluation` 함수 (Line 120-138)
    - `result` 상태 (Line 69)

### Implementation Items

- [ ] **P8D-01**: handleReevaluate에서 result 상태 업데이트

  - `Target`: `EvaluationTab.tsx` handleReevaluate 함수 (Line 345-350)
  - `Detail`:
    1. API 응답 성공 후, `setResult`로 result 상태 업데이트
    2. `result.judgments` 배열에서 해당 criteriaId 항목 교체
    3. `result.upgrade_plans` 배열에서 해당 upgradePlan 교체/추가
    4. `overall_score` 재계산: `(pass*100 + partial*50) / total`
  - `Dependency`: 없음 (Phase 시작점)
  - `Quality`: 기존 result가 없으면 업데이트 스킵

- [ ] **P8D-02**: result 업데이트 후 saveEvaluation 호출
  - `Target`: `EvaluationTab.tsx` handleReevaluate 함수 내부
  - `Detail`:
    1. `setResult` 호출 후 `saveEvaluation` 호출
    2. 변경된 result와 현재 content를 전달
    3. 저장 성공 시 `setIsSaved(true)` 호출
  - `Dependency`: P8D-01
  - `Quality`: try-catch로 저장 실패 시 콘솔 로그 (사용자 경험 방해 금지)

### Verification (검증)

- [ ] Syntax Check: `npx tsc --noEmit` 통과
- [ ] Functionality Test:
  1. 평가 실행 후 PARTIAL 항목에서 🔁 재평가 클릭
  2. 재평가 성공 확인 (카드 색상 변경)
  3. 페이지 새로고침 (F5)
  4. **기대 결과**: 재평가된 상태(PASS/FAIL)가 유지됨
- [ ] Regression Test: 기존 평가 저장/로드 기능 정상 동작 확인

---

## 3. 위험 관리

| ID  | 위험                      | 영향도 | 완화 방안                          |
| :-- | :------------------------ | :----: | :--------------------------------- |
| R1  | overall_score 계산 불일치 |   중   | 기존 평가 API와 동일한 수식 사용   |
| R2  | 저장 실패 시 상태 불일치  |   하   | 로컬 상태는 유지, 콘솔 로그만 출력 |

---

## 4. 완료 기준

- [ ] 모든 체크리스트 완료
- [ ] `npx tsc --noEmit` 성공
- [ ] 새로고침 후 재평가 결과 유지 테스트 통과

---

## 5. Traceability

| 체크리스트 ID | 원본 문서 참조                  |
| :------------ | :------------------------------ |
| P8D-01        | 구현 항목: result 상태 업데이트 |
| P8D-02        | 구현 항목: saveEvaluation 호출  |
