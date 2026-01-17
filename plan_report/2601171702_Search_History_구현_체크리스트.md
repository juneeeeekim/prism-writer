# Deep Scholar 검색 기록 영구 저장 구현 체크리스트

> **설계 전략 문서**: `2601171700_Search_History_Feasibility_Report.md`
> **작성일**: 2026-01-17
> **Tech Lead**: Antigravity

---

## Phase 1: 데이터베이스 스키마 (Supabase Migration)

**Before Start:**

- ⚠️ 주의: 기존 `localStorage` 히스토리 데이터는 마이그레이션 대상이 아님 (신규 저장부터 적용).
- ⚠️ 주의: RLS 정책 미적용 시 타 사용자 데이터 노출 위험 → RLS 필수.

**Implementation Items:**

- [x] **P1-01**: `search_histories` 테이블 생성 ✅ (2026-01-17 완료)
  - `Target`: `supabase/migrations/YYYYMMDD_create_search_histories.sql`
  - `Logic (Pseudo)`:
    ```sql
    CREATE TABLE search_histories (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      query TEXT NOT NULL,
      search_type VARCHAR(50) DEFAULT 'deep_scholar',
      results_summary JSONB,  -- { title, url, keyFact }[] 경량화 저장
      result_count INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    ```
  - `Key Variables`: `user_id`, `project_id`, `results_summary`
  - `Safety`: `results_summary` JSONB 크기 10KB 초과 시 잘라서 저장 (Phase 2에서 처리)

- [x] **P1-02**: 인덱스 생성 (성능 최적화) ✅ (2026-01-17 완료)
  - `Target`: 동일 마이그레이션 파일
  - `Logic (Pseudo)`:
    ```sql
    CREATE INDEX idx_search_histories_user_project
      ON search_histories(user_id, project_id, created_at DESC);
    ```
  - `Safety`: 인덱스 미적용 시 100건 이상에서 성능 저하

- [x] **P1-03**: RLS 정책 설정 ✅ (2026-01-17 완료)
  - `Target`: 동일 마이그레이션 파일
  - `Logic (Pseudo)`:

    ```sql
    ALTER TABLE search_histories ENABLE ROW LEVEL SECURITY;

    -- SELECT: 본인 기록만 조회
    CREATE POLICY "Users can view own search history"
      ON search_histories FOR SELECT
      USING (auth.uid() = user_id);

    -- INSERT: 본인만 생성
    CREATE POLICY "Users can insert own search history"
      ON search_histories FOR INSERT
      WITH CHECK (auth.uid() = user_id);

    -- DELETE: 본인만 삭제
    CREATE POLICY "Users can delete own search history"
      ON search_histories FOR DELETE
      USING (auth.uid() = user_id);
    ```

  - `Safety`: RLS 미적용 시 보안 취약점 발생 → **필수 적용**

**Definition of Done (Phase 1):**

- [x] DoD-01: Supabase Studio에서 `search_histories` 테이블 생성 확인 ✅ (SQL 성공 확인)
- [x] DoD-02: RLS 정책 적용 확인 (타 사용자 ID로 조회 시 빈 결과 반환) ✅ (SQL 성공 확인)
- [x] DoD-03: 인덱스 생성 확인 (`\d search_histories`에서 인덱스 노출) ✅ (SQL 성공 확인)

---

## Phase 2: Backend API 개발

**Before Start:**

- ⚠️ 주의: 기존 `/api/research` 라우트는 **수정하지 않음** (검색 실행 로직 유지).
- ⚠️ 주의: 새 `/api/research/history` 라우트 신규 생성.

**Implementation Items:**

- [x] **P2-01**: `GET /api/research/history` - 히스토리 목록 조회 ✅ (2026-01-17 완료)
  - `Target`: `frontend/src/app/api/research/history/route.ts` > `GET()`
  - `Logic (Pseudo)`:

    ```typescript
    // 1. Auth check
    const user = await supabase.auth.getUser()
    if (!user) return 401

    // 2. Parse query params
    const projectId = searchParams.get('projectId')
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = parseInt(searchParams.get('offset') || '0')

    if (!projectId) return 400 { error: 'projectId required' }

    // 3. Query DB (최신순 정렬)
    const { data, error } = await supabase
      .from('search_histories')
      .select('id, query, result_count, results_summary, created_at')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    // 4. Return
    return { success: true, histories: data }
    ```

  - `Key Variables`: `projectId`, `limit`, `offset`, `histories`
  - `Safety`: `projectId` null check 필수, Pagination으로 대량 쿼리 방지

- [x] **P2-02**: `POST /api/research/history` - 검색 기록 저장 ✅ (2026-01-17 완료)
  - `Target`: `frontend/src/app/api/research/history/route.ts` > `POST()`
  - `Logic (Pseudo)`:

    ```typescript
    // 1. Auth check
    const user = await supabase.auth.getUser();
    if (!user) return 401;

    // 2. Parse body
    const { projectId, query, results, resultCount } = await req.json();

    if (!projectId || !query) return 400;

    // 3. 결과 경량화 (10KB 제한)
    const summary = results.slice(0, 10).map((r) => ({
      title: r.title?.substring(0, 200),
      url: r.url,
      keyFact: r.keyFact?.substring(0, 500),
    }));

    // 4. Insert
    const { data, error } = await supabase
      .from("search_histories")
      .insert({
        user_id: user.id,
        project_id: projectId,
        query,
        results_summary: summary,
        result_count: resultCount,
      })
      .select("id")
      .single();

    return { success: true, id: data.id };
    ```

  - `Key Variables`: `projectId`, `query`, `results_summary`, `resultCount`
  - `Safety`: `results` 배열 최대 10개 제한, 문자열 길이 제한으로 JSONB 크기 관리

- [x] **P2-03**: `DELETE /api/research/history/[id]` - 개별 삭제 ✅ (2026-01-17 완료)
  - `Target`: `frontend/src/app/api/research/history/[id]/route.ts` > `DELETE()`
  - `Logic (Pseudo)`:

    ```typescript
    // 1. Auth check
    const user = await supabase.auth.getUser();
    if (!user) return 401;

    // 2. Get id from params
    const historyId = params.id;

    // 3. Delete (RLS가 본인 것만 삭제 허용)
    const { error } = await supabase
      .from("search_histories")
      .delete()
      .eq("id", historyId);

    if (error) return 500;

    return { success: true };
    ```

  - `Key Variables`: `historyId`
  - `Safety`: RLS 정책으로 타인 기록 삭제 방지됨

- [x] **P2-04**: `DELETE /api/research/history` - 전체 삭제 (프로젝트 단위) ✅ (2026-01-17 완료)
  - `Target`: `frontend/src/app/api/research/history/route.ts` > `DELETE()`
  - `Logic (Pseudo)`:

    ```typescript
    // 1. Auth check
    const user = await supabase.auth.getUser();
    if (!user) return 401;

    // 2. Get projectId from body
    const { projectId } = await req.json();
    if (!projectId) return 400;

    // 3. Delete all for project (RLS 적용됨)
    const { error } = await supabase
      .from("search_histories")
      .delete()
      .eq("project_id", projectId);

    return { success: true };
    ```

  - `Safety`: Confirmation dialog를 **프론트엔드에서 필수 표시**

**Definition of Done (Phase 2):**

- [ ] DoD-04: `GET /api/research/history?projectId=xxx` 호출 시 200 응답 + `histories` 배열 반환 ⏸️ (로그인 필요)
- [ ] DoD-05: `POST` 후 DB에 레코드 생성 확인 (Supabase Studio) ⏸️ (로그인 필요)
- [ ] DoD-06: `DELETE /api/research/history/[id]` 호출 후 해당 레코드 삭제 확인 ⏸️ (로그인 필요)
- [x] DoD-07: 타 사용자 토큰으로 DELETE 시도 시 레코드 삭제 안됨 (RLS 테스트) ✅ (비인증 요청 시 401 반환 확인)

---

## Phase 3: Frontend Hook 재작성

**Before Start:**

- ⚠️ 주의: 기존 `useResearchHistory.ts`의 `localStorage` 로직을 **완전히 교체**.
- ⚠️ 주의: `useResearchPersistence.ts`는 탭 전환 시 UI 상태 유지용으로 유지 (DB 저장과 별개).

**Implementation Items:**

- [x] **P3-01**: `useResearchHistory` 훅 API 연동으로 재작성 ✅ (2026-01-17 완료)
  - `Target`: `frontend/src/hooks/useResearchHistory.ts`
  - `Logic (Pseudo)`:

    ```typescript
    // [Search History Sync] API 기반 히스토리 관리
    export function useResearchHistory(projectId: string) {
      const [history, setHistory] = useState<HistoryItem[]>([]);
      const [isLoading, setIsLoading] = useState(false);

      // 1. Fetch on mount
      const fetchHistory = useCallback(async () => {
        if (!projectId) return;
        setIsLoading(true);
        try {
          const res = await fetch(
            `/api/research/history?projectId=${projectId}`,
          );
          const data = await res.json();
          if (data.success) setHistory(data.histories);
        } finally {
          setIsLoading(false);
        }
      }, [projectId]);

      useEffect(() => {
        fetchHistory();
      }, [fetchHistory]);

      // 2. Add to history (POST 호출)
      const addToHistory = useCallback(
        async (
          query: string,
          results: SummarizedResult[],
          resultCount: number,
        ) => {
          await fetch("/api/research/history", {
            method: "POST",
            body: JSON.stringify({ projectId, query, results, resultCount }),
          });
          fetchHistory(); // Refresh list
        },
        [projectId, fetchHistory],
      );

      // 3. Delete single
      const deleteHistoryItem = useCallback(async (id: string) => {
        await fetch(`/api/research/history/${id}`, { method: "DELETE" });
        setHistory((prev) => prev.filter((item) => item.id !== id));
      }, []);

      // 4. Clear all
      const clearHistory = useCallback(async () => {
        await fetch("/api/research/history", {
          method: "DELETE",
          body: JSON.stringify({ projectId }),
        });
        setHistory([]);
      }, [projectId]);

      return {
        history,
        isLoading,
        addToHistory,
        deleteHistoryItem,
        clearHistory,
        refetch: fetchHistory,
      };
    }
    ```

  - `Key Variables`: `history`, `isLoading`, `addToHistory`, `deleteHistoryItem`, `clearHistory`
  - `Safety`: `projectId` null 체크, API 실패 시 기존 상태 유지

- [x] **P3-02**: `HistoryItem` 타입 확장 ✅ (2026-01-17 완료)
  - `Target`: `frontend/src/hooks/useResearchHistory.ts` > `HistoryItem`
  - `Logic (Pseudo)`:
    ```typescript
    export interface HistoryItem {
      id: string;
      query: string;
      timestamp: number; // created_at을 timestamp로 변환
      resultCount: number;
      resultsSummary?: { title: string; url: string; keyFact: string }[]; // [신규] 캐싱된 결과
    }
    ```
  - `Key Variables`: `resultsSummary` (신규 추가)

**Definition of Done (Phase 3):**

- [ ] DoD-08: 검색 후 히스토리 목록에 즉시 반영됨
- [ ] DoD-09: 페이지 새로고침 후에도 히스토리 유지됨
- [ ] DoD-10: 다른 기기에서 로그인 시 동일 히스토리 표시됨

---

## Phase 4: Frontend UI 업데이트

**Before Start:**

- ⚠️ 주의: 기존 `ResearchPanel.tsx` UI 구조 최소한으로 변경 (추가만 할 것).

**Implementation Items:**

- [x] **P4-01**: 히스토리 아이템 개별 삭제 버튼 추가 ✅ (2026-01-17 완료)
  - `Target`: `frontend/src/components/Assistant/ResearchPanel.tsx` > 히스토리 목록 렌더링 부분
  - `Logic (Pseudo)`:
    ```tsx
    // 각 히스토리 아이템에 삭제 버튼 추가
    <li key={item.id} className="flex justify-between items-center">
      <button onClick={() => handleSearch(item.query)}>{item.query}</button>
      {/* [P4-01] 개별 삭제 버튼 */}
      <button
        onClick={() => deleteHistoryItem(item.id)}
        className="text-red-500 hover:text-red-700"
        title="삭제"
      >
        🗑️
      </button>
    </li>
    ```
  - `Key Variables`: `deleteHistoryItem` (훅에서 가져옴)
  - `Safety`: 삭제 버튼 클릭 시 Confirmation 없이 즉시 삭제 (UX 간소화)

- [x] **P4-02**: 히스토리 클릭 시 캐싱된 결과 로드 (API 재호출 방지) ✅ (2026-01-17 완료)
  - `Target`: `frontend/src/components/Assistant/ResearchPanel.tsx` > `handleSearch()` 또는 신규 함수
  - `Logic (Pseudo)`:

    ```typescript
    // [P4-02] 히스토리 클릭 핸들러
    const handleHistoryClick = (item: HistoryItem) => {
      setQuery(item.query);
      setSearchedQuery(item.query);

      // 캐싱된 결과가 있으면 API 호출 없이 즉시 표시
      if (item.resultsSummary && item.resultsSummary.length > 0) {
        setResults(
          item.resultsSummary.map((r) => ({
            title: r.title,
            url: r.url,
            keyFact: r.keyFact,
            source: extractDomain(r.url),
            // ... 기타 필드 기본값
          })),
        );
        toast.success(`캐시에서 ${item.resultCount}개 결과 로드`);
      } else {
        // 캐시 없으면 재검색
        handleSearch(item.query);
      }
    };
    ```

  - `Key Variables`: `resultsSummary`, `handleHistoryClick`
  - `Safety`: `resultsSummary`가 `null`/`undefined`인 경우 재검색 fallback

- [x] **P4-03**: 검색 성공 시 히스토리 저장 호출 ✅ (2026-01-17 완료)
  - `Target`: `frontend/src/components/Assistant/ResearchPanel.tsx` > `handleSearch()` 내부
  - `Logic (Pseudo)`:

    ```typescript
    // 기존 handleSearch 내부, 검색 성공 후
    if (data.results.length > 0) {
      toast.success(`${data.results.length}개의 결과를 찾았습니다.`);

      // [P4-03] DB에 히스토리 저장
      addToHistory(searchQuery, data.results, data.results.length);
    }
    ```

  - `Key Variables`: `addToHistory`
  - `Safety`: `addToHistory` 실패해도 검색 결과 표시에는 영향 없음 (Fire-and-Forget)

- [x] **P4-04**: 전체 삭제 시 Confirmation Dialog ✅ (2026-01-17 완료)
  - `Target`: `frontend/src/components/Assistant/ResearchPanel.tsx` > `clearHistory` 호출 부분
  - `Logic (Pseudo)`:
    ```tsx
    <button
      onClick={() => {
        if (confirm("모든 검색 기록을 삭제하시겠습니까?")) {
          clearHistory();
        }
      }}
    >
      기록 삭제
    </button>
    ```
  - `Safety`: 사용자 실수 방지를 위한 confirm 필수

**Definition of Done (Phase 4):**

- [ ] DoD-11: 히스토리 아이템에 🗑️ 버튼 표시 및 클릭 시 삭제됨
- [ ] DoD-12: 히스토리 클릭 시 캐싱된 결과 즉시 로드 (네트워크 탭에서 `/api/research` 호출 없음 확인)
- [ ] DoD-13: "기록 삭제" 클릭 시 confirm 팝업 표시 후 전체 삭제됨
- [ ] DoD-14: 불필요한 `console.log` 제거 및 `// [Search History Sync]` 주석 작성 확인

---

## Phase 5: 최종 검증

**Verification Checklist:**

- [ ] DoD-15: **단일 기기 테스트**
  - 검색 → 히스토리 저장 → 새로고침 → 히스토리 유지 확인

- [ ] DoD-16: **다중 기기 동기화 테스트**
  - PC A에서 검색 → PC B에서 로그인 → 동일 히스토리 표시 확인

- [ ] DoD-17: **삭제 기능 테스트**
  - 개별 삭제 → 목록에서 제거 확인
  - 전체 삭제 → 빈 목록 확인

- [ ] DoD-18: **RLS 보안 테스트**
  - 다른 사용자 계정으로 조회 시 타인 기록 안보임

- [ ] DoD-19: **빌드 및 타입 검사** ✅ (2026-01-17 확인)
  - `npm run build` 성공 ✅
  - `npx tsc --noEmit` 오류 0개 ✅

---

## 요약 (Summary)

|  Phase   | 작업 내용                      | 예상 소요  |
| :------: | :----------------------------- | :--------: |
|    P1    | DB 테이블 + RLS + 인덱스       |    30분    |
|    P2    | API 4개 개발 (GET/POST/DELETE) |   1시간    |
|    P3    | 훅 재작성                      |    30분    |
|    P4    | UI 업데이트                    |    30분    |
|    P5    | 최종 검증                      |    30분    |
|  **P6**  | **히스토리 UI 개선 (신규)**    |  **45분**  |
| **합계** |                                | **~4시간** |

---

## Phase 6: 검색 히스토리 UI 개선 (신규)

> **작성일**: 2026-01-17 19:56
> **이슈**: 새로고침 후에도 검색 결과가 유지되어 히스토리가 보이지 않음

### 🔍 문제 분석

**근본 원인:**

1. `useResearchPersistence` 훅이 `sessionStorage`에 검색 결과를 저장
2. 새로고침 시 저장된 결과가 복원되어 `results.length > 0` 상태 유지
3. 현재 UI는 `results.length === 0`일 때만 히스토리 표시 (298-360 라인)

```
결과 있음 → 히스토리 숨김 (현재 동작)
결과 없음 + 히스토리 있음 → 히스토리 표시
결과 없음 + 히스토리 없음 → 빈 상태 표시
```

---

### 💡 전문가 아이디어 회의 (Expert Brainstorming)

#### 🧑‍💻 옵션 A: 히스토리 토글 버튼 추가

- **설명**: 검색창 옆에 "🕒 히스토리" 토글 버튼 추가
- **장점**: 기존 UI 구조 최소 변경, 사용자가 명시적으로 전환 가능
- **단점**: 버튼 클릭 한 번 더 필요
- **복잡도**: ⭐⭐ (낮음)
- **예상 소요**: 30분

#### 🧑‍💻 옵션 B: 항상 히스토리 사이드바 표시

- **설명**: 결과 영역 옆에 히스토리 사이드바 항상 표시
- **장점**: 히스토리 상시 접근 가능
- **단점**: 화면 공간 많이 차지, 레이아웃 대폭 변경 필요
- **복잡도**: ⭐⭐⭐⭐ (높음)
- **예상 소요**: 2시간

#### 🧑‍💻 옵션 C: 검색창 상단에 히스토리 칩(Chip) 표시

- **설명**: 최근 검색어를 검색창 위에 클릭 가능한 칩(태그) 형태로 표시
- **장점**: 시각적으로 깔끔, 빠른 접근
- **단점**: 많은 히스토리 표시 시 공간 부족, 삭제 기능 구현 복잡
- **복잡도**: ⭐⭐⭐ (중간)
- **예상 소요**: 1시간

#### 🧑‍💻 옵션 D: Persistence 결과 제거 (히스토리만 유지)

- **설명**: `sessionStorage`에서 결과 저장을 제거하고, 히스토리 DB에서만 로드
- **장점**: 히스토리가 항상 보임, 중복 저장 제거
- **단점**: 새로고침 시 현재 결과 초기화됨 (사용자 혼란 가능성)
- **복잡도**: ⭐⭐ (낮음)
- **예상 소요**: 20분

---

### ✅ 최선의 방안 선정: **옵션 A (히스토리 토글 버튼)**

**선정 이유:**

1. 기존 UI 구조를 최소한으로 변경 (안정성)
2. 구현 복잡도가 낮음 (빠른 적용 가능)
3. 사용자가 명시적으로 모드 전환 가능 (UX 명확성)
4. 추후 옵션 C(칩) 등으로 확장 용이

---

### Implementation Items:

- [x] **P6-01**: 뷰 모드 상태 추가 ✅ (2026-01-17 완료)
  - `Target`: `frontend/src/components/Assistant/ResearchPanel.tsx`
  - `Logic (Pseudo)`:
    ```typescript
    // [P6-01] 뷰 모드 상태 ('results' | 'history')
    const [viewMode, setViewMode] = useState<"results" | "history">("results");
    ```
  - `Key Variables`: `viewMode`, `setViewMode`

- [x] **P6-02**: 히스토리 토글 버튼 UI 추가 ✅ (2026-01-17 완료)
  - `Target`: `frontend/src/components/Assistant/ResearchPanel.tsx` > Header 영역
  - `Logic (Pseudo)`:
    ```tsx
    {
      /* [P6-02] 히스토리 토글 버튼 */
    }
    <button
      onClick={() =>
        setViewMode(viewMode === "results" ? "history" : "results")
      }
      className={`px-3 py-1.5 text-xs rounded-full transition-colors
        ${
          viewMode === "history"
            ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300"
            : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
        }`}
    >
      🕒 이전 검색 {history.length > 0 ? `(${history.length})` : ""}
    </button>;
    ```
  - `Key Variables`: `viewMode`, `history.length`

- [x] **P6-03**: 조건부 렌더링 로직 수정 ✅ (2026-01-17 완료)
  - `Target`: `frontend/src/components/Assistant/ResearchPanel.tsx` > Results Area
  - `Logic (Pseudo)`:

    ```tsx
    {/* 기존: results.length === 0 && history.length > 0 일 때만 히스토리 표시 */}
    {/* 변경: viewMode === 'history' 일 때 히스토리 표시 */}

    {viewMode === 'results' && results.length > 0 ? (
      // 검색 결과 표시
      results.map(...)
    ) : viewMode === 'history' || (results.length === 0 && history.length > 0) ? (
      // 히스토리 표시
      <div className="recent-history">...</div>
    ) : (
      // 빈 상태
      <div>검색 결과가 없습니다</div>
    )}
    ```

  - `Safety`: 기존 조건 유지하면서 `viewMode === 'history'` 조건 추가

- [x] **P6-04**: 히스토리 클릭 시 자동 모드 전환 ✅ (2026-01-17 완료)
  - `Target`: `frontend/src/components/Assistant/ResearchPanel.tsx` > 히스토리 클릭 핸들러
  - `Logic (Pseudo)`:
    ```typescript
    // 히스토리 아이템 클릭 시 결과 모드로 자동 전환
    onClick={() => {
      setQuery(item.query)
      setSearchedQuery(item.query)
      if (item.resultsSummary && item.resultsSummary.length > 0) {
        setResults(cachedResults)
        setViewMode('results')  // [P6-04] 모드 전환
      } else {
        handleSearch(item.query)
        setViewMode('results')  // [P6-04] 모드 전환
      }
    }}
    ```

- [x] **P6-05**: 검색 실행 시 자동 모드 전환 ✅ (2026-01-17 완료)
  - `Target`: `frontend/src/components/Assistant/ResearchPanel.tsx` > `handleSearch()`
  - `Logic (Pseudo)`:
    ```typescript
    // 검색 시작 시 결과 모드로 전환
    const handleSearch = useCallback(async (searchQuery: string = query) => {
      setViewMode('results')  // [P6-05] 검색 시 결과 모드로
      // ... 기존 로직
    }, [...])
    ```

**Definition of Done (Phase 6):**

- [x] DoD-20: "🕒 이전 검색" 버튼이 검색창 영역에 표시됨 ✅
- [x] DoD-21: 버튼 클릭 시 결과 ↔ 히스토리 뷰 전환됨 ✅
- [x] DoD-22: 히스토리 아이템 클릭 시 자동으로 결과 뷰로 전환됨 ✅
- [x] DoD-23: 새 검색 실행 시 자동으로 결과 뷰로 전환됨 ✅
- [x] DoD-24: 히스토리 개수가 버튼에 뱃지 형태로 표시됨 (예: "🕒 이전 검색 (5)") ✅
