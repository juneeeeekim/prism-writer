# Phase 9: Auto-Fix (자동 수정) 구현 체크리스트

**작성일**: 2025-12-28  
**작성자**: Tech Lead  
**원본 문서**: How to Fix - UI/UX 검토 및 개선 제안 보고서

---

## 1. File & Structure Decision

### 파일 구성 전략

**결정: 3개 파일 수정/생성**

| 구분          | 파일                                     | 역할                                            |
| :------------ | :--------------------------------------- | :---------------------------------------------- |
| **BE (신규)** | `lib/judge/patchGenerator.ts`            | LLM 기반 실제 패치(수정본) 생성 로직 구현       |
| **BE (수정)** | `api/rag/change-plan/route.ts`           | Mock 데이터 제거 및 patchGenerator 연결         |
| **FE (점검)** | `components/Assistant/EvaluationTab.tsx` | `handleApplyPlan`이 실제 패치를 적용하는지 확인 |

### 근거

1. **역할 분리**: `change-plan` API에서 비즈니스 로직(LLM 호출)을 분리하여 `patchGenerator`로 모듈화.
2. **Mock 제거**: 현재 하드코딩된 Mock 데이터를 실제 LLM 생성 로직으로 교체하여 "진짜" 자동 수정 구현.

---

## 2. Phase 9-A: Backend Implementation (Real Auto-Fix)

### Before Start

- **영향받는 파일**:
  - `frontend/src/app/api/rag/change-plan/route.ts` (현재 Mock 사용 중)
  - `frontend/src/lib/judge/patchGenerator.ts` (신규 파일)

### Implementation Items

- [ ] **P9A-01**: `patchGenerator.ts` 유틸리티 생성

  - `Target`: `frontend/src/lib/judge/patchGenerator.ts`
  - `Detail`:
    1. `runPatchGenerator` 함수 구현
    2. LLM(Gemini)을 호출하여 문제 문장(`citation`)을 수정된 문장(`patched_content`)으로 변환
    3. 프롬프트: Evaluation 결과와 Reference(참고자료)를 반영하여 수정 요청
  - `Dependency`: 없음
  - `Quality`: JSON 포맷 준수, 에러 처리

- [ ] **P9A-02**: `change-plan` API에서 Mock 제거 및 연결
  - `Target`: `frontend/src/app/api/rag/change-plan/route.ts`
  - `Detail`:
    1. `generatePatchesParallel` 함수 내부의 Mock 데이터 제거
    2. `runPatchGenerator` 호출로 교체
    3. `evidenceContext`(참고자료)를 LLM에 전달하도록 파라미터 확장
  - `Dependency`: P9A-01
  - `Quality`: P95 5초 이내 응답 목표 (병렬 처리 유지)

---

## 3. Phase 9-B: Frontend Integration & Verification

### Implementation Items

- [ ] **P9B-01**: `EvaluationTab.tsx` 핸들러 점검 및 보완
  - `Target`: `frontend/src/components/Assistant/EvaluationTab.tsx`
  - `Detail`:
    1. `handleApplyPlan` 구현 내용 확인 (현재 코드 확인 필요)
    2. API 응답(`changePlan`)을 받아 에디터에 적용하는 `editor.replaceRange` 등의 로직 검증
  - `Dependency`: Phase 9-A
  - `Quality`: 수정 적용 후 토스트 메시지 등 사용자 피드백

### Verification (검증)

- [ ] Syntax Check: `npx tsc --noEmit` 통과
- [ ] Functionality Test:
  1. 평가 실행 -> FAIL 발생
  2. "⚡ 자동 수정" 버튼 클릭 (만약 버튼이 보인다면)
     - _주의_: 현재 오류 상태가 아니면 버튼이 보임. 오류 상태면 재평가 후 버튼 생성됨.
  3. 에디터의 텍스트가 실제로 수정되는지 확인
- [ ] Regression Test:
  - 기존 평가 기능 영향 없음 확인

---

## 4. 위험 관리

| ID  | 위험             | 영향도 | 완화 방안                                    |
| :-- | :--------------- | :----: | :------------------------------------------- |
| R1  | LLM 생성 실패    |   중   | 실패 시 기존처럼 "직접 수정하세요" 안내 유지 |
| R2  | 엉뚱한 수정 적용 |   상   | Diff View(Idea 2) 도입 고려 (Phase 10)       |

---

## 5. 완료 기준

- [ ] `change-plan` API가 실제 LLM 응답을 반환해야 함
- [ ] "⚡ 자동 수정" 클릭 시 에디터 내용이 변경되어야 함
