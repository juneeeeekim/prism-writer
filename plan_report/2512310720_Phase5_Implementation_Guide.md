# 🏗️ Phase 5: 멀티 프로젝트 시스템 - 구현 지시서

> **문서 유형**: Implementation Guide (구현 지시서)  
> **생성일**: 2025-12-31 07:20  
> **Tech Lead**: AI (15년차)  
> **선행 조건**: Phase 4 완료 ✅  
> **예상 소요**: 1~2일  
> **상태**: 📋 구현 대기

---

## 📌 변경 영향도 분석

### 영향받는 기존 기능

| 기능            | 영향도    | 변경 내용                   |
| --------------- | --------- | --------------------------- |
| 문서 업로드     | 🔴 High   | `project_id` 필터 추가      |
| 평가 기능       | 🔴 High   | `project_id` 필터 추가      |
| 채팅 기능       | 🔴 High   | `project_id` 필터 추가      |
| 랜딩 페이지     | 🟡 Medium | 라우팅 변경                 |
| 에디터 레이아웃 | 🟡 Medium | 헤더에 프로젝트 선택기 추가 |

### 건드리지 말아야 할 레거시 코드

```
⚠️ DO NOT MODIFY:
- lib/rag/search.ts (벡터 검색 로직)
- lib/rag/embedding.ts (임베딩 생성)
- lib/rag/chunking.ts (청킹 로직)
- lib/rag/featureFlags.ts (기존 플래그만 유지)
```

---

## 📋 Phase 5.1: DB 마이그레이션

**Before Start:**

- ⚠️ 회귀 테스트: 기존 `user_documents`, `evaluation_logs`, `chat_sessions` 데이터 백업
- ⚠️ 주의: 마이그레이션 실패 시 롤백 SQL 준비

---

### P5-01: `projects` 테이블 생성

- [x] **P5-01-A**: 테이블 생성 SQL ✅ **COMPLETED (2025-12-31 07:25)**

  - `Target`: `supabase/migrations/050_phase5_projects.sql`
  - `Logic (Pseudo)`:

    ```sql
    -- 프로젝트 테이블 생성
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

    -- RLS 정책: 사용자 본인 프로젝트만 CRUD
    CREATE POLICY "projects_user_crud" ON public.projects
      FOR ALL USING (auth.uid() = user_id);

    -- 인덱스
    CREATE INDEX idx_projects_user ON public.projects(user_id);
    CREATE INDEX idx_projects_status ON public.projects(user_id, status);
    ```

  - `Key Variables`:
    - `id`: 프로젝트 고유 ID (UUID)
    - `user_id`: 소유자 ID
    - `status`: 'active' | 'archived'
  - `Safety`:
    - `IF NOT EXISTS` 사용으로 중복 생성 방지
    - `ON DELETE CASCADE`로 사용자 삭제 시 프로젝트 자동 삭제

---

### P5-01-B: 기존 테이블에 `project_id` 컬럼 추가

- [x] **P5-01-B**: `user_documents` 수정 ✅ **COMPLETED**

  - `Target`: `supabase/migrations/050_phase5_projects.sql`
  - `Logic (Pseudo)`:

    ```sql
    -- user_documents에 project_id 추가
    ALTER TABLE public.user_documents
      ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE;

    -- 인덱스 추가
    CREATE INDEX IF NOT EXISTS idx_user_documents_project
      ON public.user_documents(project_id);
    ```

  - `Safety`: `IF NOT EXISTS`로 안전하게 추가

- [x] **P5-01-C**: `evaluation_logs` 수정 ✅ **COMPLETED**

  - `Target`: `supabase/migrations/050_phase5_projects.sql`
  - `Logic (Pseudo)`:

    ```sql
    -- evaluation_logs에 project_id 추가
    ALTER TABLE public.evaluation_logs
      ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE;

    CREATE INDEX IF NOT EXISTS idx_evaluation_logs_project
      ON public.evaluation_logs(project_id);
    ```

- [x] **P5-01-D**: `chat_sessions` 수정 ✅ **COMPLETED**

  - `Target`: `supabase/migrations/050_phase5_projects.sql`
  - `Logic (Pseudo)`:

    ```sql
    -- chat_sessions에 project_id 추가
    ALTER TABLE public.chat_sessions
      ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE;

    CREATE INDEX IF NOT EXISTS idx_chat_sessions_project
      ON public.chat_sessions(project_id);
    ```

---

### P5-01-E: 기존 데이터 마이그레이션

- [x] **P5-01-E**: 기존 사용자 → 기본 프로젝트 생성 ✅ **COMPLETED**

  - `Target`: `supabase/migrations/051_phase5_migrate_data.sql`
  - `Logic (Pseudo)`:

    ```sql
    -- 기존 사용자별 기본 프로젝트 생성
    INSERT INTO public.projects (user_id, name, description, icon)
    SELECT DISTINCT
      user_id,
      '기본 프로젝트',
      '기존 문서가 마이그레이션된 프로젝트입니다.',
      '📁'
    FROM public.user_documents
    WHERE project_id IS NULL
    ON CONFLICT DO NOTHING;

    -- 기존 문서를 기본 프로젝트에 연결
    UPDATE public.user_documents doc
    SET project_id = (
      SELECT p.id FROM public.projects p
      WHERE p.user_id = doc.user_id
      AND p.name = '기본 프로젝트'
      LIMIT 1
    )
    WHERE doc.project_id IS NULL;

    -- evaluation_logs, chat_sessions도 동일하게 처리
    UPDATE public.evaluation_logs log
    SET project_id = (
      SELECT p.id FROM public.projects p
      WHERE p.user_id = log.user_id
      AND p.name = '기본 프로젝트'
      LIMIT 1
    )
    WHERE log.project_id IS NULL;

    UPDATE public.chat_sessions sess
    SET project_id = (
      SELECT p.id FROM public.projects p
      WHERE p.user_id = sess.user_id
      AND p.name = '기본 프로젝트'
      LIMIT 1
    )
    WHERE sess.project_id IS NULL;
    ```

  - `Safety`:
    - `ON CONFLICT DO NOTHING`으로 중복 방지
    - `WHERE project_id IS NULL`로 이미 마이그레이션된 데이터 보호

---

## 📋 Phase 5.2: TypeScript 타입 정의

**Before Start:**

- ⚠️ 기존 `types/rag.ts` 백업

---

### P5-02: 타입 정의

- [x] **P5-02-A**: `Project` 타입 정의 ✅ **COMPLETED (2025-12-31 07:35)**

  - `Target`: `frontend/src/types/project.ts` [NEW]
  - `Logic (Pseudo)`:

    ```typescript
    // =============================================================================
    // [P5-02-A] Project Types - 멀티 프로젝트 시스템 타입 정의
    // =============================================================================

    export interface Project {
      id: string; // UUID
      user_id: string; // 소유자 ID
      name: string; // 프로젝트 이름
      description: string | null; // 설명
      icon: string; // 이모지 아이콘
      status: "active" | "archived"; // 상태
      created_at: string; // ISO DateTime
      updated_at: string; // ISO DateTime
    }

    export interface CreateProjectInput {
      name: string;
      description?: string;
      icon?: string;
    }

    export interface UpdateProjectInput {
      name?: string;
      description?: string;
      icon?: string;
      status?: "active" | "archived";
    }

    export interface ProjectListResponse {
      projects: Project[];
      total: number;
    }

    export interface ProjectContextValue {
      currentProject: Project | null;
      projects: Project[];
      isLoading: boolean;
      error: string | null;
      selectProject: (projectId: string) => void;
      createProject: (input: CreateProjectInput) => Promise<Project>;
      updateProject: (
        id: string,
        input: UpdateProjectInput
      ) => Promise<Project>;
      deleteProject: (id: string) => Promise<void>;
      refreshProjects: () => Promise<void>;
    }
    ```

  - `Key Variables`:
    - `currentProject`: 현재 선택된 프로젝트
    - `selectProject()`: 프로젝트 전환 함수
  - `Safety`: 모든 nullable 필드에 `| null` 명시

---

## 📋 Phase 5.3: API 개발

**Before Start:**

- ⚠️ 기존 `/api/documents` 등 API 동작 확인

---

### P5-03: 프로젝트 CRUD API

- [ ] **P5-03-A**: GET `/api/projects` (목록 조회)

  - `Target`: `frontend/src/app/api/projects/route.ts` [NEW]
  - `Logic (Pseudo)`:

    ```typescript
    export async function GET(request: NextRequest) {
      // 1. 인증 확인
      const user = await getAuthUser(request);
      if (!user) return unauthorized();

      // 2. 쿼리 파라미터 파싱
      const { searchParams } = new URL(request.url);
      const status = searchParams.get("status") ?? "active";

      // 3. DB 조회
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .eq("user_id", user.id)
        .eq("status", status)
        .order("updated_at", { ascending: false });

      // 4. 에러 처리
      if (error) return serverError(error.message);

      // 5. 응답
      return NextResponse.json({ projects: data, total: data.length });
    }
    ```

  - `Key Variables`:
    - `user`: 인증된 사용자
    - `status`: 필터 ('active' | 'archived')
  - `Safety`:
    - 인증 필수: `if (!user) return unauthorized()`
    - RLS가 추가 보호

- [ ] **P5-03-B**: POST `/api/projects` (생성)

  - `Target`: `frontend/src/app/api/projects/route.ts`
  - `Logic (Pseudo)`:

    ```typescript
    export async function POST(request: NextRequest) {
      // 1. 인증 확인
      const user = await getAuthUser(request);
      if (!user) return unauthorized();

      // 2. 요청 바디 파싱
      const body = await request.json();
      const { name, description, icon } = body as CreateProjectInput;

      // 3. 유효성 검사
      if (!name || name.trim().length === 0) {
        return badRequest("프로젝트 이름은 필수입니다.");
      }
      if (name.length > 100) {
        return badRequest("프로젝트 이름은 100자 이내여야 합니다.");
      }

      // 4. DB 삽입
      const { data, error } = await supabase
        .from("projects")
        .insert({
          user_id: user.id,
          name: name.trim(),
          description: description?.trim() ?? null,
          icon: icon ?? "📁",
        })
        .select()
        .single();

      // 5. 에러 처리
      if (error) return serverError(error.message);

      // 6. 응답
      return NextResponse.json(data, { status: 201 });
    }
    ```

  - `Safety`:
    - Null check: `if (!name)`
    - Trim 처리: `name.trim()`
    - 길이 제한: `name.length > 100`

- [ ] **P5-03-C**: GET `/api/projects/[id]` (상세 조회)

  - `Target`: `frontend/src/app/api/projects/[id]/route.ts` [NEW]
  - `Logic (Pseudo)`:

    ```typescript
    export async function GET(
      request: NextRequest,
      { params }: { params: { id: string } }
    ) {
      const user = await getAuthUser(request);
      if (!user) return unauthorized();

      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .eq("id", params.id)
        .eq("user_id", user.id) // 소유권 확인
        .single();

      if (error || !data) return notFound("프로젝트를 찾을 수 없습니다.");

      return NextResponse.json(data);
    }
    ```

  - `Safety`: `eq('user_id', user.id)`로 소유권 이중 확인

- [ ] **P5-03-D**: PATCH `/api/projects/[id]` (수정)

  - `Target`: `frontend/src/app/api/projects/[id]/route.ts`
  - `Logic (Pseudo)`:

    ```typescript
    export async function PATCH(
      request: NextRequest,
      { params }: { params: { id: string } }
    ) {
      const user = await getAuthUser(request);
      if (!user) return unauthorized();

      const body = await request.json();
      const updates: Partial<Project> = {};

      // 선택적 필드 업데이트
      if (body.name !== undefined) updates.name = body.name.trim();
      if (body.description !== undefined)
        updates.description = body.description;
      if (body.icon !== undefined) updates.icon = body.icon;
      if (body.status !== undefined) updates.status = body.status;

      updates.updated_at = new Date().toISOString();

      const { data, error } = await supabase
        .from("projects")
        .update(updates)
        .eq("id", params.id)
        .eq("user_id", user.id)
        .select()
        .single();

      if (error) return serverError(error.message);
      if (!data) return notFound("프로젝트를 찾을 수 없습니다.");

      return NextResponse.json(data);
    }
    ```

- [ ] **P5-03-E**: DELETE `/api/projects/[id]` (삭제)

  - `Target`: `frontend/src/app/api/projects/[id]/route.ts`
  - `Logic (Pseudo)`:

    ```typescript
    export async function DELETE(
      request: NextRequest,
      { params }: { params: { id: string } }
    ) {
      const user = await getAuthUser(request);
      if (!user) return unauthorized();

      // CASCADE로 연결된 문서, 평가, 채팅도 자동 삭제됨
      const { error } = await supabase
        .from("projects")
        .delete()
        .eq("id", params.id)
        .eq("user_id", user.id);

      if (error) return serverError(error.message);

      return new NextResponse(null, { status: 204 });
    }
    ```

  - `Safety`: CASCADE 삭제 경고 UI 필요

---

### P5-04: 기존 API 수정 (projectId 필터 추가)

- [ ] **P5-04-A**: `/api/documents` 수정

  - `Target`: `frontend/src/app/api/documents/route.ts`
  - `Logic (Pseudo)`:

    ```typescript
    // Before
    .eq('user_id', user.id)

    // After
    const projectId = searchParams.get('projectId')
    let query = supabase
      .from('user_documents')
      .select('*')
      .eq('user_id', user.id)

    if (projectId) {
      query = query.eq('project_id', projectId)
    }
    ```

  - `Key Variables`:
    - `projectId`: 쿼리 파라미터로 전달
  - `Safety`: `projectId`가 없으면 전체 문서 반환 (하위 호환)

- [ ] **P5-04-B**: `/api/rag/evaluate-holistic` 수정

  - `Target`: `frontend/src/app/api/rag/evaluate-holistic/route.ts`
  - `Logic (Pseudo)`:

    ```typescript
    // 요청 바디에서 projectId 추가
    const { text, documentId, projectId } = await request.json();

    // 평가 저장 시 projectId 포함
    await supabase.from("evaluation_logs").insert({
      user_id: user.id,
      project_id: projectId, // 추가
      document_id: documentId,
      ...evaluationResult,
    });
    ```

- [ ] **P5-04-C**: `/api/chat` 수정

  - `Target`: `frontend/src/app/api/chat/route.ts`
  - `Logic (Pseudo)`:

    ```typescript
    // 세션 생성 시 projectId 포함
    const { projectId, ...chatInput } = await request.json();

    if (createNewSession) {
      await supabase.from("chat_sessions").insert({
        user_id: user.id,
        project_id: projectId, // 추가
        ...sessionData,
      });
    }
    ```

---

## 📋 Phase 5.4: UI 개발

**Before Start:**

- ⚠️ 기존 에디터 레이아웃 백업
- ⚠️ 반응형 디자인 고려

---

### P5-05: 프로젝트 Context 생성

- [ ] **P5-05-A**: ProjectContext 생성

  - `Target`: `frontend/src/contexts/ProjectContext.tsx` [NEW]
  - `Logic (Pseudo)`:

    ```typescript
    // =============================================================================
    // [P5-05-A] Project Context - 프로젝트 전역 상태 관리
    // =============================================================================

    export const ProjectContext = createContext<ProjectContextValue | null>(
      null
    );

    export function ProjectProvider({
      children,
    }: {
      children: React.ReactNode;
    }) {
      const [currentProject, setCurrentProject] = useState<Project | null>(
        null
      );
      const [projects, setProjects] = useState<Project[]>([]);
      const [isLoading, setIsLoading] = useState(true);
      const [error, setError] = useState<string | null>(null);

      // 프로젝트 목록 로드
      const refreshProjects = useCallback(async () => {
        try {
          setIsLoading(true);
          const res = await fetch("/api/projects");
          if (!res.ok) throw new Error("프로젝트 로드 실패");
          const { projects } = await res.json();
          setProjects(projects);

          // 현재 프로젝트가 없으면 첫 번째 선택
          if (!currentProject && projects.length > 0) {
            setCurrentProject(projects[0]);
          }
        } catch (e) {
          setError(e instanceof Error ? e.message : "알 수 없는 오류");
        } finally {
          setIsLoading(false);
        }
      }, [currentProject]);

      // 프로젝트 선택
      const selectProject = useCallback(
        (projectId: string) => {
          const project = projects.find((p) => p.id === projectId);
          if (project) {
            setCurrentProject(project);
            localStorage.setItem("lastProjectId", projectId);
          }
        },
        [projects]
      );

      // 초기 로드
      useEffect(() => {
        refreshProjects();
      }, []);

      // 마지막 선택 프로젝트 복원
      useEffect(() => {
        const lastId = localStorage.getItem("lastProjectId");
        if (lastId && projects.length > 0) {
          selectProject(lastId);
        }
      }, [projects]);

      return (
        <ProjectContext.Provider
          value={{
            currentProject,
            projects,
            isLoading,
            error,
            selectProject,
            createProject,
            updateProject,
            deleteProject,
            refreshProjects,
          }}
        >
          {children}
        </ProjectContext.Provider>
      );
    }

    export const useProject = () => {
      const context = useContext(ProjectContext);
      if (!context)
        throw new Error("useProject must be inside ProjectProvider");
      return context;
    };
    ```

  - `Key Variables`:
    - `currentProject`: 현재 선택된 프로젝트
    - `lastProjectId`: localStorage에 저장된 마지막 프로젝트
  - `Safety`:
    - Context null check in `useProject()`
    - try-catch로 API 에러 처리

---

### P5-06: 프로젝트 대시보드 페이지

- [ ] **P5-06-A**: 대시보드 페이지 생성

  - `Target`: `frontend/src/app/dashboard/page.tsx` [NEW]
  - `Logic (Pseudo)`:

    ```tsx
    // =============================================================================
    // [P5-06-A] 프로젝트 대시보드 - 프로젝트 목록 및 생성
    // =============================================================================

    export default function DashboardPage() {
      const { projects, isLoading, createProject } = useProject();
      const [showCreateModal, setShowCreateModal] = useState(false);

      const handleCreateProject = async (input: CreateProjectInput) => {
        const newProject = await createProject(input);
        router.push(`/editor?projectId=${newProject.id}`);
      };

      return (
        <div className="dashboard-container">
          <header className="dashboard-header">
            <h1>내 AI 코치 목록</h1>
          </header>

          <div className="project-grid">
            {projects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                onClick={() => router.push(`/editor?projectId=${project.id}`)}
              />
            ))}

            <CreateProjectCard onClick={() => setShowCreateModal(true)} />
          </div>

          {showCreateModal && (
            <CreateProjectModal
              onClose={() => setShowCreateModal(false)}
              onCreate={handleCreateProject}
            />
          )}
        </div>
      );
    }
    ```

---

### P5-07: 에디터 헤더 수정

- [ ] **P5-07-A**: 프로젝트 선택 드롭다운 추가

  - `Target`: `frontend/src/components/editor/EditorHeader.tsx`
  - `Logic (Pseudo)`:

    ```tsx
    // =============================================================================
    // [P5-07-A] 에디터 헤더 - 프로젝트 선택기 추가
    // =============================================================================

    export function EditorHeader() {
      const { currentProject, projects, selectProject } = useProject();
      const [isDropdownOpen, setIsDropdownOpen] = useState(false);

      return (
        <header className="editor-header">
          <div className="logo">💎 PRISM Writer</div>

          {/* 프로젝트 선택 드롭다운 */}
          <div className="project-selector">
            <button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="project-button"
            >
              <span>{currentProject?.icon ?? "📁"}</span>
              <span>{currentProject?.name ?? "프로젝트 선택"}</span>
              <ChevronDownIcon />
            </button>

            {isDropdownOpen && (
              <div className="project-dropdown">
                {projects.map((project) => (
                  <button
                    key={project.id}
                    onClick={() => {
                      selectProject(project.id);
                      setIsDropdownOpen(false);
                    }}
                    className={
                      project.id === currentProject?.id ? "active" : ""
                    }
                  >
                    {project.icon} {project.name}
                  </button>
                ))}
                <hr />
                <Link href="/dashboard">모든 프로젝트 보기</Link>
              </div>
            )}
          </div>

          {/* 기존 메뉴 */}
          <div className="header-actions">...</div>
        </header>
      );
    }
    ```

  - `Safety`:
    - `currentProject?.icon ?? '📁'` optional chaining
    - 드롭다운 외부 클릭 시 닫기 필요

---

### P5-08: 랜딩 페이지 수정

- [ ] **P5-08-A**: CTA 라우팅 변경

  - `Target`: `frontend/src/app/page.tsx`
  - `Logic (Pseudo)`:

    ```tsx
    // Before
    <Link href="/editor">내 자료로 AI 코치 만들기</Link>

    // After
    <Link href="/dashboard">내 자료로 AI 코치 만들기</Link>
    ```

  - `Safety`: 기존 `/editor` 직접 접근 시 프로젝트 선택 유도 필요

---

## ✅ Definition of Done (검증)

### 자동화 테스트

| 테스트              | 명령어               | 기대 결과     |
| ------------------- | -------------------- | ------------- |
| 빌드 테스트         | `npm run build`      | Exit code: 0  |
| 타입 체크           | `npx tsc --noEmit`   | 에러 없음     |
| 마이그레이션 테스트 | Supabase 로컬 테스트 | SQL 실행 성공 |

### 수동 검증 (브라우저)

| 단계 | 확인 사항                                   |
| ---- | ------------------------------------------- |
| 1    | 랜딩 → CTA 클릭 → 대시보드 이동             |
| 2    | 새 프로젝트 생성 → 에디터 이동              |
| 3    | 프로젝트 A에 문서 업로드                    |
| 4    | 프로젝트 B로 전환 → 문서 목록 비어있음 확인 |
| 5    | 프로젝트 A로 복귀 → 업로드한 문서 확인      |
| 6    | 프로젝트 삭제 → 확인 모달 → 삭제 완료       |

### 보안 검증

| 테스트 | 방법                             | 기대 결과    |
| ------ | -------------------------------- | ------------ |
| RLS    | 타 사용자 프로젝트 ID로 API 호출 | 403 또는 404 |
| 소유권 | 삭제 API 호출 시 타인 프로젝트   | 실패         |

### 하위 호환성

- [ ] 기존 사용자 로그인 시 "기본 프로젝트" 자동 생성 확인
- [ ] 기존 문서가 기본 프로젝트에 연결됨 확인
- [ ] 기존 평가/채팅 기록 유지 확인

---

## 📊 예상 소요 시간

| 작업                       | 시간        | 담당     |
| -------------------------- | ----------- | -------- |
| Phase 5.1: DB 마이그레이션 | 2시간       | Backend  |
| Phase 5.2: 타입 정의       | 30분        | Frontend |
| Phase 5.3: API 개발        | 3시간       | Backend  |
| Phase 5.4: UI 개발         | 4시간       | Frontend |
| 검증 및 테스트             | 2시간       | QA       |
| **총계**                   | **~12시간** |          |

---

## 🚦 리스크 및 대응

| 리스크                 | 대응 방안                                       |
| ---------------------- | ----------------------------------------------- |
| 마이그레이션 실패      | 롤백 SQL 준비, 백업 먼저                        |
| 기존 데이터 손실       | `IF NOT EXISTS`, `ON CONFLICT DO NOTHING`       |
| API 호환성 깨짐        | `projectId` 선택적 파라미터로, 없으면 전체 반환 |
| 세션 프로젝트 미동기화 | localStorage + Context 이중 관리                |

---

> **문서 작성**: Tech Lead (AI, 15년차)  
> **검토 대기**: 디렉터님
