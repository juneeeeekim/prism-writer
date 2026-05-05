# 🏗️ 멀티 프로젝트 시스템 - 기술 설계 문서

> **문서 유형**: Feature Design Document  
> **생성일**: 2025-12-30 20:40  
> **상태**: 📋 설계 완료, 개발 대기  
> **선행 조건**: Phase 4 완료  
> **예상 소요**: 1~2일

---

## 📌 기능 개요

### 목표

사용자가 **여러 개의 독립적인 RAG 프로젝트**를 생성하고 관리할 수 있도록 함.

### 핵심 변화

```
[AS-IS] 사용자 → 단일 에디터 → 모든 문서 공유

[TO-BE] 사용자 → 프로젝트 목록 → 프로젝트 선택/생성
                                    │
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
              프로젝트 A       프로젝트 B       프로젝트 C
              (기업 문서)      (학술 논문)      (기술 블로그)
                    │               │               │
              ┌─────┴─────┐   ┌─────┴─────┐   ┌─────┴─────┐
              │ 문서들    │   │ 문서들    │   │ 문서들    │
              │ 평가 기준 │   │ 평가 기준 │   │ 평가 기준 │
              │ 채팅 기록 │   │ 채팅 기록 │   │ 채팅 기록 │
              └───────────┘   └───────────┘   └───────────┘
```

### 사용 시나리오

1. **"내 자료로 AI 코치 만들기"** 클릭 → 새 프로젝트 생성
2. 프로젝트에 문서 업로드 (해당 프로젝트 전용)
3. 프로젝트 내에서 글쓰기, 평가, 채팅
4. 프로젝트 간 독립적 운영

---

## 🗃️ DB 스키마 설계

### 새 테이블: `projects`

```sql
CREATE TABLE public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  name TEXT NOT NULL,                    -- 프로젝트 이름
  description TEXT,                       -- 설명
  icon TEXT DEFAULT '📁',                -- 아이콘 (이모지)

  status TEXT DEFAULT 'active',          -- active | archived

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can CRUD own projects" ON public.projects
FOR ALL USING (auth.uid() = user_id);

-- Index
CREATE INDEX idx_projects_user ON public.projects(user_id);
```

### 기존 테이블 수정

| 테이블            | 추가 컬럼         | 설명               |
| ----------------- | ----------------- | ------------------ |
| `user_documents`  | `project_id UUID` | FK → projects      |
| `rag_chunks`      | (변경 없음)       | document_id로 연결 |
| `evaluation_logs` | `project_id UUID` | FK → projects      |
| `chat_sessions`   | `project_id UUID` | FK → projects      |
| `rag_templates`   | `project_id UUID` | FK → projects      |

---

## 🎨 UI 설계

### 1. 프로젝트 대시보드 (신규 페이지)

```
┌─────────────────────────────────────────────────────┐
│  💎 PRISM Writer                    [사용자 메뉴]   │
├─────────────────────────────────────────────────────┤
│                                                     │
│   내 AI 코치 목록                                   │
│                                                     │
│   ┌──────────┐  ┌──────────┐  ┌──────────┐        │
│   │ 📁       │  │ 📚       │  │ ➕ 새로  │        │
│   │ 기업     │  │ 학술     │  │   만들기 │        │
│   │ 문서 3개 │  │ 문서 5개 │  │          │        │
│   └──────────┘  └──────────┘  └──────────┘        │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### 2. 프로젝트 생성 모달

```
┌───────────────────────────────────────┐
│  내 자료로 AI 코치 만들기             │
├───────────────────────────────────────┤
│  이름: [____________________]         │
│  설명: [____________________]         │
│  아이콘: 📁 📚 📝 💼 🎓 ...         │
│                                       │
│          [취소]  [만들기]             │
└───────────────────────────────────────┘
```

### 3. 에디터 헤더 수정

```
┌─────────────────────────────────────────────────────┐
│  💎 PRISM Writer  │  📁 기업 문서 ▼  │  [설정]    │
└─────────────────────────────────────────────────────┘
                    ↑
              프로젝트 선택 드롭다운
```

---

## 🔌 API 설계

### 새 API 엔드포인트

| Method | Path                | 설명          |
| ------ | ------------------- | ------------- |
| GET    | `/api/projects`     | 프로젝트 목록 |
| POST   | `/api/projects`     | 프로젝트 생성 |
| GET    | `/api/projects/:id` | 프로젝트 상세 |
| PATCH  | `/api/projects/:id` | 프로젝트 수정 |
| DELETE | `/api/projects/:id` | 프로젝트 삭제 |

### 기존 API 수정

모든 문서/평가/채팅 API에 `projectId` 쿼리 파라미터 추가:

```typescript
// Before
GET /api/documents

// After
GET /api/documents?projectId=xxx
```

---

## 📋 구현 체크리스트

### Phase 5.1: DB 마이그레이션

- [ ] `projects` 테이블 생성
- [ ] `user_documents`에 `project_id` 컬럼 추가
- [ ] `evaluation_logs`에 `project_id` 컬럼 추가
- [ ] `chat_sessions`에 `project_id` 컬럼 추가
- [ ] RLS 정책 업데이트

### Phase 5.2: API 개발

- [ ] `/api/projects` CRUD API
- [ ] 기존 API에 `projectId` 필터 추가

### Phase 5.3: UI 개발

- [ ] 프로젝트 대시보드 페이지
- [ ] 프로젝트 생성 모달
- [ ] 에디터 헤더에 프로젝트 선택기

### Phase 5.4: 마이그레이션

- [ ] 기존 사용자 데이터 → 기본 프로젝트로 이관

---

## ⚠️ 주의사항

1. **하위 호환성**: 기존 사용자는 자동으로 "기본 프로젝트" 생성
2. **데이터 격리**: 프로젝트 간 문서/평가/채팅 완전 분리
3. **RLS 강화**: 프로젝트 소유권 검증 필수

---

## 🚀 다음 단계

1. ✅ 설계 문서 작성 완료
2. ⏸️ Phase 4 검증 완료 후 개발 시작
3. Phase 5로 구현 진행
