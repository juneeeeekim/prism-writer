# PRISM Writer AI 채팅 시스템 기술 정의서

> **문서 ID**: 2601230700  
> **버전**: 1.0  
> **작성일**: 2026-01-23  
> **분류**: 기술 문서 / 시스템 아키텍처  
> **기밀등급**: 내부용

---

## 📋 목차

1. [시스템 개요](#1-시스템-개요)
2. [아키텍처 다이어그램](#2-아키텍처-다이어그램)
3. [문서 처리 파이프라인](#3-문서-처리-파이프라인)
4. [RAG 검색 파이프라인](#4-rag-검색-파이프라인)
5. [루브릭 시스템](#5-루브릭-시스템)
6. [LLM 통합](#6-llm-통합)
7. [Self-RAG 시스템](#7-self-rag-시스템)
8. [AI 채팅 API](#8-ai-채팅-api)
9. [환경 변수 설정](#9-환경-변수-설정)
10. [데이터베이스 스키마](#10-데이터베이스-스키마)
11. [핵심 파일 맵](#11-핵심-파일-맵)

---

## 1. 시스템 개요

### 1.1 PRISM Writer란?

PRISM Writer는 RAG(Retrieval-Augmented Generation) 기반 AI 글쓰기 어시스턴트입니다.

**핵심 기능:**

- 사용자 문서 업로드 및 벡터화
- 문서 기반 AI 채팅 (RAG)
- 12개 루브릭 기반 글 평가
- 실시간 문장 제안 (Shadow Writer)
- 외부 자료 검색 (Deep Scholar)

### 1.2 기술 스택

| 범주              | 기술                                             |
| ----------------- | ------------------------------------------------ |
| **Frontend**      | Next.js 14 (App Router), TypeScript, TailwindCSS |
| **Backend**       | Next.js API Routes (Serverless)                  |
| **Database**      | Supabase (PostgreSQL + pgvector)                 |
| **LLM**           | Google Gemini 3, OpenAI GPT-5                    |
| **Embedding**     | OpenAI text-embedding-3-small (1536 dim)         |
| **Vector Search** | Supabase pgvector (HNSW 인덱스)                  |
| **Deployment**    | Vercel                                           |

---

## 2. 아키텍처 다이어그램

### 2.1 전체 시스템 아키텍처

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLIENT (Browser)                                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌─────────────────┐ │
│  │   Editor     │  │   ChatTab    │  │  Documents   │  │  RAG Settings   │ │
│  │ (TipTap)     │  │ (useChat)    │  │  (Upload)    │  │  (Preferences)  │ │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └────────┬────────┘ │
└─────────┼─────────────────┼─────────────────┼───────────────────┼──────────┘
          │                 │                 │                   │
          ▼                 ▼                 ▼                   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                            API ROUTES (Vercel)                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌─────────────────┐ │
│  │ /api/suggest │  │  /api/chat   │  │/api/documents│  │ /api/rag/*      │ │
│  │              │  │  (Streaming) │  │  /upload     │  │  /evaluate      │ │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └────────┬────────┘ │
└─────────┼─────────────────┼─────────────────┼───────────────────┼──────────┘
          │                 │                 │                   │
          ▼                 ▼                 ▼                   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           LIB (Business Logic)                               │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │                          lib/rag/ (RAG Core)                            ││
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌────────────────┐ ││
│  │  │   search/   │  │  embedding  │  │   selfRAG   │  │   rubrics      │ ││
│  │  │  ├─ hybrid  │  │   .ts       │  │    .ts      │  │    .ts         │ ││
│  │  │  ├─ vector  │  │             │  │             │  │                │ ││
│  │  │  ├─ keyword │  │             │  │             │  │                │ ││
│  │  │  └─ pattern │  │             │  │             │  │                │ ││
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └────────────────┘ ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │                          lib/llm/ (LLM Core)                            ││
│  │  ┌─────────────┐  ┌─────────────────────────────────────────────────┐  ││
│  │  │   gateway   │  │ providers/  ├─ gemini.ts  ├─ openai.ts         │  ││
│  │  │    .ts      │  │             └─ base.ts                          │  ││
│  │  └──────┬──────┘  └──────────────────────────────────────────────────┘  ││
│  └─────────┼────────────────────────────────────────────────────────────────┘│
└────────────┼────────────────────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        EXTERNAL SERVICES                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                       │
│  │   Supabase   │  │    Gemini    │  │    OpenAI    │                       │
│  │  PostgreSQL  │  │     API      │  │     API      │                       │
│  │  + pgvector  │  │              │  │  (Embedding) │                       │
│  └──────────────┘  └──────────────┘  └──────────────┘                       │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 AI 채팅 요청 흐름

```
사용자 질문
     │
     ▼
┌────────────────────────────────────────────────────────────────────────┐
│                         /api/chat (POST)                                │
├────────────────────────────────────────────────────────────────────────┤
│ 1. 인증 확인 (Supabase Auth)                                           │
│ 2. 사용자 메시지 저장                                                   │
│ 3. Progressive Streaming 시작                                          │
│    └─ [STATUS] 🔍 자료 검색 중...                                       │
├────────────────────────────────────────────────────────────────────────┤
│ 4. Parallel Fetch (Promise.all)                                        │
│    ├─ searchUserPreferences()     → 사용자 선호 스타일                  │
│    ├─ searchTemplateContext()     → 템플릿 기준                         │
│    └─ performRAGSearch()          → 문서 검색 (핵심)                    │
├────────────────────────────────────────────────────────────────────────┤
│ 5. 프롬프트 빌드                                                        │
│    └─ buildSystemPrompt() + buildFullPrompt()                          │
├────────────────────────────────────────────────────────────────────────┤
│ 6. LLM 스트리밍 응답                                                    │
│    └─ generateTextStream() → 실시간 타이핑 효과                         │
├────────────────────────────────────────────────────────────────────────┤
│ 7. Self-RAG 검증 (Lazy Mode)                                           │
│    └─ verifyGroundedness() → 할루시네이션 탐지                          │
├────────────────────────────────────────────────────────────────────────┤
│ 8. 응답 저장 및 종료                                                    │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. 문서 처리 파이프라인

### 3.1 업로드 → 임베딩 흐름

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        Document Processing Pipeline                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  [1. Upload]                                                                 │
│      │ POST /api/documents/upload                                            │
│      │ ├─ 파일 유효성 검사 (PDF, TXT, DOCX)                                   │
│      │ ├─ Supabase Storage 저장                                              │
│      │ └─ documents 테이블 레코드 생성 (status: 'pending')                    │
│      ▼                                                                       │
│  [2. Text Extraction]                                                        │
│      │ /api/documents/[id]/extract-text                                      │
│      │ ├─ PDF: pdf-parse                                                     │
│      │ ├─ DOCX: mammoth                                                      │
│      │ ├─ 이미지: Gemini Vision OCR                                          │
│      │ └─ TXT: 직접 읽기                                                      │
│      ▼                                                                       │
│  [3. Chunking]                                                               │
│      │ lib/rag/chunking.ts                                                   │
│      │ ├─ Semantic Chunking (기본)                                           │
│      │ │   └─ 문장 경계 기반, 500-1000자 청크                                  │
│      │ └─ Agentic Chunking (선택)                                            │
│      │       └─ LLM이 문서 구조 분석 후 최적 분할                               │
│      ▼                                                                       │
│  [4. Embedding]                                                              │
│      │ lib/rag/embedding.ts                                                  │
│      │ ├─ Model: text-embedding-3-small                                      │
│      │ ├─ Dimension: 1536                                                    │
│      │ ├─ Batch 처리: 최대 100개씩                                            │
│      │ └─ 재시도: 3회, 지수 백오프                                            │
│      ▼                                                                       │
│  [5. Storage]                                                                │
│      │ Supabase: document_chunks 테이블                                      │
│      │ ├─ id: UUID                                                           │
│      │ ├─ document_id: FK                                                    │
│      │ ├─ content: TEXT                                                      │
│      │ ├─ embedding: vector(1536)                                            │
│      │ ├─ chunk_index: INT                                                   │
│      │ └─ metadata: JSONB                                                    │
│      ▼                                                                       │
│  [6. Complete]                                                               │
│      documents.status = 'completed'                                          │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 핵심 파일

| 파일                           | 역할                                |
| ------------------------------ | ----------------------------------- |
| `lib/rag/chunking.ts`          | 문서 청킹 로직 (22,607 bytes)       |
| `lib/rag/agenticChunking.ts`   | LLM 기반 지능형 청킹 (13,686 bytes) |
| `lib/rag/embedding.ts`         | OpenAI 임베딩 생성 (13,897 bytes)   |
| `lib/rag/documentProcessor.ts` | 문서 처리 통합 (19,853 bytes)       |

### 3.3 임베딩 설정

```typescript
// lib/rag/embedding.ts
export const EMBEDDING_CONFIG = {
  model: "text-embedding-3-small", // OpenAI 모델
  dimensions: 1536, // 벡터 차원
  vendor: "openai",
} as const;

const MAX_BATCH_SIZE = 100; // 배치 크기
const MAX_RETRIES = 3; // 재시도 횟수
const RETRY_DELAY = 1000; // 재시도 대기 (ms)
```

---

## 4. RAG 검색 파이프라인

### 4.1 Hybrid Search 아키텍처

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Hybrid Search Pipeline                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  사용자 쿼리: "글쓰기 기법에 대해 알려줘"                                      │
│      │                                                                       │
│      ▼                                                                       │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                    Query Preprocessing                                  │ │
│  │  ├─ embedTextWithCache(): 쿼리 임베딩 생성 (캐시 활용)                   │ │
│  │  └─ Query Expansion (선택): 동의어 확장                                 │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│      │                                                                       │
│      ▼                                                                       │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                    Parallel Search                                      │ │
│  │  ┌──────────────────────┐    ┌──────────────────────┐                  │ │
│  │  │    Vector Search     │    │   Keyword Search     │                  │ │
│  │  │  ──────────────────  │    │  ──────────────────  │                  │ │
│  │  │  • Supabase pgvector │    │  • PostgreSQL FTS    │                  │ │
│  │  │  • Cosine Similarity │    │  • ts_rank_cd        │                  │ │
│  │  │  • HNSW Index        │    │  • Korean Tokenizer  │                  │ │
│  │  │  • Top-K: 20개       │    │  • Top-K: 20개       │                  │ │
│  │  └──────────┬───────────┘    └──────────┬───────────┘                  │ │
│  └─────────────┼────────────────────────────┼─────────────────────────────┘ │
│                │                            │                                │
│                ▼                            ▼                                │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                    Score Fusion                                         │ │
│  │  ┌──────────────────────────────────────────────────────────────────┐  │ │
│  │  │  Weighted Score Fusion (기본)                                     │  │ │
│  │  │  ────────────────────────────────────────────────────────────────│  │ │
│  │  │  finalScore = (vectorScore × 0.6) + (keywordScore × 0.4)        │  │ │
│  │  │                                                                   │  │ │
│  │  │  또는 RRF (Reciprocal Rank Fusion)                               │  │ │
│  │  │  ────────────────────────────────────────────────────────────────│  │ │
│  │  │  score = Σ 1 / (k + rank)  (k = 60)                             │  │ │
│  │  └──────────────────────────────────────────────────────────────────┘  │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                │                                                             │
│                ▼                                                             │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                    Post-Processing                                      │ │
│  │  ├─ Deduplication: chunkId 기준 중복 제거                               │ │
│  │  ├─ Min Score Filter: 0.35 이하 제거                                    │ │
│  │  ├─ Re-ranking (선택): LLM 기반 재순위                                  │ │
│  │  └─ Top-K Selection: 최종 5개 반환                                      │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                │                                                             │
│                ▼                                                             │
│  SearchResult[]: { chunkId, content, score, metadata }                      │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 4.2 검색 모듈 구조

```
lib/rag/search/
├── index.ts          # Barrel file (public API)
├── types.ts          # 타입 정의
├── utils.ts          # 유틸리티 함수
├── logger.ts         # RAG 로깅
├── vector.ts         # 벡터 검색 (pgvector)
├── keyword.ts        # 키워드 검색 (FTS)
├── pattern.ts        # 패턴 기반 검색
├── hybrid.ts         # 하이브리드 검색 (통합)
└── wrapper.ts        # 패턴 검색 래퍼
```

### 4.3 핵심 타입 정의

```typescript
// lib/rag/search/types.ts

/** 검색 결과 */
export interface SearchResult {
  chunkId: string; // 청크 UUID
  content: string; // 청크 내용
  score: number; // 유사도 점수 (0-1)
  metadata?: {
    title?: string; // 문서 제목
    documentId?: string; // 문서 ID
    chunkIndex?: number; // 청크 순서
    patternType?: string; // 패턴 유형 (hook, cta 등)
    tier?: "core" | "style" | "detail"; // 루브릭 티어
  };
}

/** 하이브리드 검색 옵션 */
export interface HybridSearchOptions {
  userId: string; // 사용자 ID (필수)
  projectId?: string; // 프로젝트 ID
  topK?: number; // 반환 개수 (기본: 5)
  minScore?: number; // 최소 점수 (기본: 0.35)
  vectorWeight?: number; // 벡터 가중치 (기본: 0.6)
  keywordWeight?: number; // 키워드 가중치 (기본: 0.4)
  patternType?: string; // 패턴 필터
  category?: string; // 카테고리 필터
}
```

### 4.4 검색 상수

```typescript
// lib/rag/search/utils.ts

export const RRF_K = 60; // RRF 상수
export const DEFAULT_TOP_K = 5; // 기본 반환 개수
export const DEFAULT_VECTOR_WEIGHT = 0.6; // 벡터 가중치
export const DEFAULT_KEYWORD_WEIGHT = 0.4; // 키워드 가중치
export const MAX_RETRY_COUNT = 3; // 최대 재시도
export const INITIAL_BACKOFF_MS = 200; // 초기 백오프
export const EMBEDDING_DIMENSION = 1536; // 임베딩 차원
```

---

## 5. 루브릭 시스템

### 5.1 12-Rubric Rule

PRISM Writer는 **12개 루브릭**을 사용하여 글을 평가합니다.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         12-Rubric System (v2.0)                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                     🟢 CORE (핵심) - 5개                                │ │
│  │  글의 본질적 성패를 가르는 핵심 기준                                      │ │
│  │  ────────────────────────────────────────────────────────────────────  │ │
│  │  • hook_opening: 훅 오프닝 (첫 문장 관심 유발)                          │ │
│  │  • structure_logical: 논리적 구조 (서론-본론-결론)                       │ │
│  │  • tone_consistency: 어투 일관성                                        │ │
│  │  • persuasion_logic: 설득 논리                                          │ │
│  │  • cta_specific: CTA 구체성                                             │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                     🔵 STYLE (스타일) - 4개                             │ │
│  │  글의 매력도와 가독성을 높이는 장치                                       │ │
│  │  ────────────────────────────────────────────────────────────────────  │ │
│  │  • metaphor_quality: 비유 품질                                          │ │
│  │  • rhythm_sentence: 문장 리듬                                           │ │
│  │  • tone_authority: 전문성 어투                                          │ │
│  │  • trust_evidence: 신뢰 근거                                            │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                     ⚪ DETAIL (디테일) - 3개                            │ │
│  │  완성도를 높이는 미세 조정                                               │ │
│  │  ────────────────────────────────────────────────────────────────────  │ │
│  │  • rhythm_paragraph: 문단 리듬                                          │ │
│  │  • cta_friction: 마찰 감소                                              │ │
│  │  • trust_social: 사회적 증거                                            │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 5.2 루브릭 카테고리

```typescript
// lib/rag/rubrics.ts

export type RubricCategory =
  | "structure" // 구조
  | "tone" // 어투
  | "persuasion" // 설득
  | "rhythm" // 리듬
  | "trust" // 신뢰
  | "cta"; // 행동 유도

export type RubricTier = "core" | "style" | "detail";

export const TIER_CONFIG = {
  core: {
    label: "🟢 Core",
    max: 5,
    description: "핵심 성패 기준",
  },
  style: {
    label: "🔵 Style",
    max: 4,
    description: "글의 매력도와 가독성",
  },
  detail: {
    label: "⚪ Detail",
    max: 3,
    description: "완성도를 높이는 미세 조정",
  },
};
```

### 5.3 평가 파이프라인

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        Rubric Evaluation Pipeline                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  [Input] 사용자 글                                                           │
│      │                                                                       │
│      ▼                                                                       │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │  1. Criteria Pack 빌드 (criteriaPackBuilder.ts)                        │ │
│  │     ├─ 각 루브릭별 Rule/Example/Pattern 검색 쿼리 생성                   │ │
│  │     └─ queryBuilder.ts: buildSearchQueries()                            │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│      │                                                                       │
│      ▼                                                                       │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │  2. Evidence Pack 수집 (evidencePack.ts)                               │ │
│  │     ├─ 각 루브릭별 RAG 검색 실행                                        │ │
│  │     └─ sufficiencyGate.ts: 근거 충분성 확인                             │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│      │                                                                       │
│      ▼                                                                       │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │  3. Align Judge (lib/judge/alignJudge.ts)                              │ │
│  │     ├─ 각 루브릭별 개별 평가 (1-10점)                                    │ │
│  │     └─ LLM: gemma-3-27b-it (temperature: 0.0)                          │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│      │                                                                       │
│      ▼                                                                       │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │  4. Holistic Advisor (lib/judge/holisticAdvisor.ts)                    │ │
│  │     ├─ 종합 평가 및 개선 조언                                           │ │
│  │     └─ LLM: gemini-3-flash-preview                                     │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│      │                                                                       │
│      ▼                                                                       │
│  [Output] EvaluationResult                                                   │
│     ├─ scores: { rubricId: { score, feedback } }                            │
│     ├─ overallScore: number                                                  │
│     └─ suggestions: string[]                                                 │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 6. LLM 통합

### 6.1 LLM Gateway 아키텍처

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           LLM Gateway Architecture                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│                        ┌─────────────────────────┐                          │
│                        │    LLM Gateway          │                          │
│                        │    (gateway.ts)         │                          │
│                        │  ─────────────────────  │                          │
│                        │  • generateText()       │                          │
│                        │  • generateTextStream() │                          │
│                        │  • isLLMAvailable()     │                          │
│                        └───────────┬─────────────┘                          │
│                                    │                                         │
│                      ┌─────────────┼─────────────┐                          │
│                      │             │             │                          │
│                      ▼             ▼             ▼                          │
│              ┌───────────┐  ┌───────────┐  ┌───────────┐                   │
│              │  Gemini   │  │  OpenAI   │  │  (Future) │                   │
│              │ Provider  │  │ Provider  │  │  Claude   │                   │
│              └───────────┘  └───────────┘  └───────────┘                   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 6.2 LLM Usage Map (중앙 관리)

```typescript
// config/llm-usage-map.ts

export type LLMUsageContext =
  | "rag.answer" // RAG 답변 생성
  | "rag.reviewer" // RAG 검토자
  | "rag.reranker" // 검색 결과 재순위
  | "rag.selfrag" // Self-RAG 검증
  | "suggest.completion" // Shadow Writer 자동완성
  | "judge.align" // 개별 평가
  | "judge.holistic" // 종합 평가
  | "outline.generation" // 목차 생성
  | "ocr.vision"; // OCR 비전

export const LLM_USAGE_MAP = {
  "rag.answer": {
    modelId: "gemini-3-flash-preview",
    fallback: "gpt-5-mini",
    maxTokens: 2700,
    generationConfig: {
      temperature: 0.9,
      topP: 0.95,
      topK: 40,
    },
  },
  "judge.align": {
    modelId: "gemma-3-27b-it",
    generationConfig: {
      temperature: 0.0, // 결정론적
      topP: 1.0,
      topK: 1,
    },
  },
  // ... 기타 context
};
```

### 6.3 지원 모델

| Context            | Primary Model          | Fallback   | Temperature |
| ------------------ | ---------------------- | ---------- | ----------- |
| rag.answer         | gemini-3-flash-preview | gpt-5-mini | 0.9         |
| rag.selfrag        | gemini-3-flash-preview | -          | 0.0         |
| judge.align        | gemma-3-27b-it         | -          | 0.0         |
| judge.holistic     | gemini-3-flash-preview | -          | 0.1         |
| suggest.completion | gemma-3-4b-it          | -          | 0.8         |

---

## 7. Self-RAG 시스템

### 7.1 4단계 자기 검증 RAG

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        Self-RAG 4-Stage Pipeline                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  [Stage 1] 검색 필요 판단 (checkRetrievalNecessity)                          │
│  ────────────────────────────────────────────────────────────────────────── │
│  • LLM에게 "이 질문에 문서 검색이 필요한가?" 질문                              │
│  • 인사말, 수학 계산, 시스템 질문 → 검색 스킵                                  │
│  • 도메인 질문, 문서 언급 → 검색 수행                                         │
│  • 결과: { needed: boolean, confidence: number, reason: string }            │
│      │                                                                       │
│      ▼                                                                       │
│  [Stage 2] 관련도 평가 (critiqueRetrievalResults)                            │
│  ────────────────────────────────────────────────────────────────────────── │
│  • 검색된 각 문서의 관련도를 LLM이 0-1 점수로 평가                             │
│  • 임계값(0.6) 미만 문서 필터링                                               │
│  • 상위 10개만 평가 (비용 최적화)                                             │
│      │                                                                       │
│      ▼                                                                       │
│  [Stage 3] 답변 생성                                                         │
│  ────────────────────────────────────────────────────────────────────────── │
│  • 검증된 문서만 사용하여 LLM 답변 생성                                        │
│  • 스트리밍 응답                                                              │
│      │                                                                       │
│      ▼                                                                       │
│  [Stage 4] 근거 검증 (verifyGroundedness)                                    │
│  ────────────────────────────────────────────────────────────────────────── │
│  • 생성된 답변이 실제로 문서에 근거하는지 검증                                  │
│  • 할루시네이션 탐지 및 경고 표시                                              │
│  • 결과: { isGrounded: boolean, groundednessScore: number, hallucinations }  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 7.2 Lazy Self-RAG (비용 최적화)

```typescript
// config/featureFlags.ts

// Lazy Self-RAG: 고위험 응답에만 검증 실행 (비용 70% 절감)
LAZY_SELF_RAG_MODE: true,
LAZY_SELF_RAG_MIN_RESPONSE_LENGTH: 500,  // 500자 이상
LAZY_SELF_RAG_MIN_QUERY_LENGTH: 50,      // 50자 이상
```

**Lazy Mode 조건:**

- `hasRetrievedDocs: true` (문서가 검색된 경우만)
- `responseLength >= 500` (긴 응답만)
- `queryLength >= 50` (긴 질문만)

---

## 8. AI 채팅 API

### 8.1 엔드포인트 목록

| 엔드포인트                | 메서드     | 설명                     |
| ------------------------- | ---------- | ------------------------ |
| `/api/chat`               | POST       | 메인 채팅 API (스트리밍) |
| `/api/chat/sessions`      | GET/POST   | 세션 목록/생성           |
| `/api/chat/sessions/[id]` | GET/DELETE | 세션 조회/삭제           |
| `/api/suggest`            | POST       | Shadow Writer 제안       |

### 8.2 /api/chat 요청/응답

**요청:**

```typescript
interface ChatRequest {
  messages: Array<{
    role: "user" | "assistant";
    content: string;
  }>;
  model?: string; // 기본: 'gemini-3-flash-preview'
  sessionId?: string; // 세션 ID
  projectId?: string; // 프로젝트 ID (RAG 범위)
}
```

**응답 (스트리밍):**

```
[STATUS]🔍 자료 검색 중...
[STATUS]📚 답변 생성 중...
네, 글쓰기 기법에 대해 알려드리겠습니다...
(실시간 타이핑)
```

### 8.3 프롬프트 구조

```typescript
// lib/services/chat/promptBuilder.ts

const systemPrompt = `
# 역할
당신은 PRISM Writer의 AI 글쓰기 어시스턴트입니다.

# 핵심 원칙
⚠️ 중요: 참고 자료가 제공되면 사전 지식보다 우선하세요.

# User Preferences (최우선 반영)
${userPreferences || "(별도 선호 사항 없음)"}

# 평가 기준 템플릿
${templateContext || "(템플릿 기준 없음)"}

# 참고 자료
${ragContext || "(참고 자료 없음)"}

# 출처 표기 규칙
[1], [2] 형식으로 인용 마커 사용...

# 사고 과정
1. User Preferences 확인
2. 참고 자료 분석
3. 질문과 연결
4. 답변 구성
`;
```

---

## 9. 환경 변수 설정

### 9.1 필수 환경 변수

```bash
# .env.local

# === Supabase ===
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIs...

# === LLM API Keys ===
GOOGLE_API_KEY=AIzaSy...          # Gemini API
OPENAI_API_KEY=sk-proj-...        # OpenAI (임베딩 + GPT)
```

### 9.2 Feature Flags

```bash
# === RAG 기능 ===
NEXT_PUBLIC_ENABLE_SELF_RAG=false           # Self-RAG (기본: false)
NEXT_PUBLIC_ENABLE_QUERY_EXPANSION=false    # 쿼리 확장
NEXT_PUBLIC_ENABLE_RERANKING=false          # LLM 재순위

# === Lazy Self-RAG ===
NEXT_PUBLIC_LAZY_SELF_RAG_MODE=true
NEXT_PUBLIC_LAZY_SELF_RAG_MIN_RESPONSE_LENGTH=500
NEXT_PUBLIC_LAZY_SELF_RAG_MIN_QUERY_LENGTH=50

# === UI 기능 ===
NEXT_PUBLIC_ENABLE_SHADOW_WRITER=true       # 실시간 제안
NEXT_PUBLIC_ENABLE_DEEP_SCHOLAR=true        # 외부 검색
NEXT_PUBLIC_ENABLE_CITATION_MARKERS=true    # 인용 마커

# === 채팅 기록 ===
NEXT_PUBLIC_ENABLE_CHAT_HISTORY=true
NEXT_PUBLIC_ENABLE_CHAT_HISTORY_UI=true
NEXT_PUBLIC_ENABLE_CHAT_SESSION_LIST=true
```

---

## 10. 데이터베이스 스키마

### 10.1 핵심 테이블

```sql
-- 문서
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  project_id UUID REFERENCES projects(id),
  title TEXT NOT NULL,
  file_path TEXT,
  file_type TEXT,
  status TEXT DEFAULT 'pending',  -- pending, processing, completed, failed
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 문서 청크 (벡터 저장)
CREATE TABLE document_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  content TEXT NOT NULL,
  embedding vector(1536),         -- pgvector
  chunk_index INTEGER,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- HNSW 인덱스 (벡터 검색 최적화)
CREATE INDEX ON document_chunks
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- 채팅 세션
CREATE TABLE chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  project_id UUID,
  title TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 채팅 메시지
CREATE TABLE chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES chat_sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL,  -- 'user' | 'assistant'
  content TEXT NOT NULL,
  model_id TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### 10.2 RLS 정책 (Row Level Security)

```sql
-- documents: 본인 문서만 접근
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can access own documents" ON documents
  FOR ALL USING (auth.uid() = user_id);

-- document_chunks: 본인 청크만 접근
ALTER TABLE document_chunks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can access own chunks" ON document_chunks
  FOR ALL USING (auth.uid() = user_id);

-- chat_sessions: 본인 세션만 접근
ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can access own sessions" ON chat_sessions
  FOR ALL USING (auth.uid() = user_id);
```

---

## 11. 핵심 파일 맵

### 11.1 RAG 핵심 (lib/rag/)

| 파일                | 역할                          | 크기     |
| ------------------- | ----------------------------- | -------- |
| `search/hybrid.ts`  | 하이브리드 검색 (벡터+키워드) | 10,457 B |
| `search/vector.ts`  | 벡터 검색 (pgvector)          | 9,820 B  |
| `search/keyword.ts` | 키워드 검색 (FTS)             | 7,000 B  |
| `embedding.ts`      | OpenAI 임베딩 생성            | 13,897 B |
| `chunking.ts`       | 문서 청킹                     | 22,607 B |
| `selfRAG.ts`        | 4단계 자기 검증               | 15,867 B |
| `rubrics.ts`        | 12개 루브릭 정의              | 11,491 B |
| `reranker.ts`       | LLM 재순위                    | 13,648 B |

### 11.2 LLM 핵심 (lib/llm/)

| 파일                  | 역할                | 크기     |
| --------------------- | ------------------- | -------- |
| `gateway.ts`          | LLM 통합 게이트웨이 | 5,183 B  |
| `providers/gemini.ts` | Gemini Provider     | 4,859 B  |
| `providers/openai.ts` | OpenAI Provider     | ~4,000 B |
| `parser.ts`           | LLM 응답 파싱       | 12,968 B |

### 11.3 채팅 서비스 (lib/services/chat/)

| 파일                  | 역할                   | 크기    |
| --------------------- | ---------------------- | ------- |
| `ragSearchService.ts` | RAG 검색 비즈니스 로직 | 6,675 B |
| `promptBuilder.ts`    | 프롬프트 생성          | 5,249 B |
| `chatService.ts`      | 채팅 유틸리티          | 6,282 B |

### 11.4 설정 (config/)

| 파일               | 역할                   |
| ------------------ | ---------------------- |
| `featureFlags.ts`  | Feature Flag 중앙 관리 |
| `llm-usage-map.ts` | LLM 모델 매핑          |
| `models.ts`        | 모델 레지스트리        |
| `llm.config.ts`    | LLM 기본 설정          |

---

## 📎 부록

### A. 복제 시 체크리스트

1. [ ] Supabase 프로젝트 생성 및 pgvector 확장 활성화
2. [ ] 데이터베이스 스키마 마이그레이션
3. [ ] 환경 변수 설정 (Supabase, OpenAI, Google)
4. [ ] NPM 패키지 설치 (`npm install`)
5. [ ] Vercel 배포 및 환경 변수 등록

### B. 버전 히스토리

| 버전 | 날짜       | 변경 사항 |
| ---- | ---------- | --------- |
| 1.0  | 2026-01-23 | 최초 작성 |

---

> **문서 끝**
