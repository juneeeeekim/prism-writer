# 회원 등급 관리 시스템 구현 체크리스트

**작성일**: 2025-12-15  
**기반 문서**: 회원등급관리시스템\_전문가회의보고서.md  
**담당자**: 시니어 개발자, 주니어 개발자, UX/UI 디자인 전문가, AI/ML 엔지니어, 데이터 엔지니어, DevOps 엔지니어

---

## 개요

이 체크리스트는 **LLM API 사용량 기반 회원 등급 관리 시스템**을 단계별로 구현하기 위한 상세 가이드입니다.  
각 Phase는 **독립적으로 검증 가능**하며, 이전 Phase가 완료되어야 다음 Phase로 진행할 수 있습니다.

> ⚠️ **핵심 비용 구조 이해**
> 이 서비스의 **고정비 증가 요인**은 다음과 같습니다:
>
> 1. **LLM API 토큰 사용량** (가장 큰 비용)
> 2. **LLM 응답으로 생성된 데이터 저장량**
>
> 따라서 회원 등급 시스템은 **토큰 할당량 관리**가 핵심입니다.

---

## 등급 구조 (LLM 사용량 반영)

```
pending(가입대기) → free(무료) → premium(유료) → special(특별) → admin(관리자)
         │              │              │              │
         │              │              │              └─ 무제한
         │              │              └─ 월 50,000 토큰
         │              └─ 월 10,000 토큰
         └─ 서비스 이용 불가
```

### 등급별 LLM 사용량 할당 (예시)

| 등급        | 월간 토큰 한도 | 일일 요청 제한 | AI 기능             |
| ----------- | -------------- | -------------- | ------------------- |
| **pending** | 0              | 0              | 불가                |
| **free**    | 10,000         | 50회           | 기본 AI만           |
| **premium** | 50,000         | 200회          | 모든 AI             |
| **special** | 200,000        | 무제한         | 모든 AI + 우선 처리 |
| **admin**   | 무제한         | 무제한         | 모든 기능           |

### 품질 기준 (모든 항목에 적용)

- [ ] ✅ 코딩 스타일 일치 (기존 프로젝트 컨벤션 준수)
- [ ] ✅ 명확한 함수명/변수명 (영문, camelCase/PascalCase)
- [ ] ✅ 에러 처리 존재 (try-catch, 에러 메시지 한글화)
- [ ] ✅ 성능 이슈 없음 (불필요한 리렌더링, 과도한 API 호출 방지)
- [ ] ✅ 접근성 고려 (aria-label, 키보드 네비게이션)

---

## 🆕 전문가 회의 결과: LLM 사용량 관리 전략

### 회의 참석자

- 시니어 개발자, AI/ML 엔지니어, 데이터 엔지니어, DevOps 엔지니어, 백엔드 개발자, 프론트엔드 개발자, UX/UI 디자이너, 보안 전문가, PM

### 핵심 합의 사항

1. **토큰 사용량 추적**: 모든 LLM API 호출의 input/output 토큰을 기록
2. **실시간 할당량 체크**: API 호출 전 잔여 할당량 확인
3. **부드러운 제한**: 한도 도달 시 서비스 차단이 아닌 속도 제한
4. **비용 최적화**: 캐싱, 모델 티어링, 프롬프트 최적화 적용
5. **투명한 UI**: 사용자에게 실시간 사용량 표시

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

- [ ] **1.1.1** `profiles` 테이블 생성 SQL 작성

  ```sql
  CREATE TABLE profiles (
      id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
      role TEXT DEFAULT 'pending',
      tier INTEGER DEFAULT 0,
      is_approved BOOLEAN DEFAULT FALSE,
      approved_at TIMESTAMPTZ,
      approved_by UUID REFERENCES auth.users(id),
      subscription_expires_at TIMESTAMPTZ,
      -- 🆕 LLM 사용량 관련 필드
      monthly_token_limit INTEGER DEFAULT 0,      -- 월간 토큰 한도
      daily_request_limit INTEGER DEFAULT 0,      -- 일일 요청 제한
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
  );
  ```

  - 의존성: 없음
  - 품질: 테이블명/컬럼명 snake_case 확인

- [ ] **1.1.2** `role_history` 테이블 생성 SQL 작성

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

- [ ] **1.1.3** 🆕 `llm_usage` 테이블 생성 (LLM 사용량 추적 핵심)

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

      -- 비용 계산 (선택적, 추후 비용 분석용)
      estimated_cost_usd DECIMAL(10, 6),

      -- 메타데이터
      request_id TEXT,                      -- 디버깅용 요청 ID
      response_time_ms INTEGER,             -- 응답 시간 (성능 모니터링)
      is_cached BOOLEAN DEFAULT FALSE,      -- 캐시 히트 여부

      created_at TIMESTAMPTZ DEFAULT NOW()
  );
  ```

  - **AI/ML 엔지니어 제안**: 모델별 토큰 비용이 다르므로 model_name 기록 필수
  - **데이터 엔지니어 제안**: 분석을 위해 request_type도 필수 기록

- [ ] **1.1.4** 🆕 `llm_usage_summary` 테이블 생성 (집계 캐시)

  ```sql
  CREATE TABLE llm_usage_summary (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,

      -- 기간
      period_type TEXT NOT NULL,            -- 'daily', 'monthly'
      period_start DATE NOT NULL,

      -- 집계 데이터
      total_tokens INTEGER DEFAULT 0,
      total_requests INTEGER DEFAULT 0,
      total_cost_usd DECIMAL(10, 4) DEFAULT 0,

      -- 제한 체크용 (빠른 조회)
      tokens_remaining INTEGER,
      requests_remaining INTEGER,

      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),

      UNIQUE(user_id, period_type, period_start)
  );
  ```

  - **데이터 엔지니어 제안**: 매 요청마다 SUM 쿼리 대신 집계 테이블 사용 (성능)

- [ ] **1.1.5** profiles 테이블 인덱스 생성

  ```sql
  CREATE INDEX idx_profiles_role ON profiles(role);
  CREATE INDEX idx_profiles_is_approved ON profiles(is_approved);
  ```

- [ ] **1.1.6** 🆕 llm_usage 인덱스 생성

  ```sql
  CREATE INDEX idx_llm_usage_user_id ON llm_usage(user_id);
  CREATE INDEX idx_llm_usage_created_at ON llm_usage(created_at DESC);
  CREATE INDEX idx_llm_usage_user_date ON llm_usage(user_id, created_at);
  CREATE INDEX idx_llm_usage_summary_lookup ON llm_usage_summary(user_id, period_type, period_start);
  ```

- [ ] **1.1.7** updated_at 자동 갱신 트리거 적용 (profiles, llm_usage_summary)

### 1.2 RLS 정책 추가

**파일**: `backend/migrations/004_profiles_rls.sql` [NEW]

- [ ] **1.2.1** profiles 테이블 RLS 활성화 및 정책
- [ ] **1.2.2** 본인 프로필 조회/수정 정책
- [ ] **1.2.3** 관리자 전체 조회 정책
- [ ] **1.2.4** role_history RLS 정책 (관리자만)
- [ ] **1.2.5** 🆕 llm_usage RLS 정책

  ```sql
  -- 본인 사용량만 조회 가능
  CREATE POLICY "Users can view own llm_usage"
      ON llm_usage FOR SELECT
      USING (auth.uid() = user_id);

  -- 시스템만 INSERT 가능 (API를 통해서만)
  CREATE POLICY "System can insert llm_usage"
      ON llm_usage FOR INSERT
      WITH CHECK (auth.uid() = user_id);

  -- 관리자는 모든 사용량 조회 가능
  CREATE POLICY "Admins can view all llm_usage"
      ON llm_usage FOR SELECT
      USING (
          EXISTS (
              SELECT 1 FROM profiles
              WHERE id = auth.uid() AND role = 'admin'
          )
      );
  ```

### 1.3 자동 프로필 생성 트리거

**파일**: `backend/migrations/003_profiles_schema.sql`에 추가

- [ ] **1.3.1** 회원가입 시 profiles 레코드 자동 생성 트리거 (🆕 할당량 포함)

  ```sql
  CREATE OR REPLACE FUNCTION handle_new_user()
  RETURNS TRIGGER AS $$
  BEGIN
      INSERT INTO profiles (
          id,
          role,
          monthly_token_limit,
          daily_request_limit
      )
      VALUES (
          NEW.id,
          'pending',
          0,    -- pending은 사용 불가
          0
      );
      RETURN NEW;
  END;
  $$ LANGUAGE plpgsql SECURITY DEFINER;
  ```

- [ ] **1.3.2** 🆕 역할 변경 시 할당량 자동 업데이트 트리거

  ```sql
  CREATE OR REPLACE FUNCTION update_role_limits()
  RETURNS TRIGGER AS $$
  BEGIN
      -- 역할에 따른 할당량 자동 설정
      CASE NEW.role
          WHEN 'free' THEN
              NEW.monthly_token_limit := 10000;
              NEW.daily_request_limit := 50;
          WHEN 'premium' THEN
              NEW.monthly_token_limit := 50000;
              NEW.daily_request_limit := 200;
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

  CREATE TRIGGER on_role_change
      BEFORE UPDATE OF role ON profiles
      FOR EACH ROW
      WHEN (OLD.role IS DISTINCT FROM NEW.role)
      EXECUTE FUNCTION update_role_limits();
  ```

### Phase 1 검증 체크리스트

```
□ Syntax 오류 확인
  - Supabase SQL Editor에서 모든 마이그레이션 파일 실행
  - 에러 메시지 없이 완료 확인

□ 테이블 생성 확인
  - profiles, role_history, llm_usage, llm_usage_summary 테이블 존재 확인

□ 트리거 테스트
  - 새 사용자 회원가입 → profiles에 pending, 할당량 0 확인
  - 역할 변경(pending → free) → 할당량 자동 업데이트 확인

□ RLS 정책 테스트
  - 일반 사용자: 본인 llm_usage만 조회 가능
  - 관리자: 모든 사용자 llm_usage 조회 가능

□ 기존 기능 정상 동작 확인
  - 로그인/로그아웃 정상 동작
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

- [ ] **2.1.1** UserRole 타입 정의

  ```typescript
  export type UserRole = "pending" | "free" | "premium" | "special" | "admin";
  ```

- [ ] **2.1.2** 🆕 LLM 사용량 관련 타입 정의

  ```typescript
  export interface UsageLimits {
    monthlyTokenLimit: number;
    dailyRequestLimit: number;
  }

  export interface UsageSummary {
    totalTokensUsed: number;
    totalRequestsToday: number;
    tokensRemaining: number;
    requestsRemaining: number;
    percentUsed: number; // 0-100
    isNearLimit: boolean; // 80% 이상
    isAtLimit: boolean; // 100% 도달
  }

  export interface LLMUsageRecord {
    id: string;
    requestType: "chat" | "summarize" | "generate" | "edit";
    modelName: string;
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    createdAt: string;
  }
  ```

- [ ] **2.1.3** UserProfile 인터페이스 정의 (🆕 할당량 포함)

  ```typescript
  export interface UserProfile {
    id: string;
    role: UserRole;
    tier: number;
    isApproved: boolean;
    approvedAt: string | null;
    subscriptionExpiresAt: string | null;
    // 🆕 LLM 할당량
    monthlyTokenLimit: number;
    dailyRequestLimit: number;
  }
  ```

- [ ] **2.1.4** types/index.ts에 export 추가

### 2.2 useAuth 훅 확장

**파일**: `frontend/src/hooks/useAuth.ts` (기존 파일 수정)

- [ ] **2.2.1** 상태에 profile 추가
- [ ] **2.2.2** fetchProfile 함수 작성
- [ ] **2.2.3** useEffect에 프로필 조회 로직 추가
- [ ] **2.2.4** 반환값에 profile, role, 권한 헬퍼 추가
  ```typescript
  return {
    user,
    profile,
    role: profile?.role ?? null,
    isAdmin: profile?.role === "admin",
    isPremium: ["premium", "special", "admin"].includes(profile?.role ?? ""),
    // 🆕 LLM 할당량 접근
    tokenLimit: profile?.monthlyTokenLimit ?? 0,
    requestLimit: profile?.dailyRequestLimit ?? 0,
    canUseLLM: profile?.role !== "pending" && profile?.isApproved,
    loading,
    signOut,
    signInWithGoogle,
  };
  ```

### 2.3 🆕 useLLMUsage 훅 생성

**파일**: `frontend/src/hooks/useLLMUsage.ts` [NEW]

- [ ] **2.3.1** 현재 사용량 조회 훅

  ```typescript
  interface UseLLMUsageReturn {
    usage: UsageSummary | null;
    loading: boolean;
    error: Error | null;
    refetch: () => Promise<void>;
  }

  export function useLLMUsage(): UseLLMUsageReturn {
    const [usage, setUsage] = useState<UsageSummary | null>(null);
    const { user, profile } = useAuth();

    const fetchUsage = useCallback(async () => {
      if (!user) return;

      const { data, error } = await supabase
        .from("llm_usage_summary")
        .select("*")
        .eq("user_id", user.id)
        .eq("period_type", "monthly")
        .eq("period_start", getCurrentMonthStart())
        .single();

      if (data) {
        setUsage({
          totalTokensUsed: data.total_tokens,
          tokensRemaining: profile?.monthlyTokenLimit - data.total_tokens,
          percentUsed: (data.total_tokens / profile?.monthlyTokenLimit) * 100,
          isNearLimit: data.total_tokens >= profile?.monthlyTokenLimit * 0.8,
          isAtLimit: data.total_tokens >= profile?.monthlyTokenLimit,
          // ...
        });
      }
    }, [user, profile]);

    // ...
  }
  ```

- [ ] **2.3.2** 실시간 업데이트를 위한 Supabase Realtime 구독 (선택적)

### 2.4 권한 체크 유틸리티

**파일**: `frontend/src/lib/permissions.ts` [NEW]

- [ ] **2.4.1** hasPermission 함수 작성
- [ ] **2.4.2** ROLE_HIERARCHY 상수 정의
- [ ] **2.4.3** hasMinimumRole 함수 작성
- [ ] **2.4.4** 🆕 canMakeLLMRequest 함수 작성

  ```typescript
  export function canMakeLLMRequest(usage: UsageSummary | null): boolean {
    if (!usage) return false;
    return !usage.isAtLimit;
  }

  export function getUsageWarningLevel(
    usage: UsageSummary | null
  ): "ok" | "warning" | "critical" | "blocked" {
    if (!usage) return "ok";
    if (usage.isAtLimit) return "blocked";
    if (usage.percentUsed >= 90) return "critical";
    if (usage.percentUsed >= 80) return "warning";
    return "ok";
  }
  ```

### Phase 2 검증 체크리스트

```
□ TypeScript 컴파일 오류 확인
  - 터미널: cd frontend && npm run build
  - 타입 에러 0개 확인

□ 브라우저 테스트
  - 로그인 후 콘솔에서 profile, tokenLimit 값 확인
  - useLLMUsage 훅의 usage 데이터 정상 반환

□ 기존 기능 정상 동작 확인
  - 기존 useAuth 사용처에서 에러 없음
  - 로그인/로그아웃 정상 동작
```

---

## Phase 3: 미들웨어 RBAC 확장

**예상 소요 시간**: 1-2일  
**담당**: 시니어 개발자

### 영향받을 수 있는 기존 기능

| 기능                | 영향 여부 | 확인 방법                 |
| ------------------- | --------- | ------------------------- |
| /editor 라우트 보호 | ⚠️ 가능   | 기존 로직 유지하면서 확장 |
| 정적 페이지 접근    | ✅ 없음   | matcher 설정 유지         |

### 3.1 미들웨어 권한 로직 추가

**파일**: `frontend/src/middleware.ts` (기존 파일 수정)

- [ ] **3.1.1** 역할 기반 라우트 설정 추가
- [ ] **3.1.2** profiles 테이블에서 역할 조회 로직 추가
- [ ] **3.1.3** 역할 기반 접근 제어 로직 추가
- [ ] **3.1.4** matcher 설정 확장

### 3.2 권한 없음/승인 대기 페이지 생성

- [ ] **3.2.1** `/unauthorized` 페이지
- [ ] **3.2.2** `/pending-approval` 페이지
- [ ] **3.2.3** 🆕 `/usage-limit` 페이지 (사용량 초과 안내)
      **파일**: `frontend/src/app/usage-limit/page.tsx` [NEW]
  - UX: 현재 사용량 표시, 다음 리셋 시간 안내
  - CTA: 업그레이드 유도 버튼

### Phase 3 검증 체크리스트

```
□ 미들웨어 동작 확인
  - pending 사용자: /editor 접근 시 /pending-approval로 리다이렉트
  - free 사용자: /editor 접근 가능, /admin 접근 시 /unauthorized로 리다이렉트
  - admin 사용자: 모든 페이지 접근 가능

□ 기존 기능 정상 동작 확인
  - 기존 /editor 페이지 정상 접근 (free 이상)
```

---

## Phase 4: 관리자 대시보드 UI

**예상 소요 시간**: 3-4일  
**담당**: 주니어 개발자, UX/UI 디자인 전문가

### 영향받을 수 있는 기존 기능

| 기능                 | 영향 여부 | 확인 방법             |
| -------------------- | --------- | --------------------- |
| 기존 페이지 레이아웃 | ✅ 없음   | 별도 /admin 라우트    |
| 전역 스타일          | ⚠️ 가능   | globals.css 충돌 확인 |

### 4.1 관리자 레이아웃

**파일**: `frontend/src/app/admin/layout.tsx` [NEW]

- [ ] **4.1.1** 관리자 전용 레이아웃 컴포넌트
- [ ] **4.1.2** 관리자 권한 체크 로직

### 4.2 회원 목록 페이지 (🆕 사용량 컬럼 추가)

**파일**: `frontend/src/app/admin/users/page.tsx` [NEW]

- [ ] **4.2.1** 회원 목록 테이블 컴포넌트
  - 🆕 컬럼: 이메일, 등급, **월간 사용량**, **잔여량**, 가입일, 액션
- [ ] **4.2.2** 페이지네이션 구현
- [ ] **4.2.3** 등급/사용량 필터링 기능
- [ ] **4.2.4** 검색 기능 (이메일)

### 4.3 회원 상세/수정 모달 (🆕 사용량 표시)

**파일**: `frontend/src/components/admin/UserDetailModal.tsx` [NEW]

- [ ] **4.3.1** 회원 정보 표시
- [ ] **4.3.2** 등급 변경 폼
- [ ] **4.3.3** 🆕 LLM 사용량 통계 표시
  - 월간 토큰 사용량 차트
  - 요청 유형별 분포
  - 일자별 추이
- [ ] **4.3.4** 🆕 수동 할당량 조정 (특별 케이스용)

### 4.4 🆕 전체 사용량 대시보드

**파일**: `frontend/src/app/admin/usage/page.tsx` [NEW]

- [ ] **4.4.1** 전체 서비스 LLM 비용 현황
  - 일간/월간 토큰 사용량 합계
  - 추정 비용 (USD)
  - 비용 추이 차트
- [ ] **4.4.2** 등급별 사용량 분포
- [ ] **4.4.3** Top 10 사용자 목록
- [ ] **4.4.4** 비용 알림 설정 (월 예산 초과 시 알림)

### 4.5 등급별 뱃지 & 사용량 게이지 컴포넌트

- [ ] **4.5.1** RoleBadge 컴포넌트
- [ ] **4.5.2** 🆕 UsageGauge 컴포넌트
      **파일**: `frontend/src/components/ui/UsageGauge.tsx` [NEW]
  ```typescript
  interface UsageGaugeProps {
    used: number;
    limit: number;
    label?: string;
    showPercentage?: boolean;
  }
  ```
  - 색상: 80% 미만(초록), 80-90%(노랑), 90% 이상(빨강)
  - 접근성: aria-valuenow, aria-valuemax

### Phase 4 검증 체크리스트

```
□ UI 렌더링 확인
  - /admin/users 페이지에 사용량 컬럼 표시
  - /admin/usage 페이지 차트 정상 렌더링
  - 반응형 디자인 확인

□ 기능 테스트
  - 회원별 사용량 조회 정상
  - 사용량 필터링 동작
  - 차트 데이터 정확성

□ 접근성 테스트
  - UsageGauge에 aria 속성 적용
  - 스크린 리더에서 사용량 정보 읽기 가능
```

---

## Phase 5: 관리자 API 연동

**예상 소요 시간**: 2-3일  
**담당**: 시니어 개발자, 주니어 개발자

### 영향받을 수 있는 기존 기능

| 기능                | 영향 여부 | 확인 방법              |
| ------------------- | --------- | ---------------------- |
| 기존 API 엔드포인트 | ✅ 없음   | 별도 /api/admin 경로   |
| Supabase 연결       | ✅ 없음   | 기존 클라이언트 재사용 |

### 5.1 관리자 API Route 핸들러

**파일**: `frontend/src/app/api/admin/users/route.ts` [NEW]

- [ ] **5.1.1** GET /api/admin/users - 회원 목록 조회 (🆕 사용량 포함)
- [ ] **5.1.2** 관리자 권한 검증 미들웨어 함수

### 5.2 회원 상세/수정 API

**파일**: `frontend/src/app/api/admin/users/[id]/route.ts` [NEW]

- [ ] **5.2.1** GET /api/admin/users/[id] - 회원 상세 (🆕 사용량 통계 포함)
- [ ] **5.2.2** PATCH /api/admin/users/[id] - 회원 정보 수정

### 5.3 🆕 사용량 통계 API

**파일**: `frontend/src/app/api/admin/usage/route.ts` [NEW]

- [ ] **5.3.1** GET /api/admin/usage - 전체 사용량 통계
- [ ] **5.3.2** GET /api/admin/usage/daily - 일별 추이
- [ ] **5.3.3** GET /api/admin/usage/by-role - 등급별 분포

### 5.4 프론트엔드 API 클라이언트

**파일**: `frontend/src/lib/api/admin.ts` [NEW]

- [ ] **5.4.1** fetchUsers 함수
- [ ] **5.4.2** updateUserRole 함수
- [ ] **5.4.3** 🆕 fetchUsageStats 함수
- [ ] **5.4.4** 🆕 fetchUserUsageHistory 함수

### Phase 5 검증 체크리스트

```
□ API 응답 확인
  - /api/admin/usage 통계 데이터 정확성
  - 사용량 집계 쿼리 성능 (1초 이내)

□ 권한 검증 테스트
  - 일반 사용자 토큰으로 /api/admin/* 호출 시 401

□ 데이터 정합성
  - llm_usage 테이블 합계와 API 응답 일치
```

---

## 🆕 Phase 6: LLM API 사용량 추적 시스템

**예상 소요 시간**: 3-4일  
**담당**: AI/ML 엔지니어, 시니어 개발자, 백엔드 개발자

### 영향받을 수 있는 기존 기능

| 기능              | 영향 여부    | 확인 방법             |
| ----------------- | ------------ | --------------------- |
| 기존 LLM API 호출 | ⚠️ 필수 수정 | 모든 호출에 래퍼 적용 |
| AI 응답 속도      | ⚠️ 가능      | 로깅 오버헤드 최소화  |

### 6.1 LLM 호출 래퍼 구현

**파일**: `frontend/src/lib/llm/wrapper.ts` [NEW]

- [ ] **6.1.1** LLM API 호출 래퍼 함수

  ```typescript
  interface LLMRequestOptions {
    userId: string;
    requestType: "chat" | "summarize" | "generate" | "edit";
    model: string;
    messages: Message[];
  }

  interface LLMResponse {
    content: string;
    usage: {
      inputTokens: number;
      outputTokens: number;
      totalTokens: number;
    };
    cached: boolean;
  }

  export async function callLLM(
    options: LLMRequestOptions
  ): Promise<LLMResponse> {
    // 1. 사전 할당량 체크
    const canProceed = await checkQuota(options.userId);
    if (!canProceed) {
      throw new QuotaExceededError("월간 토큰 한도를 초과했습니다.");
    }

    // 2. 캐시 체크 (동일 요청 재사용)
    const cacheKey = generateCacheKey(options);
    const cached = await getFromCache(cacheKey);
    if (cached) {
      await logUsage({ ...options, cached: true, tokens: 0 });
      return cached;
    }

    // 3. 실제 LLM API 호출
    const startTime = Date.now();
    const response = await actualLLMCall(options);
    const responseTime = Date.now() - startTime;

    // 4. 사용량 기록
    await logUsage({
      userId: options.userId,
      requestType: options.requestType,
      modelName: options.model,
      inputTokens: response.usage.inputTokens,
      outputTokens: response.usage.outputTokens,
      responseTimeMs: responseTime,
      isCached: false,
    });

    // 5. 캐시 저장
    await saveToCache(cacheKey, response);

    return response;
  }
  ```

  - **AI/ML 엔지니어 제안**: 토큰 카운트는 API 응답에서 직접 가져옴 (정확도)
  - **성능**: 로깅은 비동기로 처리 (응답 지연 방지)

- [ ] **6.1.2** 할당량 체크 함수

  ```typescript
  async function checkQuota(userId: string): Promise<boolean> {
    const { data } = await supabase
      .from("llm_usage_summary")
      .select("total_tokens, tokens_remaining")
      .eq("user_id", userId)
      .eq("period_type", "monthly")
      .eq("period_start", getCurrentMonthStart())
      .single();

    return data?.tokens_remaining > 0;
  }
  ```

- [ ] **6.1.3** 사용량 기록 함수

  ```typescript
  async function logUsage(data: UsageLogData): Promise<void> {
    await supabase.from("llm_usage").insert(data);

    // 집계 테이블 업데이트 (UPSERT)
    await supabase.rpc("update_usage_summary", {
      p_user_id: data.userId,
      p_tokens: data.inputTokens + data.outputTokens,
    });
  }
  ```

- [ ] **6.1.4** QuotaExceededError 커스텀 에러 클래스

### 6.2 사용량 집계 업데이트 RPC

**파일**: `backend/migrations/005_usage_functions.sql` [NEW]

- [ ] **6.2.1** update_usage_summary RPC 함수

  ```sql
  CREATE OR REPLACE FUNCTION update_usage_summary(
      p_user_id UUID,
      p_tokens INTEGER
  )
  RETURNS VOID AS $$
  DECLARE
      v_month_start DATE := date_trunc('month', NOW())::DATE;
      v_user_limit INTEGER;
  BEGIN
      -- 사용자 한도 조회
      SELECT monthly_token_limit INTO v_user_limit
      FROM profiles WHERE id = p_user_id;

      -- UPSERT 집계 레코드
      INSERT INTO llm_usage_summary (
          user_id, period_type, period_start,
          total_tokens, total_requests, tokens_remaining
      )
      VALUES (
          p_user_id, 'monthly', v_month_start,
          p_tokens, 1, v_user_limit - p_tokens
      )
      ON CONFLICT (user_id, period_type, period_start)
      DO UPDATE SET
          total_tokens = llm_usage_summary.total_tokens + p_tokens,
          total_requests = llm_usage_summary.total_requests + 1,
          tokens_remaining = v_user_limit - (llm_usage_summary.total_tokens + p_tokens),
          updated_at = NOW();
  END;
  $$ LANGUAGE plpgsql SECURITY DEFINER;
  ```

  - **데이터 엔지니어 제안**: UPSERT로 원자적 업데이트 보장

- [ ] **6.2.2** 🆕 월초 리셋 함수 (cron job용)
  ```sql
  CREATE OR REPLACE FUNCTION reset_monthly_usage()
  RETURNS VOID AS $$
  BEGIN
      -- 새 달의 요약 레코드 생성
      INSERT INTO llm_usage_summary (
          user_id, period_type, period_start,
          total_tokens, total_requests, tokens_remaining
      )
      SELECT
          id, 'monthly', date_trunc('month', NOW())::DATE,
          0, 0, monthly_token_limit
      FROM profiles
      WHERE role != 'pending';
  END;
  $$ LANGUAGE plpgsql;
  ```

### 6.3 기존 LLM 호출 코드 마이그레이션

**영향 파일 분석 필요**

- [ ] **6.3.1** 기존 LLM 호출 위치 파악
- [ ] **6.3.2** 모든 호출을 callLLM 래퍼로 교체
- [ ] **6.3.3** 에러 핸들링 (QuotaExceededError 처리)

### Phase 6 검증 체크리스트

```
□ 사용량 기록 테스트
  - LLM 호출 후 llm_usage 테이블에 레코드 생성 확인
  - 집계 테이블 정확히 업데이트 확인

□ 할당량 제한 테스트
  - 한도 초과 시 QuotaExceededError 발생 확인
  - 에러 후에도 다른 기능은 정상 동작

□ 성능 테스트
  - 로깅으로 인한 응답 지연 200ms 미만
  - 캐시 히트 시 API 호출 생략 확인

□ 기존 기능 정상 동작 확인
  - 모든 AI 기능 정상 동작
  - 에러 메시지 사용자 친화적
```

---

## 🆕 Phase 7: 사용자 사용량 UI

**예상 소요 시간**: 2-3일  
**담당**: 프론트엔드 개발자, UX/UI 디자인 전문가

### 영향받을 수 있는 기존 기능

| 기능            | 영향 여부 | 확인 방법             |
| --------------- | --------- | --------------------- |
| 에디터 UI       | ⚠️ 추가   | 사용량 표시 영역 추가 |
| 헤더/네비게이션 | ⚠️ 추가   | 사용량 게이지 추가    |

### 7.1 사용량 표시 컴포넌트

**파일**: `frontend/src/components/usage/UsageIndicator.tsx` [NEW]

- [ ] **7.1.1** 헤더용 미니 사용량 표시

  - 게이지 바 + 퍼센트
  - 클릭 시 상세 모달

- [ ] **7.1.2** 상세 사용량 모달

  - 월간 토큰 사용량
  - 요청 횟수
  - 리셋까지 남은 시간
  - 사용 이력 (최근 10건)

- [ ] **7.1.3** 한도 경고 배너
  - 80% 도달: 노란색 "곧 한도에 도달합니다"
  - 90% 도달: 빨간색 "한도에 거의 도달했습니다"
  - 100% 도달: 차단 + 업그레이드 CTA

### 7.2 한도 초과 UX

**파일**: `frontend/src/components/usage/QuotaExceededModal.tsx` [NEW]

- [ ] **7.2.1** 친절한 안내 모달

  - "이번 달 AI 사용량을 모두 사용하셨습니다"
  - 다음 리셋 날짜 표시
  - 업그레이드 옵션 안내

- [ ] **7.2.2** AI 버튼 비활성화 처리
  - 비활성화된 버튼 + 툴팁 "사용량 초과"

### 7.3 에디터에 사용량 표시 통합

**파일**: `frontend/src/app/editor/page.tsx` (수정)

- [ ] **7.3.1** 에디터 헤더에 UsageIndicator 추가
- [ ] **7.3.2** AI 기능 호출 전 할당량 체크 로직 추가
- [ ] **7.3.3** 할당량 초과 시 QuotaExceededModal 표시

### Phase 7 검증 체크리스트

```
□ UI 렌더링 확인
  - 에디터 헤더에 사용량 게이지 표시
  - 경고 배너 색상 정확 (80%: 노랑, 90%: 빨강)

□ UX 테스트
  - 한도 초과 시 모달 표시
  - AI 버튼 비활성화 + 툴팁 표시

□ 접근성 테스트
  - 사용량 정보 스크린 리더 접근 가능
  - 키보드로 모달 닫기 가능
```

---

## 🆕 Phase 8: 비용 최적화 전략 적용

**예상 소요 시간**: 2-3일  
**담당**: AI/ML 엔지니어, 백엔드 개발자, DevOps 엔지니어

### 영향받을 수 있는 기존 기능

| 기능         | 영향 여부    | 확인 방법             |
| ------------ | ------------ | --------------------- |
| AI 응답 품질 | ⚠️ 주의      | 최적화 전후 품질 비교 |
| 응답 속도    | ✅ 개선 예상 | 캐싱으로 빨라짐       |

### 8.1 응답 캐싱 시스템

**파일**: `frontend/src/lib/llm/cache.ts` [NEW]

- [ ] **8.1.1** Redis/Upstash 캐시 연동 (선택적)
      또는 Supabase 테이블 기반 캐시

- [ ] **8.1.2** 캐시 키 생성 전략

  ```typescript
  function generateCacheKey(options: LLMRequestOptions): string {
    // 동일 요청 판별용 해시
    return hash({
      model: options.model,
      messages: options.messages.slice(-3), // 최근 3턴만
      requestType: options.requestType,
    });
  }
  ```

  - **AI/ML 엔지니어**: 전체 대화가 아닌 최근 컨텍스트만 해싱

- [ ] **8.1.3** 캐시 TTL 설정 (24시간 권장)

### 8.2 모델 티어링 전략

**파일**: `frontend/src/lib/llm/model-selector.ts` [NEW]

- [ ] **8.2.1** 요청 유형별 모델 선택

  ```typescript
  const MODEL_TIERS = {
    simple: "gpt-3.5-turbo", // 간단한 요청
    standard: "gpt-4-turbo", // 일반 요청
    complex: "gpt-4", // 복잡한 요청
  };

  function selectModel(requestType: string, complexity: number): string {
    if (complexity < 0.3) return MODEL_TIERS.simple;
    if (complexity < 0.7) return MODEL_TIERS.standard;
    return MODEL_TIERS.complex;
  }
  ```

  - **AI/ML 엔지니어**: 간단한 작업(요약, 맞춤법)은 저렴한 모델 사용

### 8.3 프롬프트 최적화

- [ ] **8.3.1** 시스템 프롬프트 간소화 (토큰 절약)
- [ ] **8.3.2** 불필요한 컨텍스트 제거
- [ ] **8.3.3** 응답 길이 제한 가이드

### 8.4 비용 모니터링 알림

**파일**: `backend/src/jobs/cost_alert.py` [NEW] (또는 Supabase Edge Function)

- [ ] **8.4.1** 일일 비용 집계 및 알림
- [ ] **8.4.2** 예산 초과 예측 알림
- [ ] **8.4.3** 이상 사용량 탐지 (갑작스러운 급증)

### Phase 8 검증 체크리스트

```
□ 캐싱 효과 측정
  - 캐시 히트율 50% 이상 목표
  - 캐시 히트 시 응답 시간 100ms 이내

□ 모델 티어링 효과
  - 저렴한 모델 사용 비율 측정
  - 비용 절감율 계산

□ 품질 유지 확인
  - 최적화 전후 AI 응답 품질 비교
  - 사용자 만족도 저하 없음
```

---

## Phase 9: 통합 테스트 및 최종 검증

**예상 소요 시간**: 2-3일  
**담당**: 시니어 개발자, 주니어 개발자, UX/UI 디자인 전문가, QA

### 9.1 End-to-End 시나리오 테스트

- [ ] **9.1.1** 신규 회원가입 → pending 상태, 할당량 0 확인
- [ ] **9.1.2** 관리자가 회원 승인 → free 상태, 할당량 10,000 확인
- [ ] **9.1.3** free 회원 AI 사용 → 사용량 기록 확인
- [ ] **9.1.4** 🆕 사용량 한도 도달 → 경고 UI → 차단 UX 확인
- [ ] **9.1.5** 🆕 등급 업그레이드 → 할당량 자동 증가 확인
- [ ] **9.1.6** 🆕 월초 리셋 → 사용량 초기화 확인

### 9.2 보안 테스트

- [ ] **9.2.1** 사용량 조작 시도 (클라이언트에서 직접 INSERT)
- [ ] **9.2.2** 다른 사용자 사용량 조회 시도
- [ ] **9.2.3** 할당량 우회 시도

### 9.3 성능 테스트

- [ ] **9.3.1** 🆕 LLM 호출 + 로깅 응답 시간 (추가 지연 200ms 미만)
- [ ] **9.3.2** 🆕 대량 사용량 데이터 쿼리 성능 (10만 건 이상)
- [ ] **9.3.3** 🆕 집계 테이블 업데이트 동시성 테스트

### 9.4 비용 시뮬레이션

- [ ] **9.4.1** 🆕 100명 사용자 시나리오 월간 비용 추정
- [ ] **9.4.2** 🆕 1,000명 사용자 시나리오 월간 비용 추정
- [ ] **9.4.3** 🆕 손익분기점 분석

### Phase 9 최종 검증 체크리스트

```
□ 전체 기능 정상 동작
  - 모든 Phase 기능 통합 동작 확인
  - LLM 사용량 추적 정확성 확인

□ 비용 관리 시스템 동작
  - 할당량 제한 정상 작동
  - 비용 모니터링 대시보드 정확

□ 기존 서비스 영향 없음
  - 기존 사용자 데이터 정상
  - AI 기능 품질 유지

□ 배포 준비
  - 환경 변수 설정 확인
  - 마이그레이션 스크립트 준비
  - 롤백 계획 수립
  - 🆕 비용 알림 임계값 설정

□ 문서화
  - API 문서 작성
  - 관리자 사용 가이드 작성
  - 🆕 비용 관리 가이드 작성
```

---

## 부록: 파일 목록 요약

### 신규 생성 파일

| 파일 경로                                              | Phase | 담당   | 설명                       |
| ------------------------------------------------------ | ----- | ------ | -------------------------- |
| `backend/migrations/003_profiles_schema.sql`           | 1     | 시니어 | profiles, llm_usage 테이블 |
| `backend/migrations/004_profiles_rls.sql`              | 1     | 시니어 | RLS 정책                   |
| `backend/migrations/005_usage_functions.sql`           | 6     | 시니어 | 사용량 집계 RPC            |
| `frontend/src/types/auth.ts`                           | 2     | 주니어 | 타입 정의                  |
| `frontend/src/hooks/useLLMUsage.ts`                    | 2     | 주니어 | 🆕 사용량 훅               |
| `frontend/src/lib/permissions.ts`                      | 2     | 시니어 | 권한 유틸                  |
| `frontend/src/lib/llm/wrapper.ts`                      | 6     | AI/ML  | 🆕 LLM 래퍼                |
| `frontend/src/lib/llm/cache.ts`                        | 8     | AI/ML  | 🆕 캐싱                    |
| `frontend/src/lib/llm/model-selector.ts`               | 8     | AI/ML  | 🆕 모델 선택               |
| `frontend/src/app/usage-limit/page.tsx`                | 3     | 주니어 | 🆕 한도 초과 페이지        |
| `frontend/src/app/admin/usage/page.tsx`                | 4     | UX/UI  | 🆕 사용량 대시보드         |
| `frontend/src/components/usage/UsageIndicator.tsx`     | 7     | UX/UI  | 🆕 사용량 표시             |
| `frontend/src/components/usage/QuotaExceededModal.tsx` | 7     | UX/UI  | 🆕 한도 초과 모달          |
| `frontend/src/components/ui/UsageGauge.tsx`            | 4     | UX/UI  | 🆕 게이지 컴포넌트         |

### 수정 파일

| 파일 경로                          | Phase | 변경 내용                |
| ---------------------------------- | ----- | ------------------------ |
| `frontend/src/hooks/useAuth.ts`    | 2     | profile, tokenLimit 추가 |
| `frontend/src/middleware.ts`       | 3     | RBAC 로직 추가           |
| `frontend/src/app/editor/page.tsx` | 7     | UsageIndicator 추가      |
| 기존 LLM 호출 코드                 | 6     | callLLM 래퍼로 교체      |

---

## 비용 전망 요약

| 사용자 규모 | 월간 예상 비용 (USD) | 비고               |
| ----------- | -------------------- | ------------------ |
| 100명       | $50-100              | free 위주          |
| 500명       | $200-400             | 혼합 등급          |
| 1,000명     | $400-800             | 캐싱 30% 절감 가정 |

> **핵심**: 비용 통제는 **할당량 제한 + 캐싱 + 모델 티어링** 3박자로!

---

**작성 완료**: 2025-12-15  
**업데이트**: LLM 사용량 관리 Phase 추가 (Phase 6, 7, 8)  
**검토자 서명**: ********\_\_\_\_********
