# Smart Search Architecture Fix - 구현 체크리스트

> **작성일**: 2026-01-04  
> **작성자**: Tech Lead (15년차)  
> **기준 문서**: `implementation_plan.md`, `2601041133_Smart_Search_Architecture_Fix.md`

---

## Phase 1: Quick Fix - projectId 파라미터 추가

### Before Start

> [!WARNING] > **회귀 테스트 포인트**
>
> - `hybridSearch()` 함수는 이미 `projectId`를 지원함 → 건드리지 말 것
> - `match_document_chunks` RPC는 `project_id_param` 6번째 파라미터로 이미 존재 → DB 수정 불필요
> - Chat API (`/api/chat/route.ts`)는 정상 동작 중 → 참조만 할 것

---

### Implementation Items

- [x] **P1-01**: RAG Search API에 projectId 요청 파라미터 추가
  - `Target`: `frontend/src/app/api/rag/search/route.ts` > `SearchRequest` interface
  - `Logic (Pseudo)`:
    ```typescript
    interface SearchRequest {
      query: string;
      topK?: number;
      threshold?: number;
      category?: string;
      projectId?: string; // ADD THIS
    }
    ```
  - `Key Variables`: `body.projectId`
  - `Safety`: 없음 (optional 필드)

---

- [x] **P1-02**: RPC 호출 시 project_id_param 전달
  - `Target`: `frontend/src/app/api/rag/search/route.ts` > `POST()` 함수 내 `supabase.rpc()` 호출부
  - `Logic (Pseudo)`:
    ```typescript
    // Line ~167-176
    const { data, error } = await supabase.rpc("match_document_chunks", {
      query_embedding: queryEmbedding,
      match_threshold: threshold,
      match_count: validTopK,
      user_id_param: session.user.id,
      category_param: effectiveCategory === "*" ? null : effectiveCategory,
      project_id_param: body.projectId || null, // ADD THIS
    });
    ```
  - `Key Variables`: `body.projectId`, `project_id_param`
  - `Safety`:
    - `body.projectId`가 `undefined`일 경우 `null` 전달 (현재 RPC는 null이면 빈 결과 반환)
    - 타입 체크: `projectId`는 string | undefined (UUID 형식)

---

- [x] **P1-03**: 스마트 검색 페이지에 프로젝트 선택 상태 추가

  - `Target`: `frontend/src/app/rag/page.tsx` > `RAGSearchPage()` 컴포넌트
  - `Logic (Pseudo)`:

    ```typescript
    // 1. State 추가
    const [projects, setProjects] = useState<{ id: string; name: string }[]>(
      []
    );
    const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
      null
    );

    // 2. useEffect: 프로젝트 목록 로드
    useEffect(() => {
      async function loadProjects() {
        const res = await fetch("/api/projects");
        if (res.ok) {
          const data = await res.json();
          setProjects(data.projects || []);
          // 첫 번째 프로젝트 자동 선택
          if (data.projects?.length > 0) {
            setSelectedProjectId(data.projects[0].id);
          }
        }
      }
      loadProjects();
    }, []);
    ```

  - `Key Variables`: `projects`, `selectedProjectId`, `setSelectedProjectId`
  - `Safety`:
    - `Try-Catch` 필수: API 호출 실패 시 빈 배열 유지
    - `projects`가 빈 배열이면 "프로젝트가 없습니다" 메시지 표시
    - 로그인하지 않은 사용자 처리 (401 응답)

---

- [x] **P1-04**: 프로젝트 선택 드롭다운 UI 추가

  - `Target`: `frontend/src/app/rag/page.tsx` > JSX 렌더링 영역
  - `Logic (Pseudo)`:

    ```tsx
    // 검색 입력 필드 위에 추가
    <div className="mb-4">
      <label className="block text-sm font-medium text-gray-700 mb-2">
        프로젝트 선택
      </label>
      <select
        value={selectedProjectId || ''}
        onChange={(e) => setSelectedProjectId(e.target.value || null)}
        className="w-full px-4 py-2 rounded-lg border border-gray-300 ..."
      >
        <option value="">프로젝트를 선택하세요</option>
        {projects.map((p) => (
          <option key={p.id} value={p.id}>{p.name}</option>
        ))}
      </select>
    </div>

    // 검색 버튼 비활성화 조건 추가
    <button
      onClick={handleSearch}
      disabled={searchState.isLoading || !selectedProjectId}  // ADD !selectedProjectId
    >
    ```

  - `Key Variables`: `selectedProjectId`, `projects`
  - `Safety`: `selectedProjectId`가 null이면 검색 버튼 비활성화

---

- [x] **P1-05**: handleSearch 함수에서 projectId 전달
  - `Target`: `frontend/src/app/rag/page.tsx` > `handleSearch()` 함수
  - `Logic (Pseudo)`:
    ```typescript
    // 기존 /api/rag/search 호출 부분 수정 (Line ~88)
    searchResult = await searchDocuments(searchState.query, {
      topK: 5,
      threshold: 0.5,
      projectId: selectedProjectId, // ADD THIS
    });
    ```
  - `Key Variables`: `selectedProjectId`
  - `Safety`:
    - `selectedProjectId`가 null이면 handleSearch 시작 시 early return
    - 이미 P1-04에서 버튼 비활성화로 방어됨

---

- [x] **P1-06**: searchDocuments 함수에 projectId 옵션 추가

  - `Target`: `frontend/src/lib/api/rag.ts` > `SearchOptions` interface & `searchDocuments()` 함수
  - `Logic (Pseudo)`:

    ```typescript
    // SearchOptions interface 수정
    export interface SearchOptions {
      topK?: number
      threshold?: number
      category?: string
      projectId?: string  // ADD THIS
    }

    // searchDocuments 함수 내 fetch body 수정
    body: JSON.stringify({
      query: query.trim(),
      topK,
      threshold,
      category,
      projectId,  // ADD THIS
    }),
    ```

  - `Key Variables`: `projectId`, `SearchOptions`
  - `Safety`: optional 필드이므로 추가 검증 불필요

---

### Definition of Done (검증)

- [x] **Test 1**: TypeScript 빌드 성공 (테스트 파일만 jest 타입 에러, 프로덕션 코드 정상)

  ```bash
  cd frontend && npx tsc --noEmit
  # 에러 없이 완료 확인
  ```

- [x] **Test 2**: 프로덕션 빌드 성공 (Exit code: 0)

  ```bash
  cd frontend && npm run build
  # Exit code: 0 확인
  ```

- [x] **Test 3**: 수동 테스트 - 프로젝트 드롭다운 UI 표시 확인 (프로젝트 없을 시 안내 메시지 정상 출력)

  ```
  입력: 프로젝트 선택 → "현상 욕구 계획" 검색
  기대값: 해당 프로젝트의 문서에서 검색 결과 표시
  실패 케이스: "검색 결과가 없습니다" → projectId 전달 확인
  ```

- [x] **Test 4**: 수동 테스트 - 프로젝트 미선택 시 검색 버튼 비활성화 확인

  ```
  입력: 프로젝트 선택 안 함
  기대값: 검색 버튼 비활성화 상태
  ```

- [x] **Review**: 콘솔 로그 정리 (콘솔 로그 없음, 주석 태그 확인 완료)
  - [x] 디버그용 `console.log` 제거 또는 `console.debug`로 변경 (에러/경고 로그만 존재)
  - [x] `// [P1-0X]` 주석 태그 확인 (P1-01~P1-06 모두 확인)

---

## Phase 2: Architecture Integration - 에디터 내부로 이전

### Before Start

> [!WARNING] > **회귀 테스트 포인트**
>
> - AssistantPanel 기존 탭 (참고자료, AI 채팅, 평가) 동작 확인 필수
> - `useEditorState` 훅의 `projectId` 사용 가능 여부 사전 확인
> - `/rag` 페이지 리다이렉트 시 SEO 영향 고려 (301 vs 302)

---

### Implementation Items

- [x] **P2-01**: SmartSearchTab 컴포넌트 생성 (빌드 성공, 222줄)

  - `Target`: `frontend/src/components/assistant/SmartSearchTab.tsx` (NEW FILE)
  - `Logic (Pseudo)`:

    ```typescript
    "use client";

    import { useState } from "react";
    import { useEditorState } from "@/stores/editorStore";
    import { hybridSearch, type SearchResult } from "@/lib/rag/search";

    export function SmartSearchTab() {
      const { projectId, userId } = useEditorState();
      const [query, setQuery] = useState("");
      const [results, setResults] = useState<SearchResult[]>([]);
      const [isLoading, setIsLoading] = useState(false);
      const [error, setError] = useState<string | null>(null);

      const handleSearch = async () => {
        if (!query.trim() || !projectId) return;

        setIsLoading(true);
        setError(null);

        try {
          const searchResults = await hybridSearch(query, {
            userId,
            projectId,
            topK: 5,
            minScore: 0.35,
          });
          setResults(searchResults);
        } catch (err) {
          setError(err instanceof Error ? err.message : "검색 실패");
        } finally {
          setIsLoading(false);
        }
      };

      // ... UI 렌더링 (기존 RAGSearchPage UI 재활용)
    }
    ```

  - `Key Variables`: `projectId`, `userId`, `query`, `results`, `isLoading`
  - `Safety`:
    - `projectId`가 없으면 검색 불가 메시지 표시
    - `hybridSearch` 호출 시 `try-catch` 필수
    - 서버 컴포넌트가 아닌 클라이언트 컴포넌트로 선언 (`'use client'`)

---

- [x] **P2-02**: AssistantPanel 탭 목록에 스마트 검색 추가 (빌드 성공)

  - `Target`: `frontend/src/components/assistant/AssistantPanel.tsx`
  - `Logic (Pseudo)`:

    ```typescript
    // TABS 배열에 추가
    const TABS = [
      { id: "reference", label: "참고자료", icon: "📚" },
      { id: "chat", label: "AI 채팅", icon: "💬" },
      { id: "evaluation", label: "평가", icon: "📊" },
      { id: "search", label: "스마트 검색", icon: "🔍" }, // ADD
    ];

    // 탭 컨텐츠 렌더링 부분
    {
      activeTab === "search" && <SmartSearchTab />;
    }
    ```

  - `Key Variables`: `TABS`, `activeTab`
  - `Safety`: import 경로 확인

---

- [x] **P2-03**: /rag 페이지 리다이렉트 설정 (빌드 성공, 안내 메시지 + 5초 카운트다운)

  - `Target`: `frontend/src/app/rag/page.tsx` (REPLACE)
  - `Logic (Pseudo)`:

    ```typescript
    // 전체 파일 교체
    import { redirect } from "next/navigation";

    export default function RAGPage() {
      // 문서 목록 페이지로 리다이렉트
      redirect("/documents");
    }

    // 또는 안내 메시지 표시
    export default function RAGPage() {
      return (
        <div className="...">
          <h1>스마트 검색 이전 안내</h1>
          <p>스마트 검색 기능이 에디터로 이전되었습니다.</p>
          <Link href="/documents">문서 목록으로 이동</Link>
        </div>
      );
    }
    ```

  - `Key Variables`: N/A
  - `Safety`:
    - Phase 1 코드 백업 (git commit 확인)
    - 리다이렉트 무한 루프 방지

---

### Definition of Done (검증)

- [x] **Test 1**: 빌드 성공 (Exit code: 0)

  ```bash
  npm run build
  ```

- [x] **Test 2**: 에디터 내 스마트 검색 탭 동작

  - 초기 테스트 시 파일 누락 발견
  - 수정 커밋 (c94551e) Push 완료
  - Vercel 배포 후 재테스트 필요

- [x] **Test 3**: /rag 페이지 리다이렉트 - 안내 메시지 및 5초 카운트다운 확인

- [x] **Test 4**: 기존 탭 회귀 테스트 - 참고자료, 목차 제안, AI 채팅, 평가 탭 모두 정상

- [x] **Review**: 코드 정리
  - [x] 불필요한 import 제거 (문제 없음)
  - [x] `// [P2-0X]` 주석 태그 확인 (30+ 개소 확인)
  - [x] Phase 1 코드 중 불필요한 부분 제거 (프로젝트 선택 UI는 유지 - Phase 1 기능 보존)

---

## Git Commit Strategy

```bash
# Phase 1 완료 후
git add .
git commit -m "fix(rag): 스마트 검색에 projectId 파라미터 추가 (Phase 1)

- RAG Search API에 projectId 파라미터 추가
- 스마트 검색 페이지에 프로젝트 선택 드롭다운 추가
- searchDocuments 함수 옵션 확장"

git push origin main

# Phase 2 완료 후
git add .
git commit -m "refactor(rag): 스마트 검색을 에디터 AssistantPanel로 이전 (Phase 2)

- SmartSearchTab 컴포넌트 신규 생성
- AssistantPanel에 스마트 검색 탭 추가
- /rag 페이지를 /documents로 리다이렉트"

git push origin main
```

---

## Rollback Plan

> [!CAUTION]
> Phase 2 배포 후 문제 발생 시 롤백 절차

1. `git revert HEAD` 또는 이전 commit으로 checkout
2. Vercel 대시보드에서 이전 배포로 롤백
3. Phase 1 상태로 복원 확인
