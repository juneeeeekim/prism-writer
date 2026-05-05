# 스마트 검색 아키텍처 개선 기술 문서

> **작성일**: 2026-01-04  
> **작성자**: AI Tech Lead  
> **상태**: 계획 수립 완료, 사용자 승인 대기

---

## 1. 문제 정의

### 1.1 현상

- "스마트 검색" 기능에서 검색 시 **검색 결과 없음** 오류 발생
- 실제로 업로드된 참고 자료가 있음에도 불구하고 검색되지 않음

### 1.2 근본 원인

| 서비스          | 프로젝트 필터         | 사용 함수                            |
| --------------- | --------------------- | ------------------------------------ |
| AI 채팅         | ✅ `projectId` 사용   | `hybridSearch(query, { projectId })` |
| 평가/목차 제안  | ✅ 프로젝트 스코프    | 에디터에서 `projectId` 전달          |
| **스마트 검색** | ❌ **projectId 없음** | `match_document_chunks` 직접 호출    |

### 1.3 영향받는 파일

- `frontend/src/app/rag/page.tsx` - 스마트 검색 UI
- `frontend/src/app/api/rag/search/route.ts` - RAG Search API

---

## 2. 해결 전략: 단계적 접근

```
Phase 1 (Option A)      Phase 2 (Option B)
┌─────────────────┐     ┌─────────────────┐
│ 빠른 수정        │ ──▶ │ 아키텍처 통합    │
│ (30분)          │     │ (2-3시간)       │
└─────────────────┘     └─────────────────┘
```

---

## 3. Phase 1: Option A - 빠른 수정

### 3.1 목표

RAG Search API에 `projectId` 파라미터를 추가하여 기능 정상화

### 3.2 변경 사항

#### A-01: RAG Search API 수정

**파일**: `frontend/src/app/api/rag/search/route.ts`

```diff
 interface SearchRequest {
   query: string
   topK?: number
   threshold?: number
   category?: string
+  projectId?: string  // [FIX] 프로젝트 필터 추가
 }

 // RPC 호출 부분
 const { data: searchResults, error: searchError } = await supabase.rpc(
   'match_document_chunks',
   {
     query_embedding: queryEmbedding,
     match_threshold: threshold,
     match_count: validTopK,
     user_id_param: session.user.id,
     category_param: effectiveCategory === '*' ? null : effectiveCategory,
+    project_id_param: body.projectId || null  // [FIX] 프로젝트 필터
   }
 )
```

#### A-02: 스마트 검색 페이지 수정

**파일**: `frontend/src/app/rag/page.tsx`

**Option A-1: URL 파라미터에서 projectId 읽기**

```typescript
// URL: /rag?projectId=xxx
const searchParams = useSearchParams();
const projectId = searchParams.get("projectId");

// API 호출 시 projectId 전달
const response = await fetch("/api/rag/search", {
  method: "POST",
  body: JSON.stringify({
    query,
    topK: 5,
    threshold: 0.5,
    projectId, // 추가
  }),
});
```

**Option A-2: 프로젝트 선택 드롭다운 추가**

```typescript
// 사용자의 프로젝트 목록 조회 후 선택 UI 제공
const [projects, setProjects] = useState([])
const [selectedProjectId, setSelectedProjectId] = useState(null)

// 프로젝트 목록 로드
useEffect(() => {
  fetchProjects().then(setProjects)
}, [])

// 드롭다운 UI 추가
<select value={selectedProjectId} onChange={(e) => setSelectedProjectId(e.target.value)}>
  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
</select>
```

#### A-03: 검증

```bash
npm run build    # 빌드 성공 확인
git push         # Vercel 자동 배포
```

---

## 4. Phase 2: Option B - 아키텍처 통합

### 4.1 목표

스마트 검색을 에디터 내부 AssistantPanel로 이전하여 일관된 워크플로우 제공

### 4.2 아키텍처 변경

```
현재 아키텍처:
┌─────────────────────┐      ┌─────────────────────┐
│   /rag (별도 페이지)  │      │   /editor           │
│   - 독립된 검색 UI    │      │   - 참고자료        │
│   - projectId 없음   │      │   - AI 채팅         │
└─────────────────────┘      │   - 평가            │
                             └─────────────────────┘

변경 후 아키텍처:
┌─────────────────────────────────────────────────┐
│                   /editor                        │
│   ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌────────┐ │
│   │ 참고자료 │ │ AI 채팅 │ │  평가   │ │스마트검색│ │
│   └─────────┘ └─────────┘ └─────────┘ └────────┘ │
│   (모두 projectId 기반)                          │
└─────────────────────────────────────────────────┘
```

### 4.3 변경 사항

#### B-01: SmartSearchTab 컴포넌트 생성

**파일**: `frontend/src/components/assistant/SmartSearchTab.tsx`

```typescript
import { useState } from "react";
import { useEditorState } from "@/stores/editorStore";
import { hybridSearch } from "@/lib/rag/search";

export function SmartSearchTab() {
  const { projectId } = useEditorState(); // 자동으로 프로젝트 ID 획득
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);

  const handleSearch = async () => {
    const results = await hybridSearch(query, {
      projectId,
      topK: 5,
    });
    setResults(results);
  };

  // UI 렌더링...
}
```

#### B-02: AssistantPanel 탭 추가

**파일**: `frontend/src/components/assistant/AssistantPanel.tsx`

```diff
 const TABS = [
   { id: 'reference', label: '참고자료', icon: '📚' },
   { id: 'chat', label: 'AI 채팅', icon: '💬' },
   { id: 'evaluation', label: '평가', icon: '📊' },
+  { id: 'search', label: '스마트 검색', icon: '🔍' },
 ]

 // 탭 컨텐츠 렌더링
 {activeTab === 'search' && <SmartSearchTab />}
```

#### B-03: /rag 페이지 처리

**방안 1: 리다이렉트**

```typescript
// frontend/src/app/rag/page.tsx
import { redirect } from "next/navigation";

export default function RAGPage() {
  redirect("/editor?tab=search");
}
```

**방안 2: 안내 페이지**

```typescript
export default function RAGPage() {
  return (
    <div>
      <p>스마트 검색 기능이 에디터로 이전되었습니다.</p>
      <Link href="/editor?tab=search">에디터에서 검색하기</Link>
    </div>
  );
}
```

#### B-04: 통합 테스트

- [ ] 에디터에서 스마트 검색 탭 동작 확인
- [ ] 프로젝트별 검색 결과 격리 확인
- [ ] 기존 /rag URL 접근 시 리다이렉트 확인

---

## 5. 마이그레이션 체크리스트

### Phase 1 (즉시 실행)

- [ ] A-01: RAG Search API에 projectId 파라미터 추가
- [ ] A-02: 스마트 검색 페이지에서 projectId 전달
- [ ] A-03: 빌드/배포 검증
- [ ] A-04: 기능 테스트 (검색 결과 확인)

### Phase 2 (Phase 1 완료 후)

- [ ] B-01: SmartSearchTab 컴포넌트 생성
- [ ] B-02: AssistantPanel에 탭 추가
- [ ] B-03: /rag 페이지 리다이렉트 설정
- [ ] B-04: 통합 테스트
- [ ] B-05: 배포 및 모니터링

---

## 6. 위험 요소 및 대응

| 위험                     | 영향             | 대응 방안                                       |
| ------------------------ | ---------------- | ----------------------------------------------- |
| RPC 함수 시그니처 불일치 | 검색 실패        | 현재 RPC가 project_id_param 지원 여부 사전 확인 |
| 사용자 혼란 (UI 변경)    | UX 저하          | 안내 메시지 및 온보딩 가이드 제공               |
| 캐시 무효화              | 검색 결과 불일치 | 배포 후 캐시 클리어                             |

---

## 7. 승인 요청

위 계획을 검토하시고 승인해 주시면 Phase 1부터 즉시 구현을 시작하겠습니다.

- [ ] **승인** - 계획대로 진행
- [ ] **수정 요청** - 피드백 후 재검토
