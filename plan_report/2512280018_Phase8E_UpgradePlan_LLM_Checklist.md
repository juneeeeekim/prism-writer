# Phase 8-E: Upgrade Plan How to Fix 생성 문제 해결 체크리스트

**작성일**: 2025-12-28  
**작성자**: Tech Lead  
**원본 문서**: Implementation Plan (Upgrade Plan How to Fix 생성 문제 분석 보고서)

---

## 1. File & Structure Decision

### 파일 구성 전략

**결정: 2개 파일 수정 (프론트엔드만)**

| 구분          | 파일                       | 역할                                         |
| :------------ | :------------------------- | :------------------------------------------- |
| **FE (수정)** | `EvaluationTab.tsx`        | handleRetryPlan에서 evaluate-single API 호출 |
| **BE (참조)** | `evaluate-single/route.ts` | 이미 runUpgradePlanner 사용 중               |

### 근거

1. **기존 자산 활용**: `runUpgradePlanner`는 이미 LLM 호출 및 JSON 파싱 구현 완료
2. **최소 변경**: change-plan API 수정 대신 evaluate-single API 재활용
3. **일관성**: Phase 8에서 이미 evaluate-single API 구현함

---

## 2. Phase 8-E: Upgrade Plan How to Fix 수정

### Before Start

- **영향받는 기존 파일**:

  - `frontend/src/components/Assistant/EvaluationTab.tsx`
    - `handleRetryPlan` 함수 (Line 271-315)
  - `frontend/src/app/api/rag/evaluate-single/route.ts`
    - 이미 `runUpgradePlanner` 호출 중 (재사용 가능)

- **관련 기존 기능**:
  - FeedbackPanel의 "🔄 재시도" 버튼
  - Upgrade Plan 표시 UI

### Implementation Items

- [ ] **P8E-01**: handleRetryPlan에서 evaluate-single API 호출로 변경

  - `Target`: `EvaluationTab.tsx` handleRetryPlan 함수 (Line 279-288)
  - `Detail`:
    1. `/api/rag/change-plan` 대신 `/api/rag/evaluate-single` 호출
    2. 이미 구현된 `runUpgradePlanner`가 LLM으로 what/why/how/example 생성
    3. 반환된 `upgradePlan` 직접 사용
  - `Dependency`: 없음 (Phase 시작점)
  - `Quality`: result null 체크 유지

- [ ] **P8E-02**: API 응답 파싱 로직 수정
  - `Target`: `EvaluationTab.tsx` handleRetryPlan 함수 (Line 297-309)
  - `Detail`:
    1. `data.upgradePlan` 직접 반환 (evaluate-single 응답 형식)
    2. 기존 fallback 로직 제거 (Mock 데이터 사용 안 함)
  - `Dependency`: P8E-01
  - `Quality`: API 응답 실패 시 null 반환

### Verification (검증)

- [ ] Syntax Check: `npx tsc --noEmit` 통과
- [ ] Functionality Test:
  1. FAIL 항목에서 "🔄 재시도" 클릭
  2. **기대 결과**:
     - What: 구체적인 수정 필요 사항
     - Why: 수정 이유 설명
     - How: **단계별 수정 방법** (핵심!)
     - Example: 수정 예시
  3. "⚡ 자동 수정" 버튼 표시 확인
- [ ] Regression Test:
  - 🔁 재평가 기능 정상 동작
  - 기존 평가 저장/로드 기능 정상

---

## 3. 위험 관리

| ID  | 위험                                         | 영향도 | 완화 방안                                    |
| :-- | :------------------------------------------- | :----: | :------------------------------------------- |
| R1  | evaluate-single API 호출 시 JudgeResult 필요 |   중   | 기존 result.judgments에서 해당 criteria 검색 |
| R2  | TemplateSchema 정보 필요                     |   중   | API가 criteriaId로 자동 검색 (이미 구현됨)   |

---

## 4. 완료 기준

- [ ] 모든 체크리스트 완료
- [ ] `npx tsc --noEmit` 성공
- [ ] "How to Fix"에 실제 수정 방법 표시 테스트 통과

---

## 5. Traceability

| 체크리스트 ID | 원본 문서 참조                                |
| :------------ | :-------------------------------------------- |
| P8E-01        | 해결 방안 옵션 A: 기존 runUpgradePlanner 활용 |
| P8E-02        | 문제 흐름도: EvaluationTab에서 API 응답 처리  |
