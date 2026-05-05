# 회원 등급 관리 시스템 구현 체크리스트 (v2.0)

**작성일**: 2025-12-15  
**업데이트**: 2025-12-15 07:32 - 하이브리드 모델(일일 요청 + 월간 토큰) 적용  
**기반 문서**: 회원등급관리시스템\_전문가회의보고서.md, LLM서비스요금제\_레퍼런스보고서.md  
**담당자**: 시니어 개발자, 주니어 개발자, UX/UI 디자인 전문가, AI/ML 엔지니어, 데이터 엔지니어, DevOps 엔지니어

---

## 개요

이 체크리스트는 **대기업 레퍼런스를 반영한 LLM API 사용량 기반 회원 등급 관리 시스템**을 단계별로 구현하기 위한 상세 가이드입니다.

> 🆕 **v2.0 주요 변경 사항**
>
> - **하이브리드 모델 적용**: 내부 토큰 추적 + 사용자 친화적 일일 요청 횟수 표시
> - **일일 리셋 추가**: Google Gemini 방식 참고 (매일 자정 리셋)
> - **Fair Use 정책**: Notion AI 방식 참고 (악용 방지)
> - **등급별 할당량 수정**: Grammarly, ChatGPT Plus 레퍼런스 기반

---

## 등급 구조 (v2.0 - 하이브리드 모델)

```
┌─────────────────────────────────────────────────────┐
│  내부: 토큰 기반 추적 (정확한 비용 계산)              │
│  ↓                                                  │
│  사용자 표시: "오늘 N회" + "이번 달 N토큰"           │
│  ↓                                                  │
│  리셋: 일일 요청 = 매일 자정 / 월간 토큰 = 매월 1일  │
└─────────────────────────────────────────────────────┘
```

### 등급별 LLM 사용량 할당 (디렉터 지정)

| 등급        | 일일 요청 | 월간 토큰  | 비고          | AI 기능             |
| ----------- | --------- | ---------- | ------------- | ------------------- |
| **pending** | 0         | 0          | 서비스 불가   | 불가                |
| **free**    | **5회**   | **10,000** | 서비스 체험용 | 기본 AI만           |
| **premium** | **50회**  | **30,000** | 유료 회원     | 모든 AI             |
| **special** | 무제한    | 200,000    | 헤비 유저     | 모든 AI + 우선 처리 |
| **admin**   | 무제한    | 무제한     | -             | 모든 기능           |

> 📊 **할당량 기준 (디렉터 지정)**
>
> - `free` 일일 5회: 서비스 체험용 (무분별한 사용 방지)
> - `premium` 일일 50회 / 월 30,000토큰: 유료 회원 기준

### 품질 기준 (모든 항목에 적용)

- [x] ✅ 코딩 스타일 일치 (기존 프로젝트 컨벤션 준수)
- [x] ✅ 명확한 함수명/변수명 (영문, camelCase/PascalCase)
- [x] ✅ 에러 처리 존재 (try-catch, 에러 메시지 한글화)
- [x] ✅ 성능 이슈 없음 (불필요한 리렌더링, 과도한 API 호출 방지)
- [x] ✅ 접근성 고려 (aria-label, 키보드 네비게이션)

---

## Phase 1: 데이터베이스 스키마 구축

**예상 소요 시간**: 2-3일
**담당**: 시니어 개발자, 주니어 개발자

### 영향받을 수 있는 기존 기능

| 기능             | 영향 여부 | 확인 방법                             |
| ---------------- | --------- | ------------------------------------- |
| 사용자 회원가입  | ⚠️ 가능   | 회원가입 후 profiles 레코드 생성 확인 |
| 로그인/로그아웃  | ✅ 없음   | 기존 인증 플로우 변경 없음            |
| 기존 문서/drafts | ✅ 없음   | user_id 외래키 유지                   |

### 1.1 마이그레이션 파일 생성

**파일**: `backend/migrations/003_profiles_schema.sql` [NEW]

- [x] **1.1.1** `profiles` 테이블 생성 SQL 작성

  ```sql
  CREATE TABLE profiles (
      id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
      role TEXT DEFAULT 'pending',
      tier INTEGER DEFAULT 0,
      is_approved BOOLEAN DEFAULT FALSE,
      approved_at TIMESTAMPTZ,
      approved_by UUID REFERENCES auth.users(id),
      subscription_expires_at TIMESTAMPTZ,
      -- 🆕 v2.0: 하이브리드 모델 필드
      monthly_token_limit INTEGER DEFAULT 0,      -- 월간 토큰 한도
      daily_request_limit INTEGER DEFAULT 0,      -- 일일 요청 제한
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
  );
  ```

````

- 의존성: 없음
- 품질: 테이블명/컬럼명 snake_case 확인

- [x] **1.1.2** `role_history` 테이블 생성 SQL 작성

  ```sql
  CREATE TABLE role_history (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
      previous_role TEXT,
      new_role TEXT,
      changed_by UUID REFERENCES auth.users(id),
      reason TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
  );
  ```

  - 연결: profiles 테이블의 role 변경 시 자동 로깅

- [x] **1.1.3** `llm_usage` 테이블 생성 (LLM 사용량 추적 핵심)

  ```sql
  CREATE TABLE llm_usage (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,

      -- 사용량 상세
      request_type TEXT NOT NULL,           -- 'chat', 'summarize', 'generate', 'edit'
      model_name TEXT NOT NULL,             -- 'gpt-4', 'gpt-3.5-turbo', 'gemini-pro'
      input_tokens INTEGER NOT NULL,        -- 입력 토큰 수
      output_tokens INTEGER NOT NULL,       -- 출력 토큰 수
      total_tokens INTEGER GENERATED ALWAYS AS (input_tokens + output_tokens) STORED,

      -- 비용 계산
      estimated_cost_usd DECIMAL(10, 6),

      -- 메타데이터
      request_id TEXT,
      response_time_ms INTEGER,
      is_cached BOOLEAN DEFAULT FALSE,

      created_at TIMESTAMPTZ DEFAULT NOW()
  );
  ```

  - 연결: Phase 6의 callLLM 래퍼에서 호출

- [x] **1.1.4** 🆕 `llm_daily_usage` 테이블 생성 (일일 요청 추적)

  ```sql
  -- v2.0: 일일 요청 횟수 빠른 조회용
  CREATE TABLE llm_daily_usage (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
      usage_date DATE NOT NULL DEFAULT CURRENT_DATE,

      -- 일일 집계
      request_count INTEGER DEFAULT 0,

      -- 인덱스용 복합 유니크
      UNIQUE(user_id, usage_date)
  );
  ```

  - 용도: 일일 요청 횟수 빠른 조회 (매 요청마다 COUNT 쿼리 방지)
  - 연결: Phase 6의 checkDailyQuota 함수에서 사용

- [x] **1.1.5** `llm_usage_summary` 테이블 생성 (월간 집계 캐시)

  ```sql
  CREATE TABLE llm_usage_summary (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,

      period_type TEXT NOT NULL,            -- 'daily', 'monthly'
      period_start DATE NOT NULL,

      total_tokens INTEGER DEFAULT 0,
      total_requests INTEGER DEFAULT 0,
      total_cost_usd DECIMAL(10, 4) DEFAULT 0,

      tokens_remaining INTEGER,
      requests_remaining INTEGER,

      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),

      UNIQUE(user_id, period_type, period_start)
  );
  ```

- [x] **1.1.6** 인덱스 생성

  ```sql
  -- profiles
  CREATE INDEX idx_profiles_role ON profiles(role);
  CREATE INDEX idx_profiles_is_approved ON profiles(is_approved);

  -- llm_usage
  CREATE INDEX idx_llm_usage_user_id ON llm_usage(user_id);
  CREATE INDEX idx_llm_usage_created_at ON llm_usage(created_at DESC);
  CREATE INDEX idx_llm_usage_user_date ON llm_usage(user_id, created_at);

  -- 🆕 v2.0: 일일 사용량 빠른 조회
  CREATE INDEX idx_llm_daily_usage_lookup ON llm_daily_usage(user_id, usage_date);
  CREATE INDEX idx_llm_usage_summary_lookup ON llm_usage_summary(user_id, period_type, period_start);
  ```

- [x] **1.1.7** updated_at 자동 갱신 트리거 적용

### 1.2 RLS 정책 추가

**파일**: `backend/migrations/004_profiles_rls.sql` [NEW]

- [x] **1.2.1** profiles 테이블 RLS 활성화 및 정책
- [x] **1.2.2** 본인 프로필 조회/수정 정책
- [x] **1.2.3** 관리자 전체 조회 정책
- [x] **1.2.4** role_history RLS 정책 (관리자만)
- [x] **1.2.5** llm_usage, llm_daily_usage RLS 정책

  ```sql
  -- 본인 사용량만 조회 가능
  CREATE POLICY "Users can view own llm_usage"
      ON llm_usage FOR SELECT
      USING (auth.uid() = user_id);

  -- 🆕 v2.0: 일일 사용량도 본인만
  CREATE POLICY "Users can view own llm_daily_usage"
      ON llm_daily_usage FOR SELECT
      USING (auth.uid() = user_id);
  ```

### 1.3 자동 프로필/할당량 트리거

**파일**: `backend/migrations/003_profiles_schema.sql`에 추가

- [x] **1.3.1** 회원가입 시 프로필 자동 생성

  ```sql
  CREATE OR REPLACE FUNCTION handle_new_user()
  RETURNS TRIGGER AS $$
  BEGIN
      INSERT INTO profiles (
          id, role,
          monthly_token_limit, daily_request_limit
      )
      VALUES (
          NEW.id, 'pending',
          0, 0  -- pending은 사용 불가
      );
      RETURN NEW;
  END;
  $$ LANGUAGE plpgsql SECURITY DEFINER;
  ```

- [x] **1.3.2** 🆕 v2.0: 역할 변경 시 할당량 자동 업데이트
  ```sql
  CREATE OR REPLACE FUNCTION update_role_limits()
  RETURNS TRIGGER AS $$
  BEGIN
      CASE NEW.role
          WHEN 'free' THEN
              NEW.monthly_token_limit := 10000;
              NEW.daily_request_limit := 5;     -- 디렉터 지정
          WHEN 'premium' THEN
              NEW.monthly_token_limit := 30000;
              NEW.daily_request_limit := 50;    -- 디렉터 지정
          WHEN 'special' THEN
              NEW.monthly_token_limit := 200000;
              NEW.daily_request_limit := 999999;
          WHEN 'admin' THEN
              NEW.monthly_token_limit := 999999999;
              NEW.daily_request_limit := 999999;
          ELSE
              NEW.monthly_token_limit := 0;
              NEW.daily_request_limit := 0;
      END CASE;
      RETURN NEW;
  END;
  $$ LANGUAGE plpgsql;
  ```

### Phase 1 검증 체크리스트

```
□ Syntax 오류 확인
  - Supabase SQL Editor에서 모든 마이그레이션 파일 실행
  - 에러 메시지 없이 완료 확인

□ 테이블 생성 확인
  - profiles, role_history, llm_usage, llm_daily_usage, llm_usage_summary 존재

□ 트리거 테스트
  - 새 사용자 회원가입 → profiles에 pending, 할당량 0 확인
  - 역할 변경(pending → free) → daily_request_limit = 5 확인

□ 기존 기능 정상 동작 확인
  - 로그인/로그아웃 정상
  - 기존 documents, drafts 조회 정상
```

---

## Phase 2: 프론트엔드 타입 및 훅 확장

**예상 소요 시간**: 1-2일
**담당**: 시니어 개발자, 주니어 개발자

### 영향받을 수 있는 기존 기능

| 기능              | 영향 여부 | 확인 방법                  |
| ----------------- | --------- | -------------------------- |
| useAuth 훅 사용처 | ⚠️ 가능   | 타입 호환성 유지 필요      |
| 로그인 상태 표시  | ⚠️ 가능   | user 객체 확장으로 UI 영향 |
| 보호된 라우트     | ✅ 없음   | 기존 로직 유지             |

### 2.1 타입 정의 추가

**파일**: `frontend/src/types/auth.ts` [NEW]

- [x] **2.1.1** UserRole 타입 정의

  ```typescript
  export type UserRole = "pending" | "free" | "premium" | "special" | "admin";
  ```

- [x] **2.1.2** 🆕 v2.0: 하이브리드 사용량 타입 정의

  ```typescript
  export interface UsageLimits {
    monthlyTokenLimit: number;
    dailyRequestLimit: number; // 🆕 v2.0
  }

  export interface DailyUsage {
    requestCount: number;
    requestsRemaining: number;
    resetAt: string; // 🆕 v2.0: "내일 00:00"
  }

  export interface MonthlyUsage {
    totalTokensUsed: number;
    tokensRemaining: number;
    resetAt: string; // 🆕 v2.0: "다음 달 1일"
  }

  export interface UsageSummary {
    daily: DailyUsage; // 🆕 v2.0
    monthly: MonthlyUsage;
    percentUsed: number;
    isNearDailyLimit: boolean; // 🆕 v2.0: 일일 80% 도달
    isAtDailyLimit: boolean; // 🆕 v2.0: 일일 100% 도달
    isNearMonthlyLimit: boolean;
    isAtMonthlyLimit: boolean;
  }
  ```

- [x] **2.1.3** UserProfile 인터페이스 정의 (할당량 포함)

  ```typescript
  export interface UserProfile {
    id: string;
    role: UserRole;
    tier: number;
    isApproved: boolean;
    approvedAt: string | null;
    subscriptionExpiresAt: string | null;
    monthlyTokenLimit: number;
    dailyRequestLimit: number; // 🆕 v2.0
  }
  ```

- [x] **2.1.4** types/index.ts에 export 추가

### 2.2 useAuth 훅 확장

**파일**: `frontend/src/hooks/useAuth.ts` (기존 파일 수정)

- [x] **2.2.1** 상태에 profile 추가
- [x] **2.2.2** fetchProfile 함수 작성
- [x] **2.2.3** useEffect에 프로필 조회 로직 추가
- [x] **2.2.4** 🆕 v2.0: 반환값에 일일 제한 정보 추가
  ```typescript
  return {
    user,
    profile,
    role: profile?.role ?? null,
    isAdmin: profile?.role === "admin",
    isPremium: ["premium", "special", "admin"].includes(profile?.role ?? ""),
    // 🆕 v2.0
    dailyRequestLimit: profile?.dailyRequestLimit ?? 0,
    monthlyTokenLimit: profile?.monthlyTokenLimit ?? 0,
    canUseLLM: profile?.role !== "pending" && profile?.isApproved,
    loading,
    signOut,
    signInWithGoogle,
  };
  ```

### 2.3 🆕 v2.0: useLLMUsage 훅 생성 (하이브리드)

**파일**: `frontend/src/hooks/useLLMUsage.ts` [NEW]

- [x] **2.3.1** 일일 + 월간 사용량 조회 훅

  ```typescript
  export function useLLMUsage(): UseLLMUsageReturn {
    const [usage, setUsage] = useState<UsageSummary | null>(null);
    const { user, profile } = useAuth();

    const fetchUsage = useCallback(async () => {
      if (!user || !profile) return;

      // 🆕 v2.0: 일일 사용량 조회
      const today = new Date().toISOString().split("T")[0];
      const { data: dailyData } = await supabase
        .from("llm_daily_usage")
        .select("request_count")
        .eq("user_id", user.id)
        .eq("usage_date", today)
        .single();

      const dailyCount = dailyData?.request_count ?? 0;
      const dailyLimit = profile.dailyRequestLimit;

      // 월간 사용량 조회
      const { data: monthlyData } = await supabase
        .from("llm_usage_summary")
        .select("total_tokens")
        .eq("user_id", user.id)
        .eq("period_type", "monthly")
        .eq("period_start", getCurrentMonthStart())
        .single();

      const monthlyTokens = monthlyData?.total_tokens ?? 0;

      setUsage({
        daily: {
          requestCount: dailyCount,
          requestsRemaining: Math.max(0, dailyLimit - dailyCount),
          resetAt: "내일 00:00",
        },
        monthly: {
          totalTokensUsed: monthlyTokens,
          tokensRemaining: Math.max(
            0,
            profile.monthlyTokenLimit - monthlyTokens
          ),
          resetAt: "다음 달 1일",
        },
        isNearDailyLimit: dailyCount >= dailyLimit * 0.8,
        isAtDailyLimit: dailyCount >= dailyLimit,
        isNearMonthlyLimit: monthlyTokens >= profile.monthlyTokenLimit * 0.8,
        isAtMonthlyLimit: monthlyTokens >= profile.monthlyTokenLimit,
        // ...
      });
    }, [user, profile]);

    // ...
  }
  ```

- [x] **2.3.2** 훅에서 refetch 함수 제공 (API 호출 후 갱신용)

### 2.4 권한 체크 유틸리티

**파일**: `frontend/src/lib/permissions.ts` [NEW]

- [x] **2.4.1** hasPermission 함수 작성
- [x] **2.4.2** ROLE_HIERARCHY 상수 정의
- [x] **2.4.3** hasMinimumRole 함수 작성
- [x] **2.4.4** 🆕 v2.0: canMakeLLMRequest 함수 (일일 + 월간 체크)

  ```typescript
  export function canMakeLLMRequest(usage: UsageSummary | null): {
    allowed: boolean;
    reason: "ok" | "daily_limit" | "monthly_limit";
  } {
    if (!usage) return { allowed: false, reason: "ok" };

    // 🆕 v2.0: 일일 제한 먼저 체크 (더 빠른 리셋)
    if (usage.isAtDailyLimit) {
      return { allowed: false, reason: "daily_limit" };
    }

    if (usage.isAtMonthlyLimit) {
      return { allowed: false, reason: "monthly_limit" };
    }

    return { allowed: true, reason: "ok" };
  }
  ```

### Phase 2 검증 체크리스트

```
□ TypeScript 컴파일 오류 확인
  - 터미널: cd frontend && npm run build
  - 타입 에러 0개 확인

□ 브라우저 테스트
  - 로그인 후 콘솔에서 profile.dailyRequestLimit 값 확인
  - useLLMUsage 훅의 daily.requestCount 정상 반환

□ 기존 기능 정상 동작 확인
  - 기존 useAuth 사용처에서 에러 없음
  - 로그인/로그아웃 정상 동작
```

---

## Phase 3: 미들웨어 RBAC 확장

**예상 소요 시간**: 1-2일
**담당**: 시니어 개발자

(기존과 동일 - 생략)

### Phase 3 검증 체크리스트

```
■ 미들웨어 동작 확인 - RBAC 확장 완료
■ 기존 기능 정상 동작 확인 - TypeScript 빌드 성공
```

---

## Phase 4: 관리자 대시보드 UI

**예상 소요 시간**: 3-4일
**담당**: 주니어 개발자, UX/UI 디자인 전문가

### 4.1 관리자 레이아웃

(기존과 동일)

### 4.2 회원 목록 페이지 (🆕 v2.0: 일일 사용량 컬럼 추가)

**파일**: `frontend/src/app/admin/users/page.tsx` [NEW]

- [ ] **4.2.1** 회원 목록 테이블 컴포넌트
  - 🆕 v2.0 컬럼: 이메일, 등급, **오늘 사용**, **월간 사용**, 가입일, 액션

### 4.3 🆕 v2.0: 전체 사용량 대시보드 (일일 추이 강화)

**파일**: `frontend/src/app/admin/usage/page.tsx` [NEW]

- [ ] **4.3.1** 전체 서비스 LLM 비용 현황

  - 🆕 v2.0: 일간 요청 추이 차트
  - 월간 토큰 사용량 차트
  - 추정 비용 (USD)

- [ ] **4.3.2** 등급별 일일 사용량 분포

### 4.4 🆕 v2.0: 사용량 게이지 컴포넌트 (듀얼 게이지)

**파일**: `frontend/src/components/ui/UsageGauge.tsx` [NEW]

- [ ] **4.4.1** 듀얼 게이지 컴포넌트

  ```typescript
  interface DualUsageGaugeProps {
    dailyUsed: number;
    dailyLimit: number;
    monthlyUsed: number;
    monthlyLimit: number;
  }

  // 🆕 v2.0: 두 개의 게이지를 나란히 표시
  // "오늘 5/20회" | "이번 달 1,234/10,000 토큰"
  ```

  - 색상: 80% 미만(초록), 80-90%(노랑), 90% 이상(빨강)
  - 접근성: aria-valuenow, aria-valuemax

### Phase 4 검증 체크리스트

```
□ UI 렌더링 확인
  - /admin/users 페이지에 일일 + 월간 사용량 컬럼 표시
  - 듀얼 게이지 정상 렌더링

□ 접근성 테스트
  - DualUsageGauge에 aria 속성 적용
```

---

## Phase 5: 관리자 API 연동

(기존과 유사 - 일일 사용량 추가)

---

## Phase 6: LLM API 사용량 추적 시스템 (🆕 v2.0 하이브리드)

**예상 소요 시간**: 3-4일
**담당**: AI/ML 엔지니어, 시니어 개발자, 백엔드 개발자

### 영향받을 수 있는 기존 기능

| 기능              | 영향 여부    | 확인 방법             |
| ----------------- | ------------ | --------------------- |
| 기존 LLM API 호출 | ⚠️ 필수 수정 | 모든 호출에 래퍼 적용 |
| AI 응답 속도      | ⚠️ 가능      | 로깅 오버헤드 최소화  |

### 6.1 🆕 v2.0: LLM 호출 래퍼 구현 (하이브리드 체크)

**파일**: `frontend/src/lib/llm/wrapper.ts` [NEW]

- [ ] **6.1.1** LLM API 호출 래퍼 함수

  ```typescript
  export async function callLLM(
    options: LLMRequestOptions
  ): Promise<LLMResponse> {
    // 🆕 v2.0: 1. 일일 할당량 먼저 체크 (빠른 응답)
    const dailyQuota = await checkDailyQuota(options.userId);
    if (!dailyQuota.allowed) {
      throw new DailyQuotaExceededError(
        "오늘의 AI 사용 횟수를 모두 사용했습니다. 내일 다시 시도해주세요."
      );
    }

    // 2. 월간 토큰 할당량 체크
    const monthlyQuota = await checkMonthlyQuota(options.userId);
    if (!monthlyQuota.allowed) {
      throw new MonthlyQuotaExceededError(
        "이번 달 AI 토큰을 모두 사용했습니다."
      );
    }

    // 3. 캐시 체크
    const cached = await getFromCache(options);
    if (cached) {
      await logUsage({ ...options, cached: true, tokens: 0 });
      await incrementDailyUsage(options.userId); // 🆕 v2.0: 캐시도 횟수 카운트
      return cached;
    }

    // 4. 실제 LLM API 호출
    const response = await actualLLMCall(options);

    // 5. 사용량 기록
    await Promise.all([
      logUsage(response),
      incrementDailyUsage(options.userId), // 🆕 v2.0
      updateMonthlySummary(options.userId, response.usage.totalTokens),
    ]);

    return response;
  }
  ```

- [ ] **6.1.2** 🆕 v2.0: 일일 할당량 체크 함수

  ```typescript
  async function checkDailyQuota(
    userId: string
  ): Promise<{ allowed: boolean }> {
    const today = new Date().toISOString().split("T")[0];

    const { data: dailyUsage } = await supabase
      .from("llm_daily_usage")
      .select("request_count")
      .eq("user_id", userId)
      .eq("usage_date", today)
      .single();

    const { data: profile } = await supabase
      .from("profiles")
      .select("daily_request_limit")
      .eq("id", userId)
      .single();

    const count = dailyUsage?.request_count ?? 0;
    const limit = profile?.daily_request_limit ?? 0;

    return { allowed: count < limit };
  }
  ```

- [ ] **6.1.3** 🆕 v2.0: 일일 사용량 증가 함수

  ```typescript
  async function incrementDailyUsage(userId: string): Promise<void> {
    const today = new Date().toISOString().split("T")[0];

    // UPSERT: 있으면 +1, 없으면 생성
    await supabase.rpc("increment_daily_usage", {
      p_user_id: userId,
      p_date: today,
    });
  }
  ```

- [ ] **6.1.4** DailyQuotaExceededError, MonthlyQuotaExceededError 커스텀 에러

### 6.2 🆕 v2.0: 일일 사용량 RPC 함수

**파일**: `backend/migrations/005_usage_functions.sql` [NEW]

- [ ] **6.2.1** increment_daily_usage RPC 함수

  ```sql
  CREATE OR REPLACE FUNCTION increment_daily_usage(
      p_user_id UUID,
      p_date DATE
  )
  RETURNS VOID AS $$
  BEGIN
      INSERT INTO llm_daily_usage (user_id, usage_date, request_count)
      VALUES (p_user_id, p_date, 1)
      ON CONFLICT (user_id, usage_date)
      DO UPDATE SET request_count = llm_daily_usage.request_count + 1;
  END;
  $$ LANGUAGE plpgsql SECURITY DEFINER;
  ```

- [ ] **6.2.2** 🆕 v2.0: 일일 자정 리셋 (자동 - 테이블 구조로 처리)

  - `usage_date` 컬럼으로 자동 분리되므로 별도 리셋 불필요

- [ ] **6.2.3** update_monthly_summary RPC 함수 (기존과 동일)

### 6.3 기존 LLM 호출 코드 마이그레이션

- [ ] **6.3.1** 기존 LLM 호출 위치 파악
- [ ] **6.3.2** 모든 호출을 callLLM 래퍼로 교체
- [ ] **6.3.3** 에러 핸들링 (일일/월간 구분)

### Phase 6 검증 체크리스트

```
□ 일일 제한 테스트
  - 5회 사용 후 DailyQuotaExceededError 발생 확인 (free 기준)
  - 다음 날(날짜 변경) 후 다시 사용 가능 확인

□ 월간 제한 테스트
  - 토큰 한도 초과 후 MonthlyQuotaExceededError 발생 확인

□ 성능 테스트
  - 로깅으로 인한 응답 지연 200ms 미만

□ 기존 기능 정상 동작 확인
  - 모든 AI 기능 정상 동작
```

---

## Phase 7: 🆕 v2.0 사용자 사용량 UI (하이브리드)

**예상 소요 시간**: 2-3일
**담당**: 프론트엔드 개발자, UX/UI 디자인 전문가

### 영향받을 수 있는 기존 기능

| 기능            | 영향 여부 | 확인 방법             |
| --------------- | --------- | --------------------- |
| 에디터 UI       | ⚠️ 추가   | 사용량 표시 영역 추가 |
| 헤더/네비게이션 | ⚠️ 추가   | 사용량 게이지 추가    |

### 7.1 🆕 v2.0: 듀얼 사용량 표시 컴포넌트

**파일**: `frontend/src/components/usage/UsageIndicator.tsx` [NEW]

- [ ] **7.1.1** 헤더용 미니 사용량 표시 (듀얼)

  ```typescript
  // 🆕 v2.0: "오늘 3/5회 | 이번 달 1,234/10,000"
  <div className="usage-indicator">
    <span className="daily">
      오늘 {daily.requestCount}/{dailyLimit}회
    </span>
    <span className="divider">|</span>
    <span className="monthly">
      이번 달 {monthly.tokensUsed}/{monthlyLimit}
    </span>
  </div>
  ```

  - 접근성: aria-label="AI 사용량: 오늘 3회 중 5회 사용, 이번 달 1234 토큰 중 10000 사용"

- [ ] **7.1.2** 상세 사용량 모달

  - 일일 요청 횟수 + 리셋 시간 ("내일 00:00에 리셋")
  - 월간 토큰 사용량 + 리셋 시간 ("다음 달 1일에 리셋")
  - 사용 이력 (최근 10건)

- [ ] **7.1.3** 한도 경고 배너 (일일 또는 월간)
  - 🆕 v2.0: **일일 먼저 표시** (더 빠른 리셋이므로 긍정적 메시지)
  - 일일 80%: "오늘 AI 사용량이 얼마 남지 않았어요 (내일 리셋)"
  - 월간 80%: "이번 달 AI 토큰이 얼마 남지 않았어요"

### 7.2 🆕 v2.0: 한도 초과 UX (일일/월간 구분)

**파일**: `frontend/src/components/usage/QuotaExceededModal.tsx` [NEW]

- [ ] **7.2.1** 일일 한도 초과 모달 (긍정적 메시지)

  ```typescript
  // 일일 제한은 곧 리셋되므로 더 친절하게
  "오늘의 AI 사용 횟수를 모두 사용했습니다 🎉"
  "내일 00:00에 다시 사용할 수 있어요!"
  [프리미엄 업그레이드로 50회/일]
  ```

- [ ] **7.2.2** 월간 한도 초과 모달

  ```typescript
  // 월간 제한은 더 길게 기다려야 하므로 업그레이드 유도
  "이번 달 AI 토큰을 모두 사용했습니다"
  "다음 달 1일에 리셋됩니다"
  [지금 업그레이드하면 바로 사용 가능!]
  ```

- [ ] **7.2.3** AI 버튼 비활성화 처리
  - 툴팁: "오늘 사용량 초과" 또는 "월간 토큰 소진"

### 7.3 에디터에 사용량 표시 통합

**파일**: `frontend/src/app/editor/page.tsx` (수정)

- [ ] **7.3.1** 에디터 헤더에 UsageIndicator 추가
- [ ] **7.3.2** AI 기능 호출 전 canMakeLLMRequest 체크
- [ ] **7.3.3** 한도 초과 시 적절한 모달 표시

### Phase 7 검증 체크리스트

```
□ UI 렌더링 확인
  - 헤더에 "오늘 N/20회 | 이번 달 N/10,000" 형식 표시
  - 일일/월간 경고 배너 색상 구분

□ UX 테스트
  - 일일 한도 초과 → "내일 리셋" 안내 모달
  - 월간 한도 초과 → "업그레이드" 유도 모달

□ 접근성 테스트
  - 사용량 정보 스크린 리더 접근 가능
```

---

## Phase 8: 비용 최적화 전략 적용

(기존과 동일)

---

## Phase 9: 🆕 v2.0 Fair Use 정책 및 이상 탐지

**예상 소요 시간**: 1-2일
**담당**: 보안 전문가, 백엔드 개발자

### 9.1 Fair Use 정책 문서

- [ ] **9.1.1** 이용약관에 Fair Use 조항 추가
  - 비정상적 사용 패턴 정의
  - 자동화/봇 사용 금지
  - 상업적 대량 생성 제한

### 9.2 이상 사용 탐지

- [ ] **9.2.1** 분당 요청 수 Rate Limiting

  - Microsoft Copilot 참고: ~18 요청/분
  - 구현: 미들웨어 또는 Supabase Edge Function

- [ ] **9.2.2** 비정상 패턴 탐지
  - 단시간 급증 탐지
  - IP 기반 제한 고려

---

## Phase 10: 통합 테스트 및 최종 검증

**예상 소요 시간**: 2-3일
**담당**: 시니어 개발자, 주니어 개발자, UX/UI 디자인 전문가, QA

### 10.1 End-to-End 시나리오 테스트

- [ ] **10.1.1** 신규 회원가입 → pending 상태, 할당량 0
- [ ] **10.1.2** 관리자가 회원 승인 → free, 일일 5회, 월간 10,000 토큰
- [ ] **10.1.3** free 회원 AI 5회 사용 → 일일 한도 도달 → 안내 UI
- [ ] **10.1.4** 다음 날 → 일일 리셋 → 다시 사용 가능
- [ ] **10.1.5** 월간 토큰 한도 도달 → 월간 한도 안내 UI
- [ ] **10.1.6** 등급 업그레이드 → 할당량 자동 증가

### 10.2 비용 시뮬레이션

- [ ] **10.2.1** 100명 사용자: 모두 free, 매일 5회 = 500회/일
- [ ] **10.2.2** 1,000명 사용자: 혼합 등급 = 약 $Y

### Phase 10 최종 검증 체크리스트

```
□ 하이브리드 모델 동작 확인
  - 일일 제한 정상 (free: 5회, premium: 50회)
  - 월간 제한 정상 (매월 1일 리셋)
  - 두 제한이 독립적으로 동작

□ 사용자 UI 확인
  - "오늘 N/5회 | 이번 달 N/10,000" (free 기준)
  - 일일/월간 한도 초과 시 적절한 안내

□ 기존 서비스 영향 없음
  - 기존 사용자 데이터 정상
  - AI 기능 품질 유지

□ 배포 준비
  - 환경 변수 설정
  - 마이그레이션 스크립트
  - 롤백 계획
```

---

## 부록: 파일 목록 요약

### 신규 생성 파일 (v2.0 추가분 포함)

| 파일 경로                                              | Phase | 담당   | v2.0 신규 |
| ------------------------------------------------------ | ----- | ------ | --------- |
| `backend/migrations/003_profiles_schema.sql`           | 1     | 시니어 | 수정      |
| `backend/migrations/004_profiles_rls.sql`              | 1     | 시니어 | -         |
| `backend/migrations/005_usage_functions.sql`           | 6     | 시니어 | 수정      |
| `frontend/src/types/auth.ts`                           | 2     | 주니어 | 수정      |
| `frontend/src/hooks/useLLMUsage.ts`                    | 2     | 주니어 | 🆕 수정   |
| `frontend/src/lib/llm/wrapper.ts`                      | 6     | AI/ML  | 🆕 수정   |
| `frontend/src/components/usage/UsageIndicator.tsx`     | 7     | UX/UI  | 🆕 수정   |
| `frontend/src/components/usage/QuotaExceededModal.tsx` | 7     | UX/UI  | 🆕 수정   |
| `frontend/src/components/ui/UsageGauge.tsx`            | 4     | UX/UI  | 🆕 듀얼   |

---

## v2.0 변경 이력

| 버전     | 날짜                 | 변경 내용                                    |
| -------- | -------------------- | -------------------------------------------- |
| v1.0     | 2025-12-15 07:06     | 초기 버전 (월간 토큰만)                      |
| **v2.0** | **2025-12-15 07:32** | **하이브리드 모델 적용**                     |
| -        | -                    | 일일 요청 제한 추가 (Grammarly, Google 참고) |
| -        | -                    | llm_daily_usage 테이블 추가                  |
| -        | -                    | 듀얼 게이지 UI 추가                          |
| -        | -                    | 일일/월간 구분 에러 처리                     |
| -        | -                    | Fair Use 정책 Phase 추가                     |

---

**작성 완료**: 2025-12-15
**버전**: v2.0 (하이브리드 모델)
**검토자 서명**: **\*\*\*\***\_\_\_\_**\*\*\*\***
````
