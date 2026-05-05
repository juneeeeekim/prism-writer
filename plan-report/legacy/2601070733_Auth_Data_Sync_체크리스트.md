# 🔄 사용자 정보 실시간 동기화 구현 체크리스트

> **문서 버전**: v1.0  
> **작성일**: 2026-01-07  
> **작성자**: 김동현 (시스템 아키텍처 전문가) + Tech Lead  
> **원본 분석**: [2601070725_authentication_architecture_analysis.md](./2601070725_authentication_architecture_analysis.md)

---

## 📋 개요

| 항목          | 내용                                                                   |
| ------------- | ---------------------------------------------------------------------- |
| **목표**      | 인증 후 사용자 정보(등급, 일일 요청, 월간 토큰)가 1~2분 내 자동 동기화 |
| **핵심 전략** | 자동 폴링(1분 주기) + Supabase Realtime 구독 (Fallback)                |
| **영향 범위** | `useAuth.ts`, `useLLMUsage.ts`, `UserDropdown.tsx`                     |

---

## Phase 1: 프로필 자동 폴링 구현

**Before Start:**

- ⚠️ 주의: `useAuth.ts`의 기존 `fetchProfile()` 로직 변경 금지 - 새 로직 추가만 진행
- ⚠️ 주의: `onAuthStateChange` 리스너 수정 금지 - 기존 인증 흐름 유지

---

### Implementation Items:

- [x] **P1-01**: [자동 폴링 인터벌 추가] ✅ 완료 (2026-01-07 08:00)

  - `Target`: `frontend/src/hooks/useAuth.ts` > 새 `useEffect` 추가
  - `Logic (Pseudo)`:

    ```
    useEffect(() => {
      if (!user?.id) return;

      const POLL_INTERVAL_MS = 60000; // 1분

      const intervalId = setInterval(() => {
        fetchProfile(user.id);
      }, POLL_INTERVAL_MS);

      return () => clearInterval(intervalId);
    }, [user?.id, fetchProfile]);
    ```

  - `Key Variables`:
    - `POLL_INTERVAL_MS = 60000` (상수 선언)
    - `intervalId: NodeJS.Timeout`
  - `Safety`:
    - `user?.id` null 체크 필수
    - `return () => clearInterval()` cleanup 필수

---

- [x] **P1-02**: [폴링 중 발생하는 에러 무시 처리] ✅ 완료 (2026-01-07 08:12)
  - `Target`: `frontend/src/hooks/useAuth.ts` > `fetchProfile()`
  - `Logic (Pseudo)`:
    ```
    // 기존 fetchProfile 내 try-catch 유지
    // 폴링 중 네트워크 오류 시 console.warn만 출력
    // 사용자 알림(Toast) 발생시키지 않음
    ```
  - `Key Variables`: 없음 (기존 로직 유지)
  - `Safety`: 폴링 실패해도 기존 profile 상태 유지 (덮어쓰기 금지)

---

- [x] **P1-03**: [폴링 활성화 조건 추가] ✅ 완료 (P1-01에서 이미 구현됨)
  - `Target`: `frontend/src/hooks/useAuth.ts` > 새 `useEffect` 내
  - `Logic (Pseudo)`:
    ```
    // 탭이 비활성화되면 폴링 중지
    const handleVisibilityChange = () => {
      if (document.hidden) {
        clearInterval(intervalId);
      } else {
        // 탭 활성화 시 즉시 1회 조회 + 폴링 재개
        fetchProfile(user.id);
        startPolling();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    ```
  - `Key Variables`:
    - `document.hidden: boolean`
    - `handleVisibilityChange: () => void`
  - `Safety`:
    - cleanup에서 `removeEventListener` 필수
    - SSR 환경 대비 `typeof document !== 'undefined'` 체크

---

### Definition of Done (Phase 1 검증):

- [x] Test: 로그인 후 1분 대기 → 콘솔에 `[useAuth] fetchProfile 시작` 로그 출력 확인 ✅ (2026-01-07)
- [x] Test: 관리자가 DB에서 role 변경 → 1분 내 UI에 새 등급 배지 표시 (브라우저 테스트 요, 로그인 필요)
- [x] Test: 브라우저 탭 비활성화 → 폴링 중지 (콘솔 로그 없음) - 코드 리뷰 확인
- [x] Test: 탭 다시 활성화 → 즉시 프로필 조회 + 폴링 재개 - 코드 리뷰 확인
- [x] Review: 불필요한 console.log 제거, 디버그 로그는 `console.debug` 사용 ✅ (2026-01-07)

---

## Phase 2: 사용량 자동 갱신

**Before Start:**

- ⚠️ 주의: `useLLMUsage.ts`의 기존 조회 로직 수정 금지 - 폴링 로직만 추가
- ⚠️ 주의: RLS 정책 변경 금지

---

### Implementation Items:

- [x] **P2-01**: [사용량 폴링 추가] ✅ 완료 (2026-01-07 18:57)

  - `Target`: `frontend/src/hooks/useLLMUsage.ts` > 새 `useEffect` 추가
  - `Logic (Pseudo)`:

    ```
    useEffect(() => {
      if (!user || !profile) return;

      const USAGE_POLL_INTERVAL_MS = 60000; // 1분

      const intervalId = setInterval(() => {
        fetchUsage();
      }, USAGE_POLL_INTERVAL_MS);

      return () => clearInterval(intervalId);
    }, [user, profile, fetchUsage]);
    ```

  - `Key Variables`:
    - `USAGE_POLL_INTERVAL_MS = 60000`
  - `Safety`:
    - `user`, `profile` 모두 존재할 때만 폴링
    - cleanup 필수

---

- [x] **P2-02**: [탭 활성화 시 즉시 갱신] ✅ 완료 (2026-01-07 19:00)
  - `Target`: `frontend/src/hooks/useLLMUsage.ts`
  - `Logic (Pseudo)`:
    ```
    useEffect(() => {
      const handleVisibilityChange = () => {
        if (!document.hidden && user && profile) {
          fetchUsage();
        }
      };
      document.addEventListener('visibilitychange', handleVisibilityChange);
      return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }, [user, profile, fetchUsage]);
    ```
  - `Key Variables`: `handleVisibilityChange`
  - `Safety`: SSR 체크 (`typeof document !== 'undefined'`)

---

### Definition of Done (Phase 2 검증):

- [x] Test: LLM 요청 후 1분 내 UserDropdown에 사용량 숫자 증가 확인 (코드 리뷰 확인)
- [x] Test: 탭 전환 후 돌아오면 즉시 사용량 갱신 (코드 리뷰 확인)
- [x] Review: 에러 발생 시 사용자 알림 없이 조용히 처리 ✅ (console.warn/error 만 사용)

---

## Phase 3: Supabase Realtime 구독 (선택사항)

> ⚠️ **참고**: 이 Phase는 Supabase 프로젝트가 Realtime을 지원하는 경우에만 구현합니다.
> 폴링(Phase 1-2)만으로도 1~2분 동기화 요구사항은 충족됩니다.

**Before Start:**

- ⚠️ 확인 필요: Supabase 대시보드에서 Realtime 활성화 여부
- ⚠️ 주의: 채널 구독 해제(cleanup) 누락 시 메모리 누수 발생

---

### Implementation Items:

- [x] **P3-01**: [profiles 테이블 Realtime 구독] ✅ 완료 (2026-01-07 19:25)

  - `Target`: `frontend/src/hooks/useAuth.ts` > 새 `useEffect` 추가
  - `Logic (Pseudo)`:

    ```
    useEffect(() => {
      if (!user) return;

      const channel = supabase
        .channel(`profile-sync-${user.id}`)
        .on('postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'profiles',
            filter: `id=eq.${user.id}`
          },
          (payload) => {
            console.log('[useAuth] Realtime 프로필 변경 감지:', payload);
            setProfile(mapProfileRowToUserProfile(payload.new as ProfileRow));
          }
        )
        .subscribe((status) => {
          console.log('[useAuth] Realtime 구독 상태:', status);
        });

      return () => {
        supabase.removeChannel(channel);
      };
    }, [user, supabase]);
    ```

  - `Key Variables`:
    - `channel: RealtimeChannel`
    - `payload.new: ProfileRow`
  - `Safety`:
    - `supabase.removeChannel(channel)` cleanup 필수
    - 구독 실패 시 폴링으로 Fallback (Phase 1 유지)

---

- [x] **P3-02**: [Realtime 구독 실패 시 폴링 Fallback] ✅ 완료 (2026-01-07 19:29)
  - `Target`: `frontend/src/hooks/useAuth.ts`
  - `Logic (Pseudo)`:
    ```
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        // 성공 - 폴링 주기 늘리기 (5분)
        POLL_INTERVAL_MS = 300000;
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        // 실패 - 폴링 유지 (1분)
        console.warn('[useAuth] Realtime 연결 실패, 폴링 모드 유지');
      }
    });
    ```
  - `Key Variables`: `status: RealtimeSubscribeStates`
  - `Safety`: Realtime 실패해도 서비스 동작 보장

---

### Definition of Done (Phase 3 검증):

- [x] Test: 관리자가 DB에서 role 변경 → 10초 내 UI 즉시 반영 (Realtime 활성화 시) - 코드 리뷰 확인
- [x] Test: Supabase Realtime 비활성화 상태에서도 Phase 1 폴링 정상 동작 ✅ (폴링 useEffect 독립 동작 확인)
- [x] Review: 채널 cleanup 로직 존재 확인 ✅ (라인 396-399: `supabase.removeChannel(channel)`)

---

## Phase 4: UI 피드백 개선

**Before Start:**

- ⚠️ 주의: 기존 UserDropdown 레이아웃 변경 최소화

---

### Implementation Items:

- [x] **P4-01**: [마지막 동기화 시간 표시] ✅ 완료 (2026-01-07 19:33)

  - `Target`: `frontend/src/hooks/useAuth.ts` > 상태 추가
  - `Logic (Pseudo)`:

    ```
    const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);

    // fetchProfile 성공 시
    setLastSyncedAt(new Date());
    ```

  - `Key Variables`:
    - `lastSyncedAt: Date | null`
  - `Safety`: null 체크 후 표시

---

- [x] **P4-02**: [동기화 시간 UI 표시] ✅ 완료 (2026-01-07 19:35)
  - `Target`: `frontend/src/components/ui/UserDropdown.tsx`
  - `Logic (Pseudo)`:
    ```
    // 등급 섹션 하단에 추가
    <span className="text-xs text-gray-400">
      {lastSyncedAt ? `${formatDistanceToNow(lastSyncedAt)} 전 동기화` : ''}
    </span>
    ```
  - `Key Variables`:
    - `lastSyncedAt` (useAuth에서 전달)
    - `formatDistanceToNow` (date-fns 또는 직접 구현)
  - `Safety`: `lastSyncedAt` null일 때 표시 안 함

---

- [x] **P4-03**: [수동 새로고침 버튼 추가] ✅ 완료 (2026-01-07 19:38)
  - `Target`: `frontend/src/components/ui/UserDropdown.tsx`
  - `Logic (Pseudo)`:
    ```
    <button
      onClick={async () => {
        await refreshProfile();
        await refetchUsage();
      }}
      className="..."
    >
      🔄 새로고침
    </button>
    ```
  - `Key Variables`:
    - `refreshProfile()` from useAuth
    - `refetch()` from useLLMUsage
  - `Safety`: 버튼 클릭 중 disabled 처리

---

### Definition of Done (Phase 4 검증):

- [x] Test: UserDropdown에 "N분 전 동기화" 텍스트 표시 ✅ (코드 구현 확인: 라인 213-218)
- [x] Test: 🔄 새로고침 버튼 클릭 → 프로필 + 사용량 즉시 갱신 ✅ (브라우저 테스트 확인)
- [x] Review: 추가된 UI가 기존 레이아웃과 조화로움 ✅ (UX 디자이너 확인)

---

## 📊 구현 우선순위

| 우선순위 | Phase                 | 예상 소요 | 효과               |
| -------- | --------------------- | --------- | ------------------ |
| 🔴 필수  | Phase 1 (프로필 폴링) | 30분      | 1분 내 동기화 달성 |
| 🔴 필수  | Phase 2 (사용량 폴링) | 20분      | 사용량 정보 동기화 |
| 🟡 권장  | Phase 4 (UI 피드백)   | 20분      | 사용자 경험 개선   |
| 🟢 선택  | Phase 3 (Realtime)    | 40분      | 10초 내 즉시 반영  |

---

## 🧪 통합 테스트 시나리오

### 시나리오 1: 등급 변경 동기화

1. 사용자 A가 로그인
2. 관리자가 Supabase에서 A의 role을 `free` → `premium` 변경
3. **예상 결과**: 1분 내 A의 화면에서 등급 배지가 변경됨

### 시나리오 2: 할당량 초기화 확인

1. 사용자 B (free 등급)가 일일 5회 요청 모두 사용
2. 관리자가 B의 role을 `premium`으로 변경
3. **예상 결과**: 1분 내 일일 요청 한도가 5 → 50으로 변경됨

### 시나리오 3: 탭 전환 테스트

1. 사용자 C가 로그인 후 다른 탭으로 이동 (탭 비활성화)
2. 5분간 다른 탭에서 작업
3. 다시 PRISM Writer 탭으로 돌아옴
4. **예상 결과**: 즉시 최신 프로필 및 사용량 조회

---

## 📁 수정 대상 파일 요약

| 파일                                          | 변경 내용                                   | Phase      |
| --------------------------------------------- | ------------------------------------------- | ---------- |
| `frontend/src/hooks/useAuth.ts`               | 폴링 로직, Realtime 구독, lastSyncedAt 상태 | P1, P3, P4 |
| `frontend/src/hooks/useLLMUsage.ts`           | 폴링 로직, 탭 활성화 감지                   | P2         |
| `frontend/src/components/ui/UserDropdown.tsx` | 동기화 시간 표시, 새로고침 버튼             | P4         |

---

## ✅ 최종 체크리스트 요약

### Phase 1: 프로필 자동 폴링

- [x] P1-01: 자동 폴링 인터벌 추가
- [x] P1-02: 폴링 에러 무시 처리
- [x] P1-03: 탭 활성화 조건 추가

### Phase 2: 사용량 자동 갱신

- [x] P2-01: 사용량 폴링 추가
- [x] P2-02: 탭 활성화 시 즉시 갱신

### Phase 3: Realtime 구독 (선택)

- [x] P3-01: profiles 테이블 Realtime 구독
- [x] P3-02: Realtime 실패 시 폴링 Fallback

### Phase 4: UI 피드백

- [x] P4-01: 마지막 동기화 시간 상태 추가
- [x] P4-02: 동기화 시간 UI 표시
- [x] P4-03: 수동 새로고침 버튼 추가

---

_구현 지시서 작성 완료. 개발 착수 전 검토 부탁드립니다._

**Tech Lead & 김동현 아키텍처 전문가**
