# AI Structurer: Drag & Drop 순서 편집 기능 기술 개발 문서

**문서 번호:** 2601082023_Structure_DnD_Reorder_Spec  
**작성일:** 2026-01-08  
**작성자:** Antigravity (Tech Lead), Alex Kim (UX), Jay Park (Frontend)  
**승인자:** 디렉터  
**상태:** ✅ 승인됨

---

## 📋 Executive Summary

본 문서는 "AI Structurer" 기능에 **사용자 수동 순서 편집(Drag & Drop)** 기능을 추가하기 위한 기술 사양서입니다.

### 핵심 결정 사항

- **채택된 방식:** Phase 2 - AI 제안 + 사용자 수정 혼합 모드 (만장일치)
- **동기화 범위:** "구조" 탭에서 변경된 순서는 "내 문서" 탭에 즉시 반영
- **데이터 저장:** 기존 `sort_order` 컬럼 활용 (추가 스키마 변경 없음)

---

## 1. 배경 및 목표

### 1.1. 현재 상태

- AI가 문서 순서를 제안하면, 사용자는 **"수락" 또는 "거절"**만 선택 가능
- 부분 수정이 불가능하여 사용자 통제감(Sense of Control) 부족

### 1.2. 목표

1. **사용자가 AI 제안을 받은 후, 원하는 부분만 드래그로 조정**할 수 있도록 함
2. **변경된 순서가 DB에 저장**되어 "내 문서" 탭과 동기화
3. AI는 조언자, **최종 결정권은 사용자**에게 부여

---

## 2. 사용자 플로우 (User Flow)

```
┌─────────────────────────────────────────────────────────────────────┐
│                          [구조 탭]                                   │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  1️⃣ [AI 분석] 버튼 클릭                                              │
│       ↓                                                             │
│  2️⃣ AI가 최적 순서 제안 (카드 형태로 표시)                             │
│       ↓                                                             │
│  3️⃣ 사용자가 카드를 드래그하여 순서 조정 (선택적)                       │
│       ↓                                                             │
│  4️⃣ [이 순서로 적용] 버튼 클릭                                        │
│       ↓                                                             │
│  5️⃣ DB의 sort_order 업데이트                                        │
│       ↓                                                             │
│  6️⃣ "내 문서" 탭에도 새 순서 반영 (동기화 완료)                         │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 3. 기술 설계 (Technical Design)

### 3.1. 컴포넌트 구조

```
StructureTab.tsx
├── Header (제목 + 모드 토글)
├── DocumentCardList (드래그 가능한 카드 목록) ← 신규/수정
│   ├── DraggableCard (개별 카드) ← 신규
│   └── DropZone (드롭 영역) ← 신규
├── AnalyzeButton (AI 분석 버튼)
├── ResultPanel (분석 결과 표시)
└── ApplyButton (순서 적용 버튼)
```

### 3.2. 상태 관리 (State Management)

```typescript
// StructureTab.tsx 내부 상태
interface StructureTabState {
  // 기존 상태
  documents: DocumentSummary[];
  suggestion: StructureSuggestion | null;

  // 신규 상태 (Drag & Drop 용)
  reorderedDocs: DocumentSummary[]; // 사용자가 조정한 순서
  isDragging: boolean; // 드래그 중 여부
  dragSourceIndex: number | null; // 드래그 시작 인덱스
  dragTargetIndex: number | null; // 드롭 대상 인덱스
}
```

### 3.3. 핵심 함수

#### 3.3.1. 드래그 핸들러

```typescript
// 드래그 시작
const handleDragStart = (index: number) => {
  setIsDragging(true);
  setDragSourceIndex(index);
};

// 드래그 중 (위치 추적)
const handleDragOver = (index: number) => {
  if (dragSourceIndex === null) return;
  setDragTargetIndex(index);
};

// 드롭 (순서 변경)
const handleDrop = () => {
  if (dragSourceIndex === null || dragTargetIndex === null) return;

  const newOrder = [...reorderedDocs];
  const [movedItem] = newOrder.splice(dragSourceIndex, 1);
  newOrder.splice(dragTargetIndex, 0, movedItem);

  setReorderedDocs(newOrder);
  setIsDragging(false);
  setDragSourceIndex(null);
  setDragTargetIndex(null);
};
```

#### 3.3.2. 순서 저장 API

```typescript
// API: PATCH /api/documents/reorder
// Body: { projectId: string, orderedDocIds: string[] }

const handleApplyOrder = async () => {
  const orderedDocIds = reorderedDocs.map((doc) => doc.id);

  const response = await fetch("/api/documents/reorder", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      projectId: currentProject.id,
      orderedDocIds,
    }),
  });

  if (response.ok) {
    toast.success("순서가 저장되었습니다!");
    // "내 문서" 탭 데이터 갱신 트리거
    refreshDocuments();
  }
};
```

### 3.4. Backend API 설계

#### 3.4.1. 신규 API 엔드포인트

| Method  | Endpoint                 | 설명                    |
| ------- | ------------------------ | ----------------------- |
| `PATCH` | `/api/documents/reorder` | 문서 순서 일괄 업데이트 |

#### 3.4.2. API Pseudo-code

```typescript
// frontend/src/app/api/documents/reorder/route.ts

export async function PATCH(request: NextRequest) {
  // 1. 인증 확인
  const supabase = createRouteClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // 2. 파라미터 파싱
  const { projectId, orderedDocIds } = await request.json();

  // 3. 프로젝트 소유권 확인
  const { data: project } = await supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .eq("user_id", user.id)
    .single();

  if (!project)
    return NextResponse.json({ error: "Not Found" }, { status: 404 });

  // 4. sort_order 일괄 업데이트
  for (let i = 0; i < orderedDocIds.length; i++) {
    await supabase
      .from("user_documents")
      .update({ sort_order: i + 1 })
      .eq("id", orderedDocIds[i])
      .eq("project_id", projectId);
  }

  return NextResponse.json({
    success: true,
    updatedCount: orderedDocIds.length,
  });
}
```

---

## 4. UI/UX 사양

### 4.1. 드래그 앤 드롭 시각적 피드백

| 상태                        | 시각적 표현                                    |
| --------------------------- | ---------------------------------------------- |
| **Idle (기본)**             | 카드 우측에 드래그 핸들 아이콘 (⠿)             |
| **Dragging (드래그 중)**    | 드래그 중인 카드 반투명(opacity: 0.5) + 그림자 |
| **Drop Target (드롭 대상)** | 대상 위치에 파란색 가이드 라인 표시            |
| **After Drop (드롭 완료)**  | 카드가 새 위치로 이동 + 짧은 애니메이션        |

### 4.2. 접근성 (Accessibility)

- **키보드 지원:** `Space`로 선택, `Arrow Up/Down`으로 이동, `Enter`로 확정
- **스크린 리더:** "문서 [제목]을 [N]번째 위치로 이동했습니다" 안내

---

## 5. 구현 체크리스트

### Phase 2-DnD: Drag & Drop 순서 편집

**Backend:**

- [ ] **DnD-B01:** `/api/documents/reorder` 엔드포인트 생성
- [ ] **DnD-B02:** 프로젝트 소유권 검증 로직 추가
- [ ] **DnD-B03:** 일괄 `sort_order` 업데이트 로직 구현

**Frontend:**

- [ ] **DnD-F01:** `DraggableDocumentCard` 컴포넌트 생성
- [ ] **DnD-F02:** `StructureTab`에 드래그 상태 관리 추가
- [ ] **DnD-F03:** 드래그/드롭 이벤트 핸들러 구현
- [ ] **DnD-F04:** 시각적 피드백 (반투명, 가이드라인) 구현
- [ ] **DnD-F05:** "내 문서" 탭 동기화 (데이터 새로고침)

**Testing:**

- [ ] **DnD-T01:** 드래그로 순서 변경 후 DB에 정상 저장되는지 확인
- [ ] **DnD-T02:** "내 문서" 탭에서 변경된 순서대로 표시되는지 확인
- [ ] **DnD-T03:** AI 분석 후 사용자가 일부만 수정하여 저장 가능 확인

---

## 6. 일정 및 리소스

| 항목         | 담당자      | 예상 소요 시간 |
| ------------ | ----------- | :------------: |
| Backend API  | Antigravity |     1시간      |
| Frontend DnD | Jay Park    |     2시간      |
| UI/UX 피드백 | Alex Kim    |    0.5시간     |
| 테스트 & QA  | 전원        |    0.5시간     |
| **총합**     |             |   **4시간**    |

---

## 7. 리스크 및 대응

| 리스크                   | 영향도 | 대응 방안                                                        |
| ------------------------ | :----: | ---------------------------------------------------------------- |
| 드래그 라이브러리 호환성 |   중   | 네이티브 HTML5 Drag API 우선 사용, 필요시 `@dnd-kit` 도입        |
| 동시 편집 충돌           |   낮   | 현재 단일 사용자 환경, 향후 낙관적 잠금(Optimistic Locking) 고려 |
| 성능 이슈 (다량 문서)    |   낮   | 가상화(Virtualization) 도입 검토                                 |

---

## 8. 승인

| 역할          | 이름        | 서명 | 날짜       |
| ------------- | ----------- | ---- | ---------- |
| **디렉터**    | (서명 대기) | 🖋️   | 2026-01-08 |
| **Tech Lead** | Antigravity | 🖋️   | 2026-01-08 |
| **UX 전문가** | Alex Kim    | 🖋️   | 2026-01-08 |
| **Frontend**  | Jay Park    | 🖋️   | 2026-01-08 |

---

## 📎 관련 문서

- [2601072321_AI_Structurer_Architecture.md](./2601072321_AI_Structurer_Architecture.md) - AI Structurer 기본 아키텍처
- [2601081853*Structure_Selective_Option*체크리스트.md](./2601081853_Structure_Selective_Option_체크리스트.md) - 선택적 분석 구현 체크리스트
