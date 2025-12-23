# 20251223_ChatHistoryManagement_Checklist

## 1. 파일 구성 및 근거

**결정**: **단일 파일 구성** (`20251223_ChatHistoryManagement_Checklist.md`)

**근거**:

1. **의존성 관리**: DB 스키마 → API → UI 순서로 진행해야 하며, 이 의존성을 한 문서에서 추적하는 것이 효율적입니다.
2. **협업 효율성**: 시니어(DB/API), 주니어(UI/검증), UX(디자인) 담당자가 전체 흐름을 파악해야 누락을 방지할 수 있습니다.
3. **Phase 간 연결성**: 각 Phase가 이전 단계에 의존하므로 한 문서에서 순차적으로 관리합니다.

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

## Phase 2: API 엔드포인트 구현 [Senior Dev]

**목표**: 대화 세션 및 메시지 CRUD를 위한 API 라우트를 생성합니다.

### 영향받을 수 있는 기존 기능

- 기존 `/api/chat` (메시지 저장 로직 추가 필요)
- 인증 미들웨어

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

### 2-3. 메시지 저장 로직 추가

- **파일**: `frontend/src/app/api/chat/route.ts` (기존 수정)
- **위치**: 응답 스트림 완료 후
- **연결**: Phase 2-1, 2-2의 API와 연동

- [ ] **요청에서 `session_id` 파라미터 추가**
- [ ] **사용자 메시지 저장**: 요청 시점에 저장
- [ ] **AI 응답 저장**: 스트림 완료 후 저장
- [ ] **품질 체크**:
  - [ ] 스트림 중 에러 발생 시 롤백 처리
  - [ ] 토큰 사용량 기록

### Phase 2 검증 체크리스트

- [ ] **Syntax 오류 확인**: `npm run build`
- [ ] **API 테스트**: Postman 또는 curl로 CRUD 테스트
  - [ ] `POST /api/chat/sessions` → 세션 생성
  - [ ] `GET /api/chat/sessions` → 목록 조회
  - [ ] `DELETE /api/chat/sessions/{id}` → 삭제
- [ ] **기존 기능 정상 동작**: 기존 채팅 API 정상 작동

---

## Phase 3: UI 컴포넌트 구현 [Junior Dev + UX/UI Dev]

**목표**: 대화 목록 사이드바, 새 대화 버튼, 세션 관리 UI를 구현합니다.

### 영향받을 수 있는 기존 기능

- `ChatTab.tsx` (세션 기반으로 리팩토링)
- `AssistantPanel.tsx` (레이아웃 변경 가능)

### 3-1. 대화 목록 사이드바 컴포넌트 생성 [UX/UI Dev]

- **파일**: `frontend/src/components/Assistant/ChatSessionList.tsx` (신규 생성)
- **연결**: Phase 2-1의 `GET /api/chat/sessions` 사용

- [ ] **세션 목록 표시**
  - [ ] 제목, 날짜, 모델명 표시
  - [ ] 최신순 정렬
- [ ] **새 대화 버튼**
  - [ ] 클릭 시 `POST /api/chat/sessions` 호출
- [ ] **삭제 버튼**
  - [ ] 확인 대화상자 표시
  - [ ] `DELETE /api/chat/sessions/{id}` 호출
- [ ] **품질 체크**:
  - [ ] `aria-label` 접근성
  - [ ] 로딩 상태 표시
  - [ ] 빈 목록 시 안내 문구

### 3-2. ChatTab 리팩토링 [Junior Dev]

- **파일**: `frontend/src/components/Assistant/ChatTab.tsx` (수정)
- **위치**: `useState` 기반 → 세션 기반으로 변경
- **연결**: Phase 2-3의 메시지 저장 로직, 3-1의 세션 목록

- [ ] **Props 추가**: `sessionId`, `onSessionChange`
- [ ] **메시지 조회**: 세션 ID로 메시지 불러오기
- [ ] **메시지 전송 시 `session_id` 포함**
- [ ] **세션 변경 시 메시지 목록 갱신**
- [ ] **품질 체크**:
  - [ ] 기존 스트리밍 로직 유지
  - [ ] 새로고침 시 마지막 세션 복원 (localStorage)

### 3-3. AssistantPanel 통합 [Junior Dev]

- **파일**: `frontend/src/components/Assistant/AssistantPanel.tsx` (수정)
- **연결**: 3-1의 `ChatSessionList`, 3-2의 `ChatTab`

- [ ] **레이아웃 변경**: 좌측에 세션 목록, 우측에 채팅
- [ ] **세션 선택 핸들러 연결**
- [ ] **품질 체크**:
  - [ ] 반응형 디자인 (모바일에서 토글)
  - [ ] 기존 탭 (참고자료, 목차 제안) 정상 동작

### Phase 3 검증 체크리스트

- [ ] **Syntax 오류 확인**: `npm run build`
- [ ] **브라우저 테스트**:
  - [ ] 새 대화 생성 → 메시지 전송 → 새로고침 → 대화 유지 확인
  - [ ] 세션 삭제 → 목록에서 제거 확인
  - [ ] 세션 전환 → 메시지 목록 변경 확인
- [ ] **기존 기능 정상 동작**:
  - [ ] Admin Mode 모델 선택 정상
  - [ ] RAG 검색 정상
  - [ ] 참고자료 탭 정상

---

## 📝 작업 완료 서명

- [ ] Senior Developer: ******\_\_\_\_******
- [ ] Junior Developer: ******\_\_\_\_******
- [ ] UX/UI Designer: ******\_\_\_\_******
