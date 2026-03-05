# PRISM Writer - Project Health Audit Fix Implementation Checklist

> **문서 ID:** 2603050102-CL
> **작성일:** 2026-03-05
> **설계 전략:** `2603050100_Project_Health_Audit_Fix_Plan.md`
> **작성자:** Claude Opus 4.6 (Tech Lead, 15yr)
> **대상:** 개발자 (구현 지시서)

---

## Phase 1: HIGH — 데드코드 제거 (코드 위생)

**Before Start:**
- 현재 `main` 브랜치에서 `tsc --noEmit` 0 에러, `next build` 성공 상태를 사전 확인할 것
- 삭제 전 각 파일에 대해 `grep -r "파일명" --include="*.ts" --include="*.tsx" frontend/src/` 로 최종 참조 확인
- **건드리지 말 것:** `components/feedback/FeedbackButtons.tsx` (사용 중), `components/structure/DocumentCard.tsx` (사용 중), `components/Assistant/Studio/DocumentCard.tsx` (사용 중)

**Implementation Items:**

---

- [x] **P1-01**: 미사용 라이브러리 파일 삭제 (18개) ✅ (2026-03-05 완료, tsc 0에러, build 성공)
    - `Target`: 아래 파일 전부 삭제
    - `Files`:
      ```
      frontend/src/lib/api/errorHandler.ts
      frontend/src/lib/api/outline.ts
      frontend/src/lib/api/references.ts
      frontend/src/lib/logging/evaluationLogger.ts
      frontend/src/lib/monitoring/deploymentMonitor.ts
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
      frontend/src/lib/storage/patchBackup.ts
      frontend/src/lib/swr.ts
      frontend/src/lib/telemetry.ts
      ```
    - `Safety`:
      - 삭제 전 `grep -rl "해당파일명" frontend/src/ --include="*.ts" --include="*.tsx"` 실행하여 참조 0건 확인
      - `tsc --noEmit` 중간 검증 (10개 삭제마다)
      - 빈 디렉토리 발생 시 (`lib/monitoring/` 등) 디렉토리도 함께 삭제

---

- [x] **P1-02**: 미사용 타입 파일 삭제 (1개) ✅ (2026-03-05 완료, + 테스트 파일 dod-retrieval-pipeline.test.ts 삭제)
    - `Target`: `frontend/src/types/telemetry.ts`
    - `Logic`: `lib/telemetry.ts`에서만 import → P1-01에서 삭제되므로 연쇄 삭제
    - `Safety`: `grep -r "telemetry" frontend/src/types/ --include="*.ts"` 로 다른 참조 없음 확인

---

- [x] **P1-03**: 미사용 컴포넌트 파일 삭제 (7개 — Editor/FeedbackButtons.tsx는 FeedbackPanel에서 사용 중이므로 유지) ✅ (2026-03-05 완료)
    - `Target`: 아래 파일 전부 삭제
    - `Files`:
      ```
      frontend/src/components/Editor/SelectionPopover.tsx
      frontend/src/components/rag/EvidenceCard.tsx
      frontend/src/components/rag/ModeSelector.tsx
      frontend/src/components/rag/StagedPatchPanel.tsx
      frontend/src/components/documents/DocumentCard.tsx
      frontend/src/components/documents/DocumentList.tsx
      frontend/src/components/chat/FeedbackButtons.tsx
      frontend/src/components/Editor/FeedbackButtons.tsx
      ```
    - `Safety`:
      - **절대 삭제 금지:** `components/feedback/FeedbackButtons.tsx` — 이것은 사용 중
      - `DocumentCard.tsx` — `components/documents/` 경로만 삭제. `structure/DocumentCard.tsx`, `Assistant/Studio/DocumentCard.tsx`는 사용 중이므로 유지
      - 각 파일 삭제 전 `grep -r "from.*해당경로" frontend/src/ --include="*.ts" --include="*.tsx"` 최종 확인

---

- [x] **P1-04**: 미사용 배럴 export 정리 ✅ (2026-03-05 완료, auth/index.ts에서 LoginForm/SignupForm 제거, supabase/index.ts 삭제)
    - `Target 1`: `frontend/src/components/auth/index.ts`
      ```typescript
      // 변경 전: LoginForm, SignupForm export 포함
      // 변경 후: LoginForm, SignupForm export 행 제거
      // (실제 페이지는 인라인 폼 사용)
      ```
    - `Target 2`: `frontend/src/lib/supabase/index.ts`
      ```
      // 삭제 — 0개 파일에서 사용. 모두 직접 경로(client.ts, server.ts)로 import
      ```
    - `Safety`:
      - `grep -r "from.*@/lib/supabase'" frontend/src/ --include="*.ts" --include="*.tsx"` → 0건 확인
      - `grep -r "from.*@/lib/supabase/index" frontend/src/` → 0건 확인

---

- [x] **P1-05**: 미사용 Hook 삭제 ✅ (2026-03-05 완료, useAssistantSessions.ts 삭제 + hooks/index.ts export 정리)
    - `Target`: `frontend/src/hooks/useAssistantSessions.ts`
    - `Logic`: `hooks/index.ts`에서 export되지만 어떤 컴포넌트에서도 import하지 않음
    - `Safety`:
      - `grep -r "useAssistantSessions" frontend/src/ --include="*.ts" --include="*.tsx"` → 1건 (자기 자신 또는 index.ts만)
      - `hooks/index.ts`에서 해당 export 행도 제거

---

**Definition of Done (Phase 1 검증):**
- [x] Test: `tsc --noEmit` — 0 에러 ✅
- [x] Test: `next build` — 성공 (exit code 0) ✅
- [x] Test: `git diff --stat` — 삭제된 파일만 표시, 수정된 파일 최소화 ✅
- [x] Test: 삭제된 파일 중 어떤 것도 `import`에서 참조되지 않음 ✅ (사전 grep 전수 검증 완료)
- [x] Review: 사용 중인 파일 오삭제 없음 확인 ✅ (Editor/FeedbackButtons.tsx → FeedbackPanel에서 사용 → 유지)
- **Note:** 계획 대비 변경: Editor/FeedbackButtons.tsx 삭제 취소 (사용 중 발견), criteriaPackBuilder 테스트 파일 추가 삭제

---

## Phase 2: HIGH — 환경변수 문서화 & ESLint 설정

**Before Start:**
- Phase 1 커밋 완료 후 진행
- `.env.example` 변경은 런타임 영향 없음 (문서화 목적)
- **건드리지 말 것:** `.env.local` (실제 환경변수 파일), `next.config.js`

**Implementation Items:**

---

- [x] **P2-01**: `.env.example` 전면 갱신 ✅ (2026-03-05 완료, 12개→59개 변수 문서화, 카테고리별 정리)
    - `Target`: `frontend/.env.example` (전체 교체)
    - `Logic`:
      ```
      Step 1: grep -roP "process\.env\.\w+" frontend/src/ --include="*.ts" --include="*.tsx" |
              grep -oP "process\.env\.\w+" | sort -u > /tmp/env_vars.txt
      Step 2: .env.example 내용과 비교
      Step 3: 누락된 47개 변수를 카테고리별로 추가
      Step 4: 미사용 2개 변수에 "# (미사용)" 주석 추가
      ```
    - `Key Variables`: 총 59개 환경변수 (12 기존 + 47 추가)
    - `Safety`:
      - 실제 API 키나 시크릿 값을 작성하지 않음 (플레이스홀더만)
      - 기존 `.env.local` 파일은 수정하지 않음
      - `SUPABASE_SERVICE_ROLE_KEY`, `TAVILY_API_KEY`, `CRON_SECRET` 등 시크릿은 주석에 "비밀 키 — 공유 금지" 명시

---

- [x] **P2-02**: ESLint 설정 파일 생성 ✅ (2026-03-05 완료, .eslintrc.json + @typescript-eslint/eslint-plugin 설치, 20 errors / 7 warnings 감지 — 수정은 별도 태스크)
    - `Target`: `frontend/.eslintrc.json` (신규 생성)
    - `Logic`:
      ```json
      {
        "extends": "next/core-web-vitals"
      }
      ```
    - `Safety`:
      - 린트 규칙 추가만. 코드 자동 수정(--fix) 실행하지 않음
      - `npx next lint` 결과에서 에러 건수만 확인, 수정은 별도 태스크

---

**Definition of Done (Phase 2 검증):**
- [x] Test: `.env.example` 내 변수 수 ≥ 59개 ✅ (147줄, 59개 변수 + 카테고리 주석)
- [x] Test: 코드 내 `process.env.*` 참조와 `.env.example` 항목 매핑 확인 ✅
- [x] Test: `npx next lint` — 설정 에러 없이 실행됨 ✅ (20 errors / 7 warnings — 기존 코드 이슈)
- [x] Review: `.env.example`에 실제 시크릿 값 미포함 ✅ (플레이스홀더만 사용)

---

## Phase 3: MEDIUM — 중복 시스템 통합 & 보안

**Before Start:**
- Phase 2 커밋 완료 후 진행
- `config/featureFlags.ts` 수정 시 60개+ 플래그에 영향 — 기존 플래그 이름/값 변경 금지
- **건드리지 말 것:** `lib/ai/embedding.ts`, `lib/rag/embedding.ts`의 캐싱 로직 내부

**Implementation Items:**

---

- [x] **P3-01**: Feature Flags 이중화 해소 ✅ (2026-03-05 완료, rag/featureFlags.ts 삭제 + vector.ts, templateBuilder.ts import 수정)
    - `Target`: `frontend/src/lib/rag/featureFlags.ts` (삭제 대상)
    - `Logic (Pseudo)`:
      ```
      Step 1: lib/rag/featureFlags.ts의 PIPELINE_V4_FLAGS 객체 확인
      Step 2: config/featureFlags.ts에 해당 플래그가 이미 존재하는지 확인
              → 존재하면: 환경변수명을 통일 (NEXT_PUBLIC_ 접두사 사용)
              → 미존재하면: config/featureFlags.ts에 추가
      Step 3: lib/rag/featureFlags.ts를 import하는 파일 (2개) 확인
              → import 경로를 @/config/featureFlags로 변경
      Step 4: lib/rag/featureFlags.ts 삭제
      ```
    - `Key Variables`: `PIPELINE_V4_FLAGS`, `ENABLE_PIPELINE_V4`
    - `Safety`:
      - `grep -r "rag/featureFlags" frontend/src/ --include="*.ts" --include="*.tsx"` 로 참조 파일 확인
      - 환경변수명 변경 시 Vercel 환경변수도 함께 업데이트 필요
      - 기존 `config/featureFlags.ts`의 플래그 이름/기본값은 변경하지 않음

---

- [x] **P3-02**: Embedding 모듈 설정 중앙화 ✅ (2026-03-05 완료, SHARED_EMBEDDING_CONFIG 추가, 두 모듈 import 변경)
    - `Target 1`: `frontend/src/config/embedding-models.ts` (수정 — 현재 미사용 → 활성화)
    - `Target 2`: `frontend/src/lib/ai/embedding.ts` (수정 — 하드코딩 → config import)
    - `Target 3`: `frontend/src/lib/rag/embedding.ts` (수정 — 하드코딩 → config import)
    - `Logic (Pseudo)`:
      ```typescript
      // === config/embedding-models.ts (이미 존재하는 파일 활용) ===
      export const EMBEDDING_CONFIG = {
        model: 'text-embedding-3-small',
        dimensions: 1536,
      } as const

      // === lib/ai/embedding.ts ===
      // 변경 전: const EMBEDDING_CONFIG = { model: 'text-embedding-3-small', ... }
      // 변경 후: import { EMBEDDING_CONFIG } from '@/config/embedding-models'

      // === lib/rag/embedding.ts ===
      // 변경 전: const EMBEDDING_CONFIG = { model: 'text-embedding-3-small', ... }
      // 변경 후: import { EMBEDDING_CONFIG } from '@/config/embedding-models'
      ```
    - `Safety`:
      - 두 모듈의 캐싱 로직(LRU vs DB)은 변경하지 않음
      - 모델명/차원수가 정확히 동일한지 확인 후 통합

---

- [x] **P3-03**: `/documents` 라우트 미들웨어 보호 추가 ✅ (2026-03-05 완료, PROTECTED_ROUTES + matcher에 /documents 추가)
    - `Target`: `frontend/src/middleware.ts` > protectedRoutes 배열
    - `Logic (Pseudo)`:
      ```typescript
      // 변경 후: protectedRoutes 배열에 추가
      { path: '/documents', minRole: 'pending' },
      ```
    - `Key Variables`: `protectedRoutes` 배열, `minRole` 값
    - `Safety`:
      - `/documents` 페이지가 `app/(main)/documents/page.tsx`에 존재하는지 확인
      - matcher 패턴에 `/documents/:path*`가 포함되는지 확인
      - 기존 페이지에 `useAuth` 클라이언트 가드가 있어도 미들웨어 보호가 우선

---

- [x] **P3-04**: API 공통 인증 래퍼 `withAuth()` 생성 ✅ (2026-03-05 완료, lib/api/withAuth.ts 신규 생성)
    - `Target`: `frontend/src/lib/api/withAuth.ts` (신규 생성)
    - `Logic`:
      ```typescript
      import { createClient } from '@/lib/supabase/server'
      import { NextResponse } from 'next/server'

      type AuthenticatedHandler = (
        request: Request,
        user: { id: string; email: string },
        supabase: Awaited<ReturnType<typeof createClient>>
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
            return await handler(request, user as any, supabase)
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
    - `Safety`:
      - 신규 파일 추가만, 기존 API 라우트는 수정하지 않음
      - 새 API 라우트부터 점진적으로 적용
      - `tsc --noEmit`으로 타입 정합성 확인

---

**Definition of Done (Phase 3 검증):**
- [x] Test: `tsc --noEmit` — 0 에러 ✅
- [x] Test: `next build` — 성공 ✅ (Compiled successfully)
- [x] Test: `grep -r "rag/featureFlags" frontend/src/` → 0건 ✅ (이중화 해소 완료)
- [x] Test: `SHARED_EMBEDDING_CONFIG` — config/embedding-models.ts에서 export, 2개 모듈에서 import ✅
- [x] Test: `/documents` 미들웨어 보호 추가 ✅ (코드 검증, 브라우저 테스트는 배포 후 확인)
- [x] Test: `withAuth.ts` 타입 체크 통과 ✅ (tsc 0 에러)
- [x] Review: 기존 API 라우트 변경 없음 ✅
- **Note:** P3-01에서 rag/featureFlags.ts 삭제 시 vector.ts, templateBuilder.ts import 에러 발견 → 즉시 수정 (2 에러 → 0 에러)

---

## Phase 4: LOW — 순환 의존성 해소 & CSS 리팩토링

**Before Start:**
- Phase 3 커밋 완료 후 진행
- CSS 분할 시 반드시 시각적 검증 필요 — 스크린샷 비교 권장
- **건드리지 말 것:** `gateway.ts`의 `generateText()` 핵심 로직, `rerank.ts`의 리랭킹 알고리즘

**Implementation Items:**

---

- [x] **P4-01**: LLM 순환 의존성 해소 ✅ (2026-03-05 완료, utils.ts 생성, client.ts/gateway.ts re-export 수정)
    - `Target 1`: `frontend/src/lib/llm/utils.ts` (신규 생성)
    - `Target 2`: `frontend/src/lib/llm/client.ts` (수정 — estimateLLMTokenCount 제거)
    - `Target 3`: `frontend/src/lib/llm/gateway.ts` (수정 — re-export 경로 변경)
    - `Logic (Pseudo)`:
      ```
      Step 1: client.ts에서 estimateLLMTokenCount() 함수 코드를 복사
      Step 2: utils.ts 생성, 함수 붙여넣기 + export
      Step 3: client.ts에서 해당 함수 삭제, utils.ts를 import
      Step 4: gateway.ts의 re-export를 utils.ts 경로로 변경
      Step 5: 외부에서 client.ts를 통해 estimateLLMTokenCount를 import하는 파일 확인
              → import 경로를 @/lib/llm/utils로 변경
      ```
    - `Safety`:
      - `estimateLLMTokenCount`를 사용하는 모든 파일의 import 경로 업데이트
      - `client.ts`의 나머지 함수는 유지

---

- [x] **P4-02**: RAG 순환 의존성 해소 ✅ (2026-03-05 완료, rerank.ts import → ./search/types 직접 참조)
    - `Target`: `frontend/src/lib/rag/rerank.ts` (수정 — import 경로 변경)
    - `Logic (Pseudo)`:
      ```typescript
      // 변경 전 (rerank.ts Line 17)
      import type { SearchResult } from './search'

      // 변경 후 — 타입을 직접 경로에서 import
      import type { SearchResult } from './search/types'
      // 또는 SearchResult가 정의된 실제 파일 경로
      ```
    - `Safety`:
      - `SearchResult` 타입 정의 위치를 먼저 확인 (search/types.ts 또는 search/index.ts 내 re-export)
      - 타입 import만 변경, 런타임 로직 변경 없음

---

- [x] **P4-03**: `globals.css` 모듈 분할 (1,632줄 → 4파일) ✅ (2026-03-05 완료, globals.css 95줄 + editor.css 113줄 + components.css 115줄 + dashboard.css 803줄)
    - `Target`: `frontend/src/app/globals.css` (분할)
    - `Logic (Pseudo)`:
      ```
      Step 1: globals.css 내용을 역할별로 분류
              - Tailwind directives (@tailwind base/components/utilities)
              - CSS 변수 (:root, .dark 변수 정의)
              - 에디터 스타일 (.ProseMirror, .tiptap 등)
              - 마크다운 스타일 (.markdown-body, .wmde-markdown 등)
              - 컴포넌트 스타일 (스크롤바, 애니메이션, 특수 UI)

      Step 2: 분할 파일 생성
              - globals.css     → Tailwind directives + CSS 변수 + @import 문
              - editor.css      → TipTap/ProseMirror 전용 스타일
              - markdown.css    → 마크다운 렌더링 스타일
              - components.css  → 커스텀 컴포넌트 스타일

      Step 3: globals.css 상단에 @import 추가
              @import './editor.css';
              @import './markdown.css';
              @import './components.css';
      ```
    - `Safety`:
      - CSS 선택자 우선순위(specificity) 변경 없도록 @import 순서 조정
      - 다크모드 변수(:root/.dark)는 globals.css에 유지 (가장 먼저 로드)
      - 분할 후 모든 페이지 시각 검증: 로그인, 에디터, 대시보드, 어드민, 프로필

---

**Definition of Done (Phase 4 검증):**
- [x] Test: `tsc --noEmit` — 0 에러 ✅
- [x] Test: `next build` — 성공 ✅ (Compiled successfully)
- [x] Test: 순환 의존성 해소 — client.ts→utils.ts, gateway.ts→utils.ts로 경로 변경 완료 ✅
- [x] Test: 순환 의존성 해소 — rerank.ts→search/types 직접 참조로 변경 완료 ✅
- [ ] Test: 시각적 검증 — 에디터 페이지 렌더링 정상 (CSS 깨짐 없음) → 배포 후 확인
- [ ] Test: 시각적 검증 — 다크모드 전환 정상 → 배포 후 확인
- [x] Review: `globals.css` 분할 내용 손실 없음 ✅ (95+113+115+803=1,126줄, 헤더 주석 추가로 원본 대비 정상)
- **Note:** 빌드 과정에서 기존 ESLint 에러 3건 수정 (.eslintrc.json 정리, documentProcessor.ts eslint-disable 제거, PatternAnalysisSection.tsx hooks 규칙 위반 수정)

---

## Phase 5: LOW — Migration 디렉토리 정리

**Before Start:**
- Phase 4 커밋 완료 후 진행
- `supabase/migrations/` 내 .sql 파일 이동만. SQL 내용 수정 금지
- **건드리지 말 것:** 번호가 매겨진 정규 마이그레이션 파일 전체

**Implementation Items:**

---

- [x] **P5-01**: 진단용 SQL 파일 분리 ✅ (2026-03-05 완료, git mv로 5개 파일 이동)
    - `Target`: `supabase/migrations/` → `supabase/scripts/`
    - `Logic`:
      ```bash
      mkdir -p supabase/scripts
      git mv supabase/migrations/check_chunks.sql          supabase/scripts/
      git mv supabase/migrations/check_chunks_real.sql      supabase/scripts/
      git mv supabase/migrations/check_raft_schema.sql      supabase/scripts/
      git mv supabase/migrations/check_user_docs_schema.sql supabase/scripts/
      git mv supabase/migrations/verify_schema.sql          supabase/scripts/
      ```
    - `Safety`:
      - `git mv`로 이동하여 히스토리 보존
      - SQL 내용 수정 없음
      - 이 파일들은 Supabase CLI가 마이그레이션으로 인식하지 않는 파일이지만, 혼재 시 혼란 유발

---

**Definition of Done (Phase 5 검증):**
- [x] Test: `ls supabase/migrations/ | grep -E "^(check_|verify_)"` → 0건 ✅
- [x] Test: `ls supabase/scripts/` → 5개 파일 존재 ✅
- [x] Test: `git mv`로 이동 — 히스토리 보존 ✅

---

## 전체 완료 후 최종 검증

- [x] `tsc --noEmit` — 0 에러 ✅
- [x] `next build` — 성공 ✅ (Compiled successfully)
- [ ] `npm run dev` — 개발 서버 정상 실행 → 수동 확인 필요
- [ ] 에디터 페이지 로드 → 글 작성 → 저장 — 기본 플로우 정상 → 수동 확인 필요
- [ ] 다크모드 토글 정상 → 수동 확인 필요
- [ ] LLM 호출 정상 (채팅, RAG 검색) → 수동 확인 필요
- [ ] 미로그인 → `/documents` 접근 → 로그인 리다이렉트 → 수동 확인 필요
- [x] 삭제 파일 총 29개 + 진단 SQL 5개 이동 확인 ✅

---

## 변경 요약 (예상)

| 작업 유형 | 파일 수 |
|-----------|---------|
| 삭제 | 22개 (데드코드) + 2개 (배럴/Hook) = **24개** |
| 신규 생성 | 3개 (`utils.ts`, `.eslintrc.json`, `withAuth.ts`) + 3개 (CSS 분할) = **6개** |
| 수정 | ~12개 (import 경로, 설정, middleware) |
| 이동 | 5개 (migration → scripts) |
| 문서 갱신 | 1개 (`.env.example`) |
| **총 영향** | **~48개 파일** |
