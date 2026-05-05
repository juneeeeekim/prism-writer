# Evaluation History Separation - Implementation Checklist
> 평가 기록 유형 분리 (종합 평가 / 기준별 평가)

**Status:** ✅ COMPLETED
**Date:** 2026-01-04
**Author:** Tech Lead

---

## [Phase 1: 데이터 분류 기준 명확화]

**Before Start:**
- ⚠️ 주의: 기존 `savedEvaluations` 데이터 구조 변경 없이 분류 로직만 추가
- ⚠️ 레거시: `result_data.holistic_result` 존재 여부만으로 판단하던 기존 로직 → `template_id` 우선 판단으로 변경

**Implementation Items:**

- [x] **P1-01**: 종합 평가 저장 시 `template_id` 명시적 설정
    - `Target`: `EvaluationTab.tsx` > `handleHolisticEvaluate()`
    - `Logic (Pseudo)`:
      ```typescript
      const resultToSave = result ? {
        ...result,
        template_id: 'holistic-only',  // 강제 설정
        judgments: [],                  // 혼재 방지
        overall_score: data.result.scoreC.overall
      } : { ... }
      ```
    - `Key Variables`: `resultToSave.template_id`, `resultToSave.judgments`
    - `Safety`: `data.result?.scoreC?.overall || 0` null 체크

- [x] **P1-02**: 평가 유형 분류 로직 개선
    - `Target`: `EvaluationTab.tsx` > 렌더링 영역 (라인 810-818)
    - `Logic (Pseudo)`:
      ```typescript
      // 종합 평가 필터
      const holisticEvaluations = savedEvaluations.filter(e =>
        e.result_data?.template_id === 'holistic-only' ||
        (e.result_data?.holistic_result &&
         (!e.result_data?.judgments || e.result_data.judgments.length === 0))
      )

      // 기준별 평가 필터
      const detailedEvaluations = savedEvaluations.filter(e =>
        (e.result_data?.template_id && e.result_data.template_id !== 'holistic-only') ||
        (e.result_data?.judgments?.length > 0 &&
         e.result_data?.template_id !== 'holistic-only')
      )
      ```
    - `Key Variables`: `holisticEvaluations`, `detailedEvaluations`
    - `Safety`: Optional chaining (`?.`) 모든 접근에 적용

---

## [Phase 2: UI 2열 가로 배치]

**Before Start:**
- ⚠️ 주의: 사이드바 너비 제약으로 인해 각 열 텍스트 truncate 필요
- ⚠️ 반응형: 좁은 화면에서도 2열 유지 (grid-cols-2 고정)

**Implementation Items:**

- [x] **P2-01**: Grid 레이아웃으로 2열 배치
    - `Target`: `EvaluationTab.tsx` > 이전 평가 히스토리 영역
    - `Logic (Pseudo)`:
      ```tsx
      <div className="grid grid-cols-2 gap-3">
        {/* 종합 평가 컬럼 */}
        <div>
          <h5>📊 종합 평가 ({holisticEvaluations.length})</h5>
          {holisticEvaluations.length > 0
            ? holisticEvaluations.slice(0,3).map(renderEvaluationItem)
            : <p>없음</p>}
        </div>

        {/* 기준별 평가 컬럼 */}
        <div>
          <h5>📋 기준별 평가 ({detailedEvaluations.length})</h5>
          {detailedEvaluations.length > 0
            ? detailedEvaluations.slice(0,3).map(renderEvaluationItem)
            : <p>없음</p>}
        </div>
      </div>
      ```
    - `Key Variables`: `renderEvaluationItem` 함수 재사용
    - `Safety`: 빈 배열일 때 "없음" fallback 표시

- [x] **P2-02**: 색상 구분 적용
    - `Target`: `EvaluationTab.tsx` > 섹션 헤더 및 보더
    - `Logic (Pseudo)`:
      ```
      종합 평가: text-indigo-600, border-indigo-200
      기준별 평가: text-emerald-600, border-emerald-200
      빈 상태: text-gray-400, border-gray-200
      ```
    - `Key Variables`: Tailwind 클래스명
    - `Safety`: dark mode 대응 (`dark:` prefix 적용)

---

## [Phase 3: 평가 로드 시 탭 자동 전환]

**Before Start:**
- ⚠️ 주의: 히스토리에서 항목 클릭 시 해당 유형 탭으로 자동 전환되어야 UX 일관성 유지

**Implementation Items:**

- [x] **P3-01**: `handleLoadEvaluation()` 탭 전환 로직 추가
    - `Target`: `EvaluationTab.tsx` > `handleLoadEvaluation()`
    - `Logic (Pseudo)`:
      ```typescript
      const handleLoadEvaluation = (evaluation: SavedEvaluation) => {
        setResult(evaluation.result_data)

        // Holistic 복원
        if (evaluation.result_data.holistic_result) {
          setHolisticResult(evaluation.result_data.holistic_result)
        } else {
          setHolisticResult(null)
        }

        // 탭 자동 전환
        const isHolistic =
          evaluation.result_data.template_id === 'holistic-only' ||
          (!evaluation.result_data.judgments ||
           evaluation.result_data.judgments.length === 0)

        setActiveEvalTab(isHolistic ? 'holistic' : 'detailed')
        setIsSaved(true)
      }
      ```
    - `Key Variables`: `isHolistic`, `activeEvalTab`
    - `Safety`: `result_data.judgments` null/undefined 체크

---

## [Phase 4: 탭 UI 항상 표시]

**Before Start:**
- ⚠️ 변경점: 기존에는 `holisticResult && result` 둘 다 있을 때만 탭 표시 → 항상 표시로 변경

**Implementation Items:**

- [x] **P4-01**: 탭 헤더 조건부 렌더링 제거
    - `Target`: `EvaluationTab.tsx` > 탭 헤더 영역 (라인 711-737)
    - `Logic (Pseudo)`:
      ```tsx
      // Before: {holisticResult && result && ( <TabHeader /> )}
      // After:  <TabHeader /> (항상 표시)

      {(result || isLoading) && (
        <div className="flex-1 overflow-hidden flex flex-col">
          {/* 탭 헤더 - 항상 표시 */}
          <div className="flex border-b ...">
            <button onClick={() => setActiveEvalTab('holistic')}>
              📊 종합 평가
            </button>
            <button onClick={() => setActiveEvalTab('detailed')}>
              📋 기준별 평가
            </button>
          </div>
          ...
        </div>
      )}
      ```
    - `Key Variables`: `activeEvalTab` state
    - `Safety`: 없음

- [x] **P4-02**: 종합 평가 탭 빈 상태 CTA 추가
    - `Target`: `EvaluationTab.tsx` > 종합 평가 탭 컨텐츠 (라인 742-768)
    - `Logic (Pseudo)`:
      ```tsx
      {activeEvalTab === 'holistic' && (
        <div className="p-4">
          {holisticResult ? (
            <HolisticFeedbackPanel ... />
          ) : (
            <EmptyStateCTA
              title="전체적인 글 평가가 필요하신가요?"
              onAction={handleHolisticEvaluate}
            />
          )}
        </div>
      )}
      ```
    - `Key Variables`: `holisticResult`, `handleHolisticEvaluate`
    - `Safety`: `isHolisticLoading` 상태에서 버튼 disabled

---

## Definition of Done (검증)

### 기능 검증
- [x] Test: 종합 평가 실행 → 저장 → "이전 평가 기록"에서 📊 종합 평가 섹션에 표시
- [x] Test: 기준별 평가 실행 → 저장 → "이전 평가 기록"에서 📋 기준별 평가 섹션에 표시
- [x] Test: 종합 평가 기록 클릭 → 종합 평가 탭으로 자동 전환
- [x] Test: 기준별 평가 기록 클릭 → 기준별 평가 탭으로 자동 전환
- [x] Test: 데이터 없는 유형은 "없음"으로 표시

### UI 검증
- [x] Test: 2열 가로 배치 정상 렌더링
- [x] Test: 색상 구분 (인디고 / 에메랄드) 정상 적용
- [x] Test: Dark mode에서 색상 정상 표시
- [x] Test: 각 섹션 최대 3개까지만 표시

### 코드 품질
- [x] Review: 불필요한 콘솔 로그 확인 (디버깅용 로그는 유지)
- [x] Review: TypeScript 타입 에러 없음
- [x] Review: Optional chaining 적용 완료

---

## File Changes Summary

| File | Lines Changed | Description |
|------|---------------|-------------|
| `frontend/src/components/Assistant/EvaluationTab.tsx` | +50, -30 | 평가 유형 분류 및 2열 UI |

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│  EvaluationTab                                          │
├─────────────────────────────────────────────────────────┤
│  📁 이전 평가 기록                                        │
│  ┌────────────────────┬────────────────────┐            │
│  │ 📊 종합 평가 (N)    │ 📋 기준별 평가 (M)  │            │
│  │ ─────────────────  │ ─────────────────  │            │
│  │ │ 1/3, 14:30 - 75점│ │ 1/2, 11:30 - 79점│            │
│  │ │ 1/2, 10:15 - 68점│ │ 1/1, 09:45 - 71점│            │
│  └────────────────────┴────────────────────┘            │
│                                                         │
│  분류 기준:                                              │
│  ├─ template_id === 'holistic-only' → 종합 평가          │
│  └─ judgments.length > 0 → 기준별 평가                   │
└─────────────────────────────────────────────────────────┘
```

---

## Notes

1. **하위 호환성**: 기존 저장된 평가 데이터 중 `template_id`가 없는 경우, `holistic_result` 존재 여부와 `judgments` 배열로 폴백 판단
2. **향후 개선**: DB 스키마에 `evaluation_type` 컬럼 추가하면 분류 로직 단순화 가능
