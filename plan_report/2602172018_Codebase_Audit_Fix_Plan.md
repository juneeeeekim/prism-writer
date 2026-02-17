# PRISM Writer - Codebase Audit & Fix Plan

> **문서 ID:** 2602172018
> **작성일:** 2026-02-17
> **작성자:** Claude Opus 4.6 (기술 리더)
> **상태:** 승인 대기
> **분석 범위:** Frontend (Next.js), Backend (FastAPI), Config/Dependencies
> **빌드 상태:** `next build` 성공 (런타임 잠재 이슈 존재)

---

## 1. 개요

프로젝트 전체 코드베이스 감사(Audit)를 수행하여 발견된 이슈들에 대한 수정 계획서입니다.
305+ TypeScript/TSX 파일, 50+ API 라우트, Python 백엔드, 설정 파일 전체를 분석하였습니다.

### 1.1 발견 이슈 요약

| 심각도       | 건수 | 비고                               |
| ------------ | ---- | ---------------------------------- |
| **CRITICAL** | 2건  | 빌드는 통과하나 런타임/확장성 문제 |
| **HIGH**     | 4건  | 보안, 아키텍처, 의존성 충돌        |
| **MEDIUM**   | 6건  | 코드 품질, 미구현, 데이터 영속성   |
| **LOW**      | 5건  | 문서화, 중복 정의, 미사용 코드     |

---

## 2. 수정 단계 계획

수정을 **4단계**로 나누어 진행합니다.
각 단계는 독립적으로 커밋 가능하며, 이전 단계에 의존합니다.

---

### Phase 1: Critical & High — 즉시 수정 (안전성/보안)

#### Task 1-1. LLM Provider re-export 누락 수정

- **파일:** `frontend/src/lib/llm/providers/index.ts`
- **현재 상태:** Line 59-60에서 `base`와 `gemini`만 re-export
- **문제:** `openai`, `anthropic` provider 타입이 외부에서 import 불가
- **수정 내용:**

  ```typescript
  // 변경 전 (Line 59-60)
  export * from "./base";
  export * from "./gemini";

  // 변경 후
  export * from "./base";
  export * from "./gemini";
  export * from "./openai";
  export * from "./anthropic";
  ```

- **위험도:** 낮음 — re-export 추가만으로 기존 동작에 영향 없음
- **검증:** `next build` 성공 확인

#### Task 1-2. Backend `references.py` Request Body 파라미터 수정

- **파일:** `backend/src/presentation/api/references.py`
- **현재 상태:** Line 80 `request: ReferenceCreateRequest = None`
- **문제:** `= None` 기본값으로 인해 FastAPI가 body 파싱을 올바르게 하지 못함
- **수정 내용:**

  ```python
  # 변경 전 (Line 80)
  request: ReferenceCreateRequest = None

  # 변경 후
  request: ReferenceCreateRequest
  ```

- **위험도:** 낮음 — 정상적인 FastAPI 패턴으로 복원
- **검증:** FastAPI `/docs` Swagger에서 POST 요청 테스트

#### Task 1-3. Backend CORS 설정 보안 강화

- **파일:** `backend/main.py`
- **현재 상태:** Line 31 빈 문자열 origins, Line 38-39 와일드카드 methods/headers
- **수정 내용:**

  ```python
  # 변경 전
  origins = [
      "http://localhost:3000",
      "http://127.0.0.1:3000",
      os.getenv("FRONTEND_URL", "")
  ]
  # ...
  allow_methods=["*"],
  allow_headers=["*"],

  # 변경 후
  _frontend_url = os.getenv("FRONTEND_URL", "")
  origins = [
      "http://localhost:3000",
      "http://127.0.0.1:3000",
  ]
  if _frontend_url:
      origins.append(_frontend_url)
  # ...
  allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allow_headers=["Authorization", "Content-Type", "Accept"],
  ```

- **위험도:** 중간 — CORS 변경은 프론트엔드 연동에 영향 가능. 필요 시 헤더 추가
- **검증:** 프론트엔드 ↔ 백엔드 API 통신 테스트

#### Task 1-4. Root `package.json` 정리 (Tailwind v4/v3 충돌 해결)

- **파일:** Root `package.json`
- **현재 상태:** Root에 `tailwindcss@^4.1.18`, Frontend에 `tailwindcss@^3.4.0` — 메이저 버전 충돌
- **문제:** Root의 불필요한 devDependencies와 dependencies가 프론트엔드와 충돌
- **수정 내용:**

  ```json
  // 변경 전 (Root package.json)
  {
    "dependencies": {
      "@supabase/supabase-js": "^2.89.0",
      "ai": "^5.0.116",
      "dotenv": "^17.2.3",
      "motion": "^12.29.0"
    },
    "devDependencies": {
      "autoprefixer": "^10.4.23",
      "postcss": "^8.5.6",
      "tailwindcss": "^4.1.18"
    }
  }

  // 변경 후 — 프론트엔드 전용 패키지 제거
  {
    "private": true,
    "workspaces": ["frontend"],
    "scripts": {},
    "dependencies": {},
    "devDependencies": {}
  }
  ```

  > **참고:** `ai`, `motion`, `dotenv`, `@supabase/supabase-js`는 코드에서 import하는 곳이 없으므로 제거.
  > 프론트엔드에 필요하면 `frontend/package.json`에 추가.

- **위험도:** 중간 — `npm install` 재실행 필요. Root node_modules 삭제 후 재설치 권장
- **검증:** `cd frontend && npm run build` 성공 확인
- **후속 작업:** Root `node_modules/` 삭제 및 `npm install` 재실행

#### Task 1-5. Backend 마이그레이션 번호 중복 해결

- **파일:** `backend/migrations/` 내 6개 파일
- **현재 상태:**
  - `020_fix_profile_rls.sql` / `020_search_schema.sql`
  - `021_insert_missing_profiles.sql` / `021_pipeline_v3_schema.sql`
  - `023_final_system_repair.sql` / `023_tenant_rls_policies.sql`
- **수정 내용:** 실행 순서를 보존하면서 번호를 재정렬
  ```
  020_fix_profile_rls.sql         → 유지 (020)
  020_search_schema.sql           → 020b_search_schema.sql
  021_insert_missing_profiles.sql → 유지 (021)
  021_pipeline_v3_schema.sql      → 021b_pipeline_v3_schema.sql
  023_final_system_repair.sql     → 유지 (023)
  023_tenant_rls_policies.sql     → 023b_tenant_rls_policies.sql
  ```
- **위험도:** 낮음 — 파일명 변경만, SQL 내용 수정 없음. 이미 실행된 마이그레이션에는 영향 없음
- **검증:** 파일 리스트 정렬 확인

---

### Phase 2: High — 아키텍처 개선

#### Task 2-1. `outline/route.ts` LLM Gateway 사용으로 전환

- **파일:** `frontend/src/app/api/outline/route.ts`
- **현재 상태:** Line 17, 180-189에서 `GoogleGenerativeAI`를 직접 사용
- **문제:** 다른 모든 API는 `@/lib/llm/gateway`를 사용하는데, 이 라우트만 Gemini에 하드코딩
- **수정 방향:**
  1. `GoogleGenerativeAI` 직접 import 제거
  2. `generateText` from `@/lib/llm/gateway` 사용
  3. `getModelForUsage('outline')` 으로 모델 선택 (이미 import되어 있음)
- **위험도:** 중간 — LLM 호출 로직 변경. 응답 포맷 검증 필요
- **검증:** 목차 생성 기능 E2E 테스트

---

### Phase 3: Medium — 코드 품질 개선

#### Task 3-1. Backend `generate_outline.py` 정리

- **파일:** `backend/src/application/use_cases/generate_outline.py`
- **수정 내용:**
  1. Line 139: 도달 불가 `return "[]"` 제거
  2. Line 134: `except Exception` → `except (ValueError, RuntimeError, IOError)` 등 구체적 예외로 변경
  3. Line 127-132: TODO 주석 정리 (현재 스텁 상태임을 명확히)
- **위험도:** 낮음
- **검증:** Python 단위 테스트

#### Task 3-2. Backend `outline.py` 에러 메시지 노출 방지

- **파일:** `backend/src/presentation/api/outline.py`
- **수정 내용:**
  1. Line 108-113: 내부 에러 메시지를 클라이언트에 노출하지 않도록 변경

     ```python
     # 변경 전
     detail=f"목차 생성 중 오류가 발생했습니다: {str(e)}"

     # 변경 후
     detail="목차 생성 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요."
     ```

  2. Line 11: 미사용 `Optional` import 제거

- **위험도:** 낮음
- **검증:** API 에러 응답 확인

#### Task 3-3. `AdminModelSelector` — `window.location.reload()` 제거

- **파일:** `frontend/src/components/admin/AdminModelSelector.tsx`
- **수정 내용:** Line 53의 `window.location.reload()` 대신 `CustomEvent` dispatch

  ```typescript
  // 변경 전
  window.location.reload();

  // 변경 후 (ChatModelSelector 패턴과 동일하게)
  window.dispatchEvent(
    new CustomEvent("prism-model-change", { detail: { modelId } }),
  );
  ```

- **위험도:** 낮음 — `ChatModelSelector`에서 이미 검증된 패턴
- **검증:** 어드민 페이지에서 모델 변경 테스트

#### Task 3-4. `SelectionPopover` — setTimeout cleanup 추가

- **파일:** `frontend/src/components/Editor/SelectionPopover.tsx`
- **수정 내용:** Line 94의 `setTimeout` 반환값을 ref에 저장하고 cleanup
  ```typescript
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  // ...
  timerRef.current = setTimeout(...)
  // cleanup
  return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  ```
- **위험도:** 낮음
- **검증:** 에디터에서 텍스트 선택/해제 반복 테스트

---

### Phase 4: Low — 정리 작업

#### Task 4-1. `frontend/.env.example` 중복 제거

- **파일:** `frontend/.env.example`
- **수정:** Line 49-50의 `NEXT_PUBLIC_ENABLE_SELF_RAG` 중복 항목 제거

#### Task 4-2. `outline/route.ts` 주석 중복 제거

- **파일:** `frontend/src/app/api/outline/route.ts`
- **수정:** Line 38-39의 `/** 검색 결과 개수 (기본 10) */` 중복 제거

#### Task 4-3. Backend `outline.py` mutable default 수정

- **파일:** `backend/src/presentation/api/outline.py`
- **수정:** Line 28 `default=[]` → `default_factory=list`

#### Task 4-4. Backend `references.py` 플레이스홀더 주석 보강

- **파일:** `backend/src/presentation/api/references.py`
- **수정:** Line 145-146의 하드코딩 플레이스홀더에 TODO 태그 추가

---

## 3. 수정하지 않는 항목 (의도적 보류)

| 항목                                    | 사유                                              |
| --------------------------------------- | ------------------------------------------------- |
| `references.py` 인메모리 저장소         | 주석에 "추후 DB 연동" 명시. DB 통합은 별도 태스크 |
| `generate_outline.py` LLM 미구현 (TODO) | 백엔드 LLM 연동은 별도 Phase로 계획               |
| Supabase `config.toml` 생성             | 로컬 개발 환경 설정은 별도 태스크                 |
| 환경변수 일괄 감사                      | `.env.local`의 전체 정리는 배포 점검 시 진행      |

---

## 4. 실행 순서 및 예상 커밋

| 순서 | Phase   | 커밋 메시지                                                  | 영향 범위          |
| ---- | ------- | ------------------------------------------------------------ | ------------------ |
| 1    | 1-1     | `fix: LLM provider openai/anthropic re-export 추가`          | Frontend           |
| 2    | 1-2     | `fix: references.py request body 파라미터 수정`              | Backend            |
| 3    | 1-3     | `fix: CORS 보안 강화 (빈 origin 제거, methods/headers 명시)` | Backend            |
| 4    | 1-4     | `chore: root package.json 정리 (Tailwind v4 충돌 해결)`      | Root Config        |
| 5    | 1-5     | `chore: 마이그레이션 파일 번호 중복 해결`                    | Backend            |
| 6    | 2-1     | `refactor: outline API를 LLM Gateway 사용으로 전환`          | Frontend           |
| 7    | 3-1~3-4 | `fix: 코드 품질 개선 (에러 처리, 메모리 누수, dead code)`    | Frontend + Backend |
| 8    | 4-1~4-4 | `chore: 주석/문서 정리 및 minor fixes`                       | Frontend + Backend |

---

## 5. 검증 체크리스트

- [ ] `cd frontend && npm run build` — 빌드 성공
- [ ] `cd frontend && npm run dev` — 개발 서버 정상 실행
- [ ] LLM Provider 전환 테스트 (Gemini → OpenAI → Anthropic)
- [ ] 목차 생성 기능 동작 확인
- [ ] 어드민 모델 변경 시 페이지 리로드 없이 반영
- [ ] Backend `/docs` Swagger에서 References API POST 테스트
- [ ] CORS: 프론트엔드 ↔ 백엔드 API 통신 정상

---

## 6. 롤백 계획

각 Phase는 독립 커밋이므로, 문제 발생 시 `git revert <commit>` 으로 개별 롤백 가능.

**고위험 변경 (Phase 1-4 Root package.json):**

- 롤백 시 `git checkout HEAD -- package.json && npm install` 실행
- Root `node_modules/` 복원 필요

---

_이 문서는 수정 완료 후 결과 섹션이 추가됩니다._
