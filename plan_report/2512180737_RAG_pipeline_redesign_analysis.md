# 📊 PRISM Writer RAG 파이프라인 재설계 분석 리포트

> **작성일**: 2025-12-18  
> **목적**: RAG 시스템 파이프라인 재설계 및 업그레이드를 위한 현행 시스템과 제안 파이프라인 비교 분석

---

## 1. 회의 참석자 (전문가 패널)

| 역할                 | 담당 영역                            |
| -------------------- | ------------------------------------ |
| 시니어 개발자 (사회) | 범위/우선순위/리스크 조율, 결론 도출 |
| 시스템 아키텍트      | Ports&Adapters/DI/Strategy 설계      |
| 백엔드 엔지니어      | API/유스케이스/모델 라우팅 구현      |
| DB 엔지니어          | 스키마/인덱스/버전 관리 설계         |
| AI/ML 엔지니어       | 청킹/임베딩/검색 튜닝/리랭킹         |
| IR(검색) 엔지니어    | 검색 품질/하이브리드 검색            |
| 보안 엔지니어        | ACL/RLS/권한 관리                    |
| QA 엔지니어          | 테스트/회귀/품질 게이트              |
| 프론트엔드 리드      | 근거 UI/검토 결과 UI                 |
| DevOps 엔지니어      | CI/CD/관측/비용 로깅                 |

---

## 2. 분석 대상 문서 요약

### 2.1 파이프라인 회의록 (v1.0)

- **핵심 파이프라인**: 루브릭별 Retrieval → 하이브리드/리랭킹 → Evidence Pack → Judge → Citation/Consistency Gate → Telemetry → 개선 루프
- **우선순위 투표** (13명):
  - P0: ACL/Namespace + Retrieval 필터, Judge Contract, 루브릭별 쿼리, 하이브리드+리랭커, Citation Gate
  - P1: Telemetry, Consistency Gate, 캐시/쿼터, Evidence Pack 표준화
  - P2: 모드 프롬프트, Category/Difficulty 태깅

### 2.2 LLM 스위칭 회의록

- **핵심 결정**: 역할별 LLM 모델 분리 운영
  - Chunker: 룰 기반 (옵션 LLM 보조)
  - Embedder: 1개 고정 (버전 저장 필수)
  - Retriever: 하이브리드 검색 (벡터 + 텍스트)
  - Answer: TopK 컨텍스트로 답변 생성 (LLM)
  - Reviewer: 답변이 근거와 일치하는지 검토 (LLM)
- **Router 3모드**: cheap / standard / strict

---

## 3. 현재 PRISM Writer 시스템 분석

### 3.1 현재 구현된 RAG 모듈

| 모듈                | 파일                   | 상태      | 설명                                     |
| ------------------- | ---------------------- | --------- | ---------------------------------------- |
| **청킹**            | `chunking.ts`          | ✅ 구현됨 | 문단 단위 분할, overlap 지원             |
| **임베딩**          | `embedding.ts`         | ✅ 구현됨 | OpenAI text-embedding-3-small (1536차원) |
| **벡터 검색**       | `search.ts`            | ✅ 구현됨 | pgvector 기반 유사도 검색                |
| **키워드 검색**     | `search.ts`            | ✅ 구현됨 | PostgreSQL Full Text Search              |
| **하이브리드 검색** | `search.ts`            | ✅ 구현됨 | RRF (Reciprocal Rank Fusion) 알고리즘    |
| **리랭커**          | `reranker.ts`          | ✅ 구현됨 | LLM 기반 관련성 평가                     |
| **비용 관리**       | `costGuard.ts`         | ✅ 구현됨 | 토큰/요청 한도 관리                      |
| **문서 처리**       | `documentProcessor.ts` | ✅ 구현됨 | 문서 업로드/처리 파이프라인              |
| **루브릭**          | `rubrics.ts`           | ✅ 구현됨 | 평가 기준 정의                           |

### 3.2 현재 시스템 아키텍처 (간략)

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Document   │────▶│   Chunking  │────▶│  Embedding  │
│   Upload    │     │  (문단분할)  │     │  (OpenAI)   │
└─────────────┘     └─────────────┘     └─────────────┘
                                               │
                                               ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│    Answer   │◀────│   Rerank    │◀────│   Search    │
│  Generation │     │  (LLM기반)   │     │ (Hybrid)   │
└─────────────┘     └─────────────┘     └─────────────┘
```

---

## 4. GAP 분석: 현행 vs 제안 파이프라인

### 4.1 ✅ 이미 구현된 항목 (변경 불필요)

| 항목                        | 현재 상태 | 비고                          |
| --------------------------- | --------- | ----------------------------- |
| 하이브리드 검색 (BM25+벡터) | ✅ 구현됨 | RRF 알고리즘 적용             |
| 리랭커 (K 제한)             | ✅ 구현됨 | LLM 기반, Top-K 제한 가능     |
| 룰 기반 청킹                | ✅ 구현됨 | 문단 단위, overlap 지원       |
| 임베딩 생성                 | ✅ 구현됨 | OpenAI text-embedding-3-small |
| 비용 관리 (쿼터)            | ✅ 구현됨 | costGuard.ts                  |

### 4.2 ⚠️ 개선/보완 필요 항목

| 항목                     | 현재 상태    | 제안                                                      | 우선순위 |
| ------------------------ | ------------ | --------------------------------------------------------- | -------- |
| **임베딩 버전 관리**     | ❌ 없음      | `embedding_model_id`, `embedding_dim`, `embedded_at` 저장 | 🔴 P0    |
| **ACL/Namespace 게이트** | ⚠️ RLS 있음  | 검색 전 강제 필터링 게이트 추가                           | 🔴 P0    |
| **Judge Contract**       | ❌ 없음      | JSON 스키마 고정 + 근거 인용 강제                         | 🔴 P0    |
| **Citation Gate**        | ❌ 없음      | 인용이 원문에 실제 존재하는지 검증                        | 🔴 P0    |
| **Reviewer (검토 모델)** | ❌ 없음      | Answer와 별도 모델로 근거 일치 여부 검토                  | 🟡 P1    |
| **Model Router**         | ❌ 없음      | cheap/standard/strict 3모드 라우팅                        | 🟡 P1    |
| **Telemetry (run_id)**   | ⚠️ 부분 구현 | 단계별 latency, 토큰/비용 로깅 강화                       | 🟡 P1    |
| **Evidence Pack 표준화** | ❌ 없음      | 루브릭별 근거 묶음 스키마                                 | 🟡 P1    |
| **Consistency Gate**     | ❌ 없음      | 골드셋 회귀테스트                                         | 🟡 P1    |
| **Hard Negative 수집**   | ❌ 없음      | 오답 근거 수집 → 튜닝용                                   | 🟢 P2    |

---

## 5. 핵심 개선 사항 상세

### 5.1 🔴 P0: 임베딩 버전 관리

**현재 문제**:

- `rag_chunks` 테이블에 어떤 모델로 임베딩했는지 기록이 없음
- 모델 변경 시 기존 청크와 신규 청크를 섞으면 검색 품질 저하

**개선 방안**:

```sql
ALTER TABLE rag_chunks
  ADD COLUMN embedding_model_id TEXT NOT NULL DEFAULT 'text-embedding-3-small',
  ADD COLUMN embedding_dim INT NOT NULL DEFAULT 1536,
  ADD COLUMN embedded_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE INDEX idx_chunks_embedding_model_id ON rag_chunks(embedding_model_id);
```

**검색 시 필터**:

```sql
WHERE embedding_model_id = :active_embedding_model_id
```

---

### 5.2 🔴 P0: Judge Contract (JSON 스키마 강제)

**현재 문제**:

- LLM 응답 형식이 고정되지 않아 파싱 실패 가능
- 근거 인용 강제 없음

**개선 방안**:

```typescript
interface JudgeResult {
  verdict: "pass" | "fail" | "insufficient_evidence";
  score: number; // 0-100
  evidence: {
    chunk_id: string;
    quote: string; // 실제 인용문
    relevance: number;
  }[];
  reasoning: string;
  missing_evidence?: string[]; // 부족한 근거 유형
}
```

---

### 5.3 🔴 P0: Citation Gate (인용 검증)

**현재 문제**:

- LLM이 생성한 인용문이 실제 원문에 있는지 검증 안함
- 환각(hallucination) 가능성

**개선 방안**:

```typescript
async function verifyCitation(
  quote: string,
  sourceChunks: Chunk[]
): Promise<{ valid: boolean; matchedChunkId?: string }> {
  // 정확 일치 또는 fuzzy matching
  for (const chunk of sourceChunks) {
    if (
      chunk.content.includes(quote) ||
      fuzzyMatch(chunk.content, quote) > 0.9
    ) {
      return { valid: true, matchedChunkId: chunk.id };
    }
  }
  return { valid: false };
}
```

---

### 5.4 🟡 P1: Reviewer 모델 (검토 단계)

**목적**: Answer 모델의 환각을 검토 모델로 억제

**UI 배지**:

- ✅ 근거 일치 가능성 높음
- ⚠️ 근거 부족/추정 포함
- ⛔ 근거와 불일치 가능성

**구현**:

```typescript
interface ReviewResult {
  badge: "✅" | "⚠️" | "⛔";
  confidence: number; // 0-1
  issues?: string[];
}
```

---

### 5.5 🟡 P1: Model Router (모드 기반)

**3가지 모드**:

| 모드     | Answer 모델 | Reviewer           | 비용 |
| -------- | ----------- | ------------------ | ---- |
| cheap    | gpt-4o-mini | off                | $    |
| standard | gpt-4o-mini | gpt-4o-mini (간소) | $$   |
| strict   | gpt-4o      | gpt-4o (강화)      | $$$  |

---

## 6. 구현 우선순위 및 일정 (권장)

### Phase 1: P0 (필수 골격) - 2주

| 주차  | 작업                              | 담당        |
| ----- | --------------------------------- | ----------- |
| 1주차 | 임베딩 버전 관리 스키마 추가      | DB 엔지니어 |
| 1주차 | ACL 필터 게이트 검색 전 강제 적용 | 백엔드      |
| 2주차 | Judge Contract JSON 스키마 구현   | AI/ML       |
| 2주차 | Citation Gate (인용 검증) 구현    | 백엔드      |

### Phase 2: P1 (운영 안정화) - 2주

| 주차  | 작업                           | 담당             |
| ----- | ------------------------------ | ---------------- |
| 3주차 | Reviewer 모델 + 배지 UI        | AI/ML + Frontend |
| 3주차 | Model Router (3모드)           | Backend          |
| 4주차 | Telemetry 강화 (run_id + 비용) | DevOps           |
| 4주차 | Evidence Pack 표준화           | Backend          |

### Phase 3: P2 (확장) - 필요 시

- Hard Negative 수집
- 모드 프롬프트 (코칭/교정/채점)
- Category/Difficulty 태깅

---

## 7. 전문가 패널 투표 결과

### 7.1 "지금 바로 적용해야 할 것" 투표

| 항목               | 득표  | 결정       |
| ------------------ | ----- | ---------- |
| 임베딩 버전 관리   | 10/10 | ✅ P0 확정 |
| Judge Contract     | 9/10  | ✅ P0 확정 |
| Citation Gate      | 9/10  | ✅ P0 확정 |
| ACL 검색 필터 강화 | 8/10  | ✅ P0 확정 |
| Reviewer 모델      | 7/10  | ➡️ P1      |
| Model Router       | 6/10  | ➡️ P1      |
| Telemetry 강화     | 6/10  | ➡️ P1      |

### 7.2 전문가 코멘트

**시스템 아키텍트**:

> 임베딩 버전 관리는 모델 교체 시 필수입니다. 지금 안 하면 나중에 마이그레이션 지옥입니다.

**보안 엔지니어**:

> ACL 필터는 RLS만으로 부족합니다. 검색 쿼리 단계에서 강제 필터링이 필요합니다.

**AI/ML 엔지니어**:

> Citation Gate가 없으면 환각 문제를 해결할 수 없습니다. P0로 반드시 넣어야 합니다.

**QA 엔지니어**:

> Judge Contract가 없으면 테스트 케이스 작성이 불가능합니다. 스키마 먼저 고정하세요.

---

## 8. 결론 및 다음 단계

### 8.1 핵심 결론

1. **현재 시스템은 기본 RAG 파이프라인이 잘 구현되어 있음**

   - 하이브리드 검색, 리랭킹, 비용 관리 등 핵심 기능 완료

2. **품질/신뢰성 강화를 위해 4가지 P0 항목 추가 필요**

   - 임베딩 버전 관리
   - ACL 검색 필터 강화
   - Judge Contract (JSON 스키마)
   - Citation Gate (인용 검증)

3. **LLM 모델 분리 운영 (Reviewer)은 P1으로 진행**
   - cheap/standard/strict 모드 라우터 포함

### 8.2 다음 회의 아젠다

1. **P0 구현 순서 확정**
2. **계약서 3종 문서화**
   - Retrieval Contract
   - Judge Contract
   - Eval(Gate) Contract
3. **P0 성공 기준 숫자 확정**
   - 근거부족률 목표: \_\_% 이하
   - 인용검증 실패율: \_\_% 이하
   - P95 응답시간: \_\_ms 이하

---

## 부록: 참조 문서

- [뉴페이즈2_pipeline_meeting_recap_vote_v1.md](file:///c:/Users/chyon/Desktop/01.Project/00.Program/prismLM/plan_report/뉴페이즈2_pipeline_meeting_recap_vote_v1.md)
- [뉴페이즈2\_프리즘\_llm 스위칭 md.md](file:///c:/Users/chyon/Desktop/01.Project/00.Program/prismLM/plan_report/뉴페이즈2_프리즘_llm%20스위칭%20md.md)
