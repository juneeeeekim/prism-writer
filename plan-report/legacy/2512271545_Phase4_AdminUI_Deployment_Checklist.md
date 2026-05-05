# Phase 4: Admin UI 개선 및 배포 체크리스트

**문서 정보**

- **작성일**: 2025-12-27
- **작성자**: Antigravity (Assistant)
- **관련 파일**: `implementation_plan.md`, `AuthHeader.tsx`

**파일 구성 전략: 단일 파일 구성 (Single File Strategy)**

> **선택 근거**: 이번 작업(UI 링크 1개 추가 + 빌드)은 작업 범위가 작고 명확합니다. 파일을 분리할 경우 오히려 Context Switching으로 인한 오버헤드가 발생할 수 있어, **단일 파일에서 개발-검증-배포** 흐름을 한눈에 파악하는 것이 협업 및 검증 효율면에서 최적이라 판단했습니다.

---

## Phase 1: Admin UI 접근성 개선 (Frontend)

**영향받을 수 있는 기존 기능**

- 헤더 레이아웃 (`AuthHeader.tsx`): 로고 및 기존 메뉴(RAG 검색) 배치
- 인증 상태 표시: 로그인/로그아웃 및 프로필 드롭다운 동작

### 1-1. `AuthHeader` 컴포넌트 수정

- **위치**: `frontend/src/components/auth/AuthHeader.tsx` (Line 49 근처)

#### [Step 1] `useAuth` 훅 반환값 구조 분해 추가

- [ ] `isAdmin` 속성 추가 추출
  - **코드**: `const { user, ..., isAdmin } = useAuth()`
  - **품질 체크**: `useAuth` 훅이 이미 `isAdmin`을 반환하는지 확인 (이전 분석 완료)

#### [Step 2] Admin 대시보드 링크 렌더링 로직 추가

- **위치**: 로고/RAG 검색 네비게이션 섹션 (Line 76 `</nav>` 직전)
- **연결성**: `isAdmin` 변수 값에 의존하여 조건부 렌더링 (`{isAdmin && ...}`)
- [ ] **링크 컴포넌트 구현**
  - **태그**: `<Link href="/admin/feedback">`
  - **스타일**: 기존 "RAG 검색" 링크와 유사하되, 관리자용 구분을 위한 색상/아이콘 적용
    - 예: `text-purple-600` 또는 `🛡️` 아이콘 포함
  - **접근성(Check)**: `aria-label="관리자 대시보드"` 속성 필수 추가
- [ ] **구분선 추가 (선택)**
  - 필요한 경우 일반 메뉴와 구분하기 위한 스타일 적용

#### [Step 3] 모바일 반응형 고려 (선택 사항)

- [ ] 모바일 뷰에서도 접근 가능한지 확인 (또는 데스크톱 전용으로 유지할지 결정)
  - _현재 정책_: 모바일에서는 헤더 공간 부족 시 숨김 처리 고려

### ✅ Phase 1 검증 (Verification)

- **Syntax Check**:
  - [ ] `npm run lint` 또는 편집기 내 오류 없음 확인
- **Browser Test (수동)**:
  - [ ] **Scenario A (Admin)**: `admin` 권한 계정 로그인 → 헤더에 "🛡️ 관리자" 링크 표시 확인 → 클릭 시 `/admin/feedback` 이동
  - [ ] **Scenario B (User)**: 일반 계정 로그인 → 링크 **미표시** 확인
  - [ ] **Scenario C (Guest)**: 비로그인 상태 → 링크 **미표시** 확인

---

## Phase 2: 배포 준비 및 검증 (Deployment)

**영향받을 수 있는 기존 기능**

- 전체 애플리케이션 (빌드 실패 시 배포 불가)

### 2-1. 프로덕션 빌드 테스트

- **위치**: 터미널 (`frontend` 디렉토리)

#### [Step 1] 전체 빌드 실행

- [ ] 명령어 실행: `npm run build`
- **품질 체크**:
  - [ ] TypeScript 타입 에러(TS Error) 발생 여부 확인
  - [ ] ESLint 경고/에러 확인

#### [Step 2] 빌드 아티팩트 확인 (로컬)

- [ ] `npm start`로 프로덕션 모드 실행
- [ ] 주요 페이지 로딩 속도 및 동작 확인

### ✅ Phase 2 검증 (Verification)

- **Terminal Output**:
  - [ ] `Compiled successfully` 메시지 확인
  - [ ] 빌드 에러 "0" 확인

---

## 3) 🚀 최종 배포 승인 (Sign-off)

- [ ] Admin UI 링크 기능 정상 동작 (Phase 1 Passed)
- [ ] 프로덕션 빌드 성공 (Phase 2 Passed)
- [ ] **디렉터 승인**: 배포 진행 (Vercel Push)
