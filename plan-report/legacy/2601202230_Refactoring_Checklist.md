# Refactoring Implementation Checklist

## [Phase 1: EvaluationTab Refactoring]

**Before Start:**

- ⚠️ **Critical Path:** `EvaluationTab` is the core value proposition. Ensure `LegacyEvaluationResult` adapter logic (`adaptLegacyToV5`) is preserved exactly.
- ⚠️ **Dependency:** `useEditorState` hook usage must be maintained in the parent or correctly passed to the new hook.

**Implementation Items:**

- [x] **ID(P1-01)**: `useEvaluation` Hook Extraction
  - `Target`: `frontend/src/hooks/useEvaluation.ts` > `useEvaluation()`
  - `Logic (Pseudo)`:

    ```typescript
    export function useEvaluation(projectId: string) {
      const [evaluations, setEvaluations] = useState<SavedEvaluation[]>([]);
      const [isEvaluating, setIsEvaluating] = useState(false);

      // Move loadEvaluations logic here
      const loadEvaluations = async () => {
         const { data, error } = await supabase.from('evaluations').select('*')...;
         if (error) throw error;
         setEvaluations(data || []);
      };

      return { evaluations, isEvaluating, evaluate, loadEvaluations };
    }
    ```

  - `Key Variables`: `evaluations`, `isEvaluating`, `currentResult`
  - `Safety`: Ensure `supabase` error handling wraps all async calls. `try { ... } catch (e) { toast.error(e.message) }`

- [x] **ID(P1-02)**: `EvaluationResult` Component Extraction
  - `Target`: `frontend/src/components/Assistant/evaluation/EvaluationResult.tsx` > `EvaluationResult()`
  - `Logic (Pseudo)`:
    ```typescript
    // Move the rendering logic for 'V5EvaluationResult' here
    if (!result) return <EmptyState />;
    return (
      <div>
         <ScoreDisplay score={result.overall_score} />
         {result.evaluations.map(item => <RubricItem item={item} />)}
      </div>
    );
    ```
  - `Key Variables`: `result: V5EvaluationResult`, `onApplyFix: (plan) => void`
  - `Safety`: Check `result.evaluations` is array before mapping.

- [x] **ID(P1-03)**: `EvaluationHistory` Component Extraction
  - `Target`: `frontend/src/components/Assistant/evaluation/EvaluationHistory.tsx` > `EvaluationHistory()`
  - `Logic (Pseudo)`:
    ```typescript
    // Move sidebar/list logic
    return (
      <List>
        {evaluations.map(ev => (
           <ListItem key={ev.id} onClick={() => onLoad(ev)} />
        ))}
      </List>
    );
    ```
  - `Key Variables`: `evaluations: SavedEvaluation[]`, `onLoad: (ev) => void`
  - `Safety`: Handle empty `evaluations` array gracefully (show "No History").

**Definition of Done (Verification):**

- [ ] **Test**: `useEvaluation` correctly fetches data from Supabase (verify netwrok tab validation).
- [ ] **Test**: Clicking a history item updates the main `EvaluationResult` view.
- [ ] **Review**: No `console.log` leftovers. All imports in `EvaluationTab` should be from `./evaluation/*` or `@/hooks/*`.

---

## [Phase 2: Dashboard Refactoring]

**Before Start:**

- ⚠️ **Layout**: `Grid` layout responsiveness must be preserved when moving `ProjectCard`.
- ⚠️ **State**: `isSelectionMode` logic is tricky; ensure batch delete state works across component boundaries.

**Implementation Items:**

- [x] **ID(P2-01)**: `ProjectCard` Extraction
  - `Target`: `frontend/src/components/dashboard/ProjectCard.tsx` > `ProjectCard()`
  - `Logic (Pseudo)`:
    ```typescript
    // Extract logic from page.tsx:446
    export function ProjectCard({ project, isSelectionMode, isSelected, onToggle }: Props) {
       const handleClick = (e) => {
         if (isSelectionMode) { e.preventDefault(); onToggle(); }
         else { router.push(...) }
       };
       return <Card onClick={handleClick}>...</Card>;
    }
    ```
  - `Key Variables`: `project: Project`, `isSelected: boolean`
  - `Safety`: Propagate `e.stopPropagation()` on delete button click to prevent card navigation.

- [x] **ID(P2-02)**: `CreateProjectModal` Extraction
  - `Target`: `frontend/src/components/dashboard/CreateProjectModal.tsx` > `CreateProjectModal()`
  - `Logic (Pseudo)`:
    ```typescript
    // Extract logic from page.tsx:547
    const handleSubmit = async (e) => {
      e.preventDefault();
      if (!input.trim()) return; // validation
      await onCreate(input);
    };
    ```
  - `Key Variables`: `isOpen`, `onClose`, `onCreate`, `projectName`
  - `Safety`: Prevent double submission while `isCreating` is true.

- [ ] **ID(P2-03)**: `useDashboard` Hook Extraction
  - `Target`: `frontend/src/hooks/useDashboard.ts` > `useDashboard()`
  - `Logic (Pseudo)`:
    ```typescript
    export function useDashboard() {
      const [projects, setProjects] = useState([]);
      const [selection, setSelection] = useState<Set<string>>(new Set());

      // Batch delete logic
      const deleteSelected = async () => {
        await Promise.all([...selection].map((id) => api.deleteProject(id)));
        setSelection(new Set());
      };

      return { projects, selection, deleteSelected };
    }
    ```
  - `Key Variables`: `selectedIds`, `isSelectionMode`
  - `Safety`: Ensure `deleteSelected` handles partial failures or wraps in transaction if possible (Supabase limitation).

**Definition of Done (Verification):**

- [ ] **Test**: Create a new project -> Redirects to editor?
- [ ] **Test**: Batch delete 3 items -> UI updates immediately?
- [ ] **Review**: `page.tsx` line count < 150.

---

## [Phase 3: Chat API Refactoring]

**Before Start:**

- ⚠️ **Streaming**: `StreamingTextResponse` and `LangChainStream` logic is fragile. Avoid changing the stream structure key names.
- ⚠️ **RAG**: Search result deduplication logic (`deduplicateByChunkId`) is critical for reducing hallucinations.

**Implementation Items:**

- [x] **ID(P3-01)**: `promptBuilder` Service
  - `Target`: `frontend/src/lib/services/chat/promptBuilder.ts` > `buildSystemPrompt()`
  - `Logic (Pseudo)`:
    ```typescript
    export function buildSystemPrompt(context: string, rules: string[]) {
      return `You are PRISM... Context: ${context}... Rules: ${rules.join("\n")}`;
    }
    ```
  - `Key Variables`: `systemPrompt`, `contextString`
  - `Safety`: Handle `null` context gracefully (return generic prompt).

- [x] **ID(P3-02)**: `ragSearchService` Extraction
  - `Target`: `frontend/src/lib/services/chat/ragSearchService.ts` > `performHybridSearch()`
  - `Logic (Pseudo)`:
    ```typescript
    export async function performHybridSearch(
      query: string,
      options: SearchOptions,
    ) {
      // Query Extension
      const extendedQueries = await generateQueries(query);
      // Parallel Search
      const results = await Promise.all([vectorSearch, keywordSearch]);
      // Deduplication
      return deduplicateByChunkId(results.flat());
    }
    ```
  - `Key Variables`: `embedding`, `rpc('hybrid_search')`
  - `Safety`: `try-catch` embedding generation failure.

- [x] **ID(P3-03)**: `chatService` (Core Logic)
  - `Target`: `frontend/src/lib/services/chat/chatService.ts` > `processChatRequest()`
  - `Logic (Pseudo)`:
    ```typescript
    export async function processChatRequest(req: Request) {
       const { messages } = await req.json();
       const lastMessage = messages[messages.length - 1];

       // Orchestration
       const context = await ragSearchService.search(lastMessage.content);
       const stream = await openai.chat.completions.create({ stream: true, ... });

       return stream;
    }
    ```
  - `Key Variables`: `OpenAIStream`, `StreamingTextResponse`
  - `Safety`: Ensure `saveMessageWithRetry` is called _after_ stream completes (using callbacks) or strictly managed parallel promises.

**Definition of Done (Verification):**

- [ ] **Test**: Chat response streams token-by-token (no buffering)?
- [ ] **Test**: Citations appear in the response metadata?
- [ ] **Review**: `route.ts` should only handle Request parsing and Response formatting.

---

## [Phase 4: ChatTab Refactoring]

**Before Start:**

- ⚠️ **Data Loss**: `localStorage` backup logic is the user's safety net. Test this thoroughly.

**Implementation Items:**

- [x] **ID(P4-01)**: `chatBackup` Utility
  - `Target`: `frontend/src/components/Assistant/utils/chatBackup.ts` > `saveToBackup()`
  - `Logic (Pseudo)`:
    ```typescript
    const KEY = "chat_backup_v1";
    export function saveToBackup(messages: Message[]) {
      if (messages.length > MAX) messages = messages.slice(-MAX);
      localStorage.setItem(KEY, JSON.stringify(messages));
    }
    ```
  - `Key Variables`: `localStorage_key`, `MAX_BACKUP_MESSAGES`
  - `Safety`: `try-catch` for `localStorage.setItem` (QuotaExceededError).

- [x] **ID(P4-02)**: `ChatInput` Component
  - `Target`: `frontend/src/components/Assistant/chat/ChatInput.tsx` > `ChatInput()`
  - `Logic (Pseudo)`:
    ```typescript
    const handleKeyDown = (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        onSend(input);
      }
    };
    ```
  - `Key Variables`: `inputRef`, `isLoading`
  - `Safety`: Disable textarea/button when `isLoading` is true.

**Definition of Done (Verification):**

- [ ] **Test**: Refresh page -> Chat history restores from LocalStorage?
- [ ] **Review**: `ChatTab.tsx` is cleaner, mainly composing sub-components.

---

## [Phase 5: Type Refactoring]

**Before Start:**

- ⚠️ **Imports**: This will break _many_ files. Use VSCode's "update imports" or global search/replace carefully.

**Implementation Items:**

- [x] **ID(P5-01)**: Split `rag.ts`
  - `Target`: `frontend/src/types/rag/index.ts` (and subfiles)
  - `Logic (Pseudo)`:
    ```typescript
    // index.ts
    export * from "./search";
    export * from "./evaluation";
    export * from "./template";
    ```
  - `Key Variables`: `SearchResult`, `V5EvaluationResult`
  - `Safety`: Check for circular dependencies between type files (rare but possible).
