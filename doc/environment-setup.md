# Environment Setup

> PRISM Writer 설치 절차, 의존성, 환경 변수 명세
> 최종 갱신: 2026-02-14

---

## 목차

1. [사전 요구사항](#1-사전-요구사항)
2. [프론트엔드 설치](#2-프론트엔드-설치)
3. [백엔드 설치](#3-백엔드-설치)
4. [Docker 개발 환경](#4-docker-개발-환경)
5. [환경 변수 명세](#5-환경-변수-명세)
6. [Supabase 설정](#6-supabase-설정)
7. [외부 API 키 발급](#7-외부-api-키-발급)
8. [주요 의존성 목록](#8-주요-의존성-목록)
9. [개발 명령어](#9-개발-명령어)
10. [배포 (Vercel)](#10-배포)
11. [트러블슈팅](#11-트러블슈팅)

---

## 1. 사전 요구사항

| 항목 | 최소 버전 | 권장 버전 | 비고 |
|------|-----------|-----------|------|
| Node.js | 18.0+ | 20.x LTS | `node -v`로 확인 |
| npm | 9.0+ | 10.x | Node.js에 포함 |
| Python | 3.11+ | 3.13 | 백엔드용 |
| Git | 2.30+ | Latest | |
| Supabase CLI | - | Latest | DB 마이그레이션용 (선택) |
| Docker | - | Latest | Docker 환경 사용 시 |

### 외부 서비스 계정

| 서비스 | 필수 | 용도 |
|--------|------|------|
| Supabase | Y | DB, Auth, Storage, Vector Search |
| Google AI Studio | Y | Gemini LLM API, Embedding |
| OpenAI | N | GPT 모델 (선택), Embedding (레거시) |
| Anthropic | N | Claude 모델 (선택) |
| Tavily | N | 외부 연구 검색 (Research 기능) |
| Vercel | N | 배포 (선택) |

---

## 2. 프론트엔드 설치

```bash
# 1. 프로젝트 클론
git clone https://github.com/juneeeeekim/prism-writer.git
cd prism-writer

# 2. 프론트엔드 디렉토리 이동
cd frontend

# 3. 환경 변수 설정
cp .env.example .env.local
# → .env.local 파일을 열고 실제 값으로 교체

# 4. 의존성 설치
npm install

# 5. 개발 서버 실행
npm run dev
# → http://localhost:3000
```

### 빌드 & 테스트

```bash
# 프로덕션 빌드
npm run build

# 유닛 테스트
npm run test

# E2E 테스트
npm run test:e2e

# 린트
npm run lint
```

---

## 3. 백엔드 설치

```bash
# 1. 백엔드 디렉토리 이동
cd backend

# 2. 환경 변수 설정
cp .env.example .env
# → .env 파일을 열고 실제 값으로 교체

# 3. 가상 환경 생성 & 활성화
python -m venv venv

# Windows
venv\Scripts\activate
# macOS/Linux
source venv/bin/activate

# 4. 의존성 설치
pip install -r requirements.txt

# 5. 개발 서버 실행
uvicorn main:app --reload --port 8000
# → http://localhost:8000
# → Swagger UI: http://localhost:8000/docs
# → ReDoc: http://localhost:8000/redoc
```

---

## 4. Docker 개발 환경

```bash
# 루트 디렉토리에서 실행
docker-compose -f docker-compose.dev.yml up --build

# 백그라운드 실행
docker-compose -f docker-compose.dev.yml up -d

# 로그 확인
docker-compose -f docker-compose.dev.yml logs -f

# 중지
docker-compose -f docker-compose.dev.yml down
```

### 서비스 포트

| 서비스 | 포트 | URL |
|--------|------|-----|
| Frontend (Next.js) | 3000 | http://localhost:3000 |
| Backend (FastAPI) | 8000 | http://localhost:8000 |

---

## 5. 환경 변수 명세

### 5.1 프론트엔드 (`frontend/.env.local`)

#### Supabase (필수)

| 변수 | 타입 | 접두사 | 설명 |
|------|------|--------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | `string` | Public | Supabase 프로젝트 URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `string` | Public | Supabase 익명 키 (클라이언트용) |

#### LLM API 키 (서버 전용 — `NEXT_PUBLIC_` 접두사 없음)

| 변수 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `GOOGLE_API_KEY` | `string` | Y | Google AI Studio API 키 (Gemini) |
| `OPENAI_API_KEY` | `string` | N | OpenAI API 키 (GPT, Embedding) |
| `ANTHROPIC_API_KEY` | `string` | N | Anthropic API 키 (Claude) |
| `TAVILY_API_KEY` | `string` | N | Tavily API 키 (Research 검색) |

#### 앱 설정

| 변수 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `NEXT_PUBLIC_APP_NAME` | `string` | `'PRISM Writer'` | 앱 표시 이름 |
| `NEXT_PUBLIC_API_URL` | `string` | `'http://localhost:8000'` | 백엔드 API URL |
| `DEFAULT_MODEL` | `string` | - | 기본 LLM 모델 오버라이드 |

#### Feature Flags (선택)

| 변수 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `NEXT_PUBLIC_ENABLE_ANALYTICS` | `boolean` | `false` | Vercel Analytics |
| `NEXT_PUBLIC_ENABLE_DEBUG_MODE` | `boolean` | `true` | 디버그 모드 |
| `NEXT_PUBLIC_ENABLE_CHAT_HISTORY` | `boolean` | `true` | 채팅 이력 기능 |
| `NEXT_PUBLIC_ENABLE_SELF_RAG` | `boolean` | `true` | Self-RAG 기능 |

#### 전체 `.env.example`

```env
# ─── Supabase ───────────────────────────────────────────
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.xxx...

# ─── LLM API Keys (서버 전용) ──────────────────────────
GOOGLE_API_KEY=your_google_api_key
OPENAI_API_KEY=your_openai_api_key
ANTHROPIC_API_KEY=your_anthropic_api_key

# ─── App Settings ───────────────────────────────────────
NEXT_PUBLIC_APP_NAME=PRISM Writer
NEXT_PUBLIC_API_URL=http://localhost:8000

# ─── Feature Flags ──────────────────────────────────────
NEXT_PUBLIC_ENABLE_ANALYTICS=false
NEXT_PUBLIC_ENABLE_DEBUG_MODE=true
NEXT_PUBLIC_ENABLE_CHAT_HISTORY=true
NEXT_PUBLIC_ENABLE_SELF_RAG=true
```

### 5.2 백엔드 (`backend/.env`)

| 변수 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `APP_ENV` | `string` | `development` | 실행 환경 |
| `LOG_LEVEL` | `string` | `DEBUG` | 로그 레벨 |
| `DEBUG` | `boolean` | `true` | 디버그 모드 |
| `SUPABASE_URL` | `string` | - | Supabase URL |
| `SUPABASE_KEY` | `string` | - | Supabase 서비스 키 |
| `SUPABASE_SERVICE_ROLE_KEY` | `string` | - | Supabase Service Role 키 |
| `OPENAI_API_KEY` | `string` | - | OpenAI API 키 |
| `ANTHROPIC_API_KEY` | `string` | - | Anthropic API 키 |
| `FRONTEND_URL` | `string` | `http://localhost:3000` | CORS 허용 URL |

#### 전체 `.env.example`

```env
# ─── Application Settings ──────────────────────────────
APP_ENV=development
LOG_LEVEL=DEBUG
DEBUG=true

# ─── Supabase ──────────────────────────────────────────
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.xxx...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.xxx...

# ─── LLM API Keys ─────────────────────────────────────
OPENAI_API_KEY=your_openai_api_key
ANTHROPIC_API_KEY=your_anthropic_api_key

# ─── CORS ──────────────────────────────────────────────
FRONTEND_URL=http://localhost:3000
```

---

## 6. Supabase 설정

### 6.1 프로젝트 생성

1. [supabase.com](https://supabase.com)에서 새 프로젝트 생성
2. 프로젝트 설정 > API에서 URL과 키 복사
3. `.env.local`에 붙여넣기

### 6.2 pgvector 확장 활성화

```sql
-- Supabase SQL Editor에서 실행
CREATE EXTENSION IF NOT EXISTS vector;
```

### 6.3 마이그레이션 실행

마이그레이션 파일들은 `supabase/migrations/` 디렉토리에 67개 SQL 파일로 관리됩니다.

```bash
# Supabase CLI 사용 시
supabase db push

# 또는 SQL Editor에서 수동 실행 (번호순)
# 001_xxx.sql → 002_xxx.sql → ... → 053_xxx.sql
```

### 6.4 핵심 마이그레이션 순서

| 순서 | 파일 | 생성 테이블 |
|------|------|-------------|
| 028 | `028_raft_dataset.sql` | raft_dataset |
| 032 | `032_evaluation_logs.sql` | evaluation_logs |
| 033 | `033_user_documents.sql` | user_documents |
| 040 | `040_phase2_template_builder.sql` | rag_rules, rag_examples, rag_templates |
| 050 | `050_phase5_projects.sql` | projects + FK 연결 |
| 052 | `052_phase6_setup_completed.sql` | projects.setup_completed |
| 053 | `053_phase7_project_trash.sql` | 소프트 삭제 지원 |

### 6.5 Storage 버킷

```sql
-- Supabase Dashboard > Storage에서 생성
-- 버킷 이름: rag-documents
-- 접근 수준: Private (RLS 사용)
```

### 6.6 Auth 설정

1. Supabase Dashboard > Authentication > Providers
2. **Email**: 활성화 (기본)
3. **Google OAuth**: 활성화 (선택)
   - Google Cloud Console에서 OAuth 클라이언트 생성
   - Redirect URI: `https://your-project.supabase.co/auth/v1/callback`

---

## 7. 외부 API 키 발급

### Google AI Studio (Gemini)

1. [ai.google.dev](https://ai.google.dev)에서 API 키 발급
2. Gemini 3 Flash Preview 모델 접근 확인
3. `GOOGLE_API_KEY`에 설정

### OpenAI (선택)

1. [platform.openai.com](https://platform.openai.com)에서 API 키 발급
2. `OPENAI_API_KEY`에 설정
3. 사용 모델: GPT-5.2, GPT-5 mini

### Anthropic (선택)

1. [console.anthropic.com](https://console.anthropic.com)에서 API 키 발급
2. `ANTHROPIC_API_KEY`에 설정
3. 사용 모델: Claude 4.5 Opus/Sonnet/Haiku

### Tavily (선택 — Research 기능)

1. [tavily.com](https://tavily.com)에서 API 키 발급
2. `TAVILY_API_KEY`에 설정

---

## 8. 주요 의존성 목록

### 8.1 프론트엔드 (`frontend/package.json`)

**Core**

| 패키지 | 버전 | 용도 |
|--------|------|------|
| `next` | 14.0.4 | React 풀스택 프레임워크 |
| `react` | 18.2.0 | UI 라이브러리 |
| `typescript` | 5.3.0 | 타입 안전성 |
| `tailwindcss` | 3.4.0 | 유틸리티 CSS |

**LLM SDK**

| 패키지 | 용도 |
|--------|------|
| `@google/generative-ai` | Gemini API |
| `openai` | OpenAI API |
| `@anthropic-ai/sdk` | Anthropic API |

**Database & Auth**

| 패키지 | 용도 |
|--------|------|
| `@supabase/supabase-js` | Supabase 클라이언트 |
| `@supabase/ssr` | 서버 사이드 Supabase |

**Editor**

| 패키지 | 용도 |
|--------|------|
| `@tiptap/react` | Rich Text 에디터 |
| `@tiptap/starter-kit` | 기본 에디터 확장 |
| `@uiw/react-md-editor` | Markdown 에디터 |

**Utilities**

| 패키지 | 용도 |
|--------|------|
| `zod` | 런타임 타입 검증 |
| `zustand` | 상태 관리 |
| `swr` | 데이터 페칭 캐싱 |
| `uuid` | UUID 생성 |
| `js-tiktoken` | 토큰 카운팅 |
| `pdf-parse` | PDF 텍스트 추출 |
| `tesseract.js` | OCR (이미지 텍스트 추출) |

**Testing**

| 패키지 | 용도 |
|--------|------|
| `vitest` | 유닛 테스트 |
| `@playwright/test` | E2E 테스트 |

### 8.2 백엔드 (`backend/requirements.txt`)

| 패키지 | 용도 |
|--------|------|
| `fastapi` (>=0.109.0) | 웹 프레임워크 |
| `uvicorn` | ASGI 서버 |
| `pydantic` | 데이터 모델/검증 |
| `pydantic-settings` | 환경 설정 관리 |
| `supabase` | Supabase Python 클라이언트 |
| `asyncpg` | PostgreSQL 비동기 드라이버 |
| `openai` | OpenAI API |
| `langchain` | LLM 오케스트레이션 |
| `langchain-openai` | LangChain OpenAI 연동 |
| `unstructured` | 문서 파싱 (PDF, DOCX) |
| `pypdf` | PDF 파싱 |
| `python-dotenv` | 환경 변수 로드 |
| `httpx` | HTTP 클라이언트 |
| `pytest` | 테스트 프레임워크 |
| `pytest-asyncio` | 비동기 테스트 |
| `ruff` | 린터 |
| `black` | 코드 포매터 |

### 8.3 루트 (`package.json`)

| 패키지 | 용도 |
|--------|------|
| `@supabase/supabase-js` | 루트 레벨 Supabase |
| `ai` | AI SDK |
| `dotenv` | 환경 변수 |
| `motion` | 애니메이션 |
| `tailwindcss` | CSS |
| `postcss` | CSS 후처리 |

---

## 9. 개발 명령어

### 프론트엔드 (`frontend/`)

| 명령어 | 설명 |
|--------|------|
| `npm run dev` | 개발 서버 (http://localhost:3000) |
| `npm run build` | 프로덕션 빌드 |
| `npm run start` | 프로덕션 서버 |
| `npm run lint` | ESLint 검사 |
| `npm run test` | Vitest 유닛 테스트 |
| `npm run test:e2e` | Playwright E2E 테스트 |

### 백엔드 (`backend/`)

| 명령어 | 설명 |
|--------|------|
| `uvicorn main:app --reload` | 개발 서버 (http://localhost:8000) |
| `pytest` | 테스트 실행 |
| `pytest --cov` | 커버리지 포함 테스트 |
| `ruff check .` | 린트 검사 |
| `black .` | 코드 포맷팅 |

### Docker

| 명령어 | 설명 |
|--------|------|
| `docker-compose -f docker-compose.dev.yml up --build` | 전체 환경 빌드 & 시작 |
| `docker-compose -f docker-compose.dev.yml down` | 전체 환경 중지 |
| `docker-compose -f docker-compose.dev.yml logs -f` | 로그 실시간 확인 |

---

## 10. 배포

### Vercel 배포

1. Vercel에 GitHub 레포 연결
2. Root Directory: `frontend`
3. 환경 변수 설정 (Vercel Dashboard > Settings > Environment Variables)
4. 자동 배포 활성화

### 환경 변수 (Vercel)

```
NEXT_PUBLIC_SUPABASE_URL=your_production_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_production_key
GOOGLE_API_KEY=your_key
OPENAI_API_KEY=your_key
ANTHROPIC_API_KEY=your_key
```

---

## 11. 트러블슈팅

### 일반

| 문제 | 해결 |
|------|------|
| `npm install` 실패 | Node.js 18+ 확인, `rm -rf node_modules && npm install` |
| 환경 변수 미적용 | `.env.local` 파일 확인, 서버 재시작 |
| 타입 에러 | `npx tsc --noEmit`으로 전체 검사 |

### Supabase

| 문제 | 해결 |
|------|------|
| RLS 에러 (403) | 정책 확인, `auth.uid()` 반환값 검증 |
| pgvector 미설치 | `CREATE EXTENSION IF NOT EXISTS vector;` 실행 |
| 벡터 검색 안됨 | 임베딩 차원 일치 확인 (1536 또는 768) |

### LLM

| 문제 | 해결 |
|------|------|
| `GOOGLE_API_KEY is missing` | 환경 변수 설정 확인 |
| API Rate Limit | 다른 모델로 폴백, 요청 간격 조절 |
| JSON 파싱 실패 | `sanitizeJSON()` 로직 확인, 모델 temperature 낮춤 |

---

## 12. 시스템 복원 절차

> 출처: RAG System Technical Manual v5.0 (2026-01-04)

시스템 재구축 시 아래 절차를 순서대로 수행합니다.

### 12.1 사전 준비

1. **Supabase 프로젝트 생성** — https://supabase.com, PostgreSQL 15+, pgvector 확장 활성화
2. **환경 변수 설정** — `cp .env.example .env.local` 후 [섹션 5](#5-환경-변수-명세) 참고

### 12.2 데이터베이스 마이그레이션

마이그레이션 파일을 아래 순서대로 Supabase SQL 에디터에서 실행합니다:

```
backend/migrations/
├── 012_rag_documents_schema.sql      # RAG 문서 테이블
├── 013_rag_chunks_schema.sql         # RAG 청크 테이블 + pgvector
├── 014_embedding_usage_schema.sql    # 사용량 추적
├── 018_embedding_version_schema.sql  # 임베딩 버전 관리
├── 020_search_schema.sql             # 검색 RPC 함수
├── 021_pipeline_v3_schema.sql        # Rules/Examples/Templates
├── 023_tenant_rls_policies.sql       # Tenant RLS
├── 030_bm25_dual_index.sql           # BM25 듀얼 인덱스
├── 031_search_chunk_type_filter.sql  # chunk_type 필터
└── 036_criteria_pack_pins.sql        # CriteriaPack Pin
```

또는 Supabase CLI 사용:

```bash
supabase db push
```

### 12.3 Storage 버킷 생성

```sql
-- Supabase Storage 버킷
INSERT INTO storage.buckets (id, name, public)
VALUES ('rag-documents', 'rag-documents', false);

-- RLS 정책
CREATE POLICY "Users can upload own documents"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'rag-documents'
  AND auth.uid()::text = (storage.foldername(name))[1]
);
```

### 12.4 검증 절차

1. **임베딩 테스트**: `embedText("테스트 문장")` → 결과 길이 1536 확인
2. **검색 테스트**: `hybridSearch("테스트 쿼리", { userId: "..." })` → 결과 반환 확인
3. **문서 업로드 테스트**: PDF 업로드 → 처리 상태 COMPLETED 확인 → 검색 결과 확인
