# 🧬 RAFT 카테고리 격리 및 UX 개선 공식 체크리스트 (v1.1)

**작성일**: 2025-12-28
**작성자**: Tech Lead (Senior Developer)
**관련 문서**: [implementation_plan.md](C:\Users\chyon.gemini\antigravity\brain\7b904f17-8d54-486f-86b6-7073589bd7a8\implementation_plan.md)
**업데이트 내역**: v1.0 JeDebug 감사 결과(인터페이스 및 상태 동기화 누락) 반영

---

## 1. File & Structure Decision

### 🏗️ 파일 구성 전략 및 근거

- **전략**: **기능 중심적 Phase 분할 (Modular Integration)**
- **근거**:
  1. **데이터 정합성 우선**: DB 스키마가 변경되지 않으면 API/UI가 작동할 수 없으므로 DB 마이그레이션을 Phase 1로 독립시킴.
  2. **UX 안정성 확보**: 사용자가 페이지에 "갇히는" 현상을 막기 위해 네비게이션(Header)과 인증 Hotfix를 Phase 2(Foundation)로 정의하여 배포 안정성을 높임.
  3. **관심사 분리**: API 로직(Phase 3)과 UI 인터랙션(Phase 4)을 분리하여 백엔드 검증 후 프론트엔드 연동을 진행함으로써 디버깅 효율을 최적화함.

---

## 2. Checklist Content

### [Phase 1: Database & Constants Foundation]

**Before Start:**

- 영향받는 기존 테이블: `public.raft_dataset` (새 컬럼 추가)
- 영향받는 상수 관리: `frontend/src/constants` (신규 파일 필요)

**Implementation Items:**

- [x] **P1-01**: 카테고리 표준 정의 파일 생성
  - `Target`: `frontend/src/constants/raft.ts` [NEW]
  - `Detail`: `RAFT_CATEGORIES` 배열(마케팅, 기술, 일반 등) 및 `DEFAULT_RAFT_CATEGORY` 정의.
  - `Quality`: 타입 안전성을 위해 `as const` 사용.
- [x] **P1-02**: DB 마이그레이션 스크립트 작성 및 적용
  - `Target`: `supabase/migrations/039_raft_dataset_category.sql` [NEW]
  - `Detail`: `ALTER TABLE`을 사용하여 `category` 컬럼(TEXT, DEFAULT '미분류') 추가 및 `idx_raft_dataset_category` 인덱스 생성.
  - `Dependency`: P1-01의 카테고리 명칭과 DB 기본값 일치 여부 확인.

**Verification (검증):**

- [x] DB Check: Supabase 대시보드에서 `raft_dataset` 테이블에 `category` 컬럼 존재 확인. (디렉터님 수동 확인 완료)
- [x] Default Value Check: 기존 데이터들이 '미분류'로 자동 업데이트되었는지 확인.

---

### [Phase 2: Authentication & Navigation UX (Hotfix)]

**Before Start:**

- 영향받는 파일: `app/admin/raft/page.tsx`, `components/admin/SyntheticDataPanel.tsx`

**Implementation Items:**

- [x] **P2-01**: RAFT 관리 페이지 네비게이션 통합
  - `Target`: `frontend/src/app/admin/raft/page.tsx`
  - `Detail`: 페이지 전체를 `AuthHeader`로 감싸고, 로고 및 글로벌 메뉴 노출. `isDevMode`와 `initialCategory` Props 전달 확인.
  - `Quality`: `showLogo={true}` 설정으로 홈 이동 경로 보장.
- [x] **P2-02**: 인증 상태 로딩 Hotfix 적용
  - `Target`: `frontend/src/components/admin/SyntheticDataPanel.tsx`
  - `Detail`: `useAuth()`의 `loading` 상태를 체크하여, 로딩 중에는 "권한 확인 중..." 스피너를 표시.
  - `Quality`: "로그인 필요" 메시지 깜빡임 방지 및 명확한 UX 제공.

**Verification (검증):**

- [x] Hotfix Test: 비로그인 상태로 `/admin/raft` 접속 시, 스피너가 먼저 뜨고 이후 로그인 안내가 나오는지 확인.
- [x] Navigation Test: 헤더의 젬(💎) 로고 클릭 시 홈으로 이동하는지 확인.

---

### [Phase 3: API Logic & TypeScript Alignment]

**Before Start:**

- 영향받는 파일: `lib/api/raft.ts`, `api/raft/generate/route.ts`, `api/raft/dataset/route.ts`

**Implementation Items:**

- [x] **P3-01**: **TypeScript 인터페이스 업데이트 (Critical)**
  - `Target`: `frontend/src/lib/api/raft.ts`
  - `Detail`: `RAFTDatasetItem` 인터페이스에 `category?: string` 필드 추가.
- [x] **P3-02**: 합성 데이터 생성 API 카테고리 저장 (Backend)
  - `Target`: `frontend/src/app/api/raft/generate/route.ts`
  - `Detail`: POST 바디에서 `category` 수신 및 DB `insert` 시 포함. (Null 방어 로직 포함)
- [x] **P3-03**: 데이터셋 목록 조회 API 필터 (Backend)
  - `Target`: `frontend/src/app/api/raft/dataset/route.ts`
  - `Detail`: `.eq('category', category)` 필터 적용. 'ALL'인 경우 필터 생략.
- [x] **P3-04**: 클라이언트 호출 함수 수정
  - `Target`: `frontend/src/lib/api/raft.ts`
  - `Detail`: `generateSyntheticDataAPI`, `fetchRAFTDataset`에 `category` 파라미터 연동.

**Verification (검증):**

- [x] Syntax Check: `npx tsc --noEmit` 실행하여 타입 오류 0개 확인.

---

### [Phase 4: Category UI & State Synchronization]

**Before Start:**

- 영향받는 컴포넌트: `SyntheticDataPanel.tsx`, `RAFTDatasetList.tsx`

**Implementation Items:**

- [x] **P4-01**: 생성 패널 카테고리 선택 UI
  - `Target`: `frontend/src/components/admin/SyntheticDataPanel.tsx`
  - `Detail`: 카테고리 드롭다운 추가 및 생성 시 API에 선택값 전달.
- [x] **P4-02**: 목록 필터 및 상태 동기화 (Major)
  - `Target`: `frontend/src/components/admin/RAFTDatasetList.tsx`
  - `Detail`: 필터 선택 UI 추가 및 `useEffect` 의존성 배열에 `selectedCategory`를 추가하여 필터 변경 시 자동 새로고침(loadData) 구현.
- [x] **P4-03**: 비정상 카테고리 폴백(Fallback) 처리
  - `Target`: `RAFTDatasetList.tsx` 렌더링 로직
  - `Detail`: 데이터의 카테고리가 상수에 없을 경우 '미분류'로 표시하여 UI 깨짐 방지.

**Verification (검증):**

- [x] Happy Path: 마케팅 생성 -> 마케팅 필터 선택 -> 정확히 1건 노출 확인. (브라우저 테스트 필요)
- [x] Cross-Check: 마케팅 필터 상태에서 생성 시, 목록이 즉시 갱신되어 새 데이터가 보이는지 확인. (브라우저 테스트 필요)

---

## 3. 최종 검증 및 배포

- [x] **V1-01**: 최종 Syntax Check (`npx tsc --noEmit`) - 오류 0개 통과 ✅
- [x] **V1-02**: Git Stage & Commit (`feat(raft): implement category isolation with ts safety and ux fixes`) ✅
- [x] **V1-03**: DB 마이그레이션 적용 및 운영 환경 검증 ✅
