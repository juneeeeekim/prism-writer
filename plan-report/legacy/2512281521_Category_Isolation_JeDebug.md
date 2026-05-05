# 🐞 JeDebug Review: Category Isolation Checklist

**Reviewer**: JeDebug (Senior Lead Developer)
**Date**: 2025-12-28
**Target**: `2512281520_Category_Isolation_Checklist.md`

---

## 🚦 Final Decision

**[⚠️ 체크리스트 수정 후 진행]**

> **Critical Issue**: `SKIP_RAFT_AUTH` 환경 변수는 서버 사이드(`page.tsx`)에서만 접근 가능합니다. 클라이언트 컴포넌트(`SyntheticDataPanel.tsx`)에서 직접 `process.env`를 호출하면 `undefined`가 되어 긴급 Hotfix가 작동하지 않습니다.

---

## 1. 🔧 로직 및 구현 보완 (Logic Fixes)

### [ ] (Critical) Client-Side Env Var Inaccessibility

- **원인**: `process.env.SKIP_RAFT_AUTH`는 Node.js 런타임 환경 변수이므로, 브라우저에서 실행되는 React Client Component에서 접근할 수 없습니다. (`NEXT_PUBLIC_` 접두사가 없으므로)
- **수정 제안**: (Phase 2 수정)
  - `P2-01` 항목 수정: `SyntheticDataPanel` 내부에서 `process.env`를 참조하지 말고, 상위 서버 컴포넌트(`page.tsx`)에서 props로 전달받도록 변경해야 합니다.
- **파일/위치**: `frontend/src/app/admin/raft/page.tsx` -> `frontend/src/components/admin/SyntheticDataPanel.tsx`

### [ ] (Major) Category Hardcoding Prevention

- **원인**: 체크리스트에 '임시 하드코딩'으로 되어 있으나, 이는 유지보수 비용을 증가시키고 정합성을 해칩니다.
- **수정 제안**: (Phase 2 수정)
  - `src/constants/raft.ts` (또는 `featureFlags.ts`) 파일을 생성하여 `RAFT_CATEGORIES` 상수 배열을 정의하고, 이를 UI와 API가 공통으로 참조하도록 변경하십시오.
- **파일/위치**: `frontend/src/constants/raft.ts` (New)

### [ ] (Minor) Auto-detect Mechanism Gap

- **원인**: "자동 감지" 요구사항이 있으나, 현재 체크리스트에는 구현 상세가 없습니다.
- **수정 제안**: (Phase 2 수정)
  - `page.tsx`가 URL Query Parameter (`?category=...`)를 읽어서 `SyntheticDataPanel`의 `initialCategory` prop으로 전달하는 로직을 추가하십시오. 향후 에디터 연동 시 이 파라미터만 붙이면 됩니다.

---

## 2. 🚨 리스크 및 안전장치 (Risk Guardrails)

### [ ] (High) Auth Loading Flicker (Hotfix Risk)

- **위험 요소**: `useAuth`의 `loading` 상태가 `false`로 변하는 시점과 `user` 객체가 갱신되는 시점 사이에 미세한 간극이 있을 경우, "로그인 필요" 메시지가 순간적으로 깜빡일 수 있습니다.
- **방어 코드 추가 제안**:
  - `SyntheticDataPanel` 렌더링 조건: `if (loading) return <Spinner />;`를 최상단에 배치.
  - `skipAuth` prop이 `true`이면 `loading` 상태와 무관하게 즉시 패널 렌더링 허용.

---

## 3. 🧪 검증 기준 구체화 (Test Criteria)

### Happy Path

- [ ] **Hotfix Verification**:
  1. `.env` 없이(Prod 모드) 로그아웃 상태에서 `/admin/raft` 접속 -> **Spinner 보이다가 로그인 경고 메시지로 전환** (깜빡임 X).
  2. `.env` 설정(Dev 모드) 후 로그아웃 상태에서 접속 -> **즉시 패널 렌더링** (경고 메시지 X).
- [ ] **Category Flow**:
  1. '마케팅' 선택 후 생성 -> DB `raft_dataset` 테이블 `category` 컬럼에 '마케팅' 저장 확인.
  2. 목록에서 '마케팅' 필터 선택 -> 방금 생성한 데이터 보임.
  3. 목록에서 '기술' 필터 선택 -> 데이터 안 보임.

### Edge Case

- [ ] **Invalid Category**: URL로 `?category=없는카테고리` 입력 시 -> 기본값('미분류')으로 Fallback 동작 확인.

---

## ✅ Revised Checklist (수정된 항목만)

### [Phase 2: UI Hotfix & Updates]

- [ ] **P2-00 (Pre)**: 카테고리 상수 정의

  - `Target`: `frontend/src/constants/raft.ts`
  - `Detail`: `export const RAFT_CATEGORIES = ['미분류', '마케팅', '기술', '일반', '사내규정']` 정의.

- [ ] **P2-01 (HOTFIX)**: 인증 로딩 상태 UI 버그 및 Dev Mode Pass-through 수정

  - `Target 1 (Server)`: `frontend/src/app/admin/raft/page.tsx`
    - `process.env.SKIP_RAFT_AUTH` 값을 읽어 `isDevMode={...}` prop으로 전달.
    - `searchParams.category` 값을 읽어 `initialCategory={...}` prop으로 전달.
  - `Target 2 (Client)`: `frontend/src/components/admin/SyntheticDataPanel.tsx`
    - Props 인터페이스에 `isDevMode`, `initialCategory` 추가.
    - `if (loading) return <Spinner />` 최상단 배치.
    - `const isAuthorized = user || isDevMode` 로직으로 권한 판단.

- [ ] **P2-02**: 카테고리 선택 드롭다운 UI 추가
  - `Detail`: `RAFT_CATEGORIES` 상수 import하여 map으로 렌더링. `initialCategory`를 초기 상태로 사용.
