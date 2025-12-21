# 🔍 PRISM Writer RAG 시스템 심층 설명

> 작성일: 2025-12-21  
> 목적: RAG 시스템의 작동 원리, 사용 방법, 결과물 예시 문서화

---

## 1. RAG 시스템 개요

**RAG(Retrieval-Augmented Generation)**는 문서에서 관련 정보를 검색하여 AI 답변의 정확성과 근거를 강화하는 시스템입니다. PRISM Writer의 RAG 시스템은 강의자료나 문서를 업로드하면, 이를 검색 가능한 형태로 처리하고, 사용자 질문에 대해 **문서 기반의 근거 있는 답변**을 제공합니다.

---

## 2. 작동 원리 (파이프라인)

### 📤 문서 업로드 흐름 (Ingestion Pipeline)

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Upload    │────▶│   Chunking  │────▶│  Embedding  │────▶│   Index     │
│  (업로드)    │     │  (청킹)      │     │  (임베딩)    │     │  (저장)     │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
```

| 단계          | 설명                                                      | 담당 파일              |
| ------------- | --------------------------------------------------------- | ---------------------- |
| **Upload**    | 사용자가 파일(PDF, DOCX, TXT, MD)을 업로드                | `route.ts`             |
| **Chunking**  | 문서를 512토큰 단위 청크로 분할 (50토큰 오버랩)           | `chunking.ts`          |
| **Embedding** | OpenAI `text-embedding-3-small` 모델로 1536차원 벡터 생성 | `embedding.ts`         |
| **Index**     | Supabase(pgvector)에 청크와 임베딩 저장                   | `documentProcessor.ts` |

### 🔎 검색 흐름 (Query Pipeline)

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Query     │────▶│  Hybrid     │────▶│   Rerank    │────▶│   Answer    │
│  (질의)      │     │  Search     │     │  (리랭킹)    │     │  (답변)     │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
```

| 단계              | 설명                                                  | 담당 파일     |
| ----------------- | ----------------------------------------------------- | ------------- |
| **Query**         | 사용자 질문 입력                                      | -             |
| **Hybrid Search** | 벡터 검색(70%) + 키워드 검색(30%) 병합 (RRF 알고리즘) | `search.ts`   |
| **Rerank**        | LLM 기반 관련성 재평가                                | `reranker.ts` |
| **Answer**        | 검색된 근거를 바탕으로 답변 생성                      | -             |

---

## 3. 시스템 가동 방법

### ⚙️ 사전 설정 필요 사항

| 항목            | 설정 위치           | 필수 값                                                          |
| --------------- | ------------------- | ---------------------------------------------------------------- |
| OpenAI API 키   | `.env.local`        | `OPENAI_API_KEY=sk-...`                                          |
| Supabase 연결   | `.env.local`        | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`      |
| DB 마이그레이션 | Supabase SQL Editor | `012_rag_documents_schema.sql`, `013_rag_chunks_schema.sql` 실행 |
| Storage 버킷    | Supabase Storage    | `rag-documents` 버킷 생성                                        |

### 🚀 시스템 시작

```bash
cd frontend
npm run dev
```

서버가 시작되면 `http://localhost:3000`에서 접속 가능합니다.

---

## 4. 파일 업로드 방법

### 📁 허용 파일 형식

| 형식        | MIME Type                                                                 | 최대 크기 |
| ----------- | ------------------------------------------------------------------------- | --------- |
| PDF         | `application/pdf`                                                         | 10MB      |
| Word (DOCX) | `application/vnd.openxmlformats-officedocument.wordprocessingml.document` | 10MB      |
| 텍스트      | `text/plain`                                                              | 10MB      |
| 마크다운    | `text/markdown`                                                           | 10MB      |

### 📤 업로드 API 호출 방법

```typescript
// FormData로 파일 전송
const formData = new FormData();
formData.append("file", file);

const response = await fetch("/api/documents/upload", {
  method: "POST",
  body: formData,
});

const result = await response.json();
// { success: true, documentId: "uuid-xxx", message: "파일이 성공적으로 업로드되었습니다." }
```

### 📂 저장 위치

| 데이터        | 저장 위치                                                           |
| ------------- | ------------------------------------------------------------------- |
| 원본 파일     | `Supabase Storage > rag-documents/{사용자ID}/{타임스탬프}_{파일명}` |
| 메타데이터    | `rag_documents` 테이블                                              |
| 청크 + 임베딩 | `rag_chunks` 테이블                                                 |

---

## 5. RAG 시스템 사용 방법

### 🔍 하이브리드 검색 API 사용

```typescript
import { hybridSearch } from "@/lib/rag/search";

// 질문에 대한 관련 문서 검색
const results = await hybridSearch("RAG 시스템이란 무엇인가요?", {
  userId: "사용자-UUID",
  topK: 5, // 상위 5개 결과
  vectorWeight: 0.7, // 벡터 검색 가중치
  keywordWeight: 0.3, // 키워드 검색 가중치
});
```

### 📊 검색 결과 구조

```typescript
interface SearchResult {
  chunkId: string; // 청크 ID
  documentId: string; // 원본 문서 ID
  content: string; // 청크 내용 (근거 텍스트)
  score: number; // 유사도 점수 (0~1)
  metadata: {
    sectionTitle?: string; // 섹션 제목
    tokenCount: number; // 토큰 수
  };
}
```

---

## 6. 실제 작동 시 결과물 예시

### 📖 시나리오: 강의자료 업로드 후 질문

#### 1단계: 파일 업로드

```
📄 업로드 파일: "머신러닝_개론.pdf" (5MB)

✅ 업로드 결과:
- documentId: "abc-123-def"
- status: "processing" → "ready"
- 청크 생성: 42개
- 임베딩 생성: 완료 (토큰 사용: 8,420)
```

#### 2단계: 질문 검색

```
🔎 질문: "경사하강법의 원리를 설명해주세요"

📋 검색 결과 (Top 3):
┌────┬────────────────────────────────────────┬───────────────┐
│ 순위│ 청크 내용 (일부)                         │ 유사도 점수    │
├────┼────────────────────────────────────────┼───────────────┤
│ 1  │ "경사하강법(Gradient Descent)은 함수의   │ 0.89          │
│    │ 기울기를 이용해 최솟값을 찾는 최적화..."   │               │
├────┼────────────────────────────────────────┼───────────────┤
│ 2  │ "학습률(Learning Rate)은 경사하강법에서  │ 0.82          │
│    │ 한 번에 이동하는 거리를 결정하며..."       │               │
├────┼────────────────────────────────────────┼───────────────┤
│ 3  │ "배치 경사하강법과 확률적 경사하강법의    │ 0.76          │
│    │ 차이점은 한 번의 업데이트에 사용하는..."   │               │
└────┴────────────────────────────────────────┴───────────────┘
```

#### 3단계: 근거 기반 답변 생성

```
💬 AI 답변:

"경사하강법(Gradient Descent)은 함수의 **기울기(미분값)를 이용해
최솟값을 찾아가는 최적화 알고리즘**입니다. [📖 근거 1]

핵심 원리는 다음과 같습니다:
1. 현재 위치에서 함수의 기울기를 계산
2. 기울기의 반대 방향으로 이동 (내리막길)
3. 학습률(Learning Rate)만큼 이동 [📖 근거 2]
4. 수렴할 때까지 반복

📎 참고 문서: 머신러닝_개론.pdf (페이지 23-25)"

✅ 검토 배지: 근거 일치 가능성 높음
```

---

## 7. RAG 시스템 활용 용도

### 🎯 PRISM Writer에서의 주요 용도

| 용도                            | 설명                                          |
| ------------------------------- | --------------------------------------------- |
| **강의자료 기반 스크립트 작성** | 업로드한 강의자료를 근거로 발표 스크립트 작성 |
| **팩트 체크**                   | 작성 내용이 자료와 일치하는지 검증            |
| **근거 인용**                   | 답변에 출처(문서명, 페이지) 명시              |
| **학습 도우미**                 | 자료 내용에 대한 Q&A                          |

### 💡 확장 가능한 활용

- **연구 논문 검토**: 논문 업로드 후 특정 주장의 근거 확인
- **계약서 분석**: 법률 문서에서 특정 조항 검색
- **고객 지원**: FAQ 문서 기반 자동 답변
- **기업 지식 관리**: 사내 문서에서 정보 검색

---

## 8. 핵심 파일 구조

```
frontend/src/lib/rag/
├── documentProcessor.ts   # 문서 처리 파이프라인 (upload → chunk → embed → save)
├── chunking.ts            # 문서 청킹 (512토큰, 50토큰 오버랩)
├── embedding.ts           # OpenAI 임베딩 생성
├── search.ts              # 하이브리드 검색 (벡터 + 키워드)
├── reranker.ts            # LLM 기반 리랭킹
├── costGuard.ts           # 비용 관리 (토큰 한도)
├── aclGate.ts             # 접근 권한 검증
├── evidencePack.ts        # 근거 패키지 생성
└── citationGate.ts        # 인용 검증

frontend/src/app/api/documents/upload/
└── route.ts               # 문서 업로드 API

backend/migrations/
├── 012_rag_documents_schema.sql  # 문서 메타데이터 테이블
├── 013_rag_chunks_schema.sql     # 청크 + 임베딩 테이블
└── 020_search_schema.sql         # 벡터 검색 RPC 함수
```

---

## 9. 비용 관리

| 항목               | 제한            | 위치           |
| ------------------ | --------------- | -------------- |
| 문서 크기          | 10MB            | `route.ts`     |
| 배치 임베딩        | 최대 100개      | `embedding.ts` |
| 사용자별 토큰 한도 | 월 100,000 토큰 | `costGuard.ts` |
| 재시도 횟수        | 최대 3회        | `embedding.ts` |

---

## 10. 관련 문서

- [RAG 시스템 구축 체크리스트](./2512160052_RAG시스템구축_체크리스트.md)
- [RAG 파이프라인 재설계 분석](./2512180737_RAG_파이프라인_재설계_분석.md)
- [RAG P1 체크리스트](./2512180805_RAG_P1_체크리스트.md)
