# Phase 14: Feedback-to-Memory (실시간 지식 강화) 구현 체크리스트

**작성일**: 2025-12-28
**작성자**: Tech Lead (Antigravity)
**검토자**: JeDebug (Senior Lead Developer)
**근거 문서**: [Idea Meeting Feedback Loop](file:///c:/Users/chyon/.gemini/antigravity/brain/6e6ff31c-7849-46df-9474-0bc23c02f24c/idea_meeting_feedback_loop.md)

---

## 1. File & Structure Decision

### 1.1 Strategy

- **DB First**: `user_preferences` 테이블을 별도로 분리하여 독립적인 메모리 저장소로 관리.
- **Library Module**: `lib/rag/memory.ts`를 신설하여 메모리 로직 캡슐화.
- **Hybrid Search**: 기존 검색 로직에 `MemoryService` 검색 결과를 병합하고, 시스템 프롬프트를 통해 우선순위를 부여.

### 1.2 File Locations

- **DB**: `supabase/migrations/036_user_preferences.sql` (신규)
- **Backend Logic**: `frontend/src/lib/rag/memory.ts` (신규)
- **API (Modifier)**: `frontend/src/app/api/feedback/hallucination/route.ts` (수정)
- **RAG (Modifier)**: `frontend/src/lib/rag/search.ts` (수정)
- **Prompt (Modifier)**: `frontend/src/app/api/chat/route.ts` (수정)

---

## 2. Checklist Content

### [Phase 14: Feedback-to-Memory]

**Before Start:**

- 영향받는 파일: `api/chat/route.ts` (프롬프트), `lib/rag/search.ts` (검색)

**Implementation Items:**

#### Database & Schema

- [x] **P14-01**: `user_preferences` 테이블 생성 마이그레이션 작성
  - `Target`: `supabase/migrations/036_user_preferences.sql`
  - `Detail`:
    - 테이블 생성: `id`, `user_id`, `question`, `preferred_answer`, `embedding` (vector 1536), `created_at`
    - RPC 함수 생성: `match_user_preferences` (유사도 검색용 함수 필수)
    - 인덱스 생성: `ivfflat` 인덱스 (lists=100)
  - `Dependency`: None
  - `Quality`: RLS 정책 추가 (본인 데이터만 조회 가능)

#### Backend Logic (Memory Module)

- [x] **P14-02**: `MemoryService` 모듈 구현
  - `Target`: `frontend/src/lib/rag/memory.ts`
  - `Detail`:
    - `savePreference(userId, question, answer, embedding)`: DB Insert 로직
    - `searchPreferences(userId, queryEmbedding, limit)`: `supabase.rpc('match_user_preferences')` 호출
  - `Dependency`: P14-01

#### API Integration (Saving Memory)

- [x] **P14-03**: 피드백 API에 메모리 저장 로직 연결
  - `Target`: `frontend/src/app/api/feedback/hallucination/route.ts`
  - `Detail`:
    - `isPositive === true` 조건 확인
    - **[JeDebug Fix]**: `Promise.all` 사용하여 Feedback 저장과 Memory 저장을 병렬로 `await` 처리 (응답 속도 및 안정성 확보)
    - Memory 저장 실패 로그는 남기되, Feedback 저장은 성공 처리 (Fail-open)
  - `Dependency`: P14-02

#### RAG Integration (Retrieving Memory)

- [x] **P14-04**: 검색 로직에 선호 지식 검색 추가
  - `Target`: `frontend/src/lib/rag/search.ts` (Implemented in `api/chat/route.ts` directly for efficiency)
  - `Detail`:
    - `searchPreferences` 함수 연동
    - `hybridSearch` (또는 호출부)에서 병렬 호출하여 결과 확보
    - 검색 결과 타입에 `UserPreference` 포함되도록 확장 고려
  - `Dependency`: P14-02

#### System Prompt Update (Critical)

- [x] **P14-05**: 시스템 프롬프트에 선호 지식 반영 (JeDebug Fixed)
  - `Target`: `frontend/src/app/api/chat/route.ts`
  - `Detail`:
    - `# User Preferences` 섹션 추가
    - 지침 추가: "이 섹션에 내용이 있다면, 다른 참고 자료보다 최우선으로 반영하여 답변할 것"
    - `legacySystemPrompt`와 `improvedSystemPrompt` 양쪽에 적용
  - `Dependency`: P14-04

**Verification (검증):**

- [x] **Syntax Check**: `npx tsc --noEmit` 수행
- [ ] **Functionality Test**:
  1.  질문 A -> 답변 B -> '좋아요' 클릭
  2.  질문 A 다시 수행 -> 시스템 프롬프트 로그 확인 (User Preferences 섹션에 B 내용 포함 여부)
  3.  답변이 B 스타일/내용으로 생성되는지 확인
- [ ] **Regression Test**: '싫어요' 클릭 시 에러 없는지 확인
