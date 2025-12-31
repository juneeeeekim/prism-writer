# PRISM Writer

> **RAG 기반 지능형 글쓰기 도구** - 내 문서를 분석하여 글의 구조와 내용을 잡아주는 저작 도구

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![Status](https://img.shields.io/badge/status-Production-green)
![License](https://img.shields.io/badge/license-MIT-brightgreen)

## 프로젝트 개요

PRISM Writer는 사용자가 업로드한 문서들을 RAG(Retrieval-Augmented Generation) 기술로 분석하여,
글쓰기의 **구조(Structure)** 와 **내용(Content)** 의 초석을 제공하는 웹 기반 저작 도구입니다.

### 핵심 기능

| 기능 | 설명 | 상태 |
|:-----|:-----|:-----|
| **프로젝트 관리** | 프로젝트별 문서/채팅/설정 독립 관리 | 완료 |
| **문서 업로드** | PDF, TXT, MD 파일 업로드 및 벡터화 | 완료 |
| **RAG 검색** | 업로드한 문서 기반 컨텍스트 검색 | 완료 |
| **AI 채팅** | 문서 기반 AI 대화 (스트리밍) | 완료 |
| **글 평가** | 템플릿 기반 글쓰기 품질 평가 | 완료 |
| **휴지통** | 소프트 삭제, 복구, 30일 자동 영구삭제 | 완료 |

---

## 기술 스택

| 영역 | 기술 | 설명 |
|:-----|:-----|:-----|
| **Framework** | Next.js 14 (App Router) | React 기반 풀스택 프레임워크 |
| **Language** | TypeScript 5.x | 타입 안전성 |
| **Styling** | TailwindCSS 3.3 | 유틸리티 CSS |
| **Database** | Supabase (PostgreSQL + pgvector) | BaaS + 벡터 검색 |
| **Auth** | Supabase Auth | Google OAuth, Email 인증 |
| **LLM** | Google Gemini 3 Flash | 기본 AI 모델 |
| **Embedding** | OpenAI text-embedding-3-small | 문서 벡터화 (1536차원) |
| **Deploy** | Vercel | 자동 배포 |

---

## 아키텍처

```
┌─────────────────────────────────────────────────────────────┐
│                     Client (Browser)                         │
└─────────────────────────┬───────────────────────────────────┘
                          │ HTTPS
┌─────────────────────────▼───────────────────────────────────┐
│                  Next.js App Router                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │   Pages     │  │ API Routes  │  │    Components       │  │
│  │ /dashboard  │  │ /api/chat   │  │ Editor, Assistant   │  │
│  │ /editor     │  │ /api/rag/*  │  │ DocumentUploader    │  │
│  │ /trash      │  │ /api/projects│ │ ChatPanel          │  │
│  └─────────────┘  └──────┬──────┘  └─────────────────────┘  │
└──────────────────────────┼──────────────────────────────────┘
                           │
     ┌─────────────────────┼─────────────────────┐
     ▼                     ▼                     ▼
┌─────────┐         ┌─────────────┐       ┌───────────┐
│ Supabase│         │ Google      │       │ OpenAI    │
│ (DB/RLS)│         │ Gemini API  │       │ Embedding │
└─────────┘         └─────────────┘       └───────────┘
```

### 주요 API 엔드포인트

| Method | Endpoint | 설명 |
|:-------|:---------|:-----|
| `GET` | `/api/projects` | 프로젝트 목록 |
| `POST` | `/api/projects` | 프로젝트 생성 |
| `DELETE` | `/api/projects/:id` | 소프트 삭제 (휴지통) |
| `GET` | `/api/projects/trash` | 휴지통 목록 |
| `PATCH` | `/api/projects/:id/restore` | 프로젝트 복구 |
| `DELETE` | `/api/projects/:id/permanent` | 영구 삭제 |
| `POST` | `/api/chat` | AI 채팅 (스트리밍) |
| `POST` | `/api/rag/search` | 벡터 검색 |
| `POST` | `/api/rag/evaluate` | 글 평가 |
| `POST` | `/api/documents/upload` | 문서 업로드 |

---

## 프로젝트 구조

```
prismLM/
├── frontend/                    # Next.js 애플리케이션
│   ├── src/
│   │   ├── app/                 # App Router (Pages & API Routes)
│   │   │   ├── api/             # API 엔드포인트
│   │   │   ├── dashboard/       # 대시보드 페이지
│   │   │   ├── editor/          # 에디터 페이지
│   │   │   ├── documents/       # 문서 관리 페이지
│   │   │   └── trash/           # 휴지통 페이지
│   │   ├── components/          # React 컴포넌트
│   │   │   ├── editor/          # 에디터 관련
│   │   │   ├── assistant/       # AI 어시스턴트
│   │   │   ├── documents/       # 문서 관리
│   │   │   └── modals/          # 모달 컴포넌트
│   │   ├── lib/                 # 핵심 로직
│   │   │   ├── rag/             # RAG 파이프라인
│   │   │   ├── llm/             # LLM 호출
│   │   │   └── supabase/        # DB 클라이언트
│   │   ├── config/              # 설정 (모델, Feature Flags)
│   │   ├── contexts/            # React Context
│   │   ├── hooks/               # Custom Hooks
│   │   └── types/               # TypeScript 타입
│   └── public/                  # 정적 파일
├── supabase/                    # Supabase 설정
│   └── migrations/              # SQL 마이그레이션
├── docs/                        # 기술 문서
└── plan_report/                 # 기획 문서 (수정 금지)
```

---

## 빠른 시작

### 사전 요구사항

- Node.js 18+
- Supabase 계정
- Google AI API Key
- OpenAI API Key

### 설치 및 실행

```bash
# 1. 저장소 클론
git clone https://github.com/juneeeeekim/prism-writer.git
cd prism-writer

# 2. 프론트엔드 설정
cd frontend
cp .env.example .env.local
npm install
npm run dev              # http://localhost:3000
```

### 환경 변수

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# LLM API Keys
GOOGLE_API_KEY=your_google_api_key
OPENAI_API_KEY=your_openai_api_key
```

---

## 개발 현황

| Phase | 상태 | 주요 결과물 |
|:------|:-----|:-----------|
| Phase 1-2 | 완료 | 기반 구축, Dual Pane UI |
| Phase 3-4 | 완료 | 목차 생성, 참조 연결 |
| Phase 5 | 완료 | 프로젝트 관리 시스템 |
| Phase 6 | 완료 | 온보딩, 문서 업로드 |
| Phase 7 | 완료 | 휴지통 시스템 (소프트 삭제) |

---

## 문서

- [기술 레퍼런스](./docs/TECHNICAL_REFERENCE_v2.md)
- [사용자 매뉴얼](./docs/USER_MANUAL_v2.md)
- [시스템 아키텍처](./docs/SYSTEM_ARCHITECTURE.md)
- [Supabase 설정 가이드](./docs/supabase-setup.md)
- [RAG 파이프라인 상세](./docs/RAG_PIPELINE_DEEP_DIVE.md)
- [Gemini 3 Flash 레퍼런스](./docs/Gemini_3_Flash_Reference.md)

---

## 라이선스

MIT License - 자세한 내용은 [LICENSE](./LICENSE) 파일 참조

---

_최종 업데이트: 2026년 1월 1일_
