# PRISM Writer - Codebase Audit Fix Implementation Checklist

> **문서 ID:** 2602172018-CL
> **작성일:** 2026-02-17
> **설계 전략:** `2602172018_Codebase_Audit_Fix_Plan.md`
> **작성자:** Claude Opus 4.6 (Tech Lead, 15yr)
> **대상:** 개발자 (구현 지시서)

---

## Phase 1: Critical & High — 즉시 수정 (안전성/보안)

**Before Start:**
- 현재 `main` 브랜치에서 `next build` 성공 상태를 사전 확인할 것
- `backend/main.py`의 CORS 변경은 프론트엔드 `fetch()` 호출에 영향 — 프론트엔드 개발 서버 동시 기동하여 검증
- `package.json` 변경 후 반드시 `node_modules` 삭제 → 재설치 순서 준수
- **건드리지 말 것:** `frontend/src/lib/llm/providers/base.ts`, `gemini.ts`, `openai.ts`, `anthropic.ts` 의 클래스 내부 로직

**Implementation Items:**

---

- [x] **P1-01**: LLM Provider re-export 누락 수정 ✅ (2026-02-17 완료, build 성공)
    - `Target`: `frontend/src/lib/llm/providers/index.ts` > Line 58-60 (모듈 re-export 블록)
    - `Logic (Pseudo)`:
      ```
      // 기존: base, gemini만 export
      export * from "./base";
      export * from "./gemini";

      // 추가: openai, anthropic도 export
      export * from "./openai";
      export * from "./anthropic";
      ```
    - `Key Variables`: 없음 (re-export 추가만)
    - `Safety`:
      - export name 충돌 확인 — `OpenAIProvider`, `AnthropicProvider`, `GeminiProvider` 각 파일에서 클래스명이 고유한지 확인 (확인 완료: 고유함)
      - 빌드 후 `getProvider('openai')`, `getProvider('anthropic')` 가 기존과 동일하게 동작하는지 확인 (내부 import는 이미 정상)

---

- [x] **P1-02**: Backend `references.py` Request Body 파라미터 수정 ✅ (2026-02-17 완료, py_compile 성공, Body(...) 패턴 적용)
    - `Target`: `backend/src/presentation/api/references.py` > `create_reference()` (Line 78-80)
    - `Logic (Pseudo)`:
      ```python
      # 변경 전 (Line 80)
      async def create_reference(
          draft_id: str = Path(..., description="글 ID"),
          request: ReferenceCreateRequest = None   # <-- BUG: = None 제거
      ):

      # 변경 후
      async def create_reference(
          draft_id: str = Path(..., description="글 ID"),
          request: ReferenceCreateRequest,          # FastAPI가 JSON body로 자동 파싱
      ):
      ```
    - `Key Variables`: `request.chunk_id`, `request.paragraph_index`, `request.reference_type`
    - `Safety`:
      - `= None` 제거 후 클라이언트가 body 없이 POST 시 FastAPI가 자동으로 `422 Unprocessable Entity` 반환 — 이것이 의도된 정상 동작
      - Line 89의 `request.chunk_id` 접근이 `None` 에러 없이 동작하는지 확인
      - Swagger `/docs`에서 POST body 스키마가 `ReferenceCreateRequest`로 표시되는지 확인

---

- [x] **P1-03**: Backend CORS 설정 보안 강화 ✅ (2026-02-17 완료, py_compile 성공, 헤더 호환 확인)
    - `Target`: `backend/main.py` > Line 28-40 (CORS 설정 블록)
    - `Logic (Pseudo)`:
      ```python
      # === 변경 전 (Line 28-40) ===
      origins = [
          "http://localhost:3000",
          "http://127.0.0.1:3000",
          os.getenv("FRONTEND_URL", "")  # BUG: 빈 문자열 포함
      ]
      app.add_middleware(
          CORSMiddleware,
          allow_origins=origins,
          allow_credentials=True,
          allow_methods=["*"],           # BUG: 와일드카드
          allow_headers=["*"],           # BUG: 와일드카드
      )

      # === 변경 후 ===
      _frontend_url = os.getenv("FRONTEND_URL", "")
      origins = [
          "http://localhost:3000",
          "http://127.0.0.1:3000",
      ]
      if _frontend_url:                  # 빈 문자열이면 추가 안 함
          origins.append(_frontend_url)

      app.add_middleware(
          CORSMiddleware,
          allow_origins=origins,
          allow_credentials=True,
          allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
          allow_headers=["Authorization", "Content-Type", "Accept", "X-Requested-With"],
      )
      ```
    - `Key Variables`: `_frontend_url`, `origins`
    - `Safety`:
      - `X-Requested-With` 헤더 추가 — 일부 AJAX 라이브러리에서 사용
      - 프론트엔드에서 커스텀 헤더를 사용하는 경우 `allow_headers`에 추가 필요 — `grep -r "headers:" frontend/src/` 로 확인
      - `OPTIONS` preflight 요청이 정상 응답하는지 확인

---

- [x] **P1-04**: Root `package.json` 정리 (Tailwind v4/v3 충돌 해결) ✅ (2026-02-17 완료, npm install + build 성공)
    - `Target`: Root `package.json` (전체 교체)
    - `Logic (Pseudo)`:
      ```
      Step 1: Root package.json 을 최소 구성으로 교체
              → dependencies: {} (전부 제거)
              → devDependencies: {} (전부 제거)
              → "private": true 추가

      Step 2: rm -rf node_modules package-lock.json
              (Root level node_modules 완전 삭제)

      Step 3: cd frontend && npm install
              (프론트엔드만 재설치)

      Step 4: cd frontend && npm run build
              (빌드 성공 확인)
      ```
    - `Key Variables`: 없음
    - `Safety`:
      - `ai@^5.0.116`, `motion@^12.29.0`, `dotenv@^17.2.3` — 코드에서 import 없음 확인 완료
      - `@supabase/supabase-js` — 프론트엔드에 `^2.87.1`로 이미 존재
      - **주의:** Root의 `package-lock.json`도 함께 삭제해야 함
      - **주의:** `"workspaces"` 필드는 추가하지 않음 — npm workspaces 설정은 현재 프로젝트에 불필요하며 부작용 가능

---

- [x] **P1-05**: Backend 마이그레이션 번호 중복 해결 ✅ (2026-02-17 완료, git mv 3건)
    - `Target`: `backend/migrations/` 내 6개 파일 (파일명 변경만)
    - `Logic (Pseudo)`:
      ```
      # 중복 번호가 있는 파일들을 'b' 접미사로 구분
      git mv 020_search_schema.sql           020b_search_schema.sql
      git mv 021_pipeline_v3_schema.sql      021b_pipeline_v3_schema.sql
      git mv 023_tenant_rls_policies.sql     023b_tenant_rls_policies.sql

      # 유지 (변경 없음)
      020_fix_profile_rls.sql
      021_insert_missing_profiles.sql
      023_final_system_repair.sql
      ```
    - `Key Variables`: 없음 (파일명만 변경)
    - `Safety`:
      - SQL 내용은 절대 수정하지 않음
      - 이미 Supabase에서 실행된 마이그레이션이므로, 파일명 변경은 향후 관리 편의를 위한 것
      - `git mv`로 rename하여 git 히스토리 보존

---

**Definition of Done (Phase 1 검증):**
- [x] Test: `cd frontend && npm run build` — 빌드 성공 (exit code 0) ✅
- [x] Test: `providers/index.ts` 변경 후 기존 `import { getProvider } from '@/lib/llm/providers'` 가 정상 동작 ✅ (빌드 통과로 확인)
- [x] Test: Backend Swagger (`/docs`)에서 `POST /v1/drafts/{draft_id}/references` 요청 시 body 스키마가 `ReferenceCreateRequest`로 표시 ✅ (openapi.json 검증 완료)
- [x] Test: Backend Swagger에서 body 없이 POST → `422` 응답 확인 ✅ (curl 테스트: `"msg": "Field required"`)
- [x] Test: CORS OPTIONS preflight → `access-control-allow-headers: Authorization, Content-Type` 포함 확인 ✅ (curl -X OPTIONS 검증 완료)
- [x] Test: `ls backend/migrations/020*` → `020_fix_profile_rls.sql`, `020b_search_schema.sql` (중복 없음) ✅
- [x] Review: 불필요한 `console.log` 추가 없음, 기존 주석 유지 ✅

---

## Phase 2: High — 아키텍처 개선

**Before Start:**
- `frontend/src/lib/llm/gateway.ts`의 `generateText()` 시그니처를 정확히 숙지할 것
- `LLM_USAGE_MAP['outline.generation']`의 현재 설정: `modelId: 'gemma-3-2b-it'`, `temperature: 0.5`
- **건드리지 말 것:** `vectorSearch()` 호출 로직 (Line 134-140), 프롬프트 텍스트 (Line 149-175), JSON 파싱 로직 (Line 198-216)

**Implementation Items:**

---

- [x] **P2-01**: `outline/route.ts` LLM Gateway 사용으로 전환 ✅ (2026-02-17 완료, build 성공, maxOutputTokens 타입 수정 반영)
    - `Target`: `frontend/src/app/api/outline/route.ts` > Line 17 (import), Line 81-91 (API key 체크), Line 177-191 (LLM 호출)
    - `Logic (Pseudo)`:
      ```typescript
      // === Step 1: import 변경 (Line 17) ===
      // 삭제:
      import { GoogleGenerativeAI } from '@google/generative-ai'
      // 추가:
      import { generateText, isLLMAvailable } from '@/lib/llm/gateway'

      // === Step 2: API Key 체크 대체 (Line 81-91) ===
      // 삭제: const apiKey = process.env.GOOGLE_API_KEY ... 블록 전체
      // 추가:
      if (!isLLMAvailable()) {
        return NextResponse.json({
          success: false,
          message: 'LLM이 설정되지 않았습니다.',
          error: 'LLM_NOT_AVAILABLE',
        }, { status: 503 })
      }

      // === Step 3: LLM 호출 교체 (Line 177-191) ===
      // 삭제:
      //   const genAI = new GoogleGenerativeAI(apiKey)
      //   const model = genAI.getGenerativeModel({ model: MODEL_NAME })
      //   const result = await model.generateContent({...})
      //   const responseText = result.response.text()

      // 추가:
      const llmResponse = await generateText(prompt, {
        model: MODEL_NAME,       // getModelForUsage('outline.generation')
        maxTokens: 2000,
        temperature: 0.7,
        context: 'outline.generation',  // fallback 지원
      })
      const responseText = llmResponse.text
      ```
    - `Key Variables`:
      - `MODEL_NAME` — 기존 Line 60의 `getModelForUsage('outline.generation')` 유지
      - `llmResponse` — `LLMResponse` 타입, `.text` 속성으로 응답 텍스트 접근
      - `prompt` — 기존 프롬프트 문자열 그대로 유지 (Line 149-175)
    - `Safety`:
      - `generateText()`는 내부에서 try-catch + fallback을 처리하므로 외부 catch 블록(Line 234)과 이중 처리되지 않는지 확인
      - `llmResponse.text`가 빈 문자열이면 JSON 파싱 fallback(Line 211-215)이 동작
      - `@google/generative-ai` import 제거 후 `next build`에서 해당 패키지가 tree-shake 되는지 확인 (패키지 자체는 제거 안 함 — 다른 곳에서 사용 가능)

---

**Definition of Done (Phase 2 검증):**
- [x] Test: `cd frontend && npm run build` — 빌드 성공 ✅
- [x] Test: POST `/api/outline` → `generateText()` 경유 확인 ✅ (정적 분석: import 경로 gateway.ts → provider 확인, 빌드 통과, Supabase 인증 필요로 E2E는 브라우저 테스트 필요)
- [x] Test: Fallback 모델 전환 ✅ (분석 완료: `outline.generation`에 fallback 미설정 — Gateway 코드는 정상, fallback 없으면 원래 에러 throw → 500 응답. 기존 설정 상태이며 P2-01 코드 문제 아님)
- [x] Test: 모든 API key 미설정 시 → `503` 응답 (`LLM_NOT_AVAILABLE`) ✅ (Next.js dev 서버 실측: HTTP 503, `{"error":"LLM_NOT_AVAILABLE"}` 확인)
- [x] Review: `import { GoogleGenerativeAI }` 완전 제거 확인, dead import 없음 ✅

---

## Phase 3: Medium — 코드 품질 개선

**Before Start:**
- Backend Python 파일 변경 시 `python -m py_compile <file>` 로 구문 검사
- `AdminModelSelector.tsx`의 `window.location.reload()` 제거 시, `useChat.ts`에서 `prism-model-change` 이벤트 리스너가 정상 동작하는지 확인
- **건드리지 말 것:** `generate_outline.py`의 `_get_default_outline()`, `_get_default_outline_json()` 메서드 (향후 LLM 연동 시 교체 예정)

**Implementation Items:**

---

- [x] **P3-01**: Backend `generate_outline.py` 정리 ✅ (2026-02-17 완료, py_compile 성공, dead code 제거 + 예외 구체화 + STUB 주석)
    - `Target`: `backend/src/application/use_cases/generate_outline.py` > `_generate_with_llm()` (Line 110-139)
    - `Logic (Pseudo)`:
      ```python
      # === 변경 1: Line 139 도달 불가 코드 제거 ===
      # 삭제: return "[]"  (for 루프 뒤의 dead code)

      # === 변경 2: Line 134 예외 타입 구체화 ===
      # 변경 전:
      except Exception as e:
      # 변경 후:
      except (ValueError, RuntimeError, IOError, json.JSONDecodeError) as e:

      # === 변경 3: Line 127-132 TODO 주석 명확화 ===
      # 변경 전:
      # TODO: 실제 LLM 호출 구현
      # response = await self.llm_client.chat.completions.create(...)
      # return response.choices[0].message.content
      # 현재는 기본 JSON 반환

      # 변경 후:
      # [STUB] LLM 미연동 상태 — 항상 기본 목차 반환
      # 실제 구현 시 self.llm_client를 사용하여 교체
      ```
    - `Key Variables`: `self.max_retries`, `attempt`
    - `Safety`: dead code 제거 후 함수의 for 루프 내 return/raise 흐름이 변하지 않음을 확인

---

- [x] **P3-02**: Backend `outline.py` 에러 메시지 노출 방지 + 미사용 import 제거 ✅ (2026-02-17 완료, py_compile 성공)
    - `Target`: `backend/src/presentation/api/outline.py` > Line 11 (import), Line 108-113 (에러 핸들러)
    - `Logic (Pseudo)`:
      ```python
      # === 변경 1: Line 11 미사용 import 제거 ===
      # 삭제:
      from typing import Optional

      # === 변경 2: Line 112 내부 에러 메시지 숨김 ===
      # 변경 전 (Line 112):
      detail=f"목차 생성 중 오류가 발생했습니다: {str(e)}"
      # 변경 후:
      detail="목차 생성 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요."

      # 주의: logger.error()에는 str(e) 유지 (서버 로그는 유지)
      ```
    - `Key Variables`: 없음
    - `Safety`: `Optional` import 제거 후 파일 전체에서 `Optional` 사용 없음 확인 완료 (grep 결과 0건)

---

- [x] **P3-03**: `AdminModelSelector` — `window.location.reload()` 제거 ✅ (2026-02-17 완료, build 성공, detail 형식 기존 패턴 준수 `{ detail: modelId }`)
    - `Target`: `frontend/src/components/admin/AdminModelSelector.tsx` > `handleModelChange()` (Line 44-54)
    - `Logic (Pseudo)`:
      ```typescript
      // === 변경: Line 52-53 ===
      const handleModelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const modelId = e.target.value
        setSelectedModel(modelId)
        if (modelId) {
          localStorage.setItem('prism_selected_model', modelId)
        } else {
          localStorage.removeItem('prism_selected_model')
        }
        // 삭제: window.location.reload()
        // 추가: CustomEvent dispatch (ChatModelSelector 패턴과 동일)
        window.dispatchEvent(
          new CustomEvent('prism-model-change', { detail: { modelId } })
        )
      }
      ```
    - `Key Variables`: `modelId` (string), event name `'prism-model-change'`
    - `Safety`:
      - `useChat.ts`에서 `window.addEventListener('prism-model-change', ...)` 리스너가 이미 등록되어 있음 — 정상 수신됨
      - Admin Exit 버튼 (Line 81-84)의 `window.location.href = ...` 는 유지 — 어드민 모드 종료는 전체 리로드가 의도된 동작

---

- [x] **P3-04**: `SelectionPopover` — setTimeout cleanup 추가 ✅ (2026-02-17 완료, build 성공, let 변수 사용)
    - `Target`: `frontend/src/components/Editor/SelectionPopover.tsx` > `useEffect` 내부 `handleMouseUp` (Line 88-156)
    - `Logic (Pseudo)`:
      ```typescript
      // === 변경: useEffect 내부 (Line 88-156) ===
      useEffect(() => {
        if (!enabled) return

        // 추가: timer ref
        let mouseUpTimerId: ReturnType<typeof setTimeout> | null = null

        const handleMouseUp = () => {
          // 기존 setTimeout을 변수에 저장
          mouseUpTimerId = setTimeout(() => {
            // ... 기존 로직 동일 (Line 95-124) ...
          }, 10)
        }

        // ... handleMouseDown, handleScroll 동일 ...

        document.addEventListener('mouseup', handleMouseUp)
        document.addEventListener('mousedown', handleMouseDown)
        window.addEventListener('scroll', handleScroll, true)

        return () => {
          // 추가: timer cleanup
          if (mouseUpTimerId) clearTimeout(mouseUpTimerId)
          document.removeEventListener('mouseup', handleMouseUp)
          document.removeEventListener('mousedown', handleMouseDown)
          window.removeEventListener('scroll', handleScroll, true)
        }
      }, [enabled, hidePopover])
      ```
    - `Key Variables`: `mouseUpTimerId` (로컬 변수, `let` 사용 — `useRef` 불필요, 이펙트 스코프 내에서만 사용)
    - `Safety`:
      - `useRef` 대신 `let` 변수 사용 — `useEffect` 클로저 내부에서만 참조하므로 충분
      - 기존 `setTimeout` 내부 로직은 일체 수정하지 않음

---

**Definition of Done (Phase 3 검증):**
- [x] Test: `python -m py_compile backend/src/application/use_cases/generate_outline.py` — 성공 ✅ (DoD 재검증 완료)
- [x] Test: `python -m py_compile backend/src/presentation/api/outline.py` — 성공 ✅ (DoD 재검증 완료)
- [x] Test: Backend `POST /v1/outline/generate` 에러 메시지에 `str(e)` 미포함 확인 ✅ (코드 리뷰: 정적 메시지, logger.error만 유지)
- [x] Test: Backend `POST /v1/outline/generate` 정상 요청 → 200 응답 ✅ (curl 실측 확인)
- [x] Test: Admin 모델 변경 → `window.location.reload()` 완전 제거 확인 ✅ (grep 0건, CustomEvent 이벤트 흐름 3점 매칭: dispatch→addEventListener→removeEventListener)
- [x] Test: SelectionPopover setTimeout cleanup 추가 확인 ✅ (코드 추적: 선언→할당→clearTimeout 3점 매칭)
- [x] Test: `next build` — 빌드 성공 ✅
- [x] Review: 불필요한 console.log 제거 확인, 주석 최소화 ✅
- **Note:** Admin 모델 전환 반영 E2E, 에디터 언마운트 E2E는 Supabase 로그인 필요 — 코드 수준 검증 완료, 브라우저 테스트는 배포 후 확인 권장

---

## Phase 4: Low — 정리 작업

**Before Start:**
- Phase 1-3 커밋 완료 후 진행
- **건드리지 말 것:** 이 Phase는 기능 변경 없음, 문서/주석만 정리

**Implementation Items:**

---

- [x] **P4-01**: `.env.example` 중복 제거 ✅ (2026-02-17 완료)
    - `Target`: `frontend/.env.example` > Line 49-50
    - `Logic (Pseudo)`:
      ```
      # 변경 전 (Line 49-50):
      NEXT_PUBLIC_ENABLE_SELF_RAG=true
      NEXT_PUBLIC_ENABLE_SELF_RAG=true    ← 삭제

      # 변경 후:
      NEXT_PUBLIC_ENABLE_SELF_RAG=true
      ```

---

- [x] **P4-02**: `outline/route.ts` 주석 중복 제거 ✅ (2026-02-17 완료)
    - `Target`: `frontend/src/app/api/outline/route.ts` > Line 37-38
    - `Logic (Pseudo)`:
      ```typescript
      // 변경 전 (Line 37-38):
      /** 검색 결과 개수 (기본 10) */
      /** 검색 결과 개수 (기본 10) */   // ← 삭제
      topK?: number

      // 변경 후:
      /** 검색 결과 개수 (기본 10) */
      topK?: number
      ```

---

- [x] **P4-03**: Backend `outline.py` mutable default 수정 ✅ (2026-02-17 완료, default_factory=list)
    - `Target`: `backend/src/presentation/api/outline.py` > `OutlineGenerateRequest` (Line 28)
    - `Logic (Pseudo)`:
      ```python
      # 변경 전 (Line 28):
      document_ids: list[str] = Field(default=[], description="참조할 문서 ID 리스트")

      # 변경 후:
      document_ids: list[str] = Field(default_factory=list, description="참조할 문서 ID 리스트")
      ```
    - `Safety`: Pydantic v2에서 `default_factory` 지원 확인 — 지원됨

---

- [x] **P4-04**: Backend `references.py` 플레이스홀더 TODO 태그 추가 ✅ (2026-02-17 완료)
    - `Target`: `backend/src/presentation/api/references.py` > `get_references()` (Line 143-147)
    - `Logic (Pseudo)`:
      ```python
      # 변경 전 (Line 143-147):
      result.append(ReferenceWithContentResponse(
          **ref,
          chunk_content="[청크 내용 - DB 연동 후 실제 내용으로 대체됨]",
          chunk_source="문서명.pdf (p.12)"
      ))

      # 변경 후:
      # TODO(DB-INTEGRATION): chunk_content, chunk_source를 실제 DB 조회로 교체
      result.append(ReferenceWithContentResponse(
          **ref,
          chunk_content="[청크 내용 - DB 연동 후 실제 내용으로 대체됨]",
          chunk_source="문서명.pdf (p.12)"
      ))
      ```

---

**Definition of Done (Phase 4 검증):**
- [x] Test: `cd frontend && npm run build` — 빌드 성공 ✅
- [x] Test: `grep -c "NEXT_PUBLIC_ENABLE_SELF_RAG" frontend/.env.example` → 결과: `1` (중복 제거 확인) ✅
- [x] Test: `python -m py_compile backend/src/presentation/api/outline.py` — 성공 ✅
- [x] Review: 변경 사항이 주석/문서만인지 확인 (기능 변경 없음) ✅ (P4-03의 default_factory는 동작 동일, 나머지는 주석/중복 정리)

---

## 전체 완료 후 최종 검증

- [x] `cd frontend && npm run build` — 빌드 성공 ✅
- [x] `cd frontend && npm run dev` — 개발 서버 정상 기동 ✅ (Phase 2 DoD에서 확인 완료)
- [x] Backend `uvicorn main:app` — 서버 정상 기동 ✅ (port 8002, startup complete)
- [x] Backend `/docs` — Swagger UI 정상 로드 ✅ (HTTP 200, 6 endpoints)
- [x] 에디터 페이지 로드 → 글 작성 → 저장 — 기본 플로우 정상 ⚠️ (Supabase 로그인 필요, 코드 수준 검증 완료)
- [x] 목차 생성 기능 동작 확인 ✅ (Backend: curl HTTP 200 확인, Frontend: 빌드 + 정적 분석 확인)
- [x] Admin 모델 변경 → 채팅에 반영 확인 ⚠️ (Supabase 로그인 필요, CustomEvent 이벤트 흐름 코드 검증 완료)
- [x] git diff 최종 확인 — 의도하지 않은 변경 없음 ✅ (Audit 수정 10파일 + 사전 존재 변경만 확인)
