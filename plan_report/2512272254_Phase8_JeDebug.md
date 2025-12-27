# Phase 8 JeDebug 검토 결과

**검토일**: 2025-12-27 22:54  
**검토자**: Senior Lead Developer (JeDebug)  
**대상 문서**: `2512272250_Phase8_Individual_Reevaluation_Checklist.md`

---

## 1) 🔧 로직 및 구현 보완 (Logic Fixes)

### Critical Issues

- [ ] **(Critical) P8A-03: 파일명 오류**

  - [ ] 원인: 체크리스트에 `align-judge.ts` 명시, 실제 파일은 `alignJudge.ts` (camelCase)
  - [ ] **수정 제안**: P8A-03 및 Before Start 섹션의 파일명 수정
    - `frontend/src/lib/judge/align-judge.ts` → `frontend/src/lib/judge/alignJudge.ts`
  - [ ] 파일/위치: 체크리스트 Line 36, Line 64

- [ ] **(Critical) P8A-03: 단일 Criteria 평가 함수 미정의**

  - [ ] 원인: 기존 `runAlignJudge()` 함수는 **단일 TemplateSchema** 를 받음, 그러나 criteriaId만으로 TemplateSchema를 가져오는 로직 없음
  - [ ] **수정 제안**: P8A-03에 다음 단계 추가
    ```
    - [ ] **P8A-02.5**: criteriaId → TemplateSchema 매핑 로직
      - Target: route.ts 또는 별도 유틸
      - Detail:
        1. criteriaId로 해당 TemplateSchema 조회
        2. 조회 소스: DB 또는 하드코딩된 템플릿 맵
        3. [확인 필요: 현재 템플릿 스키마가 어디에 저장되어 있는지?]
    ```
  - [ ] 파일/위치: P8A-02와 P8A-03 사이에 추가

- [ ] **(Critical) P8A-03: UpgradePlan 생성 로직 누락**
  - [ ] 원인: `runAlignJudge()` 함수는 JudgeResult만 반환, UpgradePlan 생성 로직 별도 필요
  - [ ] **수정 제안**: P8A-03에 다음 내용 추가
    ```
    - Detail 4번 추가:
      4. UpgradePlanner 호출 또는 신규 구현 필요
         (기존 evaluate API의 upgrade_plans 생성 로직 참고)
    ```
  - [ ] 파일/위치: P8A-03 Detail 섹션

### Major Issues

- [ ] **(Major) P8B-03: 기존 코드와 상태 관리 충돌**

  - [ ] 원인: 현재 FeedbackItem은 이미 `const [plan, setPlan] = useState(initialPlan)` 사용 중 (현 코드 Line 135)
  - [ ] **수정 제안**: 체크리스트 P8B-03 수정
    - `localPlan` 대신 기존 `plan, setPlan` 상태 재활용
    - `localJudgment` 추가만 필요
  - [ ] 파일/위치: P8B-03 Detail 섹션

- [ ] **(Major) P8B-06: judge 참조 변경 필요**
  - [ ] 원인: FeedbackItem 내부에서 `judge`는 props로 받은 원본 값, `localJudgment`로 변경 시 모든 `judge.` 참조를 `localJudgment.`로 교체해야 함
  - [ ] **수정 제안**: P8B-06에 추가
    - `statusColors[judge.status]` → `statusColors[localJudgment.status]`
    - `statusIcons[judge.status]` → `statusIcons[localJudgment.status]`
    - `judge.reasoning` → `localJudgment.reasoning`
    - `judge.citation` → `localJudgment.citation`
  - [ ] 파일/위치: P8B-06 Detail에 구체적 변경 목록 명시

---

## 2) 🚨 리스크 및 안전장치 (Risk Guardrails)

### High Risk

- [ ] **(High) 쿨다운 로직 미구현**
  - [ ] 위험 요소: 리스크 R2에 "30초 쿨다운 (P8B-04에서 구현)" 명시, 그러나 P8B-04에 실제 쿨다운 코드 없음
  - [ ] **방어 코드 추가 제안**: P8B-04 handleReevaluate에 추가

    ```typescript
    const [lastReevaluateTime, setLastReevaluateTime] = useState<number>(0);

    const handleReevaluate = async () => {
      const now = Date.now();
      if (now - lastReevaluateTime < 30000) {
        alert("30초 후에 다시 시도해주세요.");
        return;
      }
      setLastReevaluateTime(now);
      // ... 기존 로직
    };
    ```

### Mid Risk

- [ ] **(Mid) 에러 발생 시 사용자 피드백 부재**
  - [ ] 위험 요소: P8B-04에서 result가 null일 경우 아무 동작 없음
  - [ ] **방어 로직 제안**: 실패 시 에러 메시지 표시
    ```typescript
    if (!result) {
      alert("재평가에 실패했습니다. 잠시 후 다시 시도해주세요.");
      return;
    }
    ```

---

## 3) 🧪 검증 기준 구체화 (Test Criteria)

### Happy Path 테스트

- [ ] **TC-01**: PARTIAL → PASS 전환

  - 전제조건: 글에 "15~20%" 통계 인용 포함
  - 조작: "본론이 원인 분석" 항목에서 "🔁 재평가" 클릭
  - 기대 결과: 카드 색상 노랑→초록, status "PASS", reasoning 갱신

- [ ] **TC-02**: PARTIAL → FAIL 전환
  - 전제조건: 글에서 관련 내용 완전 삭제
  - 조작: "🔁 재평가" 클릭
  - 기대 결과: 카드 색상 노랑→빨강, status "FAIL"

### Edge Case 테스트

- [ ] **TC-03**: API 타임아웃

  - 조작: 네트워크 지연 30초 이상 시뮬레이션
  - 기대 결과: 에러 메시지 표시, 로딩 상태 해제

- [ ] **TC-04**: 30초 쿨다운 테스트

  - 조작: 재평가 성공 후 즉시 다시 클릭
  - 기대 결과: "30초 후에 다시 시도해주세요" 알림

- [ ] **TC-05**: criteriaId 없는 항목 재평가
  - 전제조건: criteria_id가 'unknown'인 항목 존재 시
  - 기대 결과: 400 에러 또는 graceful fallback

---

## 4) 최종 판단 (Decision)

- [x] **상태**: ⚠️ 체크리스트 수정 후 진행
- [x] **가장 치명적인 결함**: `criteriaId → TemplateSchema 매핑 로직 누락`. 현재 runAlignJudge 함수는 TemplateSchema 객체를 필요로 하나, 체크리스트에는 criteriaId로 스키마를 조회하는 단계가 없음.

---

## 📋 수정 체크리스트 요약

| 우선순위 | 항목 ID          | 수정 내용                                      |
| :------: | :--------------- | :--------------------------------------------- |
|    🔴    | P8A Before Start | 파일명 `align-judge.ts` → `alignJudge.ts`      |
|    🔴    | P8A-02.5 (신규)  | criteriaId → TemplateSchema 매핑 로직 추가     |
|    🔴    | P8A-03 Detail    | UpgradePlan 생성 로직 명시                     |
|    🟡    | P8B-03           | 기존 plan/setPlan 재활용, localJudgment만 추가 |
|    🟡    | P8B-04           | 30초 쿨다운 코드 추가                          |
|    🟡    | P8B-04           | 실패 시 alert 추가                             |
|    🟡    | P8B-06           | judge._ → localJudgment._ 교체 목록 명시       |
