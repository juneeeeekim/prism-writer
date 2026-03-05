# PRISM Writer - Project Health Audit & Fix Plan

> **문서 ID:** 2603050100
> **작성일:** 2026-03-05
> **작성자:** Claude Opus 4.6 (기술 리더)
> **상태:** 승인 대기
> **분석 범위:** Frontend (Next.js), Config, Supabase Migrations, Dead Code, Architecture
> **빌드 상태:** `next build` 성공, `tsc --noEmit` 0 에러 (잠재 아키텍처 이슈 존재)

---

## 1. 개요

프로젝트 전체 점검(Health Audit)을 수행하여 발견된 이슈들에 대한 수정 계획서입니다.
코드 라인 수, 순환 의존성, 데드 코드, 중복 시스템, 설정 누락, 보안 경로 등 6개 영역을 분석하였습니다.

### 1.1 발견 이슈 요약

| 심각도 | 건수 | 비고 |
|--------|------|------|
| **HIGH** | 3건 | `.env.example` 미비, Auth 보일러플레이트 중복, 데드코드 22개 |
| **MEDIUM** | 4건 | ESLint 미설정, Feature Flags 이중화, Embedding 이중화, `/documents` 미보호 |
| **LOW** | 4건 | 순환 의존성 2개, Migration 디렉토리 오염, `globals.css` 1632줄, 미사용 배럴 export |

### 1.2 영향 범위

| 영역 | 파일 수 |
|------|---------|
| 삭제 대상 (데드코드) | 22개 파일 |
| 수정 대상 (리팩토링) | ~15개 파일 |
| 신규 생성 | 3개 파일 (`lib/llm/utils.ts`, `.eslintrc.json`, `lib/api/withAuth.ts`) |
| `.env.example` 갱신 | 1개 파일 (+47개 변수 추가) |

---

## 2. 수정 단계 계획

수정을 **5단계**로 나누어 진행합니다.
각 단계는 독립적으로 커밋 가능하며, 이전 단계에 의존합니다.

---

### Phase 1: HIGH — 데드코드 제거 (코드 위생)

프로젝트에서 한 번도 import되지 않는 파일 22개를 삭제합니다.
삭제 전 `tsc --noEmit`으로 참조 여부를 최종 검증합니다.

#### Task 1-1. 미사용 라이브러리 파일 삭제 (18개)

- **삭제 대상:**
  ```
  frontend/src/lib/api/errorHandler.ts
  frontend/src/lib/api/outline.ts
  frontend/src/lib/api/references.ts
  frontend/src/lib/logging/evaluationLogger.ts
  frontend/src/lib/monitoring/deploymentMonitor.ts      (581줄)
  frontend/src/lib/monitoring/usageTracker.ts
  frontend/src/lib/permissions.ts
  frontend/src/lib/rag/hallucinationDetector.ts
  frontend/src/lib/rag/patchGates.ts
  frontend/src/lib/rag/patternTagger.ts
  frontend/src/lib/rag/reviewerParser.ts
  frontend/src/lib/rag/reviewerPrompt.ts
  frontend/src/lib/rag/shadowWorkspace.ts
  frontend/src/lib/rag/criteriaPackBuilder.ts
  frontend/src/lib/rag/modelRouter.ts
  frontend/src/lib/storage/patchBackup.ts               (556줄)
  frontend/src/lib/swr.ts
  frontend/src/lib/telemetry.ts
  ```
- **연관 타입 삭제:** `frontend/src/types/telemetry.ts` (telemetry.ts에서만 사용)
- **위험도:** 낮음 — 어디서도 import하지 않는 파일이므로 빌드/런타임 영향 없음
- **검증:** 삭제 후 `tsc --noEmit` + `next build` 성공 확인

#### Task 1-2. 미사용 컴포넌트 파일 삭제 (8개)

- **삭제 대상:**
  ```
  frontend/src/components/Editor/SelectionPopover.tsx
  frontend/src/components/rag/EvidenceCard.tsx
  frontend/src/components/rag/ModeSelector.tsx
  frontend/src/components/rag/StagedPatchPanel.tsx
  frontend/src/components/documents/DocumentCard.tsx     (중복 — 3개 중 미사용 1개)
  frontend/src/components/documents/DocumentList.tsx
  frontend/src/components/chat/FeedbackButtons.tsx       (중복 — 3개 중 미사용 1개)
  frontend/src/components/Editor/FeedbackButtons.tsx     (중복 — 3개 중 미사용 1개)
  ```
- **위험도:** 낮음
- **검증:** 삭제 후 `tsc --noEmit` + `next build` 성공 확인

#### Task 1-3. 미사용 배럴 export 및 Hook 정리

- **파일:** `frontend/src/components/auth/index.ts`
  - `LoginForm`, `SignupForm` export 제거 (실제 로그인/회원가입 페이지는 인라인 폼 사용)
- **파일:** `frontend/src/lib/supabase/index.ts`
  - 배럴 export 파일 자체 삭제 (0개 파일에서 사용, 모두 직접 경로로 import)
- **파일:** `frontend/src/hooks/useAssistantSessions.ts`
  - Hook 파일 삭제 (어떤 컴포넌트에서도 사용하지 않음)
- **위험도:** 낮음
- **검증:** `tsc --noEmit` + `next build` 성공 확인

---

### Phase 2: HIGH — 환경변수 문서화 & ESLint 설정

#### Task 2-1. `.env.example` 전면 갱신 (+47개 변수)

- **파일:** `frontend/.env.example`
- **현재 상태:** 59개 환경변수 중 12개만 문서화
- **수정 내용:** 코드에서 실제 참조되는 모든 환경변수를 카테고리별로 정리
  ```env
  # ========================================
  # PRISM Writer — Environment Variables
  # ========================================

  # --- Core ---
  NEXT_PUBLIC_APP_NAME=PRISM Writer
  NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
  NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
  SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

  # --- LLM API Keys ---
  GOOGLE_API_KEY=your-google-api-key
  OPENAI_API_KEY=your-openai-api-key
  ANTHROPIC_API_KEY=your-anthropic-api-key
  TAVILY_API_KEY=your-tavily-api-key

  # --- LLM Configuration ---
  DEFAULT_MODEL=
  ENABLED_PROVIDERS=

  # --- Cron ---
  CRON_SECRET=your-cron-secret

  # --- Feature Flags (Server) ---
  ENABLE_PIPELINE_V4=false
  ENABLE_PIPELINE_V5=true
  ENABLE_GEMINI_LLM=true
  ENABLE_DUAL_INDEX=false
  ENABLE_SHADOW_WORKSPACE=false
  ENABLE_PATCH_SUGGESTIONS=false
  ENABLE_ASSISTANT_SESSIONS=true
  ENABLE_IMPROVED_PROMPT=true
  ENABLE_QUERY_EXPANSION=false
  ENABLE_HALLUCINATION_DETECTION=false
  ENABLE_RAFT_FEATURES=false
  ENABLE_SOURCE_CITATIONS=false
  ENABLE_SHADOW_MODE=false
  ENABLE_DEBUG_LOGS=false
  FF_PATCH_STAGING=false
  FF_EVIDENCE_QUALITY=false
  USE_TEMPLATE_FOR_CHAT=false
  SKIP_RAFT_AUTH=false

  # --- Feature Flags (Client, NEXT_PUBLIC_) ---
  NEXT_PUBLIC_ENABLE_ANALYTICS=false
  NEXT_PUBLIC_ENABLE_DEBUG_MODE=false
  NEXT_PUBLIC_ENABLE_CHAT_HISTORY=true
  NEXT_PUBLIC_USE_V3_TEMPLATES=false
  NEXT_PUBLIC_ENABLE_CITATION_MARKERS=false
  NEXT_PUBLIC_ENABLE_PATTERN_EXTRACTION=false
  NEXT_PUBLIC_ENABLE_PATTERN_BASED_SEARCH=false
  NEXT_PUBLIC_ENABLE_RUBRIC_CANDIDATE_UI=false
  NEXT_PUBLIC_ENABLE_QUERY_BUILDER=false
  NEXT_PUBLIC_ENABLE_SUFFICIENCY_GATE=false
  NEXT_PUBLIC_ENABLE_CRITERIA_PACK=false
  NEXT_PUBLIC_ENABLE_PIN_UNPIN=false
  NEXT_PUBLIC_ENABLE_WEIGHTED_HYBRID_SEARCH=false
  NEXT_PUBLIC_ENABLE_RERANKING=false
  NEXT_PUBLIC_RERANK_MODEL=
  NEXT_PUBLIC_RERANK_TOP_CANDIDATES=
  NEXT_PUBLIC_ENABLE_AGENTIC_CHUNKING=false
  NEXT_PUBLIC_AGENTIC_CHUNKING_MODEL=
  NEXT_PUBLIC_ENABLE_SELF_RAG=true
  NEXT_PUBLIC_SELF_RAG_MODEL=
  NEXT_PUBLIC_SELF_RAG_RETRIEVAL_THRESHOLD=
  NEXT_PUBLIC_SELF_RAG_CRITIQUE_THRESHOLD=
  NEXT_PUBLIC_LAZY_SELF_RAG_MODE=false
  NEXT_PUBLIC_LAZY_SELF_RAG_MIN_RESPONSE_LENGTH=
  NEXT_PUBLIC_LAZY_SELF_RAG_MIN_QUERY_LENGTH=
  NEXT_PUBLIC_ENABLE_AI_STRUCTURER=true
  NEXT_PUBLIC_ENABLE_SHADOW_WRITER=false
  NEXT_PUBLIC_SHADOW_WRITER_TRIGGER_MODE=
  NEXT_PUBLIC_ENABLE_RICH_SHADOW_WRITER=false
  NEXT_PUBLIC_ENABLE_DEEP_SCHOLAR=false
  NEXT_PUBLIC_ENABLE_PIPELINE_V4=false
  ```
- **삭제:** 코드에서 참조되지 않는 2개 변수 제거
  - `NEXT_PUBLIC_ENABLE_ANALYTICS` (사용처 없음 — 유지하되 주석으로 "미사용" 표기)
  - `NEXT_PUBLIC_ENABLE_DEBUG_MODE` (사용처 없음 — 유지하되 주석으로 "미사용" 표기)
- **위험도:** 낮음 — 문서 갱신만, 런타임 변경 없음
- **검증:** 코드 내 `process.env.*` 참조와 `.env.example` 항목 1:1 매핑 확인

#### Task 2-2. ESLint 설정 파일 생성

- **파일:** `frontend/.eslintrc.json` (신규 생성)
- **수정 내용:**
  ```json
  {
    "extends": "next/core-web-vitals"
  }
  ```
- **위험도:** 낮음 — 린트 규칙 활성화만, 코드 변경 없음
- **검증:** `npx next lint` 실행 가능 확인 (경고/에러 건수 리포트)
- **후속:** 린트 에러가 발견되면 별도 Phase에서 수정

---

### Phase 3: MEDIUM — 중복 시스템 통합 & 보안

#### Task 3-1. Feature Flags 이중화 해소

- **문제:** `config/featureFlags.ts` (주 시스템)과 `lib/rag/featureFlags.ts` (부 시스템)이 공존
  - `ENABLE_PIPELINE_V4` (서버측) vs `NEXT_PUBLIC_ENABLE_PIPELINE_V4` (클라이언트측) — 같은 기능, 다른 환경변수
- **파일:** `frontend/src/lib/rag/featureFlags.ts`
- **수정 방향:**
  1. `lib/rag/featureFlags.ts`의 `PIPELINE_V4_FLAGS` 객체를 `config/featureFlags.ts`로 이동
  2. 참조하는 2개 파일의 import 경로를 `@/config/featureFlags`로 변경
  3. `lib/rag/featureFlags.ts` 삭제
- **위험도:** 중간 — import 경로 변경 시 빌드 깨질 수 있음
- **검증:** `tsc --noEmit` + `next build` 성공

#### Task 3-2. Embedding 모듈 이중화 해소

- **문제:** 2개의 embedding 모듈이 같은 모델(`text-embedding-3-small`)로 동일한 작업 수행
  - `lib/ai/embedding.ts` — LRU 캐시 방식
  - `lib/rag/embedding.ts` — DB 캐시 방식
  - `config/embedding-models.ts` — 중앙 설정이지만 어디서도 import하지 않음
- **수정 방향:**
  1. `config/embedding-models.ts`의 설정을 두 모듈이 공통으로 참조하도록 수정
  2. 모델명, 차원수 등 하드코딩된 값을 `config/embedding-models.ts`에서 import
  3. 두 모듈의 내부 로직(캐싱 전략)은 유지 — 용도가 다르므로 병합하지 않음
- **위험도:** 낮음 — 설정값 참조 경로만 변경
- **검증:** `next build` 성공, 기존 임베딩 기능 동작 확인

#### Task 3-3. `/documents` 라우트 미들웨어 보호 추가

- **문제:** `/documents` 경로가 middleware RBAC에 누락 — 사용자 문서 접근 가능
- **파일:** `frontend/src/middleware.ts`
- **수정 내용:** matcher 패턴에 `/documents/:path*` 추가
  ```typescript
  // 변경 전 (protectedRoutes 배열)
  const protectedRoutes = [
    { path: '/editor', minRole: 'free' },
    { path: '/admin', minRole: 'admin' },
    { path: '/profile', minRole: 'pending' },
    { path: '/dashboard', minRole: 'pending' },
    { path: '/trash', minRole: 'pending' },
  ]

  // 변경 후
  const protectedRoutes = [
    { path: '/editor', minRole: 'free' },
    { path: '/admin', minRole: 'admin' },
    { path: '/profile', minRole: 'pending' },
    { path: '/dashboard', minRole: 'pending' },
    { path: '/trash', minRole: 'pending' },
    { path: '/documents', minRole: 'pending' },  // 추가
  ]
  ```
- **위험도:** 낮음 — 기존 RBAC 패턴과 동일
- **검증:** 미로그인 상태에서 `/documents` 접근 시 로그인 페이지 리다이렉트 확인

#### Task 3-4. API Auth 보일러플레이트 공통화

- **문제:** 35개 API 라우트에서 동일한 인증 코드 반복, 47개에서 동일한 에러 핸들링 반복
- **파일:** `frontend/src/lib/api/withAuth.ts` (신규 생성)
- **수정 내용:**
  ```typescript
  import { createClient } from '@/lib/supabase/server'
  import { NextResponse } from 'next/server'

  type AuthenticatedHandler = (
    request: Request,
    user: { id: string; email: string },
    supabase: ReturnType<typeof createClient>
  ) => Promise<NextResponse>

  export function withAuth(handler: AuthenticatedHandler) {
    return async (request: Request, context?: any) => {
      try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          return NextResponse.json(
            { error: 'Unauthorized' },
            { status: 401 }
          )
        }
        return await handler(request, user, supabase)
      } catch (error) {
        console.error('[API Error]', error)
        return NextResponse.json(
          { error: 'Internal Server Error' },
          { status: 500 }
        )
      }
    }
  }
  ```
- **적용 방식:** 새 API 라우트부터 점진적으로 적용 (기존 35개를 일괄 변경하지 않음)
- **위험도:** 낮음 — 신규 유틸리티 추가만, 기존 코드 즉시 변경 없음
- **검증:** `tsc --noEmit` 성공

---

### Phase 4: LOW — 순환 의존성 해소 & CSS 리팩토링

#### Task 4-1. LLM 순환 의존성 해소 (`client.ts` ↔ `gateway.ts`)

- **문제:** `client.ts`가 `gateway.ts`를 import, `gateway.ts`가 `client.ts`의 `estimateLLMTokenCount`를 re-export
- **파일:** `frontend/src/lib/llm/utils.ts` (신규 생성)
- **수정 방향:**
  1. `estimateLLMTokenCount()` 함수를 `client.ts`에서 `utils.ts`로 이동
  2. `gateway.ts`의 re-export를 `utils.ts`에서 직접 export로 변경
  3. `client.ts`에서 해당 함수 삭제, `utils.ts`를 import하도록 변경
  4. 기존 외부 import 경로(`@/lib/llm/client`)를 사용하는 파일은 `@/lib/llm/utils`로 변경
- **위험도:** 중간 — import 경로 변경 파일이 여러 개일 수 있음
- **검증:** `tsc --noEmit` + `next build` 성공

#### Task 4-2. RAG 순환 의존성 해소 (`search.ts` → `rerank.ts` → `search.ts`)

- **문제:** `rerank.ts`가 `SearchResult` 타입을 배럴 `./search`에서 import하여 순환 발생
- **수정 방향:**
  1. `SearchResult` 타입이 정의된 위치 확인 (search/types.ts 또는 search/index.ts)
  2. `rerank.ts`의 import를 `./search/types` 직접 경로로 변경
- **위험도:** 낮음 — 타입 import 경로만 변경
- **검증:** `tsc --noEmit` 성공

#### Task 4-3. `globals.css` 분할 (1,632줄 → 모듈화)

- **파일:** `frontend/src/app/globals.css`
- **현재 상태:** 1,632줄 — 프로젝트 유일의 1000줄 초과 파일
- **수정 방향:**
  1. CSS를 역할별로 분리:
     - `globals.css` — Tailwind directives + CSS 변수 (다크모드 포함)
     - `editor.css` — TipTap/에디터 전용 스타일
     - `markdown.css` — 마크다운 렌더링 스타일
     - `components.css` — 커스텀 컴포넌트 스타일 (스크롤바, 애니메이션 등)
  2. `globals.css`에서 `@import`로 분리된 파일 로드
  3. 분할 후 각 파일이 400줄 이하가 되도록 조정
- **위험도:** 중간 — CSS 로드 순서에 따라 스타일 깨질 수 있음
- **검증:** 전체 페이지 시각적 검증 (로그인, 에디터, 대시보드, 어드민)

---

### Phase 5: LOW — Migration 디렉토리 정리 & 미사용 설정 제거

#### Task 5-1. Migration 디렉토리 진단 파일 분리

- **문제:** `supabase/migrations/`에 진단용 SQL 5개가 마이그레이션과 혼재
- **수정 내용:**
  ```
  # 이동 (삭제하지 않고 별도 디렉토리로)
  supabase/migrations/check_chunks.sql          → supabase/scripts/check_chunks.sql
  supabase/migrations/check_chunks_real.sql      → supabase/scripts/check_chunks_real.sql
  supabase/migrations/check_raft_schema.sql      → supabase/scripts/check_raft_schema.sql
  supabase/migrations/check_user_docs_schema.sql → supabase/scripts/check_user_docs_schema.sql
  supabase/migrations/verify_schema.sql          → supabase/scripts/verify_schema.sql
  ```
- **위험도:** 낮음 — 진단용 스크립트이므로 마이그레이션 실행에 영향 없음
- **검증:** `supabase db push` 정상 동작 확인 (또는 dry-run)

#### Task 5-2. 미사용 `config/embedding-models.ts` 활성화 또는 삭제

- **현재 상태:** 중앙 임베딩 설정 파일이지만 0개 파일에서 import
- **수정 방향:** Phase 3 Task 3-2에서 활성화하므로, 해당 Phase에서 자동 해결됨
- **위험도:** 없음

#### Task 5-3. 미사용 auth 컴포넌트 배럴 정리

- **현재 상태:** `components/auth/LoginForm.tsx`, `SignupForm.tsx`가 존재하지만 실제 페이지는 인라인 폼 사용
- **수정 방향:** 배럴 export(`components/auth/index.ts`)에서 제거, 파일 자체는 Phase 1에서 판단
- **위험도:** 낮음

---

## 3. 수정하지 않는 항목 (의도적 보류)

| 항목 | 사유 |
|------|------|
| 500~999줄 컴포넌트 분할 | 현재 기능적으로 정상 동작. 기능 추가 시 점진적 리팩토링 |
| 기존 35개 API 라우트 일괄 `withAuth()` 적용 | 리스크 높음. 새 라우트부터 점진 적용 |
| `backend/` FastAPI 코드 정리 | 프로덕션 미사용. 별도 태스크로 관리 |
| MODEL_REGISTRY 미사용 모델 제거 | UI에서 사용자 수동 선택 가능. 제거 시 기능 제한 |
| Supabase migration 번호 갭 (041-049) | 의도적 번호 예약. 기능상 문제 없음 |

---

## 4. 실행 순서 및 예상 커밋

| 순서 | Phase | Task | 커밋 메시지 | 영향 범위 |
|------|-------|------|------------|-----------|
| 1 | 1-1 | 미사용 lib 삭제 | `chore: 미사용 라이브러리 파일 18개 삭제 (dead code 정리)` | Frontend |
| 2 | 1-2 | 미사용 컴포넌트 삭제 | `chore: 미사용 컴포넌트 8개 삭제 (dead code 정리)` | Frontend |
| 3 | 1-3 | 배럴/Hook 정리 | `chore: 미사용 배럴 export 및 Hook 정리` | Frontend |
| 4 | 2-1 | .env.example 갱신 | `docs: .env.example 환경변수 전체 문서화 (+47개)` | Config |
| 5 | 2-2 | ESLint 설정 | `chore: ESLint 설정 파일 생성 (next/core-web-vitals)` | Config |
| 6 | 3-1 | Feature Flags 통합 | `refactor: Feature Flags 이중화 해소 (rag/featureFlags → config)` | Frontend |
| 7 | 3-2 | Embedding 설정 통합 | `refactor: Embedding 모듈 설정 중앙화 (config/embedding-models 활성화)` | Frontend |
| 8 | 3-3 | /documents 보호 | `fix: /documents 라우트 middleware RBAC 보호 추가` | Frontend |
| 9 | 3-4 | withAuth 유틸리티 | `feat: API 공통 인증 래퍼 withAuth() 추가` | Frontend |
| 10 | 4-1 | LLM 순환 의존성 | `refactor: LLM 순환 의존성 해소 (utils.ts 분리)` | Frontend |
| 11 | 4-2 | RAG 순환 의존성 | `refactor: RAG 순환 의존성 해소 (rerank import 경로 수정)` | Frontend |
| 12 | 4-3 | globals.css 분할 | `refactor: globals.css 모듈 분할 (1632줄 → 4개 파일)` | Frontend |
| 13 | 5-1 | Migration 정리 | `chore: migration 디렉토리 진단 SQL 분리 (scripts/)` | Supabase |

---

## 5. 검증 체크리스트

### Phase별 검증

- [ ] **Phase 1 완료 후:**
  - [ ] `tsc --noEmit` — 0 에러
  - [ ] `next build` — 성공
  - [ ] 삭제된 22개 파일이 다른 코드에서 참조되지 않음 확인

- [ ] **Phase 2 완료 후:**
  - [ ] `.env.example`의 변수 수와 코드 내 `process.env.*` 참조 수 일치
  - [ ] `npx next lint` 실행 가능 (설정 에러 없음)

- [ ] **Phase 3 완료 후:**
  - [ ] Feature Flag 동작: `ENABLE_PIPELINE_V4` 단일 소스 확인
  - [ ] Embedding 생성: 기존과 동일 모델/차원 사용 확인
  - [ ] `/documents` 미로그인 접근 → 로그인 리다이렉트 확인
  - [ ] `withAuth()` 타입 체크 통과

- [ ] **Phase 4 완료 후:**
  - [ ] 순환 의존성 0개 (madge --circular 검증)
  - [ ] 전체 페이지 시각적 검증 (CSS 분할 후)

- [ ] **Phase 5 완료 후:**
  - [ ] `supabase/migrations/`에 `check_*.sql`, `verify_*.sql` 없음 확인

### 최종 통합 검증

- [ ] `tsc --noEmit` — 0 에러
- [ ] `next build` — 성공
- [ ] `npm run dev` — 개발 서버 정상 실행
- [ ] 에디터 페이지 로드 → 글 작성 → 저장 플로우 정상
- [ ] LLM 호출 정상 (Gemini, OpenAI, Anthropic)
- [ ] `git diff --stat` — 의도하지 않은 변경 없음

---

## 6. 롤백 계획

각 Phase는 독립 커밋이므로, 문제 발생 시 `git revert <commit>` 으로 개별 롤백 가능.

**고위험 변경:**
- **Phase 4-3 (CSS 분할):** 시각적 깨짐 발생 시 즉시 롤백. `globals.css` 원본 보존
- **Phase 3-1 (Feature Flags 통합):** 환경변수명 변경으로 프로덕션 영향 가능. 배포 전 Vercel 환경변수 업데이트 필수

**안전 장치:**
- 모든 Phase 시작 전 `git stash` 또는 브랜치 분기
- 각 커밋마다 `next build` 성공 확인 후 다음 Phase 진행

---

## 7. 참고: 현재 프로젝트 수치

| 항목 | Before (현재) | After (예상) |
|------|---------------|--------------|
| 1000줄+ 파일 | 1개 | 0개 |
| 데드코드 파일 | 22개 | 0개 |
| 순환 의존성 | 6체인 (2근본) | 0개 |
| `.env.example` 문서화율 | 20% (12/59) | 100% (59/59) |
| ESLint 설정 | 미설정 | `next/core-web-vitals` |
| 중복 시스템 | 3개 | 0개 |
| 미보호 라우트 | 1개 (`/documents`) | 0개 |

---

*이 문서는 수정 완료 후 결과 섹션이 추가됩니다.*
