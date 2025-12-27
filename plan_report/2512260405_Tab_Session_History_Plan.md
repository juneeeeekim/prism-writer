# 📋 탭별 세션 히스토리 시스템 계획서

> **문서 ID**: 2512260405_Tab_Session_History_Plan.md  
> **작성일**: 2025-12-26 04:08  
> **상태**: 검토 대기

---

## 1. 📌 요구사항 요약

### 현재 상태

| 탭        | 데이터 저장      | 세션 관리         | 히스토리     |
| --------- | ---------------- | ----------------- | ------------ |
| AI 채팅   | ✅ DB 저장       | ✅ 세션 목록      | ✅ 영구 보존 |
| 목차 제안 | ❌ 휘발성        | ❌ 없음           | ❌ 없음      |
| 참고자료  | ⚠️ 문서는 저장됨 | ❌ 선택 상태 휘발 | ❌ 없음      |
| 평가      | ❌ 휘발성        | ❌ 없음           | ❌ 없음      |

### 목표

- 모든 탭에서 **AI 채팅과 동일한 세션 관리 UX** 제공
- 생성된 데이터를 **수동 삭제 전까지 영구 보존**
- **새 세션 생성** 및 **이전 세션 선택** 기능

---

## 2. 🏗️ 아키텍처 설계

### 2.1 통합 세션 vs 개별 세션

#### 옵션 A: 통합 세션 테이블 (권장 ⭐)

```
assistant_sessions (통합)
├── id, user_id, session_type (outline|evaluation)
├── title, metadata (JSONB)
└── created_at, updated_at
```

**장점**: 단일 테이블, 코드 재사용 용이  
**단점**: 타입별 분기 필요

#### 옵션 B: 개별 세션 테이블

```
outline_sessions    → outline_results
evaluation_sessions → evaluation_results
```

**장점**: 타입별 명확한 분리  
**단점**: 중복 코드, 마이그레이션 복잡

### ✅ 결정: **옵션 A (통합 세션)** 채택

---

## 3. 📊 DB 스키마 설계

### 3.1 assistant_sessions (새 테이블)

```sql
CREATE TABLE assistant_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    session_type TEXT NOT NULL CHECK (session_type IN ('outline', 'evaluation')),
    title TEXT DEFAULT '새 세션',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스
CREATE INDEX idx_assistant_sessions_user_type
    ON assistant_sessions(user_id, session_type);
CREATE INDEX idx_assistant_sessions_updated
    ON assistant_sessions(updated_at DESC);

-- RLS 정책
ALTER TABLE assistant_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own sessions" ON assistant_sessions
    FOR ALL USING (auth.uid() = user_id);
```

### 3.2 outline_results (새 테이블)

```sql
CREATE TABLE outline_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES assistant_sessions(id) ON DELETE CASCADE,
    topic TEXT NOT NULL,
    outline_content JSONB NOT NULL,  -- 생성된 목차 구조
    reference_docs UUID[],            -- 참조한 문서 ID 배열
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 3.3 evaluation_results (새 테이블)

```sql
CREATE TABLE evaluation_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES assistant_sessions(id) ON DELETE CASCADE,
    evaluated_text TEXT NOT NULL,
    result_json JSONB NOT NULL,       -- 평가 결과 전체
    overall_score DECIMAL(3,1),       -- 0.0 - 10.0
    criteria_count INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 4. 🔌 API 설계

### 4.1 세션 관리 API (공통)

| Method | Endpoint                               | 설명           |
| ------ | -------------------------------------- | -------------- |
| GET    | `/api/assistant/sessions?type=outline` | 세션 목록 조회 |
| POST   | `/api/assistant/sessions`              | 새 세션 생성   |
| PATCH  | `/api/assistant/sessions/[id]`         | 세션 제목 수정 |
| DELETE | `/api/assistant/sessions/[id]`         | 세션 삭제      |

### 4.2 목차 제안 결과 API

| Method | Endpoint                             | 설명                  |
| ------ | ------------------------------------ | --------------------- |
| GET    | `/api/assistant/outline/[sessionId]` | 세션의 목차 결과 조회 |
| POST   | `/api/assistant/outline/[sessionId]` | 목차 생성 결과 저장   |

### 4.3 평가 결과 API

| Method | Endpoint                                | 설명                  |
| ------ | --------------------------------------- | --------------------- |
| GET    | `/api/assistant/evaluation/[sessionId]` | 세션의 평가 결과 조회 |
| POST   | `/api/assistant/evaluation/[sessionId]` | 평가 결과 저장        |

---

## 5. 🎨 UI/UX 설계

### 5.1 세션 목록 컴포넌트 (재사용)

기존 `ChatSessionList.tsx`를 **제네릭 컴포넌트**로 리팩토링:

```tsx
interface SessionListProps {
  sessionType: 'chat' | 'outline' | 'evaluation'
  selectedSessionId: string | null
  onSelectSession: (id: string) => void
  apiEndpoint: string
}

function SessionList({ sessionType, ... }: SessionListProps) {
  // 공통 로직
}
```

### 5.2 탭별 레이아웃 변경

```
[변경 전]                      [변경 후]
┌──────────────────────┐      ┌─────────┬──────────────┐
│                      │      │ 세션    │              │
│   탭 콘텐츠 영역      │  →   │ 목록    │  메인 영역    │
│                      │      │         │              │
└──────────────────────┘      └─────────┴──────────────┘
```

---

## 6. 📋 구현 체크리스트

### Phase 1: DB 마이그레이션 (1시간)

- [ ] `assistant_sessions` 테이블 생성
- [ ] `outline_results` 테이블 생성
- [ ] `evaluation_results` 테이블 생성
- [ ] RLS 정책 설정
- [ ] Supabase에 마이그레이션 적용

### Phase 2: 공통 컴포넌트 (1.5시간)

- [ ] `SessionList.tsx` 제네릭 컴포넌트 생성
- [ ] `useAssistantSessions` 훅 생성
- [ ] 세션 CRUD API 구현 (`/api/assistant/sessions`)

### Phase 3: 평가 탭 통합 (1.5시간)

- [ ] `EvaluationTab.tsx` 세션 연동
- [ ] 평가 결과 저장 API 구현
- [ ] 이전 평가 결과 로드 기능
- [ ] UI 테스트

### Phase 4: 목차 제안 탭 통합 (1.5시간)

- [ ] `OutlineTab.tsx` 세션 연동
- [ ] 목차 결과 저장 API 구현
- [ ] 이전 목차 로드 기능
- [ ] UI 테스트

### Phase 5: 최종 검증 (0.5시간)

- [ ] 전체 흐름 테스트
- [ ] 배포 및 프로덕션 검증

**총 예상 시간: 6시간**

---

## 7. ⚠️ 위험 요소 및 대응

### Risk 1: 참고자료 탭은 이미 문서 기반

- **분석**: 참고자료는 이미 `rag_documents`로 영구 저장됨
- **결정**: 별도 세션 시스템 불필요, 현재 상태 유지
- **추가 개선**: 마지막 선택 문서 ID를 localStorage에 저장하여 복원

### Risk 2: DB 마이그레이션 순서

- **대응**: Supabase SQL Editor에서 순차 실행
- **롤백 계획**: DROP TABLE 스크립트 준비

### Risk 3: 대용량 평가 결과 저장

- **대응**: `result_json` JSONB 압축 또는 별도 스토리지 검토
- **초기 버전**: 최근 50개 세션만 표시

---

## 8. 🚀 우선순위 제안

1. **평가 탭** (가장 시급) - 평가 결과 휘발이 가장 아까움
2. **목차 제안 탭** - 생성된 목차 보존 필요
3. **참고자료 탭** - 이미 문서 기반이므로 선택 상태만 localStorage 저장

---

## 9. ✅ 다음 단계

디렉터님 확인 후:

1. DB 마이그레이션 스크립트 생성
2. API 엔드포인트 개발
3. UI 컴포넌트 통합
4. 테스트 및 배포

---

> **검토 요청**: 이 계획에 동의하시면 구현을 시작하겠습니다.
