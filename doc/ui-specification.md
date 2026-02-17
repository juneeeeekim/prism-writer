# UI Specification

> PRISM Writer UI 구조, 컴포넌트 계층, 상태 관리, 세션 키 명세
> 최종 갱신: 2026-02-14

---

## 목차

1. [페이지 라우팅 구조](#1-페이지-라우팅-구조)
2. [레이아웃 계층](#2-레이아웃-계층)
3. [에디터 페이지 구조](#3-에디터-페이지-구조)
4. [대시보드 페이지 구조](#4-대시보드-페이지-구조)
5. [Assistant Panel 구조](#5-assistant-panel-구조)
6. [상태 관리 (State Management)](#6-상태-관리)
7. [React Context](#7-react-context)
8. [Custom Hooks](#8-custom-hooks)
9. [세션 & 로컬 스토리지 키](#9-세션--로컬-스토리지-키)
10. [다크 모드](#10-다크-모드)
11. [반응형 브레이크포인트](#11-반응형-브레이크포인트)

---

## 1. 페이지 라우팅 구조

Next.js 14 App Router 기반 파일 시스템 라우팅:

```
src/app/
├── layout.tsx                    # 루트 레이아웃
├── globals.css                   # 글로벌 스타일
├── (auth)/                       # 인증 라우트 그룹
│   ├── login/page.tsx
│   ├── signup/page.tsx
│   ├── reset-password/page.tsx
│   └── update-password/page.tsx
├── (main)/                       # 메인 라우트 그룹 (인증 필요)
│   ├── dashboard/page.tsx
│   ├── editor/page.tsx
│   ├── documents/page.tsx
│   ├── rag/page.tsx
│   ├── profile/page.tsx
│   ├── trash/page.tsx
│   └── admin/
│       ├── page.tsx
│       ├── users/page.tsx
│       ├── templates/page.tsx
│       ├── feedback/page.tsx
│       └── migration/page.tsx
└── api/                          # API Routes
    └── (위 api-specification.md 참조)
```

---

## 2. 레이아웃 계층

파일: `frontend/src/app/layout.tsx`

```
<html>
  <body>
    <ThemeProvider>           ← 다크/라이트 모드
      <ProjectProvider>       ← 프로젝트 컨텍스트
        <AnalyticsProvider>   ← Vercel Analytics
          <ToastContainer>    ← 토스트 알림
            {children}        ← 페이지 콘텐츠
          </ToastContainer>
        </AnalyticsProvider>
      </ProjectProvider>
    </ThemeProvider>
  </body>
</html>
```

### Provider 순서 (바깥 → 안쪽)

1. **ThemeProvider** — `class` 기반 다크모드 (`<html class="dark">`)
2. **ProjectProvider** — 현재 프로젝트 선택 상태
3. **AnalyticsProvider** — Vercel Web Analytics
4. **ToastContainer** — 전역 토스트 알림

---

## 3. 에디터 페이지 구조

파일: `frontend/src/app/(main)/editor/page.tsx`

### Dual Pane 레이아웃 (기본)

```
┌──────────────────────────────────────────────────────┐
│ Header: AuthHeader + ProjectSelector                  │
├────────────────────────┬─────────────────────────────┤
│                        │                             │
│   Editor Pane          │   Assistant Panel            │
│   (MarkdownEditor      │   ├─ ChatTab                │
│    또는                 │   ├─ OutlineTab             │
│    RichShadowWriter)   │   ├─ ReferenceTab           │
│                        │   ├─ StructureTab           │
│                        │   ├─ EvaluationTab          │
│                        │   ├─ SmartSearchTab         │
│                        │   └─ ResearchPanel          │
│                        │                             │
├────────────────────────┴─────────────────────────────┤
│ Footer: SaveStatus, WordCount                         │
└──────────────────────────────────────────────────────┘
```

파일: `frontend/src/components/Editor/DualPane/DualPaneContainer.tsx`

### Three Pane 레이아웃 (선택)

```
┌───────────────────────────────────────────────────────────────┐
│ Header                                                         │
├──────────┬───────────────────────┬────────────────────────────┤
│ Sidebar  │                       │                            │
│ (문서    │  Editor Pane          │  Assistant Panel            │
│  목록)   │  (RichShadowWriter)   │  (위와 동일)               │
│          │                       │                            │
└──────────┴───────────────────────┴────────────────────────────┘
```

파일: `frontend/src/components/Editor/ThreePaneLayout.tsx`

### 에디터 컴포넌트 선택 로직

```typescript
// Feature Flag에 따라 에디터 선택
if (FEATURE_FLAGS.ENABLE_RICH_SHADOW_WRITER) {
  → RichShadowWriter (TipTap 기반 리치 에디터 + AI 제안)
} else {
  → MarkdownEditor (기본 Markdown 에디터)
}
```

---

## 4. 대시보드 페이지 구조

파일: `frontend/src/app/(main)/dashboard/page.tsx`

```
┌──────────────────────────────────────────────────────┐
│ Header: AuthHeader                                    │
├──────────────────────────────────────────────────────┤
│                                                      │
│  ┌────────────────────────────────────────────────┐  │
│  │ 프로젝트 생성 / 검색 / 정렬                      │  │
│  └────────────────────────────────────────────────┘  │
│                                                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐          │
│  │ Project  │  │ Project  │  │ Project  │  ...      │
│  │ Card     │  │ Card     │  │ Card     │          │
│  │ 📁 이름  │  │ 📚 이름  │  │ 📝 이름  │          │
│  │ 문서 N개 │  │ 문서 N개 │  │ 문서 N개 │          │
│  │ 최근수정 │  │ 최근수정 │  │ 최근수정 │          │
│  └──────────┘  └──────────┘  └──────────┘          │
│                                                      │
└──────────────────────────────────────────────────────┘
```

---

## 5. Assistant Panel 구조

파일: `frontend/src/components/Assistant/AssistantPanel.tsx`

### 탭 구조

| 탭 | 컴포넌트 | 설명 |
|----|----------|------|
| Chat | `ChatTab.tsx` | AI 대화 (스트리밍) |
| Outline | `OutlineTab.tsx` | 목차 생성 |
| Reference | `ReferenceTab.tsx` | 참조 자료 관리 |
| Structure | `StructureTab.tsx` | 문서 구조 분석 |
| SmartSearch | `SmartSearchTab.tsx` | 고급 검색 |
| Evaluation | `EvaluationTab.tsx` | 글 평가 |
| Research | `ResearchPanel.tsx` | 외부 연구 검색 |

### ChatTab 하위 구조

```
ChatTab
├── ChatModelSelector     ← 모델 선택 드롭다운
├── ChatSessionList       ← 세션 이력 목록
├── ChatHistoryOnboarding ← 첫 사용 안내
├── MessageList           ← 메시지 렌더링
│   ├── UserMessage
│   └── AssistantMessage
│       ├── FeedbackButtons       ← 좋아요/싫어요
│       └── AdaptiveFeedbackButtons ← 맥락별 피드백
└── InputArea             ← 메시지 입력
```

### EvaluationTab 하위 구조

```
EvaluationTab
├── HolisticFeedbackPanel   ← 종합 평가 (A+B+C)
│   ├── SummarySection      ← A: 종합 피드백
│   ├── AdviceSection       ← B: 영역별 조언
│   └── ScoreSection        ← C: 점수 + 액션 아이템
├── FeedbackPanel           ← 개별 기준 평가
│   ├── JudgeResultCard     ← 판정 결과 카드
│   └── UpgradePlanCard     ← 개선 제안
└── StagedPatchPanel        ← 패치 시스템 (v5)
    ├── PatchGroup (core)
    ├── PatchGroup (expression)
    └── PatchGroup (detail)
```

### Reference Studio 구조

```
ReferenceStudioContainer
├── DocumentListPanel     ← 문서 목록
├── ChunkList             ← 청크 뷰
├── ActiveContextPanel    ← 활성 컨텍스트
└── OnboardingGuide       ← 가이드
```

---

## 6. 상태 관리

### Zustand Store: `useEditorState`

파일: `frontend/src/hooks/useEditorState.ts`

```typescript
interface EditorState {
  // ─── 콘텐츠 ──────────────────────────────────────
  content: string              // 에디터 본문
  title: string                // 문서 제목
  outline: OutlineItem[]       // 목차 데이터
  footnotes: string[]          // 각주 목록

  // ─── 상태 ────────────────────────────────────────
  isDirty: boolean             // 미저장 변경 여부
  lastSavedAt: Date | null     // 마지막 저장 시간
  currentParagraphIndex: number // 현재 문단 인덱스

  // ─── 문서 연결 ───────────────────────────────────
  documentId: string | null    // 서버 문서 ID

  // ─── Chat Draft (Phase 8) ────────────────────────
  chatDraft: string | null     // 채팅에서 삽입할 텍스트

  // ─── 액션 ────────────────────────────────────────
  setContent: (content: string) => void
  setTitle: (title: string) => void
  setOutline: (outline: OutlineItem[]) => void
  applyOutline: (outline: OutlineItem[]) => void
  insertText: (text: string) => void
  insertCitation: (citation: CitationData) => void
  markAsSaved: () => void
  reset: () => void
  setDocumentId: (id: string) => void
  loadFromServer: (doc: ServerDocument) => void
  setChatDraft: (draft: string | null) => void
}
```

### Zustand 옵션

```typescript
create<EditorState>()(
  persist(
    (set, get) => ({ /* ... */ }),
    {
      name: 'prism-editor-storage',  // localStorage 키
      partialize: (state) => ({
        content: state.content,
        title: state.title,
        outline: state.outline,
        documentId: state.documentId,
        footnotes: state.footnotes,
      }),
    }
  )
)
```

---

## 7. React Context

### ProjectContext

파일: `frontend/src/contexts/ProjectContext.tsx`

```typescript
interface ProjectContextValue {
  currentProject: Project | null
  projects: Project[]
  isLoading: boolean
  error: string | null
  filter: ProjectFilter
  selectProject: (projectId: string) => void
  createProject: (input: CreateProjectInput) => Promise<Project>
  updateProject: (id: string, input: UpdateProjectInput) => Promise<Project>
  deleteProject: (id: string) => Promise<void>
  refreshProjects: () => Promise<void>
  completeSetup: () => Promise<void>
  setSearch: (search: string) => void
  setSortOption: (sortBy: ProjectSortBy, sortOrder?: 'asc' | 'desc') => void
}
```

**사용**:
```typescript
const { currentProject, selectProject } = useProject()
```

### ThemeContext

파일: `frontend/src/contexts/ThemeContext.tsx`

```typescript
interface ThemeContextValue {
  theme: 'light' | 'dark'
  toggleTheme: () => void
  setTheme: (theme: 'light' | 'dark') => void
}
```

**사용**:
```typescript
const { theme, toggleTheme } = useTheme()
```

**구현 방식**: `<html>` 태그에 `class="dark"` 토글 (Tailwind `darkMode: 'class'`)

---

## 8. Custom Hooks

### useAuth

파일: `frontend/src/hooks/useAuth.ts`

```typescript
interface UseAuthReturn {
  user: User | null
  profile: UserProfile | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string) => Promise<void>
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
  isAdmin: boolean
  isApproved: boolean
}
```

### useChat

파일: `frontend/src/hooks/useChat.ts`

```typescript
interface UseChatReturn {
  messages: ChatMessage[]
  isLoading: boolean
  error: string | null
  sendMessage: (content: string, model?: string) => Promise<void>
  clearMessages: () => void
  stopGeneration: () => void
  // 세션 관리
  sessions: ChatSession[]
  currentSessionId: string | null
  createSession: (title?: string) => Promise<void>
  switchSession: (sessionId: string) => Promise<void>
  deleteSession: (sessionId: string) => Promise<void>
}
```

### useDocuments

파일: `frontend/src/hooks/useDocuments.ts`

```typescript
interface UseDocumentsReturn {
  documents: UserDocumentPreview[]
  loading: boolean
  error: string | null
  fetchList: () => Promise<void>
  saveDocument: (doc: { id?: string; title: string; content: string }) => Promise<SaveDocumentResponse>
  deleteDocument: (id: string) => Promise<{ success: boolean }>
  loadDocument: (id: string) => Promise<UserDocument>
  reorderDocuments: (items: { id: string; sort_order: number }[]) => Promise<void>
  clearError: () => void
}

// 사용: projectId 필수
const docs = useDocuments(projectId)
```

### useAutosave

파일: `frontend/src/hooks/useAutosave.ts`

```typescript
interface UseAutosaveReturn {
  saveStatus: 'idle' | 'saving' | 'saved' | 'error'
  lastSavedAt: Date | null
  saveError: string | null
  saveNow: () => Promise<void>          // 수동 저장 (Ctrl+S)
  hasPendingChanges: boolean
  hasLocalBackup: boolean               // 로컬 백업 존재 여부
  restoreFromBackup: () => boolean      // 백업 복구
  clearBackup: () => void               // 백업 삭제
}
```

**Autosave 동작**:
1. `content` 또는 `title` 변경 감지
2. 2초 debounce 후 서버 저장 (`POST /api/documents/save`)
3. 저장 실패 시 localStorage에 백업
4. `Ctrl+S`로 즉시 저장

### 기타 Hooks

| Hook | 파일 | 용도 |
|------|------|------|
| `useChunks` | `useChunks.ts` | 청크 조회 |
| `useEvaluation` | `useEvaluation.ts` | 평가 실행/결과 관리 |
| `useAssistantSessions` | `useAssistantSessions.ts` | 어시스턴트 세션 이력 |
| `useSearchHistory` | `useSearchHistory.ts` | 검색 이력 |
| `useResearchHistory` | `useResearchHistory.ts` | 연구 이력 |
| `useResearchPersistence` | `useResearchPersistence.ts` | 연구 데이터 영속화 |
| `useLLMUsage` | `useLLMUsage.ts` | LLM 사용량 추적 |
| `useDocumentStatus` | `useDocumentStatus.ts` | 문서 처리 상태 폴링 |
| `useIntersectionObserver` | `useIntersectionObserver.ts` | 스크롤 감지 (무한 스크롤) |
| `useToast` | `useToast.ts` | 토스트 알림 |

---

## 9. 세션 & 로컬 스토리지 키

### localStorage

| 키 | 용도 | 저장 데이터 |
|----|------|-------------|
| `prism-editor-storage` | Zustand 에디터 상태 영속화 | `{ content, title, outline, documentId, footnotes }` |
| `prism_editor_backup` | Autosave 실패 시 백업 | `{ documentId, title, content, timestamp, syncStatus }` |
| `theme` | 다크모드 설정 | `'light'` \| `'dark'` |
| `sb-<project-ref>-auth-token` | Supabase 인증 토큰 | JWT 세션 데이터 |

### sessionStorage

| 키 | 용도 |
|----|------|
| (현재 사용하지 않음) | - |

### Cookie

| 키 | 용도 |
|----|------|
| `sb-<project-ref>-auth-token` | Supabase SSR 인증 (미들웨어에서 사용) |

---

## 10. 다크 모드

### 구현 방식

- **Tailwind `darkMode: 'class'`** 사용
- `<html>` 태그에 `class="dark"` 토글
- `ThemeContext`로 전역 관리
- `localStorage.theme`에 설정 저장

### CSS 패턴

```css
/* 라이트 모드 */
.bg-white { ... }

/* 다크 모드 */
.dark .bg-white → dark:bg-gray-900
```

### ThemeToggle 컴포넌트

파일: `frontend/src/components/layout/ThemeToggle.tsx`

```typescript
// 사용자가 토글 버튼 클릭 시:
// 1. ThemeContext.toggleTheme() 호출
// 2. <html> class 업데이트
// 3. localStorage.theme 저장
```

---

## 11. 반응형 브레이크포인트

Tailwind 기본 브레이크포인트 사용:

| 클래스 | 최소 너비 | 용도 |
|--------|-----------|------|
| `sm` | 640px | 모바일 가로 |
| `md` | 768px | 태블릿 |
| `lg` | 1024px | 데스크탑 |
| `xl` | 1280px | 넓은 화면 |
| `2xl` | 1536px | 초대형 화면 |

### 커스텀 Pane 너비

| 클래스 | 값 | 용도 |
|--------|-----|------|
| `w-pane-sm` | 360px | 좁은 사이드 패널 |
| `w-pane-md` | 480px | 기본 사이드 패널 |
| `w-pane-lg` | 600px | 넓은 사이드 패널 |

### 레이아웃 전환

- `< 768px` (모바일): 단일 패널 (에디터만)
- `>= 768px` (태블릿): Dual Pane
- `>= 1280px` (데스크탑): Dual 또는 Three Pane

---

## 12. 개발 가이드

> 출처: Frontend Architecture Guide v2.0 (2026-01-09)

### 12.1 새로운 탭 추가 방법

Assistant Panel에 새 탭을 추가하는 3단계:

1. **탭 등록** — `AssistantPanel.tsx`의 `tabs` 배열에 객체 추가
2. **컴포넌트 개발** — 독립적인 상태 관리 권장 (다른 탭과 커플링 방지)
3. **Feature Flag 래핑** — `featureFlags.ts`에 플래그 추가 후 조건부 렌더링

### 12.2 데이터 영속성 3단계 전략

데이터 손실 방지를 위한 계층별 저장 전략:

| 계층 | 저장소 | 용도 | 특성 |
|------|--------|------|------|
| 1단계 | Server DB (Supabase) | 본문, 프로젝트 데이터 | `autosave` 훅으로 30초마다 자동 저장 |
| 2단계 | localStorage | 검색어, 채팅 세션 ID | 사용자 편의 데이터 영구 저장 |
| 3단계 | sessionStorage | 검색 결과, 탭 활성 상태 | 새로고침에 살아남지만 탭 종료 시 삭제 |
