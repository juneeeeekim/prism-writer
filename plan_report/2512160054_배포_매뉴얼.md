# PRISM Writer 배포 매뉴얼

## 📋 목차

1. [사전 준비](#1-사전-준비)
2. [Supabase 설정](#2-supabase-설정)
3. [Vercel 배포](#3-vercel-배포)
4. [환경 변수 설정](#4-환경-변수-설정)
5. [배포 후 검증](#5-배포-후-검증)
6. [문제 해결](#6-문제-해결)

---

## 1. 사전 준비

### 1.1 필수 계정

| 서비스           | 용도               | 가입 URL                         |
| ---------------- | ------------------ | -------------------------------- |
| **Supabase**     | 데이터베이스, 인증 | https://supabase.com             |
| **Vercel**       | 프론트엔드 호스팅  | https://vercel.com               |
| **GitHub**       | 소스 코드 저장소   | https://github.com               |
| **Google Cloud** | OAuth 인증 (선택)  | https://console.cloud.google.com |

### 1.2 필수 도구

```bash
# Node.js 18+ 설치 확인
node --version

# npm 설치 확인
npm --version

# Vercel CLI 설치 (선택)
npm install -g vercel

# Vercel CLI 버전 확인
vercel --version
```

### 1.3 프로젝트 구조

```
prismLM/
├── frontend/              # Next.js 프론트엔드
│   ├── src/
│   ├── package.json
│   └── next.config.js
└── backend/
    └── migrations/        # SQL 마이그레이션 파일
        └── 015_operations_tables.sql
```

---

## 2. Supabase 설정

### 2.1 프로젝트 생성

1. **Supabase 대시보드 접속**

   - https://supabase.com/dashboard 접속
   - 로그인 (GitHub 또는 이메일)

2. **새 프로젝트 생성**

   - "New Project" 클릭
   - 프로젝트 이름: `prism-writer`
   - 리전: `Northeast Asia (Seoul)` 권장
   - 데이터베이스 비밀번호 설정 (안전한 곳에 저장!)

3. **프로젝트 생성 대기**
   - 약 2-3분 소요
   - 완료 후 대시보드로 이동

### 2.2 API 키 확인

1. **Settings → API 메뉴 이동**

2. **다음 정보 복사 (나중에 사용)**:
   ```
   Project URL: https://xxxxx.supabase.co
   anon/public key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   service_role key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9... (주의: 비공개)
   ```

### 2.3 데이터베이스 마이그레이션 실행

1. **SQL Editor 메뉴 이동**

   - 좌측 사이드바 → SQL Editor 클릭

2. **마이그레이션 파일 실행 (순서대로)**

   각 파일의 내용을 복사하여 SQL Editor에 붙여넣고 "Run" 버튼 클릭:

   | 순서 | 파일명                      | 설명                  |
   | ---- | --------------------------- | --------------------- |
   | 1    | `001_initial_schema.sql`    | 기본 스키마           |
   | 2    | `002_rls_policies.sql`      | RLS 정책              |
   | 3    | `003_profiles_schema.sql`   | 프로필 테이블         |
   | ...  | ...                         | ...                   |
   | 15   | `015_operations_tables.sql` | 운영 테이블 (Phase 8) |

3. **마이그레이션 성공 확인**
   - Table Editor 메뉴에서 테이블 목록 확인
   - `evaluation_logs`, `usage_records`, `evaluation_feedback` 테이블 존재 확인

### 2.4 인증 설정 (Google OAuth)

1. **Authentication → Providers 메뉴**

2. **Google 활성화**

   - Google 토글 ON
   - Client ID 입력
   - Client Secret 입력

3. **Google Cloud Console 설정**
   - OAuth 2.0 클라이언트 ID 생성
   - 승인된 리디렉션 URI 추가:
     ```
     https://xxxxx.supabase.co/auth/v1/callback
     ```

---

## 3. Vercel 배포

### 3.1 방법 A: GitHub 연동 (권장)

1. **GitHub에 코드 푸시**

   ```bash
   cd prismLM
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/your-username/prism-writer.git
   git push -u origin main
   ```

2. **Vercel 프로젝트 생성**

   - https://vercel.com/new 접속
   - "Import Git Repository" 선택
   - GitHub 저장소 선택: `prism-writer`

3. **프로젝트 설정**

   - Framework Preset: `Next.js`
   - Root Directory: `frontend`
   - Build Command: `npm run build` (기본값)
   - Output Directory: `.next` (기본값)

4. **환경 변수 설정** (중요!)

   - "Environment Variables" 섹션에서 추가:

   | Key                             | Value                       |
   | ------------------------------- | --------------------------- |
   | `NEXT_PUBLIC_SUPABASE_URL`      | `https://xxxxx.supabase.co` |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJhbGci...`               |
   | `GOOGLE_API_KEY`                | `AIzaSy...` (LLM용, 선택)   |

5. **배포 실행**
   - "Deploy" 버튼 클릭
   - 빌드 로그 확인 (약 2-3분)
   - 배포 완료 시 URL 확인

### 3.2 방법 B: Vercel CLI (로컬 배포)

1. **Vercel 로그인**

   ```bash
   vercel login
   ```

   - 브라우저가 열리면 로그인 진행

2. **프로젝트 초기화**

   ```bash
   cd prismLM/frontend
   vercel
   ```

   - 프롬프트 답변:
     - Set up and deploy: `Y`
     - Which scope: 선택
     - Link to existing project: `N`
     - Project name: `prism-writer`
     - Directory: `./`
     - Build settings: 기본값 사용

3. **환경 변수 설정**

   ```bash
   vercel env add NEXT_PUBLIC_SUPABASE_URL
   # 값 입력: https://xxxxx.supabase.co

   vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
   # 값 입력: eyJhbGci...
   ```

4. **프로덕션 배포**

   ```bash
   vercel --prod
   ```

5. **배포 URL 확인**
   ```
   ✅ Production: https://prism-writer-xxxxx.vercel.app
   ```

---

## 4. 환경 변수 설정

### 4.1 필수 환경 변수

| 변수명                          | 설명                  | 예시                         |
| ------------------------------- | --------------------- | ---------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | Supabase 프로젝트 URL | `https://abc123.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase 공개 키      | `eyJhbGci...`                |

### 4.2 선택적 환경 변수

| 변수명                 | 설명                     | 예시           |
| ---------------------- | ------------------------ | -------------- |
| `GOOGLE_API_KEY`       | Gemini LLM API 키        | `AIzaSy...`    |
| `OPENAI_API_KEY`       | OpenAI API 키 (임베딩용) | `sk-...`       |
| `NEXT_PUBLIC_APP_NAME` | 앱 이름                  | `PRISM Writer` |

### 4.3 Vercel에서 환경 변수 추가

1. Vercel Dashboard → 프로젝트 선택
2. Settings → Environment Variables
3. "Add New" 클릭
4. Key/Value 입력
5. 환경 선택: Production, Preview, Development
6. "Save" 클릭
7. **재배포 필요**: Deployments → 최신 배포 → "..." → Redeploy

---

## 5. 배포 후 검증

### 5.1 기본 검증 체크리스트

- [ ] 메인 페이지 접속 확인
- [ ] 로그인 페이지 표시 확인
- [ ] Google OAuth 로그인 테스트
- [ ] 에디터 페이지 접속 확인
- [ ] 프로필 페이지 접속 확인

### 5.2 API 검증

```bash
# 루브릭 조회 API
curl https://your-app.vercel.app/api/rag/evaluate

# 예상 응답:
# {"success":true,"rubrics":[...],"totalCount":10}
```

### 5.3 Supabase 연결 확인

1. 회원가입 테스트
2. Supabase Dashboard → Table Editor → `profiles` 테이블에서 새 레코드 확인

---

## 6. 문제 해결

### 6.1 빌드 실패

**에러**: `Export encountered errors`

**해결**:

```javascript
// 페이지 파일 상단에 추가
export const dynamic = "force-dynamic";
```

---

**에러**: `@supabase/ssr: Your project's URL and API key are required`

**해결**:

- Vercel 환경 변수 확인
- `NEXT_PUBLIC_SUPABASE_URL` 및 `NEXT_PUBLIC_SUPABASE_ANON_KEY` 설정 확인
- 재배포 실행

---

### 6.2 배포 후 500 에러

**원인**: 환경 변수 누락

**해결**:

1. Vercel → Settings → Environment Variables 확인
2. 모든 필수 환경 변수가 Production에 설정되어 있는지 확인
3. 재배포

---

### 6.3 인증 문제

**에러**: Google OAuth 리다이렉트 실패

**해결**:

1. Supabase → Authentication → URL Configuration 확인
2. Site URL: `https://your-app.vercel.app`
3. Redirect URLs에 추가:
   ```
   https://your-app.vercel.app/auth/callback
   ```

---

### 6.4 Vercel 로그인 페이지로 리다이렉트

**원인**: Deployment Protection 활성화

**해결**:

1. Vercel Dashboard → Settings → Deployment Protection
2. "Vercel Authentication" 비활성화
3. 또는 "Password Protection" 비활성화

---

## 📞 지원

문제가 지속되면:

- Vercel 빌드 로그 확인
- Supabase Dashboard 로그 확인
- 브라우저 개발자 도구 콘솔 확인

---

**문서 버전**: v1.0
**작성일**: 2025-12-17
**담당**: 시니어 개발자
