# Intelligent Reference Studio Architecture Plan

**Date**: 2025-12-26
**Topic**: "참고자료(Reference)" 탭을 능동적 지식 편집 스튜디오로 업그레이드
**Goal**: Cursor AI의 Context Transparency(컨텍스트 투명성 및 제어) 개념을 도입하여 사용자가 RAG 지식을 직접 관리하게 함.

---

## 🏗️ 아키텍처 및 디자인 명세

### 1. UX/UI Design Concept (Active Context Workspace)

- **Layout**: 2-Column or Collapsible Layout
  - **Left (File Drawer)**: 업로드된 파일 목록 (Card Text + Status Icon)
  - **Right/Main (Knowledge Board)**: 선택된 파일의 상세 정보 (요약, 태그, 청크 리스트)
- **Interaction**:
  - **Click**: 파일 클릭 시 상세 정보 확장
  - **Drag & Drop**: 파일 업로드 영역 시각화
  - **Edit**: 청크 텍스트 직접 수정 가능
  - **Pin**: 특정 청크를 고정 핀으로 활성화

### 2. Technical Architecture

#### A. Frontend Components

1.  **`ReferenceTab.tsx` (Container)**
    - Main layout manager.
    - Manages selected document state.
2.  **`DocumentCard.tsx` (Enhancement)**
    - Displays summary (3 lines) and auto-tags.
3.  **`ChunkEditor.tsx` (New)**
    - Lists chunks associated with a document.
    - Provides edit/delete/pin actions.
4.  **`ContextVisualizer.tsx` (Optional/Wow Factor)**
    - Visual representation of document processing status.

#### B. State Management (`useDocumentStatus.ts` enhancement)

- Current: Polling for document status.
- New: Fetch chunks for selected document (`useChunks`).
- New: Update chunk content/status (`updateChunk`).

#### C. Backend API Integration

- **GET /api/rag/chunks?documentId={id}**: 문서의 청크 목록 조회
- **PATCH /api/rag/chunks/{chunkId}**: 청크 내용 수정 (Pinning 포함)
- **POST /api/rag/summarize**: (Upload 후 자동 트리거) 문서 요약 생성

---

## 📋 파일 구조 결정 (Rationale)

이 프로젝트는 UI/UX 변경과 데이터 핸들링이 복합적이므로, 관리 효율성을 위해 3개의 문서로 분리합니다.

1.  **`2512260045_Intelligent_Reference_Studio_Plan.md` (본 문서)**

    - **목적**: 전체 아키텍처, 디자인 컨셉, 기술적 접근 방식 합의
    - **대상**: 시니어 개발자, 디렉터

2.  **`2512260050_Reference_Studio_Checklist.md`**

    - **목적**: 실제 개발을 위한 단계별(Phase) 실행 체크리스트
    - **대상**: 주니어 개발자, 시니어 개발자 (Code Review)
    - **특징**: 구체적인 파일명, 함수명, 검증 조건 포함

3.  **`2512260055_Reference_Studio_JeDebug_Analysis.md`**
    - **목적**: 위험 요소 식별, 롤백 전략, 품질 보증(QA)
    - **대상**: 시니어 개발자, QA 담당, 디렉터
    - **특징**: JeDebug 포맷 준수 (Risk, Edge Case, Test Scenario)

---

## 🗓️ Implementation Phases

### Phase 1: Structure & Basic View (레이아웃 개편)

- 기존 단순 리스트를 Card List + Detail View 구조로 변경.
- "지식 카드" UI 구현.

### Phase 2: Chunk Visualization (청크 뷰어)

- 선택된 문서의 청크 데이터를 불러오는 API 연동.
- 청크 리스트 렌더링.

### Phase 3: Interactive Editing (지식 편집)

- 청크 내용 수정 기능.
- Pinning(고정) 로직 구현.

### Phase 4: Polish & UX (자동 요약 및 시각화)

- 문서 업로드 시 간단한 요약 및 태그 생성.
- 진행 상태 애니메이션.

---

## 👥 R&R (Role & Responsibility)

- **시니어 개발자**: API 설계 및 데이터 구조 검증, JeDebug 위험 분석.
- **주니어 개발자**: UI 컴포넌트 구현, 상태 관리 로직 작성, 단위 테스트.
- **UX 전문가**: 레이아웃 배치, 애니메이션 타이밍, 마이크로 카피 작성.
