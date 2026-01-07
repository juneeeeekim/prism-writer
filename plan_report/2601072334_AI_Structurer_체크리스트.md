# AI Structurer 구현 체크리스트 (Implementation Checklist)

**문서 번호:** 2601072334*AI_Structurer*체크리스트
**작성일:** 2026-01-07
**작성자:** Antigravity (Tech Lead)
**기반 문서:** `2601072321_AI_Structurer_Architecture.md`

---

## 🚨 Critical Constraints (필수 제약 조건)

- ❌ 기존 `api/outline`, `api/rag/evaluate` 파일을 절대 수정하지 마십시오.
- ❌ `documents` 테이블의 기존 RLS 정책을 변경하지 마십시오.
- ✅ 모든 DB 조회 시 `projectId`를 필수로 전달하십시오 (`083` 격리 정책 준수).
- ✅ 새로운 파일만 생성하십시오 (New files only).

---

## [Phase 1: Feature Flag 및 기반 설정]

**Before Start:**

- ⚠️ 주의: `frontend/src/config/featureFlags.ts`는 다른 기능에도 영향을 주므로 기존 플래그를 건드리지 마십시오.

**Implementation Items:**

- [ ] **P1-01**: Feature Flag 등록
  - `Target`: `frontend/src/config/featureFlags.ts`
  - `Logic (Pseudo)`:
    ```typescript
    // 파일 하단에 추가
    export const ENABLE_AI_STRUCTURER =
      process.env.NEXT_PUBLIC_ENABLE_AI_STRUCTURER === "true";
    ```
  - `Key Variables`: `ENABLE_AI_STRUCTURER`
  - `Safety`: 환경 변수 미설정 시 기본값 `false`로 안전하게 비활성화.

**Definition of Done (검증):**

- [ ] Test: 환경 변수 없이 `ENABLE_AI_STRUCTURER`가 `false`인지 확인.
- [ ] Review: 기존 `ENABLE_PIPELINE_V5` 등 다른 플래그에 영향이 없는지 확인.

---

## [Phase 2: Backend API - 구조 분석 (Core Logic)]

**Before Start:**

- ⚠️ 주의: `frontend/src/app/api/rag/` 디렉토리에 **새 폴더 `structure/`를 생성**하여 작업합니다.
- ⚠️ 회귀 테스트: `api/rag/evaluate`, `api/outline` API가 정상 동작하는지 반드시 확인 후 진행.

**Implementation Items:**

- [ ] **P2-01**: API 라우트 파일 생성

  - `Target`: `frontend/src/app/api/rag/structure/analyze/route.ts` (NEW)
  - `Logic (Pseudo)`:

    ```typescript
    export async function POST(request: NextRequest) {
      // 1. Auth Check
      const supabase = await createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return Unauthorized();

      // 2. Parse Body
      const { projectId, templateId } = await request.json();
      if (!projectId) return BadRequest("projectId is required");

      // 3. Validate Project Ownership (Strict Isolation)
      const project = await supabase
        .from("projects")
        .select("id")
        .eq("id", projectId)
        .eq("user_id", session.user.id)
        .single();
      if (!project.data) return Forbidden("Not your project");

      // 4. Fetch Documents
      const documents = await fetchProjectDocuments(projectId, supabase);
      if (documents.length === 0)
        return Ok({ suggestion: null, message: "No documents" });

      // 5. Fetch Template (Rubric) if provided
      const rubricCriteria = templateId
        ? await fetchTemplateCriteria(templateId, supabase)
        : getDefaultStructure(); // fallback: Intro/Body/Conclusion

      // 6. Build LLM Prompt (Dynamic Rubric Mapping)
      const prompt = buildStructurePrompt(documents, rubricCriteria);

      // 7. Call LLM (Gemini/OpenAI)
      const llmResponse = await callStructureAnalysisLLM(prompt);

      // 8. Parse & Return
      const suggestion = parseAnalysisResult(llmResponse);
      return Ok({ success: true, suggestion });
    }
    ```

  - `Key Variables`:
    - `projectId: string` - 필수
    - `templateId?: string` - 선택 (없으면 기본 구조 사용)
    - `rubricCriteria: TemplateSchema[]` - 템플릿 기준 배열
    - `suggestion: StructureSuggestion` - 분석 결과 객체
  - `Safety`:
    - `try-catch`로 전체 로직 감싸기.
    - `projectId` Null Check 필수 (Line 2).
    - LLM 호출 실패 시 Graceful Degradation (빈 제안 리턴).

- [ ] **P2-02**: 헬퍼 함수 - `fetchProjectDocuments()`

  - `Target`: `frontend/src/lib/rag/structureHelpers.ts` (NEW)
  - `Logic (Pseudo)`:

    ```typescript
    export async function fetchProjectDocuments(
      projectId: string,
      supabase: SupabaseClient
    ): Promise<DocumentSummary[]> {
      const { data, error } = await supabase
        .from("documents")
        .select("id, title, content, created_at, sort_order")
        .eq("project_id", projectId)
        .order("sort_order", { ascending: true, nullsFirst: false });

      if (error) throw new Error(`Document fetch failed: ${error.message}`);
      return data || [];
    }
    ```

  - `Key Variables`: `DocumentSummary { id, title, content, created_at, sort_order }`
  - `Safety`: `error` 객체 체크 및 로깅.

- [ ] **P2-03**: 헬퍼 함수 - `buildStructurePrompt()` - `Target`: `frontend/src/lib/rag/structureHelpers.ts` - `Logic (Pseudo)`:
      ```typescript
      export function buildStructurePrompt(
        documents: DocumentSummary[],
        rubricCriteria: TemplateSchema[]
      ): string {
        const docList = documents.map((d, i) => 
          `[문서 ${i+1}: ${d.title}]\n${d.content.substring(0, 500)}`
      ).join('\n---\n');

          const rubricDescription = rubricCriteria.map(c =>
            `- ${c.category}: ${c.rationale}`
          ).join('\n');

          return `

  당신은 글 구조 전문가입니다.
  아래 문서들을 분석하고, 주어진 '구조 기준(Rubric)'에 따라 최적의 순서를 제안하세요.
  **절대로 일반적인 서론/본론/결론으로 분류하지 마세요.** 아래 기준만 사용하세요.

[구조 기준 (Rubric)]
${rubricDescription}

[분석 대상 문서]
${docList}

[출력 형식 (JSON)]
{
"suggestedOrder": [{ "docId": "...", "assignedTag": "기준명", "reason": "..." }],
"gaps": [{ "afterDocId": "...", "missingElement": "...", "suggestion": "..." }]
}
` ;
      }
      ```
    -  `Key Variables`: `rubricDescription`, `docList`    -`Safety`: `content`가 null일 경우 빈 문자열 처리.

- [ ] **P2-04**: 응답 파싱 함수 - `parseAnalysisResult()`
  - `Target`: `frontend/src/lib/rag/structureHelpers.ts`
  - `Logic (Pseudo)`:
    ````typescript
    export function parseAnalysisResult(
      llmResponse: string
    ): StructureSuggestion {
      try {
        // LLM 응답에서 JSON 블록 추출
        const jsonMatch = llmResponse.match(/```json\n?([\s\S]*?)\n?```/);
        const jsonStr = jsonMatch ? jsonMatch[1] : llmResponse;
        const parsed = JSON.parse(jsonStr);
        return {
          suggestedOrder: parsed.suggestedOrder || [],
          gaps: parsed.gaps || [],
        };
      } catch (e) {
        console.error("[parseAnalysisResult] JSON 파싱 실패:", e);
        return { suggestedOrder: [], gaps: [] }; // Graceful Degradation
      }
    }
    ````
  - `Safety`: JSON 파싱 실패 시 빈 객체 리턴 (서비스 중단 방지).

**Definition of Done (검증):**

- [ ] Test: `projectId`만 넣고 호출 시, 해당 프로젝트의 문서 목록이 분석되는지 확인.
- [ ] Test: `projectId`가 현재 사용자 소유가 아닐 때 `403 Forbidden` 반환 확인.
- [ ] Test: 문서가 0개일 때 `{ suggestion: null }` 반환 확인.
- [ ] Test: LLM 응답이 비정상일 때 빈 배열 리턴 (서비스 중단 없음) 확인.
- [ ] Review: 불필요한 `console.log` 제거, 주요 로직에 주석 작성.

---

## [Phase 3: Backend API - 순서 적용 (Reorder)]

**Before Start:**

- ⚠️ 주의: 기존 `documents` 테이블에 `sort_order` 컬럼이 없다면, **Migration 파일을 먼저 생성**해야 합니다.

**Implementation Items:**

- [ ] **P3-01**: (Optional) DB Migration - `sort_order` 컬럼 추가

  - `Target`: `supabase/migrations/084_add_sort_order_to_documents.sql` (NEW)
  - `Logic (SQL)`:

    ```sql
    -- 문서 정렬 순서를 저장하기 위한 컬럼 추가
    ALTER TABLE public.documents
    ADD COLUMN IF NOT EXISTS sort_order FLOAT DEFAULT 0;

    -- 기존 문서에 순서 매기기 (생성일 기준)
    WITH ordered AS (
      SELECT id, row_number() OVER (PARTITION BY project_id ORDER BY created_at) as rn
      FROM public.documents
    )
    UPDATE public.documents d
    SET sort_order = o.rn
    FROM ordered o
    WHERE d.id = o.id;
    ```

  - `Safety`: `IF NOT EXISTS`로 중복 실행 방지.

- [ ] **P3-02**: API 라우트 - 순서 업데이트

  - `Target`: `frontend/src/app/api/documents/reorder/route.ts` (NEW)
  - `Logic (Pseudo)`:

    ```typescript
    export async function POST(request: NextRequest) {
      const { projectId, orderedDocIds } = await request.json();
      // orderedDocIds: ["doc-uuid-3", "doc-uuid-1", "doc-uuid-2"]

      if (!projectId || !Array.isArray(orderedDocIds)) return BadRequest();

      // Batch Update
      const updates = orderedDocIds.map((docId, index) => ({
        id: docId,
        sort_order: index + 1, // 1, 2, 3...
      }));

      const { error } = await supabase
        .from("documents")
        .upsert(updates, { onConflict: "id" });

      if (error) return ServerError(error.message);
      return Ok({ success: true });
    }
    ```

  - `Key Variables`: `orderedDocIds: string[]`, `updates: { id, sort_order }[]`
  - `Safety`: 배열 유효성 검사, 프로젝트 소유권 검증 (생략 시 다른 사용자 문서 조작 위험).

**Definition of Done (검증):**

- [ ] Test: `orderedDocIds`에 3개 ID를 순서대로 넣으면, DB에 `sort_order`가 1, 2, 3으로 저장되는지 확인.
- [ ] Test: 다른 사용자의 `docId`를 넣으면 업데이트가 안 되거나 에러가 나는지 확인 (RLS 검증).

---

## [Phase 4: Frontend UI - Structure Board Tab]

**Before Start:**

- ⚠️ 주의: `AssistantPanel.tsx`의 기존 탭 로직을 건드리지 마십시오. 새 탭만 추가합니다.
- ⚠️ 의존성: `framer-motion`, `@dnd-kit/core` 라이브러리가 필요합니다. 없다면 먼저 설치.

**Implementation Items:**

- [ ] **P4-01**: Structure Tab 컴포넌트 생성

  - `Target`: `frontend/src/components/Assistant/StructureTab.tsx` (NEW)
  - `Logic (Pseudo)`:

    ```tsx
    export default function StructureTab() {
      const { currentProject } = useProject();
      const [documents, setDocuments] = useState<DocumentSummary[]>([]);
      const [suggestion, setSuggestion] = useState<StructureSuggestion | null>(
        null
      );
      const [isAnalyzing, setIsAnalyzing] = useState(false);

      // 1. Load Documents
      useEffect(() => {
        if (currentProject?.id) {
          fetchDocumentsForStructure(currentProject.id).then(setDocuments);
        }
      }, [currentProject?.id]);

      // 2. Request AI Analysis
      const handleAnalyze = async () => {
        if (!currentProject?.id) return;
        setIsAnalyzing(true);
        try {
          const res = await fetch("/api/rag/structure/analyze", {
            method: "POST",
            body: JSON.stringify({ projectId: currentProject.id }),
          });
          const data = await res.json();
          if (data.success) setSuggestion(data.suggestion);
        } finally {
          setIsAnalyzing(false);
        }
      };

      // 3. Apply AI Order
      const handleApplyOrder = async () => {
        /* ... */
      };

      return (
        <div className="structure-board">
          <Dashboard completeness={calculateCompleteness(suggestion)} />
          <MainCanvas documents={documents} suggestion={suggestion} />
          <AISidePanel suggestion={suggestion} onApply={handleApplyOrder} />
        </div>
      );
    }
    ```

  - `Key Variables`: `documents`, `suggestion`, `isAnalyzing`
  - `Safety`: `currentProject?.id` Null Check 필수.

- [ ] **P4-02**: AssistantPanel에 탭 등록

  - `Target`: `frontend/src/components/Assistant/AssistantPanel.tsx`
  - `Logic`:

    ```tsx
    // import 추가
    import StructureTab from "./StructureTab";
    import { ENABLE_AI_STRUCTURER } from "@/config/featureFlags";

    // tabs 배열에 조건부 추가
    const tabs = [
      { id: "reference", label: "참고자료", icon: "📚" },
      { id: "outline", label: "목차", icon: "📋" },
      // ...기존 탭들...
      ...(ENABLE_AI_STRUCTURER
        ? [{ id: "structure", label: "구조", icon: "🧩" }]
        : []),
    ];

    // 렌더링 부분에 추가
    {
      activeTab === "structure" && <StructureTab />;
    }
    ```

  - `Safety`: Feature Flag로 감싸서 비활성화 시 탭이 보이지 않도록 함.

- [ ] **P4-03**: DocumentCard 컴포넌트 생성
  - `Target`: `frontend/src/components/structure/DocumentCard.tsx` (NEW)
  - 상세 UI 구현은 디자인 스펙(6.1절) 참고.

**Definition of Done (검증):**

- [ ] Test: `ENABLE_AI_STRUCTURER=true`일 때 AssistantPanel에 '구조' 탭이 보이는지 확인.
- [ ] Test: `ENABLE_AI_STRUCTURER=false`일 때 '구조' 탭이 숨겨지는지 확인.
- [ ] Test: 문서가 있는 프로젝트에서 '분석' 버튼 클릭 시 API 호출 및 결과 표시 확인.
- [ ] Review: 로딩 상태 UI가 제대로 표시되는지 확인.

---

## [Phase 5: 통합 테스트 및 회귀 방지]

**Before Start:**

- ⚠️ 이 단계는 모든 코드 작성 완료 후 수행합니다.

**Regression Test Checklist:**

- [ ] 기존 `Outline` 기능이 정상 작동하는가?
- [ ] 기존 `Evaluation` 기능이 정상 작동하는가?
- [ ] 기존 `Chat` 기능이 정상 작동하는가?
- [ ] 기존 `Smart Search` 기능이 정상 작동하는가?

**New Feature Test:**

- [ ] 문서 0개 프로젝트에서 분석 요청 시 오류 없이 안내 메시지 표시.
- [ ] 문서 10개 이상 프로젝트에서 분석 성능 30초 이내 완료.
- [ ] AI 추천 순서 적용 후 DB에 `sort_order` 올바르게 반영.
- [ ] 페이지 새로고침 후에도 적용된 순서가 유지됨.

---

### [서명]

- **Tech Lead**: Antigravity 🖋️
- **Date**: 2026-01-07
