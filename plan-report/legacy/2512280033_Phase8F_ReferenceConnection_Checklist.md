# Phase 8-F: 참고자료 → Upgrade Plan 연결 체크리스트

**작성일**: 2025-12-28  
**작성자**: Tech Lead  
**원본 문서**: Implementation Plan (참고자료 → Upgrade Plan 연결 분석 보고서)

**✅ 구현 완료일**: 2025-12-28 00:43  
**구현 커밋**: `d17f2e1` (예정)

---

## 1. File & Structure Decision

### 파일 구성 전략

**결정: 2개 파일 수정**

| 구분          | 파일                               | 역할                                       |
| :------------ | :--------------------------------- | :----------------------------------------- |
| **BE (수정)** | `lib/judge/upgradePlanner.ts`      | runUpgradePlanner에 evidenceContext 추가   |
| **BE (수정)** | `api/rag/evaluate-single/route.ts` | evidenceContext를 runUpgradePlanner에 전달 |

---

## 2. Phase 8-F: 참고자료 연결 ✅

### Implementation Items ✅ 완료

- [x] **P8F-01**: runUpgradePlanner 함수 시그니처 수정

  - 세 번째 매개변수 `evidenceContext?: string` 추가 완료
  - 기본값 `''` 설정으로 하위 호환성 유지

- [x] **P8F-02**: 프롬프트에 참고자료 섹션 추가

  - `criteria.positive_examples` 대신 `evidenceContext` 우선 사용
  - **안전장치 적용**: 2000자 제한 및 fallback 로직 구현 완료

  ```typescript
  const truncatedEvidence = evidenceContext?.substring(0, 2000) || "";
  const positiveEx = criteria.positive_examples?.join("\n") || "";
  return truncatedEvidence || positiveEx || "(참고 자료 없음)";
  ```

- [x] **P8F-03**: evaluate-single API에서 evidenceContext 전달
  - `runUpgradePlanner(judgment, targetCriteria, evidenceContext)` 호출 수정 완료

### Verification (검증)

- [x] Syntax Check: `npx tsc --noEmit` 통과 (0 errors)
- [ ] Functionality Test: (사용자 검증 예정)
  1. 참고자료 탭에 예시 글 업로드
  2. FAIL 항목에서 "🔁 재평가" 클릭
  3. **기대 결과**: How to Fix에 참고자료 스타일 반영된 수정 방법 표시

---

## 4. 완료 기준

- [x] 모든 체크리스트 완료
- [x] `npx tsc --noEmit` 성공
- [ ] Git commit + Push 완료
