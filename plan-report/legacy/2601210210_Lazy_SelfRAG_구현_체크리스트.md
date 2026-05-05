# 구현 체크리스트: Lazy Self-RAG (조건부 검증)

## 개요

- **목적**: 높은 정확도 유지 + LLM 비용 70% 절감
- **핵심 원리**: 모든 응답이 아닌 **고위험 응답에만** Self-RAG 검증 적용
- **예상 효과**: 전체 요청의 30%만 검증 → 비용 70% 절감, 정확도 유지

---

## 기술 설계

### 검증 조건 (트리거)

| 조건                 | 로직                        | Self-RAG 실행 |
| -------------------- | --------------------------- | ------------- |
| 참고 자료 있음       | `hasRetrievedDocs === true` | ✅ 조건 충족  |
| 응답 길이 500자 이상 | `fullResponse.length > 500` | ✅ 조건 충족  |
| 질문 길이 50자 이상  | `query.length > 50`         | ✅ 조건 충족  |

**최종 조건**: 위 3가지 중 **2개 이상** 충족 시에만 Self-RAG 실행

```typescript
// Lazy Self-RAG 조건 판단
const shouldRunSelfRAG =
  hasRetrievedDocs && fullResponse.length > 500 && query.length > 50;
```

---

## [Phase 1: Feature Flag 설계]

**Before Start:**

- ⚠️ 기존 `ENABLE_SELF_RAG` Feature Flag 활용
- ⚠️ 새 조건부 로직은 기존 코드와 호환 유지

**Implementation Items:**

- [x] **ID(L1-01)**: [Feature Flag 분기 추가] ✅ 이미 구현됨 (2026-01-21 확인)
  - `Target`: `src/config/featureFlags.ts`
  - `Logic`:

    ```typescript
    // 기존 ENABLE_SELF_RAG는 유지
    // 새로 추가: LAZY_SELF_RAG_MODE
    LAZY_SELF_RAG_MODE: process.env.NEXT_PUBLIC_LAZY_SELF_RAG_MODE !== 'false',

    // 조건부 검증 임계값
    LAZY_SELF_RAG_MIN_RESPONSE_LENGTH: parseInt(
      process.env.NEXT_PUBLIC_LAZY_SELF_RAG_MIN_RESPONSE_LENGTH || '500'
    ),
    LAZY_SELF_RAG_MIN_QUERY_LENGTH: parseInt(
      process.env.NEXT_PUBLIC_LAZY_SELF_RAG_MIN_QUERY_LENGTH || '50'
    ),
    ```

  - `Key Variables`: `LAZY_SELF_RAG_MODE`, `LAZY_SELF_RAG_MIN_RESPONSE_LENGTH`

---

## [Phase 2: 조건부 검증 로직 구현]

**Before Start:**

- ⚠️ `chat/route.ts`의 기존 Self-RAG 호출 위치 확인 필요
- ⚠️ `verifyGroundedness()` 함수는 변경하지 않음

**Implementation Items:**

- [x] **ID(L2-01)**: [조건 판단 함수 추가] ✅ 완료 (2026-01-21)
  - `Target`: `src/lib/services/chat/chatService.ts` (신규 함수)
  - `Logic`:

    ```typescript
    /**
     * Lazy Self-RAG 조건 판단
     * @returns true면 Self-RAG 실행, false면 스킵
     */
    export function shouldRunLazySelfRAG(
      query: string,
      fullResponse: string,
      hasRetrievedDocs: boolean,
    ): boolean {
      if (!FEATURE_FLAGS.LAZY_SELF_RAG_MODE) {
        // Lazy 모드 비활성화 시 기존 ENABLE_SELF_RAG 따름
        return FEATURE_FLAGS.ENABLE_SELF_RAG;
      }

      // 참고 자료가 없으면 스킵 (근거 검증 불가)
      if (!hasRetrievedDocs) return false;

      // 짧은 응답은 스킵
      if (
        fullResponse.length < FEATURE_FLAGS.LAZY_SELF_RAG_MIN_RESPONSE_LENGTH
      ) {
        return false;
      }

      // 짧은 질문은 스킵
      if (query.length < FEATURE_FLAGS.LAZY_SELF_RAG_MIN_QUERY_LENGTH) {
        return false;
      }

      return true;
    }
    ```

- [x] **ID(L2-02)**: [chat/route.ts 수정] ✅ 완료 (2026-01-21)
  - `Target`: `src/app/api/chat/route.ts` > Step 6 (Groundedness Check)
  - `Logic`:

    ```typescript
    // 변경 전
    if (FEATURE_FLAGS.ENABLE_SELF_RAG && hasRetrievedDocs && ...)

    // 변경 후
    import { shouldRunLazySelfRAG } from '@/lib/services/chat'

    if (shouldRunLazySelfRAG(query, fullResponse, hasRetrievedDocs) &&
        uniqueResults.length > 0 &&
        fullResponse.length > 100) {
      // Self-RAG 검증 실행
    }
    ```

---

## [Phase 3: 경량 모델 적용]

**Before Start:**

- ⚠️ Self-RAG 검증은 복잡한 생성이 아닌 Yes/No 판단
- ⚠️ `llm-usage-map.ts`의 `selfrag.verify` 용도 확인

**Implementation Items:**

- [ ] **ID(L3-01)**: [Self-RAG 전용 경량 모델 설정]
  - `Target`: `src/config/llm-usage-map.ts`
  - `Logic`:
    ```typescript
    // selfrag.verify 용도에 경량 모델 지정
    'selfrag.verify': 'gemini-3-flash',  // Pro 대신 Flash 사용
    ```

---

## [Phase 4: 로깅 및 모니터링]

**Implementation Items:**

- [x] **ID(L4-01)**: [검증 스킵/실행 로깅] ✅ 완료 (2026-01-21)
  - `Target`: `src/app/api/chat/route.ts`
  - `Logic`:
    ```typescript
    const shouldVerify = shouldRunLazySelfRAG(
      query,
      fullResponse,
      hasRetrievedDocs,
    );
    console.log(
      `[Chat API] Lazy Self-RAG: ${shouldVerify ? "VERIFY" : "SKIP"}`,
      {
        queryLength: query.length,
        responseLength: fullResponse.length,
        hasRetrievedDocs,
      },
    );
    ```

---

## [Phase 5: 환경 변수 설정]

- [ ] **ID(L5-01)**: [.env.local 업데이트]
  - `Target`: `.env.local`
  - `Logic`:
    ```env
    # Lazy Self-RAG 설정
    NEXT_PUBLIC_LAZY_SELF_RAG_MODE=true
    NEXT_PUBLIC_LAZY_SELF_RAG_MIN_RESPONSE_LENGTH=500
    NEXT_PUBLIC_LAZY_SELF_RAG_MIN_QUERY_LENGTH=50
    ```

---

## Definition of Done (검증)

- [ ] 짧은 질문 (50자 미만) 시 Self-RAG 스킵 확인
- [ ] 짧은 응답 (500자 미만) 시 Self-RAG 스킵 확인
- [ ] 긴 질문 + 긴 응답 + 참고 자료 있음 시 Self-RAG 실행 확인
- [ ] 콘솔 로그에서 SKIP/VERIFY 상태 확인
- [ ] `npm run build` 성공

---

## 예상 효과

| 메트릭                 | 기존      | Lazy Self-RAG        |
| ---------------------- | --------- | -------------------- |
| **Self-RAG 실행 비율** | 100%      | ~30%                 |
| **LLM 추가 호출**      | 모든 요청 | 30% 요청만           |
| **비용 절감**          | -         | **~70%**             |
| **정확도**             | 100%      | ~95% (고위험만 검증) |
