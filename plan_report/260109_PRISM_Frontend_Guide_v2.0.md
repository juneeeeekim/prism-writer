# 📘 PRISM Writer Frontend Architecture Guide v2.0

**문서 번호**: FE-2026-0109-V2
**작성일**: 2026-01-09
**버전**: v2.0
**기술 스택**: Next.js 14, React 18, Zustand, TailwindCSS, React Flow

---

## 🏗️ 아키텍처 개요

PRISM Writer 프론트엔드는 **"Intelligence-First Editor"**를 지향하며, 단순한 텍스트 에디터 위에 AI 보조 레이어(Deep Scholar, Shadow Writer)가 오버레이되는 구조를 가집니다.

### 디렉토리 구조

```
frontend/
├── src/
│   ├── app/                 # Next.js App Router
│   │   ├── editor/          # 메인 에디터 페이지 (useEditorState 공유)
│   │   └── auth/            # 인증 페이지
│   ├── components/
│   │   ├── Editor/          # 에디터 코어 컴포넌트
│   │   │   ├── ShadowWriter.tsx    # [Core] AI 문장 생성기
│   │   │   ├── MarkdownEditor.tsx  # 기본 에디터 (@uiw/react-md-editor)
│   │   │   └── SelectionPopover.tsx # 텍스트 드래그 메뉴
│   │   ├── Assistant/       # 우측 사이드 패널 (AssistantPanel)
│   │   │   ├── ResearchPanel.tsx   # [New] Deep Scholar 패널
│   │   │   ├── ChatPanel.tsx       # [Core] RAG 챗봇
│   │   │   ├── EvaluationTab.tsx   # [Core] 글 평가 및 피드백
│   │   │   ├── ReferenceTab.tsx    # [Core] 업로드 문서 관리
│   │   │   ├── StructureTab.tsx    # [Core] 목차 및 구조 관리
│   │   │   └── AssistantPanel.tsx  # 탭 컨테이너
│   │   └── Structure/       # 구조 설계
│   │       └── OutlineMap.tsx      # [New] React Flow 구조 맵
│   ├── hooks/               # 커스텀 훅
│   │   ├── useEditorState.ts       # 전역 에디터 상태 (Zustand)
│   │   ├── useResearchPersistence.ts # [New] 검색 지속성
│   │   └── useResearchHistory.ts   # [New] 검색 히스토리
│   └── lib/                 # 유틸리티 및 클라이언트
│       ├── research/        # Deep Scholar 로직
│       └── suggest/         # Shadow Writer 로직
```

---

## 🧩 주요 컴포넌트 상세

### 1. Editor Core Components

- **MarkdownEditor**: `@uiw/react-md-editor`를 커스터마이징한 기본 에디터. 실시간 렌더링 지원.
- **Shadow Writer**: 사용자가 글을 쓰는 동안 실시간으로 다음 문장을 제안하는 **In-Context AI Writer** (Ghost Text).
- **SelectionPopover**: 텍스트 드래그 시 '근거 찾기', '요약' 등의 문맥 메뉴를 띄우는 플로팅 UI.

### 2. Assistant Panel (Right Sidebar)

우측 사이드바는 기능별 탭으로 구성되어 있으며, 사용자의 작업 흐름을 보조합니다.

#### 🏛️ Research Tab (Deep Scholar)

외부 지식을 검색하고 검증하여 인용하는 Fact-Checking Module입니다.

- **주요 기능**: 다국어 검색, 신뢰도 뱃지, 프로젝트 격리, 검색 히스토리.

#### 💬 Chat Tab (AI Chat)

업로드된 문서를 기반으로 대화하는 RAG 챗봇입니다.

- **주요 기능**: 문서 기반 답변, 답변 출처 클릭 시 이동, 대화 기록 저장.

#### 📊 Evaluation Tab (평가)

작성된 글을 종합적으로 평가하고 개선점을 제안합니다.

- **주요 기능**: 루브릭 기반 점수(Rubric Score), 항목별 피드백, 개선 예시 제공.

#### 📑 Reference Tab (참고자료)

RAG 검색에 사용될 문서를 업로드하고 관리합니다.

- **주요 기능**: PDF 업로드/파싱, 텍스트 청킹(Chunking) 상태 확인, 인용 관리.

#### 🏗️ Structure Tab (목차/구조)

글의 전체 구조를 설계하고 시각화합니다.

- **주요 기능**:
  - **Structure List**: 트리 형태의 목차 편집.
  - **Dynamic Outline Map**: `reactflow` 기반의 노드 그래프 편집 (Visual Structuring).

---

## 💾 상태 관리 전략 (State Management)

### Global State (Zustand)

`useEditorState.ts`를 통해 에디터의 핵심 데이터(본문, 제목, 각주)를 관리합니다.

```typescript
interface EditorState {
  content: string; // 마크다운 본문
  footnotes: string[]; // 인용 각주 목록
  insertCitation: (citation: Citation) => void; // 인용 삽입 액션
  // ...Chat, Evaluation 관련 상태들
}
```

### Persistence Strategy

데이터 손실 방지를 위한 3단계 저장 전략을 사용합니다.

1.  **Server DB (Supabase)**: `autosave` 훅을 통해 30초마다 자동 저장
2.  **Local History (localStorage)**: 최근 검색어, 채팅 세션 ID 등 사용자 편의 데이터 영구 저장
3.  **Session State (sessionStorage)**: 검색 결과, 탭 활성 상태 등 일시적이지만 새로고침에 살아남아야 하는 데이터

---

## 🛠️ 개발 가이드 (Development)

### Feature Flags

새로운 기능은 `src/config/featureFlags.ts`에서 제어됩니다.

```typescript
export const FEATURE_FLAGS = {
  ENABLE_DEEP_SCHOLAR: true, // Deep Scholar 활성화
  ENABLE_SHADOW_WRITER: true, // Shadow Writer 활성화
  ENABLE_ASSISTANT_SESSIONS: true, // 탭 세션 유지
};
```

### 새로운 탭 추가 방법

1. `AssistantPanel.tsx`의 `tabs` 배열에 객체 추가
2. 컴포넌트 개발 (독립적인 상태 관리 권장)
3. Feature Flag로 래핑하여 안전하게 배포

---

**문서 관리자**: Antigravity (Tech Lead)
**최종 수정**: 2026-01-09
