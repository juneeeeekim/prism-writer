# Model Switcher 버그 수정 구현 체크리스트

> **버전**: 1.0  
> **날짜**: 2026-01-23  
> **Tech Lead**: AI 시스템 아키텍처팀  
> **기반 문서**: `2601232151_Model_Switcher_버그수정_구현정의서.md`

---

## Phase 1: ChatModelSelector CustomEvent 발행

**Before Start:**

- ⚠️ 주의: `handleModelChange()` 함수의 기존 localStorage 저장 로직 유지 필수
- ⚠️ 레거시: `onModelChange?.()` 콜백 호출 순서 변경 금지

---

### Implementation Items

- [x] **P1-01**: CustomEvent 발행 로직 추가 ✅ (2026-01-23 완료)
  - `Target`: `ChatModelSelector.tsx` > `handleModelChange()`
  - `Logic (Pseudo)`:
    ```
    1. const modelId = e.target.value
    2. setSelectedModel(modelId)
    3. if (modelId) localStorage.setItem(STORAGE_KEY, modelId)
       else localStorage.removeItem(STORAGE_KEY)
    4. [NEW] window.dispatchEvent(new CustomEvent('prism-model-change', { detail: modelId }))
    5. onModelChange?.(modelId)
    ```
  - `Key Variables`:
    - `STORAGE_KEY = 'prism_selected_model'`
    - `modelId: string` - 선택된 모델 ID 또는 빈 문자열
  - `Safety`:
    - `window` 객체 존재 확인 불필요 (이벤트 핸들러는 클라이언트에서만 실행)

**Definition of Done (Phase 1):**

- [ ] **Test**: 드롭다운에서 모델 변경 시 `window` 이벤트 발생 확인 (DevTools Console)
- [ ] **Test**: `event.detail`에 선택한 모델 ID 포함 확인
- [ ] **Review**: 기존 `localStorage.setItem` 로직 유지 확인
- [ ] **Review**: 주석 `[BUG-FIX]` 추가하여 수정 이력 명시

---

## Phase 2: useChat CustomEvent 리스너

**Before Start:**

- ⚠️ 주의: 기존 `StorageEvent` 리스너 제거 금지 (다른 탭 동기화용)
- ⚠️ 레거시: `useEffect` 의존성 배열 `[]` 유지 (마운트 시 1회만 등록)

---

### Implementation Items

- [x] **P2-01**: CustomEvent 리스너 함수 정의 ✅ (2026-01-23 완료)
  - `Target`: `useChat.ts` > `useEffect` 내부 (Line 68-85)
  - `Logic (Pseudo)`:
    ```typescript
    const handleModelChange = (e: Event) => {
      const customEvent = e as CustomEvent<string>;
      const modelId = customEvent.detail;
      if (modelId === "") {
        setSelectedModel(null); // Default(Auto) 선택 시
      } else {
        setSelectedModel(modelId);
      }
    };
    ```
  - `Key Variables`:
    - `handleModelChange: (e: Event) => void` - 리스너 함수
    - `customEvent.detail: string` - 전달된 모델 ID
  - `Safety`:
    - `e as CustomEvent<string>` 타입 단언 필수
    - `detail`이 빈 문자열일 경우 `null`로 변환

---

- [x] **P2-02**: 이벤트 리스너 등록 ✅ (2026-01-23 완료)
  - `Target`: `useChat.ts` > `useEffect` 내부
  - `Logic (Pseudo)`:

    ```typescript
    // 기존 StorageEvent 리스너 (유지)
    window.addEventListener("storage", handleStorageChange);

    // [NEW] CustomEvent 리스너 추가
    window.addEventListener("prism-model-change", handleModelChange);
    ```

  - `Key Variables`:
    - 이벤트명: `'prism-model-change'` (ChatModelSelector와 동일해야 함)
  - `Safety`: 없음

---

- [x] **P2-03**: Cleanup 함수에 리스너 제거 추가 ✅ (2026-01-23 완료)
  - `Target`: `useChat.ts` > `useEffect` return문
  - `Logic (Pseudo)`:
    ```typescript
    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("prism-model-change", handleModelChange); // [NEW]
    };
    ```
  - `Key Variables`: 없음
  - `Safety`:
    - 리스너 제거 누락 시 메모리 누수 발생
    - 반드시 등록한 모든 리스너를 제거해야 함

**Definition of Done (Phase 2):**

- [ ] **Test**: 모델 변경 시 `selectedModel` 상태 즉시 업데이트 확인
- [ ] **Test**: 컴포넌트 언마운트 시 리스너 제거 확인 (메모리 누수 없음)
- [ ] **Test**: 빈 문자열(Default) 선택 시 `selectedModel`이 `null`로 설정
- [ ] **Review**: 기존 `handleStorageChange` 리스너 유지 확인
- [ ] **Review**: 주석 `[BUG-FIX]` 추가하여 수정 이력 명시

---

## Phase 3: 통합 검증

**Before Start:**

- ⚠️ 모든 코드 수정 완료 후 실행

---

### Implementation Items

- [x] **P3-01**: 빌드 테스트 ✅ (2026-01-23 완료)
  - `Target`: Terminal
  - `Logic (Pseudo)`:
    ```bash
    cd frontend
    npm run build
    # Exit code 0 확인
    ```
  - `Key Variables`: 없음
  - `Safety`: 빌드 실패 시 수정 롤백

---

- [ ] **P3-02**: 수동 검증 시나리오
  - `Target`: 브라우저
  - `Logic (Pseudo)`:
    ```
    1. 채팅 페이지 접속
    2. 드롭다운에서 "Claude 4.5 Sonnet" 선택
    3. 메시지 전송: "안녕하세요"
    4. 응답 확인 (Claude 스타일인지 확인)
    5. DevTools Network 탭에서 /api/chat 요청 확인
       → Request Body에 "model": "claude-4.5-sonnet-20250929" 포함 여부
    6. Anthropic API 대시보드에서 사용량 증가 확인
    ```
  - `Key Variables`:
    - 확인할 모델 ID: `claude-4.5-sonnet-20250929`
  - `Safety`: 없음

**Definition of Done (Phase 3):**

- [ ] **Test**: `npm run build` 성공 (Exit code 0)
- [ ] **Test**: Claude 선택 → Claude로 응답 생성 확인
- [ ] **Test**: GPT 선택 → GPT로 응답 생성 확인
- [ ] **Test**: Default(Auto) 선택 → Gemini Flash로 응답 생성 확인
- [ ] **Test**: Network 탭에서 `model` 파라미터 정확히 전송됨
- [ ] **Regression**: 다른 탭에서 모델 변경 시에도 동기화됨 (StorageEvent)
- [ ] **Review**: 불필요한 console.log 제거
- [ ] **Deploy**: Git Push 완료

---

## 참조 파일 목록

| 파일                                                      | 수정 위치                         | 변경량 |
| --------------------------------------------------------- | --------------------------------- | ------ |
| `frontend/src/components/Assistant/ChatModelSelector.tsx` | `handleModelChange()` (Line ~120) | +1줄   |
| `frontend/src/hooks/useChat.ts`                           | `useEffect` (Line 68-85)          | +9줄   |

---

## 롤백 절차

문제 발생 시:

1. `ChatModelSelector.tsx`의 `dispatchEvent` 라인 삭제
2. `useChat.ts`의 `handleModelChange` 관련 코드 삭제
3. 기존 StorageEvent 기반 로직만 유지
4. `git revert` 또는 `git reset --hard HEAD~1`
