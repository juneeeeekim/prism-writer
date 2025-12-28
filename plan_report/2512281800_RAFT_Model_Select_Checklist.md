# 📋 RAFT 모델 선택 및 중앙화 업그레이드 체크리스트

**작성일**: 2025-12-28
**작성자**: Tech Lead (JeDebug Approved)
**목표**: 하드코딩된 RAFT LLM 모델 설정을 `llm-usage-map.ts`로 중앙화하고, 사용자가 UI에서 모델을 선택할 수 있도록 개선합니다.

---

## 🏗️ 1. Architecture & Design

### 1-1. 중앙화 전략 (Centralization)

- **파일**: `frontend/src/config/llm-usage-map.ts`
- **Context 추가**: `raft.generation`
- **지원 모델**:
  - `gpt-4o-mini` (Default, Fast & Cheap)
  - `gpt-4o` (High Quality)
  - `gemini-1.5-flash` (Alternative)

### 1-2. UI 설계

- **위치**: `SyntheticDataPanel.tsx` -> "Generation Info" 영역 또는 카테고리 선택 하단.
- **컴포넌트**: 표준 `<select>` 또는 디자인 통일성을 위해 `CategoryCombobox` 스타일을 차용한 심플 드롭다운.
- **동작**: 모델 변경 시 상태 업데이트 -> 생성 요청 시 API로 전달.

### 1-3. API 설계

- **Endpoint**: `POST /api/raft/generate`
- **Request Body**: `{ ..., modelId?: string }` 추가.
- **Validation**: 요청된 `modelId`가 허용된 목록인지 검증 (Optional, Admin 기능이므로 유연하게 허용 가능하지만, 안전을 위해 화이트리스트 권장).

---

## ✅ 2. Implementation Checklist

### [Phase 1: Config & Centralization]

- [ ] **Config-01**: `llm-usage-map.ts` 타입 정의 업데이트
  - `LLMUsageContext`에 `'raft.generation'` 추가.
- [ ] **Config-02**: 매핑 데이터 추가
  - `raft.generation`에 대한 `UsageConfig` (모델 ID, 설명 등) 정의.
- [ ] **Config-03**: 모델 목록 상수화 (UI용)
  - UI에서 선택 가능한 모델 목록(`RAFT_AVAILABLE_MODELS`)을 정의 (위치: `constants/raft.ts` 또는 `config/models.ts` 검토).

### [Phase 2: Backend API Update]

- [ ] **API-01**: Request Body 파싱 업데이트
  - `modelId` 파라미터 수신.
- [ ] **API-02**: LLM 호출 로직 변경
  - 하드코딩된 `'gpt-4o-mini'`를 `modelId || getModelForUsage('raft.generation')`로 교체.
  - `generateTextWithTimeout` 함수 시그니처 변경 또는 클로저 활용.

### [Phase 3: Frontend UI Update]

- [ ] **UI-01**: State 추가
  - `const [selectedModel, setSelectedModel] = useState<string>(...)`
- [ ] **UI-02**: 모델 선택 드롭다운 구현
  - "모델 선택" 섹션 추가.
- [ ] **UI-03**: API 연동
  - `generateSyntheticDataAPI` 함수 시그니처 변경 (modelId 인자 추가).
  - `SyntheticDataPanel`에서 호출 시 선택된 모델 전달.

---

## 🧪 3. Verification Plan

- [ ] **Config Test**: `config/llm-usage-map.ts`에서 타입 에러(Syntax) 없는지 확인.
- [ ] **UI Test**: 브라우저에서 모델 변경 시 드롭다운 반영 확인.
- [ ] **API Test**:
  - `gpt-4o` 선택 후 생성 요청 -> 로그에서 `model: gpt-4o` 사용 확인.
  - `gpt-4o-mini` 선택 후 생성 요청 -> 정상 동작 확인.
