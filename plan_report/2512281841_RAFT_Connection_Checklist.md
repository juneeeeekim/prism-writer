# 📋 RAFT Data Pipeline & Model Select Implementation Checklist

**작성일**: 2025-12-28
**작성자**: Tech Lead (Based on JeDebug Plan)
**기반 문서**: `2512281830_RAFT_Data_Pipeline_Connection_Plan.md`
**배포 상태**: Not Started

---

## 1. File & Structure Decision

### 🏗️ 파일 구성 전략

- **FE/BE 분리 유지**:
  - 설정 (`llm-usage-map.ts`)은 Frontend Config로 관리.
  - API (`route.ts`)는 Backend Logic으로 분리하여 보안 및 유지보수성 확보.
- **UI 컴포넌트 통합**:
  - `SyntheticDataPanel.tsx` 내부에 새로운 탭 UI ("직접 입력" vs "DB 불러오기")를 추가하여 사용자 경험을 통합.
  - 별도 컴포넌트 분리보다는 `SyntheticDataPanel`의 기능 확장으로 접근 (Context 관리 용이성).

### 📂 저장 위치

- 문서: `plan_report/2512281835_RAFT_Connection_Checklist.md`
- 추가 API: `frontend/src/app/api/raft/context/route.ts` (신규)

---

## 2. Checklist Content

### [Phase 1: Config & Centralization]

**Before Start:**

- 영향받는 파일: `frontend/src/config/llm-usage-map.ts`

**Implementation Items:**

- [x] **Config-01**: `LLMUsageContext` 타입 확장
  - `Target`: `frontend/src/config/llm-usage-map.ts`
  - `Detail`: `LLMUsageContext` 유니온 타입에 `'raft.generation'` 추가.
- [x] **Config-02**: `UsageConfig` 매핑 추가
  - `Target`: `frontend/src/config/llm-usage-map.ts`
  - `Detail`: `LLM_USAGE_MAP`에 `raft.generation` 키 추가.
    - `modelId`: `'gpt-4o-mini'` (Default)
    - `fallback`: `'gpt-3.5-turbo'` (Optional)
    - `description`: `'RAFT 합성 데이터 생성'`
- [x] **Config-03**: 모델 목록 상수 정의
  - `Target`: `frontend/src/constants/raft.ts` (없으면 생성 또는 `constants/llm.ts`)
  - `Detail`: UI 드롭다운용 배열 `RAFT_AVAILABLE_MODELS` export.
    - `[{ id: 'gpt-4o-mini', name: 'GPT-4o Mini (Fast)' }, { id: 'gpt-4o', name: 'GPT-4o (High Quality)' }, ...]`

**Verification:**

- [x] Syntax Check: `npx tsc --noEmit` (Typescript 오류 없음 확인)

---

### [Phase 2: Backend API Upgrade]

**Before Start:**

- 영향받는 파일: `frontend/src/app/api/raft/generate/route.ts`
- 신규 파일: `frontend/src/app/api/raft/context/route.ts`

**Implementation Items:**

- [x] **API-01**: Generate API `modelId` 파라미터 처리 (Safe Fallback)
  - `Target`: `frontend/src/app/api/raft/generate/route.ts`
  - `Detail`:
    1. Request Body에서 `modelId` 추출.
    2. `modelId`가 없거나 유효하지 않으면 **Config의 기본값**으로 폴백 (`getModelForUsage` 활용).
    3. OpenAI 호출 시 동적 모델 ID 사용.
- [x] **API-02**: Context Fetch API 구현 (With Schema Guard)
  - `Target`: `frontend/src/app/api/raft/context/route.ts` [NEW]
  - `Detail`:
    1. **Auth**: Admin 권한 체크.
    2. **Schema Guard**: `document_chunks`의 텍스트 컬럼(`content` vs `text`) 불확실성 대응 (Try-catch 또는 동적 확인).
    3. **Logic**: 상위 N개 청크 조회 후, **최대 15,000자**까지만 병합 (Context Explosion 방지).
    4. **Response**: 청크 텍스트들을 `\n\n`으로 합쳐서 JSON 반환.
  - `Quality`: DB 조회 실패 시 Graceful Error Handling (500 대신 빈 컨텍스트 또는 명확한 에러 메시지).

**Verification:**

- [x] API Test (Generate): Postman/Curl로 `modelId` 변경하며 호출 -> 응답 확인.
- [x] API Test (Context): 특정 카테고리로 요청 시 텍스트 반환 확인.

---

### [Phase 3: Frontend UI Upgrade]

**Before Start:**

- 영향받는 파일: `frontend/src/components/admin/SyntheticDataPanel.tsx`

**Implementation Items:**

- [x] **UI-01**: 모델 선택 드롭다운 추가
  - `Target`: `frontend/src/components/admin/SyntheticDataPanel.tsx`
  - `Detail`:
    - `selectedModel` State 추가 (초기값: Config 기본값).
    - "카테고리" 섹션 근처에 `<select>` 또는 커스텀 드롭다운 배치.
    - `RAFT_AVAILABLE_MODELS` 상수 매핑.
- [x] **UI-02**: Context Source 탭 UI 구현
  - `Target`: `frontend/src/components/admin/SyntheticDataPanel.tsx`
  - `Detail`:
    - **Tab UI**: `[ ✏️ 직접 입력 ] [ 🗄️ DB에서 불러오기 ]`
    - **State**: `contextSource` ('manual' | 'db').
    - 'DB에서 불러오기' 선택 시:
      - "선택된 카테고리: {category}" 표시.
      - "불러오기" 버튼 표시.
- [x] **UI-03**: DB Fetch 연동 동작 구현
  - `Target`: `frontend/src/components/admin/SyntheticDataPanel.tsx`
  - `Detail`:
    - "불러오기" 버튼 클릭 핸들러: `/api/raft/context` 호출.
    - 로딩 상태 (`isFetchingContext`) 표시.
    - 성공 시 `context` State에 결과 텍스트 덮어쓰기 (User Confirm 필요 시 Alert).

**Verification:**

- [x] UI Test: 모델 변경 시 State 반영 확인.
- [x] UX Test: "DB 불러오기" 클릭 -> 로딩 스피너 -> 텍스트 채워짐 확인.
- [x] Integration: 채워진 텍스트 + 선택된 모델로 "생성 시작" -> 성공 확인.

---

### [Phase 4: Integrated Verification]

- [x] **E2E Test**: 브라우저에서 [카테고리 선택] -> [DB 불러오기] -> [모델 변경] -> [생성] 전체 흐름 테스트.
