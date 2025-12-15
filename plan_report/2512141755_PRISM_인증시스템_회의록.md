# 🔐 PRISM Writer 인증 시스템 도입 회의록

**회의 일시:** 2024-12-14 17:55  
**회의 장소:** 온라인 회의  
**참석자:** 디렉터, Senior Developer, Junior Developer, UX/UI Designer, Frontend Developer, Backend Developer  
**회의 목적:** 인증 시스템 선택 및 구현 방안 결정

---

## 📋 회의 안건

1. 인증 시스템 옵션 검토
2. 각 개발자 아이디어 제출
3. 투표 및 최종 결정
4. 구현 프로세스 수립

---

# 1️⃣ 인증 시스템 옵션 개요

## Option A: Supabase Auth

| 항목          | 내용                                     |
| :------------ | :--------------------------------------- |
| **제공사**    | Supabase (오픈소스)                      |
| **비용**      | 무료 (50,000 MAU까지)                    |
| **주요 기능** | 이메일/비밀번호, 소셜 로그인, Magic Link |
| **특징**      | DB와 자동 통합, RLS 지원                 |

## Option B: NextAuth.js

| 항목          | 내용                                 |
| :------------ | :----------------------------------- |
| **제공사**    | Auth.js (오픈소스)                   |
| **비용**      | 완전 무료                            |
| **주요 기능** | 다양한 Provider, JWT/Session         |
| **특징**      | Next.js 공식 지원, 커스터마이징 자유 |

## Option C: Clerk

| 항목          | 내용                              |
| :------------ | :-------------------------------- |
| **제공사**    | Clerk Inc.                        |
| **비용**      | 무료 (10,000 MAU까지)             |
| **주요 기능** | 완성된 UI 컴포넌트, 관리 대시보드 |
| **특징**      | 빠른 구현, 프리미엄 UX            |

---

# 2️⃣ 개발자 아이디어 제출

## 👨‍💼 Senior Developer 의견

### 추천: **Option A - Supabase Auth**

> "저는 Supabase Auth를 강력히 추천합니다."

**근거:**

1. **DB 통합의 편의성**

   - 이미 Supabase를 DB로 사용할 계획
   - 사용자 테이블(auth.users)이 자동 생성됨
   - RLS 정책과 자연스럽게 연동

2. **보안 측면**

   - JWT 토큰 자동 관리
   - 서버 사이드 인증 지원
   - Row Level Security로 데이터 보호

3. **확장성**

   - 향후 사용자 권한 관리 용이
   - 멀티테넌시 지원 가능
   - 팀 기능 추가 용이

4. **비용 효율**
   - 50,000 MAU까지 무료
   - 스타트업에 충분한 규모

```
투표: Supabase Auth ✅
```

---

## 👨‍🎓 Junior Developer 의견

### 추천: **Option A - Supabase Auth**

> "저도 Supabase Auth에 동의합니다!"

**근거:**

1. **학습 곡선이 낮음**

   - 공식 문서가 잘 정리되어 있음
   - React/Next.js 예제 풍부
   - 커뮤니티 활발

2. **빠른 구현**

   - `@supabase/auth-helpers-nextjs` 패키지 제공
   - 보일러플레이트 코드 최소화
   - 1-2일 내 기본 구현 가능

3. **디버깅 용이**
   - Supabase Dashboard에서 사용자 관리 가능
   - 로그 확인 쉬움
   - 테스트 계정 생성 용이

```
투표: Supabase Auth ✅
```

---

## 🎨 UX/UI Designer 의견

### 추천: **Option C - Clerk** (2순위: Supabase)

> "UX 관점에서 Clerk의 UI가 가장 세련됩니다."

**Clerk 장점:**

- 로그인/회원가입 UI가 완성되어 있음
- 다크 모드 완벽 지원
- 애니메이션 효과 포함

**그러나...**

> "팀의 기술 방향이 Supabase라면, Supabase Auth도 괜찮습니다.
> Supabase Auth UI를 커스터마이징하면 충분히 좋은 UX를 만들 수 있습니다."

**Supabase 조건:**

- 로그인 폼 디자인은 직접 제작
- 에러 메시지 한글화 필요
- 로딩 상태 표시 필수

```
1순위 투표: Clerk
2순위 투표: Supabase Auth ✅
```

---

## 💻 Frontend Developer 의견

### 추천: **Option A - Supabase Auth**

> "프론트엔드 통합 관점에서 Supabase가 최선입니다."

**근거:**

1. **Next.js 호환성**

   - App Router 공식 지원
   - 미들웨어로 인증 체크 용이
   - Server Component에서 세션 접근 가능

2. **코드 예시**

   ```typescript
   // middleware.ts
   import { createMiddlewareClient } from "@supabase/auth-helpers-nextjs";

   export async function middleware(req: NextRequest) {
     const res = NextResponse.next();
     const supabase = createMiddlewareClient({ req, res });
     const {
       data: { session },
     } = await supabase.auth.getSession();

     if (!session && req.nextUrl.pathname.startsWith("/editor")) {
       return NextResponse.redirect(new URL("/login", req.url));
     }
     return res;
   }
   ```

3. **상태 관리**
   - 전역 인증 상태 관리 용이
   - Zustand와 자연스럽게 통합

```
투표: Supabase Auth ✅
```

---

## 🔒 Backend Developer 의견

### 추천: **Option A - Supabase Auth**

> "백엔드 보안 관점에서 Supabase Auth가 가장 안전합니다."

**근거:**

1. **API 보안**

   - JWT 토큰 검증 자동화
   - FastAPI와 연동 가능
   - 서버에서 사용자 정보 접근 용이

2. **RLS (Row Level Security)**

   ```sql
   -- 사용자는 자신의 글만 볼 수 있음
   CREATE POLICY "Users can view own drafts"
   ON drafts FOR SELECT
   USING (auth.uid() = user_id);

   -- 사용자는 자신의 글만 수정 가능
   CREATE POLICY "Users can update own drafts"
   ON drafts FOR UPDATE
   USING (auth.uid() = user_id);
   ```

3. **확장성**
   - 역할(Role) 기반 권한 관리 가능
   - 관리자/일반 사용자 구분 용이
   - 팀 협업 기능 추가 가능

```
투표: Supabase Auth ✅
```

---

# 3️⃣ 투표 결과

## 최종 투표 집계

| 옵션              |  투표 수   | 투표자                                          |
| :---------------- | :--------: | :---------------------------------------------- |
| **Supabase Auth** | **5표** ✅ | Senior, Junior, UX/UI(2순위), Frontend, Backend |
| NextAuth.js       |    0표     | -                                               |
| Clerk             |    1표     | UX/UI(1순위)                                    |

## 🎉 결정: **Supabase Auth**

전원 합의로 **Supabase Auth**를 인증 시스템으로 채택합니다!

---

# 4️⃣ 구현 프로세스

## Phase 1: Supabase 프로젝트 설정 (Day 1)

### 1.1 Supabase 프로젝트 생성

1. https://supabase.com 접속 및 로그인
2. "New Project" 생성
   - Name: `prism-writer`
   - Region: `Northeast Asia (Seoul)`
3. API 키 확인 및 저장

### 1.2 인증 설정

1. Authentication > Settings
   - Site URL: `https://prism-writer.vercel.app`
   - Redirect URLs 추가:
     - `https://prism-writer.vercel.app/auth/callback`
     - `http://localhost:3000/auth/callback`

### 1.3 이메일 인증 설정

1. Authentication > Email Templates
   - 확인 이메일 템플릿 한글화
   - 비밀번호 재설정 이메일 한글화

---

## Phase 2: 프론트엔드 구현 (Day 2-3)

### 2.1 패키지 설치

```bash
cd frontend
npm install @supabase/supabase-js @supabase/auth-helpers-nextjs
```

### 2.2 환경변수 설정

```env
# frontend/.env.local
NEXT_PUBLIC_SUPABASE_URL=https://[project-ref].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=[anon-key]
```

### 2.3 Supabase 클라이언트 설정

**파일: `frontend/src/lib/supabase/client.ts`**

```typescript
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

export const createClient = () => createClientComponentClient();
```

**파일: `frontend/src/lib/supabase/server.ts`**

```typescript
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

export const createClient = () => createServerComponentClient({ cookies });
```

### 2.4 미들웨어 생성

**파일: `frontend/src/middleware.ts`**

```typescript
import { createMiddlewareClient } from "@supabase/auth-helpers-nextjs";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const supabase = createMiddlewareClient({ req, res });
  const {
    data: { session },
  } = await supabase.auth.getSession();

  // 인증이 필요한 페이지
  const protectedPaths = ["/editor"];
  const isProtectedPath = protectedPaths.some((path) =>
    req.nextUrl.pathname.startsWith(path)
  );

  // 비로그인 상태로 보호된 페이지 접근 시
  if (!session && isProtectedPath) {
    const redirectUrl = new URL("/login", req.url);
    redirectUrl.searchParams.set("redirect", req.nextUrl.pathname);
    return NextResponse.redirect(redirectUrl);
  }

  return res;
}

export const config = {
  matcher: ["/editor/:path*"],
};
```

### 2.5 로그인 페이지 생성

**파일: `frontend/src/app/login/page.tsx`**

---

## Phase 3: 인증 UI 구현 (Day 3-4)

### 3.1 생성할 페이지

| 페이지          | 경로              | 기능                      |
| :-------------- | :---------------- | :------------------------ |
| 로그인          | `/login`          | 이메일/비밀번호 로그인    |
| 회원가입        | `/signup`         | 신규 계정 생성            |
| 비밀번호 재설정 | `/reset-password` | 이메일로 재설정 링크 발송 |
| 콜백            | `/auth/callback`  | OAuth 리다이렉트 처리     |

### 3.2 헤더에 로그인 상태 표시

- 비로그인: "로그인" 버튼
- 로그인: 사용자 이메일 + "로그아웃" 버튼

---

## Phase 4: 테스트 및 배포 (Day 5)

### 4.1 로컬 테스트

- [ ] 회원가입 → 이메일 확인
- [ ] 로그인 → 에디터 접근
- [ ] 로그아웃 → 리다이렉트
- [ ] 비로그인 상태로 /editor 접근 → 로그인 페이지로 이동

### 4.2 Vercel 환경변수 설정

- Vercel Dashboard > Settings > Environment Variables
- `NEXT_PUBLIC_SUPABASE_URL` 추가
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` 추가

### 4.3 프로덕션 배포

```bash
git add .
git commit -m "feat: Supabase Auth 인증 시스템 추가"
git push origin main
```

---

## Phase 5: 선택적 기능 (향후)

### 5.1 소셜 로그인 추가

- Google 로그인
- GitHub 로그인

### 5.2 초대 기능

- 초대 링크로만 가입 가능
- 관리자 승인 후 활성화

### 5.3 팀 기능

- 팀 생성 및 관리
- 팀 내 글 공유

---

# 📊 일정 요약

| Day   | 작업                   | 담당           |
| :---- | :--------------------- | :------------- |
| Day 1 | Supabase 프로젝트 설정 | Senior         |
| Day 2 | 인증 미들웨어 구현     | Frontend       |
| Day 3 | 로그인/회원가입 UI     | Junior + UX/UI |
| Day 4 | 헤더 및 상태 관리      | Junior         |
| Day 5 | 테스트 및 배포         | 전체 팀        |

---

# ✅ Action Items

| #   | 작업                   | 담당자         | 기한  |
| :-- | :--------------------- | :------------- | :---- |
| 1   | Supabase 프로젝트 생성 | 디렉터/Senior  | Day 1 |
| 2   | 인증 관련 패키지 설치  | Junior         | Day 1 |
| 3   | 미들웨어 구현          | Frontend       | Day 2 |
| 4   | 로그인 페이지 UI       | UX/UI + Junior | Day 3 |
| 5   | 회원가입 페이지 UI     | UX/UI + Junior | Day 3 |
| 6   | 헤더 로그인 상태 표시  | Junior         | Day 4 |
| 7   | 로컬 테스트            | 전체 팀        | Day 5 |
| 8   | Vercel 환경변수 설정   | Senior         | Day 5 |
| 9   | 프로덕션 배포          | Senior         | Day 5 |

---

# 📝 회의 결론

1. **결정된 인증 시스템:** Supabase Auth (만장일치)
2. **예상 구현 기간:** 5일
3. **우선 구현 기능:** 이메일/비밀번호 로그인
4. **향후 추가 기능:** 소셜 로그인, 초대 기능

---

**회의록 작성:** Senior Developer  
**승인:** 디렉터님 승인 대기 중

---

_이 문서는 PRISM Writer 인증 시스템 구현의 기준 문서로 사용됩니다._
