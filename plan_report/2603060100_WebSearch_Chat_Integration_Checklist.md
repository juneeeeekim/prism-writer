# PRISM Writer - AI 채팅 웹 검색 통합 구현 체크리스트

> **문서 ID:** 2603060100-CL
> **작성일:** 2026-03-06
> **기반 설계:** `2603060100_WebSearch_Chat_Integration_Plan.md`
> **작성자:** Claude Opus 4.6 (기술 리더)
> **상태:** 구현 완료 (Phase 1~6)

---

## Phase 1: Brave Search API 클라이언트 구축

**Before Start:**
- :warning: `tavilyClient.ts` (299줄) 패턴을 참고하되 **수정하지 말 것** — Deep Scholar 탭이 별도 운영 중
- :warning: `BRAVE_API_KEY` 환경변수가 `.env.local`에 설정되어 있는지 확인 (이미 완료됨)
- :warning: `resultSummarizer.ts`의 `detectTrustBadge()` 함수는 재활용 대상 — 수정 아닌 import

**Implementation Items:**

- [x] **P1-01**: Brave 타입 정의
    - `Target`: `frontend/src/lib/research/braveClient.ts` > 신규 파일 상단
    - `Key Variables`: `BraveSearchOptions`, `BraveWebResult`, `BraveSearchResponse`

- [x] **P1-02**: `searchBrave()` 메인 함수 구현
    - `Target`: `braveClient.ts` > `searchBrave()`
    - `Key Variables`: `BRAVE_API_URL`, `apiKey`, `params`, `AbortSignal.timeout(5000)`

- [x] **P1-03**: export 구성
    - `Target`: `braveClient.ts` > 파일 하단

**Definition of Done (검증):**
- [x] Test: `BRAVE_API_KEY` 설정 후 `searchBrave({ query: 'AI 트렌드' })` 호출 → 빌드 통과
- [x] Test: `BRAVE_API_KEY` 미설정 시 → 빈 배열 반환, 에러 없음 (graceful skip)
- [x] Review: `logger` import 경로 — `@/lib/utils/logger` 확인, (context, message, data?) 시그니처 준수

---

## Phase 2: 통합 웹 검색 서비스 구축

**Before Start:**
- :warning: `resultSummarizer.ts`의 `detectTrustBadge(url)` 함수를 import하여 재활용
- :warning: 기존 `tavilyClient.ts`의 `searchTavily()` / `searchAcademic()` 시그니처 확인 — 호출 방식 유지
- :warning: `queryGenerator.ts`의 `generateSearchQuery()` 활용 가능하나, Phase 2에서는 원문 쿼리 직접 전달

**Implementation Items:**

- [x] **P2-01**: 통합 타입 정의
    - `Target`: `frontend/src/lib/services/chat/webSearchService.ts` > 신규 파일 상단

- [x] **P2-02**: 학술 키워드 감지 함수 `shouldSearchAcademic()`

- [x] **P2-03**: Brave 결과 변환 함수 `convertBraveResults()`

- [x] **P2-04**: Tavily 결과 변환 함수 `convertTavilyResults()`

- [x] **P2-05**: `performWebSearch()` 메인 함수

- [x] **P2-06**: export 구성

**Definition of Done (검증):**
- [x] Review: import 경로 오타 없음 확인 (tsc --noEmit 0 에러)

---

## Phase 3: Feature Flags + 환경 설정

**Before Start:**
- :warning: `featureFlags.ts` (616줄) 구조 숙지 — `FEATURE_FLAGS` 객체 내부에 추가
- :warning: 기존 `ENABLE_DEEP_SCHOLAR` 플래그와 충돌 없도록 네이밍 주의
- :warning: `.env.example`에 이미 `BRAVE_API_KEY` 항목 추가 완료 (Phase 1 전에 처리됨)

**Implementation Items:**

- [x] **P3-01**: `ENABLE_WEB_SEARCH_IN_CHAT` 플래그 추가

- [x] **P3-02**: `ENABLE_BRAVE_SEARCH` 플래그 추가

- [x] **P3-03**: `ENABLE_TAVILY_IN_CHAT` 플래그 추가

- [x] **P3-04**: `BooleanFeatureFlags` 타입에 새 플래그 추가
    - 참고: `BooleanFeatureFlags`는 `FEATURE_FLAGS` 객체에서 자동 유도됨 — 수동 추가 불필요

**Definition of Done (검증):**
- [x] Review: `isFeatureEnabled('ENABLE_WEB_SEARCH_IN_CHAT')` 타입 에러 없음

---

## Phase 4: Chat API 통합 (핵심)

**Before Start:**
- :warning: `route.ts` (295줄)의 기존 Parallel Fetch 구조를 유지하며 확장 — 기존 3개 Promise에 1개 추가
- :warning: `promptBuilder.ts` (122줄)의 `buildImprovedSystemPrompt()` 시그니처 변경 — `PromptContext` 인터페이스 확장
- :warning: `ragSearchService.ts`의 `RAGSearchResult` 타입은 **수정하지 않음** — 웹 결과는 별도 경로
- :warning: `chat/index.ts` barrel export에 새 서비스 추가 필요
- :warning: 기존 `[STATUS]🔍 자료 검색 중...` 메시지 뒤에 웹 검색 상태 추가

**Implementation Items:**

- [x] **P4-01**: `chat/index.ts` barrel export에 웹 검색 서비스 추가

- [x] **P4-02**: `PromptContext` 인터페이스에 `webContext` 필드 추가

- [x] **P4-03**: `buildImprovedSystemPrompt()`에 웹 컨텍스트 섹션 추가

- [x] **P4-04**: 웹 검색 결과 → 프롬프트 문자열 변환 헬퍼 `formatWebContext()`

- [x] **P4-05**: `route.ts` Parallel Fetch 확장 — `performWebSearch()` 추가

- [x] **P4-06**: `route.ts` 프롬프트 빌드 시 `webContext` 주입

- [x] **P4-07**: `route.ts` 웹 검색 상태 메시지 추가 (`WEB_SEARCHING`)

- [x] **P4-08**: `route.ts` 메시지 저장 시 웹 출처 메타데이터 포함 (`web_sources`)

**Definition of Done (검증):**
- [x] Review: `Promise.all` 4개 항목 순서와 destructuring 순서 일치 확인

---

## Phase 5: 프론트엔드 웹 출처 표시

**Before Start:**
- :warning: `MessageItem.tsx` (222줄)의 기존 `SourcesPanel` 컴포넌트 구조 참고 — 유사 패턴으로 `WebSourcesPanel` 추가
- :warning: `Message` 타입의 `metadata` 확장 필요 — `web_sources` 필드 추가
- :warning: `useChat.ts` (374줄)의 `STATUS_PREFIX` 필터링 로직 확인 — `🌐` 아이콘 처리 추가
- :warning: 다크모드 호환 CSS 클래스 필수 (`dark:` 접두사)

**Implementation Items:**

- [x] **P5-01**: `Message` 타입에 `web_sources` 메타데이터 추가

- [x] **P5-02**: `WebSourcesPanel` 서브 컴포넌트 구현

- [x] **P5-03**: `MessageItem`에 `WebSourcesPanel` 렌더링 추가

- [x] **P5-04**: `useChat.ts` — `🌐` 상태 메시지 필터링 확인
    - 결과: 기존 `[STATUS]` 접두사 필터링으로 자동 호환 — **코드 변경 불필요**

**Definition of Done (검증):**
- [x] Review: `rel="noopener noreferrer"` 보안 속성 확인

---

## Phase 6: 빌드 검증 및 테스트

**Before Start:**
- :warning: Phase 1~5 모든 체크리스트 완료 후 실행
- :warning: `.env.local`에 `BRAVE_API_KEY`, `ENABLE_WEB_SEARCH=true`, `NEXT_PUBLIC_ENABLE_WEB_SEARCH=true` 확인

**Implementation Items:**

- [x] **P6-01**: TypeScript 타입 체크 — `tsc --noEmit` **에러 0개** 확인

- [x] **P6-02**: Next.js 빌드 검증 — `npm run build` **성공** 확인

- [ ] **P6-03**: 시나리오 A — 일반 웹 검색 질문 (배포 후 수동 테스트)

- [ ] **P6-04**: 시나리오 B — 학술 검색 질문 (배포 후 수동 테스트)

- [ ] **P6-05**: 시나리오 C — 사용자 문서 기반 질문 (배포 후 수동 테스트)

- [ ] **P6-06**: 시나리오 D — Graceful Degradation (배포 후 수동 테스트)

- [ ] **P6-07**: Vercel 환경변수 설정 + 프로덕션 배포

**Definition of Done (검증):**
- [x] `tsc --noEmit` 에러 0개
- [x] `npm run build` 성공
- [ ] 시나리오 A~D 모두 통과 (배포 후)
- [ ] Vercel 프로덕션 배포 후 정상 동작

---

## 수정/생성 파일 총괄

| Phase | 파일 | 작업 | 상태 |
|-------|------|------|------|
| P1 | `frontend/src/lib/research/braveClient.ts` | **신규** | :white_check_mark: |
| P2 | `frontend/src/lib/services/chat/webSearchService.ts` | **신규** | :white_check_mark: |
| P3 | `frontend/src/config/featureFlags.ts` | 수정 | :white_check_mark: |
| P4 | `frontend/src/lib/services/chat/index.ts` | 수정 | :white_check_mark: |
| P4 | `frontend/src/lib/services/chat/promptBuilder.ts` | 수정 | :white_check_mark: |
| P4 | `frontend/src/app/api/chat/route.ts` | 수정 | :white_check_mark: |
| P5 | `frontend/src/components/Assistant/chat/MessageItem.tsx` | 수정 | :white_check_mark: |
| P5 | `frontend/src/hooks/useChat.ts` | 확인 | :white_check_mark: (변경 불필요) |
| P6 | — (검증만) | 빌드+테스트 | :white_check_mark: (빌드 완료) |

**총 항목: 28개 중 23개 완료** (코드 구현 100%, 수동 시나리오 테스트 5개 잔여)

---

**문서 끝**
