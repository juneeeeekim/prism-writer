# 📋 RAFT 카테고리 동기화 구현 체크리스트 (v1.1)

**작성일**: 2025-12-28
**작성자**: Tech Lead (Refined by JeDebug)
**기반 문서**: `2512281725_RAFT_Category_Synchronization_Plan.md`

---

## 1. File & Structure Decision

### 🏗️ 파일 구성 전략 및 근거

- **전략**: **UI 컴포넌트 분리 (Custom Combobox Component)**
- **근거**:
  1.  **Premium UX**: 브라우저 기본 `datalist`는 스타일링 한계가 명확하므로, **Custom Div-based Combobox**를 직접 구현하여 "Premium Design" 요구사항을 충족.
  2.  **재사용성**: 입력/선택 하이브리드 로직을 캡슐화.
  3.  **성능**: 메인 패널 리렌더링 최소화.

### 📂 저장 위치

- 문서: `plan_report/2512281730_RAFT_Category_Sync_Checklist.md`
- 신규 컴포넌트: `frontend/src/components/admin/CategoryCombobox.tsx`
- 신규 API: `frontend/src/app/api/categories/unique/route.ts`

---

## 2. Checklist Content

### [Phase 1: Backend - Unique Category API]

**Before Start:**

- **P1-00**: DB 스키마 확인 ✅ (Verified: table `documents`)
  - [x] Supabase 대시보드 또는 쿼리로 `documents` vs `articles` 테이블명 확정.
  - [x] `category` 컬럼 데이터 타입 및 NULL 허용 여부 확인.

**Implementation Items:**

- [x] **P1-01**: 문서 테이블 유니크 카테고리 조회 API 작성 ✅
  - `Target`: `frontend/src/app/api/categories/unique/route.ts` [NEW]
  - `Detail`:
    1. **보안**: `SKIP_RAFT_AUTH` 환경변수 또는 Supabase Session(Admin 권한) 체크 로직 필수. 권한 없으면 401 반환.
    2. **쿼리**: 문서 테이블에서 `category` 컬럼 `DISTINCT` 조회 (NULL 제외).
    3. **정제**:
       - `RAFT_CATEGORIES` 상수와 병합.
       - `trim()` 적용 및 빈 문자열 제거.
       - 중복 제거 (Set 활용).
    4. **정렬**: 한글/알파벳 순 정렬하여 JSON 반환.
  - `Quality`: 에러 발생 시 500 대신 빈 배열(`[]`) 또는 기본 카테고리 반환하여 프론트엔드 파괴 방지.

**Verification (검증):**

- [x] API Test: `/api/categories/unique` 호출 시 인증 실패(401) 및 성공 케이스(JSON 배열) 확인. ✅
- [x] Data Clean Test: `"Marketing"`(공백 포함)과 `"Marketing"`이 하나로 합쳐지는지 확인. ✅

---

### [Phase 2: Frontend - CategoryCombobox Component]

**Before Start:**

- **UX 결정**: Headless UI 사용 없이 **TailwindCSS + React State**만으로 Custom Dropdown 구현 (종속성 최소화).

**Implementation Items:**

- [x] **P2-01**: `CategoryCombobox` UI 골격 및 스타일링 ✅

  - `Target`: `frontend/src/components/admin/CategoryCombobox.tsx` [NEW]
  - `Detail`:
    1. **Props**: `value`, `onChange`, `disabled`, `placeholder`.
    2. **State**: `items`, `inputValue`, `isOpen`, `isLoading`, `error`.
    3. **UI 구조**:
       - Input 필드 (직접 입력 및 검색용).
       - Input 포커스 시 하단에 절대 위치(Absolute)로 드롭다운 목록 표시.
       - 드롭다운 아이템 클릭 시 선택 처리.
  - `Quality`:
    - **Premium Design**: 부드러운 트랜지션, Hover 효과, 그림자(Shadow-lg) 적용.
    - **Accessibility**: 키보드(Arrow Up/Down, Enter) 탐색 지원 권장.

- [x] **P2-02**: 데이터 페칭 및 에러 핸들링 ✅
  - `Target`: `frontend/src/components/admin/CategoryCombobox.tsx`
  - `Detail`:
    1. **Fetch**: `useEffect`로 컴포넌트 마운트 시 API 호출.
    2. **Fallback**: API 호출 실패(`error` 상태) 시, 내부적으로 `RAFT_CATEGORIES` 상수를 import하여 기본 목록으로 사용 (UI 깨짐 방지).
    3. **Filter**: `inputValue`에 따라 목록 실시간 필터링.

**Verification (검증):**

- [x] UI Test: 드롭다운이 인풋 바로 아래에 정확히 뜨는지, 다른 요소에 가려지지 않는지(z-index) 확인. ✅
- [x] Fallback Test: API 주소를 임의로 변경해 에러 유발 후, 기본 카테고리 목록이 뜨는지 확인. ✅

---

### [Phase 3: Integration & State Sync]

**Before Start:**

- 영향받는 파일: `frontend/src/components/admin/SyntheticDataPanel.tsx`

**Implementation Items:**

- [x] **P3-01**: `SyntheticDataPanel` 교체 통합 ✅
  - `Target`: `frontend/src/components/admin/SyntheticDataPanel.tsx`
  - `Detail`:
    1. 기존 `<select>` 제거하고 `<CategoryCombobox>` 배치.
    2. `selectedCategory` 상태와 양방향 바인딩.
    3. "생성(Generate)" 버튼 클릭 시 선택된(또는 입력된) 값이 API로 전송되는지 로깅.
  - `Dependency`: P2-01, P2-02 완료 필수.

**Verification (검증):**

- [x] Integration Test: 실제 문서 카테고리(예: `250621_예민2_풀링`) 선택 -> 생성 -> 결과 테이블에 해당 배지 표시 확인. ✅
- [x] End-to-End: `raft_dataset` 테이블 조회하여 `category` 컬럼에 정확한 문자열 저장 확인. ✅

---

## 3. 예외 상황 대응 및 주의사항

- **API 실패 시**: 사용자에게 에러 팝업을 띄우지 않고, 조용히 기본 리스트로 동작(Graceful Degradation).
- **긴 텍스트**: 카테고리명이 너무 길 경우 `text-overflow: ellipsis` 처리 및 `title` 속성 제공.
- **모바일 대응**: 드롭다운 터치 영역 충분히 확보.
