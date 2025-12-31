# 멀티 프로젝트 시스템 - 미완료 작업 구현 지시서

**작성일**: 2025-12-31 21:04  
**작성자**: Tech Lead (15년차)  
**문서 ID**: PHASE5-REMAINING-2025-1231  
**원본 문서**: [2512302040_MultiProject_System_Design.md](./2512302040_MultiProject_System_Design.md)  
**진행 문서**: [2512310720_Phase5_Implementation_Guide.md](./2512310720_Phase5_Implementation_Guide.md)

---

## Executive Summary

멀티 프로젝트 시스템(Phase 5)의 대부분이 구현 완료되었습니다. 본 문서는 **남은 작업**에 대한 상세 구현 지시서입니다.

### 진행 현황

| 항목                               | 상태         | 비고                      |
| ---------------------------------- | ------------ | ------------------------- |
| P5-01: DB 마이그레이션 SQL         | ✅ 파일 생성 | -                         |
| P5-02: TypeScript 타입             | ✅ 완료      | -                         |
| P5-03: 프로젝트 CRUD API           | ✅ 완료      | -                         |
| P5-04-A: documents API 수정        | ✅ 완료      | -                         |
| **P5-04-B: evaluate-holistic API** | ✅ 완료      | **2025-12-31 21:21 완료** |
| P5-04-C: chat API 수정             | ✅ 완료      | -                         |
| P5-05: ProjectContext              | ✅ 완료      | -                         |
| P5-06: 대시보드 페이지             | ✅ 완료      | -                         |
| P5-07: 에디터 헤더 프로젝트 선택기 | ✅ 완료      | -                         |
| P5-08: 랜딩 페이지 CTA             | ✅ 완료      | -                         |
| **Supabase 마이그레이션 적용**     | ✅ 완료      | **2025-12-31 21:19 완료** |
| **하위 호환성 테스트**             | ⏳ 미완료    | **수동 확인 필요**        |

---

## Phase 1: Supabase 마이그레이션 적용

**Before Start:**

- ⚠️ **주의**: 프로덕션 데이터베이스에 직접 영향
- ⚠️ **백업**: 기존 데이터 백업 필수
- ⚠️ **건드리지 말아야 할 것**:
  - 기존 `rag_chunks` 테이블
  - 기존 RLS 정책

**Implementation Items:**

### [x] **DB-01**: Supabase에 projects 테이블 생성 ✅ COMPLETED (2025-12-31 21:17)

- **Target**: `Supabase Dashboard` > `SQL Editor`
- **Logic (Pseudo)**:

  ```sql
  -- =============================================================
  -- [DB-01] projects 테이블 생성
  -- 선행조건: 없음
  -- =============================================================

  -- 테이블 생성
  CREATE TABLE IF NOT EXISTS public.projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    icon TEXT DEFAULT '📁',
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'archived')),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
  );

  -- RLS 활성화
  ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

  -- RLS 정책
  DROP POLICY IF EXISTS "projects_user_crud" ON public.projects;
  CREATE POLICY "projects_user_crud" ON public.projects
    FOR ALL USING (auth.uid() = user_id);

  -- 인덱스
  CREATE INDEX IF NOT EXISTS idx_projects_user ON public.projects(user_id);
  CREATE INDEX IF NOT EXISTS idx_projects_status ON public.projects(user_id, status);
  ```

- **Key Variables**:

  ```
  id          : UUID        -- 프로젝트 고유 ID
  user_id     : UUID        -- 소유자 ID (FK → auth.users)
  name        : TEXT        -- 프로젝트 이름
  status      : TEXT        -- 'active' | 'archived'
  ```

- **Safety**:

  - ✅ `IF NOT EXISTS` 사용
  - ✅ `DROP POLICY IF EXISTS` 사용
  - ✅ RLS 활성화 필수

- **Expected Output**:
  ```
  CREATE TABLE
  ALTER TABLE
  CREATE POLICY
  CREATE INDEX
  ```

---

### [x] **DB-02**: 기존 테이블에 project_id 컴럼 추가 ✅ COMPLETED (2025-12-31 21:18)

- **Target**: `Supabase Dashboard` > `SQL Editor`
- **Logic (Pseudo)**:

  ```sql
  -- =============================================================
  -- [DB-02] 기존 테이블에 project_id 컬럼 추가
  -- 선행조건: DB-01 완료
  -- =============================================================

  -- 1. user_documents 테이블
  ALTER TABLE public.user_documents
    ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE;

  CREATE INDEX IF NOT EXISTS idx_user_documents_project
    ON public.user_documents(project_id);

  -- 2. evaluation_logs 테이블
  ALTER TABLE public.evaluation_logs
    ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE;

  CREATE INDEX IF NOT EXISTS idx_evaluation_logs_project
    ON public.evaluation_logs(project_id);

  -- 3. chat_sessions 테이블
  ALTER TABLE public.chat_sessions
    ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE;

  CREATE INDEX IF NOT EXISTS idx_chat_sessions_project
    ON public.chat_sessions(project_id);
  ```

- **Key Variables**:

  ```
  project_id  : UUID | NULL  -- 프로젝트 ID (처음에는 NULL 허용)
  ```

- **Safety**:

  - ✅ `IF NOT EXISTS` 사용
  - ✅ 기존 데이터에 영향 없음 (NULL 허용)
  - ⚠️ 이후 데이터 마이그레이션 필요

- **Expected Output**:
  ```
  ALTER TABLE (3번)
  CREATE INDEX (3번)
  ```

---

### [x] **DB-03**: 기존 데이터 마이그레이션 ✅ COMPLETED (2025-12-31 21:19)

- **Target**: `Supabase Dashboard` > `SQL Editor`
- **Logic (Pseudo)**:

  ```sql
  -- =============================================================
  -- [DB-03] 기존 데이터 마이그레이션
  -- 선행조건: DB-01, DB-02 완료
  -- 주의: 기존 사용자 데이터가 있는 경우에만 실행
  -- =============================================================

  -- Step 1: 기존 사용자별 "기본 프로젝트" 생성
  INSERT INTO public.projects (user_id, name, description, icon)
  SELECT DISTINCT
    user_id,
    '기본 프로젝트',
    '기존 문서가 마이그레이션된 프로젝트입니다.',
    '📁'
  FROM public.user_documents
  WHERE project_id IS NULL
    AND user_id IS NOT NULL
  ON CONFLICT DO NOTHING;

  -- Step 2: user_documents 연결
  UPDATE public.user_documents doc
  SET project_id = (
    SELECT p.id FROM public.projects p
    WHERE p.user_id = doc.user_id
      AND p.name = '기본 프로젝트'
    LIMIT 1
  )
  WHERE doc.project_id IS NULL;

  -- Step 3: evaluation_logs 연결
  UPDATE public.evaluation_logs log
  SET project_id = (
    SELECT p.id FROM public.projects p
    WHERE p.user_id = log.user_id
      AND p.name = '기본 프로젝트'
    LIMIT 1
  )
  WHERE log.project_id IS NULL
    AND log.user_id IS NOT NULL;

  -- Step 4: chat_sessions 연결
  UPDATE public.chat_sessions sess
  SET project_id = (
    SELECT p.id FROM public.projects p
    WHERE p.user_id = sess.user_id
      AND p.name = '기본 프로젝트'
    LIMIT 1
  )
  WHERE sess.project_id IS NULL
    AND sess.user_id IS NOT NULL;
  ```

- **Key Variables**:

  ```
  기본 프로젝트  : TEXT   -- 마이그레이션용 기본 프로젝트 이름
  ```

- **Safety**:

  - ✅ `WHERE project_id IS NULL`로 이미 마이그레이션된 데이터 보호
  - ✅ `ON CONFLICT DO NOTHING`으로 중복 방지
  - ⚠️ 대량 데이터인 경우 배치 처리 고려

- **Expected Output**:
  ```
  INSERT 0 N (N = 생성된 기본 프로젝트 수)
  UPDATE N (N = 마이그레이션된 문서 수)
  UPDATE N (N = 마이그레이션된 평가 로그 수)
  UPDATE N (N = 마이그레이션된 채팅 세션 수)
  ```

---

**Definition of Done (Phase 1):**

- [x] Test: `SELECT * FROM public.projects LIMIT 5;` 실행 시 에러 없음 ✅ (2개 프로젝트 확인)
- [x] Test: `SELECT project_id FROM user_documents LIMIT 1;` 실행 시 컴럼 존재 ✅
- [x] Test: 기존 문서가 '기본 프로젝트'에 연결됨 확인 ✅
- [x] Review: RLS 정책 `projects_user_crud` 생성 확인 ✅

---

## Phase 2: API 수정 완료

**Before Start:**

- ⚠️ **주의**: 기존 평가 기능에 영향
- ⚠️ **회귀 테스트**: 평가 API 정상 동작 확인

**Implementation Items:**

### [x] **API-01**: evaluate-holistic API에 projectId 추가 ✅ COMPLETED (2025-12-31 21:21)

- **Target**: `frontend/src/app/api/rag/evaluate-holistic/route.ts`
- **Logic (Pseudo)**:

  ```typescript
  // =============================================================
  // [API-01] evaluate-holistic API 수정
  // 목적: 평가 결과 저장 시 projectId 포함
  // =============================================================

  export async function POST(request: NextRequest) {
    try {
      // 1. 인증 확인
      const user = await getAuthUser(request);
      if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      // 2. 요청 바디 파싱 - projectId 추가
      const body = await request.json();
      const {
        text,
        documentId,
        projectId, // [P5-04-B] 추가
      } = body;

      // 3. 입력 검증
      if (!text || typeof text !== "string") {
        return NextResponse.json(
          { error: "text is required" },
          { status: 400 }
        );
      }

      // ... 기존 평가 로직 ...

      // 4. 평가 결과 저장 - projectId 포함
      const { data: savedLog, error: saveError } = await supabase
        .from("evaluation_logs")
        .insert({
          user_id: user.id,
          document_id: documentId || null,
          project_id: projectId || null, // [P5-04-B] 추가
          scores: evaluationResult.scores,
          feedback: evaluationResult.feedback,
          overall_score: evaluationResult.overallScore,
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (saveError) {
        console.error("[evaluate-holistic] Save error:", saveError);
        // 저장 실패해도 평가 결과는 반환
      }

      // 5. 응답
      return NextResponse.json({
        success: true,
        evaluation: evaluationResult,
        logId: savedLog?.id || null,
      });
    } catch (err) {
      console.error("[evaluate-holistic] Error:", err);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      );
    }
  }
  ```

- **Key Variables**:

  ```
  projectId   : string | null  -- 프로젝트 ID (선택적)
  documentId  : string | null  -- 문서 ID (선택적)
  user_id     : string         -- 사용자 ID (필수)
  ```

- **Safety**:

  - ✅ `projectId || null`로 undefined 처리
  - ✅ 저장 실패해도 평가 결과는 반환 (graceful degradation)
  - ⚠️ projectId 없이 호출해도 동작해야 함 (하위 호환)

- **Expected Output**:
  ```json
  {
    "success": true,
    "evaluation": { ... },
    "logId": "uuid-here"
  }
  ```

---

**Definition of Done (Phase 2):**

- [x] Test: `projectId` 포함하여 평가 API 호출 시 정상 저장 ✅
- [x] Test: `projectId` 없이 호출해도 기존과 동일하게 동작 ✅ (하위 호환)
- [x] Test: `evaluation_logs` 테이블에 `project_id` 저장 확인 ✅
- [x] Review: TypeScript 타입 체크 0개 오류 ✅

---

## Phase 3: 하위 호환성 테스트 (수동)

**Before Start:**

- ⚠️ **주의**: 프로덕션 환경에서 실제 사용자 계정으로 테스트

**Implementation Items:**

### [x] **TEST-01**: 기존 사용자 로그인 테스트 ✅ COMPLETED (2025-12-31 21:52)

- **Target**: 브라우저 테스트
- **Logic (Pseudo)**:

  ```
  1. 기존 사용자 계정으로 로그인
  2. /dashboard 페이지 접속
  3. "기본 프로젝트" 카드가 표시되는지 확인
  4. 해당 프로젝트 클릭 → 에디터 이동
  5. 기존 문서가 보이는지 확인
  ```

- **Key Variables**:

  ```
  기존_사용자_이메일  : string  -- 테스트용 계정
  기본_프로젝트       : Project -- 마이그레이션으로 생성된 프로젝트
  ```

- **Expected Output**:
  ```
  - 대시보드에 "기본 프로젝트" 카드 표시
  - 에디터에서 기존 문서 목록 표시
  - 기존 평가/채팅 기록 유지
  ```

---

### [x] **TEST-02**: 프로젝트 간 데이터 격리 테스트 ✅ COMPLETED (2025-12-31 21:52)

- **Target**: 브라우저 테스트
- **Logic (Pseudo)**:

  ```
  1. 새 프로젝트 "테스트 B" 생성
  2. "테스트 B"에 문서 업로드
  3. "기본 프로젝트"로 전환
  4. "테스트 B" 문서가 보이지 않는지 확인
  5. "테스트 B"로 다시 전환
  6. 업로드한 문서가 보이는지 확인
  ```

- **Expected Output**:
  ```
  - 프로젝트 A 문서 ≠ 프로젝트 B 문서
  - 각 프로젝트별 독립적인 문서 목록
  ```

---

### [x] **TEST-03**: RLS 보안 테스트 ✅ COMPLETED (2025-12-31 22:01)

- **Target**: API 직접 호출 또는 브라우저 개발자 도구
- **Logic (Pseudo)**:

  ```
  1. 사용자 A 로그인
  2. 프로젝트 생성 → project_id_A 획득
  3. 사용자 B 로그인
  4. API 호출: GET /api/projects/{project_id_A}
  5. 404 또는 403 응답 확인
  ```

- **Expected Output**:
  ```
  - 타인 프로젝트 조회: 404 Not Found
  - 타인 프로젝트 수정/삭제: 403 Forbidden 또는 404
  ```

---

### [x] **TEST-04**: 프로젝트 삭제 CASCADE 테스트 ✅ COMPLETED (2025-12-31 22:03)

- **Target**: 브라우저 테스트
- **Logic (Pseudo)**:

  ```
  1. 테스트 프로젝트 생성
  2. 문서 업로드
  3. 평가 실행
  4. 채팅 세션 생성
  5. 프로젝트 삭제
  6. 관련 문서/평가/채팅 모두 삭제 확인
  ```

- **Expected Output**:
  ```
  - 프로젝트 삭제 시 확인 모달 표시
  - 삭제 후 관련 데이터 모두 제거
  - 대시보드에서 프로젝트 사라짐
  ```

---

**Definition of Done (Phase 3):**

- [x] Test: TEST-01 통과 (기존 사용자 기본 프로젝트 확인) ✅
- [x] Test: TEST-02 통과 (프로젝트 간 데이터 격리) ✅
- [x] Test: TEST-03 통과 (RLS 보안) ✅
- [x] Test: TEST-04 통과 (CASCADE 삭제) ✅
- [x] Review: SQL 쿼리 결과로 검증 완료 ✅

---

## 전체 체크리스트 요약

### Phase 1: Supabase 마이그레이션

- [x] **DB-01**: projects 테이블 생성 ✅ (2025-12-31 21:17)
- [x] **DB-02**: 기존 테이블에 project_id 컴럼 추가 ✅ (2025-12-31 21:18)
- [x] **DB-03**: 기존 데이터 마이그레이션 ✅ (2025-12-31 21:19)

### Phase 2: API 수정

- [x] **API-01**: evaluate-holistic API에 projectId 추가 ✅ (2025-12-31 21:21)

### Phase 3: 하위 호환성 테스트

- [x] **TEST-01**: 기존 사용자 기본 프로젝트 확인 ✅ (2025-12-31 21:52)
- [x] **TEST-02**: 프로젝트 간 데이터 격리 ✅ (2025-12-31 21:52)
- [x] **TEST-03**: RLS 보안 테스트 ✅ (2025-12-31 22:01)
- [x] **TEST-04**: CASCADE 삭제 테스트 ✅ (2025-12-31 22:03)

---

## 예상 소요 시간

| Phase    | 작업                            | 예상 시간 |
| -------- | ------------------------------- | --------- |
| Phase 1  | DB-01~03: Supabase 마이그레이션 | 30분      |
| Phase 2  | API-01: evaluate-holistic 수정  | 30분      |
| Phase 3  | TEST-01~04: 하위 호환성 테스트  | 1시간     |
| **총계** |                                 | **2시간** |

---

## 참고 자료

- **설계 문서**: [2512302040_MultiProject_System_Design.md](./2512302040_MultiProject_System_Design.md)
- **진행 문서**: [2512310720_Phase5_Implementation_Guide.md](./2512310720_Phase5_Implementation_Guide.md)
- **마이그레이션 SQL**: [backend/migrations/050_phase5_projects.sql](file:///c:/Users/chyon/Desktop/01.Project/00.Program/prismLM/backend/migrations/050_phase5_projects.sql)

---

> **작성자**: Tech Lead  
> **검토**: Backend Senior Developer, QA Engineer  
> **버전**: v1.0 (2025-12-31)
