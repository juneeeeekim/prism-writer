# Architecture Refactoring 후속 과제 - 구현 지시서

**작성일**: 2025-12-31 21:01  
**작성자**: Tech Lead (15년차)  
**문서 ID**: REFACTOR-FOLLOWUP-2025-1231  
**우선순위**: P1 (High Priority Issues) → P2 (Medium) → P3 (Low)  
**원본 문서**: [2512312240_Architecture_Refactoring_Walkthrough.md](./2512312240_Architecture_Refactoring_Walkthrough.md)

---

## Executive Summary

Architecture Refactoring (Phase 0~4) 완료 후 발견된 Critical 이슈와 후속 과제를 정리한 구현 지시서입니다.

### 우선순위별 과제 요약

| 우선순위    | 과제                           | 예상 소요 | 담당     |
| ----------- | ------------------------------ | --------- | -------- |
| 🔴 **P1**   | Supabase 406/500 에러 해결     | 2-4시간   | Backend  |
| 🔴 **P1**   | Vector Search 500 에러         | 2시간     | Backend  |
| 🟠 **P2**   | Chat TTFT 최적화 (5.5초 → 2초) | 3-4시간   | Backend  |
| 🟠 **P2**   | 평가 API 간헐적 에러 수정      | 2시간     | Backend  |
| ✅ **완료** | 멀티 프로젝트 시스템 (Phase 5) | -         | -        |
| 🟡 **P3**   | Template Builder UI            | 2-3일     | Frontend |
| 🟡 **P3**   | Gate-Keeper 자동화             | 1-2일     | Backend  |

---

## Phase 1: Critical 이슈 해결 (P1)

**Before Start:**

- ⚠️ **주의**: 프로덕션 데이터베이스에 직접 영향을 미침
- ⚠️ **회귀 테스트 포인트**:
  - 기존 평가 API (`/api/rag/evaluate`, `/api/rag/evaluate-holistic`)
  - RAG 검색 API (`/api/rag/search`)
  - LLM 사용량 추적 기능
- ⚠️ **건드리지 말아야 할 것**:
  - `rag_chunks` 테이블 구조
  - `rag_templates` 테이블 구조
  - 기존 RLS 정책

**Implementation Items:**

### [ ] **P1-01**: Supabase 406 에러 조사 및 해결

- **Target**: `Supabase Dashboard` > `Table Editor` > `llm_daily_usage`, `llm_usage_summary`
- **증상**: API 호출 시 406 (Not Acceptable) 에러 발생
- **Logic (Pseudo)**:

  ```sql
  -- Step 1: 테이블 존재 여부 확인
  SELECT EXISTS (
      SELECT FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name IN ('llm_daily_usage', 'llm_usage_summary')
  );

  -- Step 2: RLS 정책 확인
  SELECT
      schemaname,
      tablename,
      policyname,
      permissive,
      roles,
      cmd,
      qual
  FROM pg_policies
  WHERE tablename IN ('llm_daily_usage', 'llm_usage_summary');

  -- Step 3: 문제 해결 (RLS 정책 없으면 생성)
  -- 예상 원인: RLS 활성화되었지만 정책 없음

  -- llm_daily_usage RLS 정책 생성
  CREATE POLICY "Users can view their own usage"
  ON llm_daily_usage
  FOR SELECT
  USING (auth.uid() = user_id);

  CREATE POLICY "Users can insert their own usage"
  ON llm_daily_usage
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

  -- llm_usage_summary RLS 정책 생성
  CREATE POLICY "Users can view their own summary"
  ON llm_usage_summary
  FOR SELECT
  USING (auth.uid() = user_id);
  ```

- **Key Variables**:

  ```
  llm_daily_usage     : TABLE  -- 일별 LLM 사용량
  llm_usage_summary   : TABLE  -- LLM 사용량 요약
  user_id             : UUID   -- 사용자 식별자 (RLS 기준)
  ```

- **Safety**:

  - ✅ 조회 쿼리로 먼저 상태 확인
  - ⚠️ RLS 정책 생성 전 기존 정책 확인
  - ⚠️ `DROP POLICY IF EXISTS` 사용하여 중복 방지

- **Expected Output**:
  ```
  406 에러 → 200 OK
  ```

---

### [ ] **P1-02**: Vector Search 500 에러 조사 및 해결

- **Target**: `frontend/src/app/api/rag/search/route.ts`
- **증상**: `/api/rag/search` 호출 시 500 Internal Server Error
- **Logic (Pseudo)**:

  ```typescript
  // Step 1: 현재 코드 분석
  async function searchRAG(query: string, projectId?: string) {
      try {
          // RPC 호출
          const { data, error } = await supabase.rpc('search_chunks_v3', {
              query_embedding: embedding,
              match_count: 10,
              filter_project_id: projectId  // null 처리 필요
          });

          if (error) {
              // 에러 로깅 추가
              console.error('[RAG Search] RPC error:', {
                  code: error.code,
                  message: error.message,
                  details: error.details,
                  hint: error.hint
              });
              throw error;
          }

          return data;
      } catch (err) {
          // 상세 에러 정보 반환
          return NextResponse.json({
              error: 'Search failed',
              details: err instanceof Error ? err.message : 'Unknown error'
          }, { status: 500 });
      }
  }

  // Step 2: RPC 함수 확인 (Supabase)
  -- search_chunks_v3 함수 존재 확인
  SELECT proname, proargnames, proargtypes
  FROM pg_proc
  WHERE proname = 'search_chunks_v3';

  -- Step 3: 임베딩 벡터 차원 확인
  SELECT
      attname,
      atttypmod
  FROM pg_attribute
  WHERE attrelid = 'rag_chunks'::regclass
    AND attname = 'embedding';
  ```

- **Key Variables**:

  ```
  query_embedding   : vector(1536)  -- OpenAI 임베딩 (1536차원)
  match_count       : integer       -- 반환할 결과 수
  filter_project_id : UUID | null   -- 프로젝트 필터 (optional)
  search_chunks_v3  : function      -- RPC 검색 함수
  ```

- **Safety**:

  - ✅ Try-Catch 필수
  - ✅ 상세 에러 로깅
  - ⚠️ RPC 함수 없으면 생성 필요
  - ⚠️ 임베딩 차원 불일치 확인

- **Expected Output**:
  ```
  500 에러 → 200 OK with search results
  ```

---

**Definition of Done (Phase 1):**

- [ ] Test: `llm_daily_usage` 테이블 조회 시 406 에러 없음
- [ ] Test: `llm_usage_summary` 테이블 조회 시 406 에러 없음
- [ ] Test: `/api/rag/search` API 호출 시 200 응답
- [ ] Test: 검색 결과가 정상적으로 반환됨
- [ ] Review: 에러 로깅 추가 확인
- [ ] Review: RLS 정책 문서 업데이트

---

## Phase 2: 성능 최적화 (P2)

**Before Start:**

- ⚠️ **주의**: 성능 측정 환경 일관성 유지
- ⚠️ **회귀 테스트 포인트**:
  - 채팅 응답 품질 저하 없어야 함
  - 평가 정확도 유지
- ⚠️ **건드리지 말아야 할 것**:
  - 프롬프트 내용 (성능 최적화만)
  - 기존 API 응답 형식

**Implementation Items:**

### [ ] **P2-01**: Chat TTFT 최적화 (5.5초 → 2초)

- **Target**: `frontend/src/app/api/rag/chat/route.ts`
- **현재 상태**: Time To First Token = 5.5초 (목표: 2초)
- **Logic (Pseudo)**:

  ```typescript
  // 성능 병목 분석
  async function handleChat(message: string) {
    const startTime = performance.now();

    // 병목 1: 임베딩 생성 (~200ms)
    const t1 = performance.now();
    const embedding = await createEmbedding(message);
    console.log(`[Perf] Embedding: ${performance.now() - t1}ms`);

    // 병목 2: RAG 검색 (~1500ms) ⚠️ 최적화 대상
    const t2 = performance.now();
    const chunks = await searchChunks(embedding, { limit: 10 });
    console.log(`[Perf] Search: ${performance.now() - t2}ms`);

    // 병목 3: 프롬프트 구성 (~50ms)
    const t3 = performance.now();
    const prompt = buildPrompt(message, chunks);
    console.log(`[Perf] Prompt: ${performance.now() - t3}ms`);

    // 병목 4: LLM 호출 (~3000ms) ⚠️ 스트리밍으로 개선
    const t4 = performance.now();
    const stream = await streamLLM(prompt);
    console.log(`[Perf] LLM TTFT: ${performance.now() - t4}ms`);

    console.log(`[Perf] Total: ${performance.now() - startTime}ms`);

    return stream;
  }

  // 최적화 방안
  // 1. RAG 검색 캐싱 (같은 질문 패턴)
  // 2. 청크 수 제한 (10 → 5)
  // 3. 프롬프트 길이 최적화
  // 4. 병렬 처리 (임베딩 + 템플릿 로드)
  ```

- **Key Variables**:

  ```
  TTFT                : number  -- Time To First Token (ms)
  embedding_time      : number  -- 임베딩 생성 시간
  search_time         : number  -- RAG 검색 시간
  llm_time            : number  -- LLM 응답 시간
  RAG_CHUNK_LIMIT     : 5       -- 청크 수 제한 (10 → 5)
  ```

- **Safety**:

  - ✅ 성능 로깅 필수
  - ⚠️ 청크 수 감소 시 응답 품질 확인
  - ⚠️ 캐싱 시 invalidation 전략 필요

- **Expected Output**:
  ```
  TTFT: 5500ms → 2000ms 이하
  ```

---

### [ ] **P2-02**: 평가 API 간헐적 에러 수정

- **Target**: `frontend/src/app/api/rag/evaluate/route.ts`
- **증상**: 간헐적으로 0점 반환 또는 에러
- **Logic (Pseudo)**:

  ```typescript
  async function evaluate(text: string, projectId?: string) {
    try {
      // Step 1: 입력 검증
      if (!text || text.trim().length === 0) {
        return { score: 0, reason: "Empty text provided" };
      }

      // Step 2: 템플릿 로드 (캐싱)
      const template = await loadTemplate(projectId);
      if (!template) {
        console.warn("[Evaluate] No template found, using default");
        // 기본 템플릿 사용
      }

      // Step 3: LLM 평가 (재시도 로직)
      const maxRetries = 3;
      let lastError: Error | null = null;

      for (let i = 0; i < maxRetries; i++) {
        try {
          const result = await callLLMForEvaluation(text, template);

          // Step 4: 결과 검증
          if (typeof result.score !== "number" || isNaN(result.score)) {
            throw new Error("Invalid score format");
          }

          return result;
        } catch (err) {
          lastError = err as Error;
          console.warn(`[Evaluate] Retry ${i + 1}/${maxRetries}:`, err);
          await sleep(1000 * (i + 1)); // exponential backoff
        }
      }

      throw lastError || new Error("Evaluation failed after retries");
    } catch (err) {
      console.error("[Evaluate] Error:", err);
      return {
        score: 0,
        reason: "Evaluation failed",
        error: err instanceof Error ? err.message : "Unknown error",
      };
    }
  }

  function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
  ```

- **Key Variables**:

  ```
  maxRetries      : 3        -- 최대 재시도 횟수
  backoff_base    : 1000     -- 기본 대기 시간 (ms)
  score           : number   -- 0-100 점수
  reason          : string   -- 평가 이유
  ```

- **Safety**:

  - ✅ 입력 검증 필수
  - ✅ 재시도 로직 (exponential backoff)
  - ✅ 결과 형식 검증
  - ⚠️ 최대 재시도 후에도 실패하면 0점 반환 (graceful degradation)

- **Expected Output**:
  ```
  간헐적 0점 → 안정적인 점수 반환
  ```

---

**Definition of Done (Phase 2):**

- [ ] Test: Chat TTFT ≤ 2000ms (평균 5회 측정)
- [ ] Test: 평가 API 연속 10회 호출 시 에러 0회
- [ ] Test: 응답 품질 저하 없음 확인 (수동)
- [ ] Review: 성능 로깅 코드 추가 확인
- [ ] Review: 재시도 로직 추가 확인

---

## Phase 3: 기능 확장 (P3)

**Before Start:**

- ⚠️ **주의**: 새 기능은 Feature Flag로 보호
- ⚠️ **회귀 테스트 포인트**: 기존 평가/채팅 기능
- ⚠️ **건드리지 말아야 할 것**: 기존 API 엔드포인트

**Implementation Items:**

### [ ] **P3-01**: Template Builder UI 구현

- **Target**: `frontend/src/app/template-builder/page.tsx` [NEW]
- **목표**: 평가 템플릿을 GUI로 관리
- **Logic (Pseudo)**:

  ```typescript
  // Component Structure
  export default function TemplateBuilderPage() {
    const [templates, setTemplates] = useState<RagTemplate[]>([]);
    const [selectedTemplate, setSelectedTemplate] =
      useState<RagTemplate | null>(null);
    const [isEditing, setIsEditing] = useState(false);

    // CRUD Operations
    const loadTemplates = useCallback(async () => {
      const { data, error } = await supabase
        .from("rag_templates")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setTemplates(data);
    }, []);

    const saveTemplate = async (template: RagTemplate) => {
      const { data, error } = await supabase
        .from("rag_templates")
        .upsert(template)
        .select()
        .single();

      if (error) throw error;
      await loadTemplates();
      return data;
    };

    const deleteTemplate = async (id: string) => {
      if (!confirm("정말 삭제하시겠습니까?")) return;

      const { error } = await supabase
        .from("rag_templates")
        .delete()
        .eq("id", id);

      if (error) throw error;
      await loadTemplates();
    };

    return (
      <div className="template-builder">
        <Sidebar templates={templates} onSelect={setSelectedTemplate} />
        <MainEditor template={selectedTemplate} onSave={saveTemplate} />
        <PreviewPanel template={selectedTemplate} />
      </div>
    );
  }
  ```

- **Key Variables**:

  ```
  RagTemplate         : interface  -- 템플릿 타입
  templates           : state      -- 템플릿 목록
  selectedTemplate    : state      -- 현재 선택된 템플릿
  isEditing           : state      -- 편집 모드 여부
  ```

- **Safety**:
  - ✅ 삭제 전 확인 다이얼로그
  - ✅ 저장 전 유효성 검사
  - ⚠️ 비활성 템플릿 보호 (active = false)

---

### [ ] **P3-02**: Gate-Keeper 자동화

- **Target**: `backend/gatekeeper/auto-runner.ts` [NEW]
- **목표**: 품질 검증 자동 실행
- **Logic (Pseudo)**:

  ```typescript
  // Cron Job 설정
  // 매일 자정에 실행

  async function runGateKeeper() {
    console.log("[GateKeeper] Starting daily check...");

    // Step 1: 모든 활성 프로젝트 조회
    const projects = await getActiveProjects();

    // Step 2: 각 프로젝트별 검증
    for (const project of projects) {
      try {
        // 최근 24시간 내 생성된 평가 결과 조회
        const evaluations = await getRecentEvaluations(project.id, 24);

        // 품질 지표 계산
        const metrics = calculateMetrics(evaluations);

        // 임계치 확인
        if (metrics.averageScore < 50) {
          await sendAlert({
            type: "LOW_SCORE",
            project: project.name,
            averageScore: metrics.averageScore,
          });
        }

        if (metrics.errorRate > 0.1) {
          await sendAlert({
            type: "HIGH_ERROR_RATE",
            project: project.name,
            errorRate: metrics.errorRate,
          });
        }

        // 결과 저장
        await saveGateKeeperResult(project.id, metrics);
      } catch (err) {
        console.error(`[GateKeeper] Error for project ${project.id}:`, err);
      }
    }

    console.log("[GateKeeper] Daily check completed");
  }

  interface GateKeeperMetrics {
    averageScore: number; // 평균 점수 (0-100)
    totalEvaluations: number; // 총 평가 수
    errorRate: number; // 에러율 (0-1)
    lowScoreCount: number; // 50점 미만 수
  }
  ```

- **Key Variables**:

  ```
  SCORE_THRESHOLD     : 50       -- 최소 점수 임계치
  ERROR_RATE_THRESHOLD: 0.1      -- 최대 에러율 (10%)
  CHECK_INTERVAL_HOURS: 24       -- 검증 주기 (시간)
  ```

- **Safety**:
  - ✅ 프로젝트별 Try-Catch
  - ✅ 알림 발송 실패 시에도 계속 진행
  - ⚠️ Rate limiting 고려

---

**Definition of Done (Phase 3):**

- [ ] Test: Template Builder에서 템플릿 CRUD 가능
- [ ] Test: Gate-Keeper 수동 실행 시 결과 저장됨
- [ ] Test: 알림 발송 정상 동작
- [ ] Review: Feature Flag 적용 확인
- [ ] Review: 에러 핸들링 추가 확인

---

## 전체 체크리스트 요약

### Phase 1: Critical 이슈 해결 (P1)

- [ ] **P1-01**: Supabase 406 에러 조사 및 해결
- [ ] **P1-02**: Vector Search 500 에러 조사 및 해결

### Phase 2: 성능 최적화 (P2)

- [ ] **P2-01**: Chat TTFT 최적화 (5.5초 → 2초)
- [ ] **P2-02**: 평가 API 간헐적 에러 수정

### Phase 3: 기능 확장 (P3)

- [ ] **P3-01**: Template Builder UI 구현
- [ ] **P3-02**: Gate-Keeper 자동화

---

## 예상 소요 시간

| Phase    | 작업                          | 예상 시간  |
| -------- | ----------------------------- | ---------- |
| Phase 1  | P1-01: Supabase 406 에러      | 2시간      |
|          | P1-02: Vector Search 500 에러 | 2시간      |
| Phase 2  | P2-01: Chat TTFT 최적화       | 3-4시간    |
|          | P2-02: 평가 API 에러 수정     | 2시간      |
| Phase 3  | P3-01: Template Builder UI    | 2-3일      |
|          | P3-02: Gate-Keeper 자동화     | 1-2일      |
| **총계** |                               | **~1주일** |

---

## 참고 자료

- **원본 문서**: [2512312240_Architecture_Refactoring_Walkthrough.md](./2512312240_Architecture_Refactoring_Walkthrough.md)
- **Phase 5 가이드**: [2512310720_Phase5_Implementation_Guide.md](./2512310720_Phase5_Implementation_Guide.md)
- **보안 수정 가이드**: [2512312047_Security_Fix_Implementation_Guide.md](./2512312047_Security_Fix_Implementation_Guide.md)

---

> **작성자**: Tech Lead  
> **검토**: Backend Senior Developer, Frontend Developer, QA Engineer  
> **버전**: v1.0 (2025-12-31)
