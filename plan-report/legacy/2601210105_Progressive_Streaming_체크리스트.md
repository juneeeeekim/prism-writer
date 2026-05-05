# 구현 체크리스트: 프로그레시브 스트리밍 (Progressive Streaming)

## 개요

- **목적**: Chat API 타임아웃 방지를 위해 RAG 검색 전에 즉시 상태 메시지를 스트리밍
- **핵심 원리**: `ReadableStream.start()` 즉시 `[STATUS]` 메시지 전송 → 클라이언트 타임아웃 해제
- **예상 효과**: 첫 글자 도착 시간 10초+ → 0.1초 이내

---

## [Phase 1: 서버 - 프로그레시브 스트리밍 구현]

**Before Start:**

- ⚠️ 주의: `chat/route.ts`의 기존 스트리밍 로직(`generateTextStream` 호출)은 그대로 유지
- ⚠️ 주의: `Promise.all` 내부의 `searchUserPreferences`, `searchTemplateContext`, `performRAGSearch` 함수는 변경하지 않음
- ⚠️ 회귀 테스트: Self-RAG (`verifyGroundedness`) 로직이 정상 작동하는지 확인 필요

**Implementation Items:**

- [x] **ID(P1-01)**: [ReadableStream 구조 변경] Promise.all을 스트림 내부로 이동
  - `Target`: `src/app/api/chat/route.ts` > `POST()`
  - `Logic (Pseudo)`:

    ```
    // BEFORE: Promise.all OUTSIDE stream
    const [prefs, template, rag] = await Promise.all([...])
    const stream = new ReadableStream({ start(c) { ... } })

    // AFTER: Promise.all INSIDE stream
    const stream = new ReadableStream({
      async start(controller) {
        const encode = (t: string) => new TextEncoder().encode(t)

        // Step 1: 즉시 상태 메시지 전송 (타임아웃 방지)
        controller.enqueue(encode("[STATUS]🔍 자료 검색 중...\n"))

        // Step 2: RAG 검색 (스트림 내에서 실행)
        const [prefs, template, rag] = await Promise.all([
          searchUserPreferences(userId, query),
          searchTemplateContext(supabase, userId, query),
          performRAGSearch(query, { userId, projectId })
        ])

        // Step 3: 프롬프트 빌드 상태
        controller.enqueue(encode("[STATUS]📚 답변 생성 중...\n"))

        // Step 4: LLM 스트리밍 (기존 로직 유지)
        for await (const chunk of generateTextStream(...)) { ... }
      }
    })
    ```

  - `Key Variables`: `controller`, `encode`, `startTime`
  - `Safety`: try-catch로 전체 로직 감싸기 (기존 유지)

- [x] **ID(P1-02)**: [상태 메시지 상수 정의] 하드코딩 제거
  - `Target`: `src/app/api/chat/route.ts` (상단)
  - `Logic (Pseudo)`:
    ```
    const STATUS_MESSAGES = {
      SEARCHING: '[STATUS]🔍 자료 검색 중...\n',
      GENERATING: '[STATUS]📚 답변 생성 중...\n',
    } as const
    ```
  - `Key Variables`: `STATUS_MESSAGES`
  - `Safety`: 없음 (상수 정의)

**Definition of Done (검증):**

- [x] Test: Chat API 호출 시 응답 스트림의 첫 청크가 `[STATUS]` 접두사로 시작하는지 확인
- [x] Test: `performance.now()` 로깅에서 TTFT(Time To First Token)이 100ms 이내인지 확인
- [x] Review: 불필요한 `console.log` 제거, 주석에 `[FIX] Progressive Streaming` 태그 추가

---

## [Phase 2: 클라이언트 - 상태 메시지 필터링]

**Before Start:**

- ⚠️ 주의: `useChat.ts`의 메시지 저장 로직(`setMessages`)은 최소한으로 수정
- ⚠️ 주의: 기존 스트리밍 UI 애니메이션에 영향 없도록 할 것

**Implementation Items:**

- [x] **ID(P2-01)**: [상태 메시지 필터링 변수 추가]
  - `Target`: `src/hooks/useChat.ts` > `handleSend()`
  - `Logic (Pseudo)`:

    ```
    const STATUS_PREFIX = '[STATUS]'
    let statusMessage = ''  // 별도 상태 메시지 저장

    // 스트리밍 루프 내
    const chunk = decoder.decode(value, { stream: true })

    if (chunk.startsWith(STATUS_PREFIX)) {
      // 상태 메시지는 별도 처리
      statusMessage = chunk.replace(STATUS_PREFIX, '').trim()
      setStatusText(statusMessage)  // 상태 UI 업데이트
      continue  // aiMessageContent에 추가하지 않음
    }

    aiMessageContent += chunk
    ```

  - `Key Variables`: `STATUS_PREFIX`, `statusMessage`
  - `Safety`: `chunk.startsWith()` null 체크 불필요 (빈 문자열도 안전)

- [x] **ID(P2-02)**: [상태 메시지 State 추가]
  - `Target`: `src/hooks/useChat.ts` (상단)
  - `Logic (Pseudo)`:

    ```
    const [statusText, setStatusText] = useState<string | null>(null)

    // handleSend 시작 시
    setStatusText(null)  // 초기화

    // handleSend 완료 시 (finally)
    setStatusText(null)  // 클리어

    // return에 추가
    return { ..., statusText }
    ```

  - `Key Variables`: `statusText`, `setStatusText`
  - `Safety`: `finally` 블록에서 반드시 클리어

- [x] **ID(P2-03)**: [UseChatReturn 타입 업데이트]
  - `Target`: `src/hooks/useChat.ts` > `UseChatReturn` interface
  - `Logic (Pseudo)`:
    ```
    export interface UseChatReturn {
      // ... 기존 필드
      statusText: string | null  // 추가
    }
    ```
  - `Key Variables`: `statusText`
  - `Safety`: 없음 (타입 정의)

**Definition of Done (검증):**

- [x] Test: 서버에서 `[STATUS]🔍 자료 검색 중...` 전송 시 `statusText` 상태가 업데이트되는지 확인
- [x] Test: LLM 응답 시작 후 `aiMessageContent`에 `[STATUS]` 문자열이 포함되지 않는지 확인
- [x] Test: 응답 완료 후 `statusText`가 `null`로 초기화되는지 확인
- [x] Review: TypeScript 타입 오류 없음 확인

---

## [Phase 3: UI - 상태 메시지 표시]

**Before Start:**

- ⚠️ 주의: 기존 로딩 스피너(`isLoading`)와 충돌하지 않도록 조건 분기 필요

**Implementation Items:**

- [x] **ID(P3-01)**: [상태 메시지 UI 컴포넌트]
  - `Target`: 채팅 UI 컴포넌트 (사용 위치에 따라)
  - `Logic (Pseudo)`:
    ```tsx
    {
      statusText && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground animate-pulse">
          <span>{statusText}</span>
        </div>
      );
    }
    ```
  - `Key Variables`: `statusText`
  - `Safety`: `statusText`가 `null`일 때 렌더링하지 않음

**Definition of Done (검증):**

- [x] Test: 긴 질문 입력 시 "🔍 자료 검색 중..." 메시지가 먼저 표시되는지 확인
- [x] Test: LLM 응답 시작 시 "📚 답변 생성 중..." 으로 변경되는지 확인
- [x] Test: 응답 완료 후 상태 메시지가 사라지는지 확인
- [x] Review: 애니메이션이 부드러운지 확인 (UX)

---

## [Phase 4: 최종 검증]

**Definition of Done (검증):**

- [x] Test: `npm run build` 성공 (Exit code: 0)
- [x] Test: TypeScript 에러 0개
- [ ] Test: 60초 이상 걸리는 질문에서도 타임아웃 발생하지 않음
- [ ] Test: 일반 짧은 질문에서 기존과 동일하게 동작
- [ ] Review: Vercel 배포 후 프로덕션 환경에서 동작 확인

---

## 롤백 계획

문제 발생 시:

1. `chat/route.ts`에서 `STATUS_MESSAGES` 관련 코드 제거
2. `Promise.all`을 다시 스트림 밖으로 이동
3. `useChat.ts`에서 `statusText` 관련 코드 제거
