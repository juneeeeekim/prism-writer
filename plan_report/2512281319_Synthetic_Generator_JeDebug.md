# 🔍 JeDebug 검토: 합성 데이터 생성기 체크리스트

**문서 ID**: 2512281319*Synthetic_Generator_JeDebug
**검토일**: 2025-12-28
**검토 대상**: `2512281316_Synthetic_Generator*체크리스트.md`**원본 요구사항**:`2512281313_Synthetic_Generator_UI_Integration.md`
**검토자**: Senior Lead Developer (JeDebug)

---

## 1. 🔧 로직 및 구현 보완 (Logic Fixes)

### Critical Issues

- [ ] **(Critical-01)** P3-04 Context 획득 로직 - 필수 파라미터 누락
  - [ ] **원인**: API는 `context` 파라미터를 **필수**로 요구함 (route.ts Line 210-215). 그러나 체크리스트에서는 "옵션 A/B/C 중 선택"만 언급하고, 어떤 방식을 사용할지 결정되지 않음. context 없이 API 호출 시 400 에러 발생.
  - [ ] **수정 제안**: P3-04를 P2-01 이전으로 이동하고, MVP에서는 **"사용자가 context 직접 입력 (textarea)"** 방식을 기본으로 명시. UI에 textarea 필드 추가 필수.
  - [ ] **파일/위치**: 체크리스트 P2-01 Detail에 다음 추가:
    ```typescript
    // - 입력: context (textarea, 최소 100자 이상)
    ```
  - [ ] **파일/위치**: 체크리스트 P3-04 [확인 필요] 제거 후 명확히 지정

---

- [ ] **(Critical-02)** P3-02 인증 토큰 - useAuth 훅 존재 확인됨
  - [ ] **원인**: 체크리스트에서 "[확인 필요]: 기존 프로젝트에 useAuth 훅이 존재하는지?"로 미결 처리됨. **확인 결과: `hooks/useAuth.ts`에 존재함.**
  - [ ] **수정 제안**: P3-02 Detail을 구체화하고 [확인 필요] 태그 제거.
  - [ ] **파일/위치**: 체크리스트 P3-02 수정:

    ```typescript
    // useAuth 훅 사용 (확인됨: frontend/src/hooks/useAuth.ts)
    import { useAuth } from "@/hooks/useAuth";

    // 컴포넌트 내부:
    const { user } = useAuth();
    // user 객체에서 세션 토큰 획득 시:
    // supabase.auth.getSession() 호출 필요
    ```

---

- [ ] **(Critical-03)** P3-01 토큰 획득 방식 불완전
  - [ ] **원인**: API route.ts Line 76에서 `request.headers.get('Authorization')` 방식으로 토큰을 검증함. 그러나 프론트엔드에서 Supabase 세션 토큰을 어떻게 획득하는지 명시 안 됨.
  - [ ] **수정 제안**: P3-01에 토큰 획득 코드 명시 추가.
  - [ ] **파일/위치**: 체크리스트 P3-01 Detail 수정:

    ```typescript
    // lib/api/raft.ts
    import { createBrowserClient } from "@supabase/ssr";

    export async function generateSyntheticDataAPI(
      context: string,
      count: number
    ) {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (!token) {
        throw new Error("로그인이 필요합니다");
      }

      const res = await fetch("/api/raft/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ context, count }),
      });

      return res.json();
    }
    ```

---

### Major Issues

- [ ] **(Major-01)** P2-01 상태 변수 `todayCount` 획득 로직 누락
  - [ ] **원인**: UI 목업에 "오늘 생성량: 45 / 500" 표시가 있으나, 이 값을 어디서 가져오는지 체크리스트에 없음.
  - [ ] **수정 제안**: P2-01 또는 새 항목 P2-05로 `todayCount` 획득 로직 추가.
  - [ ] **파일/위치**: 새 항목 추가:
    ````markdown
    #### P2-05: 오늘 생성량 조회

    - [ ] **P2-05**: 마운트 시 오늘 생성량 조회
      - `Target`: `SyntheticDataPanel.tsx`
      - `Detail`:
        ```typescript
        // API: GET /api/raft/generate (이미 존재, 현재 설정 반환)
        // 또는 새 API 필요: GET /api/raft/stats?date=today
        // 응답: { todayCount: number }
        ```
      - `Dependency`: P2-01
    ````
  - [ ] **[확인 필요]**: 현재 GET /api/raft/generate는 todayCount를 반환하지 않음. API 수정 또는 별도 API 필요.

---

- [ ] **(Major-02)** Phase 1 Verification - Flag 확인 위치 오류
  - [ ] **원인**: P1-02에서 `FEATURE_FLAGS.ENABLE_RAFT_FEATURES` 체크를 클라이언트 컴포넌트에서 수행하려 함. 그러나 `FEATURE_FLAGS`는 서버 환경 변수(`process.env`)를 사용하므로 클라이언트에서 직접 접근 불가.
  - [ ] **수정 제안**: 두 가지 해결책 중 하나 선택:
    1. **Option A**: `NEXT_PUBLIC_ENABLE_RAFT_FEATURES` 환경 변수 추가 (클라이언트용)
    2. **Option B**: 서버 컴포넌트로 페이지 작성 후 클라이언트 컴포넌트를 자식으로 렌더링
  - [ ] **파일/위치**: 체크리스트 P1-01에 다음 추가:
    ```markdown
    - `Quality`: 클라이언트 접근 위해 `NEXT_PUBLIC_` 접두사 환경 변수 추가 필요
    ```

---

- [ ] **(Major-03)** API 내부 LLM 호출이 OpenAI 사용
  - [ ] **원인**: route.ts Line 110-137에서 `OPENAI_API_KEY`와 `gpt-4o-mini` 모델 사용. 그러나 LLM 중앙화 프로젝트에서는 Gemini 사용이 기본.
  - [ ] **수정 제안**: 이 API가 의도적으로 OpenAI를 사용하는 것인지 확인 필요. 만약 Gemini로 통일해야 한다면 API 수정 필요.
  - [ ] **[확인 필요]**: 합성 데이터 생성은 OpenAI 유지? 아니면 Gemini로 전환?

---

## 2. 🚨 리스크 및 안전장치 (Risk Guardrails)

### High Priority

- [ ] **(High-01)** Context 미입력 시 오류 처리
  - [ ] **위험 요소**: 사용자가 context textarea를 비워두고 버튼 클릭 시 API 400 에러 발생. UX 저하.
  - [ ] **방어 코드 추가 제안**: P2-01에 입력 검증 로직 추가

    ```typescript
    // context가 100자 미만이면 버튼 비활성화
    const isValid = context.trim().length >= 100
    <button disabled={!isValid || isLoading}>생성 시작</button>

    // 또는 tooltip: "참고 자료를 100자 이상 입력해주세요"
    ```

---

- [ ] **(High-02)** 개발 환경 인증 우회 (SKIP_RAFT_AUTH)
  - [ ] **위험 요소**: route.ts Line 67-70에서 `SKIP_RAFT_AUTH=true` 시 인증 생략됨. 실수로 프로덕션에 이 설정이 배포되면 인증 없이 API 호출 가능.
  - [ ] **방어 로직 제안**: Vercel 환경 변수에 `SKIP_RAFT_AUTH` 절대 설정하지 않도록 문서화
    ```markdown
    // 체크리스트 P4-01 Detail에 추가:
    // ⚠️ 프로덕션 배포 전 확인: SKIP_RAFT_AUTH 환경 변수가 설정되지 않았는지 확인
    ```

---

### Medium Priority

- [ ] **(Mid-01)** 대량 생성 시 UI 블로킹
  - [ ] **위험 요소**: 50개 생성 요청 시 LLM 호출에 30초 이상 소요될 수 있음. 이 동안 UI가 블로킹됨.
  - [ ] **방어 로직 제안**: 예상 소요 시간 표시 또는 프로그레스 인디케이터
    ```typescript
    // P2-03에 추가:
    // - "예상 소요 시간: 약 {count * 3}초" 표시
    ```

---

## 3. 🧪 검증 기준 구체화 (Test Criteria)

### Happy Path 테스트 기준

- [ ] **HP-01**: 정상 생성 플로우

  - [ ] 조건: context 200자 입력, count 5, 로그인 상태
  - [ ] 기대 결과: 5개 Q&A 생성, "✅ 5개 Q&A 생성 완료!" 메시지, DB에 5개 레코드 INSERT

- [ ] **HP-02**: 일일 한도 내 반복 생성
  - [ ] 조건: 오늘 생성량 490개, count 10 요청
  - [ ] 기대 결과: 10개 생성 성공 (총 500개)

### Edge Case 테스트 기준

- [ ] **EC-01**: context 미입력

  - [ ] 조건: context 빈 문자열
  - [ ] 기대 결과: 버튼 비활성화 또는 "참고 자료를 입력해주세요" 메시지

- [ ] **EC-02**: 로그아웃 상태에서 접근

  - [ ] 조건: 세션 없음
  - [ ] 기대 결과: "로그인이 필요합니다" 메시지, 버튼 비활성화

- [ ] **EC-03**: 일일 한도 초과

  - [ ] 조건: 오늘 생성량 500개, count 1 요청
  - [ ] 기대 결과: 429 에러, "일일 한도(500개)를 초과했습니다" 메시지

- [ ] **EC-04**: 네트워크 오류
  - [ ] 조건: API 서버 다운 또는 타임아웃
  - [ ] 기대 결과: "서버 연결 실패" 메시지, 재시도 버튼 표시

---

## 4. 최종 판단 (Decision)

- [x] **상태**: ⚠️ **체크리스트 수정 후 진행**

### 가장 치명적인 결함 (1줄 요약)

> **Context 획득 로직과 Supabase 토큰 획득 코드가 누락되어, 현재 체크리스트대로 구현하면 API 호출 시 400/403 에러 발생**

---

## 5. 수정 요약 (Action Items)

| 우선순위    | ID          | 수정 내용                                      | 체크리스트 위치 |
| :---------- | :---------- | :--------------------------------------------- | :-------------- |
| 🔴 Critical | Critical-01 | context textarea UI 추가 및 MVP 방식 확정      | P2-01, P3-04    |
| 🔴 Critical | Critical-02 | useAuth 훅 사용 방법 명시                      | P3-02           |
| 🔴 Critical | Critical-03 | Supabase 토큰 획득 코드 추가                   | P3-01           |
| 🟠 Major    | Major-01    | todayCount 획득 API/로직 추가                  | P2-05 (신규)    |
| 🟠 Major    | Major-02    | NEXT*PUBLIC* 환경 변수 또는 서버 컴포넌트 사용 | P1-01, P1-02    |
| 🟡 Mid      | High-01     | context 최소 길이 검증 추가                    | P2-01           |

---

_검토 완료: JeDebug (2025-12-28)_
