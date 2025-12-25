# Intelligent Reference Studio Implementation Checklist

**File**: 2512260050_Reference_Studio_Checklist.md
**Related**: 2512260045_Intelligent_Reference_Studio_Plan.md

---

## 🗓️ Phase 1: Layout Restructuring & Document Card

**목표**: 기존의 단순 리스트 뷰를 "Card List + Detail Panel"의 2단 레이아웃으로 변경하여 능동적인 작업 공간을 만듭니다.

### 1-1. `ReferenceTab` 레이아웃 분리

- [x] **[영향 파악]** 기존 `ReferenceTab.tsx`의 `showUploader` 로직과 리스트 렌더링 로직 확인
- [x] **[Component]** `frontend/src/components/Assistant/ReferenceTab.tsx`
  - [x] 좌측(30%): `DocumentListPanel` (신규 컴포넌트 분리 권장)
  - [x] 우측(70%): `ActiveContextPanel` (신규, 선택된 문서 상세)
  - [x] 선택된 문서 ID를 관리하는 State 추가: `const [selectedDocId, setSelectedDocId] = useState<string | null>(null)`

### 1-2. `DocumentCard` UI 컴포넌트 고도화

- [x] **[Component]** `frontend/src/components/Assistant/ReferenceItem.tsx` -> `DocumentCard.tsx`로 리팩토링
  - [x] **[UI]** 3줄 요약 텍스트 영역 (Placeholder) 추가
  - [x] **[UI]** 태그(Badge) 영역 추가
  - [x] **[Interaction]** 클릭 시 `onSelect` 이벤트 발생하여 `ReferenceTab`의 상태 업데이트
- [x] **[Style]** Hover 효과 및 Selected 상태 스타일링 (Ring, Background Color)

### 📤 Phase 1 검증

- [x] `npm run dev` 실행 및 에러 없음 확인
- [x] 브라우저: 파일 목록이 좌측에, 선택 시 우측에 빈 패널이 뜨는지 확인
- [x] 브라우저: 카드 클릭 시 선택 상태(하이라이트) 변경 확인

---

## 🗓️ Phase 2: Chunk Data Fetching & Visualization

**목표**: 선택한 문서의 내부 지식(Chunks)을 시각화합니다.

### 2-1. Chunk Fetch Hook 구현

- [x] **[API]** `frontend/src/hooks/useChunks.ts` 생성
  - [x] Supabase `rag_chunks` 테이블 조회 (RLS 정책 확인 필요)
  - [x] `useQuery` 또는 `useEffect`로 `selectedDocId` 변경 시 데이터 패치

### 2-2. `ChunkList` 컴포넌트 구현

- [x] **[Component]** `frontend/src/components/Assistant/ChunkList.tsx` 생성
  - [x] **[UI]** 각 청크를 카드 형태로 나열
  - [x] **[Info]** 청크 인덱스, 내용(content), 벡터 ID 표시
- [x] **[Integration]** `ActiveContextPanel` 내부에 `ChunkList` 배치

### 📤 Phase 2 검증

- [x] 브라우저: 문서를 클릭하면 우측에 해당 문서의 청크들이 리스트로 표시됨
- [x] 데이터: 실제 `rag_chunks` 데이터와 UI 일치 확인

---

## 🗓️ Phase 3: Interactive Knowledge Editing (Edit & Pin)

**목표**: 사용자가 지식을 직접 수정하고 고정(Pin)할 수 있게 합니다.

### 3-1. Chunk Editing UI

- [x] **[Component]** `ChunkCard.tsx` (ChunkList 내부 아이템)
  - [x] **[State]** `isEditing` 모드 토글
  - [x] **[Action]** 텍스트 수정 후 저장 버튼
  - [x] **[Action]** `Pin` 아이콘 버튼 (토글)

### 3-2. Update Logic 구현

- [x] **[Logic]** `updateChunk(chunkId, newContent, isPinned)` 함수 구현
  - [x] **[Warning]** 내용 수정 시 임베딩 재생성 필요 여부 정책 결정 (일단 텍스트만 수정 or 재임베딩)
  - [x] **[DB]** `rag_chunks` 테이블 업데이트 (RPC 또는 직접 Update)

### 📤 Phase 3 검증

- [x] 브라우저: 청크 내용을 수정하고 저장했을 때 UI에 반영됨
- [x] 브라우저: Pin 버튼 클릭 시 아이콘 상태 변경됨
- [x] 데이터: 새로고침 후에도 수정된 내용과 Pin 상태 유지됨

---

## 🗓️ Phase 4: UX Polish & Auto-Summary (Wow Factor)

**목표**: "살아있는 시스템"의 느낌을 주고 사용자 경험을 완성합니다.

### 4-1. Auto-Summary 표시

- [ ] **[Logic]** 문서 업로드 완료 시 간단한 요약 정보 표시 (Mockup 또는 실제 LLM 연동)
- [ ] **[UI]** `DocumentCard`에 요약 텍스트 바인딩

### 4-2. Empty State & Guide

- [ ] **[UI]** 문서가 없을 때: "여기로 파일을 드래그하여 지식을 추가하세요" 애니메이션 영역
- [ ] **[UI]** 청크가 없을 때: "분석 중..." 스피너 또는 상태 메시지

### 📤 Phase 4 검증

- [ ] 전체 UX 흐름이 자연스러운지 확인 (업로드 -> 선택 -> 확인 -> 수정)
- [ ] 다크모드 점검

---

## ✅ 최종 완료 체크리스트

- [ ] 모든 Phase의 기능이 브라우저에서 정상 동작함
- [ ] 기존 RAG 검색(`handleSearch`)에 영향 없음 확인
- [ ] 콘솔 에러 없음
- [ ] 코드 스타일(Prettier/ESLint) 준수
