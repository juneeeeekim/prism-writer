# PRISM Writer 서비스 작동 기술 로직 매뉴얼 (Service Logic Technical Manual)

**문서 번호**: TR-2026-0109-02 (Revised)
**작성일**: 2026-01-09
**작성자**: Antigravity (Google Deepmind Agentic AI Architect)
**버전**: v1.1 (Code-Level Deep Dive & Visualization)
**대상**: 기술 리더, 백엔드/프론트엔드 개발자, 시스템 운영자

---

## 1. 개요 (Overview)

본 문서는 PRISM Writer 서비스의 핵심 기능을 구성하는 실제 구현 로직(Implementation Logic)과 데이터 흐름(Data Flow)을 코드 레벨에서 분석하여 기술합니다. 시스템은 **Adaptive RAG Architecture**를 기반으로 하며, Next.js API Route(Edge/Node.js), Supabase(PostgreSQL + pgvector), LLM Gateway 간의 상호작용으로 동작합니다.

---

## 2. AI 채팅 시스템 (AI Chat System)

사용자의 질문에 대해 업로드된 문서(Context)와 개인화된 설정(User Preferences, Template)을 반영하여 답변하는 RAG 파이프라인입니다.

### 2.1 기술 파이프라인 (Technical Pipeline)

```ascii
[User Input]
     │
     ▼
[API Route: POST /api/chat]
     │
     ├── 1. Authentication & Validations (Supabase Auth)
     │      (Check User ID, Block Anonymous)
     │
     ├── 2. Parallel Context Retrieval (Promise.all)
     │      │
     │      ├── A. Memory Service (User Preferences)
     │      │      Search: `rag_preferences` table (pgvector)
     │      │      Result: "사용자는 간결한 답변을 선호함"
     │      │
     │      ├── B. Template Context (Criteria)
     │      │      Fetch: `rag_templates` table
     │      │      Result: "논리적 글쓰기 가이드라인"
     │      │
     │      └── C. Document Retrieval (Hybrid Search)
     │             │
     │             ├── Self-RAG Necessity Check (LLM)
     │             │   (Is retrieval needed?)
     │             │
     │             ├── Query Expansion (LLM)
     │             │   ("마케팅" -> "디지털 마케팅 전략", "SNS 마케팅 사례")
     │             │
     │             ├── Hybrid Search (RPC: search_chunks_with_rank)
     │             │   (Keyword BM25 + Vector Semantic)
     │             │
     │             ├── Reranking (Cross-Encoder)
     │             │   (Re-sort results by relevance)
     │             │
     │             └── Sufficiency Gate (LLM)
     │                 (Is information sufficient?)
     │
     ├── 3. System Prompt Construction
     │      (Instruction + User Prefs + Template + Retrieved Docs)
     │
     ├── 4. LLM Generation (Streaming)
     │      (OpenAI GPT-4 / Gemini Pro via Gateway)
     │
     ├── 5. Post-Processing & Hallucination Check (Self-RAG)
     │      (Check if answer is grounded in docs)
     │
     └── 6. Save History
            Insert: `chat_messages` table (with citations metadata)
     │
     ▼
[User Output] (Streamed Response)
```

### 2.2 핵심 로직 상세 (Core Logic Detail)

1.  **Context Injection Strategy**: 단순 문서 주입이 아닌, `User Preferences`(과거 피드백 기반 선호도)를 **최우선 순위**로 주입하여 개인화된 톤앤매너를 보장합니다.
2.  **Hybrid Search**: `frontend/src/lib/rag/search.ts`의 `hybridSearch` 함수는 벡터 유사도(Semantic)와 키워드 일치(Lexical)를 가중치(0.6 : 0.4)로 결합하여 검색 품질을 극대화합니다.
3.  **Self-RAG Loop**: 검색 전(`Necessity Check`), 검색 후(`Sufficiency Gate`), 생성 후(`Groundedness Check`)의 3단계 검증을 통해 환각(Hallucination) 현상을 차단합니다.

---

## 3. 종합 평가 시스템 (Holistic Evaluation System)

사용자의 글을 6가지 분석 차원(Core, Style, Grammar 등)으로 평가하고, 구체적인 점수와 피드백을 제공합니다.

### 3.1 기술 파이프라인 (Technical Pipeline)

```ascii
[User Text Input] ("My Essay...")
     │
     ▼
[API Route: POST /api/rag/evaluate-holistic]
     │
     ├── 1. Project Context Isolation
     │      (Ensure `projectId` is owned by user)
     │
     ├── 2. Reference Retrieval
     │      Search: `document_chunks` table (WHERE project_id = X)
     │      Result: "Relevant background info for evaluation"
     │
     ├── 3. Template Loading
     │      Fetch: `rag_templates` (Approved criteria)
     │      Result: "Evaluation Rubric (Score 1-10 definitions)"
     │
     ├── 4. Multi-Dimensional Analysis (Parallel LLM Calls)
     │      │
     │      ├── [Logic Analysis] -> Score & Reasoning
     │      ├── [Style Analysis] -> Score & Reasoning
     │      ├── [Grammar Check]  -> Corrections
     │      └── [Structure]      -> Flow feedback
     │
     ├── 5. Chain-of-Thought Aggregation
     │      Combine: Scores + Reasoning + Specific Examples
     │      Calculate: Overall Score (Weighted Average)
     │
     ├── 6. Persistence
     │      Insert: `evaluation_logs` table (JSONB format)
     │
     ▼
[Response] (JSON: { result, score, metadata })
```

### 3.2 핵심 로직 상세

1.  **Project Isolation**: 2026-01-08 업데이트(`083_add_project_isolation`)에 따라, 평가 수행 시 다른 프로젝트의 문서가 혼입되지 않도록 `project_id` 필터를 강제합니다.
2.  **Chain-of-Thought (CoT)**: LLM에게 단순히 점수를 매기게 하지 않고, "왜 이 점수인지 설명하라"(`Reasoning`)는 과정을 먼저 수행시킨 후 점수를 출력하게 하여 평가의 신뢰성을 높입니다. (`lib/judge/holisticAdvisor.ts`)

---

## 4. 스마트 검색 (Smart Search)

단순 검색을 넘어 사용자의 '검색 의도'를 파악하고, 관련된 지식을 통합하여 제공합니다.

### 4.1 기술 파이프라인 (Technical Pipeline)

```ascii
[Search Query] ("Marketing strategy")
     │
     ▼
[Search Engine: lib/rag/search.ts]
     │
     ├── 1. Intent Analysis & Classification
     │      (LLM: Is this a factual query, summary request, or comparison?)
     │
     ├── 2. Query Expansion (if intent is complex)
     │      "Marketing strategy"
     │      -> "Digital marketing tactics", "Content marketing examples"
     │
     ├── 3. Parallel Search Execution
     │      ├── Vector Search (Semantic) -> Top 20
     │      └── Keyword Search (BM25)    -> Top 20
     │
     ├── 4. Reciprocal Rank Fusion (RRF)
     │      Merge results and re-rank high confidence items
     │
     ├── 5. LLM Re-ranking (Cross-Encoder)
     │      (Score relevance 0.0 ~ 1.0 for top candidates)
     │
     └── 6. Dynamic Summarization
            Generate snippet: "This document contains..." explaining WHY it matched
     │
     ▼
[Search Results] (List of Docs with Context)
```

---

## 5. 구조 분석 및 피드백 (Structure Analysis & Feedback)

문서의 논리적 순서를 AI가 제안하고, 사용자의 수용/수정 여부를 학습하여 RAG 시스템을 진화시킵니다.

### 5.1 기술 파이프라인 (Technical Pipeline)

```ascii
[Analyze Request] (Target Documents)
     │
     ▼
[API Route: POST /api/rag/structure/analyze]
     │
     ├── 1. Content Abstraction
     │      Extract: Title, Summary, Keywords (reduce token usage)
     │
     ├── 2. LLM Ordering Proposal
     │      Prompt: "Propose optimal logical flow (Intro -> Body -> Conclusion)"
     │      Output: `suggestedOrder` list
     │
     ├── 3. Save Suggestion
     │      Insert: `structure_suggestions` table
     │      Return: `suggestionId` (UUID)
     │
     ▼
[Frontend: User Interaction]
     │
     ├── Case A: Accept (AI 제안 수락)
     │   │
     │   ▼
     │ [Signal: structure_accept]
     │ (User trusts AI -> Relax RAG Threshold)
     │ Update: `structure_suggestions.is_applied = true`
     │ Update: `project_rag_preferences.similarity_threshold -= 0.02`
     │
     └── Case B: Modify (Drag & Drop)
         │
         ▼
         [Signal: structure_modify]
         (User corrects AI -> Stricter RAG Threshold)
         Insert: `structure_user_adjustments` (Save modified order)
         Update: `project_rag_preferences.similarity_threshold += 0.01`
```

### 5.2 핵심 로직 상세

1.  **Adaptive Thresholding**: 사용자가 AI의 제안을 수정하면 시스템은 "내가 아직 부족하구나, 더 엄격하게 검색해야지"라고 판단하여 검색 임계값(`similarity_threshold`)을 상향 조정합니다. 반대로 수락하면 "이 정도면 충분하구나"라고 판단하여 임계값을 하향 조정, 더 넓은 범위의 정보를 가져옵니다.
2.  **Graceful Degradation**: DB 저장이나 피드백 연동이 실패하더라도, 사용자의 '순서 변경' 행위 자체는 방해받지 않도록 `try-catch` 블록으로 비침투적(Non-intrusive) 설계를 적용했습니다.

---

본 매뉴얼은 실제 소스 코드(`src/app/api/...`)와 데이터베이스 스키마(`supabase/migrations/...`)를 기반으로 작성되었습니다.
