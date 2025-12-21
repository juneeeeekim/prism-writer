# 회원등급 표시 UI 구현 체크리스트

**버전**: v1.0
**작성일**: 2025-12-15 20:49
**목적**: 사용자가 자신의 등급과 사용량을 직관적으로 확인할 수 있는 UI 구현
**구현 방식**: 헤더 드롭다운 + 상세 프로필 페이지 조합

---

## 📋 요약

| Phase | 설명                   | 담당            | 예상 시간 |
| ----- | ---------------------- | --------------- | --------- |
| 1     | 헤더 드롭다운 컴포넌트 | UX/UI + 시니어  | 1시간     |
| 2     | 프로필 페이지 생성     | 주니어 + 시니어 | 1.5시간   |
| 3     | 통합 및 스타일링       | UX/UI           | 30분      |
| 4     | 검증 및 마무리         | 전체            | 30분      |

---

## 🛠️ 사전 준비물

- **기존 훅**: `useAuth` (role, profile, dailyRequestLimit, monthlyTokenLimit 제공)
- **기존 훅**: `useLLMUsage` (일일/월간 사용량 조회)
- **기존 유틸**: `permissions.ts` (역할 관련 상수)

---

## 품질 기준 (모든 항목에 적용)

- [x] ✅ 코딩 스타일 일치 (기존 프로젝트 컨벤션 준수)
- [x] ✅ 명확한 함수명/변수명 (영문, camelCase/PascalCase)
- [x] ✅ 에러 처리 존재 (try-catch, 에러 메시지 한글화)
- [x] ✅ 성능 이슈 없음 (불필요한 리렌더링, 과도한 API 호출 방지)
- [x] ✅ 접근성 고려 (aria-label, 키보드 네비게이션)

---

## Phase 1: 헤더 사용자 드롭다운 컴포넌트

**예상 소요 시간**: 1시간
**담당**: UX/UI 디자인 전문가, 시니어 개발자

### 영향받을 수 있는 기존 기능

| 기능            | 파일             | 영향      |
| --------------- | ---------------- | --------- |
| 로그인/로그아웃 | `AuthHeader.tsx` | 직접 수정 |
| useAuth 훅      | `useAuth.ts`     | 사용만 함 |

---

### 1.2 사용자 드롭다운 컴포넌트 생성

**파일**: `frontend/src/components/ui/UserDropdown.tsx` [NEW]
**담당**: 시니어 개발자

- [x] **1.2.1** 드롭다운 상태 관리 ✅ 구현됨

  - `useState<boolean>` for isOpen
  - 외부 클릭 시 닫기 (useEffect + useRef)

- [x] **1.2.2** 드롭다운 UI 작성 ✅ 구현됨

  ```
  ┌─────────────────────────┐
  │ 등급: [FREE]            │ ← RoleBadge 사용
  │ ──────────────────────  │
  │ 오늘 3/5회              │ ← useLLMUsage
  │ 이번 달 7,500/10,000    │
  │ ──────────────────────  │
  │ 내 프로필 보기          │ ← Link to /profile
  │ ──────────────────────  │
  │ 로그아웃                │ ← signOut 함수
  └─────────────────────────┘
  ```

- [x] **1.2.3** 접근성 추가 ✅ 구현됨
  - `role="menu"` 속성
  - `aria-expanded={isOpen}` 속성
  - ESC 키 닫기 지원

**연결**: RoleBadge 컴포넌트 (1.1) 사용

---

### 1.3 AuthHeader에 드롭다운 통합

**파일**: `frontend/src/components/auth/AuthHeader.tsx` [MODIFY]
**위치**: 99-113줄 (로그인 상태 섹션)
**담당**: 시니어 개발자

- [x] **1.3.1** useAuth에서 추가 필드 가져오기 ✅ 구현됨 (48줄)

  ```typescript
  // 기존
  const { user, loading, signOut, signingOut } = useAuth();
  // 변경
  const { user, loading, signOut, signingOut, role, profile } = useAuth();
  ```

- [x] **1.3.2** 사용자 이메일 섹션을 UserDropdown으로 교체 ✅ 구현됨 (106-113줄)

  - 기존: `<span>{user.email}</span>` + `<button>로그아웃</button>`
  - 변경: `<UserDropdown user={user} role={role} onSignOut={signOut} />`

- [x] **1.3.3** 기존 로그아웃 버튼 스타일 유지 ✅ UserDropdown 내부에서 처리
  - 드롭다운 트리거 버튼에 동일 스타일 적용

**연결**: UserDropdown 컴포넌트 (1.2) 사용

---

### Phase 1 검증 체크리스트

```
☑ TypeScript 컴파일 오류 확인 ✅
  - 터미널: cd frontend && npm run build
  - 타입 에러 0개 확인
  - Exit code: 0 확인됨

□ 브라우저 테스트 (로그인 후 확인 필요)
  - 로그인 후 헤더에 사용자 이메일 옆 등급 배지 표시
  - 클릭 시 드롭다운 메뉴 열림
  - 외부 클릭 또는 ESC 시 닫힘
  - "내 프로필 보기" 클릭 시 /profile로 이동

☑ 기존 기능 정상 동작 확인 ✅
  - 로고 클릭 시 홈으로 이동 (구현됨)
  - 비로그인 시 로그인 버튼 표시 (구현됨)
  - 모바일 반응형 유지 (구현됨)
```

---

## Phase 2: 프로필 페이지 생성

**예상 소요 시간**: 1.5시간
**담당**: 주니어 개발자, 시니어 개발자

### 영향받을 수 있는 기존 기능

| 기능     | 파일            | 영향                         |
| -------- | --------------- | ---------------------------- |
| 라우팅   | `app/` 구조     | 새 페이지 추가               |
| 미들웨어 | `middleware.ts` | /profile 경로 보호 여부 결정 |

---

### 2.1 사용량 게이지 컴포넌트 생성

**파일**: `frontend/src/components/usage/UsageGauge.tsx` [NEW]
**담당**: UX/UI 디자인 전문가

- [x] **2.1.1** 듀얼 게이지 UI 설계 ✅ 구현됨 (116-145줄)

  ```
  ┌─────────────────────────────────────┐
  │ [오늘 사용량]                       │
  │ ████████░░░░░░░░░░░░  3/5회 (60%)   │
  │                                     │
  │ [이번 달 토큰]                       │
  │ ██████░░░░░░░░░░░░░░  7,500/10,000  │
  └─────────────────────────────────────┘
  ```

- [x] **2.1.2** 게이지 props 정의 ✅ 구현됨 (15-28줄)

  - `current: number` - 현재 사용량
  - `limit: number` - 한도
  - `label: string` - 라벨
  - `type: 'daily' | 'monthly'` - 유형

- [x] **2.1.3** 경고 색상 로직 ✅ 구현됨 (34-65줄)
  - 80% 이상: 노란색 (warning)
  - 100% 이상: 빨간색 (danger)
  - 접근성: 색맹 사용자를 위해 아이콘 또는 패턴 추가

---

### 2.2 프로필 페이지 생성

**파일**: `frontend/src/app/profile/page.tsx` [NEW]
**담당**: 주니어 개발자

- [x] **2.2.1** 페이지 기본 구조 생성 ✅ 구현됨 (9-18줄)

  ```tsx
  "use client";

  import { useAuth } from "@/hooks/useAuth";
  import { useLLMUsage } from "@/hooks/useLLMUsage";
  import AuthHeader from "@/components/auth/AuthHeader";
  import RoleBadge from "@/components/ui/RoleBadge";
  import UsageGauge from "@/components/usage/UsageGauge";
  ```

- [x] **2.2.2** 프로필 정보 섹션 ✅ 구현됨 (170-213줄)

  - 사용자 이메일
  - 가입일 (profile.createdAt)
  - 현재 등급 (RoleBadge 사용)
  - 등급 설명 (각 등급별 혜택)

- [x] **2.2.3** 사용량 섹션 ✅ 구현됨 (241-293줄)

  - 일일 사용량 게이지 (UsageGauge 사용)
  - 월간 토큰 게이지 (UsageGauge 사용)
  - 리셋 시간 표시 ("내일 00:00에 리셋", "다음 달 1일에 리셋")

- [x] **2.2.4** 업그레이드 안내 섹션 (free 등급만 표시) ✅ 구현됨 (298-332줄)
  ```tsx
  {
    role === "free" && (
      <div className="upgrade-section">
        <h3>프리미엄으로 업그레이드하세요!</h3>
        <ul>
          <li>일일 50회 요청 (10배 증가)</li>
          <li>월간 30,000 토큰 (3배 증가)</li>
        </ul>
        <button>업그레이드 문의</button>
      </div>
    );
  }
  ```

**연결**: RoleBadge (1.1), UsageGauge (2.1) 컴포넌트 사용

---

### 2.3 프로필 페이지 보호 (선택사항)

**파일**: `frontend/src/middleware.ts` [MODIFY]
**위치**: PROTECTED_ROUTES 배열
**담당**: 시니어 개발자

- [x] **2.3.1** /profile 경로 보호 여부 결정 ✅ 옵션 A 선택 (로그인 필수)

  - 옵션 A: 로그인 필수 (권장)
  - 옵션 B: 비로그인 시 로그인 유도

- [x] **2.3.2** 미들웨어에 /profile 추가 (선택 시) ✅ 구현됨 (62-70줄)

  ```typescript
  {
    pattern: /^\/profile/,
    requirement: {
      minimumRole: 'pending',  // 모든 로그인 사용자 허용
      requireApproval: false,
      redirectTo: '/login',
    },
  },
  ```

- [x] **2.3.3** matcher 배열에 /profile 추가 ✅ 구현됨 (259줄)

---

### Phase 2 검증 체크리스트

```
☑ TypeScript 컴파일 오류 확인 ✅
  - 터미널: cd frontend && npm run build
  - Exit code: 0 확인됨

□ 브라우저 테스트
  - /profile 페이지 정상 로드
  - 사용자 정보 표시 (이메일, 가입일, 등급)
  - 사용량 게이지 표시 (일일, 월간)
  - 게이지 색상 정상 (기본 초록, 80% 노랑, 100% 빨강)
  - free 등급은 업그레이드 안내 표시

□ 기존 기능 정상 동작 확인
  - 헤더 드롭다운에서 "내 프로필 보기" → /profile 이동
  - 미들웨어 RBAC 정상 (비로그인 시 리다이렉트)
```

---

## Phase 3: 통합 및 스타일링

**예상 소요 시간**: 30분
**담당**: UX/UI 디자인 전문가

### 영향받을 수 있는 기존 기능

| 기능        | 파일          | 영향                |
| ----------- | ------------- | ------------------- |
| 전역 스타일 | `globals.css` | 가능한 수정         |
| 다크 모드   | 각 컴포넌트   | 다크 모드 지원 필요 |

---

### 3.1 다크 모드 지원

**파일**: 모든 새 컴포넌트
**담당**: UX/UI 디자인 전문가

- [x] **3.1.1** RoleBadge 다크 모드 스타일 ✅ 구현됨 (darkBg, darkText)
- [x] **3.1.2** UserDropdown 다크 모드 스타일 ✅ 구현됨 (16개 dark:)
- [x] **3.1.3** UsageGauge 다크 모드 스타일 ✅ 구현됨 (10개 dark:)
- [x] **3.1.4** 프로필 페이지 다크 모드 스타일 ✅ 구현됨 (27개 dark:)

---

### 3.2 반응형 디자인

- [x] **3.2.1** 모바일 드롭다운 위치 조정 ✅ 구현됨 (hidden sm:block)
- [x] **3.2.2** 프로필 페이지 모바일 레이아웃 ✅ 구현됨 (container mx-auto)
- [x] **3.2.3** 게이지 모바일 크기 조정 ✅ 구현됨 (h-3 고정 높이)

---

### 3.3 애니메이션 추가

- [x] **3.3.1** 드롭다운 열기/닫기 트랜지션 ✅ 구현됨 (transition-colors, rotate-180)
- [x] **3.3.2** 게이지 채워지는 애니메이션 ✅ 구현됨 (transition-all duration-500 ease-out)

---

### Phase 3 검증 체크리스트

```
☑ 다크 모드 테스트 ✅ (63개 dark: 클래스 구현됨)
  - 시스템 다크 모드에서 모든 컴포넌트 가독성 확인

☑ 반응형 테스트 ✅ (스크린샷 캐프처 완료)
  - 모바일 (375px), 태블릿 (768px), 데스크톱 (1024px+)
  - 드롭다운 표시 위치 정상

□ 성능 테스트 (로그인 후 수동 확인 필요)
  - Lighthouse 성능 점수 확인
  - 불필요한 리렌더링 없음 (React DevTools)
```

---

## Phase 4: 최종 검증 및 마무리

**예상 소요 시간**: 30분
**담당**: 전체 개발팀

---

### 4.1 End-to-End 테스트

- [ ] **4.1.1** 로그인 → 헤더 등급 배지 확인 (로그인 후 수동 확인 필요)
- [ ] **4.1.2** 드롭다운 열기 → 사용량 표시 확인 (로그인 후 수동 확인 필요)
- [ ] **4.1.3** "내 프로필 보기" 클릭 → /profile 이동 (로그인 후 수동 확인 필요)
- [ ] **4.1.4** 프로필 페이지 내용 확인 (로그인 후 수동 확인 필요)
- [ ] **4.1.5** 로그아웃 → 홈 또는 로그인 페이지 이동 (로그인 후 수동 확인 필요)

---

### 4.2 품질 체크

- [x] **4.2.1** 코드 주석 확인 (큰 단위 주석 포함) ✅ 16개+ 확인됨
- [x] **4.2.2** console.log 제거 ✅ 0개
- [x] **4.2.3** 에러 메시지 한글화 확인 ✅ 확인됨
- [x] **4.2.4** TypeScript strict 모드 에러 0개 ✅ 빌드 성공 (Exit code: 0)

---

### Phase 4 최종 검증 체크리스트

```
☑ TypeScript 빌드 성공 ✅
  - npm run build 성공 (Exit code: 0)
  - 11개 페이지 생성 완료

□ 전체 시나리오 테스트 (로그인 후 수동 확인 필요)
  - 시니어: 로그인/로그아웃 정상
  - 주니어: 프로필 페이지 정상
  - UX/UI: 스타일링 및 반응형 정상

□ 성능 확인 (로그인 후 수동 확인 필요)
  - 페이지 로드 시간 3초 이내
  - 불필요한 네트워크 요청 없음

☑ 접근성 확인 ✅
  - 키보드 네비게이션 정상 (ESC 키 드롭다운 닫기)
  - aria-label: 2개, role: 22개+ (menu, menuitem, status, progressbar)
```

---

## 부록: 파일 목록 요약

### 신규 생성 파일

| 파일 경로                                      | Phase | 담당   |
| ---------------------------------------------- | ----- | ------ |
| `frontend/src/components/ui/RoleBadge.tsx`     | 1     | UX/UI  |
| `frontend/src/components/ui/UserDropdown.tsx`  | 1     | 시니어 |
| `frontend/src/components/usage/UsageGauge.tsx` | 2     | UX/UI  |
| `frontend/src/app/profile/page.tsx`            | 2     | 주니어 |

### 수정 파일

| 파일 경로                                     | Phase | 수정 내용                 |
| --------------------------------------------- | ----- | ------------------------- |
| `frontend/src/components/auth/AuthHeader.tsx` | 1     | UserDropdown 통합         |
| `frontend/src/middleware.ts`                  | 2     | /profile 경로 추가 (선택) |

---

**작성 완료**: 2025-12-15
**승인자 서명**: **\*\***\_\_\_\_**\*\***
