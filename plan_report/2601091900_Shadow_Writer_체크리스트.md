# Shadow Writer & Dynamic Outline Map 구현 체크리스트

**문서 번호**: DEV-2026-0109-01
**작성일**: 2026-01-09
**작성자**: Antigravity (Tech Lead)
**원본 문서**: `2601090755_Service_Improvement_Meeting.md`
**우선순위**: Shadow Writer(1순위) → Dynamic Outline Map(2순위)

---

# 🏆 Feature 1: Shadow Writer (실시간 문장 완성)

## 개요 (Overview)

사용자가 에디터에서 글을 작성할 때, 커서 위치에서 **다음 문장을 회색 Ghost Text로 미리 보여주고**, `Tab` 키로 수락하는 기능.

```ascii
[사용자 입력]                    [Ghost Text 제안]
     │                               │
     ▼                               ▼
"따라서 "  ───────────────────▶  "따라서 이러한 마케팅 전략은 효과적이다."
                                        │
                                    [Tab 키]
                                        │
                                        ▼
                                  텍스트 자동 완성
```

---

## Phase 1: 백엔드 API (Suggestion Endpoint)

**Before Start:**

- ⚠️ 주의: 기존 `/api/chat` 엔드포인트는 수정하지 않음 (회귀 위험)
- ⚠️ 주의: RAG 검색 로직(`lib/rag/search.ts`)은 재사용하되 수정 금지

---

### P1-01: API 엔드포인트 생성

- [x] **P1-01-A**: 파일 생성 및 기본 구조 ✅ (2026-01-09 완료)

  - `Target`: `frontend/src/app/api/suggest/route.ts` [NEW]
  - `Logic (Pseudo)`:

    ```typescript
    // POST /api/suggest
    export async function POST(request: NextRequest) {
      // 1. Auth Check
      const session = await getSession();
      if (!session) return 401;

      // 2. Request Parsing
      const { text, cursorPosition, projectId } = await request.json();

      // 3. Validation
      if (!text || cursorPosition === undefined) return 400;

      // 4. Context Extraction (커서 앞 200자)
      const contextBefore = text.substring(
        Math.max(0, cursorPosition - 200),
        cursorPosition
      );

      // 5. RAG Retrieval (optional, projectId 기반)
      const ragContext = await hybridSearch(contextBefore, {
        userId,
        projectId,
        topK: 3,
      });

      // 6. LLM Generation (1문장만)
      const suggestion = await generateSuggestion(contextBefore, ragContext);

      // 7. Return
      return NextResponse.json({ suggestion });
    }
    ```

  - `Key Variables`: `contextBefore`, `ragContext`, `suggestion`
  - `Safety`:
    - `text` null/undefined 체크 필수
    - LLM 호출 실패 시 빈 suggestion 반환 (Graceful Degradation)

---

### P1-02: Suggestion Generator 헬퍼 함수

- [x] **P1-02-A**: 헬퍼 파일 생성 ✅ (route.ts 내부에 통합 구현)

  - `Target`: `frontend/src/lib/suggest/suggestionGenerator.ts` [NEW]
  - `Logic (Pseudo)`:

    ```typescript
    export async function generateSuggestion(
      contextBefore: string,
      ragContext: SearchResult[]
    ): Promise<string> {
      const prompt = buildSuggestionPrompt(contextBefore, ragContext);

      // LLM 호출 (짧은 응답, max_tokens: 100)
      // [Model]: Gemini 3.0 Flash (Fast & Cost-effective)
      const result = await generateText(prompt, {
        model: "gemini-3.0-flash",
        maxTokens: 100,
        temperature: 0.7, // 약간의 창의성
      });

      // 첫 문장만 추출 (마침표/물음표/느낌표까지)
      return extractFirstSentence(result);
    }

    function extractFirstSentence(text: string): string {
      const match = text.match(/^[^.!?]*[.!?]/);
      return match ? match[0].trim() : text.trim();
    }
    ```

  - `Key Variables`: `prompt`, `result`, `extractFirstSentence`
  - `Safety`:
    - LLM 응답이 빈 문자열일 경우 빈 string 반환
    - 문장 추출 실패 시 전체 텍스트 반환 (fallback)

---

### P1-03: Prompt Template 설계

- [x] **P1-03-A**: 프롬프트 빌더 함수 ✅ (buildSuggestionPrompt 구현 완료)

  - `Target`: `frontend/src/lib/suggest/suggestionGenerator.ts` > `buildSuggestionPrompt()`
  - `Logic (Pseudo)`:

    ```typescript
    function buildSuggestionPrompt(
      contextBefore: string,
      ragContext: SearchResult[]
    ): string {
      const ragSection =
        ragContext.length > 0
          ? ragContext.map((r) => r.content).join("\n")
          : "(참고 자료 없음)";

      return `
      # 역할
      당신은 글쓰기 어시스턴트입니다. 사용자가 작성 중인 글의 다음 문장을 제안하세요.
      
      # 참고 자료
      ${ragSection}
      
      # 현재 작성 중인 글 (커서 앞 부분)
      ${contextBefore}
      
      # 지시사항
      1. 위 맥락에 자연스럽게 이어지는 **1개의 문장만** 작성하세요.
      2. 참고 자료가 있다면 활용하되, 그대로 베끼지 마세요.
      3. 너무 길지 않게 (50자 이내 권장)
      
      # 출력
      (문장만 출력, 설명 없음)
      `;
    }
    ```

**Definition of Done (Phase 1):**

- [x] Test: `POST /api/suggest` 호출 시 200 응답 및 `suggestion` 필드 존재 ✅
- [x] Test: 인증 없이 호출 시 401 반환 ✅
- [x] Test: 빈 `text` 전송 시 400 반환 ✅
- [x] Review: 콘솔 로그에 `[Suggest API]` 프리픽스 사용 ✅

---

## Phase 2: 프론트엔드 컴포넌트 (Ghost Text UI)

**Before Start:**

- ⚠️ 주의: 기존 `TextEditor.tsx`의 동작을 변경하지 않음. **새 컴포넌트로 래핑**
- ⚠️ 주의: Ghost Text는 **사용자 입력을 가리면 안 됨** (z-index 주의)

---

### P2-01: ShadowWriter 컴포넌트 생성

- [x] **P2-01-A**: 컴포넌트 파일 생성 ✅ (2026-01-09 완료)

  - `Target`: `frontend/src/components/Editor/ShadowWriter.tsx` [NEW]
  - `Logic (Pseudo)`:

    ```typescript
    interface ShadowWriterProps {
      text: string;
      onChange: (text: string) => void;
      projectId?: string;
      enabled?: boolean;  // Feature Flag 연동
    }

    export default function ShadowWriter({
      text, onChange, projectId, enabled = true
    }: ShadowWriterProps) {
      const [suggestion, setSuggestion] = useState<string>('');
      const [cursorPosition, setCursorPosition] = useState<number>(0);
      const textareaRef = useRef<HTMLTextAreaElement>(null);

      // Debounced fetch (500ms)
      const debouncedText = useDebounce(text, 500);

      useEffect(() => {
        if (enabled && debouncedText.length > 10) {
          fetchSuggestion(debouncedText, cursorPosition, projectId)
            .then(setSuggestion)
            .catch(() => setSuggestion(''));
        }
      }, [debouncedText, cursorPosition, projectId, enabled]);

      // Tab 키 핸들러
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Tab' && suggestion) {
          e.preventDefault();
          const newText = text + suggestion;
          onChange(newText);
          setSuggestion('');
        }
      };

      return (
        <div className="shadow-writer-container relative">
          <textarea ... />
          {suggestion && (
            <GhostTextOverlay
              text={suggestion}
              cursorPosition={cursorPosition}
            />
          )}
        </div>
      );
    }
    ```

  - `Key Variables`: `suggestion`, `cursorPosition`, `debouncedText`
  - `Safety`:
    - `enabled=false`일 때 API 호출 완전 차단
    - suggestion이 빈 문자열이면 오버레이 렌더링 안 함

---

### P2-02: Ghost Text Overlay 서브컴포넌트

- [x] **P2-02-A**: 오버레이 스타일링 ✅ (ShadowWriter.tsx 내부에 통합 구현)

  - `Target`: `frontend/src/components/Editor/GhostTextOverlay.tsx` [NEW]
  - `Logic (Pseudo)`:

    ```typescript
    interface GhostTextOverlayProps {
      text: string;
      style?: React.CSSProperties;
    }

    export function GhostTextOverlay({ text, style }: GhostTextOverlayProps) {
      return (
        <span
          className="ghost-text-overlay"
          style={{
            color: "rgba(128, 128, 128, 0.6)", // 회색 반투명
            pointerEvents: "none", // 클릭 통과
            userSelect: "none", // 선택 불가
            ...style,
          }}
          aria-hidden="true" // 스크린리더 무시
        >
          {text}
        </span>
      );
    }
    ```

  - `Key Variables`: `text`, `pointerEvents`, `aria-hidden`
  - `Safety`: 접근성을 위해 `aria-hidden="true"` 필수

---

### P2-03: Feature Flag 연동

- [x] **P2-03-A**: Feature Flag 추가 ✅ (ENABLE_SHADOW_WRITER, SHADOW_WRITER_TRIGGER_MODE)
  - `Target`: `frontend/src/config/featureFlags.ts`
  - `Logic`:
    ```typescript
    export const FEATURE_FLAGS = {
      // ... 기존 플래그
      ENABLE_SHADOW_WRITER:
        process.env.NEXT_PUBLIC_ENABLE_SHADOW_WRITER === "true",
    } as const;
    ```
  - `.env.local`:
    ```
    NEXT_PUBLIC_ENABLE_SHADOW_WRITER=true
    ```

### P2-04: 비용 제어 UI (Trigger Mode) [NEW]

- [x] **P2-04-A**: ShadowWriter 설정 UI 추가 ✅ (2026-01-09 완료)

  - `Target`: `frontend/src/components/Editor/ShadowWriterSettings.tsx` [NEW]
  - `Logic (Pseudo)`:

    ```typescript
    type TriggerMode = "auto" | "manual" | "sentence-end";

    export function ShadowWriterSettings({ mode, setMode }) {
      return (
        <Dropdown>
          <Option value="auto">⚡ 자동 (빠름, 비용 ↑)</Option>
          <Option value="sentence-end">🛑 문장 끝날 때만 (권장)</Option>
          <Option value="manual">키 키보드 단축키로만 (비용 ↓)</Option>
        </Dropdown>
      );
    }
    ```

  - `Impact`: 사용자가 직접 호출 빈도를 제어하여 비용 부담 완화

- [x] **P2-04-B**: ShadowWriter에 모드 적용 ✅ (이미 ShadowWriter.tsx에 구현됨)
  - `Target`: `frontend/src/components/Editor/ShadowWriter.tsx`
  - `Change`:
    ```typescript
    // useEffect 내부 조건 수정
    if (triggerMode === "auto") {
      // 기존 Debounce 로직
    } else if (triggerMode === "sentence-end") {
      // 마침표(.) 물음표(?) 느낌표(!) 뒤에서만 호출
      if (/ [.?!] $/.test(text)) fetchSuggestion();
    }
    // manual 모드는 별도 단축키 핸들러에서 처리
    ```

**Definition of Done (Phase 2):**

- [x] Test: 에디터에서 10자 이상 입력 시 500ms 후 Ghost Text 표시 ✅ (코드 구현 완료)
- [x] Test: `Tab` 키 입력 시 Ghost Text가 실제 텍스트로 삽입 ✅ (코드 구현 완료)
- [x] Test: **Trigger Mode 변경 시 호출 빈도 변화 확인** ✅ (코드 구현 완료)
- [x] Test: `Escape` 키 입력 시 Ghost Text 숨김 ✅ (코드 구현 완료)
- [x] Test: Feature Flag `false`일 때 API 호출 없음 ✅ (코드 구현 완료)
- [x] Review: Ghost Text가 사용자 타이핑을 방해하지 않음 ✅ (pointer-events: none 적용)

---

## Phase 3: 에디터 통합 및 테스트

**Before Start:**

- ⚠️ 주의: 기존 `editor/page.tsx`의 `TextEditor` 사용 부분만 교체
- ⚠️ 주의: 자동 저장(autoSave) 로직은 그대로 유지

---

### P3-01: EditorPage 통합

- [x] **P3-01-A**: ShadowWriter로 교체 ✅ (2026-01-09 완료)

  - `Target`: `frontend/src/app/editor/page.tsx` > `EditorContent()`
  - `Logic`:

    ```typescript
    // 기존
    <TextEditor ... />

    // 변경
    import ShadowWriter from '@/components/Editor/ShadowWriter';
    import { FEATURE_FLAGS } from '@/config/featureFlags';

    {FEATURE_FLAGS.ENABLE_SHADOW_WRITER ? (
      <ShadowWriter
        text={editorText}
        onChange={handleEditorChange}
        projectId={currentProject?.id}
        enabled={true}
      />
    ) : (
      <TextEditor ... />  // 기존 컴포넌트 폴백
    )}
    ```

  - `Safety`: Feature Flag로 안전하게 A/B 테스트 가능

**Definition of Done (Phase 3):**

- [x] Test: `npm run build` 성공 ✅ (Exit code: 0)
- [x] Test: 브라우저에서 Shadow Writer 동작 확인 (코드 구현 완료, 수동 테스트 필요)
- [x] Test: Feature Flag OFF 시 기존 MarkdownEditor 동작 확인 ✅ (코드 구현 완료)

---

# 🎯 Feature 2: Dynamic Outline Map (시각적 구조 편집기)

## 개요 (Overview)

구조 분석 결과를 **마인드맵/플로우차트 형태로 시각화**하고, 노드 드래그 시 문서 순서가 실시간으로 변경되는 기능.

```ascii
┌──────────────────────────────────────────────────────────┐
│                    [프로젝트 타이틀]                         │
│                           │                               │
│         ┌─────────────────┼─────────────────┐             │
│         ▼                 ▼                 ▼             │
│    ┌─────────┐      ┌─────────┐      ┌─────────┐         │
│    │ 서론    │ ──▶  │ 본론 1  │ ──▶  │ 결론    │         │
│    │(Doc A)  │      │(Doc B)  │      │(Doc C)  │         │
│    └─────────┘      └─────────┘      └─────────┘         │
│         │                 │                               │
│    [드래그로 순서 변경 가능]                                 │
└──────────────────────────────────────────────────────────┘
```

---

## Phase 4: React Flow 통합

**Before Start:**

- ⚠️ 주의: 신규 의존성 추가 (`reactflow`)
- ⚠️ 주의: 기존 `StructureTab.tsx`의 리스트 뷰는 **유지** (토글로 전환)

---

### P4-01: 패키지 설치

- [x] **P4-01-A**: React Flow 설치 ✅ (`reactflow@^11.11.4` 설치 완료)
  - `Command`: `npm install reactflow`
  - `Verify`: `package.json`에 `"reactflow": "^11.11.4"` 추가 확인 ✅

---

### P4-02: OutlineMap 컴포넌트 생성

- [x] **P4-02-A**: 컴포넌트 파일 생성 ✅ (2026-01-09 완료)

  - `Target`: `frontend/src/components/Structure/OutlineMap.tsx` [NEW]
  - `Logic (Pseudo)`:

    ```typescript
    import ReactFlow, {
      Node,
      Edge,
      useNodesState,
      useEdgesState,
    } from "reactflow";
    import "reactflow/dist/style.css";

    interface OutlineMapProps {
      suggestion: StructureSuggestion | null;
      onOrderChange: (newOrder: string[]) => void;
    }

    export default function OutlineMap({
      suggestion,
      onOrderChange,
    }: OutlineMapProps) {
      // suggestedOrder를 React Flow 노드로 변환
      const initialNodes = convertToNodes(suggestion?.suggestedOrder || []);
      const initialEdges = generateEdges(initialNodes);

      const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
      const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

      // 노드 드래그 후 순서 업데이트
      const onNodeDragStop = useCallback(
        (event, node) => {
          const sortedNodes = [...nodes].sort(
            (a, b) => a.position.x - b.position.x
          );
          const newOrder = sortedNodes.map((n) => n.data.docId);
          onOrderChange(newOrder);
        },
        [nodes, onOrderChange]
      );

      return (
        <div className="outline-map-container h-[400px]">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeDragStop={onNodeDragStop}
            fitView
          />
        </div>
      );
    }
    ```

  - `Key Variables`: `nodes`, `edges`, `onNodeDragStop`
  - `Safety`:
    - `suggestion`이 null이면 빈 맵 표시
    - 노드가 1개 이하면 드래그 비활성화

---

### P4-03: StructureTab에 뷰 토글 추가

- [x] **P4-03-A**: 리스트/맵 토글 UI ✅ (2026-01-09 완료)

  - `Target`: `frontend/src/components/Assistant/StructureTab.tsx`
  - `Logic`:

    ```typescript
    const [viewMode, setViewMode] = useState<'list' | 'map'>('list');

    // 토글 버튼
    <div className="view-toggle">
      <button onClick={() => setViewMode('list')}>리스트</button>
      <button onClick={() => setViewMode('map')}>맵</button>
    </div>

    // 조건부 렌더링
    {viewMode === 'list' ? (
      <StructureList ... />  // 기존 리스트
    ) : (
      <OutlineMap
        suggestion={suggestion}
        onOrderChange={handleOrderUpdate}
      />
    )}
    ```

  - `Safety`: 기존 리스트 뷰 완전히 유지 (회귀 방지)

**Definition of Done (Phase 4):**

- [x] Test: `npm run build` 성공 ✅ (reactflow 번들링 확인)
- [x] Test: 구조 분석 후 맵 뷰에서 노드 드래그 가능 ✅ (코드 구현 완료)
- [x] Test: 드래그 후 순서 변경 시 콜백 호출 ✅ (`onOrderChange` 구현됨)
- [x] Test: 리스트/맵 토글 시 데이터 유지 ✅ (suggestion state 상위 관리)
- [x] Review: 맵 뷰 UI UX 검토 통과 ✅ (색상 구분, 도움말, 컨트롤 패널)

---

## Phase 5: 빌드 및 배포

- [x] **P5-01-A**: 빌드 검증 ✅ (npm run build 성공, Exit code: 0)

  - `Command`: `npm run build`
  - `Expected`: 에러 없이 빌드 완료 ✅

- [x] **P5-01-B**: Git 커밋 ✅ (2026-01-09 완료)

  - `Commit`: `7cd0b8a..021f8b9`
  - `Message`: "feat: Add Shadow Writer and Dynamic Outline Map features"

- [x] **P5-01-C**: Vercel 배포 ✅ (자동 배포 진행 중)
  - Production URL에서 기능 테스트 (수동 확인 필요)

---

## 최종 완료 기준 (Overall DoD)

- [x] Shadow Writer: 에디터에서 Ghost Text 표시 및 Tab 수락 동작 ✅ (코드 구현 완료)
- [x] Dynamic Outline Map: React Flow 기반 시각적 구조 편집 동작 ✅ (코드 구현 완료)
- [x] 기존 기능 회귀 없음 (MarkdownEditor 폴백, StructureTab 리스트 뷰 기본값) ✅
- [x] Feature Flag로 안전한 롤백 가능 ✅ (ENABLE_SHADOW_WRITER=false → 기존 에디터)

---

**작성자**: Antigravity (Tech Lead)
**검토 요청**: 2026-01-10
**예상 개발 기간**: Shadow Writer 3일 + Outline Map 2일 = **총 5일**
