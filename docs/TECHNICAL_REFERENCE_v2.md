# PRISM Writer Technical Reference (v2.0)

본 문서는 PRISM Writer의 시스템 아키텍처, 기술 스택, 프로젝트 구조 및 배포 워크플로우를 기술한 개발자 문서입니다.

---

## 🏗️ 1. 시스템 아키텍처 (System Architecture)

PRISM Writer는 **Next.js** 기반의 모던 웹 애플리케이션으로, **Supabase**를 BaaS(Backend-as-a-Service)로 활용하여 구축되었습니다.

### High-Level Overview

```mermaid
graph TD
    Client[Client (Browser)] -->|HTTPS| NextJS[Next.js App Router]
    NextJS -->|Auth & Data| Supabase[Supabase (PostgreSQL)]
    NextJS -->|Vector Search| PGVector[pgvector]
    NextJS -->|API Call| LLM_Gateway[LLM Interface]
    LLM_Gateway -->|Request| Gemini[Google Gemini API]
    LLM_Gateway -->|Request| OpenAI[OpenAI API (Fallback)]

    subgraph "RAG Pipeline"
    Supabase -->|Retrieve Chunks| NextJS
    NextJS -->|Context Injection| LLM_Gateway
    end
```

### Core Components

1.  **Frontend**: Next.js 14 (App Router), React, TailwindCSS, Zustand (State Management)
2.  **Backend & Database**: Supabase (PostgreSQL + pgvector extension)
3.  **AI Engine**: Google Gemini 1.5 Pro/Flash (Primary), OpenAI (Legacy/Fallback)
4.  **Storage**: Supabase Storage (PDF/File Hosting)

---

## 🛠️ 2. 기술 스택 (Tech Stack)

### Frontend

- **Framework**: Next.js 14.0.4
- **Language**: TypeScript 5.x
- **Styling**: TailwindCSS 3.3, shadcn/ui (Radix UI 기반)
- **State**: Zustand (전역 상태), React Query (서버 상태)
- **Testing**: Vitest (Unit/Integration)

### Backend (Supabase)

- **Database**: PostgreSQL 15+
- **Vector DB**: pgvector (0.5.0+)
- **Authentication**: Supabase Auth (Email, Google OAuth)
- **Edge Functions**: Deno runtime (TypeScript)

### AI & RAG

- **LLM Model**: `gemini-1.5-pro` (Reasoning), `gemini-1.5-flash` (Chat/Speed)
- **Embeddings**: `text-embedding-3-small` (OpenAI), `embedding-001` (Google)
- **RAG Logic**: Hybrid Search (Vector + Keyword), Reciprocal Rank Fusion (RRF)

---

## 📂 3. 디렉토리 구조 (Directory Structure)

```bash
prismLM/
├── frontend/                 # Next.js 애플리케이션
│   ├── src/
│   │   ├── app/              # App Router (Pages & API Routes)
│   │   ├── components/       # React Components (UI, RAG, Assistant)
│   │   ├── lib/              # Core Logic
│   │   │   ├── rag/          # RAG 관련 로직 (search, citation, gates)
│   │   │   ├── llm/          # LLM 호출 및 Gateway
│   │   │   └── supabase/     # DB 클라이언트
│   │   ├── types/            # TypeScript 인터페이스 definition
│   │   └── config/           # 환경 설정 및 상수
│   ├── public/               # 정적 파일
│   └── ...
├── supabase/                 # Supabase 관련 파일
│   ├── migrations/           # SQL 마이그레이션 파일 (Schema History)
│   └── seed.sql              # 초기 개발 데이터
├── docs/                     # 프로젝트 문서
└── plan_report/              # 개발 계획 및 JeDebug 리포트
```

---

## 🚀 4. 배포 워크플로우 (Deployment)

### CI/CD Pipeline (Vercel)

1.  **Push to `main`**: GitHub 메인 브랜치에 코드가 푸시되면 Vercel 배포가 트리거됩니다.
2.  **Build**: `npm run build` 스크립트가 실행되며 타입 체크와 빌드가 수행됩니다.
3.  **Deploy**: 빌드 성공 시 프로덕션 환경에 배포됩니다.

### Database Migration

Supabase 마이그레이션은 별도로 관리되며, 배포 전/후에 수동 또는 CLI로 실행해야 합니다.

1.  `supabase/migrations/` 폴더의 SQL 파일 확인
2.  Supabase Dashboard > SQL Editor 또는 `supabase db push` 명령어로 적용

---

## 🔒 5. 보안 (Security)

- **RLS (Row Level Security)**: 모든 테이블에 RLS 정책이 적용되어 있습니다. 사용자는 자신의 데이터(문서, 채팅 기록)에만 접근할 수 있습니다.
- **Environment Variables**: API Key 등 민감 정보는 `.env.local` 및 Vercel 환경 변수로 관리됩니다. (Client 노출 금지)
