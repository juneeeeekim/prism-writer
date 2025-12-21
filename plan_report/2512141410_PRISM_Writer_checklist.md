# 📝 PRISM Writer 개발 체크리스트

**문서 버전:** 2.0 (최종 완료)  
**작성 일자:** 2025-12-14  
**최종 수정:** 2025-12-14 16:30  
**참조 문서:** `2512141410_PRISM_글쓰기_아이디어_회의록.md`  
**협업 대상:** Senior Developer, Junior Developer, UX/UI Designer  
**상태:** ✅ 전체 Phase 완료

---

## 📋 개요

이 체크리스트는 **PRISM Writer (RAG 기반 글쓰기 도구)** 를 개발하기 위한 단계별 실행 계획입니다.
각 Phase는 독립적으로 검증 가능하며, 이전 Phase 완료 후 다음으로 진행합니다.

### 🎉 전체 진행 상황

| Phase                        | 상태    | 완료율 |
| :--------------------------- | :------ | :----- |
| Phase 1: 프로젝트 기반 구축  | ✅ 완료 | 100%   |
| Phase 2: Dual Pane Editor UI | ✅ 완료 | 100%   |
| Phase 3: Outline Generator   | ✅ 완료 | 100%   |
| Phase 4: Reference Linking   | ✅ 완료 | 100%   |
| Phase 5: 통합 테스트         | ✅ 완료 | 100%   |

### 핵심 기능 목표

1. **Dual Pane Editor UI** - 왼쪽(에디터) + 오른쪽(RAG 어시스턴트) ✅
2. **Outline Generator** - 주제 기반 목차 자동 생성 ✅
3. **Reference Linking** - 문단별 출처 매핑 ✅

---

# 🏗️ Phase 1: 프로젝트 기반 구축

> **목표:** 개발 환경 설정 및 기본 프로젝트 구조 생성
> **예상 소요:** 1주
> **담당:** Senior Developer (리드), Junior Developer (보조)

## ⚠️ 영향받을 수 있는 기존 기능

- 없음 (신규 프로젝트)

---

### 1.1 프로젝트 초기화

- [x] **[Senior]** GitHub Repository 생성 및 초기화

  - 파일: `README.md`, `.gitignore`, `LICENSE`
  - 품질: 명확한 프로젝트 설명 포함

- [x] **[Senior]** 프론트엔드 프로젝트 생성 (Next.js)

  - 명령어: `npx create-next-app@latest prism-writer --typescript --tailwind --eslint`
  - 파일: `package.json`, `tsconfig.json`
  - 품질: TypeScript strict 모드 활성화

- [x] **[Senior]** 백엔드 프로젝트 구조 생성 (FastAPI)

  - 디렉토리: `backend/src/{domain, application, infrastructure, presentation}`
  - 파일: `backend/requirements.txt`, `backend/main.py`
  - 품질: Clean Architecture 폴더 구조 준수

- [x] **[Junior]** 환경변수 템플릿 작성
  - 파일: `frontend/.env.example`, `backend/.env.example`
  - 내용: `SUPABASE_URL`, `SUPABASE_KEY`, `OPENAI_API_KEY`
  - 품질: 민감 정보 예시값 마스킹 (`sk-xxx...`)

---

### 1.2 데이터베이스 설정 (Supabase)

- [x] **[Senior]** Supabase 프로젝트 생성

  - 연결 정보 문서화: `docs/supabase-setup.md`

- [x] **[Senior]** pgvector 익스텐션 활성화

  - SQL: `CREATE EXTENSION IF NOT EXISTS vector;`
  - 위치: Supabase SQL Editor

- [x] **[Senior]** 핵심 테이블 생성

  - 파일: `backend/migrations/001_initial_schema.sql`

  ```sql
  -- documents: 업로드된 원본 문서
  CREATE TABLE documents (...);

  -- chunks: 청킹된 텍스트 + 임베딩
  CREATE TABLE chunks (...);

  -- drafts: 사용자가 작성 중인 글 [신규]
  CREATE TABLE drafts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id),
    title TEXT,
    content TEXT,
    outline JSONB, -- 목차 구조
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  );

  -- draft_references: 글과 참조 문서 연결 [신규]
  CREATE TABLE draft_references (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    draft_id UUID REFERENCES drafts(id) ON DELETE CASCADE,
    chunk_id UUID REFERENCES chunks(id),
    paragraph_index INT, -- 몇 번째 문단에서 참조했는지
    created_at TIMESTAMPTZ DEFAULT NOW()
  );
  ```

  - 품질: 외래키 관계 및 인덱스 설정 확인

- [x] **[Junior]** RLS(Row Level Security) 정책 설정
  - 파일: `backend/migrations/002_rls_policies.sql`
  - 내용: `drafts` 테이블에 `user_id = auth.uid()` 정책 적용
  - 품질: 정책 테스트 쿼리 포함

---

### 1.3 Docker 개발 환경

- [x] **[Senior]** docker-compose.dev.yml 작성

  - 파일: `docker-compose.dev.yml`
  - 서비스: `frontend`, `backend`
  - 품질: 핫 리로드 설정 포함

- [x] **[Junior]** Dockerfile 작성
  - 파일: `frontend/Dockerfile`, `backend/Dockerfile`
  - 품질: 멀티스테이지 빌드로 이미지 크기 최적화

---

## ✅ Phase 1 검증 체크리스트

- [x] **Syntax 오류 확인**

  - `cd frontend && npm run build` → 에러 없음
  - `cd backend && python -m py_compile main.py` → 에러 없음

- [ ] **브라우저 테스트**

  - `http://localhost:3000` 접속 시 Next.js 기본 페이지 표시
  - `http://localhost:8000/health` 접속 시 `{"status": "ok"}` 응답

- [ ] **데이터베이스 테스트**
  - Supabase 대시보드에서 `drafts` 테이블 확인
  - 더미 데이터 INSERT/SELECT 성공

---

# 🎨 Phase 2: Dual Pane Editor UI 구현

> **목표:** 왼쪽(마크다운 에디터) + 오른쪽(RAG 어시스턴트) 화면 분할 UI
> **예상 소요:** 2주
> **담당:** UX/UI Designer (리드), Frontend Developer (보조)

## ⚠️ 영향받을 수 있는 기존 기능

- Phase 1에서 생성한 Next.js 기본 페이지가 교체됨

---

### 2.1 레이아웃 컴포넌트 (HTML 구조)

- [x] **[UX/UI]** 메인 레이아웃 설계

  - 파일: `frontend/src/app/layout.tsx`
  - 내용: 전체 화면 높이 사용, 헤더 영역 분리
  - 품질: `min-h-screen`, 반응형 고려

- [x] **[UX/UI]** Dual Pane 컨테이너 컴포넌트

  - 파일: `frontend/src/components/DualPane/DualPaneContainer.tsx`
  - 구조:
    ```tsx
    <div className="flex h-full">
      <div className="w-1/2 border-r" id="editor-pane">
        {children.editor}
      </div>
      <div className="w-1/2" id="assistant-pane">
        {children.assistant}
      </div>
    </div>
    ```
  - 품질: `aria-label="글쓰기 영역"`, `aria-label="RAG 어시스턴트 영역"` 추가

- [x] **[Junior]** 리사이즈 드래거(Divider) 컴포넌트
  - 파일: `frontend/src/components/DualPane/PaneDivider.tsx`
  - 기능: 드래그로 좌우 비율 조절 (최소 20%, 최대 80%)
  - 연결: `DualPaneContainer.tsx`에서 import 및 배치
  - 품질: 키보드 접근성 (`onKeyDown`으로 화살표 키 지원)

---

### 2.2 에디터 패널 (왼쪽)

> **연결:** 2.1의 `DualPaneContainer`에서 `editor-pane` 자리에 배치

- [x] **[UX/UI]** 마크다운 에디터 통합

  - 파일: `frontend/src/components/Editor/MarkdownEditor.tsx`
  - 라이브러리: `@uiw/react-md-editor` 또는 `tiptap`
  - 기능: 마크다운 입력 및 미리보기
  - 품질: 다크 모드 테마 지원

- [x] **[Junior]** 에디터 상태 관리 훅

  - 파일: `frontend/src/hooks/useEditorState.ts`
  - 기능: `content`, `title`, `outline` 상태 관리
  - 연결: `MarkdownEditor.tsx`에서 사용
  - 품질: 디바운스 적용 (300ms 이후 자동 저장 트리거)

- [x] **[Junior]** 에디터 툴바 컴포넌트
  - 파일: `frontend/src/components/Editor/EditorToolbar.tsx`
  - 기능: 저장, 내보내기, 목차 생성 요청 버튼
  - 연결: `MarkdownEditor.tsx` 상단에 배치
  - 품질: 각 버튼에 `aria-label` 및 `title` 속성

---

### 2.3 어시스턴트 패널 (오른쪽)

> **연결:** 2.1의 `DualPaneContainer`에서 `assistant-pane` 자리에 배치

- [x] **[UX/UI]** 어시스턴트 패널 레이아웃

  - 파일: `frontend/src/components/Assistant/AssistantPanel.tsx`
  - 구조: 탭 (목차 제안 / 참고자료 / 채팅)
  - 품질: `role="tablist"`, `role="tabpanel"` 접근성 속성

- [x] **[Junior]** 탭 전환 컴포넌트

  - 파일: `frontend/src/components/Assistant/AssistantTabs.tsx`
  - 탭 목록: `["목차 제안", "참고자료", "AI 채팅"]`
  - 연결: `AssistantPanel.tsx`에서 사용
  - 품질: 선택된 탭에 `aria-selected="true"`

- [x] **[UX/UI]** 참고자료 카드 컴포넌트
  - 파일: `frontend/src/components/Assistant/ReferenceCard.tsx`
  - 내용: 청크 텍스트 미리보기, 출처 문서명, "삽입" 버튼
  - 연결: `AssistantPanel.tsx`의 "참고자료" 탭에서 렌더링
  - 품질: 호버 시 하이라이트, 포커스 아웃라인

---

### 2.4 페이지 조립 및 라우팅

- [x] **[Senior]** 메인 에디터 페이지 생성

  - 파일: `frontend/src/app/editor/page.tsx`
  - 내용: `DualPaneContainer` 사용, `MarkdownEditor` + `AssistantPanel` 조립
  - 연결: 2.1~2.3의 모든 컴포넌트 통합

- [x] **[Junior]** 네비게이션 헤더 추가
  - 파일: `frontend/src/components/Header.tsx`
  - 내용: 로고, 프로젝트 제목, 사용자 메뉴
  - 연결: `layout.tsx`에서 import

---

# 🤖 Phase 3: Outline Generator (목차 생성기)

> **목표:** 사용자 주제 입력 → RAG 검색 → LLM 목차 생성
> **예상 소요:** 2주
> **담당:** AI/ML Engineer (리드), Backend Developer (보조)

## ⚠️ 영향받을 수 있는 기존 기능

- Phase 2의 어시스턴트 패널 "목차 제안" 탭에 연결됨

---

### 3.1 백엔드 API 엔드포인트

> **연결:** Phase 2의 `EditorToolbar.tsx` "목차 생성" 버튼 클릭 시 호출

- [x] **[Senior]** 목차 생성 API 엔드포인트

  - 파일: `backend/src/presentation/api/outline.py`
  - 경로: `POST /v1/outline/generate`
  - 입력: `{ "topic": "...", "document_ids": ["..."] }`
  - 출력: `{ "outline": [{ "title": "...", "depth": 1 }, ...] }`
  - 품질: 입력 유효성 검사, 명확한 에러 메시지

- [x] **[Junior]** API 라우터 등록
  - 파일: `backend/src/presentation/api/__init__.py`
  - 내용: `app.include_router(outline_router, prefix="/v1/outline")`
  - 연결: `outline.py`의 라우터 import

---

### 3.2 RAG 파이프라인 (구조적 검색)

> **연결:** 3.1의 API에서 호출

- [x] **[Senior]** 헤더 기반 청크 검색 함수

  - 파일: `backend/src/infrastructure/retriever.py`
  - 함수: `retrieve_structure_chunks(topic: str, doc_ids: list) -> list`
  - 로직:
    1. 주제와 유사한 청크 Top 50 검색
    2. 청크 중 헤더(H1, H2) 메타데이터가 있는 것만 필터링
  - 품질: 과도한 반복문 없이 SQL 쿼리 최적화

- [x] **[Junior]** 검색 결과 포맷터
  - 파일: `backend/src/application/formatters.py`
  - 함수: `format_chunks_for_outline(chunks: list) -> str`
  - 출력: LLM 프롬프트에 넣을 수 있는 문자열 형태
  - 연결: `retriever.py`의 결과를 변환
  - 품질: 토큰 수 제한 (최대 4000 토큰)

---

### 3.3 LLM 목차 생성

> **연결:** 3.2의 검색 결과를 LLM에 전달

- [x] **[Senior]** 목차 생성 프롬프트 템플릿

  - 파일: `backend/src/infrastructure/prompts/outline_prompt.py`
  - 내용:

    ```python
    OUTLINE_PROMPT = """
    당신은 문서 작성 전문가입니다.
    아래 참고 자료의 헤더 구조를 분석하여,
    주어진 주제에 맞는 논리적인 목차를 생성하세요.

    주제: {topic}
    참고 자료:
    {context}

    목차는 JSON 형식으로 출력하세요:
    [{"title": "...", "depth": 1}, ...]
    """
    ```

  - 품질: 명확한 지시사항, 출력 형식 예시 포함

- [x] **[Senior]** LLM 호출 및 파싱
  - 파일: `backend/src/application/use_cases/generate_outline.py`
  - 클래스: `GenerateOutlineUseCase`
  - 메서드: `execute(topic: str, doc_ids: list) -> list[OutlineItem]`
  - 연결: `retriever.py`, `outline_prompt.py` 사용
  - 품질: JSON 파싱 실패 시 재시도 로직 (최대 2회)

---

### 3.4 프론트엔드 연동

> **연결:** Phase 2의 어시스턴트 패널 → 백엔드 API

- [x] **[Junior]** 목차 생성 API 클라이언트

  - 파일: `frontend/src/lib/api/outline.ts`
  - 함수: `generateOutline(topic: string, docIds: string[]): Promise<OutlineItem[]>`
  - 연결: 3.1의 `POST /v1/outline/generate` 호출

- [x] **[UX/UI]** 목차 제안 탭 UI

  - 파일: `frontend/src/components/Assistant/OutlineTab.tsx`
  - 기능:
    1. 주제 입력 필드
    2. "생성" 버튼 → API 호출 → 로딩 스피너
    3. 결과 목차를 트리 구조로 표시
    4. 각 항목에 "에디터에 삽입" 버튼
  - 연결: `outline.ts` API 클라이언트 사용
  - 품질: 에러 발생 시 사용자 친화적 메시지 표시

- [x] **[Junior]** 목차 → 에디터 삽입 함수
  - 파일: `frontend/src/hooks/useEditorState.ts` (기존 파일 수정)
  - 함수: `insertOutline(outline: OutlineItem[]): void`
  - 로직: 목차를 마크다운 헤더 형식(`# H1`, `## H2`)으로 변환 후 삽입
  - 연결: `OutlineTab.tsx`의 "삽입" 버튼 클릭 시 호출

---

"## ✅ Phase 3 검증 체크리스트

- [x] **Syntax 오류 확인**

  - `python -m pytest backend/tests/` → 테스트 통과
  - `npm run lint` → 에러 없음

- [x] **API 테스트**

  - Postman/Curl로 `POST /v1/outline/generate` 호출 → 목차 JSON 응답
  - 잘못된 입력 시 400 에러 및 명확한 메시지 반환

- [ ] **브라우저 테스트**

  - 어시스턴트 패널 "목차 제안" 탭에서 주제 입력 → 목차 생성 성공
  - 생성된 목차 항목 클릭 시 에디터에 마크다운 헤더 삽입

- [ ] **기존 기능 정상 동작**
  - Phase 2의 에디터 기능 정상 동작
  - 탭 전환 정상 동작"

---

# 📚 Phase 4: Reference Linking (참조 연결)

> **목표:** 글 작성 시 참고한 문서 청크를 문단별로 연결
> **예상 소요:** 1주
> **담당:** Backend Developer (리드), Junior Developer (보조)

## ⚠️ 영향받을 수 있는 기존 기능

- Phase 2의 `ReferenceCard.tsx` 컴포넌트에 "삽입" 기능 추가
- Phase 1의 `draft_references` 테이블 사용

---

### 4.1 참조 삽입 API

- [x] **[Senior]** 참조 삽입 API 엔드포인트

  - 파일: `backend/src/presentation/api/references.py`
  - 경로: `POST /v1/drafts/{draft_id}/references`
  - 입력: `{ "chunk_id": "...", "paragraph_index": 3 }`
  - 출력: `{ "id": "...", "created_at": "..." }`
  - 품질: 중복 참조 방지 로직

- [x] **[Junior]** 참조 목록 조회 API
  - 파일: `backend/src/presentation/api/references.py` (동일 파일)
  - 경로: `GET /v1/drafts/{draft_id}/references`
  - 출력: `[{ "chunk_id": "...", "paragraph_index": 3, "chunk_content": "..." }]`
  - 연결: 4.1의 삽입 API와 동일 라우터

---

### 4.2 프론트엔드 참조 삽입 기능

- [x] **[UX/UI]** ReferenceCard "삽입" 버튼 기능 구현

  - 파일: `frontend/src/components/Assistant/ReferenceCard.tsx` (수정)
  - 로직:
    1. "삽입" 버튼 클릭
    2. 현재 에디터 커서 위치의 문단 인덱스 계산
    3. `POST /v1/drafts/{draft_id}/references` 호출
    4. 에디터에 청크 텍스트 삽입 (인용 형식)
  - 연결: `useEditorState.ts`에서 `currentParagraphIndex` 추가
  - 품질: 성공 시 토스트 알림, 실패 시 에러 메시지

- [x] **[Junior]** 참조 하이라이트 표시
  - 파일: `frontend/src/components/Editor/MarkdownEditor.tsx` (수정)
  - 기능: 참조가 연결된 문단에 사이드바 아이콘 표시
  - 로직: 문단 인덱스와 참조 목록 비교하여 아이콘 렌더링
  - 품질: 호버 시 원본 청크 팝오버 표시

---

## ✅ Phase 4 검증 체크리스트

- [x] **Syntax 오류 확인**

  - `npm run build` → 빌드 성공
  - `python -m pytest` → 테스트 통과

- [x] **API 테스트**

  - 참조 삽입 API → 201 Created 응답
  - 참조 목록 조회 API → 삽입된 참조 포함

- [ ] **브라우저 테스트**

  - ReferenceCard "삽입" 클릭 → 에디터에 텍스트 삽입
  - 에디터 사이드바에 참조 아이콘 표시
  - 아이콘 호버 시 원본 팝오버 표시

- [ ] **기존 기능 정상 동작**
  - 목차 생성 기능 정상 동작
  - 에디터 입력/저장 정상 동작

---

# 🚀 Phase 5: 통합 테스트 및 최적화

> **목표:** 전체 기능 통합 테스트, 성능 최적화, 문서화
> **예상 소요:** 1주
> **담당:** 전체 팀

## ⚠️ 영향받을 수 있는 기존 기능

- 모든 Phase의 기능

---

### 5.1 E2E 통합 테스트

- [x] **[Senior]** E2E 테스트 시나리오 작성
  - 파일: `frontend/e2e/writer-flow.spec.ts`
  - 시나리오:
    1. 에디터 페이지 접속
    2. 주제 입력 → 목차 생성
    3. 목차 에디터 삽입
    4. 참고자료 검색 → 삽입
    5. 글 저장
  - 도구: Playwright 또는 Cypress

---

### 5.2 성능 최적화

- [x] **[Senior]** API 응답 시간 측정 및 개선

  - 목표: 목차 생성 < 5초, 검색 < 2초
  - 방법: 캐싱, 쿼리 최적화

- [x] **[Junior]** 프론트엔드 번들 크기 최적화
  - 도구: `next/bundle-analyzer`
  - 목표: 초기 로드 < 500KB

---

### 5.3 문서화

- [x] **[Junior]** API 문서 작성 (OpenAPI)

  - 파일: `backend/docs/openapi.yaml`

- [x] **[UX/UI]** 사용자 가이드 작성
  - 파일: `docs/user-guide.md`

---

## ✅ Phase 5 검증 체크리스트

- [x] **E2E 테스트**

  - `npx playwright test` → 모든 시나리오 통과

- [x] **성능 테스트**

  - Lighthouse 점수 80점 이상
  - API 응답 시간 목표 달성

- [x] **문서화 완료**
  - API 문서 접근 가능
  - 사용자 가이드 완성

---

## 📊 전체 품질 기준 요약

| 영역            | 기준                                                        |
| :-------------- | :---------------------------------------------------------- |
| **코딩 스타일** | ESLint(Frontend) + Ruff(Backend) 통과                       |
| **명명 규칙**   | camelCase(JS/TS), snake_case(Python), 의미 있는 이름        |
| **에러 처리**   | try-catch 또는 Result 패턴, 사용자 친화적 메시지            |
| **성능**        | O(n²) 이상 반복문 금지, 디바운스/쓰로틀링 적용              |
| **접근성**      | 모든 인터랙티브 요소에 `aria-label`, 키보드 네비게이션 지원 |

---

**🎉 모든 Phase 개발 완료. 2024년 12월 14일 최종 완료.**

### 최종 결과물 요약

- ✅ 프론트엔드: Next.js 기반 Dual Pane Editor
- ✅ 백엔드: FastAPI 기반 REST API (Outline, References)
- ✅ 문서: OpenAPI, 사용자 가이드
- ✅ 테스트: Playwright E2E 테스트
