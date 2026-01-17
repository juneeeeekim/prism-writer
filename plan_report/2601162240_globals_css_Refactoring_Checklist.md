# globals.css 안전 리팩토링 체크리스트

**대상 파일:** `frontend/src/app/globals.css` (1523 lines)
**목표:** 전역 스타일 충돌 방지 및 안전한 모듈화 (Atomic Migration)

---

## [Phase 0] 안전 장치 (Safety First)

**Before Start:**

- ⚠️ **Critical:** CSS는 전역으로 적용되므로, 작업 도중 스타일이 깨지면 레이아웃 전체가 망가질 수 있음. 반드시 백업 필수.

**Implementation Items:**

- [ ] **ID(P0-01)**: 백업 파일 생성
  - `Target`: `frontend/src/app/globals.css.bak`
  - `Logic`: 현재 상태 그대로 복사.
  - `Safety`: 스타일 깨짐 발생 시 즉시 복구 가능.

---

## [Phase 1] Dashboard 스타일 분리 (Atomic Step)

**Before Start:**

- ⚠️ **Atomic Concept:** "새 파일 생성" -> "컴포넌트 연결" -> "기존 코드 삭제"를 하나의 작업 단위로 수행해야 함. (하나라도 누락되면 충돌 발생)

**Implementation Items:**

- [ ] **ID(P1-01)**: CSS 모듈 파일 생성

  - `Target`: `frontend/src/styles/dashboard.module.css`
  - `Source`: `globals.css` > L227-964 (`/* Dashboard Page Styles */`)
  - `Logic`: 해당 섹션 코드를 복사해서 새 파일에 붙여넣기. 클래스명 변경 없이 일단 복사.

- [ ] **ID(P1-02)**: 컴포넌트 연결 (Import)

  - `Target`: `Dashboard.tsx` 등 관련 컴포넌트
  - `Logic`:
    ```typescript
    import styles from "@/styles/dashboard.module.css";
    // className="dashboard-container" -> className={styles.dashboardContainer}
    ```
  - `Safety`: **kebab-case**(`.dashboard-container`) 자동 지원 여부 확인(Next.js 설정). 지원 안 하면 camelCase로 변경 필요.

- [ ] **ID(P1-03)**: **[중요] 기존 코드 삭제 (충돌 방지)**

  - `Target`: `globals.css`
  - `Logic`: L227-964 섹션을 **전체 삭제** (또는 주석 처리).
  - `Safety`: 삭제하지 않으면 `.dashboard-container`가 전역과 로컬에서 이중 선언되어 스타일 충돌 발생. **반드시 삭제.**

- [ ] **ID(P1-04)**: 육안 검증
  - `Action`: 대시보드 페이지 새로고침. 레이아웃 깨짐 확인.

---

## [Phase 2] Project Selector 스타일 분리 (Atomic Step)

**Implementation Items:**

- [ ] **ID(P2-01)**: 모듈 생성

  - `Target`: `frontend/src/styles/projectSelector.module.css`
  - `Source`: `globals.css` > L1258-1523
  - `Logic`: 복사. `z-index: 50` 유지 확인.

- [ ] **ID(P2-02)**: 컴포넌트 연결

  - `Target`: `ProjectSelector.tsx`
  - `Logic`: `import styles` 및 className 교체.

- [ ] **ID(P2-03)**: **기존 코드 삭제**

  - `Target`: `globals.css`
  - `Logic`: 해당 섹션 삭제.

- [ ] **ID(P2-04)**: 육안 검증 (드롭다운 동작 확인)

---

## [Phase 3] Modal/Form 공통 스타일 분리

**Implementation Items:**

- [ ] **ID(P3-01)**: Modal 모듈화 (P3 flow 동일)

  - `File`: `frontend/src/styles/modal.module.css`
  - `Source`: L966-1057

- [ ] **ID(P3-02)**: Form 모듈화 (P4 flow 동일)
  - `File`: `frontend/src/styles/form.module.css`
  - `Source`: L1059-1151

---

## [Phase 4] 전역 유지 항목 최종 점검

**Implementation Items:**

- [ ] **ID(P4-01)**: 남은 코드 정리
  - `Target`: `globals.css`
  - `Checklist`:
    - Tailwind imports (유지)
    - :root Variables (유지)
    - Body/HTML reset (유지)
    - Toast Animation (유지)
  - `Logic`: 위 항목 외에 불필요하게 남은 스타일이 없는지 확인.

---

## [Phase 5] Final Cleanup (작업 마무리)

**Before Start:**

- ⚠️ **Verification:** 모든 페이지(대시보드, 모달, 폼 등) 스타일 렌더링 정상 확인 필수.

**Implementation Items:**

- [ ] **ID(P5-01)**: 백업 파일 삭제

  - `Target`: `frontend/src/app/globals.css.bak`
  - `Logic`: 삭제.

- [ ] **ID(P5-02)**: 최종 빌드 테스트
  - `Command`: `npm run build`
  - `Check`: CSS Minification 에러 없는지 확인.

---

## 중요: 스타일 충돌 방지 가이드

1.  **동시 존재 금지**: `globals.css`에 코드가 남아 있는 상태에서 `module.css`를 import하면 예측 불가능한 결과가 나옵니다. **반드시 기존 코드를 지워야 합니다.**
2.  **명시도(Specificity) 주의**: 모듈화 시 클래스 명시도가 변할 수 있습니다. `!important` 사용은 지양하고, 필요하면 모듈 내에서 선택자를 강화하세요.
3.  **캐시 클리어**: 브라우저 캐시 때문에 변경 사항이 안 보일 수 있습니다. 강력 새로고침(Ctrl+F5) 필수.

---

**작성일:** 2026-01-17
**작성자:** Tech Lead (AI Assistant)
