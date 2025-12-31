# 🚀 Phase 7: 아키텍처 안정화 및 성능 최적화 - 상세 구현 지시서

**작성일**: 2025-12-31 23:10
**작성자**: Tech Lead (15년차)
**문서 ID**: PHASE7-IMPLEMENTATION-2025-1231
**관련 문서**:
- [2512312300_Architecture_Optimization_Checklist.md](./2512312300_Architecture_Optimization_Checklist.md)
- [2512312250_Phase5_6_Deployment_Walkthrough.md](./2512312250_Phase5_6_Deployment_Walkthrough.md)

---

## 📌 Executive Summary

Phase 5, 6 배포 후 식별된 잠재적 불안정 요소(406/500 에러)를 사전에 방지하고, Chat API의 TTFT(Time To First Token)를 최적화합니다.

### 현재 코드 상태 분석

| 파일 | 현재 상태 | 개선 필요 |
|------|----------|----------|
| `lib/supabase/client.ts` | schema/headers 미설정 | Accept-Profile 헤더 추가 |
| `lib/rag/search.ts` | try-catch 있으나 retry 없음 | Exponential Backoff Retry 추가 |
| `api/chat/route.ts` | 일부 병렬화만 적용 | RAG+Template 완전 병렬화 |
| `api/rag/evaluate-holistic/route.ts` | projectId 지원됨 | 저장 시 project_id 명시적 처리 |

---

## [Phase 7.1: Critical 에러 해결 및 안정화]

**Before Start:**

- ⚠️ **주의**: `createBrowserClient` 설정 변경은 모든 클라이언트 컴포넌트에 영향. 로컬 테스트 필수.
- ⚠️ **레거시 보호**: 기존 `supabase.rpc()` 호출 시그니처 변경 금지.

---

### [ ] **ID(P7-01)**: Supabase 406 (Not Acceptable) 에러 방지 설정

- **Target**: `frontend/src/lib/supabase/client.ts` > `createClient()`
- **Logic (Pseudo)**:
  ```typescript
  // =============================================================
  // [P7-01] Supabase 클라이언트 안정화 설정
  // 406 에러 방지: Accept 헤더 명시, schema 고정
  // =============================================================

  export const createClient = () => {
    if (!supabaseUrl || !supabaseAnonKey) {
      console.warn('[Supabase] 환경 변수가 설정되지 않았습니다.')
      return createBrowserClient('https://placeholder.supabase.co', 'placeholder-key')
    }

    // [P7-01] 안정화 옵션 추가
    return createBrowserClient(supabaseUrl, supabaseAnonKey, {
      db: { schema: 'public' },
      global: {
        headers: {
          'Accept': 'application/json',
          'Accept-Profile': 'public',
          'Content-Profile': 'public'
        }
      }
    })
  }
  ```
- **Key Variables**:
  ```
  schema         : 'public'           // DB 스키마 명시
  Accept         : 'application/json' // 응답 포맷 명시
  Accept-Profile : 'public'           // Supabase schema 헤더
  Content-Profile: 'public'           // POST 요청 시 필요
  ```
- **Safety**:
  - ✅ 기존 반환 타입 유지 (SupabaseClient)
  - ✅ 환경 변수 누락 시 기존 fallback 유지
  - ⚠️ 변경 후 `/dashboard`, `/editor` 페이지에서 데이터 로딩 테스트

---

### [ ] **ID(P7-02)**: Vector Search 500 에러 복원력 강화 (Retry + Graceful Degradation)

- **Target**: `frontend/src/lib/rag/search.ts` > `vectorSearch()`
- **Logic (Pseudo)**:
  ```typescript
  // =============================================================
  // [P7-02] Retry 유틸리티 함수 (search.ts 상단에 추가)
  // =============================================================
  const MAX_RETRY_COUNT = 3
  const INITIAL_BACKOFF_MS = 200

  async function withRetry<T>(
    operation: () => Promise<T>,
    context: string
  ): Promise<T> {
    let lastError: Error | null = null

    for (let attempt = 1; attempt <= MAX_RETRY_COUNT; attempt++) {
      try {
        return await operation()
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err))
        console.warn(`[${context}] Attempt ${attempt}/${MAX_RETRY_COUNT} failed:`, lastError.message)

        if (attempt < MAX_RETRY_COUNT) {
          // Exponential Backoff: 200ms, 400ms, 800ms
          const backoffMs = INITIAL_BACKOFF_MS * Math.pow(2, attempt - 1)
          await new Promise(resolve => setTimeout(resolve, backoffMs))
        }
      }
    }

    throw lastError // 모든 시도 실패
  }

  // =============================================================
  // [P7-02] vectorSearch 수정 (line 161 근처)
  // =============================================================
  export async function vectorSearch(
    query: string,
    options: SearchOptions
  ): Promise<SearchResult[]> {
    const { userId, topK = DEFAULT_TOP_K, ... } = options

    // [P7-02] 임베딩 생성 with Retry
    let queryEmbedding: number[]
    try {
      queryEmbedding = await withRetry(
        () => embedText(query.trim()),
        'embedText'
      )

      // 차원 검증 (OpenAI: 1536, text-embedding-3-small)
      if (!queryEmbedding || queryEmbedding.length !== 1536) {
        throw new Error(`Invalid embedding dimension: ${queryEmbedding?.length}`)
      }
    } catch (err) {
      console.error('[vectorSearch] Embedding failed after retries:', err)
      return [] // Graceful Degradation: 빈 결과 반환
    }

    // [P7-02] RPC 호출 with Retry
    try {
      const { data, error } = await withRetry(
        () => supabase.rpc('match_document_chunks', {
          query_embedding: queryEmbedding,
          match_threshold: minScore,
          match_count: topK,
          user_id_param: userId,
          category_param: category || null
        }),
        'match_document_chunks'
      )

      if (error) throw error

      // ... 기존 결과 포맷팅 로직 유지 ...

    } catch (err) {
      console.error('[vectorSearch] RPC failed after retries:', err)
      return [] // 500 에러 대신 빈 결과 반환
    }
  }
  ```
- **Key Variables**:
  ```
  MAX_RETRY_COUNT     : 3     // 최대 재시도 횟수
  INITIAL_BACKOFF_MS  : 200   // 초기 대기 시간 (ms)
  EMBEDDING_DIMENSION : 1536  // OpenAI text-embedding 차원
  ```
- **Safety**:
  - ✅ 모든 외부 호출(embedText, supabase.rpc)에 try-catch + retry 적용
  - ✅ 차원 검증으로 잘못된 임베딩 방지
  - ✅ 실패 시 빈 배열 반환으로 서비스 유지 (500 에러 방지)
  - ⚠️ 디버그 시 `[vectorSearch]` prefix 로그 확인

---

## [Phase 7.2: 성능 최적화 (Chat TTFT 개선)]

**Before Start:**

- ⚠️ **주의**: 스트리밍 응답 중 연결 끊김 시 리소스 정리 확인 필요
- ⚠️ **측정 기준**: TTFT = 요청 전송 ~ 첫 번째 토큰 수신까지의 시간

---

### [ ] **ID(P7-03)**: Chat API 병렬화로 TTFT 2초 이내 단축

- **Target**: `frontend/src/app/api/chat/route.ts` > `POST()`
- **Logic (Pseudo)**:
  ```typescript
  // =============================================================
  // [P7-03] 병렬 처리 최적화 (line 53 POST 함수 내부)
  // 기존: Memory → Template → RAG (순차)
  // 개선: Memory + Template + RAG (병렬)
  // =============================================================

  export async function POST(req: NextRequest) {
    // ... 기존 요청 파싱 로직 유지 ...

    // [P7-03] 성능 측정 시작
    const startTime = performance.now()

    // -------------------------------------------------------------------------
    // [P7-03] 병렬 처리: Memory, Template, RAG 동시 실행
    // -------------------------------------------------------------------------
    const [memoryResult, templateContext, ragResults] = await Promise.all([
      // 1. Memory Search (기존 memoryPromise 로직)
      userId
        ? MemoryService.searchPreferences(userId, query, 3, 0.72, categoryFilter)
            .catch(err => {
              console.warn('[Chat API] Memory search failed:', err)
              return []
            })
        : Promise.resolve([]),

      // 2. Template Context Search (기존 templateContext 로직)
      (async () => {
        if (!FEATURE_FLAGS.USE_TEMPLATE_FOR_CHAT || !userId) return ''
        try {
          const { data: templateData } = await supabase
            .from('rag_templates')
            .select('criteria_json, name')
            .eq('user_id', userId)
            .eq('status', 'approved')
            .limit(1)
            .single()

          if (!templateData?.criteria_json) return ''

          const templates = templateData.criteria_json as TemplateSchema[]
          const relevantTemplates = templates
            .filter(t => query.includes(t.category) ||
                        t.rationale.toLowerCase().includes(query.toLowerCase().split(' ')[0]))
            .slice(0, 2)

          return relevantTemplates.map(t => {
            let ctx = `[평가 기준: ${t.rationale}]`
            if (t.positive_examples.length > 0) ctx += `\n좋은 예: ${t.positive_examples[0]}`
            if (t.negative_examples.length > 0) ctx += `\n나쁜 예: ${t.negative_examples[0]}`
            return ctx
          }).join('\n\n')
        } catch (err) {
          console.warn('[Chat API] Template fetch failed:', err)
          return ''
        }
      })(),

      // 3. RAG Search (기존 hybridSearch 로직)
      (async () => {
        try {
          return await hybridSearch(query, {
            userId: userId || 'anonymous',
            topK: 5,
            category: categoryFilter
          })
        } catch (err) {
          console.warn('[Chat API] RAG search failed:', err)
          return []
        }
      })()
    ])

    // [P7-03] 병렬 처리 완료 시간 로깅
    const parallelTime = performance.now() - startTime
    console.log(`[Chat API] Parallel fetch completed in ${parallelTime.toFixed(0)}ms`)

    // ... 기존 컨텍스트 조합 및 LLM 호출 로직 ...

    // [P7-03] LLM 스트리밍 시작 시 TTFT 로깅
    const stream = await generateTextStream({ ... })
    const ttft = performance.now() - startTime
    console.log(`[Chat API] TTFT: ${ttft.toFixed(0)}ms`)

    return stream
  }
  ```
- **Key Variables**:
  ```
  startTime    : number // performance.now() 시작 시점
  parallelTime : number // 병렬 처리 완료까지 시간
  ttft         : number // Time To First Token (목표: <2000ms)
  ```
- **Safety**:
  - ✅ 각 Promise에 개별 catch 블록으로 단일 실패가 전체 영향 방지
  - ✅ 실패 시 빈 배열/문자열 반환으로 LLM 호출은 항상 진행
  - ⚠️ 성능 로그에서 `[Chat API] TTFT:` 확인하여 2000ms 이하 검증

---

## [Phase 7.3: 프로젝트 기반 데이터 무결성 검증]

**Before Start:**

- ⚠️ **주의**: `evaluation_logs` 테이블에 `project_id` 컬럼 존재 확인 (Phase 5에서 추가됨)
- ⚠️ **CASCADE 주의**: 프로젝트 삭제 시 연관 평가 로그도 삭제됨

---

### [ ] **ID(P7-04)**: 종합 평가 API projectId 필수 처리 및 저장 검증

- **Target**: `frontend/src/app/api/rag/evaluate-holistic/route.ts` > `POST()`
- **Logic (Pseudo)**:
  ```typescript
  // =============================================================
  // [P7-04] projectId 처리 로직 개선 (line 80 근처)
  // =============================================================

  // 요청 바디 파싱
  const body: HolisticEvaluateRequest = await request.json()
  let { userText, category, topK = DEFAULT_TOP_K, projectId } = body

  // -------------------------------------------------------------------------
  // [P7-04] projectId 미제공 시 기본 프로젝트 할당
  // -------------------------------------------------------------------------
  if (!projectId) {
    // 사용자의 첫 번째(기본) 프로젝트 조회
    const { data: defaultProject, error: projectError } = await supabase
      .from('projects')
      .select('id')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
      .limit(1)
      .single()

    if (projectError || !defaultProject) {
      console.warn('[Holistic Evaluate API] No default project found, proceeding without projectId')
      // projectId null로 진행 (하위 호환)
    } else {
      projectId = defaultProject.id
      console.log(`[Holistic Evaluate API] Using default project: ${projectId}`)
    }
  }

  // -------------------------------------------------------------------------
  // [P7-04] projectId 소유권 검증 (보안 강화)
  // -------------------------------------------------------------------------
  if (projectId) {
    const { data: projectOwnership, error: ownerError } = await supabase
      .from('projects')
      .select('id')
      .eq('id', projectId)
      .eq('user_id', userId)
      .single()

    if (ownerError || !projectOwnership) {
      return NextResponse.json(
        { success: false, message: '해당 프로젝트에 대한 권한이 없습니다.' },
        { status: 403 }
      )
    }
  }

  // ... 기존 평가 로직 ...

  // -------------------------------------------------------------------------
  // [P7-04] 평가 결과 저장 시 project_id 명시적 포함
  // -------------------------------------------------------------------------
  const { data: savedLog, error: saveError } = await supabase
    .from('evaluation_logs')
    .insert({
      user_id: userId,
      project_id: projectId || null,  // [P7-04] 명시적 null 처리
      category: category,
      user_text: userText.substring(0, 1000),  // 최대 1000자
      result_json: evaluationResult,
      overall_score: evaluationResult.overallScore,
      created_at: new Date().toISOString()
    })
    .select('id')
    .single()

  if (saveError) {
    console.error('[Holistic Evaluate API] Save failed:', saveError)
    // 저장 실패해도 평가 결과는 반환 (Graceful Degradation)
  } else {
    console.log(`[Holistic Evaluate API] Saved log: ${savedLog.id}`)
  }
  ```
- **Key Variables**:
  ```
  projectId       : string | null  // 프로젝트 ID (선택적)
  defaultProject  : { id: string } // 기본 프로젝트
  projectOwnership: { id: string } // 소유권 검증 결과
  ```
- **Safety**:
  - ✅ projectId 미제공 시 기본 프로젝트 자동 할당
  - ✅ 타인 프로젝트 접근 시 403 Forbidden 반환
  - ✅ 저장 실패 시에도 평가 결과는 클라이언트에 반환
  - ⚠️ RLS 정책이 이미 `auth.uid() = user_id`로 설정되어 있으므로 이중 보안

---

## ✅ Definition of Done (검증)

### 기능 검증

- [ ] **Test (P7-01)**: 대시보드 페이지 새로고침 시 Supabase 요청에 406 에러 없음 (Network 탭 확인)
- [ ] **Test (P7-02)**: 임베딩 서버 일시 장애 시뮬레이션 → Chat/평가에서 빈 결과 반환 (500 에러 없음)
- [ ] **Test (P7-03)**: Chat API TTFT 5회 측정 평균 **< 2000ms** (콘솔 로그 확인)
- [ ] **Test (P7-04)**: projectId 없이 평가 API 호출 시 기본 프로젝트에 저장됨 (DB 확인)

### 보안 검증

- [ ] **Test (RLS)**: 사용자 A의 프로젝트 ID로 사용자 B가 평가 API 호출 시 403 반환
- [ ] **Test (Isolation)**: 프로젝트 A의 평가 로그가 프로젝트 B에서 조회되지 않음

### 코드 품질

- [ ] **Review**: 모든 `await`에 try-catch 또는 Promise.catch 적용 확인
- [ ] **Review**: `console.log` → 운영 환경에서 제거 또는 조건부 로깅으로 변경
- [ ] **Review**: TypeScript `--noEmit` 에러 0개

---

## 📊 예상 소요 시간

| ID     | 작업 내용                      | 파일                        | 예상 시간 |
|--------|-------------------------------|----------------------------|----------|
| P7-01  | Supabase 클라이언트 헤더 설정   | `lib/supabase/client.ts`   | 30분     |
| P7-02  | Vector Search Retry 로직       | `lib/rag/search.ts`        | 2시간    |
| P7-03  | Chat API 병렬화 및 TTFT 측정   | `api/chat/route.ts`        | 3시간    |
| P7-04  | evaluate-holistic projectId    | `api/rag/evaluate-holistic/route.ts` | 1.5시간 |
| 검증    | 통합 테스트 및 성능 측정        | -                          | 2시간    |
| **총계** |                               |                            | **9시간** |

---

## 🔗 참고 파일 경로

```
frontend/src/
├── lib/
│   ├── supabase/
│   │   └── client.ts        # P7-01 타겟
│   └── rag/
│       └── search.ts        # P7-02 타겟
└── app/api/
    ├── chat/
    │   └── route.ts         # P7-03 타겟
    └── rag/
        └── evaluate-holistic/
            └── route.ts     # P7-04 타겟
```

---

> **최종 승인**: Tech Lead
> **담당 개발자**: 시니어/주니어 협업
> **버전**: v1.0 (2025-12-31)
> **상태**: 📋 구현 대기
