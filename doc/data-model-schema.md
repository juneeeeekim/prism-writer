# Data Model & Schema

> PRISM Writer 데이터 모델 / TypeScript 타입 / DB 스키마 명세
> 최종 갱신: 2026-02-14

---

## 목차

1. [TypeScript 타입 정의](#1-typescript-타입-정의)
   - [Auth & User](#11-auth--user)
   - [Project](#12-project)
   - [Document](#13-document)
   - [RAG Search](#14-rag-search)
   - [RAG Judge](#15-rag-judge)
   - [RAG Router](#16-rag-router)
   - [Patch System](#17-patch-system-pipeline-v5)
   - [Template & Rule](#18-template--rule)
   - [Criteria Pack](#19-criteria-pack)
   - [Telemetry](#110-telemetry)
   - [LLM Model Config](#111-llm-model-config)
   - [Judge Result Types](#112-judge-result-types)
2. [Database Schema (Supabase PostgreSQL)](#2-database-schema)
   - [profiles](#21-profiles)
   - [projects](#22-projects)
   - [user_documents](#23-user_documents)
   - [rag_chunks (document_chunks)](#24-rag_chunks)
   - [chat_sessions & chat_messages](#25-chat_sessions--chat_messages)
   - [evaluation_logs](#26-evaluation_logs)
   - [rag_rules](#27-rag_rules)
   - [rag_examples](#28-rag_examples)
   - [rag_templates](#29-rag_templates)
   - [raft_dataset](#210-raft_dataset)
   - [project_trash (Phase 7)](#211-project_trash)
3. [RLS (Row-Level Security) 정책](#3-rls-정책)
4. [인덱스 전략](#4-인덱스-전략)

---

## 1. TypeScript 타입 정의

### 1.1 Auth & User

파일: `frontend/src/types/auth.ts`

```typescript
// ─── 역할(Role) ─────────────────────────────────────────────
export type UserRole = 'pending' | 'free' | 'premium' | 'special' | 'admin'

// 역할 계층 (숫자가 높을수록 상위)
export const ROLE_HIERARCHY: Record<UserRole, number> = {
  pending: 0,
  free: 1,
  premium: 2,
  special: 3,
  admin: 4,
}

// ─── 사용량 제한 ───────────────────────────────────────────
export interface UsageLimits {
  daily_request_limit: number
  monthly_token_limit: number
  max_documents: number
  max_projects: number
}

export const ROLE_LIMITS: Record<UserRole, UsageLimits> = {
  pending:  { daily_request_limit: 0,   monthly_token_limit: 0,         max_documents: 0,   max_projects: 0 },
  free:     { daily_request_limit: 50,  monthly_token_limit: 500_000,   max_documents: 10,  max_projects: 3 },
  premium:  { daily_request_limit: 500, monthly_token_limit: 5_000_000, max_documents: 100, max_projects: 20 },
  special:  { daily_request_limit: 999, monthly_token_limit: 99_999_999,max_documents: 999, max_projects: 99 },
  admin:    { daily_request_limit: 999, monthly_token_limit: 99_999_999,max_documents: 999, max_projects: 99 },
}

// ─── 사용량 추적 ───────────────────────────────────────────
export interface DailyUsage {
  date: string            // YYYY-MM-DD
  request_count: number
  token_count: number
}

export interface MonthlyUsage {
  month: string           // YYYY-MM
  total_tokens: number
  total_requests: number
}

export interface UsageSummary {
  daily: DailyUsage
  monthly: MonthlyUsage
  limits: UsageLimits
}

// ─── 사용자 프로필 ─────────────────────────────────────────
export interface UserProfile {
  id: string
  email: string
  displayName: string
  role: UserRole
  tier: string
  isApproved: boolean
  subscriptionExpiresAt: string | null
  createdAt: string
  updatedAt: string
}

// DB → App 매핑용 타입
export interface ProfileRow {
  id: string
  email: string
  display_name: string
  role: UserRole
  tier: string
  is_approved: boolean
  subscription_expires_at: string | null
  created_at: string
  updated_at: string
}

// ─── LLM 사용 기록 ────────────────────────────────────────
export interface LLMUsageRecord {
  id: string
  user_id: string
  model_id: string
  input_tokens: number
  output_tokens: number
  estimated_cost: number
  purpose: string          // 'chat' | 'evaluate' | 'judge' 등
  created_at: string
}
```

---

### 1.2 Project

파일: `frontend/src/types/project.ts`

```typescript
// ─── 프로젝트 상태 ─────────────────────────────────────────
export type ProjectStatus = 'active' | 'archived'

// ─── 프로젝트 엔티티 ───────────────────────────────────────
export interface Project {
  id: string
  user_id: string
  name: string
  description: string | null
  icon: string                    // 이모지 (기본: '📁')
  status: ProjectStatus
  setup_completed: boolean
  created_at: string
  updated_at: string
}

// ─── 프로젝트 생성 입력 ────────────────────────────────────
export interface CreateProjectInput {
  name: string
  description?: string
  icon?: string
}

// ─── 프로젝트 수정 입력 ────────────────────────────────────
export interface UpdateProjectInput {
  name?: string
  description?: string
  icon?: string
  status?: ProjectStatus
}

// ─── 프로젝트 목록 응답 ────────────────────────────────────
export interface ProjectListResponse {
  projects: Project[]
  total: number
}

// ─── 프로젝트 상세 응답 ────────────────────────────────────
export interface ProjectDetailResponse extends Project {
  document_count?: number
  evaluation_count?: number
}

// ─── 아이콘 상수 ───────────────────────────────────────────
export const PROJECT_ICONS = [
  '📁', '📚', '📝', '💼', '🎓', '🔬', '💡', '🎯',
  '📊', '📈', '🗂️', '📋', '🖊️', '✍️', '📖', '🎨'
] as const

export type ProjectIcon = typeof PROJECT_ICONS[number]

// ─── 정렬 & 필터 ──────────────────────────────────────────
export type ProjectSortBy = 'name' | 'created_at' | 'updated_at'

export interface ProjectFilter {
  status?: ProjectStatus
  search?: string
  sortBy?: ProjectSortBy
  sortOrder?: 'asc' | 'desc'
}

// ─── 컨텍스트 타입 ─────────────────────────────────────────
export interface ProjectContextValue {
  currentProject: Project | null
  projects: Project[]
  isLoading: boolean
  error: string | null
  filter: ProjectFilter
  selectProject: (projectId: string) => void
  createProject: (input: CreateProjectInput) => Promise<Project>
  updateProject: (id: string, input: UpdateProjectInput) => Promise<Project>
  deleteProject: (id: string) => Promise<void>
  refreshProjects: () => Promise<void>
  completeSetup: () => Promise<void>
  setSearch: (search: string) => void
  setSortOption: (sortBy: ProjectSortBy, sortOrder?: 'asc' | 'desc') => void
}
```

---

### 1.3 Document

파일: `frontend/src/types/rag/document.ts`

```typescript
// ─── 문서 처리 상태 ────────────────────────────────────────
export enum DocumentStatus {
  PENDING    = 'pending',
  QUEUED     = 'queued',
  PARSING    = 'processing_parsing',
  CHUNKING   = 'processing_chunking',
  EMBEDDING  = 'processing_embedding',
  COMPLETED  = 'completed',
  FAILED     = 'failed'
}

// ─── 청크 메타데이터 ───────────────────────────────────────
export interface ChunkMetadata {
  sectionTitle?: string
  pageNumber?: number
  tokenCount?: number
  embeddingModelId?: string
}

// ─── RAG 청크 엔티티 ──────────────────────────────────────
export interface RagChunk {
  id: string
  document_id: string
  chunk_index: number
  content: string
  embedding?: number[]          // 1536차원 벡터 (text-embedding-3-small)
  metadata: ChunkMetadata
  created_at: string
  embedding_model_id?: string
  embedding_dim?: number
  embedded_at?: string
  tenant_id?: string
  chunk_type?: string           // 'rule' | 'example' | 'general'
}

// ─── 사용자 문서 엔티티 ────────────────────────────────────
export interface UserDocument {
  id: string
  user_id: string
  title: string
  content: string
  created_at: string
  updated_at: string
  category?: string
  sort_order?: number
  metadata?: Record<string, unknown>
  source?: string
  file_path?: string
  file_type?: string
  status?: string               // DocumentStatus 값
  error_message?: string
  file_size?: number
  started_at?: string
}

// ─── Supabase RPC 파라미터 ─────────────────────────────────
export interface MatchDocumentChunksParams {
  query_embedding: number[]     // 검색 쿼리 벡터
  match_threshold: number       // 최소 유사도 (0.0 ~ 1.0)
  match_count: number           // 반환할 최대 결과 수
  user_id_param: string         // 사용자 ID (RLS 필터)
  category_param?: string       // 카테고리 필터
}

// ─── Supabase RPC 결과 ────────────────────────────────────
export interface MatchDocumentChunksResult {
  id: string
  document_id: string
  content: string
  metadata: Record<string, unknown>
  similarity: number            // 코사인 유사도 (0.0 ~ 1.0)
}
```

---

### 1.4 RAG Search

파일: `frontend/src/types/rag/search.ts`

```typescript
// ─── 접근 제어 ─────────────────────────────────────────────
export interface ACLFilter {
  userId: string
  namespaces?: string[]
  documentIds?: string[]
  isAdmin?: boolean
}

export interface ACLValidationResult {
  valid: boolean
  allowedDocumentIds: string[]
  error?: string
}

// ─── 점수 구성요소 ─────────────────────────────────────────
export interface ScoreComponents {
  bm25: number                  // BM25 키워드 점수
  vector: number                // 벡터 유사도 점수
  rerank: number                // 재랭킹 점수
}

// ─── 증거 항목 ─────────────────────────────────────────────
export interface EvidenceItem {
  chunkId: string
  documentId: string
  content: string
  spanOffsets: { start: number; end: number }
  sourceUri: string
  namespace: string
  docVersion: string
  scoreComponents: ScoreComponents
}

// ─── 증거 메타데이터 ───────────────────────────────────────
export interface EvidenceMetadata {
  searchQuery: string
  retrievalConfigId: string
  embeddingModelId: string
  totalCandidates: number
  selectedCount: number
  createdAt: string
}

// ─── 증거 패키지 ───────────────────────────────────────────
export interface EvidencePack {
  runId: string
  rubricId?: string
  items: EvidenceItem[]
  metadata: EvidenceMetadata
}

// ─── 증거 품질 ─────────────────────────────────────────────
export enum EvidenceQualityGrade {
  HIGH   = 'high',
  MEDIUM = 'medium',
  LOW    = 'low'
}

export interface EvidenceQuality {
  grade: EvidenceQualityGrade
  score: number
  factors: {
    relevance: number
    recency?: number
    authority?: number
  }
}
```

---

### 1.5 RAG Judge

파일: `frontend/src/types/rag/judge.ts`

```typescript
// ─── 판정 결과 ─────────────────────────────────────────────
export type JudgeVerdict = 'pass' | 'fail' | 'insufficient_evidence'

// ─── 판정 근거 ─────────────────────────────────────────────
export interface JudgeEvidence {
  chunkId: string
  quote: string                 // 인용문
  relevance: number             // 관련도 (0.0 ~ 1.0)
}

// ─── 판정 결과 ─────────────────────────────────────────────
export interface JudgeResult {
  verdict: JudgeVerdict
  score: number                 // 0 ~ 100
  evidence: JudgeEvidence[]
  reasoning: string
  missingEvidence?: string[]    // 부족한 근거 목록
}

// ─── 리뷰 배지 ─────────────────────────────────────────────
export type ReviewBadge = '✅' | '⚠️' | '⛔'

// ─── 리뷰 결과 ─────────────────────────────────────────────
export interface ReviewResult {
  badge: ReviewBadge
  confidence: number
  issues?: string[]
  reasoning: string
}
```

---

### 1.6 RAG Router

파일: `frontend/src/types/rag/router.ts`

```typescript
// ─── 라우터 모드 ───────────────────────────────────────────
export type RouterMode = 'cheap' | 'standard' | 'strict'

// ─── 라우터 설정 ───────────────────────────────────────────
export interface RouterConfig {
  mode: RouterMode
  answerModel: string           // 응답 생성 모델
  reviewerModel: string | null  // 리뷰어 모델 (cheap 모드: null)
  maxTokens: number
  timeout: number               // ms
}

// 사전 정의된 설정 (모델 ID는 동적으로 주입)
export const ROUTER_CONFIGS: Record<RouterMode, RouterConfig>
```

| 모드 | answerModel | reviewerModel | maxTokens | timeout |
|------|-------------|---------------|-----------|---------|
| `cheap` | Flash 경량 모델 | `null` | 2048 | 10000 |
| `standard` | Flash 기본 모델 | Flash 기본 모델 | 4096 | 30000 |
| `strict` | Pro 모델 | Pro 모델 | 8192 | 60000 |

---

### 1.7 Patch System (Pipeline v5)

파일: `frontend/src/lib/rag/types/patch.ts`

```typescript
// ─── 패치 타입 ─────────────────────────────────────────────
export type PatchType = 'Replace' | 'Insert' | 'Move' | 'Delete'

// ─── 정렬 변화량 ──────────────────────────────────────────
export interface AlignmentDelta {
  criteria_id: string
  before_score: number
  after_score: number
  delta: number
}

// ─── 패치 정의 ─────────────────────────────────────────────
export interface Patch {
  id: string                    // "patch-{timestamp}-{random}"
  type: PatchType
  targetRange: {
    start: number               // 원문 내 시작 인덱스
    end: number                 // 원문 내 끝 인덱스
  }
  before: string                // 원본 텍스트
  after: string                 // 수정된 텍스트
  reason: string                // 수정 이유
  citationId: string            // 관련 기준 ID
  expectedDelta: AlignmentDelta[]
  status: 'pending' | 'applied' | 'rejected'
  createdAt: string             // ISO 8601
}

// ─── 개선 필요 항목 ────────────────────────────────────────
export interface GapItem {
  criteria_id: string
  criteria_name: string
  current_score: number
  target_score: number
  priority: number              // 우선순위 (1이 가장 높음)
}

// ─── 변경 계획 ─────────────────────────────────────────────
export interface ChangePlan {
  patches: Patch[]
  expectedAlignmentDelta: AlignmentDelta[]
  gapTop3: GapItem[]            // 상위 3개 개선 항목
  timestamp: string
  documentId: string
  templateId: string
}

// ─── 시뮬레이션 결과 ───────────────────────────────────────
export interface SimulationResult {
  patchId: string
  success: boolean
  previewText: string
  alignmentDelta: AlignmentDelta[]
  overallScoreDelta: number
  simulatedAt: string
  error?: string
}

// ─── V5 확장 평가 결과 ─────────────────────────────────────
export interface PatchEnabledEvaluationResult extends V3EvaluationResult {
  patches?: Patch[]
  gapTop3?: GapItem[]
  changePlan?: ChangePlan
}

// ─── 어댑터 함수 ───────────────────────────────────────────
export function adaptToV5Result(v3Result: V3EvaluationResult): PatchEnabledEvaluationResult
export function extractLegacyResult(v5Result: PatchEnabledEvaluationResult): V3EvaluationResult
export function isV5Result(result: any): result is PatchEnabledEvaluationResult
```

---

### 1.8 Template & Rule

파일: `frontend/src/types/rag/template.ts`

```typescript
// ─── 열거형 ────────────────────────────────────────────────
export type RuleCategory      = 'structure' | 'expression' | 'tone' | 'prohibition'
export type ExtractionMethod  = 'llm' | 'manual' | 'rule-based'
export type ExampleType       = 'positive' | 'negative'
export type ExampleSourceType = 'mined' | 'generated' | 'manual'
export type RagTemplateStatus = 'draft' | 'pending' | 'approved' | 'rejected'

// ─── 규칙 ──────────────────────────────────────────────────
export interface RagRule {
  id: string
  document_id?: string
  chunk_id?: string
  user_id: string
  rule_text: string
  category: RuleCategory
  confidence: number            // 0.0 ~ 1.0
  source_quote?: string         // 원본 인용
  extraction_method: ExtractionMethod
  metadata?: Record<string, unknown>
  created_at: string
  updated_at: string
}

// ─── 예시 ──────────────────────────────────────────────────
export interface RagExample {
  id: string
  rule_id: string
  user_id: string
  example_type: ExampleType
  example_text: string
  diff_hint?: string            // 차이점 설명
  source_type: ExampleSourceType
  source_chunk_id?: string
  confidence: number
  metadata?: Record<string, unknown>
  created_at: string
}

// ─── 템플릿 ────────────────────────────────────────────────
export interface RagTemplate {
  id: string
  tenant_id?: string
  user_id: string
  document_id?: string
  name: string
  description?: string
  version: number
  status: RagTemplateStatus
  is_public: boolean
  criteria_json: unknown[]      // TemplateSchema[]
  approved_at?: string
  approved_by?: string
  rejection_reason?: string
  created_at: string
  updated_at: string
}
```

---

### 1.9 Criteria Pack

파일: `frontend/src/types/rag/criteria.ts`

```typescript
// ─── 검색된 청크 ───────────────────────────────────────────
export interface RetrievedChunk {
  chunk_id: string
  content: string
  score: number                 // 유사도 점수
  source: {
    document_id: string
    page?: number
    section?: string
  }
}

// ─── 기준별 검색 쿼리 ──────────────────────────────────────
export interface CriteriaPackQueries {
  rule_query: string            // 규칙 검색 쿼리
  example_query: string         // 예시 검색 쿼리
  pattern_query: string         // 패턴 검색 쿼리
}

// ─── 기준별 증거 ───────────────────────────────────────────
export interface CriteriaPackEvidence {
  rules: RetrievedChunk[]
  examples: RetrievedChunk[]
  patterns: RetrievedChunk[]
}

// ─── 게이트 체크 결과 ──────────────────────────────────────
export interface CriteriaPackGates {
  citation_verified: boolean
  retrieval_sufficient: boolean
}

// ─── 메타데이터 ────────────────────────────────────────────
export interface CriteriaPackMetadata {
  created_at: string
  search_duration_ms: number
}

// ─── Criteria Pack V2 ──────────────────────────────────────
export interface CriteriaPackV2 {
  criteria_id: string
  queries: CriteriaPackQueries
  evidence: CriteriaPackEvidence
  gates: CriteriaPackGates
  metadata: CriteriaPackMetadata
}

// ─── 기본값 생성 함수 ──────────────────────────────────────
export function createDefaultCriteriaPackV2(criteriaId: string): CriteriaPackV2
```

---

### 1.10 Telemetry

파일: `frontend/src/types/telemetry.ts`

```typescript
// ─── 텔레메트리 스텝 ───────────────────────────────────────
export type TelemetryStep = 'search' | 'rerank' | 'answer' | 'review' | 'citation'
export type TelemetryRunType = 'build' | 'judge'

// ─── 텔레메트리 레코드 ─────────────────────────────────────
export interface TelemetryRecord {
  runId: string
  userId: string
  step: TelemetryStep
  runType?: TelemetryRunType
  startTime: number
  endTime: number
  latencyMs: number
  modelId?: string
  tokensIn: number
  tokensOut: number
  costEstimate: number
  success: boolean
  errorCode?: string
}

// ─── 모델 비용 ─────────────────────────────────────────────
export const MODEL_COSTS: Record<string, { input: number; output: number }>

// ─── 비용 추정 함수 ────────────────────────────────────────
export function estimateCost(modelId: string, tokensIn: number, tokensOut: number): number
```

---

### 1.11 LLM Model Config

파일: `frontend/src/config/models.ts`

```typescript
// ─── 모델 능력 ─────────────────────────────────────────────
export type ModelCapability =
  | 'text-generation'
  | 'streaming'
  | 'vision'
  | 'reasoning'
  | 'thinking'
  | 'search-grounding'
  | 'code-execution'

// ─── 모델 설정 ─────────────────────────────────────────────
export interface ModelConfig {
  provider: 'gemini' | 'openai' | 'anthropic'
  displayName: string
  capabilities: ModelCapability[]
  costPerInputToken: number     // USD per token
  costPerOutputToken: number    // USD per token
  maxTokens: number             // 최대 출력 토큰
  inputContextWindow?: number   // 입력 컨텍스트 윈도우
  isDefault?: boolean
  tier?: 'free' | 'premium' | 'developer'
  enabled?: boolean
}

// ─── 등록된 모델 레지스트리 (요약) ─────────────────────────
export const MODEL_REGISTRY: Record<string, ModelConfig>
```

**전체 모델 목록**

| Model ID | Provider | Display Name | Tier | maxTokens | Context Window |
|----------|----------|-------------|------|-----------|----------------|
| `gemini-1.5-flash-002` | gemini | gemini-1.5-flash-002 | free | 8,192 | 1,048,576 |
| `gemini-3-flash-preview` | gemini | Gemini 3.0 Flash Preview | developer | 65,536 | 1,048,576 |
| `gemini-3-pro-preview` | gemini | Gemini 3 Pro Preview | premium | 32,768 | - |
| `gemma-3-27b-it` | gemini | Gemma 3 27B IT | premium | 8,192 | 128,000 |
| `gemma-3-12b-it` | gemini | Gemma 3 12B IT | free | 8,192 | 128,000 |
| `gemma-3-4b-it` | gemini | Gemma 3 4B IT | free | 8,192 | 128,000 |
| `gemma-3-2b-it` | gemini | Gemma 3 2B IT (3n) | free | 8,192 | 32,000 |
| `gemma-3-1b-it` | gemini | Gemma 3 1B IT | free | 8,192 | 32,000 |
| `gpt-5.2-2025-12-11` | openai | GPT-5.2 | premium | 128,000 | 400,000 |
| `gpt-5-mini-2025-08-07` | openai | GPT-5 mini | free | 128,000 | 400,000 |
| `gpt-5-mini` | openai | GPT-5 mini (Latest) | free | 128,000 | 400,000 |
| `claude-opus-4-5-20251101` | anthropic | Claude 4.5 Opus | premium | 128,000 | 200,000 |
| `claude-sonnet-4-5-20250929` | anthropic | Claude 4.5 Sonnet | premium | 128,000 | 200,000 |
| `claude-haiku-4-5-20251001` | anthropic | Claude 4.5 Haiku | free | 128,000 | 200,000 |

**유틸리티 함수**

```typescript
export function isValidModelId(id: string): id is ValidModelId
export function getModelConfig(modelId: string): ModelConfig | undefined
export function getDefaultModelId(): string
export function getEnabledModels(): string[]
export function getModelsByProvider(provider: string): string[]
export function estimateModelCost(modelId: string, inputTokens: number, outputTokens: number): number
```

---

### 1.12 Judge Result Types

파일: `frontend/src/lib/judge/types.ts`

```typescript
// ─── Align Judge 결과 ──────────────────────────────────────
export interface JudgeResult {
  criteria_id: string
  status: 'pass' | 'fail' | 'partial'
  reasoning: string
  citation?: string             // ENABLE_SOURCE_CITATIONS 플래그 활성 시
}

// ─── 업그레이드 계획 ───────────────────────────────────────
export interface UpgradePlan {
  criteria_id: string
  current_status: string
  suggestion: string
  priority: number
}

// ─── 종합 평가 결과 ────────────────────────────────────────
export interface HolisticEvaluationResult {
  summaryA: HolisticSummary
  adviceB: AreaAdvice
  scoreC: DetailedScore
  evaluated_at: string
  category: string
}

export interface HolisticSummary {
  overview: string              // 100~200자 종합 피드백
}

export interface AreaAdvice {
  structure: string             // 구조 조언
  content: string               // 내용 조언
  expression: string            // 표현 조언
}

export interface DetailedScore {
  overall: number               // 0 ~ 100
  breakdown: {
    structure: number
    content: number
    expression: number
    logic: number
    trust: number
    persuasion: number
  }
  actionItems: string[]         // 3~5개 실행 가능한 개선 항목
}

// ─── 평가 결과 (V3) ────────────────────────────────────────
export interface EvaluationResult {
  judgments: JudgeResult[]
  holisticEvaluation?: HolisticEvaluationResult
  templateId?: string
  category?: string
  evaluatedAt: string
}
```

---

## 2. Database Schema

### 2.1 profiles

```sql
-- Supabase Auth 연동 프로필
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  display_name TEXT,
  role TEXT DEFAULT 'pending'
    CHECK (role IN ('pending', 'free', 'premium', 'special', 'admin')),
  tier TEXT DEFAULT 'free',
  is_approved BOOLEAN DEFAULT false,
  subscription_expires_at TIMESTAMPTZ,
  monthly_token_limit INT DEFAULT 500000,
  daily_request_limit INT DEFAULT 50,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

---

### 2.2 projects

```sql
CREATE TABLE IF NOT EXISTS public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT DEFAULT '📁',
  status TEXT DEFAULT 'active'
    CHECK (status IN ('active', 'archived')),
  setup_completed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 인덱스
CREATE INDEX idx_projects_user ON public.projects(user_id);
CREATE INDEX idx_projects_status ON public.projects(user_id, status);
CREATE INDEX idx_projects_updated ON public.projects(user_id, updated_at DESC);
CREATE INDEX idx_projects_setup_completed ON public.projects(user_id, setup_completed);
```

---

### 2.3 user_documents

```sql
CREATE TABLE public.user_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT '제목 없음',
  content TEXT NOT NULL DEFAULT '',
  category TEXT DEFAULT 'General',
  sort_order INT,
  metadata JSONB DEFAULT '{}',
  source TEXT,
  file_path TEXT,
  file_type TEXT,
  file_size BIGINT,
  status TEXT DEFAULT 'pending',
  error_message TEXT,
  started_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 인덱스
CREATE INDEX idx_user_documents_user_id ON public.user_documents(user_id);
CREATE INDEX idx_user_documents_updated_at ON public.user_documents(updated_at DESC);
CREATE INDEX idx_user_documents_project ON public.user_documents(project_id);

-- 자동 updated_at 트리거
CREATE TRIGGER user_documents_updated_at
  BEFORE UPDATE ON public.user_documents
  FOR EACH ROW EXECUTE FUNCTION update_user_documents_updated_at();
```

---

### 2.4 rag_chunks

```sql
CREATE TABLE public.rag_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES public.user_documents(id) ON DELETE CASCADE,
  chunk_index INT NOT NULL,
  content TEXT NOT NULL,
  embedding vector(1536),           -- pgvector (text-embedding-3-small)
  metadata JSONB DEFAULT '{}',
  chunk_type TEXT,                   -- 'rule' | 'example' | 'general'
  embedding_model_id TEXT,
  embedding_dim INT,
  embedded_at TIMESTAMPTZ,
  tenant_id UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 벡터 검색 인덱스 (IVFFlat)
CREATE INDEX idx_rag_chunks_embedding ON public.rag_chunks
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

CREATE INDEX idx_rag_chunks_document_id ON public.rag_chunks(document_id);
```

**벡터 검색 RPC 함수**

```sql
CREATE OR REPLACE FUNCTION match_document_chunks(
  query_embedding vector(1536),
  match_threshold float,
  match_count int,
  user_id_param uuid,
  category_param text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  document_id uuid,
  content text,
  metadata jsonb,
  similarity float
)
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT
    rc.id, rc.document_id, rc.content, rc.metadata,
    1 - (rc.embedding <=> query_embedding) AS similarity
  FROM rag_chunks rc
  JOIN user_documents ud ON rc.document_id = ud.id
  WHERE ud.user_id = user_id_param
    AND 1 - (rc.embedding <=> query_embedding) > match_threshold
    AND (category_param IS NULL OR ud.category = category_param)
  ORDER BY rc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
```

---

### 2.5 chat_sessions & chat_messages

```sql
-- 채팅 세션
CREATE TABLE public.chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  title TEXT DEFAULT '새 대화',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_chat_sessions_user ON public.chat_sessions(user_id);
CREATE INDEX idx_chat_sessions_project ON public.chat_sessions(project_id);

-- 채팅 메시지
CREATE TABLE public.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.chat_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  model TEXT,                        -- 사용된 LLM 모델 ID
  metadata JSONB DEFAULT '{}',       -- 인용, 토큰 수 등
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_chat_messages_session ON public.chat_messages(session_id);
CREATE INDEX idx_chat_messages_created ON public.chat_messages(created_at);
```

---

### 2.6 evaluation_logs

```sql
CREATE TABLE public.evaluation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  document_text_hash TEXT,           -- 중복 방지용 해시
  result_data JSONB NOT NULL DEFAULT '{}',
  overall_score NUMERIC(5,2),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_evaluation_logs_user_id ON public.evaluation_logs(user_id);
CREATE INDEX idx_evaluation_logs_created_at ON public.evaluation_logs(created_at DESC);
CREATE INDEX idx_evaluation_logs_hash ON public.evaluation_logs(document_text_hash);
CREATE INDEX idx_evaluation_logs_project ON public.evaluation_logs(project_id);
```

---

### 2.7 rag_rules

```sql
CREATE TABLE IF NOT EXISTS public.rag_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES public.user_documents(id) ON DELETE CASCADE,
  chunk_id UUID REFERENCES public.rag_chunks(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rule_text TEXT NOT NULL,
  category TEXT NOT NULL,            -- 'structure' | 'expression' | 'tone' | 'prohibition'
  confidence FLOAT DEFAULT 1.0,
  source_quote TEXT,
  extraction_method TEXT DEFAULT 'llm',  -- 'llm' | 'manual' | 'rule-based'
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_rag_rules_user_id ON public.rag_rules(user_id);
CREATE INDEX idx_rag_rules_document_id ON public.rag_rules(document_id);
CREATE INDEX idx_rag_rules_category ON public.rag_rules(category);
```

---

### 2.8 rag_examples

```sql
CREATE TABLE IF NOT EXISTS public.rag_examples (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id UUID REFERENCES public.rag_rules(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  example_type TEXT NOT NULL
    CHECK (example_type IN ('positive', 'negative')),
  example_text TEXT NOT NULL,
  diff_hint TEXT,
  source_type TEXT DEFAULT 'mined'
    CHECK (source_type IN ('mined', 'generated', 'manual')),
  source_chunk_id UUID REFERENCES public.rag_chunks(id) ON DELETE SET NULL,
  confidence FLOAT DEFAULT 1.0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_rag_examples_rule_id ON public.rag_examples(rule_id);
CREATE INDEX idx_rag_examples_user_id ON public.rag_examples(user_id);
CREATE INDEX idx_rag_examples_type ON public.rag_examples(example_type);
```

---

### 2.9 rag_templates

```sql
CREATE TABLE IF NOT EXISTS public.rag_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  document_id UUID REFERENCES public.user_documents(id) ON DELETE SET NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  version INT DEFAULT 1,
  status TEXT DEFAULT 'draft'
    CHECK (status IN ('draft', 'pending', 'approved', 'rejected')),
  is_public BOOLEAN DEFAULT false,
  criteria_json JSONB NOT NULL DEFAULT '[]',
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES auth.users(id),
  rejection_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_rag_templates_user_id ON public.rag_templates(user_id);
CREATE INDEX idx_rag_templates_status ON public.rag_templates(status);
CREATE INDEX idx_rag_templates_document_id ON public.rag_templates(document_id);
CREATE INDEX idx_rag_templates_project ON public.rag_templates(project_id);
```

---

### 2.10 raft_dataset

```sql
CREATE TABLE IF NOT EXISTS public.raft_dataset (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_query TEXT NOT NULL,
  context TEXT NOT NULL,
  gold_answer TEXT NOT NULL,
  bad_answer TEXT,
  source TEXT NOT NULL
    CHECK (source IN ('synthetic', 'user_feedback', 'manual', 'ab_test')),
  verified BOOLEAN NOT NULL DEFAULT false,
  model_id TEXT,
  original_feedback_id UUID REFERENCES public.hallucination_feedback(id),
  CONSTRAINT check_user_query_length CHECK (length(user_query) >= 10),
  CONSTRAINT check_gold_answer_length CHECK (length(gold_answer) >= 10)
);

-- 서비스 역할만 접근 가능
ALTER TABLE public.raft_dataset ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all access for service role only"
  ON public.raft_dataset FOR ALL
  USING (auth.role() = 'service_role');
```

---

### 2.11 project_trash (Phase 7)

```sql
-- Phase 7: 소프트 삭제 지원
-- projects 테이블에 deleted_at 컬럼 추가 또는 별도 trash 테이블 관리
-- 복원 API: PATCH /api/projects/[id]/restore
-- 영구 삭제: DELETE /api/projects/[id]/permanent
```

---

## 3. RLS 정책

모든 사용자 데이터 테이블에 Row-Level Security가 활성화되어 있습니다.

| 테이블 | 정책 패턴 |
|--------|-----------|
| `profiles` | `auth.uid() = id` |
| `projects` | `auth.uid() = user_id` |
| `user_documents` | `auth.uid() = user_id` |
| `rag_chunks` | `JOIN user_documents`를 통한 간접 RLS |
| `chat_sessions` | `auth.uid() = user_id` |
| `chat_messages` | `auth.uid() = user_id` |
| `evaluation_logs` | `auth.uid() = user_id` + `service_role` 전체 접근 |
| `rag_rules` | `auth.uid() = user_id` |
| `rag_examples` | `auth.uid() = user_id` |
| `rag_templates` | SELECT: `auth.uid() = user_id OR is_public = true`, CUD: `auth.uid() = user_id` |
| `raft_dataset` | `service_role` 전용 |

---

## 4. 인덱스 전략

| 용도 | 테이블.컬럼 | 인덱스 타입 |
|------|-------------|-------------|
| 벡터 검색 | `rag_chunks.embedding` | IVFFlat (lists=100, cosine) |
| 사용자 필터 | 모든 테이블.`user_id` | B-tree |
| 프로젝트 필터 | 모든 테이블.`project_id` | B-tree |
| 시간순 정렬 | `*.created_at`, `*.updated_at` | B-tree DESC |
| 상태 필터 | `projects(user_id, status)` | Composite B-tree |
| 해시 조회 | `evaluation_logs.document_text_hash` | B-tree |
| 카테고리 필터 | `rag_rules.category` | B-tree |
