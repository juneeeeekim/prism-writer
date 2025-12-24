# 20251223_ChatHistoryManagement_Checklist (v2 - 최적화 버전)

## 📋 문서 개요

- **버전**: v2 (최적화 전략 반영)
- **최종 수정**: 2024-12-25
- **상태**: 계획 중

---

## 1. 파일 구성 및 근거

**결정**: **단일 파일 구성** (`20251223_ChatHistoryManagement_Checklist.md`)

**근거**:

1. **의존성 관리**: DB 스키마 → API → UI 순서로 진행해야 하며, 이 의존성을 한 문서에서 추적하는 것이 효율적입니다.
2. **협업 효율성**: 시니어(DB/API), 주니어(UI/검증), UX(디자인) 담당자가 전체 흐름을 파악해야 누락을 방지할 수 있습니다.
3. **Phase 간 연결성**: 각 Phase가 이전 단계에 의존하므로 한 문서에서 순차적으로 관리합니다.

---

## 🛡️ 위험 완화 전략 (v2 추가)

| 위험 요소           | 완화 전략                    | 담당               |
| ------------------- | ---------------------------- | ------------------ |
| DB 부하 증가        | 메시지 30일 보관 + 자동 정리 | 🗄️ DB 아키텍트     |
| 기존 코드 변경 위험 | API v2 분리 + Adapter 패턴   | 🔧 백엔드 엔지니어 |
| 성능 저하           | 비동기 저장 + SWR 캐싱       | ⚡ 성능 엔지니어   |
| 마이그레이션 복잡성 | 점진적 도입 + 온보딩 모달    | 🎨 UX/UI 디자이너  |

---

## Phase 0: 인프라 준비 [Senior Dev] (신규)

**목표**: Feature Flag 및 성능 최적화 인프라를 구축합니다.

### 영향받을 수 있는 기존 기능

- 없음 (신규 인프라 추가)

### 0-1. Feature Flag 설정 ✅

- **파일**: `frontend/src/lib/features.ts` (신규 생성)
- **연결**: 모든 Phase에서 이 플래그를 참조

- [x] **환경 변수 추가**
  ```env
  NEXT_PUBLIC_ENABLE_CHAT_HISTORY=false
  NEXT_PUBLIC_ENABLE_CHAT_HISTORY_UI=false
  NEXT_PUBLIC_ENABLE_CHAT_SESSION_LIST=false
  ```
- [x] **Config 유틸리티 생성**
  - 파일: `frontend/src/lib/features.ts`
  - `FEATURES.CHAT_HISTORY_SAVE`, `CHAT_HISTORY_UI`, `CHAT_SESSION_LIST`
  - `isFeatureEnabled()`, `getEnabledFeatures()` 헬퍼 함수 포함
- [x] **품질 체크**:
  - [x] Stage별 분리 (SAVE → UI → SESSION_LIST)
  - [x] 로컬/프로덕션 분리 가능

### 0-2. SWR 캐싱 설정 ✅

- **파일**: `frontend/src/lib/swr.ts` (신규 생성)
- **연결**: Phase 3 UI에서 사용

- [x] **SWR 글로벌 설정**
  - `revalidateOnFocus: false`
  - `dedupingInterval: 30000` (30초 캐시)
  - `errorRetryCount: 3`
- [x] **세션 목록 fetcher 생성**
  - `useChatSessions()` 훅
  - `useChatMessages(sessionId)` 훅
  - `ChatSession`, `ChatMessage` 타입 정의

### 0-3. 메시지 자동 정리 스케줄러 ✅

- **파일**: `backend/migrations/028_cleanup_function.sql` (신규 생성)
- **연결**: Phase 1 테이블 생성 후 적용
- **참고**: 025, 026 스키마가 이미 존재함

- [x] **30일 이상 메시지 삭제 함수**
  - `cleanup_old_messages(retention_days INTEGER)` 함수
  - 빈 세션도 함께 정리
  - pg_cron 스케줄 예시 포함
- [ ] **Supabase Scheduled Functions 설정** (Pro 플랜 필요, 옵션)

### Phase 0 검증 체크리스트

- [x] **Syntax 오류 확인**: `npx tsc --noEmit` → **0개**
- [ ] **Feature Flag 작동 확인**: 로컬에서 `FEATURES.CHAT_HISTORY_SAVE` 값 확인
- [ ] **SWR 설정 적용 확인**: 콘솔에서 캐시 동작 확인

---

## Phase 1: 데이터베이스 스키마 설계 [Senior Dev]

**목표**: Supabase에 대화 세션 및 메시지를 저장할 테이블을 생성합니다.

### 영향받을 수 있는 기존 기능

- 사용자 인증 (`users` 테이블과 FK 관계)
- 기존 RAG 문서 테이블 (`rag_documents`와 별개)

### 1-1. 대화 세션 테이블 (`chat_sessions`) 생성

- **파일**: `backend/migrations/025_chat_sessions.sql` (신규 생성)
- **연결**: 향후 1-2의 `chat_messages`가 이 테이블을 참조함

- [ ] **테이블 스키마 작성**
  ```sql
  CREATE TABLE chat_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT DEFAULT '새 대화',
    model_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  );
  ```
- [ ] **인덱스 생성**: `user_id`, `created_at` 기준
- [ ] **RLS 정책**: 본인 세션만 CRUD 가능
- [ ] **품질 체크**:
  - [ ] 명확한 컬럼명
  - [ ] FK 제약조건 설정
  - [ ] CASCADE 삭제 설정

### 1-2. 대화 메시지 테이블 (`chat_messages`) 생성

- **파일**: `backend/migrations/026_chat_messages.sql` (신규 생성)
- **연결**: 1-1의 `chat_sessions`를 FK로 참조

- [ ] **테이블 스키마 작성**
  ```sql
  CREATE TABLE chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES chat_sessions(id) ON DELETE CASCADE,
    role TEXT CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    model_id TEXT,
    tokens_used INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
  );
  ```
- [ ] **인덱스 생성**: `session_id`, `created_at` 기준
- [ ] **RLS 정책**: 세션 소유자만 CRUD 가능
- [ ] **품질 체크**:
  - [ ] CHECK 제약조건 (role 값 검증)
  - [ ] 성능: 메시지가 많아질 경우를 대비한 인덱스

### Phase 1 검증 체크리스트

- [ ] **Syntax 오류 확인**: Supabase SQL Editor에서 쿼리 실행
- [ ] **테이블 생성 확인**: `SELECT * FROM chat_sessions LIMIT 1;`
- [ ] **RLS 동작 확인**: 다른 사용자 데이터 접근 불가 테스트
- [ ] **기존 기능 정상 동작**: 로그인, RAG 업로드 정상 확인

---

## Phase 2: API 엔드포인트 구현 [Senior Dev] (⚠️ v2 수정)

**목표**: 대화 세션 및 메시지 CRUD를 위한 **새 API 버전**을 생성합니다.

> ⚠️ **v2 변경사항**: 기존 `/api/chat` 수정하지 않고, 새 `/api/chat/v2` 생성

### 영향받을 수 있는 기존 기능

- ~~기존 `/api/chat`~~ → **수정하지 않음** ✅
- 인증 미들웨어 (공유 사용)

### 2-1. 대화 세션 API 생성

- **파일**: `frontend/src/app/api/chat/sessions/route.ts` (신규 생성)
- **연결**: Phase 1의 `chat_sessions` 테이블 사용

- [ ] **GET**: 사용자의 모든 세션 목록 조회
  - [ ] 정렬: `updated_at DESC` (최근 순)
  - [ ] 제한: 최근 50개
- [ ] **POST**: 새 세션 생성
  - [ ] 기본 제목: "새 대화" 또는 첫 메시지 요약
- [ ] **품질 체크**:
  - [ ] 인증 체크 (`session.user.id`)
  - [ ] 에러 응답 형식 일관성

### 2-2. 개별 세션 API 생성

- **파일**: `frontend/src/app/api/chat/sessions/[id]/route.ts` (신규 생성)
- **연결**: 2-1과 동일한 테이블

- [ ] **GET**: 특정 세션의 모든 메시지 조회
- [ ] **PATCH**: 세션 제목 수정
- [ ] **DELETE**: 세션 삭제 (메시지도 CASCADE)
- [ ] **품질 체크**:
  - [ ] 세션 소유권 확인
  - [ ] 404 처리

### 2-3. 새 채팅 API v2 생성 (⚠️ v2 신규)

- **파일**: `frontend/src/app/api/chat/v2/route.ts` (신규 생성)
- **연결**: Phase 2-1, 2-2의 API와 연동
- **목적**: 기존 `/api/chat` 보존, 새 API에서 세션 기반 로직 구현

- [ ] **기존 `/api/chat` 로직 복사 + 세션 저장 추가**
- [ ] **요청에서 `session_id` 파라미터 추가**
- [ ] **비동기 저장 패턴 적용** (⚡ 성능 최적화)
  ```typescript
  // 응답 시간에 영향 없이 저장
  saveMessageAsync(sessionId, message).catch(console.error);
  ```
- [ ] **사용자 메시지 저장**: 요청 시점에 저장
- [ ] **AI 응답 저장**: 스트림 완료 후 비동기 저장
- [ ] **품질 체크**:
  - [ ] Feature Flag 체크 (`FEATURES.CHAT_HISTORY_SAVE`)
  - [ ] 토큰 사용량 기록

### Phase 2 검증 체크리스트

- [ ] **Syntax 오류 확인**: `npm run build`
- [ ] **기존 API 정상 동작**: `/api/chat` 변경 없음 확인
- [ ] **새 API 테스트**: Postman 또는 curl로 v2 CRUD 테스트
  - [ ] `POST /api/chat/sessions` → 세션 생성
  - [ ] `GET /api/chat/sessions` → 목록 조회
  - [ ] `POST /api/chat/v2` → 메시지 저장 + AI 응답
  - [ ] `DELETE /api/chat/sessions/{id}` → 삭제
- [ ] **성능 확인**: 응답 시간 변화 측정

---

## Phase 3: UI 컴포넌트 구현 [Junior Dev + UX/UI Dev] (⚠️ v2 수정)

**목표**: 대화 목록 사이드바, 새 대화 버튼, 세션 관리 UI를 **기존 코드 최소 수정**으로 구현합니다.

> ⚠️ **v2 변경사항**: Adapter 패턴으로 기존 ChatTab 보존, 새 래퍼 컴포넌트 생성

### 영향받을 수 있는 기존 기능

- ~~`ChatTab.tsx` (세션 기반으로 리팩토링)~~ → **수정 최소화** ✅
- `AssistantPanel.tsx` (레이아웃 변경 가능)

### 3-1. 대화 목록 사이드바 컴포넌트 생성 [UX/UI Dev]

- **파일**: `frontend/src/components/Assistant/ChatSessionList.tsx` (신규 생성)
- **연결**: Phase 2-1의 `GET /api/chat/sessions` 사용

- [ ] **SWR 캐싱 적용** (⚡ 성능 최적화)
  ```typescript
  const { data: sessions } = useSWR("/api/chat/sessions", fetcher, swrConfig);
  ```
- [ ] **세션 목록 표시**
  - [ ] 제목, 날짜, 모델명 표시
  - [ ] 최신순 정렬
- [ ] **새 대화 버튼**
  - [ ] 클릭 시 `POST /api/chat/sessions` 호출
  - [ ] SWR mutate로 즉시 UI 업데이트
- [ ] **삭제 버튼**
  - [ ] 확인 대화상자 표시
  - [ ] `DELETE /api/chat/sessions/{id}` 호출
- [ ] **품질 체크**:
  - [ ] `aria-label` 접근성
  - [ ] 로딩 상태 표시
  - [ ] 빈 목록 시 안내 문구

### 3-2. ChatTabWithHistory 어댑터 생성 (⚠️ v2 신규)

- **파일**: `frontend/src/components/Assistant/ChatTabWithHistory.tsx` (신규 생성)
- **연결**: 기존 `ChatTab.tsx` 래핑, Phase 2-3의 `/api/chat/v2` 사용
- **목적**: 기존 ChatTab 수정 최소화

- [ ] **Adapter 패턴 구현**

  ```typescript
  export function ChatTabWithHistory({ sessionId, ...props }) {
    const { messages, sendMessage } = useChatSession(sessionId);

    // 기존 ChatTab을 감싸서 확장
    return (
      <ChatTab messages={messages} onSendMessage={sendMessage} {...props} />
    );
  }
  ```

- [ ] **useChatSession 훅 생성**
  - [ ] 세션 ID로 메시지 불러오기
  - [ ] 메시지 전송 시 v2 API 호출
- [ ] **세션 변경 시 메시지 목록 갱신**
- [ ] **품질 체크**:
  - [ ] 기존 스트리밍 로직 유지
  - [ ] 새로고침 시 마지막 세션 복원 (localStorage)

### 3-3. AssistantPanel 통합 [Junior Dev]

- **파일**: `frontend/src/components/Assistant/AssistantPanel.tsx` (수정)
- **연결**: 3-1의 `ChatSessionList`, 3-2의 `ChatTabWithHistory`

- [ ] **Feature Flag 조건부 렌더링**
  ```typescript
  {
    FEATURES.CHAT_SESSION_LIST ? (
      <ChatTabWithHistory sessionId={currentSession} />
    ) : (
      <ChatTab /> // 기존 유지
    );
  }
  ```
- [ ] **레이아웃 변경**: 좌측에 세션 목록, 우측에 채팅
- [ ] **세션 선택 핸들러 연결**
- [ ] **품질 체크**:
  - [ ] 반응형 디자인 (모바일에서 토글)
  - [ ] 기존 탭 (참고자료, 목차 제안) 정상 동작

### 3-4. 온보딩 모달 생성 [UX/UI Dev] (⚠️ v2 신규)

- **파일**: `frontend/src/components/Assistant/ChatHistoryOnboarding.tsx` (신규 생성)
- **연결**: Phase 3-3에서 첫 사용 시 표시

- [ ] **온보딩 모달 UI**
  ```
  ┌────────────────────────────────────────────┐
  │  🎉 새로운 기능!                           │
  │                                            │
  │  이제 대화가 자동으로 저장됩니다.          │
  │  왼쪽 사이드바에서 이전 대화를             │
  │  언제든 찾아볼 수 있어요.                  │
  │                                            │
  │  [시작하기] [나중에]                        │
  └────────────────────────────────────────────┘
  ```
- [ ] **localStorage로 "다시 보지 않기" 저장**
- [ ] **품질 체크**:
  - [ ] 모바일 반응형
  - [ ] 접근성 (키보드 탐색, aria-modal)

### Phase 3 검증 체크리스트

- [ ] **Syntax 오류 확인**: `npm run build`
- [ ] **Feature Flag OFF 시 기존 동작 확인**:
  - [ ] ChatTab 그대로 동작
  - [ ] 세션 목록 숨김
- [ ] **Feature Flag ON 시 새 기능 확인**:
  - [ ] 새 대화 생성 → 메시지 전송 → 새로고침 → 대화 유지 확인
  - [ ] 세션 삭제 → 목록에서 제거 확인
  - [ ] 세션 전환 → 메시지 목록 변경 확인
- [ ] **기존 기능 정상 동작**:
  - [ ] Admin Mode 모델 선택 정상
  - [ ] RAG 검색 정상
  - [ ] 참고자료 탭 정상

---

## Phase 4: 점진적 롤아웃 [All] (⚠️ v2 신규)

**목표**: 안전하게 단계적으로 기능을 활성화합니다.

### 4-1. Stage 1: 데이터 저장만 활성화

- [ ] `ENABLE_CHAT_HISTORY=true` 설정
- [ ] `CHAT_HISTORY_SAVE=true`, 나머지 `false`
- [ ] 2주간 모니터링 (DB 부하, 에러율)

### 4-2. Stage 2: UI 활성화

- [ ] `CHAT_HISTORY_UI=true` 설정
- [ ] 온보딩 모달 표시
- [ ] 사용자 피드백 수집

### 4-3. Stage 3: 전체 활성화

- [ ] `CHAT_SESSION_LIST=true` 설정
- [ ] 세션 목록 사이드바 표시
- [ ] 기존 `/api/chat`을 v2로 점진적 전환 검토

### Phase 4 검증 체크리스트

- [ ] **Stage별 에러율 모니터링**
- [ ] **사용자 피드백 수집**
- [ ] **성능 지표 확인** (응답 시간, DB 쿼리 수)

---

## 📝 작업 완료 서명

- [ ] Senior Developer: **\_\_**
- [ ] Junior Developer: **\_\_**
- [ ] UX/UI Designer: **\_\_**
- [ ] DB Architect: **\_\_**
- [ ] Performance Engineer: **\_\_**

---

## 🛑 롤백 전략

### 즉시 롤백 (1분 내)

```bash
# Vercel 환경 변수에서 플래그 비활성화
NEXT_PUBLIC_ENABLE_CHAT_HISTORY=false
```

### 코드 롤백 (5분 내)

```bash
git revert <commit-hash>
git push origin main
```

### 데이터 보존

- 롤백해도 DB 데이터는 유지됨
- 나중에 기능 재활성화 시 복원 가능

---

# 🔍 C.O.R.E + S/D 분석 보고서 (JeDebug)

## Context Setting

- **Project Domain**: PrismLM (LLM 기반 글쓰기 도구) - AI 채팅 대화 기록 관리 시스템 신규 구축
- **Tech Stack**: Next.js 14, Supabase (PostgreSQL + Auth), Vercel Serverless, SWR
- **Scope**: Core Logic Upgrade + Feature Addition
- **Risk Level**: **Mid** - 채팅 기능 변경, 데이터베이스 스키마 추가

---

## C.O.R.E 분석 요약

### 1. C (Compatibility - 호환성) ✅

| 항목                 | 분석                              | 위험도 |
| -------------------- | --------------------------------- | ------ |
| 기존 `/api/chat` API | 수정하지 않고 `/api/chat/v2` 분리 | 🟢 Low |
| 기존 `ChatTab.tsx`   | Adapter 패턴으로 래핑, 최소 수정  | 🟢 Low |
| 프론트엔드 상태 관리 | Feature Flag로 신/구 분리         | 🟡 Mid |

### 2. O (Operational - 운영) ⚠️

| 구간          | 변경 후               | 완화책                            |
| ------------- | --------------------- | --------------------------------- |
| DB 쿼리 증가  | 세션/메시지 조회 추가 | SWR 30초 캐싱                     |
| Supabase 한계 | 동시 연결 100개       | 모니터링 + 필요 시 Pro 업그레이드 |

### 3. R (Robustness - 견고성) ✅

- Dual Write 해당 없음 (신규 테이블)
- CASCADE 삭제 시 복구 불가 → 삭제 전 확인 모달 필수

### 4. E (Evolution - 유지보수성) ✅

- Clean Architecture: API v2 분리, Adapter 패턴으로 우수
- 권장: 비즈니스 로직을 서비스 레이어로 분리

### 5. S (Security - 보안) ⚠️

| 취약점                          | 완화책                                       |
| ------------------------------- | -------------------------------------------- |
| 세션 ID 조작으로 타인 대화 접근 | API 레벨에서 세션 소유권 이중 검증 추가 필요 |

### 6. D (Deployment - 배포) ✅

- Feature Flag로 즉시 비활성화 가능
- Vercel Preview Deployment로 Canary 테스트 가능

---

## 🚨 위험 요소 및 디버깅 포인트 (Risk Table)

|  중요도  | 예상되는 충돌/회귀                       | 원인 분석                            | 해결/안정화 가이드                                        |
| :------: | :--------------------------------------- | :----------------------------------- | :-------------------------------------------------------- |
| **High** | 세션 ID 조작으로 타인 대화 접근          | RLS만으로 불충분, API 레벨 검증 누락 | **API 라우트에서 세션 소유권 이중 검증 추가**             |
| **Mid**  | SWR 캐시로 인해 새 세션이 목록에 안 보임 | `mutate()` 호출 누락                 | **세션 생성/삭제 후 `mutate('/api/chat/sessions')` 호출** |
| **Mid**  | 비동기 저장 실패 시 메시지 손실          | Fire-and-Forget 패턴의 약점          | **저장 실패 시 localStorage 백업 + 재시도 로직**          |
| **Low**  | Supabase Free Tier 한계 도달             | 동시 연결 100개 초과                 | **연결 풀링 최적화, 필요 시 Pro 업그레이드**              |

---

## 🧪 필수 테스트 및 검증 시나리오 (Verification Plan)

### Regression Test (기존 기능 보존)

- [ ] Feature Flag OFF 시 기존 ChatTab 정상 작동
- [ ] 기존 `/api/chat` 응답 형식 변경 없음
- [ ] Admin Mode 모델 선택 정상 작동
- [ ] RAG 검색 기능 정상 작동
- [ ] 참고자료/목차제안 탭 정상 작동

### Migration Test (신규 기능 검증)

- [ ] 세션 생성 → 메시지 전송 → 새로고침 → 대화 복원 확인
- [ ] 다른 사용자 세션 접근 시 403 에러 확인
- [ ] 세션 삭제 시 관련 메시지 CASCADE 삭제 확인
- [ ] 세션 제목 수정 정상 작동

### Load Test (성능 검증)

- [ ] 100개 메시지 세션 로드 시간 < 500ms
- [ ] 50개 세션 목록 조회 시간 < 300ms
- [ ] 동시 10명 사용자 채팅 시 에러 없음

---

## ❓ 추가 확인 필요사항 (Unknowns)

1. **Supabase 요금제 한계**

   - [ ] 현재 Free Tier? Pro Tier?
   - [ ] 동시 연결 수, 월 API 호출 한도 확인

2. **기존 localStorage 대화 마이그레이션**

   - [ ] 기존 localStorage에 저장된 대화가 있는가?
   - [ ] 있다면 DB로 마이그레이션? 또는 무시?

3. **세션 제목 자동 생성 로직**

   - [ ] 첫 메시지 기반 제목 생성?
   - [ ] AI로 제목 생성? (추가 API 비용)

4. **메시지 30일 자동 삭제 정책**
   - [ ] 사용자에게 삭제 정책 고지 필요?
   - [ ] Premium 사용자 더 긴 보관 기간?

---

## ✅ 최종 의견 (Conclusion)

### Confidence: **High**

### Go / No-Go Decision: ✅ **Ready to Build**

**근거:**

1. **위험 관리 우수**: API v2 분리, Adapter 패턴, Feature Flag로 기존 코드 완전 보존
2. **성능 최적화**: 비동기 저장, SWR 캐싱으로 응답 시간 영향 없음
3. **롤백 전략 명확**: 30초 내 Feature Flag로 즉시 비활성화 가능
4. **점진적 배포**: Stage 1→2→3 단계별 롤아웃으로 위험 분산

**조건부 승인 사항:**

- [ ] ⚠️ **세션 소유권 이중 검증** API 코드 추가 필요
- [ ] ⚠️ **비동기 저장 실패 시 재시도 로직** 추가 권장
- [ ] ⚠️ **Supabase 요금제 및 한도** 확인 필요
