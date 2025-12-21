# 🔐 PRISM Writer - Google OAuth 통합 구현 회의록 및 체크리스트

> **문서 작성일:** 2025년 12월 14일
> **목적:** Supabase Google OAuth 통합 구현
> **예상 소요:** 0.5일

---

## 📋 요약

**목표:** PRISM Writer에 Google 소셜 로그인 기능을 추가하여 사용자가 Google 계정으로 쉽게 가입/로그인할 수 있도록 합니다.

**현재 상태:**

- ✅ 이메일/비밀번호 인증 시스템 구현 완료
- ✅ Supabase 무료 플랜에서 Google OAuth 사용 가능
- ⏳ Google OAuth 설정 필요

---

## 👥 회의 참석자 및 아이디어

### 🎯 시니어 개발자 (사회자)

**역할:** 전체 구현 방향 설정 및 기술 검토

**아이디어:**

> Google OAuth는 3단계로 나누어 진행합니다.
>
> 1. Google Cloud Console 설정 (디렉터님 직접 진행)
> 2. Supabase Provider 설정 (디렉터님 직접 진행)
> 3. 프론트엔드 버튼 구현 (개발팀 진행)

**기술 검토:**

- Supabase `signInWithOAuth()` 함수 사용
- OAuth 리다이렉트 방식 (팝업 X)
- 콜백 라우트 이미 구현됨 (`/auth/callback`)

---

### 👨‍💻 주니어 개발자

**역할:** 프론트엔드 구현 담당

**아이디어:**

> 로그인/회원가입 페이지에 "Google로 계속하기" 버튼을 추가합니다.
> 기존 이메일 폼과 "OR" 구분선으로 분리하여 UX를 개선합니다.

**구현 계획:**

```tsx
// Google 로그인 버튼 예시
<button onClick={handleGoogleLogin}>
  <GoogleIcon /> Google로 계속하기
</button>
```

**예상 수정 파일:**

- `frontend/src/app/login/page.tsx`
- `frontend/src/app/signup/page.tsx`

---

### 🎨 UX/UI 디자인 전문가

**역할:** 사용자 경험 및 디자인 검토

**아이디어:**

> Google 버튼은 Google 브랜드 가이드라인을 준수해야 합니다.
>
> - 흰색 배경 + 다크 텍스트
> - Google 로고 아이콘 포함
> - 버튼 크기: 최소 40px 높이

**디자인 제안:**

```
┌─────────────────────────────────────┐
│  [G] Google로 계속하기               │
└─────────────────────────────────────┘
         ────── 또는 ──────
┌─────────────────────────────────────┐
│  이메일 입력                         │
└─────────────────────────────────────┘
```

---

### 🔧 백엔드 개발자

**역할:** 보안 및 인프라 검토

**아이디어:**

> OAuth 보안 고려사항:
>
> - PKCE (Proof Key for Code Exchange) 자동 적용 (Supabase 기본값)
> - HTTPS 필수 (Vercel에서 자동 제공)
> - 리다이렉트 URL 화이트리스트 설정 필요

**보안 체크리스트:**

- [ ] Google Cloud에서 authorized redirect URI 정확히 설정
- [ ] Supabase Site URL 올바르게 설정 확인
- [ ] 프로덕션과 개발 환경 콜백 URL 모두 등록

---

## 📝 구현 체크리스트

### Phase 1: Google Cloud Console 설정 (디렉터님 직접)

- [ ] **1.1 Google Cloud 프로젝트 접속/생성**

  - URL: https://console.cloud.google.com
  - 기존 프로젝트 사용 또는 새 프로젝트 생성

- [ ] **1.2 OAuth 동의 화면 설정**

  - APIs & Services → OAuth consent screen
  - User Type: External
  - 앱 이름: PRISM Writer
  - 사용자 지원 이메일: 본인 이메일
  - 개발자 연락처: 본인 이메일
  - Scopes: email, profile (기본값)

- [ ] **1.3 OAuth 자격 증명 생성**
  - APIs & Services → Credentials → + CREATE CREDENTIALS
  - OAuth client ID 선택
  - Application type: Web application
  - Name: PRISM Writer Web
  - Authorized redirect URIs 추가:
    ```
    https://audrryykilmighhtdssoi.supabase.co/auth/v1/callback
    ```
  - CREATE 클릭
  - **Client ID와 Client Secret 복사해두기** ⚠️

---

### Phase 2: Supabase Provider 설정 (디렉터님 직접)

- [ ] **2.1 Supabase 대시보드 접속**

  - URL: https://supabase.com
  - 프로젝트 선택

- [ ] **2.2 Google Provider 활성화**

  - Authentication → Providers → Google 클릭
  - "Enable Sign in with Google" 토글 **ON**
  - Client IDs: Phase 1에서 복사한 값 붙여넣기
  - Client Secret: Phase 1에서 복사한 값 붙여넣기
  - **Save** 클릭

- [ ] **2.3 Site URL 및 Redirect URLs 확인**
  - Authentication → URL Configuration
  - Site URL: `https://prism-writer.vercel.app`
  - Redirect URLs에 다음 포함 확인:
    - `https://prism-writer.vercel.app/auth/callback`
    - `http://localhost:3000/auth/callback`

---

### Phase 3: 프론트엔드 구현 (개발팀)

- [x] **3.1 Google 로그인 함수 추가**

  - 파일: `frontend/src/hooks/useAuth.ts`
  - Supabase `signInWithOAuth()` 함수 추가 ✅
  - signInWithGoogle 함수 구현 완료

- [x] **3.2 로그인 페이지에 Google 버튼 추가**

  - 파일: `frontend/src/app/login/page.tsx`
  - Google 로고 + "Google로 계속하기" 버튼 ✅
  - 구분선 ("또는") 추가 ✅

- [x] **3.3 회원가입 페이지에 Google 버튼 추가**

  - 파일: `frontend/src/app/signup/page.tsx`
  - 동일한 Google 버튼 추가 ✅
  - 구분선 ("또는 이메일로 가입") 추가 ✅

- [x] **3.4 Google 아이콘 컴포넌트 생성**
  - 파일: `frontend/src/components/icons/GoogleIcon.tsx` ✅
  - SVG 아이콘 컴포넌트 (Google 공식 4색)

---

### Phase 4: 테스트 및 배포

- [x] **4.1 로컬 테스트**

  - localhost:3000에서 Google 로그인 테스트 ✅
  - 브라우저 테스트 완료 (버튼 표시 확인)

- [x] **4.2 Git 커밋 및 푸시**

  ```bash
  git commit 73e0ebf: feat: Google OAuth 로그인 기능 추가
  git push origin main ✅
  ```

- [ ] **4.3 프로덕션 테스트**
  - https://prism-writer.vercel.app/login 에서 테스트
  - Google 로그인 → 에디터 접근 확인

---

## 🔧 기술 사양

### Supabase OAuth 함수

```typescript
// Google 로그인 함수
const handleGoogleLogin = async () => {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
    },
  });
  if (error) console.error("Google 로그인 오류:", error);
};
```

### 필요한 환경 변수

| 변수                            | 위치                | 설명                  |
| :------------------------------ | :------------------ | :-------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | .env.local / Vercel | Supabase 프로젝트 URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | .env.local / Vercel | Supabase Anon Key     |

**Google OAuth 관련 값은 Supabase 대시보드에서 직접 설정하므로 환경 변수 추가 불필요**

---

## 📊 영향받는 기존 기능

| 기능          | 영향    | 대응                |
| :------------ | :------ | :------------------ |
| 이메일 로그인 | 없음    | 기존 기능 유지      |
| 회원가입      | UI 변경 | Google 버튼 추가만  |
| 미들웨어      | 없음    | 동일 세션 체크 적용 |
| 로그아웃      | 없음    | 동일 함수 사용      |

---

## 🎯 최종 결론

**회의 결과:**

1. Google OAuth는 Supabase 무료 플랜에서 사용 가능
2. Phase 1-2는 디렉터님이 Google Cloud와 Supabase에서 직접 설정
3. Phase 3-4는 개발팀이 프론트엔드 구현 및 테스트 진행
4. 기존 이메일 인증과 병행 운영 (사용자 선택 가능)

**예상 완료 시간:** 약 2-3시간 (설정 + 구현 + 테스트)

---

## ✅ 다음 단계

디렉터님께서 **Phase 1-2 (Google Cloud + Supabase 설정)** 를 완료하시면, 개발팀이 **Phase 3 (프론트엔드 구현)** 을 즉시 진행합니다.

---

_문서 작성: 시니어 개발자_
_검토: 주니어 개발자, UX/UI 전문가, 백엔드 개발자_
