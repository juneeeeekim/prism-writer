# 🔧 JeDebug Analysis: RAFT Connection Checklist

**분석 일시**: 2025-12-28
**대상 문서**: `2512281835_RAFT_Connection_Checklist.md`

## 1. 🔧 로직 및 구현 보완 (Logic Fixes)

- [ ] **(Critical) `document_chunks` 테이블 스키마 불확실성 대응**

  - **원인**: 현재 `document_chunks` 테이블의 텍스트 컬럼명(`content` vs `chunk_content`)이 명확하지 않음. 사용자가 제공한 스키마는 `documents` 테이블이었음.
  - **수정 제안**: **[API-02]** 구현 시, 먼저 `document_chunks` 테이블의 컬럼을 동적으로 확인하거나, `try-catch`로 `content` 컬럼 조회를 시도하고 실패 시 로그를 남기도록 방어 로직 추가.
  - **위치**: `frontend/src/app/api/raft/context/route.ts` 구현 단계.

- [ ] **(Major) Context 길이 제한 로직 추가**
  - **원인**: 청크 개수(N개)만 제한할 경우, 청크 당 길이가 길면 LLM 컨텍스트 윈도우를 초과하거나 비용이 급증할 수 있음.
  - **수정 제안**: **[API-02]** 단계에서 `limit` 개수 외에 **"Total Character Limit" (예: 15,000자)** 조건을 추가하여, 합산 길이가 한도를 넘으면 더 이상 청크를 추가하지 않도록 구현.
  - **위치**: `frontend/src/app/api/raft/context/route.ts` Logic 부분.

## 2. 🚨 리스크 및 안전장치 (Risk Guardrails)

- [ ] **(Mid) 모델 선택 옵션의 하위 호환성 (Backend)**
  - **위험 요소**: 프론트엔드가 수정되기 전이나, 누군가 구버전 API를 호출할 경우 `modelId`가 없을 수 있음.
  - **방어 코드 추가 제안**: `POST /api/raft/generate`에서 `body.modelId`가 `undefined`일 경우, 반드시 **Config의 기본값(`gpt-4o-mini`)**으로 폴백하도록 명시.
  - **Ref**: `llm-usage-map.ts`의 `getModelForUsage('raft.generation')` 활용.

## 3. 🧪 검증 기준 구체화 (Test Criteria)

- [ ] **Data Connection - Happy Path**
  - 시나리오: "마케팅" 카테고리 선택 -> [DB 불러오기] 클릭 -> `isFetching` 로딩 표시 -> 텍스트 영역에 마케팅 관련 청크 텍스트가 채워짐.
- [ ] **Data Connection - Empty Case**
  - 시나리오: 데이터가 없는 "새 카테고리" 선택 -> [DB 불러오기] 클릭 -> "관련 문서가 없습니다" 알림(Toast/Alert) 표시. (에러 아님)

## 4. 최종 판단 (Decision)

- [ ] 상태 선택: ✅ 즉시 진행 가능 (단, 위 보완 사항을 Phase 2 구현 시 반영할 것)

---

## 📝 Refined Checklist (Approved Version)

### [Phase 1: Config & Centralization]

**Before Start:**

- 영향받는 파일: `frontend/src/config/llm-usage-map.ts`

**Implementation Items:**

- [ ] **Config-01**: `LLMUsageContext` 타입 확장
  - `Target`: `frontend/src/config/llm-usage-map.ts`
  - `Detail`: `LLMUsageContext` 유니온 타입에 `'raft.generation'` 추가.
- [ ] **Config-02**: `UsageConfig` 매핑 추가
  - `Target`: `frontend/src/config/llm-usage-map.ts`
  - `Detail`: `LLM_USAGE_MAP`에 `raft.generation` 키 추가.
    - `modelId`: `'gpt-4o-mini'`
    - `description`: `'RAFT 합성 데이터 생성'`
- [ ] **Config-03**: 모델 목록 상수 정의
  - `Target`: `frontend/src/constants/raft.ts`
  - `Detail`: `RAFT_AVAILABLE_MODELS` export.

### [Phase 2: Backend API Upgrade]

**Before Start:**

- 영향받는 파일: `frontend/src/app/api/raft/generate/route.ts`
- 신규 파일: `frontend/src/app/api/raft/context/route.ts`

**Implementation Items:**

- [ ] **API-01**: Generate API `modelId` 파라미터 처리 (Safe Fallback)
  - `Target`: `frontend/src/app/api/raft/generate/route.ts`
  - `Detail`: `const modelId = body.modelId || getModelForUsage('raft.generation')` 로직 적용.
- [ ] **API-02**: Context Fetch API 구현 (With Schema Guard)
  - `Target`: `frontend/src/app/api/raft/context/route.ts` [NEW]
  - `Detail`:
    1. `documents` 테이블에서 카테고리 일치 `id` 조회.
    2. `document_chunks`에서 `content` 컬럼 조회 (만약 에러 시 `text` 컬럼 시도 등 유연성 확보 권장).
    3. **Logic**: 최대 15,000자 또는 20개 청크 제한 적용.
    4. 결과 반환.

### [Phase 3: Frontend UI Upgrade]

**Before Start:**

- 영향받는 파일: `frontend/src/components/admin/SyntheticDataPanel.tsx`

**Implementation Items:**

- [ ] **UI-01**: 모델 선택 드롭다운 구현.
- [ ] **UI-02**: "Context Source" 탭 UI 구현 (수동/DB).
- [ ] **UI-03**: DB Fetch 연동 (빈 결과 처리 포함).

### [Phase 4: Integrated Verification]

- [ ] **E2E Test**: 전체 흐름(카테고리 -> DB Fetch -> 모델 선택 -> 생성) 검증.
