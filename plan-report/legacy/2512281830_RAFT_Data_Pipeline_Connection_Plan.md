# 🏗️ RAFT Data Pipeline Connection & Model Selection Plan

**작성일**: 2025-12-28
**목표**: RAFT 데이터 생성 시 "Vector DB 연동"과 "모델 선택" 기능을 추가하여 파이프라인 완성도를 높임.

---

## 1. Problem Statement

1.  **데이터 단절 (Data Disconnect)**: RAFT UI에서 카테고리를 선택해도, 해당 카테고리의 실제 데이터(Chunks)를 가져오지 못해 사용자가 수동으로 Context를 입력해야 함.
2.  **모델 고정 (Hardcoded Model)**: `gpt-4o-mini`로 고정되어 있어, 고품질 생성이 필요할 때 모델을 변경할 수 없음.

## 2. Solution: Data Pipeline Connection

### 2-1. Context Source 모드 (신규 기능)

사용자가 Context를 입력하는 방식을 두 가지로 확장합니다.

1.  **✍️ 직접 입력 (Direct Input)**

    - 기존 방식 유지.
    - 사용자가 텍스트를 직접 복사/붙여넣기.

2.  **🗄️ DB에서 불러오기 (Fetch from DB)**
    - **Trigger**: "DB 불러오기" 버튼 클릭.
    - **Logic**:
      1.  선택된 `Category`에 속하는 `documents` 조회.
      2.  해당 문서들의 `document_chunks`를 검색 (Random Sampling or Latest).
      3.  가져온 청크 텍스트들을 병합하여 `Context` 입력창에 자동 삽입.
    - **Benefit**: 사용자는 카테고리만 선택하면, 관련된 내부 지식(Knowledge)이 자동으로 프롬프트에 주입됨.

## 3. Solution: Model Selection

### 3-1. 모델 선택 UI (신규 기능)

- **위치**: 생성 패널 하단 또는 카테고리 옆.
- **옵션**:
  - `GPT-4o Mini` (Default, Fast)
  - `GPT-4o` (High Quality)
  - `Gemini 1.5 Flash` (Alternative)
- **설정**: `llm-usage-map.ts`에서 중앙 관리.

---

## 4. Implementation Steps

### Phase 1: Config & Centralization

- `llm-usage-map.ts`에 `raft.generation` 컨텍스트 추가.

### Phase 2: Backend API Upgrade

- `POST /api/raft/generate`: `modelId` 파라미터 수신 처리.
- `GET /api/raft/context` (NEW): 카테고리 기반 청크 조회 API 신설.
  - Input: `category`, `limit`
  - Output: `text` (Combined chunks)

### Phase 3: Frontend UI Upgrade

- `CategoryCombobox` 연동.
- "Context Source" 탭 UI (Direct / DB) 구현.
- "모델 선택" 드롭다운 구현.

### Phase 4: Verification

- 실제 카테고리 데이터 Fetch 테스트.
- 모델 변경 후 생성 로그 확인.
