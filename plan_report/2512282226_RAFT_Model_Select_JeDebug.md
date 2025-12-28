# JeDebug 분석: RAFT 모델 선택 체크리스트

> **문서 ID**: 2512282226_RAFT_Model_Select_JeDebug  
> **분석 대상**: `2512282220_RAFT_Model_Select_Checklist.md`  
> **작성일**: 2025-12-28

---

## 1) 🔧 로직 및 구현 보완 (Logic Fixes)

### ⚠️ (Critical) 체크리스트 자체가 이미 구현된 기능을 다시 구현하려 함

- [x] 원인: 체크리스트 작성 시점에 이미 Phase 1~3가 완료되어 있었으나, 확인하지 않고 작성됨
- [x] **수정 제안**: 체크리스트 전체를 "검증 체크리스트"로 변경하거나, 이미 완료된 항목 표시
- [x] 파일/위치: `2512282220_RAFT_Model_Select_Checklist.md` 전체

#### 증거:

**Config-01~03**: ✅ 이미 완료

- `llm-usage-map.ts` Line 33: `'raft.generation'` 이미 존재
- `llm-usage-map.ts` Line 135-139: `raft.generation` 매핑 이미 존재
- `constants/raft.ts` Line 35-39: `RAFT_AVAILABLE_MODELS` 이미 정의됨

**API-01~02**: ✅ 이미 완료

- `api/raft/generate/route.ts` Line 103: `generateTextWithTimeout(prompt: string, modelId?: string)` 시그니처 존재
- `api/raft/generate/route.ts` Line 123: `model: modelId || 'gpt-4o-mini'` 동적 모델 사용
- `api/raft/generate/route.ts` Line 310: `body.modelId || getModelForUsage('raft.generation')` 사용

**UI-01~03**: ✅ 이미 완료

- `SyntheticDataPanel.tsx` Line 90-92: `selectedModel` state 존재
- `SyntheticDataPanel.tsx` Line 391: `RAFT_AVAILABLE_MODELS.map()` 드롭다운 구현됨
- `SyntheticDataPanel.tsx` Line 23: `RAFT_AVAILABLE_MODELS` import됨

---

### ❌ (Critical) Phase 4 (Data-01)에서 잘못된 테이블 참조

- [x] 원인: Line 68에서 `documents` 테이블 조회를 제안하지만, 실제로는 `user_documents` 테이블 사용해야 함
- [x] **수정 제안**:

  ```markdown
  # Before (Line 68)

  1. `documents` 테이블에서 해당 `category`를 가진 `id` 목록 조회.

  # After

  1. `user_documents` 테이블에서 해당 `category`를 가진 `id` 목록 조회.
  ```

- [x] 파일/위치: `2512282220_RAFT_Model_Select_Checklist.md` Line 68

#### 근거:

- `034_add_category.sql`: `user_documents` 테이블에 `category` 컬럼 존재
- `documents` 테이블은 마이그레이션에 없음 (2512282150 체크리스트에서 확인됨)

---

### ⚠️ (Major) Phase 4 (Data-01~02)가 이미 구현되어 있을 가능성

- [x] 원인: `SyntheticDataPanel.tsx`에 `useExistingChunks` state가 이미 존재 (Line 96)
- [x] **수정 제안**: Phase 4 구현 여부 확인 필요
  - `/api/raft/context` 엔드포인트 존재 여부 확인
  - `SyntheticDataPanel.tsx`에서 "DB에서 가져오기" 기능 구현 여부 확인
- [x] 파일/위치:
  - `frontend/src/app/api/raft/context/route.ts` (존재 여부 확인 필요)
  - `frontend/src/components/admin/SyntheticDataPanel.tsx` (Line 93-96)

---

## 2) 🚨 리스크 및 안전장치 (Risk Guardrails)

### (Low) 기존 기능 회귀(Regression) 포인트

- [x] 위험 요소: 체크리스트대로 구현 시 이미 작동 중인 모델 선택 기능을 중복 구현할 위험
- [x] **방어 코드 추가 제안**:
  - 구현 전 브라우저 테스트로 현재 상태 확인
  - 이미 구현된 기능은 체크리스트에서 "검증" 항목으로 변경

### (Mid) 데이터/성능 이슈 방지

- [x] 위험 요소: Phase 4 (Data-01) Line 70에서 "Random Sampling (최대 10~20개)" 제안하지만, 토큰 제한 고려 없음
- [x] **방어 로직 제안**:
  - 청크 개수 제한뿐만 아니라 총 토큰 수 제한 추가 (예: 80,000 tokens)
  - 이미 `chunkExtractor.ts`에 구현되어 있는지 확인 필요

---

## 3) 🧪 검증 기준 구체화 (Test Criteria)

### Happy Path 테스트 기준 (성공 시나리오)

- [x] **HP-01**: 모델 선택 드롭다운 확인

  - 조건: RAFT 관리 페이지 접속
  - 기대 결과: 3개 모델 옵션 표시 (gpt-4o-mini, gpt-4o, gemini-1.5-flash)
  - 확인 방법: 브라우저 DevTools Elements 탭에서 `<select>` 또는 드롭다운 확인

- [x] **HP-02**: 모델 변경 후 생성 요청
  - 조건: `gpt-4o` 선택 → 합성 데이터 생성 클릭
  - 기대 결과: API 로그에서 `model: gpt-4o` 사용 확인
  - 확인 방법: 터미널에서 `npm run dev` 로그 확인 또는 Network 탭에서 Request Body 확인

### Edge Case 테스트 기준 (실패/예외 시나리오)

- [x] **EC-01**: 잘못된 modelId 전달

  - 조건: API에 `modelId: 'invalid-model'` 전달
  - 기대 결과: Fallback 모델 사용 또는 에러 메시지 반환
  - 확인 방법: Postman 또는 curl로 직접 API 호출

- [x] **EC-02**: modelId 없이 요청
  - 조건: API에 `modelId` 파라미터 생략
  - 기대 결과: `getModelForUsage('raft.generation')` 기본값 사용 (`gpt-4o-mini`)
  - 확인 방법: Network 탭에서 Request Body 확인 후 로그 확인

---

## 4) 최종 판단 (Decision)

- [x] 상태 선택: **⚠️ 체크리스트 수정 후 진행**
- [x] 가장 치명적인 결함 1줄 요약:
  > **체크리스트가 이미 구현된 기능(Phase 1~3)을 재구현하려 하며, Phase 4는 잘못된 테이블(`documents`)을 참조함**

---

## 5) 체크리스트 수정 권고사항 요약

| 위치         | 수정 내용                          | 우선순위    |
| ------------ | ---------------------------------- | ----------- |
| 전체 구조    | Phase 1~3를 "검증" 섹션으로 변경   | 🔴 Critical |
| Line 68      | `documents` → `user_documents`     | 🔴 Critical |
| Phase 4      | 구현 여부 사전 확인 필요           | 🟡 Major    |
| Verification | Happy Path / Edge Case 테스트 추가 | 🟡 Major    |

---

## 6) 권장 수정안

```markdown
# 📋 RAFT 모델 선택 기능 검증 체크리스트

**작성일**: 2025-12-28
**상태**: ✅ Phase 1~3 구현 완료, Phase 4 검증 필요

---

## ✅ 1. 구현 완료 확인

### [Phase 1: Config & Centralization] ✅ 완료

- [x] **Config-01**: `llm-usage-map.ts`에 `'raft.generation'` 존재 확인
- [x] **Config-02**: `raft.generation` 매핑 데이터 존재 확인
- [x] **Config-03**: `RAFT_AVAILABLE_MODELS` 상수 존재 확인

### [Phase 2: Backend API] ✅ 완료

- [x] **API-01**: `modelId` 파라미터 수신 확인
- [x] **API-02**: `generateTextWithTimeout` 함수에서 `modelId` 사용 확인

### [Phase 3: Frontend UI] ✅ 완료

- [x] **UI-01**: `selectedModel` state 존재 확인
- [x] **UI-02**: 모델 선택 드롭다운 구현 확인
- [x] **UI-03**: API 연동 확인

---

## 🧪 2. Verification Tests

### Functionality Test

- [ ] **FT-01**: 모델 드롭다운 표시 확인

  - 브라우저: `http://localhost:3000/admin/raft`
  - Expected: 3개 모델 옵션 표시

- [ ] **FT-02**: 모델 변경 후 생성 요청
  - 모델: `gpt-4o` 선택
  - Expected: 로그에서 `model: gpt-4o` 확인

### Edge Case Test

- [ ] **EC-01**: modelId 없이 요청
  - Expected: 기본값 `gpt-4o-mini` 사용

---

## 🔍 3. Phase 4 검증 (선택적)

- [ ] **Data-01**: `/api/raft/context` 엔드포인트 존재 확인
- [ ] **Data-02**: "DB에서 가져오기" 기능 구현 확인
```

---

**End of JeDebug Analysis**
