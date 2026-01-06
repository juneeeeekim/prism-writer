# P4: Adaptive Threshold System 구현 체크리스트

> **문서 ID**: 2601062127
> **작성일**: 2026-01-06
> **설계 문서**: [2601062103*Adaptive_Threshold_System*설계.md](./2601062103_Adaptive_Threshold_System_설계.md) > **예상 소요**: 6일

---

## [Phase 1: 데이터베이스 스키마]

**Before Start:**

- ⚠️ **주의**: 기존 `projects` 테이블에 CASCADE 관계 추가됨 → 프로젝트 삭제 시 preferences도 삭제
- ⚠️ **레거시**: `chat_messages`, `evaluation_logs` 테이블은 건드리지 않음 (참조만)

---

### [P4-01-01] project_rag_preferences 테이블 생성 ✅

- **ID**: P4-01-01
- `Target`: `supabase/migrations/076_project_rag_preferences.sql` (신규) ✅
- `Logic (SQL)`:

  ```sql
  CREATE TABLE project_rag_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    groundedness_threshold FLOAT DEFAULT 0.7,
    critique_threshold FLOAT DEFAULT 0.6,
    retrieval_threshold FLOAT DEFAULT 0.5,
    feedback_count INT DEFAULT 0,
    positive_ratio FLOAT DEFAULT 0.5,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, project_id)
  );

  -- 인덱스
  CREATE INDEX idx_project_rag_prefs_user ON project_rag_preferences(user_id);
  CREATE INDEX idx_project_rag_prefs_project ON project_rag_preferences(project_id);
  ```

- `Key Variables`: `user_id`, `project_id`, `groundedness_threshold`
- `Safety`:
  - UNIQUE 제약으로 중복 방지
  - CASCADE로 고아 레코드 방지

---

### [P4-01-02] RLS 정책 설정 ✅

- **ID**: P4-01-02
- `Target`: `supabase/migrations/076_project_rag_preferences.sql` ✅
- `Logic (SQL)`:

  ```sql
  ALTER TABLE project_rag_preferences ENABLE ROW LEVEL SECURITY;

  CREATE POLICY "Users can read own project preferences"
    ON project_rag_preferences FOR SELECT
    USING (auth.uid() = user_id);

  CREATE POLICY "Users can insert own project preferences"
    ON project_rag_preferences FOR INSERT
    WITH CHECK (auth.uid() = user_id);

  CREATE POLICY "Users can update own project preferences"
    ON project_rag_preferences FOR UPDATE
    USING (auth.uid() = user_id);

  CREATE POLICY "Users can delete own project preferences"
    ON project_rag_preferences FOR DELETE
    USING (auth.uid() = user_id);
  ```

- `Safety`: 타 사용자 데이터 접근 완전 차단

---

### [P4-01-03] learning_events 테이블 생성 ✅

- **ID**: P4-01-03
- `Target`: `supabase/migrations/077_learning_events.sql` (신규) ✅
- `Logic (SQL)`:

  ```sql
  CREATE TYPE learning_event_type AS ENUM (
    'chat_helpful',
    'chat_not_helpful',
    'chat_hallucination',
    'eval_override',
    'rubric_adopt',
    'doc_reupload',
    'example_pin'
  );

  CREATE TABLE learning_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    event_type learning_event_type NOT NULL,
    event_data JSONB DEFAULT '{}',
    influence_weight FLOAT NOT NULL,
    applied_adjustment FLOAT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
  );

  CREATE INDEX idx_learning_events_user_project
    ON learning_events(user_id, project_id);
  CREATE INDEX idx_learning_events_created
    ON learning_events(created_at DESC);
  ```

- `Key Variables`: `event_type`, `influence_weight`, `applied_adjustment`

---

### [P4-01-04] 프로젝트 생성 시 기본 preferences 자동 생성 트리거 ✅

- **ID**: P4-01-04
- `Target`: `supabase/migrations/078_project_prefs_trigger.sql` ✅
- `Logic (SQL)`:

  ```sql
  CREATE OR REPLACE FUNCTION create_project_rag_preferences()
  RETURNS TRIGGER AS $$
  BEGIN
    INSERT INTO project_rag_preferences (user_id, project_id)
    VALUES (NEW.user_id, NEW.id)
    ON CONFLICT (user_id, project_id) DO NOTHING;
    RETURN NEW;
  END;
  $$ LANGUAGE plpgsql SECURITY DEFINER;

  CREATE TRIGGER on_project_created
    AFTER INSERT ON projects
    FOR EACH ROW
    EXECUTE FUNCTION create_project_rag_preferences();
  ```

- `Safety`: `ON CONFLICT DO NOTHING`으로 중복 방지

---

## Definition of Done (Phase 1)

- [ ] `npx supabase db push` 성공
- [ ] SQL Editor에서 `SELECT * FROM project_rag_preferences` 실행 확인
- [ ] 프로젝트 생성 시 자동으로 preferences 레코드 생성 확인
- [ ] RLS: 타 사용자 접근 시 empty result 반환 확인

---

## [Phase 2: Backend - Core Service]

**Before Start:**

- ⚠️ **주의**: `selfRAG.ts`의 기존 함수들 수정 시, Feature Flag로 보호
- ⚠️ **영향**: `chat/route.ts`에서 호출하는 부분 확인 필요

---

### [P4-02-01] ProjectRAGPreferencesService 생성 ✅

- **ID**: P4-02-01
- `Target`: `frontend/src/lib/rag/projectPreferences.ts` (신규) ✅
- `Logic (Pseudo)`:

  ```typescript
  export interface ProjectRAGPreferences {
    id: string;
    user_id: string;
    project_id: string;
    groundedness_threshold: number;
    critique_threshold: number;
    retrieval_threshold: number;
    feedback_count: number;
    positive_ratio: number;
  }

  const DEFAULT_PREFS: Omit<
    ProjectRAGPreferences,
    "id" | "user_id" | "project_id"
  > = {
    groundedness_threshold: 0.7,
    critique_threshold: 0.6,
    retrieval_threshold: 0.5,
    feedback_count: 0,
    positive_ratio: 0.5,
  };

  /**
   * 프로젝트별 RAG 임계값 조회
   * @description 없으면 기본값으로 새로 생성 후 반환
   */
  export async function getProjectThreshold(
    supabase: SupabaseClient,
    userId: string,
    projectId: string
  ): Promise<ProjectRAGPreferences> {
    // 1. 조회 시도
    const { data, error } = await supabase
      .from("project_rag_preferences")
      .select("*")
      .eq("user_id", userId)
      .eq("project_id", projectId)
      .single();

    // 2. 있으면 반환
    if (data) return data;

    // 3. 없으면 생성 (PGRST116 = not found)
    if (error?.code === "PGRST116") {
      const { data: newData } = await supabase
        .from("project_rag_preferences")
        .insert({ user_id: userId, project_id: projectId })
        .select()
        .single();
      return (
        newData || {
          ...DEFAULT_PREFS,
          id: "",
          user_id: userId,
          project_id: projectId,
        }
      );
    }

    // 4. 다른 에러면 기본값 반환 (fallback)
    console.error("[ProjectPrefs] Error:", error);
    return { ...DEFAULT_PREFS, id: "", user_id: userId, project_id: projectId };
  }
  ```

- `Key Variables`: `DEFAULT_PREFS`, `PGRST116`
- `Safety`:
  - Try-Catch로 DB 에러 시 기본값 반환
  - `single()` 실패 시 graceful fallback

---

### [P4-02-02] SIGNAL_CONFIG 및 학습률 계산 함수 ✅

- **ID**: P4-02-02
- `Target`: `frontend/src/lib/rag/projectPreferences.ts` ✅
- `Logic (Pseudo)`:

  ```typescript
  export const SIGNAL_CONFIG = {
    eval_override: { weight: 0.8, adjustment: 0.05 },
    rubric_adopt: { weight: 0.5, adjustment: 0.03 },
    doc_reupload: { weight: 0.4, adjustment: 0.02 },
    example_pin: { weight: 0.3, adjustment: 0.02 },
    chat_helpful: { weight: 0.3, adjustment: -0.02 },
    chat_not_helpful: { weight: 0.3, adjustment: 0 },
    chat_hallucination: { weight: 0.5, adjustment: 0.05 },
  } as const;

  export type SignalType = keyof typeof SIGNAL_CONFIG;

  /**
   * 적응형 Learning Rate 계산
   * 신규 사용자: 빠른 학습 (0.2)
   * 기존 사용자: 안정화 (0.05)
   */
  export function getAdaptiveLearningRate(feedbackCount: number): number {
    if (feedbackCount < 10) return 0.2; // 빠른 학습
    if (feedbackCount < 50) return 0.1; // 중간
    return 0.05; // 안정화
  }

  /**
   * 임계값 조정 계산
   */
  export function calculateAdjustment(
    signalType: SignalType,
    feedbackCount: number
  ): number {
    const config = SIGNAL_CONFIG[signalType];
    const learningRate = getAdaptiveLearningRate(feedbackCount);
    return config.adjustment * config.weight * learningRate;
  }
  ```

- `Key Variables`: `SIGNAL_CONFIG`, `SignalType`, `getAdaptiveLearningRate`

---

### [P4-02-03] applyLearningEvent 함수 ✅

- **ID**: P4-02-03
- `Target`: `frontend/src/lib/rag/projectPreferences.ts` ✅
- `Logic (Pseudo)`:

  ```typescript
  /**
   * 학습 이벤트 적용 및 임계값 업데이트
   */
  export async function applyLearningEvent(
    supabase: SupabaseClient,
    userId: string,
    projectId: string,
    signalType: SignalType,
    eventData?: Record<string, any>
  ): Promise<{ success: boolean; newThreshold: number }> {
    // 1. 현재 preferences 조회
    const prefs = await getProjectThreshold(supabase, userId, projectId);

    // 2. 조정값 계산
    const adjustment = calculateAdjustment(signalType, prefs.feedback_count);

    // 3. 새 임계값 계산 (범위 제한: 0.4 ~ 0.95)
    const newThreshold = Math.max(
      0.4,
      Math.min(0.95, prefs.groundedness_threshold + adjustment)
    );

    // 4. DB 업데이트
    const { error: updateError } = await supabase
      .from("project_rag_preferences")
      .update({
        groundedness_threshold: newThreshold,
        feedback_count: prefs.feedback_count + 1,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId)
      .eq("project_id", projectId);

    if (updateError) {
      console.error("[LearningEvent] Update failed:", updateError);
      return { success: false, newThreshold: prefs.groundedness_threshold };
    }

    // 5. 이벤트 로그 저장
    await supabase.from("learning_events").insert({
      user_id: userId,
      project_id: projectId,
      event_type: signalType,
      event_data: eventData || {},
      influence_weight: SIGNAL_CONFIG[signalType].weight,
      applied_adjustment: adjustment,
    });

    return { success: true, newThreshold };
  }
  ```

- `Key Variables`: `adjustment`, `newThreshold`, `0.4 ~ 0.95`
- `Safety`:
  - `Math.max/min`으로 임계값 범위 강제
  - 로그 저장 실패는 무시 (핵심 로직 영향 없음)

---

## Definition of Done (Phase 2)

- [ ] `getProjectThreshold()`: 없는 프로젝트 → 기본값 생성 확인
- [ ] `applyLearningEvent()`: 임계값 0.7 → 0.72 변경 확인
- [ ] `learning_events` 테이블에 로그 저장 확인
- [ ] 범위 테스트: 임계값이 0.4 미만, 0.95 초과 안 됨

---

## [Phase 3: Backend - API 엔드포인트]

**Before Start:**

- ⚠️ **주의**: 인증 필수 (userId 없으면 401)
- ⚠️ **주의**: projectId 필수 (없으면 400)

---

### [P4-03-01] GET /api/rag/preferences ✅

- **ID**: P4-03-01
- `Target`: `frontend/src/app/api/rag/preferences/route.ts` (신규) ✅
- `Logic (Pseudo)`:

  ```typescript
  export async function GET(req: NextRequest) {
    // 1. 인증 확인
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // 2. projectId 파라미터 확인
    const projectId = req.nextUrl.searchParams.get("projectId");
    if (!projectId) {
      return NextResponse.json(
        { error: "projectId required" },
        { status: 400 }
      );
    }

    // 3. preferences 조회
    const prefs = await getProjectThreshold(supabase, user.id, projectId);

    return NextResponse.json({ preferences: prefs });
  }
  ```

- `Key Variables`: `projectId`, `user.id`
- `Safety`: 401/400 에러 핸들링

---

### [P4-03-02] POST /api/rag/feedback ✅

- **ID**: P4-03-02
- `Target`: `frontend/src/app/api/rag/feedback/route.ts` (신규) ✅
- `Logic (Pseudo)`:

  ```typescript
  interface FeedbackRequest {
    projectId: string;
    signalType: SignalType;
    messageId?: string;
    eventData?: Record<string, any>;
  }

  export async function POST(req: NextRequest) {
    // 1. 인증 확인
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // 2. Body 파싱
    const body: FeedbackRequest = await req.json();

    // 3. 필수 필드 검증
    if (!body.projectId || !body.signalType) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // 4. 유효한 signalType 검증
    if (!(body.signalType in SIGNAL_CONFIG)) {
      return NextResponse.json(
        { error: "Invalid signalType" },
        { status: 400 }
      );
    }

    // 5. 학습 이벤트 적용
    const result = await applyLearningEvent(
      supabase,
      user.id,
      body.projectId,
      body.signalType,
      { messageId: body.messageId, ...body.eventData }
    );

    return NextResponse.json({
      success: result.success,
      newThreshold: result.newThreshold,
      message: result.success
        ? "피드백이 반영되었습니다."
        : "저장에 실패했습니다.",
    });
  }
  ```

- `Key Variables`: `signalType`, `projectId`, `messageId`
- `Safety`:
  - Request body 유효성 검사
  - Unknown signalType 거부

---

### [P4-03-03] selfRAG.ts에 개인화 임계값 적용 ✅

- **ID**: P4-03-03
- `Target`: `frontend/src/lib/rag/selfRAG.ts` > 수정 ✅
- `Logic (Pseudo)`:

  ```typescript
  // 기존: 고정 임계값 사용
  // const threshold = FEATURE_FLAGS.SELF_RAG_GROUNDEDNESS_THRESHOLD

  // 수정: 프로젝트별 개인화 임계값 사용
  export async function verifyGroundedness(
    answer: string,
    usedDocuments: SearchResult[],
    options: SelfRAGOptions & {
      supabase?: SupabaseClient;
      userId?: string;
      projectId?: string;
    } = {}
  ): Promise<GroundednessResult> {
    let threshold = FEATURE_FLAGS.SELF_RAG_GROUNDEDNESS_THRESHOLD; // 기본값

    // 개인화 임계값 조회 (옵션 제공 시)
    if (options.supabase && options.userId && options.projectId) {
      const prefs = await getProjectThreshold(
        options.supabase,
        options.userId,
        options.projectId
      );
      threshold = prefs.groundedness_threshold;
      console.log(`[SelfRAG] Using personalized threshold: ${threshold}`);
    }

    // ... 기존 로직 ...
    return {
      isGrounded: result.score >= threshold, // 개인화 임계값 적용
      groundednessScore: result.score,
      // ...
    };
  }
  ```

- `Key Variables`: `threshold`, `prefs.groundedness_threshold`
- `Safety`: options 없으면 기존 Feature Flag 값 사용 (하위 호환)

---

### [P4-03-04] chat/route.ts에서 개인화 임계값 전달 ✅

- **ID**: P4-03-04
- `Target`: `frontend/src/app/api/chat/route.ts` > 수정 ✅
- `Logic (Pseudo)`:

  ```typescript
  // Groundedness Check 부분 수정
  if (
    FEATURE_FLAGS.ENABLE_SELF_RAG &&
    hasRetrievedDocs &&
    uniqueResults.length > 0
  ) {
    if (fullResponse.length > 100) {
      const verification = await verifyGroundedness(
        fullResponse,
        uniqueResults,
        {
          supabase, // 추가
          userId, // 추가
          projectId, // 추가 (이미 파싱됨)
        }
      );
      // ... 기존 로직
    }
  }
  ```

- `Key Variables`: `supabase`, `userId`, `projectId`
- `Safety`: projectId가 없으면 기본 임계값 사용

---

## Definition of Done (Phase 3)

- [ ] `GET /api/rag/preferences?projectId=xxx` → 200 + preferences 반환
- [ ] `POST /api/rag/feedback` → signalType 잘못된 경우 400
- [ ] `POST /api/rag/feedback` → 정상 시 newThreshold 반환
- [ ] Chat API에서 개인화 임계값 로그 출력 확인

---

## [Phase 4: Frontend - 피드백 UI]

**Before Start:**

- ⚠️ **주의**: ChatMessage 컴포넌트 구조 파악 필요
- ⚠️ **레거시**: 기존 메시지 렌더링 로직 건드리지 않음

---

### [P4-04-01] FeedbackButtons 컴포넌트 생성 ✅

- **ID**: P4-04-01
- `Target`: `frontend/src/components/chat/AdaptiveFeedbackButtons.tsx` (신규) ✅
- `Logic (Pseudo)`:

  ```tsx
  interface FeedbackButtonsProps {
    messageId: string;
    projectId: string;
    onFeedbackSubmit?: (type: SignalType) => void;
  }

  export function FeedbackButtons({
    messageId,
    projectId,
    onFeedbackSubmit,
  }: FeedbackButtonsProps) {
    const [submitted, setSubmitted] = useState<SignalType | null>(null);
    const [loading, setLoading] = useState(false);

    const handleFeedback = async (type: SignalType) => {
      if (submitted || loading) return;

      setLoading(true);
      try {
        const res = await fetch("/api/rag/feedback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectId, signalType: type, messageId }),
        });

        if (res.ok) {
          setSubmitted(type);
          onFeedbackSubmit?.(type);
          toast.success("피드백이 반영되었습니다.");
        }
      } catch (e) {
        toast.error("피드백 전송 실패");
      } finally {
        setLoading(false);
      }
    };

    if (submitted) {
      return (
        <div className="text-sm text-muted-foreground">피드백 감사합니다 ✓</div>
      );
    }

    return (
      <div className="flex gap-2 mt-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleFeedback("chat_helpful")}
        >
          👍 도움됨
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleFeedback("chat_not_helpful")}
        >
          👎 아니요
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleFeedback("chat_hallucination")}
        >
          🚨 틀린 정보
        </Button>
      </div>
    );
  }
  ```

- `Key Variables`: `submitted`, `loading`, `SignalType`
- `Safety`:
  - 중복 제출 방지 (`submitted` 상태)
  - 로딩 중 클릭 방지

---

### [P4-04-02] ChatMessage에 FeedbackButtons 통합 ✅

- **ID**: P4-04-02
- `Target`: `frontend/src/components/Assistant/ChatTab.tsx` (수정) ✅
- `Logic (Pseudo)`:

  ```tsx
  // AI 메시지 하단에 피드백 버튼 추가
  {
    message.role === "assistant" && projectId && (
      <FeedbackButtons messageId={message.id} projectId={projectId} />
    );
  }
  ```

- `Safety`: `projectId` 없으면 버튼 미노출

---

## Definition of Done (Phase 4)

- [ ] AI 답변 하단에 👍👎🚨 버튼 표시
- [ ] 버튼 클릭 시 "피드백 감사합니다 ✓" 표시
- [ ] 중복 클릭 불가 확인
- [ ] 토스트 알림 표시 확인

---

## [Phase 5: 평가/루브릭 학습 연동]

**Before Start:**

- ⚠️ **주의**: 기존 evaluation/rubric API 동작에 영향 없어야 함

---

### [P4-05-01] 평가 점수 수정 시 학습 이벤트 발생 ✅

- **ID**: P4-05-01
- `Target`: `frontend/src/app/api/evaluations/route.ts` (수정) ✅
- `Logic (Pseudo)`:

  ```typescript
  // 평가 저장 로직 내부
  // 기존 점수와 새 점수가 다르면 학습 이벤트 발생
  if (existingScore !== newScore) {
    await applyLearningEvent(supabase, userId, projectId, "eval_override", {
      scoreDiff: newScore - existingScore,
      criteriaId: criteriaId,
    });
  }
  ```

- `Key Variables`: `existingScore`, `newScore`, `eval_override`

---

### [P4-05-02] 루브릭 채택 시 학습 이벤트 발생 ✅

- **ID**: P4-05-02
- `Target`: `frontend/src/app/api/admin/templates/[id]/approve/route.ts` (수정) ✅
- `Logic (Pseudo)`:

  ```typescript
  // 템플릿 상태가 'approved'로 변경될 때
  if (newStatus === "approved") {
    await applyLearningEvent(supabase, userId, projectId, "rubric_adopt", {
      templateId: templateId,
      templateName: template.name,
    });
  }
  ```

- `Key Variables`: `rubric_adopt`, `templateId`

---

## Definition of Done (Phase 5)

- [ ] 평가 점수 수정 시 `learning_events` 테이블에 로그 추가
- [ ] 루브릭 승인 시 `learning_events` 테이블에 로그 추가
- [ ] 기존 평가/루브릭 기능 정상 동작 확인 (회귀 테스트)

---

## [Phase 6: 검증 및 마무리]

---

### 공통 검증 항목

- [x] **Build**: `npm run build` 에러 없음 ✅ (2026-01-06)
- [x] **Type Check**: `npx tsc --noEmit` 에러 없음 ✅
- [x] **Console Logs**: 개발 로그 → `logger.debug`로 마이그레이션 ✅
- [x] **JSDoc**: 신규 함수에 `@description`, `@param`, `@returns` 작성 ✅

---

### 통합 테스트 시나리오

| 시나리오              | 예상 결과                             |
| --------------------- | ------------------------------------- |
| 새 프로젝트 생성      | `project_rag_preferences` 자동 생성   |
| A 프로젝트에서 👍 5회 | A의 임계값 하락, B는 변화 없음        |
| 평가 점수 수정 2회    | 임계값 약 +8% 증가                    |
| 루브릭 1개 채택       | 임계값 약 +1.5% 증가                  |
| 프로젝트 삭제         | 관련 preferences, events CASCADE 삭제 |

---

## 파일 변경 요약

| 파일                                                  | 변경 유형 | 설명            |
| ----------------------------------------------------- | --------- | --------------- |
| `supabase/migrations/076_project_rag_preferences.sql` | NEW ✅    | 테이블+RLS 생성 |
| `supabase/migrations/077_learning_events.sql`         | NEW ✅    | 테이블 생성     |
| `supabase/migrations/078_project_prefs_trigger.sql`   | NEW ✅    | 트리거+백필     |
| `frontend/src/lib/rag/projectPreferences.ts`          | NEW       | Core Service    |
| `frontend/src/app/api/rag/preferences/route.ts`       | NEW       | GET API         |
| `frontend/src/app/api/rag/feedback/route.ts`          | NEW       | POST API        |
| `frontend/src/lib/rag/selfRAG.ts`                     | MODIFY    | 개인화 임계값   |
| `frontend/src/app/api/chat/route.ts`                  | MODIFY    | 파라미터 전달   |
| `frontend/src/components/chat/FeedbackButtons.tsx`    | NEW       | UI 컴포넌트     |
| `frontend/src/components/chat/ChatMessage.tsx`        | MODIFY    | 버튼 통합       |

---

**문서 끝**
