# 📋 RAG 시스템 구축 체크리스트

**버전**: v1.0
**작성일**: 2025-12-16 00:52
**참조 문서**: rag_meeting_result.md (v3.0)
**협업자**: 시니어 개발자, 주니어 개발자, UX/UI 디자인 전문가

---

## 📌 품질 체크 기준 (모든 항목 적용)

| 기준          | 설명                                           |
| ------------- | ---------------------------------------------- |
| 코딩 스타일   | 기존 프로젝트 컨벤션 준수 (TypeScript, ESLint) |
| 명확한 네이밍 | 함수명/변수명은 목적이 명확하게 드러나도록     |
| 에러 처리     | try-catch, 사용자 친화적 한국어 에러 메시지    |
| 성능          | 과도한 반복문, 불필요한 렌더링 방지            |
| 접근성        | aria-label, role, tabindex 등 WCAG 준수        |

---

# Phase 1: 에디터 기본 UI 완성

## 📍 목적

기존 에디터 페이지를 완성하여 RAG 기능 통합 준비

## ⚠️ 영향받을 수 있는 기존 기능

- `/editor` 페이지 전체
- 헤더 컴포넌트 (로그인/로그아웃)
- 레이아웃 시스템

## 🔗 연결성

```
- [ ] **파일**: `frontend/src/components/editor/TextEditor.tsx` (신규)
- [ ] 텍스트 입력 영역 (textarea 또는 contenteditable)
- [ ] 글자 수 카운터 표시
- [ ] 자동 저장 기능 (debounce 500ms)

**품질 체크:**

- [ ] 함수명: `handleTextChange`, `saveToLocalStorage`
- [ ] 에러 처리: localStorage 저장 실패 시 사용자 알림
- [ ] 성능: debounce로 과도한 저장 방지
- [ ] 접근성: aria-label="글 입력 영역"

---

### 1.3 사이드 패널 (피드백 표시 영역)

- [ ] **파일**: `frontend/src/components/editor/FeedbackPanel.tsx` (신규)
- [ ] 빈 상태 UI ("평가 결과가 여기에 표시됩니다")
- [ ] 스크롤 가능한 영역
- [ ] 피드백 카드 레이아웃 (추후 RAG 결과 표시용)

**품질 체크:**

- [ ] 코딩 스타일: 컴포넌트 Props 타입 정의
- [ ] 접근성: role="complementary", aria-label="피드백 패널"

---

### 1.4 헤더 연동 확인

- [ ] **파일**: `frontend/src/components/Header.tsx` (기존)
- [ ] 에디터 페이지에서 헤더 정상 표시 확인
- [ ] 로그인/로그아웃 버튼 정상 동작 확인
- [ ] 사용자 드롭다운 (등급 배지) 정상 표시 확인

---

## ✅ Phase 1 검증 체크리스트

- [ ] **Syntax 오류 확인**: `npm run build` 성공
- [ ] **브라우저 테스트**:
  - [ ] /editor 페이지 접근 가능
  - [ ] 텍스트 입력 가능
  - [ ] 글자 수 카운터 동작
  - [ ] 자동 저장 동작 (localStorage 확인)
  - [ ] 반응형 레이아웃 (모바일/태블릿/데스크탑)
- [ ] **기존 기능 정상 동작**:
  - [ ] 로그인/로그아웃
  - [ ] 프로필 페이지
  - [ ] 헤더 등급 배지

---

# Phase 2: 문서 업로드 파이프라인

## 📍 목적

강의/자료 파일을 업로드하고 처리하는 기본 인프라 구축

## ⚠️ 영향받을 수 있는 기존 기능

- Supabase Storage (새로 사용)
- `/editor` 페이지

## 🔗 연결성

```

2.1 DB 스키마 → 2.2 API 라우트 → 2.3 업로드 UI → 2.4 문서 목록 UI

````

---

### 2.1 Supabase 테이블 스키마 생성

- [x] **파일**: `backend/migrations/012_rag_documents_schema.sql` (신규)
- [x] `rag_documents` 테이블 생성
  ```sql
  id, user_id, title, file_path, file_type, file_size,
  status (pending/processing/ready/error),
  metadata JSONB, version, created_at, updated_at
````

- [x] RLS 정책: 본인 문서만 조회/수정

**품질 체크:**

- [x] 네이밍: 테이블/컬럼명 snake_case
- [x] 에러 처리: 외래키 제약조건

---

### 2.2 문서 업로드 API

- [x] **파일**: `frontend/src/app/api/documents/upload/route.ts` (신규)
- [x] POST: 파일 받아 Supabase Storage에 저장
- [x] 메타데이터 DB에 저장
- [x] 파일 크기 제한 (10MB)
- [x] 허용 파일 타입 (PDF, DOCX, TXT, MD)

**품질 체크:**

- [x] 에러 처리: 파일 크기 초과, 잘못된 파일 타입
- [x] 성능: 스트리밍 업로드 (대용량 파일)

---

### 2.3 문서 업로드 UI

- [x] **파일**: `frontend/src/components/documents/DocumentUploader.tsx` (신규)
- [x] 드래그 앤 드롭 영역
- [x] 파일 선택 버튼
- [x] 업로드 진행 상태 표시
- [x] 성공/실패 토스트 알림

**품질 체크:**

- [x] 접근성: 키보드로 파일 선택 가능
- [x] 에러 처리: 사용자 친화적 한국어 메시지

---

### 2.4 문서 목록 UI

- [x] **파일**: `frontend/src/components/documents/DocumentList.tsx` (신규)
- [x] 업로드된 문서 목록 표시
- [x] 문서 상태 표시 (처리 중/준비됨/오류)
- [x] 문서 삭제 버튼

---

## ✅ Phase 2 검증 체크리스트

- [x] **Syntax 오류 확인**: `npm run build` 성공
- [ ] **브라우저 테스트**: (수동 테스트 필요)
  - [ ] 파일 업로드 가능 (PDF, DOCX, TXT, MD)
  - [ ] 업로드 진행 상태 표시
  - [ ] 문서 목록 표시
  - [ ] 문서 삭제 가능
- [ ] **Supabase 확인**: (수동 설정 필요)
  - [ ] Storage에 파일 저장됨
  - [ ] `rag_documents` 테이블에 레코드 생성
- [ ] **기존 기능 정상 동작**:
  - [ ] 에디터 페이지
  - [ ] 로그인/로그아웃

---

# Phase 3: 청킹(Chunking) 시스템

## 📍 목적

업로드된 문서를 검색 가능한 청크(조각)로 분할

## ⚠️ 영향받을 수 있는 기존 기능

- `rag_documents` 테이블
- 문서 업로드 흐름

## 🔗 연결성

```
2.2 업로드 완료 → 3.1 청킹 스키마 → 3.2 청킹 함수 → 3.3 백그라운드 처리
```

---

### 3.1 청크 테이블 스키마

- [x] **파일**: `backend/migrations/013_rag_chunks_schema.sql` (신규)
- [x] `rag_chunks` 테이블 생성
  ```sql
  id, document_id, chunk_index, content,
  embedding vector(1536), metadata JSONB,
  created_at
  ```
- [x] pgvector 확장 활성화 확인

---

### 3.2 청킹 유틸리티 함수

- [x] **파일**: `frontend/src/lib/rag/chunking.ts` (신규)
- [x] `chunkDocument(text, options)`: 문서를 청크로 분할
- [x] 청킹 옵션: chunkSize (토큰), overlap, preserveHeaders
- [x] 메타데이터 추출: 섹션 제목, 페이지 번호

**품질 체크:**

- [x] 함수명: `chunkDocument`, `extractMetadata`
- [x] 에러 처리: 빈 문서, 파싱 실패

---

### 3.3 문서 처리 백그라운드 작업

- [x] **파일**: `frontend/src/lib/rag/documentProcessor.ts` (신규)
- [x] 업로드 후 자동 청킹 트리거
- [x] 문서 상태 업데이트 (pending → processing → ready)
- [x] 실패 시 상태 (error) + 에러 메시지 저장

---

## ✅ Phase 3 검증 체크리스트

- [x] **Syntax 오류 확인**: `npm run build` 성공
- [ ] **브라우저 테스트**: (수동 테스트 필요)
  - [ ] 문서 업로드 후 자동 청킹 실행
  - [ ] 문서 상태가 "processing" → "ready"로 변경
- [ ] **Supabase 확인**: (수동 설정 필요)
  - [ ] `rag_chunks` 테이블에 청크 생성됨
  - [ ] 청크 개수 확인 (문서 길이에 비례)
- [ ] **기존 기능 정상 동작**:
  - [ ] 문서 업로드
  - [ ] 문서 목록

---

# Phase 4: 임베딩(Embedding) 시스템

## 📍 목적

청크를 벡터로 변환하여 유사도 검색 가능하게 함

## ⚠️ 영향받을 수 있는 기존 기능

- 청킹 시스템
- 비용 발생 (OpenAI API)

## 🔗 연결성

```
3.2 청킹 완료 → 4.1 임베딩 API → 4.2 벡터 저장 → 4.3 비용 관리
```

---

### 4.1 임베딩 API 통합

- [x] **파일**: `frontend/src/lib/rag/embedding.ts` (신규)
- [x] OpenAI text-embedding-3-small 사용
- [x] `embedText(text)`: 단일 텍스트 임베딩
- [x] `embedBatch(texts)`: 배치 임베딩 (효율성)

**품질 체크:**

- [x] 에러 처리: API 호출 실패, 토큰 초과
- [x] 성능: 배치 처리로 API 호출 최소화

---

### 4.2 임베딩 벡터 저장

- [x] **파일**: `frontend/src/lib/rag/documentProcessor.ts` (수정)
- [x] 청킹 후 자동 임베딩 실행
- [x] `rag_chunks.embedding` 컬럼에 벡터 저장
- [x] pgvector 인덱스 생성 (cosine similarity)

---

### 4.3 비용 관리 (가드레일)

- [x] **파일**: `frontend/src/lib/rag/costGuard.ts` (신규)
- [x] 일일 임베딩 토큰 한도 설정
- [x] 사용량 추적 및 알림
- [x] 회원 등급별 한도 적용

---

## ✅ Phase 4 검증 체크리스트

- [x] **Syntax 오류 확인**: `npm run build` 성공
- [ ] **브라우저 테스트**: (수동 테스트 필요 - API 키 설정 필요)
  - [ ] 문서 업로드 → 청킹 → 임베딩 자동 실행
  - [ ] 문서 상태 "ready" 확인
- [ ] **Supabase 확인**: (수동 설정 필요)
  - [ ] `rag_chunks.embedding` 컬럼에 벡터 저장됨
  - [ ] 벡터 차원 확인 (1536 for OpenAI)
- [ ] **비용 확인**:
  - [ ] OpenAI 대시보드에서 사용량 확인
  - [ ] 가드레일 동작 확인

---

# Phase 5: 검색(Retrieval) 엔진

## 📍 목적

사용자 쿼리와 유사한 청크를 검색

## ⚠️ 영향받을 수 있는 기존 기능

- 임베딩 시스템
- 에디터 페이지

## 🔗 연결성

```
4.2 임베딩 완료 → 5.1 검색 API → 5.2 하이브리드 검색 → 5.3 리랭킹
```

---

### 5.1 벡터 검색 API

- [x] **파일**: `frontend/src/app/api/rag/search/route.ts` (신규)
- [x] POST: 쿼리 받아 유사 청크 반환
- [x] Top-K 설정 (기본 5개)
- [x] 결과: chunk_id, content, score, metadata

**품질 체크:**

- [x] 에러 처리: 쿼리 없음, 검색 실패
- [x] 성능: pgvector 인덱스 활용

---

### 5.2 하이브리드 검색 (벡터 + 키워드)

- [x] **파일**: `frontend/src/lib/rag/search.ts` (신규)
- [x] 벡터 검색 + Full Text Search 결합
- [x] RRF (Reciprocal Rank Fusion) 점수 병합
- [x] 필터링: tenant_id, access_level

---

### 5.3 리랭킹 (선택)

- [x] **파일**: `frontend/src/lib/rag/reranker.ts` (신규)
- [x] Cross-encoder 또는 LLM 기반 리랭킹
- [x] 검색 결과 재정렬

---

## ✅ Phase 5 검증 체크리스트

- [x] **Syntax 오류 확인**: `npm run build` 성공
- [ ] **브라우저 테스트**: (로그인 필요 - 사용자 인증 대기)
  - [ ] 검색 쿼리 입력 → 관련 청크 반환
  - [ ] 검색 결과 정확도 확인
- [ ] **성능 테스트**: (로그인 및 문서 업로드 후 테스트 필요)
  - [ ] 100개 청크 기준 검색 시간 < 500ms

---

# Phase 6: LLM API 통합 (Judge)

## 📍 목적

검색된 근거를 바탕으로 글을 평가하는 LLM 호출

## ⚠️ 영향받을 수 있는 기존 기능

- 검색 엔진
- 비용 발생 (LLM API)

## 🔗 연결성

```
5.1 검색 완료 → 6.1 LLM 클라이언트 → 6.2 프롬프트 템플릿 → 6.3 결과 파싱
```

---

### 6.1 LLM 클라이언트 설정

- [x] **파일**: `frontend/src/lib/llm/client.ts` (신규)
- [x] Gemini 또는 OpenAI API 클라이언트
- [x] 환경 변수: `GOOGLE_API_KEY` 또는 `OPENAI_API_KEY`
- [x] 스트리밍 지원

---

### 6.2 프롬프트 템플릿 관리

- [x] **파일**: `frontend/src/lib/llm/prompts.ts` (신규)
- [x] 평가 프롬프트 템플릿
- [x] 근거 인용 강제 프롬프트
- [x] "근거 없으면 근거 부족" 가드레일

---

### 6.3 결과 파싱

- [x] **파일**: `frontend/src/lib/llm/parser.ts` (신규)
- [x] JSON 스키마 검증
- [x] 필수 필드 확인: rubric_item, status, evidence_quotes, recommendations

---

## ✅ Phase 6 검증 체크리스트

- [x] **Syntax 오류 확인**: `npm run build` 성공
- [ ] **API 테스트**: (GOOGLE_API_KEY 환경 변수 미설정)
  - [x] 테스트 엔드포인트 생성: `/api/llm/test`
  - [ ] LLM 호출 성공 (API 키 설정 후 테스트 필요)
  - [ ] JSON 형식 응답 확인 (API 키 설정 후 테스트 필요)
  - [ ] 근거 인용 포함 확인 (API 키 설정 후 테스트 필요)

> **참고**: API 테스트 실행 방법
>
> 1. `.env.local` 파일에 `GOOGLE_API_KEY=your_api_key` 추가
> 2. 개발 서버 재시작
> 3. POST 요청으로 `/api/llm/test` 호출

---

# Phase 7: 글 평가 모듈 (MVP 첫 모듈)

## 📍 목적

모든 구성 요소를 통합하여 실제 글 평가 기능 구현

## ⚠️ 영향받을 수 있는 기존 기능

- 에디터 페이지
- 검색/LLM 시스템

## 🔗 연결성

```
1.2 텍스트 입력 → 5.1 검색 → 6.1 LLM → 7.1 결과 표시
```

---

### 7.1 평가 API 엔드포인트

- [x] **파일**: `frontend/src/app/api/rag/evaluate/route.ts` (신규)
- [x] POST: 사용자 글 + 루브릭 → 평가 결과
- [x] 루브릭별 평가 실행
- [x] 결과 JSON 반환

---

### 7.2 루브릭 관리

- [x] **파일**: `frontend/src/lib/rag/rubrics.ts` (신규)
- [x] 기본 루브릭 10개 정의
- [x] 루브릭 버전 관리

---

### 7.3 평가 결과 UI

- [x] **파일**: `frontend/src/components/Editor/EvaluationResult.tsx` (신규)
- [x] 상태표 (통과/보완/미충족)
- [x] 근거 인용 표시
- [x] 개선안 표시

**품질 체크:**

- [x] 접근성: 상태별 색상 + 아이콘 (색맹 고려)
- [x] 에러 처리: 평가 실패 시 사용자 안내

---

### 7.4 에디터 통합

- [x] **파일**: `frontend/src/components/Assistant/AssistantPanel.tsx` (수정)
- [x] `frontend/src/components/Assistant/EvaluationTab.tsx` (신규)
- [x] "평가하기" 버튼 추가
- [x] 평가 중 로딩 상태
- [x] 결과를 사이드 패널에 표시

---

### 8.1 로그/감사 추적

- [x] **파일**: `frontend/src/lib/logging/evaluationLogger.ts` (신규)
- [x] 평가 실행 로그 기록 함수
- [x] 루브릭/근거 버전 기록
- [x] 실패율 모니터링

### 8.2 비용 모니터링

- [x] **파일**: `frontend/src/lib/monitoring/usageTracker.ts` (신규)
- [x] LLM/임베딩 사용량 추적
- [x] 일일/월간 한도 체크

### 8.3 사용자 피드백

- [x] **파일**: `frontend/src/components/feedback/FeedbackButtons.tsx` (신규)
- [x] **파일**: `frontend/src/app/api/feedback/route.ts` (신규)
- [x] 평가 결과 만족도 수집 (좋아요/싫어요)
- [x] EvaluationResult에 피드백 버튼 통합

| 2. 문서 업로드 | ⏳ 대기 | 파일 업로드 인프라 |
| 3. 청킹 | ⏳ 대기 | 문서 분할 |
| 4. 임베딩 | ⏳ 대기 | 벡터 변환 |
| 5. 검색 | ⏳ 대기 | 유사 청크 검색 |
| 6. LLM 통합 | ⏳ 대기 | 평가 모델 |
| 7. 글 평가 모듈 | ⏳ 대기 | MVP 첫 모듈 |
| 8. 운영 체계 | ⏳ 대기 | 모니터링 |

---

**문서 버전**: v1.0
**작성일**: 2025-12-16 00:52
