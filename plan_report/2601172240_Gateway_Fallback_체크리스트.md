# Gateway Level Fallback 구현 체크리스트

> **작성일**: 2026-01-17 22:40  
> **작성자**: Tech Lead  
> **관련 설계서**: [implementation_plan.md](file:///C:/Users/chyon/.gemini/antigravity/brain/9de604fd-c208-40a3-b6b3-0be123c01224/implementation_plan.md)

---

## [Phase 1: 타입 시스템 확장]

**Before Start:**

- ⚠️ `LLMGenerateOptions`는 다수 파일에서 import되므로, 기존 필드 제거/변경 금지
- ⚠️ 새 필드 `context`는 **optional**로 선언 (하위 호환성)

**Implementation Items:**

- [x] **P1-01**: `LLMGenerateOptions`에 `context` 필드 추가 ✅
  - `Target`: `frontend/src/lib/llm/types.ts` > `LLMGenerateOptions` interface
  - `Logic (Pseudo)`:
    ```typescript
    interface LLMGenerateOptions {
      model?: string;
      maxTokens?: number;
      temperature?: number;
      context?: string; // NEW: 'rag.answer' | 'suggest.completion' | ...
    }
    ```
  - `Key Variables`: `context: string | undefined`
  - `Safety`: Optional 필드이므로 기존 호출자에 영향 없음

**Definition of Done (Phase 1):**

- [x] `npx tsc --noEmit` 통과 ✅
- [x] 기존 `generateTextStream` 호출 코드에서 에러 없음 ✅

---

## [Phase 2: Gateway 핵심 로직 수정]

**Before Start:**

- ⚠️ `generateText()`, `generateTextStream()` 두 함수 모두 수정 필요
- ⚠️ 기존 `yield* provider.generateStream(...)` 로직은 try 블록 내부로 이동

**Implementation Items:**

- [x] **P2-01**: Import 추가 ✅
  - `Target`: `frontend/src/lib/llm/gateway.ts` > import 섹션
  - `Logic (Pseudo)`:
    ```typescript
    import { getFallbackModel } from "@/config/llm-usage-map";
    ```
  - `Safety`: `llm-usage-map.ts`는 이미 검증된 파일

- [x] **P2-02**: `generateTextStream()` Fallback 적용 ✅
  - `Target`: `frontend/src/lib/llm/gateway.ts` > `generateTextStream()`
  - `Logic (Pseudo)`:
    ```
    1. modelId = options.model || getDefaultModel()
    2. fallback = getFallbackModel(options.context) || undefined
    3. TRY:
         provider = getProviderByModel(modelId)
         yield* provider.generateStream(prompt, options)
       CATCH primaryError:
         IF fallback EXISTS:
           console.warn('[Gateway] Primary failed:', primaryError)
           fallbackProvider = getProviderByModel(fallback)
           yield* fallbackProvider.generateStream(prompt, options)
         ELSE:
           throw primaryError
    ```
  - `Key Variables`: `modelId`, `fallbackModelId`, `provider`, `fallbackProvider`
  - `Safety`:
    - `getFallbackModel`이 `undefined` 반환 시 그대로 throw
    - Fallback 호출 시에도 동일 `options` 전달 (model만 교체)

- [x] **P2-03**: `generateText()` Fallback 적용 ✅
  - `Target`: `frontend/src/lib/llm/gateway.ts` > `generateText()`
  - `Logic (Pseudo)`: P2-02와 동일 패턴, `yield*` 대신 `return`
  - `Safety`: P2-02와 동일

**Definition of Done (Phase 2):**

- [x] `npx tsc --noEmit` 통과 ✅
- [x] 로컬 빌드 성공: `npm run build` ✅

---

## [Phase 3: 호출 측 Context 전달]

**Before Start:**

- ⚠️ 모든 `generateTextStream` 호출 위치 확인 필요 (선택적 적용)
- ⚠️ 당장 모든 곳에 적용할 필요 없음, `chat/route.ts`만 우선 적용

**Implementation Items:**

- [x] **P3-01**: `chat/route.ts`에 context 전달 ✅
  - `Target`: `frontend/src/app/api/chat/route.ts` > `generateTextStream()` 호출부
  - `Logic (Pseudo)`:

    ```typescript
    // 변경 전
    generateTextStream(fullPrompt, { model: modelId });

    // 변경 후
    generateTextStream(fullPrompt, { model: modelId, context: "rag.answer" });
    ```

  - `Key Variables`: `'rag.answer'` (llm-usage-map의 키)
  - `Safety`: context가 없어도 동작함 (fallback만 안 됨)

**Definition of Done (Phase 3):**

- [x] 빌드 성공 ✅
- [x] 배포 준비 완료 ✅

---

## [Phase 4: 배포 및 검증]

**Before Start:**

- ⚠️ Vercel 배포 후 최소 1분 대기 (CDN 전파)

**Implementation Items:**

- [ ] **P4-01**: Git 커밋 및 Push
  - `Commit Message`: `feat(gateway): implement fallback retry logic at LLM gateway level`

- [ ] **P4-02**: 정상 동작 테스트
  - 채팅 시도 → 응답 정상 수신 확인
  - 콘솔에서 `[Chat API] Using model (from llm-usage-map):` 로그 확인

- [ ] **P4-03**: Fallback 동작 테스트 (선택)
  - `llm-usage-map.ts`의 `rag.answer.modelId`를 `invalid-model`로 임시 변경
  - 채팅 시도 → Fallback 모델로 응답 오는지 확인
  - 콘솔에서 `[Gateway] Retrying with fallback model:` 로그 확인
  - 테스트 후 **반드시 원래 모델로 복구**

**Definition of Done (Phase 4):**

- [ ] Vercel 배포 성공
- [ ] 채팅 기능 정상 작동 확인
- [ ] 불필요한 콘솔 로그 없음 (warn/error만 유지)

---

## Summary

|   Phase   | 작업         | 예상 시간 |
| :-------: | :----------- | :-------: |
|     1     | 타입 확장    |    2분    |
|     2     | Gateway 로직 |    5분    |
|     3     | Context 전달 |    2분    |
|     4     | 배포/검증    |    5분    |
| **Total** |              | **~15분** |
