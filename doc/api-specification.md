# API Specification

> PRISM Writer 전체 API 엔드포인트 명세
> 최종 갱신: 2026-02-14

---

## 목차

1. [Frontend API Routes (Next.js App Router)](#1-frontend-api-routes)
   - [Chat](#11-chat)
   - [Projects](#12-projects)
   - [Documents](#13-documents)
   - [RAG Search & Evaluation](#14-rag-search--evaluation)
   - [Outline](#15-outline)
   - [Research](#16-research)
   - [Suggest (Shadow Writer)](#17-suggest)
   - [LLM Judge & Test](#18-llm-judge--test)
   - [Feedback & Evaluation Logs](#19-feedback--evaluation-logs)
   - [Admin](#110-admin)
   - [Cron Jobs](#111-cron-jobs)
   - [Rubrics](#112-rubrics)
2. [Backend API (FastAPI)](#2-backend-api-fastapi)
   - [System](#21-system)
   - [Outline](#22-outline)
   - [References](#23-references)
3. [LLM Gateway (Internal)](#3-llm-gateway-internal)
4. [Error Response Format](#4-error-response-format)

---

## 1. Frontend API Routes

Base URL: `http://localhost:3000/api`

### 1.1 Chat

#### `POST /api/chat`

스트리밍 방식으로 AI 채팅 응답을 생성합니다. RAG 검색 결과를 자동으로 포함합니다.

| 항목 | 값 |
|------|-----|
| 파일 | `frontend/src/app/api/chat/route.ts` |
| Content-Type (응답) | `text/event-stream` |
| 인증 | 필수 (Supabase Auth) |

**Request Body**

```typescript
{
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
  model?: string           // 모델 ID (예: "gemini-3-flash-preview")
  sessionId?: string       // 채팅 세션 ID
  projectId?: string       // 프로젝트 ID (RAG 범위 필터링)
}
```

**Response** — `ReadableStream` (Server-Sent Events)

```
data: {"type": "status", "content": "검색 중..."}
data: {"type": "text", "content": "AI 응답 텍스트 청크"}
data: {"type": "metadata", "content": {...}}
data: [DONE]
```

**내부 함수**

```typescript
function buildCitationMetadata(
  fullResponse: string,
  hasRetrievedDocs: boolean,
  uniqueResults: any[]
): Record<string, any>
```

**상수**

```typescript
const STATUS_MESSAGES = {
  SEARCHING: '관련 자료를 검색하고 있습니다...',
  GENERATING: '답변을 생성하고 있습니다...'
}
```

---

#### `GET /api/chat/sessions`

사용자의 채팅 세션 목록을 조회합니다.

**Query Parameters**

| 파라미터 | 타입 | 기본값 | 설명 |
|----------|------|--------|------|
| `projectId` | `string` | - | 프로젝트 ID 필터 |

**Response**

```typescript
{
  success: boolean
  sessions: Array<{
    id: string
    title: string
    project_id: string
    created_at: string
    updated_at: string
    message_count: number
  }>
}
```

---

#### `POST /api/chat/sessions`

새 채팅 세션을 생성합니다.

**Request Body**

```typescript
{
  title?: string       // 세션 제목 (기본: "새 대화")
  projectId?: string   // 연결할 프로젝트 ID
}
```

---

#### `PATCH /api/chat/sessions/[id]`

세션 제목 등을 수정합니다.

**Path Parameters**: `id` — 세션 UUID

**Request Body**

```typescript
{ title: string }
```

---

#### `DELETE /api/chat/sessions/[id]`

세션과 관련 메시지를 삭제합니다.

**Path Parameters**: `id` — 세션 UUID

---

### 1.2 Projects

#### `GET /api/projects`

사용자의 프로젝트 목록을 조회합니다.

| 항목 | 값 |
|------|-----|
| 파일 | `frontend/src/app/api/projects/route.ts` |
| 인증 | 필수 |

**Query Parameters**

| 파라미터 | 타입 | 기본값 | 설명 |
|----------|------|--------|------|
| `status` | `'active' \| 'archived'` | `'active'` | 프로젝트 상태 필터 |
| `search` | `string` | - | 이름/설명 검색 |
| `sortBy` | `'name' \| 'created_at' \| 'updated_at'` | `'updated_at'` | 정렬 기준 |
| `sortOrder` | `'asc' \| 'desc'` | `'desc'` | 정렬 방향 |

**Response**

```typescript
interface ApiResponse<ProjectListResponse> {
  success: boolean
  data: {
    projects: Project[]
    total: number
  }
}
```

---

#### `POST /api/projects`

새 프로젝트를 생성합니다.

**Request Body**

```typescript
{
  name: string            // 프로젝트 이름 (필수)
  description?: string    // 설명
  icon?: string           // 이모지 아이콘 (기본: '📁')
}
```

**Response**: `ApiResponse<Project>`

---

#### `PATCH /api/projects/[id]`

프로젝트 정보를 수정합니다.

**Request Body**

```typescript
{
  name?: string
  description?: string
  icon?: string
  status?: 'active' | 'archived'
}
```

---

#### `DELETE /api/projects/[id]`

프로젝트를 소프트 삭제합니다 (휴지통으로 이동).

---

#### `PATCH /api/projects/[id]/restore`

휴지통에서 프로젝트를 복원합니다.

---

#### `DELETE /api/projects/[id]/permanent`

프로젝트를 영구 삭제합니다 (복구 불가).

---

#### `GET /api/projects/trash`

삭제된 프로젝트 목록을 조회합니다.

---

### 1.3 Documents

#### `POST /api/documents/upload`

문서를 업로드합니다 (Supabase Storage).

| 항목 | 값 |
|------|-----|
| 파일 | `frontend/src/app/api/documents/upload/route.ts` |
| Content-Type | `multipart/form-data` |
| 인증 | 필수 |

**Request** — `FormData`

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `file` | `File` | Y | 업로드할 파일 |
| `projectId` | `string` | N | 연결할 프로젝트 ID |
| `category` | `string` | N | 카테고리 (기본: `'General'`) |

**허용 파일 타입**

```typescript
const ALLOWED_FILE_TYPES = {
  'application/pdf':                                                              { ext: 'pdf', name: 'PDF' },
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document':      { ext: 'docx', name: 'Word' },
  'text/plain':                                                                   { ext: 'txt', name: 'Text' },
  'text/markdown':                                                                { ext: 'md', name: 'Markdown' },
}
```

**제한**

| 항목 | 값 |
|------|-----|
| 최대 파일 크기 | `50 MB` (`50 * 1024 * 1024`) |
| Storage 버킷 | `rag-documents` |

**Response**

```typescript
interface UploadResponse {
  success: boolean
  documentId?: string   // 생성된 문서 UUID
  message: string
  error?: string
}
```

---

#### `POST /api/documents/process`

업로드된 문서를 파싱 → 청킹 → 임베딩 파이프라인으로 처리합니다.

| 항목 | 값 |
|------|-----|
| 파일 | `frontend/src/app/api/documents/process/route.ts` |
| 인증 | 필수 |

**Request Body**

```typescript
{ documentId: string }
```

**Response**

```typescript
{
  success: boolean
  message: string
  result?: {
    success: boolean
    error?: string
  }
  error?: string
  status?: string   // 처리 상태 ('completed' | 'failed')
}
```

**처리 파이프라인 (내부)**

1. 문서 상태 → `processing_parsing`
2. 텍스트 추출 (PDF: pypdf, DOCX: unstructured, TXT/MD: 직접 읽기)
3. 문서 상태 → `processing_chunking`
4. 청킹 (tiktoken 기반, 기본 512 토큰)
5. 문서 상태 → `processing_embedding`
6. OpenAI `text-embedding-3-small` 벡터화 (1536차원)
7. 문서 상태 → `completed`

---

#### `GET /api/documents`

프로젝트의 문서 목록을 조회합니다.

**Query Parameters**

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `projectId` | `string` | 프로젝트 ID |

---

#### `GET /api/documents/list`

페이지네이션 지원 문서 목록을 조회합니다.

**Query Parameters**

| 파라미터 | 타입 | 기본값 | 설명 |
|----------|------|--------|------|
| `page` | `number` | `1` | 페이지 번호 |
| `limit` | `number` | `20` | 페이지당 항목 수 |
| `projectId` | `string` | - | 프로젝트 필터 |

---

#### `GET /api/documents/[id]`

문서 상세 정보를 조회합니다.

---

#### `POST /api/documents/[id]/extract-text`

OCR을 통해 문서에서 텍스트를 추출합니다.

**OCR 엔진**: Tesseract.js (기본) / Gemini Vision (고화질)

---

#### `PUT /api/documents/save`

문서 내용을 저장합니다.

**Request Body**

```typescript
{
  documentId: string
  content: string
  title?: string
}
```

---

#### `POST /api/documents/reorder`

문서 순서를 변경합니다.

**Request Body**

```typescript
{
  documentIds: string[]   // 새로운 순서의 문서 ID 배열
}
```

---

#### `DELETE /api/documents/[id]`

문서와 관련 청크/임베딩을 삭제합니다.

---

### 1.4 RAG Search & Evaluation

#### `POST /api/rag/search`

하이브리드 벡터 검색 (Vector + BM25)을 수행합니다.

| 항목 | 값 |
|------|-----|
| 파일 | `frontend/src/app/api/rag/search/route.ts` |
| 인증 | 필수 |

**Request Body**

```typescript
interface SearchRequest {
  query: string          // 검색 쿼리 (필수)
  topK?: number          // 반환할 결과 수 (기본: 5, 최대: 20)
  threshold?: number     // 최소 유사도 점수 (기본: 0.5)
  category?: string      // 카테고리 필터
  projectId?: string     // 프로젝트 범위 필터
}
```

**Response**

```typescript
interface SearchResponse {
  success: boolean
  evidencePack?: EvidencePack    // 구조화된 증거 패키지
  documents?: EvidenceItem[]     // 검색 결과 항목들
  message?: string
  error?: string
}
```

**내부 검색 결과 타입 (DB)**

```typescript
interface DBSearchResult {
  id: number
  content: string
  metadata: Record<string, unknown>
  similarity: number   // 0.0 ~ 1.0
}
```

---

#### `POST /api/rag/evaluate`

사용자 글을 루브릭 기반으로 평가합니다.

| 항목 | 값 |
|------|-----|
| 파일 | `frontend/src/app/api/rag/evaluate/route.ts` |
| 인증 | 필수 |

**Request Body**

```typescript
interface EvaluateRequest {
  userText: string           // 평가할 글 (필수, 50~50000자)
  rubricIds?: string[]       // 평가 루브릭 ID 목록
  searchQuery?: string       // RAG 검색 쿼리 (자동 생성 가능)
  topK?: number              // 참고 문서 수 (기본: 5)
  useV3?: boolean            // V3 파이프라인 사용 여부
  templateId?: string        // 템플릿 ID
  category?: string | null   // 카테고리
  projectId?: string         // 프로젝트 ID
}
```

**Response**

```typescript
interface EvaluateResponse {
  success: boolean
  result?: LegacyEvaluationResult   // V2 결과
  v3Result?: EvaluationResult       // V3 결과
  message?: string
  error?: string
  rubricCount?: number
  evidenceCount?: number
}
```

**상수**

```typescript
const DEFAULT_TOP_K = 5
const MIN_TEXT_LENGTH = 50
const MAX_TEXT_LENGTH = 50000
```

**내부 함수**

```typescript
async function runLegacyEvaluation(
  userText: string,
  rubricIds: string[] | undefined,
  searchQuery: string | undefined,
  topK: number | undefined,
  userId: string
): Promise<LegacyEvaluationResult>
```

---

#### `POST /api/rag/evaluate-single`

단일 기준(criteria)으로 평가합니다.

| 항목 | 값 |
|------|-----|
| 파일 | `frontend/src/app/api/rag/evaluate-single/route.ts` |
| 최대 실행 시간 | `60초` (`export const maxDuration = 60`) |

**Request Body**

```typescript
interface EvaluateSingleRequest {
  userText: string         // 평가할 글
  criteriaId: string       // 평가 기준 ID
  topK?: number            // 참고 문서 수
  templateId?: string      // 템플릿 ID
  projectId?: string       // 프로젝트 ID
}
```

**Response**

```typescript
interface EvaluateSingleResponse {
  success: boolean
  judgment?: JudgeResult      // 판정 결과
  upgradePlan?: UpgradePlan   // 개선 계획
  message?: string
  error?: string
}
```

---

#### `POST /api/rag/evaluate-holistic`

글 전체에 대한 종합 평가를 수행합니다 (A: 요약 + B: 영역별 조언 + C: 점수).

| 항목 | 값 |
|------|-----|
| 파일 | `frontend/src/app/api/rag/evaluate-holistic/route.ts` |
| 인증 | 필수 |

**Request Body**

```typescript
interface HolisticEvaluateRequest {
  userText: string       // 평가할 글 (최소 50자)
  topK?: number          // 참고 문서 수 (기본: 5)
  projectId?: string     // 프로젝트 ID
}
```

**Response**

```typescript
interface HolisticEvaluateResponse {
  success: boolean
  result?: HolisticEvaluationResult
  message?: string
  error?: string
  metadata?: {
    retrieval_sufficiency?: SufficiencyResult
  }
}
```

**상수**

```typescript
const DEFAULT_TOP_K = 5
const MIN_TEXT_LENGTH = 50
```

---

#### `POST /api/rag/feedback`

평가 결과에 대한 사용자 피드백을 저장합니다.

**Request Body**

```typescript
{
  evaluationId: string
  rating: 'helpful' | 'not_helpful'
  comment?: string
}
```

---

#### `POST /api/rag/preferences`

사용자의 RAG 설정을 저장합니다.

---

#### `POST /api/rag/chunks`

문서의 청크 목록을 조회합니다.

**Request Body**

```typescript
{
  documentId: string
  page?: number
  limit?: number
}
```

---

#### `GET /api/rag/chunks/[chunkId]`

특정 청크의 상세 정보를 조회합니다.

---

#### `PATCH /api/rag/chunks/[chunkId]`

청크 메타데이터를 수정합니다.

---

#### `POST /api/rag/structure/analyze`

문서의 구조를 분석합니다.

**Request Body**

```typescript
{
  documentId: string
  projectId?: string
}
```

---

#### `POST /api/rag/structure/apply`

구조 분석 결과를 문서에 적용합니다.

---

#### `POST /api/rag/change-plan`

개선 전략 기반 변경 계획을 생성합니다.

---

### 1.5 Outline

#### `POST /api/outline`

문서/주제 기반 목차를 AI로 생성합니다.

| 항목 | 값 |
|------|-----|
| 파일 | `frontend/src/app/api/outline/route.ts` |
| 인증 | 필수 |

**Request Body**

```typescript
interface OutlineRequest {
  topic: string              // 글 주제 (필수)
  documentIds?: string[]     // 참조 문서 ID 목록
  maxDepth?: number          // 최대 목차 깊이 (기본: 3)
  topK?: number              // RAG 검색 수 (기본: 10)
  projectId?: string         // 프로젝트 ID
}
```

**Response**

```typescript
interface OutlineResponse {
  success: boolean
  outline?: OutlineItem[]
  topic?: string
  sourcesUsed?: number
  message?: string
  error?: string
}

interface OutlineItem {
  title: string    // 목차 제목
  depth: number    // 깊이 (1=H1, 2=H2, ...)
}
```

**상수**

```typescript
const DEFAULT_TOP_K = 10
const DEFAULT_MAX_DEPTH = 3
const MODEL_NAME = getModelForUsage('outline.generation')
```

---

#### `GET /api/outline`

저장된 목차 목록을 조회합니다.

---

#### `GET /api/outlines`

전체 목차 목록 (paginated).

---

### 1.6 Research

#### `POST /api/research`

외부 학술/뉴스 소스에서 연구 자료를 검색합니다 (Tavily API 사용).

| 항목 | 값 |
|------|-----|
| 파일 | `frontend/src/app/api/research/route.ts` |
| 인증 | 필수 |

**Request Body**

```typescript
interface ResearchRequest {
  userQuery: string                           // 검색 쿼리 (필수)
  context?: string                            // 추가 맥락
  mode?: 'academic' | 'news' | 'all'          // 검색 모드 (기본: 'all')
  language?: 'ko' | 'en' | 'all'              // 언어 필터 (기본: 'all')
  maxResults?: number                         // 최대 결과 수
}
```

**Response**

```typescript
interface ResearchResponse {
  success: boolean
  results: SummarizedResult[]
  rawQuery: string
  message?: string
  error?: string
}
```

**신뢰할 수 있는 도메인 목록 (내부 상수)**

```typescript
TRUSTED_ACADEMIC_DOMAINS: string[]       // 학술 도메인
TRUSTED_GOVERNMENT_DOMAINS: string[]     // 정부 기관
TRUSTED_EDU_DOMAINS: string[]            // 교육 기관
INTERNATIONAL_ACADEMIC_DOMAINS: string[] // 국제 학술
KOREAN_ACADEMIC_DOMAINS: string[]        // 한국 학술
```

---

#### `GET /api/research/history`

연구 검색 이력을 조회합니다.

---

#### `GET /api/research/history/[id]`

특정 연구 항목의 상세 결과를 조회합니다.

---

### 1.7 Suggest

#### `POST /api/suggest`

Shadow Writer용 자동완성 제안을 생성합니다.

| 항목 | 값 |
|------|-----|
| 파일 | `frontend/src/app/api/suggest/route.ts` |
| 인증 | 필수 |

**Request Body**

```typescript
interface SuggestRequest {
  text: string             // 현재 편집 중인 텍스트
  cursorPosition: number   // 커서 위치
  projectId?: string       // 프로젝트 ID (RAG 컨텍스트)
}
```

**Response**

```typescript
interface SuggestResponse {
  success: boolean
  suggestion: string    // 제안 텍스트
  error?: string
}
```

**상수**

```typescript
const CONTEXT_BEFORE_LENGTH = 200   // 커서 앞 컨텍스트 길이
const RAG_TOP_K = 3                 // RAG 검색 수
const MAX_TOKENS = 100              // 최대 생성 토큰
```

**내부 함수**

```typescript
function extractFirstSentence(text: string): string
function buildSuggestionPrompt(
  contextBefore: string,
  ragContext: Array<{ content: string }>
): string
```

---

### 1.8 LLM Judge & Test

#### `POST /api/llm/judge`

LLM 기반 판정을 수행합니다 (인용 검증 포함).

| 항목 | 값 |
|------|-----|
| 파일 | `frontend/src/app/api/llm/judge/route.ts` |
| 인증 | 필수 |

**Request Body**

```typescript
interface JudgeRequest {
  query: string                                                   // 판정 대상 텍스트
  context: string[] | Array<{ id: string; content: string }>      // 참고 문맥
  rubric?: string                                                 // 평가 기준
  verifyCitations?: boolean                                       // 인용 검증 여부
}
```

**Response**

```typescript
interface JudgeResponse {
  success: boolean
  result: JudgeResult
  verifiedEvidence?: VerifiedEvidence[]
  citationSummary?: {
    total: number
    valid: number
    invalid: number
    averageScore: number
  }
  tokensUsed?: number
  error?: string
}
```

---

#### `POST /api/llm/test`

LLM 연결 및 파이프라인 통합 테스트를 수행합니다.

**Response**

```typescript
interface TestResponse {
  success: boolean
  totalTests: number
  passed: number
  failed: number
  skipped: number
  results: TestResult[]
}

interface TestResult {
  testName: string
  status: 'pass' | 'fail' | 'skip'
  message: string
  duration?: number
  details?: any
}
```

---

### 1.9 Feedback & Evaluation Logs

#### `POST /api/feedback`

사용자 피드백을 저장합니다.

---

#### `POST /api/feedback/hallucination`

환각 탐지 데이터를 기록합니다.

---

#### `POST /api/evaluations`

평가 결과를 로깅합니다.

---

### 1.10 Admin

#### `POST /api/admin/migrate`

데이터 마이그레이션을 수행합니다.

---

#### `GET /api/admin/users`

사용자 목록을 조회합니다 (관리자 전용).

---

#### `POST /api/admin/templates/[id]/approve`

템플릿을 승인합니다.

---

#### `POST /api/admin/templates/[id]/reject`

템플릿을 거절합니다.

**Request Body**

```typescript
{ rejection_reason: string }
```

---

#### `POST /api/templates/generate`

문서 기반 평가 템플릿을 자동 생성합니다.

---

#### `GET /api/categories/unique`

고유 카테고리 목록을 반환합니다.

---

### 1.11 Cron Jobs

#### `POST /api/cron/process-documents`

대기 중인 문서를 백그라운드 처리합니다.

---

#### `POST /api/cron/cleanup-orphans`

고아 데이터(삭제된 문서의 잔여 청크 등)를 정리합니다.

---

#### `POST /api/cron/cleanup-embedding-cache`

오래된 임베딩 캐시를 정리합니다.

---

### 1.12 Rubrics

#### `GET /api/rubrics/candidates`

루브릭 후보 목록을 조회합니다.

---

#### `POST /api/rubrics/candidates/select`

루브릭 후보를 선택(활성화)합니다.

---

#### `POST /api/rubrics/candidates/reset`

루브릭을 기본값으로 초기화합니다.

---

## 2. Backend API (FastAPI)

Base URL: `http://localhost:8000`
API Prefix: `/v1`

### 2.1 System

#### `GET /health`

```python
@app.get("/health", tags=["System"])
async def health_check() -> dict
```

**Response**: `{ "status": "healthy", "timestamp": "..." }`

---

#### `GET /`

```python
@app.get("/", tags=["System"])
async def root() -> dict
```

**Response**: `{ "message": "PRISM Writer API", "version": "0.1.0" }`

---

### 2.2 Outline

파일: `backend/src/presentation/api/outline.py`

#### `POST /v1/outline/generate`

AI 기반 목차를 생성합니다.

**Request Model (Pydantic)**

```python
class OutlineGenerateRequest(BaseModel):
    topic: str = Field(..., min_length=1, max_length=500, description="글의 주제")
    document_ids: list[str] = Field(default=[], description="참조할 문서 ID 리스트")
    max_depth: int = Field(default=3, ge=1, le=5, description="목차 최대 깊이")
```

**Response Model**

```python
class OutlineGenerateResponse(BaseModel):
    outline: list[OutlineItem]     # 생성된 목차 리스트
    topic: str                     # 입력된 주제
    sources_used: int = 0          # 참조된 문서 수

class OutlineItem(BaseModel):
    title: str                     # 목차 제목
    depth: int = Field(..., ge=1, le=5)  # 깊이 (1=H1)
```

**에러 코드**

| 코드 | 원인 |
|------|------|
| 422 | Validation Error (topic 비어있음, max_depth 범위 초과) |
| 500 | LLM 호출 실패 |

---

#### `GET /v1/outline/templates`

사전 정의된 목차 템플릿 목록을 반환합니다.

**Response**

```json
{
  "templates": [
    { "id": "academic", "name": "학술 논문", "outline": [...] },
    { "id": "blog", "name": "블로그 포스트", "outline": [...] },
    { "id": "report", "name": "보고서", "outline": [...] }
  ]
}
```

---

### 2.3 References

파일: `backend/src/presentation/api/references.py`

#### `POST /v1/drafts/{draft_id}/references`

글의 특정 문단에 청크 참조를 추가합니다.

**Request Model**

```python
class ReferenceCreateRequest(BaseModel):
    chunk_id: str = Field(..., description="참조할 청크 ID")
    paragraph_index: int = Field(..., ge=0, description="문단 인덱스 (0부터)")
    reference_type: str = Field(default="citation", description="참조 유형")
    # 유형: "citation" | "summary" | "quote"
```

**Response Model** (Status: `201 Created`)

```python
class ReferenceResponse(BaseModel):
    id: str
    draft_id: str
    chunk_id: str
    paragraph_index: int
    reference_type: str
    created_at: datetime
```

**에러**

| 코드 | 원인 |
|------|------|
| 409 | 중복 참조 (같은 청크 + 같은 문단) |

---

#### `GET /v1/drafts/{draft_id}/references`

글에 연결된 모든 참조를 조회합니다.

**Response Model**

```python
class ReferenceWithContentResponse(ReferenceResponse):
    chunk_content: str             # 청크 텍스트 내용
    chunk_source: Optional[str]    # 출처 문서명
```

---

#### `DELETE /v1/drafts/{draft_id}/references/{reference_id}`

참조를 삭제합니다. (Status: `204 No Content`)

**에러**

| 코드 | 원인 |
|------|------|
| 404 | 글 또는 참조를 찾을 수 없음 |

---

## 3. LLM Gateway (Internal)

파일: `frontend/src/lib/llm/gateway.ts`

내부적으로 LLM 요청을 라우팅하는 통합 게이트웨이입니다.

### 함수 시그니처

```typescript
/**
 * 텍스트를 생성합니다 (비스트리밍).
 */
export async function generateText(
  prompt: string,
  options?: LLMGenerateOptions
): Promise<LLMResponse>

/**
 * 텍스트를 스트리밍으로 생성합니다.
 */
export async function* generateTextStream(
  prompt: string,
  options?: LLMGenerateOptions
): AsyncGenerator<LLMStreamChunk>

/**
 * LLM 사용 가능 여부를 확인합니다.
 */
export function isLLMAvailable(modelId?: string): boolean
```

### 타입 정의

```typescript
interface LLMGenerateOptions {
  model?: string           // 모델 ID (기본: gemini-3-flash-preview)
  maxOutputTokens?: number // 최대 출력 토큰
  temperature?: number     // 온도 (0.0 ~ 2.0)
  topP?: number            // Top-P 샘플링
  topK?: number            // Top-K 샘플링
  stream?: boolean         // 스트리밍 여부
  context?: string         // 추가 컨텍스트
}

interface LLMResponse {
  text: string             // 생성된 텍스트
  tokensUsed?: number      // 사용된 토큰 수
  finishReason?: string    // 종료 이유
}

interface LLMStreamChunk {
  text: string             // 텍스트 청크
  done: boolean            // 스트림 완료 여부
}
```

---

## 4. Error Response Format

파일: `frontend/src/lib/api/errorHandler.ts`

### 공통 에러 응답 구조

```typescript
interface ApiErrorResponse {
  success: false
  error: string
  code?: ErrorCode
  details?: unknown
}
```

### 에러 헬퍼 함수

```typescript
// 범용 에러 핸들러
handleApiError(error: unknown, context?: string): NextResponse<ApiErrorResponse>

// 커스텀 에러 응답
createErrorResponse(code: ErrorCode, message: string, details?: unknown): NextResponse<ApiErrorResponse>

// 성공 응답
createSuccessResponse<T>(data?: T, message?: string): NextResponse

// 사전 정의된 에러 응답
unauthorizedResponse(message?: string): NextResponse<ApiErrorResponse>   // 401
forbiddenResponse(message?: string): NextResponse<ApiErrorResponse>      // 403
notFoundResponse(message?: string): NextResponse<ApiErrorResponse>       // 404
badRequestResponse(message: string, details?: unknown): NextResponse<ApiErrorResponse>  // 400
```

### 기본 메시지

| 함수 | 기본 메시지 |
|------|-------------|
| `unauthorizedResponse` | `'로그인이 필요합니다.'` |
| `forbiddenResponse` | `'접근 권한이 없습니다.'` |
| `notFoundResponse` | `'요청한 리소스를 찾을 수 없습니다.'` |
