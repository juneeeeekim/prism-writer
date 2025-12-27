# Phase 8-E JeDebug 검토 결과

**검토일**: 2025-12-28 00:20  
**검토자**: Senior Lead Developer (JeDebug)  
**대상 문서**: `2512280018_Phase8E_UpgradePlan_LLM_Checklist.md`

---

## 1) 🔧 로직 및 구현 보완 (Logic Fixes)

### Critical Issues

- [ ] **(Critical) P8E-01: "재시도" vs "재평가" 기능 혼동**

  - [ ] 원인:
    - `handleRetryPlan` = "🔄 재시도" 버튼 (오류난 Upgrade Plan 재생성)
    - `handleReevaluate` = "🔁 재평가" 버튼 (평가 자체 다시 실행)
    - 체크리스트에서 **재시도**를 **재평가** API(`evaluate-single`)로 대체하려 함
    - 하지만 두 기능의 목적이 다름!
  - [ ] **수정 제안**: 두 가지 옵션 중 선택 필요
    - **옵션 A (간단)**: `handleRetryPlan`을 제거하고 `handleReevaluate`만 사용
      - "🔄 재시도" 버튼 → "🔁 재평가" 버튼으로 통합
      - 재평가 시 자동으로 upgradePlan도 갱신됨 (이미 구현됨!)
    - **옵션 B (분리)**: `handleRetryPlan`에서 evaluate-single 호출 (체크리스트 내용)
      - 하지만 evaluate-single은 JudgeResult도 반환하여 판정 변경 위험
  - [ ] 파일/위치: P8E-01 전체 재검토 필요

- [ ] **(Critical) P8E-01: 이미 해결된 문제인지 확인 필요**
  - [ ] 원인: Phase 8-D에서 `handleReevaluate` 수정 시 이미 `runUpgradePlanner` 사용하는 `evaluate-single` API 호출함
  - [ ] **확인 필요**: 현재 "🔁 재평가" 클릭 시 How to Fix가 제대로 표시되는가?
  - [ ] **만약 그렇다면**: "🔄 재시도" 버튼 자체를 제거하고 "🔁 재평가"로 통합하는 것이 최선
  - [ ] 파일/위치: 브라우저 테스트로 확인 필요

### Major Issues

- [ ] **(Major) P8E-01/02: API 응답 형식 불일치**
  - [ ] 원인:
    - `evaluate-single` 응답: `{ success, judgment, upgradePlan }`
    - `handleRetryPlan` 기대: `UpgradePlan` 직접 반환
    - 현재 `handleRetryPlan`은 `return upgradePlan`만 해야 함
  - [ ] **수정 제안**: P8E-02 Detail 수정
    - `return data.upgradePlan` 형태로 반환
  - [ ] 파일/위치: P8E-02 Detail 섹션

---

## 2) 🚨 리스크 및 안전장치 (Risk Guardrails)

### High Risk

- [ ] **(High) 재시도 시 JudgeResult 변경 가능성**
  - [ ] 위험 요소: `evaluate-single` API는 `judgment`도 반환함
  - [ ] 문제: "재시도"가 Upgrade Plan만 갱신해야 하는데, 평가 결과까지 변경될 수 있음
  - [ ] **방어 로직 제안**:
    - 옵션 A 선택 시: 문제 없음 (재평가이므로 당연히 결과 변경)
    - 옵션 B 선택 시: 반환된 `judgment` 무시하고 `upgradePlan`만 사용

### Mid Risk

- [ ] **(Mid) 버튼 2개 존재로 인한 사용자 혼란**
  - [ ] 위험 요소: "🔄 재시도"와 "🔁 재평가" 두 버튼의 차이가 불명확함
  - [ ] **방어 로직 제안**: 버튼 통합하여 UX 단순화

---

## 3) 🧪 검증 기준 구체화 (Test Criteria)

### 우선 확인 필요

- [ ] **TC-00**: 현재 "🔁 재평가" 클릭 시 How to Fix 상태 확인
  - 조작: FAIL 항목에서 "🔁 재평가" 클릭
  - 확인: How to Fix에 실제 수정 방법이 표시되는가?
  - **결과에 따라 체크리스트 방향 결정**

### Happy Path 테스트

- [ ] **TC-01**: Upgrade Plan 재생성
  - 전제조건: FAIL 항목에 오류 Upgrade Plan이 있음
  - 조작: 재시도(또는 재평가) 클릭
  - 기대 결과: How to Fix에 구체적인 수정 방법 표시

---

## 4) 최종 판단 (Decision)

- [x] **상태**: ⚠️ 체크리스트 수정 후 진행
- [x] **가장 치명적인 결함**: "🔁 재평가" 버튼이 이미 `evaluate-single` API를 통해 LLM 기반 Upgrade Plan을 생성하고 있을 가능성이 높음. 먼저 브라우저 테스트(TC-00)로 확인 후, "🔄 재시도" 버튼 제거 또는 통합 여부 결정 필요.

---

## 📋 권장 진행 순서

1. **[TC-00 테스트]** 현재 "🔁 재평가" 클릭 시 How to Fix 확인
2. **정상 표시되면**: "🔄 재시도" 버튼 제거하고 "🔁 재평가"로 통합
3. **안 되면**: 체크리스트대로 P8E-01/02 구현
