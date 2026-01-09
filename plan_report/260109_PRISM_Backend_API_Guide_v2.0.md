# 📘 PRISM Writer Backend API & RAG Guide v2.0

**문서 번호**: BE-2026-0109-V2
**작성일**: 2026-01-09
**버전**: v2.0
**기술 스택**: Next.js API Routes, Supabase (PostgreSQL + pgvector), Tavily API, Gemini 3.0 Flash

---

## 🏗️ 시스템 아키텍처

PRISM Writer의 백엔드는 **Serverless Functions (Next.js API Routes)** 기반으로 구축되었으며, LLM 오케스트레이션과 Vector DB 관리를 수행합니다.

### 데이터 흐름

1.  **Client** -> **API Route** (인증/검증)
2.  **API Route** -> **RAG Pipeline** (Hybrid Search + Reranking)
3.  **API Route** -> **External API** (Tavily/Gemini)
4.  **Response** -> **Client**

---

## 🔌 API Reference

### 1. Research API (Deep Scholar)

외부 학술 자료 및 정부 통계를 검색하고 구조화된 데이터로 반환합니다.

- **Endpoint**: `POST /api/research`
- **Request**: `{ userQuery: string, context: string, language: "ko"|"en" }`

### 2. Suggestion API (Shadow Writer)

문맥을 기반으로 다음 문장(Ghost Text)을 생성합니다. 내부 RAG 지식베이스를 우선 참조합니다.

- **Endpoint**: `POST /api/suggest`
- **Request**: `{ text: string, cursorPosition: number, projectId: string }`

### 3. Chat API (AI Chat)

사용자 질문에 대해 업로드된 문서(RAG)를 기반으로 답변합니다.

- **Endpoint**: `POST /api/chat`
- **Request**: `{ messages: Message[], projectId: string }`
- **Features**: Multi-turn 대화, 문서 출처(Source Citations) 제공

### 4. Evaluation API (글 평가)

작성된 글을 루브릭 기준에 따라 종합적으로 평가합니다.

- **Endpoint**: `POST /api/rag/evaluate-holistic`
- **Request**: `{ documentContent: string, rubricId: string }`
- **Features**: 점수(Score), 강점/약점 분석, 개선 제안

### 5. Outline API (목차 제안)

주제와 키워드를 입력받아 글의 구조(목차)를 생성합니다.

- **Endpoint**: `POST /api/suggest` (with type='outline' or separate endpoint)
- **Use Case**: 초기 기획 단계에서 구조 잡기

### 6. RAG Search API (Smart Search)

업로드된 내부 문서에서 의미론적 검색을 수행합니다.

- **Endpoint**: `POST /api/rag/search`
- **Features**: Hybrid Search (BM25 + Embedding), Reranking

---

## 🤖 RAG Pipeline (Retrieval-Augmented Generation)

PRISM Writer의 핵심 엔진인 RAG 파이프라인은 정확도와 속도의 균형을 맞춘 **v2.0 하이브리드 파이프라인**을 사용합니다.

```mermaid
graph LR
    A[User Query] --> B{Hybrid Search}
    B -->|Keyword| C[BM25 Matches]
    B -->|Vector| D[Embedding Matches]
    C & D --> E[Reciprocal Rank Fusion]
    E --> F[Reranking (Score > 0.7)]
    F --> G[Context Selection]
    G --> H[LLM Generation]
```

### 주요 설정

- **Embedding Model**: `text-embedding-3-small` (OpenAI)
- **Vector DB**: Supabase `pgvector` index (HNSW for speed)
- **Top-K**: Initial 20 -> Reranked Top 5

---

## 🔐 보안 및 인증 (Security)

### Authentication

- Supabase Auth (JWT) 기반 인증
- 모든 API 요청 헤더의 `Authorization: Bearer <token>` 검증
- `createClient()` (Server Component용)를 통해 세션 안전하게 획득

### API Key Security

- 외부 API 키 (`TAVILY_API_KEY`, `GOOGLE_API_KEY`)는 **서버 환경 변수**로만 관리
- 클라이언트로 절대 노출되지 않음

### Data Isolation

- 모든 DB 쿼리에 `projectId` 필터 필수 적용 (`WHERE project_id = ?`)
- RLS(Row Level Security) 정책을 통해 DB 레벨에서 접근 제어

---

**문서 관리자**: Antigravity (Tech Lead)
**최종 수정**: 2026-01-09
