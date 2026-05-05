# PrismLM (PRISM Writer) 기술 스택 상세 설명서

> **작성일**: 2026-03-05
> **프로젝트**: PrismLM (PRISM Writer)
> **배포 URL**: https://prism-writer.vercel.app
> **GitHub**: juneeeeekim/prism-writer (main branch)

---

juneeee.kim@gmail.com 
로그인으로 사용


## 목차

1. [프론트엔드 (Frontend)](#1-프론트엔드-frontend)
2. [백엔드 (Backend)](#2-백엔드-backend)
3. [데이터베이스 & 인프라: Supabase](#3-데이터베이스--인프라-supabase)
4. [LLM 통합 아키텍처](#4-llm-통합-아키텍처)
5. [인증 & 권한 (RBAC)](#5-인증--권한-rbac)
6. [Feature Flag 시스템](#6-feature-flag-시스템)
7. [전체 아키텍처 요약](#7-전체-아키텍처-요약)

---

## 1. 프론트엔드 (Frontend)

### 1-1. 핵심 프레임워크

| 기술 | 버전 | 역할 |
|------|------|------|
| **Next.js** | 14.0.4 | App Router 기반 풀스택 React 프레임워크 |
| **React** | 18.2.0 | UI 렌더링 라이브러리 |
| **TypeScript** | 5.3.0 | 정적 타입 시스템 (strict 모드) |

Next.js의 **App Router**를 사용하며, 서버 컴포넌트(RSC)와 클라이언트 컴포넌트를 혼합 활용합니다. API Routes(`frontend/src/app/api/`)를 통해 **45개 이상의 서버 엔드포인트**를 Next.js 내부에서 직접 처리하므로, 별도의 백엔드 서버 없이도 풀스택 운영이 가능합니다.

### 1-2. 스타일링 & UI

| 기술 | 버전 | 역할 |
|------|------|------|
| **Tailwind CSS** | 3.4.0 | 유틸리티 기반 CSS (다크모드 class 방식 지원) |
| **@heroicons/react** | 2.2.0 | SVG 아이콘 라이브러리 |
| **clsx** | 2.1.0 | 조건부 className 유틸리티 |
| **tailwind-merge** | 2.2.0 | Tailwind 클래스 충돌 병합 유틸리티 |

커스텀 브랜드 색상(`prism-primary`, `prism-secondary`, `prism-accent` 등)이 Tailwind 설정에 정의되어 있으며, 다크모드는 `class` 전략으로 동작합니다.

### 1-3. 리치 텍스트 에디터

| 기술 | 버전 | 역할 |
|------|------|------|
| **@tiptap/react** | 3.15.3 | ProseMirror 기반 모던 리치 텍스트 에디터 |
| **@tiptap/starter-kit** | 3.15.3 | 필수 에디터 확장 번들 |
| **@tiptap/extension-bubble-menu** | 3.15.3 | 텍스트 선택 시 나타나는 컨텍스트 메뉴 |
| **@tiptap/extension-placeholder** | 3.15.3 | 빈 에디터에 표시되는 안내 텍스트 |
| **@tiptap/extension-text-style** | 3.15.3 | 인라인 텍스트 스타일링 |
| **@uiw/react-md-editor** | 4.0.4 | 마크다운 에디터/뷰어 |
| **ReactFlow** | 11.11.4 | 노드/엣지 그래프 시각화 (구조 표현) |

TipTap은 Bubble Menu, Placeholder, Text Style 확장을 사용하여 에디터 UX를 구성합니다.

### 1-4. 상태 관리 & 데이터 페칭

| 기술 | 버전 | 역할 |
|------|------|------|
| **Zustand** | 4.4.7 | 경량 전역 상태 관리 (Redux 대비 보일러플레이트 최소) |
| **SWR** | 2.3.8 | 서버 데이터 캐싱 & stale-while-revalidate 전략 |

### 1-5. 문서 처리

| 기술 | 버전 | 역할 |
|------|------|------|
| **pdf-parse** | 2.4.5 | PDF 텍스트 추출 |
| **pdf2json** | 4.0.0 | PDF → JSON 구조 변환 |
| **Tesseract.js** | 7.0.0 | OCR (이미지에서 텍스트 인식) |
| **js-tiktoken** | 1.0.21 | LLM 프롬프트 토큰 수 계산 (비용 산정용) |

### 1-6. 유효성 검증

| 기술 | 버전 | 역할 |
|------|------|------|
| **Zod** | 3.25.0 | 런타임 스키마 검증 (TypeScript 퍼스트) |

### 1-7. 테스트

| 기술 | 버전 | 역할 |
|------|------|------|
| **Vitest** | 4.0.16 | 단위/컴포넌트 테스트 (Vite 네이티브) |
| **@vitest/ui** | 4.0.16 | 시각적 테스트 러너 UI |
| **jsdom** | 27.3.0 | Node.js 환경 DOM 에뮬레이션 |
| **Playwright** | 1.57.0 | E2E(종단간) 브라우저 테스트 |

### 1-8. 분석 & 모니터링

| 기술 | 버전 | 역할 |
|------|------|------|
| **@vercel/analytics** | 1.6.1 | Vercel 내장 웹 분석 도구 |

### 1-9. 개발 도구

| 기술 | 버전 | 역할 |
|------|------|------|
| **ESLint** | 8.55.0 | 코드 린팅 |
| **eslint-config-next** | 14.0.4 | Next.js 전용 린트 규칙 |
| **autoprefixer** | 10.4.16 | CSS 벤더 프리픽스 자동 추가 |
| **PostCSS** | - | Tailwind CSS + Autoprefixer 처리 |

### 1-10. 배포

- **호스팅**: Vercel (prism-writer.vercel.app)
- **배포 방식**: `git push origin main` → Vercel 자동 배포
- **환경**: Production + Preview (브랜치별 프리뷰 배포)

---

## 2. 백엔드 (Backend)

이 프로젝트의 백엔드는 **두 가지 레이어**로 구성됩니다.

### 2-1. 프로덕션 백엔드: Next.js API Routes

실제 운영 환경에서 사용되는 백엔드는 **Next.js API Routes** (`frontend/src/app/api/`)입니다. Vercel의 서버리스 함수로 실행되며, 별도의 서버 인프라 없이 프론트엔드와 동일한 배포 파이프라인으로 관리됩니다.

**주요 API 엔드포인트 (45개+):**

| 경로 | 기능 |
|------|------|
| `/api/chat/` | 채팅 세션 & 메시지 관리 |
| `/api/documents/` | 문서 CRUD, 처리, 텍스트 추출 |
| `/api/rag/` | RAG 검색, 청크 관리, 피드백, 선호도 |
| `/api/templates/` | 작문 템플릿 생성 |
| `/api/projects/` | 프로젝트 관리 (휴지통/복원 포함) |
| `/api/outlines/` | 문서 아웃라인 생성 |
| `/api/llm/` | Judge/테스트 엔드포인트 |
| `/api/rubrics/` | 루브릭 후보 관리 |
| `/api/research/` | Deep Scholar 연동 |
| `/api/evaluations/` | 평가 로깅 |
| `/api/admin/` | 관리자 템플릿 관리 |
| `/api/suggest/` | AI 제안 기능 |
| `/api/categories/` | 문서 카테고리 분류 |
| `/api/cron/` | 스케줄 작업 |

### 2-2. 로컬 개발용: FastAPI (프로덕션 미배포)

`backend/` 폴더에는 **FastAPI** 기반 Python 서버가 있으나, 이는 **초기 프로토타입**으로 프로덕션에 배포되지 않습니다. 향후 Python 기반 ML 파이프라인이 필요할 경우 활용할 수 있는 구조입니다.

| 기술 | 버전 | 역할 |
|------|------|------|
| **FastAPI** | 0.109+ | Python 비동기 웹 프레임워크 |
| **Uvicorn** | 0.27+ | ASGI 서버 |
| **LangChain** | 0.1+ | LLM 오케스트레이션 프레임워크 |
| **Pydantic** | 2.5+ | 데이터 검증 & 설정 관리 |
| **AsyncPG** | 0.29+ | PostgreSQL 비동기 드라이버 |
| **httpx** | 0.26+ | 비동기 HTTP 클라이언트 |

**Python 개발/테스트 도구:**

| 기술 | 역할 |
|------|------|
| **pytest + pytest-asyncio** | 비동기 단위 테스트 |
| **ruff** | 고속 Python 린터 |
| **black** | 코드 포매터 |

---

## 3. 데이터베이스 & 인프라: Supabase

### 3-1. 개요

| 항목 | 상세 |
|------|------|
| **프로젝트 ref** | `audrryyklmighhtdssoi` |
| **리전** | 서울 (ap-northeast-2) |
| **PostgreSQL** | 핵심 관계형 데이터베이스 |
| **pgvector** | 벡터 임베딩 저장 (RAG 시맨틱 검색용) |
| **Supabase Auth** | 인증 시스템 (이메일, 소셜 로그인) |
| **Supabase Storage** | 파일/문서 저장소 |
| **마이그레이션** | 53개 SQL 마이그레이션 파일 (`supabase/migrations/`) |

### 3-2. 주요 테이블

| 테이블 | 용도 |
|--------|------|
| `profiles` | 사용자 프로필 (역할: pending / free / premium / special / admin) |
| `documents` | 사용자 문서 |
| `chunks` | 문서 청크 (RAG 검색 단위) |
| `embeddings` | 벡터 임베딩 (시맨틱 검색용) |
| `templates` | 작문 템플릿 / 루브릭 |
| `projects` | 사용자 프로젝트 |
| `trash` | 소프트 삭제 항목 |
| `chat_sessions` | 채팅 세션 |
| `chat_messages` | 개별 채팅 메시지 |
| `evaluation_logs` | LLM 평가 로그 |
| `raft_dataset` | RAFT 합성 훈련 데이터 |

### 3-3. 클라이언트 구성

| 클라이언트 | 파일 | 용도 |
|-----------|------|------|
| **브라우저 클라이언트** | `lib/supabase/browser.ts` | 클라이언트 사이드 Supabase 접근 |
| **서버 클라이언트** | `lib/supabase/server.ts` | SSR/API Route에서 쿠키 기반 세션 |
| **Admin 클라이언트** | `lib/supabase/admin.ts` | Service Role Key 사용 (관리자 작업) |

Supabase JS SDK(`@supabase/supabase-js`)와 SSR 전용 SDK(`@supabase/ssr`)를 조합하여 서버/클라이언트 양측에서 안전하게 세션을 관리합니다.

---

## 4. LLM 통합 아키텍처

이 프로젝트의 핵심 차별점은 **다중 LLM 프로바이더 통합 시스템**입니다.

### 4-1. 지원 프로바이더 & 모델 (26개+)

#### Google Gemini (기본 프로바이더)

| 모델 | 특성 |
|------|------|
| `gemini-3-flash-preview` | **기본 모델** (빠른 응답, 저비용) |
| `gemini-3-pro-preview` | 고품질 추론 |
| `gemini-1.5-flash-002` | 안정 버전 |
| `gemma-3` 시리즈 (27B ~ 1B) | 오픈 웨이트 모델군 |

#### OpenAI

| 모델 | 특성 |
|------|------|
| `gpt-5.2-2025-12-11` | Reasoning 모델 (고급 추론) |
| `gpt-5-mini` | 경량 고속 모델 |

#### Anthropic

| 모델 | 특성 |
|------|------|
| `claude-opus-4-5` | 최고 품질 (고비용) |
| `claude-sonnet-4-5` | 균형형 |
| `claude-haiku-4-5` | 고속 경량 |

### 4-2. 아키텍처 흐름

```
사용자 요청
    │
    ▼
LLM Usage Map (30개+ 컨텍스트별 모델 매핑)
    │  → config/llm-usage-map.ts
    ▼
LLM Gateway (단일 진입점 — generateText())
    │  → lib/llm/gateway.ts
    ▼
Provider Factory (싱글톤 캐시)
    │  → lib/llm/providers/index.ts
    ▼
┌──────────────────┬──────────────────┬──────────────────┐
│  GeminiProvider   │  OpenAIProvider   │ AnthropicProvider │
│  (gemini.ts)      │  (openai.ts)      │ (anthropic.ts)    │
└──────────────────┴──────────────────┴──────────────────┘
```

### 4-3. 핵심 설계 원칙

- **Gateway 패턴**: 모든 LLM 호출이 `gateway.ts`의 `generateText()` 함수를 통해 일원화
- **Usage Map**: RAG 응답, 리뷰어, 리랭커, 평가, OCR, RAFT 등 **30개+ 컨텍스트**별 최적 모델 자동 배정
- **Fallback 지원**: 모델 실패 시 대체 모델 자동 전환
- **스트리밍/논스트리밍**: 두 모드 모두 지원
- **Provider Factory**: 싱글톤 캐시로 프로바이더 인스턴스 재사용

### 4-4. LLM 사용 컨텍스트 (30개+)

| 카테고리 | 용도 |
|----------|------|
| RAG 파이프라인 | answer, reviewer, reranker |
| 템플릿 검증 | consistency, hallucination, regression |
| 마이닝 | examples, rules 추출 |
| 프리미엄 티어 | answer, reviewer (고급 모델) |
| RAFT 합성 | 훈련 데이터 생성 |
| Self-RAG 검증 | 자기 검증 파이프라인 |
| 리서치 기능 | Deep Scholar 연동 |
| 패턴 추출 | 문서 패턴 분석 |
| 평가 시스템 | Judge LLM 기반 평가 |
| OCR 비전 | 이미지 기반 텍스트 인식 |

### 4-5. 생성 파라미터 (Jemiel Ensemble Strategy v3.0)

| 파라미터 | 범위 | 설명 |
|----------|------|------|
| **Temperature** | 0.0 ~ 0.9 | 0.0(무손실) ~ 0.9(창의적) |
| **Top-P** | 0.0 ~ 1.0 | 핵 샘플링 |
| **Top-K** | 1 ~ 100 | 후보 필터링 |

컨텍스트별로 최적화된 기본값이 설정되어 있습니다.

---

## 5. 인증 & 권한 (RBAC)

### 5-1. 역할 계층

`middleware.ts`에서 **5단계 역할 기반 접근 제어**(RBAC v2.0)를 구현합니다:

```
pending → free → premium → special → admin
```

### 5-2. 경로별 접근 권한

| 경로 | 필요 권한 | 설명 |
|------|-----------|------|
| `/editor` | free 이상 | 에디터 사용 (관리자 승인 필요) |
| `/admin` | admin 전용 | 관리자 대시보드 |
| `/profile` | pending 이상 | 프로필 관리 |
| `/dashboard` | pending 이상 | 대시보드 |
| `/trash` | pending 이상 | 휴지통 관리 |

### 5-3. 인증 흐름

1. **Supabase SSR 클라이언트**로 쿠키 기반 세션 확인
2. **세션 토큰 검증** (유효성 + 만료 확인)
3. **프로필 조회** → 역할(role) & 승인 상태(approval) 확인
4. **경로별 권한 검사** → 미달 시 리다이렉트

---

## 6. Feature Flag 시스템

### 6-1. 개요

`featureFlags.ts`에 **60개 이상의 기능 플래그**가 환경변수(`NEXT_PUBLIC_*`)로 제어됩니다.

### 6-2. 주요 카테고리

| 카테고리 | 예시 |
|----------|------|
| 파이프라인 버전 | v4, v5 전환 |
| UI 레이아웃 | 2패널, 3패널 모드 |
| RAG 고급 기능 | Self-RAG, Agentic Chunking, Query Expansion |
| 실험적 기능 | RAFT, Shadow Mode, Citation Markers |
| 패턴 기반 시스템 | 패턴 추출, 검색, 루브릭 |
| 검색 개선 | 가중 하이브리드 검색, 리랭킹 |
| 세션 관리 | Assistant 세션 |
| 작가 도구 | Shadow Writer, Deep Scholar |

### 6-3. 동작 방식

- **개발 환경**: 대부분 자동 활성화 (`NODE_ENV === 'development'`)
- **프로덕션 환경**: 환경변수로 세밀하게 ON/OFF 제어
- **헬퍼 함수**:
  - `isFeatureEnabled(flag)` — 불리언 플래그 확인
  - `getPipelineVersion()` — 현재 파이프라인 버전 반환
  - `getUILayoutType()` — UI 모드 반환
  - `getLLMProvider()` — 활성 LLM 프로바이더 반환
  - `debugLog()` — 조건부 디버그 로깅

---

## 7. 전체 아키텍처 요약

### 7-1. 시스템 구성도

```
┌──────────────────────────────────────────────────────┐
│                      Vercel                           │
│  ┌──────────────────────────────────────────────────┐ │
│  │            Next.js 14 (App Router)                │ │
│  │                                                    │ │
│  │  ┌──────────────┐    ┌─────────────────────────┐  │ │
│  │  │   React UI    │    │    API Routes (45+)      │  │ │
│  │  │  - TipTap     │    │  - RAG Pipeline          │  │ │
│  │  │  - Zustand    │    │  - Chat / Documents      │  │ │
│  │  │  - SWR        │    │  - LLM Gateway           │  │ │
│  │  │  - Tailwind   │    │  - Auth Middleware        │  │ │
│  │  │  - ReactFlow  │    │  - Evaluation / Judge     │  │ │
│  │  └──────────────┘    └─────────────────────────┘  │ │
│  └──────────────────────────────────────────────────┘ │
└───────────────┬──────────────────┬────────────────────┘
                │                  │
     ┌──────────▼────────┐   ┌────▼──────────────────┐
     │     Supabase       │   │    LLM Providers       │
     │  - PostgreSQL      │   │  - Google Gemini       │
     │  - pgvector        │   │  - OpenAI GPT-5        │
     │  - Auth            │   │  - Anthropic Claude    │
     │  - Storage         │   │                        │
     │  (서울 리전)        │   │  (26개+ 모델)          │
     └───────────────────┘   └────────────────────────┘
```

### 7-2. 프로젝트 디렉토리 구조

```
prismLM/
├── frontend/                          # Next.js 14 애플리케이션
│   ├── src/
│   │   ├── app/                       # Next.js App Router
│   │   │   ├── api/                   # 45+ API 엔드포인트
│   │   │   ├── layout.tsx             # 루트 레이아웃 (ThemeProvider)
│   │   │   └── globals.css            # 글로벌 스타일
│   │   ├── lib/
│   │   │   ├── llm/                   # LLM 통합 (gateway, providers, types)
│   │   │   ├── supabase/              # Supabase 클라이언트 (browser, server, admin)
│   │   │   ├── rag/                   # RAG 파이프라인 (70+ 파일)
│   │   │   ├── api/                   # API 유틸리티 (에러 처리, fetch)
│   │   │   ├── cache/                 # 캐싱 유틸리티 (LRU)
│   │   │   ├── judge/                 # Judge/평가 시스템
│   │   │   ├── ocr/                   # OCR 구현
│   │   │   ├── research/              # Deep Scholar 연동
│   │   │   ├── storage/               # 로컬 스토리지 유틸리티
│   │   │   └── utils/                 # 로깅, 헬퍼
│   │   ├── config/                    # 중앙 설정
│   │   │   ├── models.ts              # LLM 모델 레지스트리
│   │   │   ├── llm-usage-map.ts       # 서비스→모델 매핑
│   │   │   ├── featureFlags.ts        # 60+ Feature Flags
│   │   │   ├── llm.config.ts          # LLM 기본 설정
│   │   │   └── embedding-models.ts    # 임베딩 모델 설정
│   │   ├── contexts/                  # React Context (테마 등)
│   │   └── components/                # UI 컴포넌트 (60+ 폴더)
│   │       ├── Editor/                # 리치 텍스트 에디터
│   │       ├── rag/                   # RAG UI
│   │       ├── layout/                # 레이아웃 & 네비게이션
│   │       ├── ui/                    # 재사용 UI 컴포넌트
│   │       ├── auth/                  # 인증 UI
│   │       ├── documents/             # 문서 관리
│   │       ├── Assistant/             # AI 어시스턴트
│   │       ├── structure/             # 문서 구조 도구
│   │       ├── chat/                  # 채팅 인터페이스
│   │       ├── admin/                 # 관리자 대시보드
│   │       └── feedback/              # 사용자 피드백
│   ├── package.json                   # 42개 운영 + 16개 개발 의존성
│   ├── next.config.js                 # Next.js 설정
│   ├── tsconfig.json                  # TypeScript 설정
│   ├── tailwind.config.js             # Tailwind CSS 설정
│   ├── vitest.config.ts               # 단위 테스트 설정
│   └── playwright.config.ts           # E2E 테스트 설정
├── backend/                           # FastAPI (로컬 개발 전용)
│   ├── main.py                        # FastAPI 진입점
│   ├── requirements.txt               # Python 의존성
│   └── src/                           # FastAPI 모듈
├── supabase/
│   ├── migrations/                    # 53개 SQL 마이그레이션
│   └── config.toml                    # Supabase CLI 설정
└── plan_report/                       # 기술 문서 & 체크리스트
```

### 7-3. 핵심 수치 요약

| 항목 | 수치 |
|------|------|
| 프론트엔드 의존성 | 42개 (운영) + 16개 (개발) = **58개 패키지** |
| API 엔드포인트 | **45개+** |
| LLM 모델 | **26개+** (3개 프로바이더) |
| LLM 컨텍스트 | **30개+** 서비스별 용도 |
| Feature Flags | **60개+** |
| DB 마이그레이션 | **53개** SQL 파일 |
| UI 컴포넌트 | **17개 기능 디렉토리**, **60개+ 컴포넌트 폴더** |
| RAG 파이프라인 | **70개+** 파일 |

### 7-4. 핵심 설계 패턴

| 패턴 | 설명 |
|------|------|
| **중앙 설정 (Centralized Config)** | 모델, Feature Flags, LLM 사용 맵을 전용 config 파일에서 일원 관리 |
| **프로바이더 추상화 (Provider Abstraction)** | 추상 인터페이스로 LLM 프로바이더를 캡슐화, 코드 변경 없이 교체 가능 |
| **게이트웨이 패턴 (Gateway Pattern)** | 모든 LLM 호출을 단일 진입점으로 통합, 일관된 에러 처리 |
| **타입 안전성 (Type Safety)** | TypeScript strict 모드 + Zod 런타임 검증 + 모델 ID 타입 가드 |
| **미들웨어 보안 (Middleware Security)** | RBAC를 Next.js 미들웨어 레벨에서 구현, matcher 패턴으로 성능 최적화 |
| **SSR 인지 클라이언트 (SSR-aware Clients)** | 브라우저/서버 분리된 Supabase 클라이언트로 안전한 세션 관리 |
| **Feature Flag 전략** | 환경변수 기반 토글, 개발 자동 활성화, 프로덕션 세밀 제어 |

---

> **참고**: `backend/` 폴더의 FastAPI 서버는 초기 프로토타입이며 프로덕션에 배포되지 않습니다. 모든 운영 백엔드 로직은 Next.js API Routes를 통해 Vercel에서 서버리스로 실행됩니다.
