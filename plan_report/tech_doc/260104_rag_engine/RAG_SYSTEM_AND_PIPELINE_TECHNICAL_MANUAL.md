# PRISM Writer - RAG 시스템 및 파이프라인 기술 문서

---

## 문서 정보

| 항목 | 내용 |
|------|------|
| **문서명** | RAG 시스템 및 파이프라인 기술 매뉴얼 |
| **버전** | v5.0 |
| **생성일** | 2026-01-04 |
| **최종 수정일** | 2026-01-04 |
| **작성자** | Claude Code (자동 생성) |
| **대상 독자** | 개발팀, 시스템 관리자 |

### 문서 포함 내용
- RAG(Retrieval-Augmented Generation) 시스템 아키텍처
- 문서 처리 파이프라인 (업로드 → 청킹 → 임베딩 → 저장)
- 검색 시스템 (벡터 검색, 하이브리드 검색, RRF)
- 품질 관리 게이트 (ACL, Citation, Sufficiency, Hallucination)
- 데이터베이스 스키마 및 마이그레이션
- 시스템 복원 절차
- Feature Flags 및 버전 관리

---

## 1. 시스템 개요

### 1.1 아키텍처 다이어그램

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           PRISM Writer RAG System                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                  │
│  │  문서 업로드  │───▶│  문서 처리   │───▶│  벡터 저장   │                  │
│  │   (Upload)   │    │ (Processing) │    │  (Storage)   │                  │
│  └──────────────┘    └──────────────┘    └──────────────┘                  │
│         │                   │                   │                           │
│         ▼                   ▼                   ▼                           │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                  │
│  │ PDF/TXT/MD   │    │   Chunking   │    │  Supabase    │                  │
│  │   Parser     │    │   Semantic   │    │  pgvector    │                  │
│  └──────────────┘    └──────────────┘    └──────────────┘                  │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                  │
│  │  쿼리 확장   │───▶│ 하이브리드   │───▶│   리랭킹    │                  │
│  │  (Expansion) │    │   Search     │    │  (Reranker)  │                  │
│  └──────────────┘    └──────────────┘    └──────────────┘                  │
│         │                   │                   │                           │
│         ▼                   ▼                   ▼                           │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                  │
│  │ Query Exp.   │    │ Vector+FTS   │    │  Gemini 3    │                  │
│  │ Domain Map   │    │    RRF       │    │    Flash     │                  │
│  └──────────────┘    └──────────────┘    └──────────────┘                  │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                           품질 관리 게이트                                   │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐              │
│  │  ACL Gate  │ │ Sufficiency│ │  Citation  │ │Hallucination│             │
│  │            │ │    Gate    │ │    Gate    │ │  Detector   │             │
│  └────────────┘ └────────────┘ └────────────┘ └────────────┘              │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 기술 스택

| 계층 | 기술 |
|------|------|
| 프론트엔드 | Next.js 14, TypeScript, React |
| 백엔드 | Next.js API Routes (Serverless) |
| 데이터베이스 | Supabase (PostgreSQL + pgvector) |
| 임베딩 | OpenAI text-embedding-3-small (1536차원) |
| LLM | Google Gemini 3 Flash (리랭킹/평가) |
| 토크나이저 | js-tiktoken (cl100k_base) |
| 파일 저장소 | Supabase Storage |

---

## 2. 문서 처리 파이프라인

### 2.1 파이프라인 흐름

```
업로드 → 파싱 → 청킹 → 임베딩 → 저장 → 완료
  │        │       │        │        │       │
  ▼        ▼       ▼        ▼        ▼       ▼
pending  parsing chunking embedding  -    completed
                                          (or failed)
```

### 2.2 핵심 모듈 경로

```
frontend/src/lib/rag/
├── documentProcessor.ts    # 메인 문서 처리 오케스트레이터
├── chunking.ts            # Semantic Chunking 엔진
├── embedding.ts           # OpenAI 임베딩 생성
├── tokenizer.ts           # tiktoken 기반 토큰 계산
├── search.ts              # 하이브리드 검색 엔진
├── reranker.ts            # LLM 기반 리랭킹
├── queryExpansion.ts      # 쿼리 확장 모듈
├── dynamicThreshold.ts    # 동적 임계값 계산
├── costGuard.ts           # 비용 관리 (토큰 한도)
├── aclGate.ts             # 접근 제어 게이트
├── citationGate.ts        # 인용 검증 게이트
├── sufficiencyGate.ts     # 근거 충분성 게이트
├── hallucinationDetector.ts # 환각 탐지 모듈
├── criteriaPack.ts        # CriteriaPack 관리 (Pin/Unpin)
└── featureFlags.ts        # Pipeline v4 Feature Flags
```

### 2.3 문서 처리기 (documentProcessor.ts)

#### 2.3.1 주요 함수

```typescript
// 문서 처리 메인 함수
export async function processDocument(
  documentId: string,
  filePath: string,
  userId: string,
  fileType?: string,
  options: ProcessDocumentOptions = {}
): Promise<ProcessingResult>

// 백그라운드 처리 트리거
export async function triggerDocumentProcessing(
  documentId: string,
  filePath: string,
  userId: string
): Promise<void>
```

#### 2.3.2 처리 단계

| 단계 | 상태 | 설명 |
|------|------|------|
| 1 | PARSING | Storage에서 파일 다운로드 및 텍스트 추출 |
| 2 | CHUNKING | Semantic Chunking으로 청크 분할 |
| 3 | EMBEDDING | OpenAI API로 임베딩 벡터 생성 |
| 4 | (저장) | rag_chunks 테이블에 저장 |
| 5 | COMPLETED | 처리 완료 |

#### 2.3.3 지원 파일 형식

| 형식 | MIME Type | 파싱 방법 |
|------|-----------|-----------|
| PDF | application/pdf | pdf2json 라이브러리 |
| TXT | text/plain | 직접 텍스트 읽기 |
| MD | text/markdown | 직접 텍스트 읽기 |

#### 2.3.4 PDF 파싱 특이사항

```typescript
// pdf2json 사용 (Vercel Serverless 호환)
// - Canvas/DOM 의존성 없음
// - 한글 지원 (URL 디코딩)
// - 스캔된 이미지 PDF 감지 → 에러 메시지 반환

async function parsePDF(buffer: Buffer): Promise<string> {
  // pdfData.Pages → Texts → R → T 구조에서 직접 추출
  // URL 인코딩된 텍스트 디코딩 (한글 지원)
}
```

---

## 3. 청킹 시스템 (chunking.ts)

### 3.1 Semantic Chunking

Pipeline v3에서 도입된 의미 단위 청킹 방식입니다.

#### 3.1.1 설정값

```typescript
const DEFAULT_CHUNK_SIZE = 512      // 토큰 단위
const DEFAULT_OVERLAP = 50          // 오버랩 토큰
const MAX_CHUNK_TOKENS = 6000       // 임베딩 모델 토큰 제한 (안전 마진)
const FALLBACK_CHARS_PER_TOKEN = 2.5 // Fallback 문자/토큰 비율
```

#### 3.1.2 청크 타입 분류

```typescript
export type ChunkType = 'rule' | 'example' | 'general';

// 자동 분류 함수
export function classifyChunkType(text: string): ChunkType
```

**규칙(rule) 패턴:**
- 한글: `해야 합니다`, `하지 마`, `금지`, `원칙`, `필수`, `반드시` 등
- 영어: `should always`, `must be`, `do not`, `avoid` 등

**예시(example) 패턴:**
- 한글: `예를 들어`, `예시`, `사례`, `다음과 같` 등
- 영어: `for example`, `e.g.`, `good example`, `bad example` 등
- 따옴표: `"10자 이상"`, `「한국식 따옴표」` 등

#### 3.1.3 청크 메타데이터

```typescript
interface ChunkMetadata {
  sectionTitle?: string   // 마크다운 헤더
  tokenCount: number      // tiktoken 기반 토큰 수
  startPosition: number   // 시작 문자 위치
  endPosition: number     // 끝 문자 위치
  chunkType?: ChunkType   // 청크 유형
}
```

### 3.2 문장 경계 분할 (Pipeline v5)

긴 텍스트를 문장 단위로 분할하여 맥락 보존:

```typescript
// 문장 분리 정규식 (한글/영어)
const sentencePattern = /(?<=[.!?。])\s+/g

// truncateToTokenLimit() 함수로 안전하게 자르기
```

---

## 4. 임베딩 시스템 (embedding.ts)

### 4.1 설정

```typescript
export const EMBEDDING_CONFIG = {
  modelId: 'text-embedding-3-small',
  dimensions: 1536,
  vendor: 'openai',
} as const

const MAX_BATCH_SIZE = 100   // 배치 최대 크기
const MAX_RETRIES = 3        // 재시도 횟수
const RETRY_DELAY = 1000     // 재시도 대기 (ms)
```

### 4.2 주요 함수

```typescript
// 단일 텍스트 임베딩
export async function embedText(text: string): Promise<number[]>

// 배치 임베딩 (최대 100개)
export async function embedBatch(texts: string[]): Promise<number[][]>

// 대용량 배치 임베딩
export async function embedLargeBatch(texts: string[]): Promise<number[][]>

// 토큰 수 계산 (tiktoken 기반)
export function estimateTokenCount(text: string): number
```

### 4.3 재시도 로직

```typescript
// Exponential Backoff
for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
  try {
    return await client.embeddings.create({ ... })
  } catch (error) {
    await sleep(RETRY_DELAY * (attempt + 1))
  }
}
```

---

## 5. 토크나이저 (tokenizer.ts)

### 5.1 tiktoken 통합 (Pipeline v5)

```typescript
import { getEncoding, type Tiktoken } from 'js-tiktoken'

const DEFAULT_ENCODING: EncodingType = 'cl100k_base'

// 캐시된 인코딩 인스턴스
const encodingCache: Map<EncodingType, Tiktoken> = new Map()
```

### 5.2 주요 함수

```typescript
// 정확한 토큰 수 계산
export function countTokens(text: string): TokenCountResult

// 간편 버전 (숫자만 반환)
export function getTokenCount(text: string): number

// 토큰 제한에 맞게 텍스트 자르기
export function truncateToTokenLimit(
  text: string,
  maxTokens: number
): string

// 배열 총 토큰 수
export function countTotalTokens(texts: string[]): number
```

### 5.3 Fallback 처리

tiktoken 로딩 실패 시 문자 수 기반 추정 사용:
```typescript
const FALLBACK_CHARS_PER_TOKEN = 2.5
const estimatedCount = Math.ceil(text.length / FALLBACK_CHARS_PER_TOKEN)
```

---

## 6. 검색 시스템 (search.ts)

### 6.1 검색 방식

| 방식 | 설명 | 가중치 기본값 |
|------|------|--------------|
| 벡터 검색 | pgvector 코사인 유사도 | 0.7 |
| 키워드 검색 | PostgreSQL Full Text Search | 0.3 |

### 6.2 하이브리드 검색 흐름

```
쿼리 입력
    │
    ▼
┌───────────────────────────────────────┐
│         캐시 확인 (LRU Cache)         │
│  - 1000개 항목, 1시간 TTL            │
└───────────────────────────────────────┘
    │ (캐시 미스)
    ▼
┌───────────────────────────────────────┐
│         병렬 검색 실행                │
│  ┌─────────────┐  ┌─────────────┐    │
│  │ Vector      │  │ Keyword     │    │
│  │ Search      │  │ Search      │    │
│  │ (OpenAI     │  │ (PostgreSQL │    │
│  │  Embedding) │  │  tsvector)  │    │
│  └─────────────┘  └─────────────┘    │
└───────────────────────────────────────┘
    │
    ▼
┌───────────────────────────────────────┐
│         RRF (Reciprocal Rank Fusion)  │
│  RRF(d) = Σ 1 / (k + rank(d))         │
│  k = 60 (상수)                        │
└───────────────────────────────────────┘
    │
    ▼
결과 반환 + 캐시 저장
```

### 6.3 주요 함수

```typescript
// 벡터 검색
export async function vectorSearch(
  query: string,
  options: SearchOptions
): Promise<SearchResult[]>

// 키워드 검색
export async function fullTextSearch(
  query: string,
  options: SearchOptions
): Promise<SearchResult[]>

// RRF 병합
export function reciprocalRankFusion(
  resultSets: SearchResult[][],
  topK: number
): SearchResult[]

// 하이브리드 검색 (메인)
export async function hybridSearch(
  query: string,
  options: HybridSearchOptions
): Promise<SearchResult[]>

// 패턴 기반 검색 Wrapper
export async function searchByPattern(
  query: string,
  patternType: PatternType | null,
  options: SearchByPatternOptions
): Promise<SearchResult[]>
```

### 6.4 검색 옵션

```typescript
interface SearchOptions {
  userId: string           // 필수: 사용자 ID
  topK?: number           // 반환 결과 수 (기본: 5)
  documentId?: string     // 특정 문서 필터
  minScore?: number       // 최소 점수 임계값
  chunkType?: ChunkType   // 청크 유형 필터
  category?: string       // 카테고리 필터
  projectId?: string      // 프로젝트 필터 (RAG-ISOLATION)
}

interface HybridSearchOptions extends SearchOptions {
  vectorWeight?: number   // 벡터 가중치 (기본: 0.7)
  keywordWeight?: number  // 키워드 가중치 (기본: 0.3)
  patternType?: PatternType // 패턴 타입 필터
}
```

### 6.5 근거 품질 계산 (P1-C)

```typescript
export function calculateEvidenceQuality(
  score: number,
  method: 'vector' | 'keyword',
  chunkDate?: string
): EvidenceQuality

// 등급 기준
// Vector: >= 0.78 → HIGH, >= 0.72 → MEDIUM
// Keyword: >= 0.8 → HIGH, >= 0.5 → MEDIUM
```

### 6.6 재시도 로직 (P7-02)

```typescript
const MAX_RETRY_COUNT = 3
const INITIAL_BACKOFF_MS = 200

// Exponential Backoff: 200ms → 400ms → 800ms
async function withRetry<T>(
  operation: () => Promise<T>,
  context: string
): Promise<T>
```

---

## 7. 쿼리 확장 (queryExpansion.ts)

### 7.1 도메인 매핑

50개 이상의 PRISM Writer 특화 용어를 동의어로 확장:

```typescript
const DOMAIN_MAP: Record<string, string[]> = {
  // 글쓰기 핵심 용어
  '글쓰기': ['원고 작성', '콘텐츠 구성', '스크립트 작성', ...],

  // PRISM Writer 특화 용어
  '공감': ['감정', '정서', '공감대', ...],
  '공감-정보': ['공감 정보', '공감과 정보', ...],

  // 유튜브/영상 콘텐츠 용어
  '유튜브': ['영상', '콘텐츠', '크리에이터', ...],
  'Hook': ['훅', '도입부', '낚시', ...],
  'CTA': ['콜투액션', '행동 유도', ...],

  // ... 총 50개 이상
}
```

### 7.2 확장 함수

```typescript
// 최대 5개 쿼리로 확장
export function expandQuery(query: string): string[]

// 예시:
// expandQuery("글쓰기 방법")
// → ["글쓰기 방법", "원고 작성 방법", "콘텐츠 구성 기법", ...]
```

---

## 8. 동적 임계값 (dynamicThreshold.ts)

### 8.1 임계값 범위

```typescript
const BASE_THRESHOLD = 0.35   // 기본
const MIN_THRESHOLD = 0.25    // 최소 (추상적 질문)
const MAX_THRESHOLD = 0.45    // 최대 (구체적 질문)
```

### 8.2 질문 유형별 조정

| 유형 | 패턴 예시 | 임계값 조정 |
|------|-----------|------------|
| 추상적 | "어떻게 해야", "방법", "무엇" | ×0.7 (낮춤) |
| 구체적 | "공감-정보", "PRISM", "기승전결" | ×1.2 (높임) |
| 일반 | 기타 | 기본값 유지 |

```typescript
export function calculateDynamicThreshold(query: string): number
export function analyzeQuery(query: string): QueryAnalysisResult
```

---

## 9. 리랭킹 (reranker.ts)

### 9.1 LLM 기반 리랭킹

```typescript
// Gemini 3 Flash 사용
export async function rerank(
  query: string,
  results: SearchResult[],
  options: RerankOptions
): Promise<SearchResult[]>

// 관련성 평가 프롬프트
const prompt = `다음 쿼리와 텍스트의 관련성을 0~1 사이의 숫자로 평가해주세요.
- 1.0: 매우 관련성이 높음 (쿼리에 직접적으로 답함)
- 0.7~0.9: 관련성이 있음
- 0.4~0.6: 약간 관련성 있음
- 0~0.3: 관련성이 낮음`
```

### 9.2 예시 특화 리랭킹 (Pipeline v3)

```typescript
interface ExampleRerankerConfig {
  quoteBoost: number      // 따옴표 가중치 (기본: 1.2)
  dialogueBoost: number   // 대화체 가중치 (기본: 1.1)
  numericBoost: number    // 수치 가중치 (기본: 1.15)
}

export function applyExampleBoost(
  results: SearchResult[],
  config: ExampleRerankerConfig
): SearchResult[]
```

### 9.3 모델 캐시 관리 (Pipeline v5)

```typescript
const MODEL_CACHE_TTL_MS = 5 * 60 * 1000  // 5분

// 캐시 무효화 (설정 변경 시)
export function invalidateRerankerCache(): void
```

---

## 10. 품질 관리 게이트

### 10.1 ACL 게이트 (aclGate.ts)

사용자 문서 접근 권한 검증:

```typescript
export async function validateACL(
  filter: ACLFilter,
  supabaseClient?: any
): Promise<ACLValidationResult>

interface ACLValidationResult {
  valid: boolean
  allowedDocumentIds: string[]
  error?: string
}
```

### 10.2 Sufficiency 게이트 (sufficiencyGate.ts)

검색 결과의 근거 충분성 검사:

```typescript
const MIN_SCORE_THRESHOLD = 0.5    // 최소 유사도
const MIN_CHUNK_COUNT = 1          // 최소 청크 수
const HIGH_CONFIDENCE_THRESHOLD = 0.75

export function checkSufficiency(
  searchResults: SearchResult[],
  options: SufficiencyOptions
): SufficiencyResult

interface SufficiencyResult {
  sufficient: boolean
  reason: string
  best_score: number
  chunk_count: number
  confidence_level: 'high' | 'medium' | 'low' | 'none'
}
```

### 10.3 Citation 게이트 (citationGate.ts)

LLM 인용문의 원본 청크 존재 여부 검증:

```typescript
const SIMILARITY_THRESHOLD = 0.7  // 70% 이상 매칭

export function verifyCitation(
  quote: string,
  sourceChunks: Array<{ id: string; content: string }>
): CitationVerifyResult

export function verifyAllCitations(
  evidence: JudgeEvidence[],
  sourceChunks: Array<{ id: string; content: string }>
): VerifiedEvidence[]

// 인용 마커 검사 ([1], [참고 자료 1] 등)
export function hasCitationMarkers(text: string): boolean
```

### 10.4 Hallucination 탐지기 (hallucinationDetector.ts)

회피형 환각 탐지:

```typescript
export function detectEvasionHallucination(
  hasRetrievedDocs: boolean,
  modelResponse: string,
  confidenceThreshold: number = 0.7
): HallucinationCheckResult

// 환각 패턴 예시
// - "참고 자료에 관련 내용이 없" (confidence: 0.9)
// - "제공된 자료에는 내용이 없" (confidence: 0.9)
// - "자료를 찾을 수 없" (confidence: 0.85)
```

---

## 11. 비용 관리 (costGuard.ts)

### 11.1 등급별 한도

```typescript
const TIER_LIMITS: Record<UserTier, UsageLimits> = {
  free: {
    dailyTokenLimit: 50_000,      // ~100 pages
    maxDocumentSize: 100_000,     // ~200 pages
  },
  premium: {
    dailyTokenLimit: 500_000,     // ~1,000 pages
    maxDocumentSize: 1_000_000,   // ~2,000 pages
  },
  enterprise: {
    dailyTokenLimit: 5_000_000,   // ~10,000 pages
    maxDocumentSize: 10_000_000,  // ~20,000 pages
  },
}
```

### 11.2 주요 함수

```typescript
// 사용량 확인
export async function checkUsage(userId: string): Promise<UsageStats>

// 사용 가능 여부 검증
export async function validateUsage(
  userId: string,
  estimatedTokens: number
): Promise<void>

// 사용량 기록
export async function trackUsage(
  userId: string,
  tokensUsed: number,
  documentId?: string
): Promise<void>

// 문서 크기 검증
export async function validateDocumentSize(
  userId: string,
  estimatedTokens: number
): Promise<void>
```

---

## 12. CriteriaPack 관리 (criteriaPack.ts)

### 12.1 Pin/Unpin 기능

사용자가 특정 규칙/예시를 Pin하면 검색 결과 상위에 고정:

```typescript
export async function pinItem(
  userId: string,
  itemId: string,
  itemType: 'rule' | 'example',
  templateId?: string
): Promise<PinResult>

export async function unpinItem(
  userId: string,
  itemId: string,
  templateId?: string
): Promise<PinResult>

export async function togglePin(
  userId: string,
  itemId: string,
  itemType: 'rule' | 'example',
  templateId?: string
): Promise<PinResult>
```

### 12.2 Optimistic UI 패턴

1. 로컬 상태 먼저 업데이트 (즉시 UI 반영)
2. 서버에 요청
3. 실패 시 롤백 함수 호출

---

## 13. Feature Flags (featureFlags.ts)

### 13.1 Pipeline v4 플래그

```typescript
// 환경 변수로 v4 비활성화 가능
export const ENABLE_PIPELINE_V4 =
  process.env.NEXT_PUBLIC_ENABLE_PIPELINE_V4 !== 'false'

export const PIPELINE_V4_FLAGS = {
  useChunkTypeFilter: ENABLE_PIPELINE_V4,
  enableRegressionGate: ENABLE_PIPELINE_V4,
  autoGenerateValidationSamples: ENABLE_PIPELINE_V4,
  enableClassificationLogging: process.env.NODE_ENV === 'development',
  enablePromptLengthLimit: ENABLE_PIPELINE_V4,
}
```

### 13.2 롤백 방법

```bash
# 환경 변수로 v3로 즉시 롤백
NEXT_PUBLIC_ENABLE_PIPELINE_V4=false
```

---

## 14. 데이터베이스 스키마

### 14.1 rag_documents 테이블

```sql
CREATE TABLE public.rag_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_type TEXT NOT NULL,
    file_size BIGINT NOT NULL CHECK (file_size > 0),
    status TEXT NOT NULL DEFAULT 'pending'
      CHECK (status IN ('pending', 'processing', 'ready', 'error')),
    metadata JSONB DEFAULT '{}'::jsonb,
    version INTEGER NOT NULL DEFAULT 1,
    tenant_id UUID REFERENCES auth.users(id),  -- Pipeline v3 추가
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 인덱스
CREATE INDEX idx_rag_documents_user_id ON public.rag_documents(user_id);
CREATE INDEX idx_rag_documents_status ON public.rag_documents(status);
CREATE INDEX idx_rag_documents_user_status ON public.rag_documents(user_id, status);
```

### 14.2 rag_chunks 테이블

```sql
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE public.rag_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES public.rag_documents(id) ON DELETE CASCADE,
    chunk_index INTEGER NOT NULL CHECK (chunk_index >= 0),
    content TEXT NOT NULL,
    embedding vector(1536),  -- OpenAI text-embedding-3-small
    metadata JSONB DEFAULT '{}'::jsonb,
    chunk_type VARCHAR(50),  -- 'rule' | 'example' | 'general'
    tenant_id UUID REFERENCES auth.users(id),  -- Pipeline v3 추가
    embedding_model_id TEXT,  -- 임베딩 모델 버전
    embedding_dim INTEGER,    -- 임베딩 차원
    embedded_at TIMESTAMPTZ,  -- 임베딩 생성 시간
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_chunk_per_document UNIQUE(document_id, chunk_index)
);

-- 벡터 검색용 HNSW 인덱스
CREATE INDEX idx_rag_chunks_embedding
    ON public.rag_chunks
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);
```

### 14.3 rag_rules 테이블 (Pipeline v3)

```sql
CREATE TABLE rag_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES rag_documents(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES auth.users(id),
    source_chunk_id UUID REFERENCES rag_chunks(id),
    content TEXT NOT NULL,
    type VARCHAR(50) NOT NULL DEFAULT 'general',
    category VARCHAR(50),
    keywords TSVECTOR,
    metadata JSONB DEFAULT '{}'::jsonb,
    embedding vector(768),  -- Gemini용
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
```

### 14.4 rag_examples 테이블 (Pipeline v3)

```sql
CREATE TABLE rag_examples (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_id UUID NOT NULL REFERENCES rag_rules(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES auth.users(id),
    source_chunk_id UUID REFERENCES rag_chunks(id),
    content TEXT NOT NULL,
    is_positive BOOLEAN NOT NULL DEFAULT true,
    is_generated BOOLEAN NOT NULL DEFAULT false,
    confidence_score FLOAT DEFAULT 0.8,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now()
);
```

### 14.5 rag_templates 테이블 (Pipeline v3)

```sql
CREATE TABLE rag_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID REFERENCES rag_documents(id) ON DELETE SET NULL,
    tenant_id UUID NOT NULL REFERENCES auth.users(id),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    version INTEGER NOT NULL DEFAULT 1,
    status VARCHAR(50) NOT NULL DEFAULT 'draft',
    is_public BOOLEAN DEFAULT false,
    criteria_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    approved_at TIMESTAMPTZ,
    approved_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
```

### 14.6 embedding_usage 테이블

```sql
CREATE TABLE embedding_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id),
    tokens_used INTEGER NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now()
);
```

### 14.7 criteria_pack_pins 테이블 (Pipeline v5)

```sql
CREATE TABLE criteria_pack_pins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id),
    item_id UUID NOT NULL,
    item_type VARCHAR(50) NOT NULL,  -- 'rule' | 'example'
    template_id UUID,
    pinned_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, item_id, template_id)
);
```

### 14.8 RLS 정책

모든 RAG 테이블에 Row Level Security 적용:

```sql
-- 사용자는 본인의 데이터만 접근 가능
CREATE POLICY "Users can view own documents"
    ON public.rag_documents FOR SELECT
    USING (auth.uid() = user_id);

-- 관리자는 모든 데이터 접근 가능
CREATE POLICY "rls_rag_rules_tenant_select" ON rag_rules
    FOR SELECT USING (
        tenant_id = auth.uid() OR
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );
```

---

## 15. RPC 함수

### 15.1 search_similar_chunks

```sql
CREATE OR REPLACE FUNCTION public.search_similar_chunks(
    query_embedding vector(1536),
    user_id_param UUID,
    match_count INTEGER DEFAULT 5
)
RETURNS TABLE (
    chunk_id UUID,
    document_id UUID,
    content TEXT,
    similarity FLOAT,
    metadata JSONB
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        c.id AS chunk_id,
        c.document_id,
        c.content,
        1 - (c.embedding <=> query_embedding) AS similarity,
        c.metadata
    FROM public.rag_chunks c
    INNER JOIN public.rag_documents d ON c.document_id = d.id
    WHERE d.user_id = user_id_param
    ORDER BY c.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;
```

### 15.2 match_document_chunks

```sql
-- Category 필터 및 프로젝트 필터 포함 버전
CREATE OR REPLACE FUNCTION public.match_document_chunks(
    query_embedding vector(1536),
    match_threshold FLOAT,
    match_count INTEGER,
    user_id_param UUID,
    category_param TEXT DEFAULT NULL,
    project_id_param UUID DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    document_id UUID,
    content TEXT,
    similarity FLOAT,
    metadata JSONB,
    chunk_type TEXT,
    document_title TEXT
)
```

---

## 16. 환경 변수

### 16.1 필수 환경 변수

```bash
# OpenAI API (임베딩)
OPENAI_API_KEY=sk-...

# Google Gemini API (리랭킹)
GOOGLE_API_KEY=AI...

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...  # 서버사이드 전용
```

### 16.2 선택적 환경 변수

```bash
# Pipeline v4 비활성화 (v3로 롤백)
NEXT_PUBLIC_ENABLE_PIPELINE_V4=false

# 개발 환경 설정
NODE_ENV=development
```

---

## 17. 시스템 복원 절차

### 17.1 사전 준비

1. **Supabase 프로젝트 생성**
   - https://supabase.com 에서 새 프로젝트 생성
   - PostgreSQL 버전: 15 이상
   - pgvector 확장 활성화

2. **환경 변수 설정**
   ```bash
   cp .env.example .env.local
   # 위 16.1 섹션 참고하여 값 입력
   ```

### 17.2 데이터베이스 마이그레이션

```bash
# 마이그레이션 파일 순서대로 실행
backend/migrations/
├── 012_rag_documents_schema.sql  # RAG 문서 테이블
├── 013_rag_chunks_schema.sql     # RAG 청크 테이블 + pgvector
├── 014_embedding_usage_schema.sql # 사용량 추적
├── 018_embedding_version_schema.sql # 임베딩 버전 관리
├── 020_search_schema.sql          # 검색 RPC 함수
├── 021_pipeline_v3_schema.sql     # Rules/Examples/Templates
├── 023_tenant_rls_policies.sql    # Tenant RLS
├── 030_bm25_dual_index.sql        # BM25 듀얼 인덱스
├── 031_search_chunk_type_filter.sql # chunk_type 필터
└── 036_criteria_pack_pins.sql     # CriteriaPack Pin
```

Supabase SQL 에디터에서 순서대로 실행하거나:

```bash
# Supabase CLI 사용
supabase db push
```

### 17.3 Storage 버킷 생성

```sql
-- Supabase Storage 버킷
INSERT INTO storage.buckets (id, name, public)
VALUES ('rag-documents', 'rag-documents', false);

-- RLS 정책
CREATE POLICY "Users can upload own documents"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'rag-documents' AND auth.uid()::text = (storage.foldername(name))[1]);
```

### 17.4 의존성 설치

```bash
# 프론트엔드
cd frontend
npm install

# 주요 의존성
# - openai: 임베딩 API
# - @google/generative-ai: Gemini API
# - js-tiktoken: 토큰 계산
# - pdf2json: PDF 파싱
```

### 17.5 검증 절차

1. **임베딩 테스트**
   ```typescript
   import { embedText } from './lib/rag/embedding'
   const result = await embedText("테스트 문장")
   console.log(result.length) // 1536
   ```

2. **검색 테스트**
   ```typescript
   import { hybridSearch } from './lib/rag/search'
   const results = await hybridSearch("테스트 쿼리", { userId: "..." })
   ```

3. **문서 업로드 테스트**
   - PDF 파일 업로드 → 처리 상태 확인 → 검색 결과 확인

---

## 18. 모니터링 및 디버깅

### 18.1 로그 확인

```typescript
// 검색 로그
console.log('[vectorSearch] CALLED with query:', query)
console.log('[vectorSearch] ACL PASSED, docs:', aclResult.allowedDocumentIds.length)

// 청크 분류 로그 (개발 환경)
console.log(`[classifyChunkType] "${preview}..." -> ${result}`)

// 환각 탐지 로그
console.log(`[HallucinationDetector] Pattern matched: ${description}`)
```

### 18.2 Feature Flag 상태 확인

```typescript
import { logFeatureFlagStatus } from './lib/rag/featureFlags'
logFeatureFlagStatus()
// [FeatureFlags] Pipeline Version: v4
// [FeatureFlags] Flags: { useChunkTypeFilter: true, ... }
```

### 18.3 캐시 모니터링

```typescript
// 검색 캐시 상태
searchCache.getStats()
// { size: 150, hitRate: 0.75, ... }
```

---

## 19. 버전 히스토리

| 버전 | 날짜 | 주요 변경사항 |
|------|------|--------------|
| v1.0 | 2024-12 | 초기 RAG 시스템 구현 |
| v2.0 | 2024-12 | 벡터 검색 + 키워드 검색 통합 |
| v3.0 | 2024-12 | Semantic Chunking, Rules/Examples 테이블 |
| v4.0 | 2024-12 | Feature Flags, chunk_type 필터 |
| v5.0 | 2025-01 | tiktoken 통합, 캐시 시스템, Sufficiency Gate |

---

## 20. 문제 해결 가이드

### 20.1 임베딩 생성 실패

**증상:** `OPENAI_API_KEY 환경 변수가 설정되지 않았습니다.`

**해결:**
```bash
# .env.local 파일 확인
OPENAI_API_KEY=sk-...
```

### 20.2 PDF 파싱 실패

**증상:** `스캔된 이미지 PDF는 지원되지 않습니다.`

**해결:** OCR 또는 Vision API 사용 안내

### 20.3 벡터 검색 결과 없음

**증상:** hybridSearch 결과가 비어있음

**해결:**
1. 문서 처리 상태 확인 (COMPLETED인지)
2. 임베딩이 정상 생성되었는지 확인
3. ACL 권한 확인 (user_id 일치 여부)

### 20.4 토큰 한도 초과

**증상:** `일일 임베딩 한도를 초과했습니다.`

**해결:**
1. 다음날 재시도
2. 프리미엄 등급 업그레이드

---

## 부록 A: 파일 구조

```
prismLM/
├── frontend/
│   └── src/
│       └── lib/
│           ├── rag/                    # RAG 핵심 모듈
│           │   ├── aclGate.ts
│           │   ├── chunking.ts
│           │   ├── citationGate.ts
│           │   ├── costGuard.ts
│           │   ├── criteriaPack.ts
│           │   ├── documentProcessor.ts
│           │   ├── dynamicThreshold.ts
│           │   ├── embedding.ts
│           │   ├── featureFlags.ts
│           │   ├── hallucinationDetector.ts
│           │   ├── queryExpansion.ts
│           │   ├── reranker.ts
│           │   ├── search.ts
│           │   ├── sufficiencyGate.ts
│           │   └── tokenizer.ts
│           ├── supabase/               # Supabase 클라이언트
│           │   ├── client.ts
│           │   └── server.ts
│           └── cache/                  # 캐시 유틸리티
│               └── lruCache.ts
└── backend/
    └── migrations/                     # DB 마이그레이션
        ├── 012_rag_documents_schema.sql
        ├── 013_rag_chunks_schema.sql
        ├── 014_embedding_usage_schema.sql
        ├── 018_embedding_version_schema.sql
        ├── 020_search_schema.sql
        ├── 021_pipeline_v3_schema.sql
        └── ...
```

---

## 부록 B: 관련 문서

- `2512180737_RAG_pipeline_redesign_analysis.md` - 파이프라인 재설계 분석
- `2512251345_Pipeline_v4_Upgrade_Checklist.md` - v4 업그레이드 체크리스트
- `2512251728_Pipeline_v5_Implementation_Checklist.md` - v5 구현 체크리스트
- `2512271030_RAG_Hallucination_Meeting.md` - 환각 방지 회의록

---

**문서 끝**
