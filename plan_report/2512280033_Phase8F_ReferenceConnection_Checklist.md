# Phase 8-F: 참고자료 → Upgrade Plan 연결 체크리스트

**작성일**: 2025-12-28  
**작성자**: Tech Lead  
**원본 문서**: Implementation Plan (참고자료 → Upgrade Plan 연결 분석 보고서)

---

## 1. File & Structure Decision

### 파일 구성 전략

**결정: 2개 파일 수정**

| 구분          | 파일                               | 역할                                       |
| :------------ | :--------------------------------- | :----------------------------------------- |
| **BE (수정)** | `lib/judge/upgradePlanner.ts`      | runUpgradePlanner에 evidenceContext 추가   |
| **BE (수정)** | `api/rag/evaluate-single/route.ts` | evidenceContext를 runUpgradePlanner에 전달 |

### 근거

1. **최소 변경**: 함수 시그니처와 호출부 2곳만 수정
2. **역할 분리**: 백엔드만 수정, 프론트엔드 변경 없음
3. **호환성**: 기존 호출은 그대로 동작 (optional parameter)

---

## 2. Phase 8-F: 참고자료 연결

### Before Start

- **영향받는 기존 파일**:

  - `frontend/src/lib/judge/upgradePlanner.ts`
    - `runUpgradePlanner` 함수 (Line 34-118)
  - `frontend/src/app/api/rag/evaluate-single/route.ts`
    - Line 181: `runUpgradePlanner(judgment, targetCriteria)` 호출

- **관련 기존 기능**:
  - 글 재평가 (handleReevaluate)
  - Upgrade Plan 생성

### Implementation Items

- [ ] **P8F-01**: runUpgradePlanner 함수 시그니처 수정

  - `Target`: `upgradePlanner.ts` Line 34-37
  - `Detail`:
    1. 세 번째 매개변수 `evidenceContext?: string` 추가
    2. 기본값 `''` 설정 (기존 호출 호환)
  - `Dependency`: 없음 (Phase 시작점)
  - `Quality`: optional parameter로 하위 호환성 유지

- [ ] **P8F-02**: 프롬프트에 참고자료 섹션 추가

  - `Target`: `upgradePlanner.ts` 프롬프트 (Line 51-81)
  - `Detail`:
    1. `criteria.positive_examples` 대신 `evidenceContext` 사용
    2. 또는 둘 다 사용 (참고자료 우선, 없으면 positive_examples)
    3. 프롬프트에 `[사용자 참고자료]` 섹션 추가
  - `Dependency`: P8F-01
  - `Quality`: 참고자료 없으면 해당 섹션 생략

- [ ] **P8F-03**: evaluate-single API에서 evidenceContext 전달
  - `Target`: `evaluate-single/route.ts` Line 181
  - `Detail`:
    1. `runUpgradePlanner(judgment, targetCriteria, evidenceContext)` 호출
    2. 기존에 검색된 evidenceContext 그대로 전달
  - `Dependency`: P8F-01
  - `Quality`: null/undefined 처리

### Verification (검증)

- [ ] Syntax Check: `npx tsc --noEmit` 통과
- [ ] Functionality Test:
  1. 참고자료 탭에 예시 글 업로드
  2. FAIL 항목에서 "🔁 재평가" 클릭
  3. **기대 결과**: How to Fix에 참고자료 스타일 반영된 수정 방법 표시
- [ ] Regression Test:
  - 기존 평가 기능 정상 동작
  - 참고자료 없어도 오류 없음

---

## 3. 위험 관리

| ID  | 위험               | 영향도 | 완화 방안                              |
| :-- | :----------------- | :----: | :------------------------------------- |
| R1  | 기존 호출 깨짐     |   중   | optional parameter로 하위 호환성 유지  |
| R2  | 프롬프트 토큰 초과 |   하   | evidenceContext 길이 제한 (max 2000자) |

---

## 4. 완료 기준

- [ ] 모든 체크리스트 완료
- [ ] `npx tsc --noEmit` 성공
- [ ] How to Fix에 참고자료 반영 테스트 통과

---

## 5. Traceability

| 체크리스트 ID | 원본 문서 참조                                      |
| :------------ | :-------------------------------------------------- |
| P8F-01        | 해결 방안: runUpgradePlanner에 evidenceContext 추가 |
| P8F-02        | 문제 위치: upgradePlanner.ts positive_examples 사용 |
| P8F-03        | 문제 위치: evaluate-single Line 181 호출            |
