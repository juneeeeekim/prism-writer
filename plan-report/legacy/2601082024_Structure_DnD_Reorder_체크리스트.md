# Drag & Drop 순서 편집 구현 체크리스트

**문서 번호:** 2601082024*Structure_DnD_Reorder*체크리스트  
**작성일:** 2026-01-08  
**작성자:** Antigravity (Tech Lead)  
**기반 문서:** `2601082023_Structure_DnD_Reorder_Spec.md`

---

## 🚨 Critical Constraints (필수 제약 조건)

- ❌ 기존 "AI 분석" 기능이 정상 작동해야 합니다 (Backward Compatibility).
- ✅ 드래그 순서 변경 후 "이 순서로 적용" 버튼 클릭 시 DB에 저장되어야 합니다.
- ✅ "구조" 탭과 "내 문서" 탭의 `sort_order`가 동기화되어야 합니다.

---

## [Phase 1: Backend API - 순서 일괄 업데이트]

**Before Start:**

- ⚠️ 주의: 기존 `/api/documents` 라우트를 수정하지 마세요. 새 `/api/documents/reorder` 라우트를 생성합니다.
- ⚠️ 레거시: `user_documents` 테이블의 `sort_order` 컬럼은 nullable입니다. null 처리 필수.

**Implementation Items:**

- [x] **DnD-B01**: Reorder API 라우트 생성 ✅ 완료 (2026-01-08 20:27)

  - `Target`: `frontend/src/app/api/documents/reorder/route.ts` > `PATCH()`
  - `Logic (Pseudo)`:

    ```typescript
    // 1. Auth Check
    const user = await getUser(supabase);
    if (!user) return { error: "Unauthorized", status: 401 };

    // 2. Parse Body
    const { projectId, orderedDocIds } = await request.json();
    if (!projectId || !Array.isArray(orderedDocIds)) {
      return { error: "Invalid request body", status: 400 };
    }

    // 3. Project Ownership Check
    const project = await supabase
      .from("projects")
      .select("id")
      .eq("id", projectId)
      .eq("user_id", user.id)
      .single();
    if (!project.data) return { error: "Project not found", status: 404 };

    // 4. Batch Update sort_order
    for (let i = 0; i < orderedDocIds.length; i++) {
      await supabase
        .from("user_documents")
        .update({ sort_order: i + 1 })
        .eq("id", orderedDocIds[i])
        .eq("project_id", projectId);
    }

    return { success: true, updatedCount: orderedDocIds.length };
    ```

  - `Key Variables`:
    - `orderedDocIds: string[]` - 새 순서대로 정렬된 문서 ID 배열
    - `projectId: string` - 프로젝트 ID
  - `Safety`:
    - `orderedDocIds`가 배열인지 `Array.isArray()` 체크 필수
    - `projectId`가 없거나 빈 문자열인 경우 400 에러 반환
    - for 루프 내 개별 update 실패 시에도 전체 롤백하지 않음 (부분 성공 허용)

- [x] **DnD-B02**: API 타입 정의 ✅ 완료 (DnD-B01에서 함께 구현)

  - `Target`: `frontend/src/app/api/documents/reorder/route.ts` 상단
  - `Logic`:

    ```typescript
    interface ReorderRequest {
      projectId: string;
      orderedDocIds: string[];
    }

    interface ReorderResponse {
      success: boolean;
      updatedCount: number;
      error?: string;
    }
    ```

  - `Key Variables`: `ReorderRequest`, `ReorderResponse`
  - `Safety`: 타입 가드로 런타임 검증

**Definition of Done (검증):**

- [x] Test: `PATCH /api/documents/reorder` 호출 시 `sort_order`가 순서대로 1, 2, 3... 으로 업데이트되는지 확인. ✅ 코드 레벨 검증 (Line 149-152)
- [x] Test: 인증 없이 호출 시 401 에러 반환 확인. ✅ API 테스트 통과 (2026-01-08 20:29)
- [x] Test: 존재하지 않는 `projectId` 전달 시 404 에러 반환 확인. ✅ 코드 레벨 검증 (Line 135-139)
- [x] Test: `orderedDocIds`가 배열이 아닐 때 400 에러 반환 확인. ✅ 코드 레벨 검증 (Line 117-123)

---

## [Phase 2: Frontend - 드래그 상태 관리]

**Before Start:**

- ⚠️ 주의: `StructureTab.tsx`의 기존 상태(`documents`, `isSelectionMode`, `selectedDocIds`)를 건드리지 마세요.
- ⚠️ 레거시: `DocumentCard.tsx`는 이미 `isDragging` prop을 지원합니다. 재사용하세요.

**Implementation Items:**

- [x] **DnD-F01**: 드래그 상태 변수 추가 ✅ 완료 (2026-01-08 20:32)

  - `Target`: `frontend/src/components/Assistant/StructureTab.tsx` > 컴포넌트 상단
  - `Logic (Pseudo)`:
    ```typescript
    // [DnD-F01] 드래그 앤 드롭 상태 관리
    const [reorderedDocs, setReorderedDocs] = useState<DocumentSummary[]>([]);
    const [isDragging, setIsDragging] = useState(false);
    const [dragSourceIndex, setDragSourceIndex] = useState<number | null>(null);
    const [dragTargetIndex, setDragTargetIndex] = useState<number | null>(null);
    ```
  - `Key Variables`:
    - `reorderedDocs` - 사용자가 조정한 순서 (AI 제안 또는 드래그 결과)
    - `dragSourceIndex` - 드래그 시작 위치 인덱스
    - `dragTargetIndex` - 드롭 대상 위치 인덱스
  - `Safety`: 초기값은 빈 배열/null로 설정

- [x] **DnD-F02**: AI 분석 결과를 reorderedDocs에 반영 ✅ 완료 (2026-01-08 20:41)

  - `Target`: `frontend/src/components/Assistant/StructureTab.tsx` > `handleAnalyze()` 내부
  - `Logic (Pseudo)`:
    ```typescript
    // AI 분석 완료 후 (기존 setSuggestion 호출 직후)
    if (data.suggestion?.suggestedOrder) {
      // suggestedOrder의 docId 순서대로 documents 재정렬
      const orderedDocs = data.suggestion.suggestedOrder
        .map((order) => documents.find((d) => d.id === order.docId))
        .filter(Boolean) as DocumentSummary[];
      setReorderedDocs(orderedDocs);
    }
    ```
  - `Key Variables`: `orderedDocs`
  - `Safety`: `.find()` 결과가 undefined일 수 있으므로 `.filter(Boolean)` 필수

- [x] **DnD-F03**: 드래그 이벤트 핸들러 구현 ✅ 완료 (2026-01-08 20:45)

  - `Target`: `frontend/src/components/Assistant/StructureTab.tsx`
  - `Logic (Pseudo)`:

    ```typescript
    // [DnD-F03] 드래그 시작
    const handleDragStart = (index: number) => {
      setIsDragging(true);
      setDragSourceIndex(index);
    };

    // [DnD-F03] 드래그 오버 (드롭 가능 영역 진입)
    const handleDragOver = (e: React.DragEvent, index: number) => {
      e.preventDefault(); // 필수! 없으면 드롭 불가
      if (dragSourceIndex !== index) {
        setDragTargetIndex(index);
      }
    };

    // [DnD-F03] 드래그 종료 (드롭)
    const handleDrop = () => {
      if (dragSourceIndex === null || dragTargetIndex === null) return;
      if (dragSourceIndex === dragTargetIndex) {
        resetDragState();
        return;
      }

      const newOrder = [...reorderedDocs];
      const [movedItem] = newOrder.splice(dragSourceIndex, 1);
      newOrder.splice(dragTargetIndex, 0, movedItem);

      setReorderedDocs(newOrder);
      resetDragState();
    };

    // [DnD-F03] 드래그 상태 초기화
    const resetDragState = () => {
      setIsDragging(false);
      setDragSourceIndex(null);
      setDragTargetIndex(null);
    };
    ```

  - `Key Variables`: `handleDragStart`, `handleDragOver`, `handleDrop`, `resetDragState`
  - `Safety`:
    - `e.preventDefault()` 필수 (없으면 브라우저 기본 동작으로 드롭 불가)
    - 같은 위치에 드롭 시 불필요한 상태 변경 방지

- [x] **DnD-F04**: DocumentCard에 드래그 속성 연결 ✅ 완료 (2026-01-08 20:47)

  - `Target`: `frontend/src/components/Assistant/StructureTab.tsx` > 렌더링 부분
  - `Logic (Pseudo)`:
    ```tsx
    {
      reorderedDocs.map((doc, index) => (
        <div
          key={doc.id}
          draggable
          onDragStart={() => handleDragStart(index)}
          onDragOver={(e) => handleDragOver(e, index)}
          onDrop={handleDrop}
          onDragEnd={resetDragState}
          className={`
          transition-all
          ${dragTargetIndex === index ? "border-t-4 border-prism-primary" : ""}
        `}
        >
          <DocumentCard
            id={doc.id}
            order={index + 1}
            title={doc.title}
            isDragging={isDragging && dragSourceIndex === index}
            // ... 기타 props
          />
        </div>
      ));
    }
    ```
  - `Key Variables`: `draggable`, `onDragStart`, `onDragOver`, `onDrop`, `onDragEnd`
  - `Safety`: `key`는 반드시 `doc.id` 사용 (index 사용 금지 - 드래그 시 버그 발생)

### 3.4. Phase 2 DoD (Definition of Done)

- [x] Test: AI 분석 후 카드를 드래그하여 순서 변경 가능한지 확인. ✅ 완료
- [x] Test: 드래그 중 소스 카드가 반투명(opacity)으로 표시되는지 확인. ✅ 완료
- [x] Test: 드롭 대상 위치에 파란색 가이드라인이 표시되는지 확인. ✅ 완료
- [x] Test: 같은 위치에 드롭 시 상태가 변경되지 않는지 확인. ✅ 완료

---

## [Phase 3: Frontend - 순서 저장 및 동기화]

**Before Start:**

- ⚠️ 주의: 기존 `handleApplyOrder` 함수는 AI 분석 결과만 저장합니다. 이를 `reorderedDocs` 기반으로 수정합니다.

**Implementation Items:**

- [ ] **DnD-F05**: handleApplyOrder 수정 (reorderedDocs 사용)

  - `Target`: `frontend/src/components/Assistant/StructureTab.tsx` > `handleApplyOrder()`
  - `Logic (Pseudo)`:

    ```typescript
    const handleApplyOrder = async () => {
      if (!currentProject?.id) {
        toast.error("프로젝트가 선택되지 않았습니다.");
        return;
      }

      // [DnD-F05] reorderedDocs 기반으로 순서 저장
      if (reorderedDocs.length === 0) {
        toast.error("저장할 순서가 없습니다.");
        return;
      }

      setIsApplying(true);

      try {
        const orderedDocIds = reorderedDocs.map((doc) => doc.id);

        const res = await fetch("/api/documents/reorder", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectId: currentProject.id,
            orderedDocIds,
          }),
        });

        if (!res.ok) {
          const errorData = await res.json();
          throw new Error(errorData.error || "Failed to save order");
        }

        toast.success("순서가 저장되었습니다!");
        setSuccessMessage("문서 순서가 성공적으로 적용되었습니다.");

        // [DnD-F05] documents 상태도 업데이트 ("내 문서" 탭 동기화용)
        setDocuments(reorderedDocs);
      } catch (error) {
        console.error("[handleApplyOrder] Error:", error);
        toast.error("순서 저장에 실패했습니다.");
        setError(error instanceof Error ? error.message : "Unknown error");
      } finally {
        setIsApplying(false);
      }
    };
    ```

  - `Key Variables`: `orderedDocIds`, `reorderedDocs`
  - `Safety`:
    - `currentProject?.id` null 체크 필수
    - `reorderedDocs.length === 0` 체크 (빈 배열 저장 방지)
    - try-catch로 API 실패 시 에러 핸들링

- [ ] **DnD-F06**: "내 문서" 탭 데이터 갱신

  - `Target`: `frontend/src/components/Assistant/StructureTab.tsx` 및 관련 Context
  - `Logic (Pseudo)`:

    ```typescript
    // handleApplyOrder 성공 시 documents 상태 업데이트
    setDocuments(reorderedDocs);

    // 만약 ProjectContext에서 documents를 관리한다면:
    // refreshDocuments() 또는 setProjectDocuments(reorderedDocs)
    ```

  - `Key Variables`: `setDocuments`, `refreshDocuments` (Context 의존)
  - `Safety`: Context 구조 확인 필요 (StructureTab 내부에서 로컬 상태로 관리 시 불필요)

**Definition of Done (검증):**

- [ ] Test: 드래그로 순서 변경 후 "이 순서로 적용" 클릭 시 DB에 저장되는지 확인.
- [ ] Test: 저장 성공 시 Toast 메시지("순서가 저장되었습니다!") 표시 확인.
- [ ] Test: 저장 후 "내 문서" 탭에서 변경된 순서대로 문서가 표시되는지 확인.
- [ ] Test: 저장 실패 시 에러 Toast 메시지 표시 확인.
- [ ] Review: 불필요한 console.log 제거 확인.

---

## [Phase 4: 통합 테스트 및 QA]

**Definition of Done (검증):**

- [ ] Test: 전체 플로우 - AI 분석 → 드래그 조정 → 저장 → "내 문서" 동기화 확인.
- [ ] Test: 선택 모드에서 일부 문서만 분석 → 결과 드래그 조정 가능 확인.
- [ ] Test: 브라우저 새로고침 후 저장된 순서가 유지되는지 확인.
- [ ] Test: 키보드 접근성 (Tab 이동, Enter 확정) 동작 확인. (선택 사항)
- [ ] Review: 주석 작성 확인 (`// [DnD-XXX]` 형식).

---

### [서명]

- **Tech Lead**: Antigravity 🖋️
- **Date**: 2026-01-08
