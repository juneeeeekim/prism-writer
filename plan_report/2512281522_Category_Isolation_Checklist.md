# 📋 카테고리 데이터 격리 구현 체크리스트 (Category Data Isolation)

**문서 ID**: 251228_Category_Isolation_Checklist
**기반 문서**: `2512281519_Category_Isolation_Meeting_Minutes.md`
**작성자**: Tech Lead
**작성일**: 2025-12-28

---

## 1. File & Structure Decision

### 🏗️ 구성 전략: 단일 통합 체크리스트 (Single Consolidated Checklist)

- **근거**:
  1.  **Full-stack Feature**: 본 기능은 DB(`supabase`) → API(`app/api`) → UI(`components`)가 강하게 결합된 하나의 흐름입니다. 파일을 분리할 경우 컨텍스트 스위칭 비용이 발생합니다.
  2.  **순차적 의존성**: DB 컬럼이 없으면 API를 못 만들고, API가 없으면 UI 연동이 불가능합니다. 단일 문서에서 순차적(Sequential) 진행을 강제하는 것이 안전합니다.
  3.  **Hotfix 통합**: 긴급 이슈(로그인 버그)가 UI 작업 단계에 포함되어야 하므로, 별도 분리보다 통합 관리가 효율적입니다.

### 📂 저장 위치

- `plan_report/251228_Category_Isolation_Checklist.md`

---

## 2. Implementation Checklist

### [Phase 1: Database Schema Changes]

**Goal**: `raft_dataset` 테이블에 `category` 컬럼을 추가하여 물리적 데이터 격리 기반 마련.
**Source**: 회의록 3. 합의 및 결정 사항 > Phase 1

**Before Start:**

- 영향받는 파일: `supabase/migrations/` (신규 파일 생성)

**Implementation Items:**

- [x] **P1-01**: DB 마이그레이션 스크립트 작성

  - `Target`: `supabase/migrations/039_raft_dataset_category.sql` (New)
  - `Detail`:
    1. `raft_dataset` 테이블에 `category` 컬럼 (`TEXT`, `DEFAULT '미분류'`) 추가.
    2. `idx_raft_dataset_category` 인덱스 생성 (조회 성능 최적화).
    3. `idx_raft_dataset_source_category` 복합 인덱스 생성 (필터링 최적화).
  - `Quality`: 기존 데이터가 있는 경우 `NULL`이 아닌 Default 값으로 채워지는지 확인 (`IF NOT EXISTS` 사용).

- [x] **P1-02**: 마이그레이션 실행 및 스키마 검증
  - `Target`: Supabase Dashboard SQL Editor
  - `Detail`: 작성된 SQL 스크립트 실행.
  - `Dependency`: P1-01

**Verification:**

- [x] Schema Check: Supabase Table Editor에서 `category` 컬럼 및 인덱스 생성 확인.

---

### [Phase 2: UI Hotfix & Updates]

**Goal**: 긴급 로그인 이슈 해결 및 카테고리 선택 UI 구현.
**Source**: 회의록 5. 긴급 이슈 및 수정 계획 & 3. 합의 및 결정 사항 > Phase 2

**Before Start:**

- 영향받는 파일: `frontend/src/components/admin/SyntheticDataPanel.tsx`, `frontend/src/app/admin/raft/page.tsx`

**Implementation Items:**

- [x] **P2-00 (Pre)**: 카테고리 상수 정의

  - `Target`: `frontend/src/constants/raft.ts` (New)
  - `Detail`: `export const RAFT_CATEGORIES = ['미분류', '마케팅', '기술', '일반', '사내규정']` 정의.

- [x] **P2-01 (HOTFIX)**: 인증 로딩 상태 UI 버그 및 Dev Mode Pass-through 수정

  - `Target 1 (Server)`: `frontend/src/app/admin/raft/page.tsx`
    - `process.env.SKIP_RAFT_AUTH` 값을 읽어 `isDevMode={...}` prop으로 전달.
    - `searchParams.category` 값을 읽어 `initialCategory={...}` prop으로 전달.
  - `Target 2 (Client)`: `frontend/src/components/admin/SyntheticDataPanel.tsx`
    - Props 인터페이스에 `isDevMode`, `initialCategory` 추가.
    - `if (loading) return <Spinner />` 최상단 배치.
    - `const isAuthorized = user || isDevMode` 로직으로 권한 판단.
  - `Quality`: 로딩 깜빡임(Flicker) 방지.

- [x] **P2-02**: 카테고리 선택 드롭다운 UI 추가

  - `Target`: `frontend/src/components/admin/SyntheticDataPanel.tsx` (JSX 상단)
  - `Detail`:
    1. `RAFT_CATEGORIES` 상수 import.
    2. `selectedCategory` 상태 초기값을 `initialCategory || '미분류'`로 설정.
    3. "참고 자료" 입력란 위에 `RAFT_CATEGORIES.map`으로 `<select>` 렌더링.
  - `Dependency`: P2-01, P2-00
  - `Quality`: 접근성 준수 (`label`과 `select` 연결).

- [x] **P2-03 (목록 UI)**: 목록 조회 시 카테고리 필터 파라미터 연동
  - `Target`: `frontend/src/components/admin/RAFTDatasetList.tsx`
  - `Detail`:
    1. `loadData` 함수 호출 시 `selectedCategory` 상태를 인자로 전달하도록 인터페이스 수정 준비.
    2. (Phase 3 API 완료 후 연동될 부분임)

---

### [Phase 3: API Logic Update]

**Goal**: 선택된 카테고리로 데이터를 저장하고 조회하는 백엔드 로직 구현.
**Source**: 회의록 3. 합의 및 결정 사항 > Phase 3

**Before Start:**

- 영향받는 파일: `frontend/src/app/api/raft/generate/route.ts`, `frontend/src/app/api/raft/dataset/route.ts`

**Implementation Items:**

- [x] **P3-01**: 생성 API (`POST`) 카테고리 지원

  - `Target`: `frontend/src/app/api/raft/generate/route.ts`
  - `Detail`:
    1. Request Body 파싱 시 `category` 필드 추출 type 정의 추가.
    2. `raft_dataset` 테이블 `insert` 쿼리에 `category` 필드 매핑.
  - `Dependency`: P1-02 (DB 컬럼 존재 필수)

- [x] **P3-02**: 목록 조회 API (`GET`) 카테고리 필터 지원

  - `Target`: `frontend/src/app/api/raft/dataset/route.ts`
  - `Detail`:
    1. `searchParams`에서 `category` 파라미터 추출.
    2. Supabase 쿼리 빌더에 `.eq('category', category)` 조건부 체이닝 추가.

- [x] **P3-03**: 클라이언트 API 유틸 업데이트

  - `Target`: `frontend/src/lib/api/raft.ts`
  - `Detail`:
    1. `generateSyntheticDataAPI` 함수 인자에 `category` 추가.
    2. `fetchRAFTDataset` 함수 옵션에 `category` 추가.
  - `Dependency`: P3-01, P3-02

- [x] **P3-04**: UI - API 연동 마무리
  - `Target`: `frontend/src/components/admin/SyntheticDataPanel.tsx`
  - `Detail`: `handleGenerate` 함수에서 선택된 `selectedCategory`를 API로 전달.

---

### [Phase 4: Verification]

**Goal**: 카테고리 격리 동작 검증.
**Source**: 회의록 4. 향후 기대 효과

**Verification:**

- [x] **V4-01**: Syntax Check
  - `Command`: `npx tsc --noEmit`
- [x] **V4-02 (Hotfix)**: Login State Test
  - 시나리오: 로그아웃 상태에서 `/admin/raft` 접속 시 스피너 → "로그인 필요" 순서로 뜨는지 확인 (깜빡임 없는지).
- [x] **V4-03**: Data Isolation Test
  - 시나리오:
    1. 카테고리 'A'로 데이터 생성.
    2. 'A' 카테고리 필터 선택 시 목록에 보임.
    3. 'B' 카테고리 필터 선택 시 목록에서 사라짐 (0건).
- [x] **V4-04**: Regression Test
  - 기존 '미분류' 데이터들이 정상적으로 조회되는지 확인.
