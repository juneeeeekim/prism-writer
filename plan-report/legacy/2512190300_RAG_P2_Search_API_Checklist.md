# RAG P2: 검색 API 연결 및 실제 데이터 연동 체크리스트

**작성일**: 2025-12-19
**목표**: Mock 데이터를 제거하고 실제 벡터 DB(Supabase)와 Gemini 임베딩을 연동하여 실질적인 RAG 검색 구현
**참여자**: 시니어 개발자(Backend/AI), 주니어 개발자(Frontend), UX/UI 디자이너

---

## 📂 파일 구성 및 전략

- **파일 구성**: 단일 체크리스트 파일 (`251219_RAG_P2_Search_API_Checklist.md`)
- **이유**: DB → Backend → Frontend로 이어지는 의존성 흐름이 명확하며, 단일 기능(검색) 구현이므로 한 곳에서 진척도를 관리하는 것이 효율적임.

---

## 🟢 Phase 1: Database Schema & RPC Setup (Backend/DB) ✅ 완료

### 📍 영향받을 수 있는 기존 기능

- 기존 `document_chunks` 테이블 (존재 시 스키마 충돌 가능성)
- 기존 RLS 정책

### 1.1 벡터 확장 및 테이블 점검

- [x] **파일**: Supabase SQL Editor (`backend/migrations/020_search_schema.sql`)
- [x] **내용**: `vector` 확장 활성화 확인 및 `document_chunks` 테이블 생성
  ```sql
  -- Gemini text-embedding-004 기준 768차원
  create extension if not exists vector;
  create table if not exists document_chunks (
    id bigserial primary key,
    content text,
    metadata jsonb,
    embedding vector(768) -- 중요: 차원 확인
  );
  ```
  - 🔍 품질: 차원 수(768) 정확성 확인

### 1.2 검색 RPC 함수 구현

- [x] **파일**: Supabase SQL Editor
- [x] **연결**: 1.1 테이블 사용
- [x] **내용**: `match_document_chunks` 함수 생성 (기존 match_documents와 충돌 방지)
  - 파라미터: `query_embedding vector(768)`, `match_threshold float`, `match_count int`
  - 기능: 코사인 유사도 검색
  - 🔍 품질: 인덱스 활용 여부 확인

### ✅ Phase 1 검증

- [x] Supabase 대시보드에서 테이블 및 함수 생성 확인
- [x] SQL Editor에서 더미 데이터로 `match_document_chunks` 호출 테스트

---

## � Phase 2: Embedding Utility Implementation (Backend/AI) ✅ 완료

### 📍 영향받을 수 있는 기존 기능

- 없음 (신규 유틸리티)

### 2.1 Gemini 임베딩 클라이언트 설정

- [x] **파일**: `frontend/src/lib/ai/embedding.ts` (신규)
- [x] **내용**: Google Generative AI SDK 설정
  - 모델: `text-embedding-004`
  - 🔍 품질: API Key 환경변수 처리 (`GOOGLE_API_KEY`) ✅

### 2.2 임베딩 생성 함수 구현

- [x] **파일**: `frontend/src/lib/ai/embedding.ts`
- [x] **연결**: 2.1 클라이언트 사용
- [x] **내용**: `generateEmbedding(text: string): Promise<number[]>`
  - 🔍 품질: 에러 처리 (API 실패 시 재시도 3회 + Exponential Backoff) ✅
  - 🔍 품질: 입력 텍스트 전처리 (공백 제거, 정규화) ✅

### ✅ Phase 2 검증

- [x] `npm run build` 성공 (Syntax 오류 0개)
- [x] 임베딩 설정: 768차원 (`GEMINI_EMBEDDING_CONFIG.dimensions`)

---

## � Phase 3: Search API Implementation (Backend) ✅ 완료

### 📍 영향받을 수 있는 기존 기능

- 없음 (기존 API Route 수정)

### 3.1 API Route 스캐폴딩

- [x] **파일**: `frontend/src/app/api/rag/search/route.ts` (기존 파일 수정)
- [x] **내용**: POST 핸들러 구조 업그레이드
  - 입력: `{ query: string, topK?: number, threshold?: number }`
  - 출력: `{ evidencePack: EvidencePack, documents: EvidenceItem[] }`

### 3.2 임베딩 및 검색 로직 연결

- [x] **파일**: `frontend/src/app/api/rag/search/route.ts`
- [x] **연결**: Phase 2 `generateEmbedding` (Gemini 768차원), Phase 1 `match_document_chunks` RPC
- [x] **내용**:
  1. 사용자 쿼리 → Gemini 임베딩 변환 (768차원) ✅
  2. Supabase RPC 호출 (`match_document_chunks`) ✅
  3. 결과를 `EvidenceItem` 형식으로 변환하여 반환 ✅
  - 🔍 품질: `createClient (server)` 사용하여 RLS 적용 ✅
  - 🔍 품질: `buildEvidencePack` 활용 (P1 Phase 4 자산 활용) ✅

### ✅ Phase 3 검증

- [x] `npm run build` 성공 (Syntax 오류 0개)
- [ ] Postman 또는 curl로 API 호출 테스트 (데이터 필요)

---

## � Phase 4: Frontend Integration (Frontend) ✅ 완료

### 📍 영향받을 수 있는 기존 기능

- `frontend/src/app/rag/page.tsx` (기존 Mock 데이터 로직) → 수정됨

### 4.1 검색 API 호출 함수 작성

- [x] **파일**: `frontend/src/lib/api/rag.ts` (신규)
- [x] **내용**: `searchDocuments(query: string): Promise<EvidencePack>` ✅
  - `/api/rag/search` 호출
  - 🔍 품질: 로딩 상태 및 에러 처리 (`RAGSearchError` 클래스) ✅
  - 🔍 품질: `documentsToContext()` 헬퍼 함수 추가 ✅

### 4.2 RAG 페이지 로직 수정

- [x] **파일**: `frontend/src/app/rag/page.tsx`
- [x] **연결**: 4.1 API 함수
- [x] **내용**: `handleSearch` 함수 수정
  - 기존: Mock Context 사용
  - 변경: 2단계 파이프라인 (RAG 검색 → Judge API) ✅
  - UX 개선: 검색 중/분석 중 로딩 상태 구분 ✅

### ✅ Phase 4 검증

- [x] `npm run build` 성공 (Syntax 오류 0개)
- [ ] 브라우저에서 검색어 입력 후 실제 검색 결과 표시 확인 (데이터 필요)
- [ ] Network 탭에서 API 호출 및 응답 확인 (데이터 필요)

---

## 🏁 최종 완료 체크리스트 ✅

- [x] **Syntax 오류 확인**: `npm run build` 성공 (Exit code: 0)
- [x] **코드 품질**: console.log 검토 완료
  - JSDoc 예제 내 로그: 문서용 (문제 없음)
  - 배치 진행 로그: 의도적 모니터링 (유지)
- [x] **타입 정의**: TypeScript 빌드 통과 (Linting 성공)
