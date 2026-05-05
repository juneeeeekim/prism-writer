# Phase 11: Document Save & List Management Checklist (v2 - JeDebug Reviewed)

## 1. File & Structure Decision

- **전략**: BE(Database/API) → FE(Hooks/Components) → UI(페이지) 순으로 단계별 구현
- **근거**:
  1. 데이터베이스 스키마가 없으면 API 구현 불가
  2. API가 없으면 프론트엔드 훅 구현 불가
  3. 훅이 없으면 UI 컴포넌트 구현 불가
  4. 각 Phase 완료 후 독립 검증 가능
- **저장 위치**: `plan_report/2512280320_Document_Save_List_Checklist.md`
- **JeDebug 리뷰**: 2025-12-28 완료 (Critical 이슈 3건 반영)

---

## 현재 상태 분석 (출처: useEditorState.ts)

| 항목        | 현재 상태                 | 목표 상태                |
| ----------- | ------------------------- | ------------------------ |
| 저장 위치   | `localStorage` (브라우저) | Supabase DB              |
| 다중 문서   | ❌ 단일 문서만            | ✅ 여러 문서 관리        |
| 문서 목록   | ❌ 없음                   | ✅ `/documents` 페이지   |
| 불러오기    | ❌ 없음                   | ✅ 목록에서 선택 후 로드 |
| 사용자 연결 | ❌ 없음                   | ✅ `user_id` 기반        |

---

## [Phase 1: Database Schema]

### **Before Start:**

- 영향받는 기존 파일/기능: 없음 (신규 테이블)
- 의존성: Supabase 프로젝트 접근 권한

### **Implementation Items:**

- [ ] **P1-01**: `user_documents` 테이블 생성

  - `Target`: `supabase/migrations/033_user_documents.sql` (신규)
  - `Detail`:

    ```sql
    CREATE TABLE public.user_documents (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      title TEXT NOT NULL DEFAULT '제목 없음',
      content TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now()
    );

    -- [JeDebug 추가] 성능 인덱스
    CREATE INDEX idx_user_documents_user_id ON public.user_documents(user_id);
    CREATE INDEX idx_user_documents_updated_at ON public.user_documents(updated_at DESC);
    ```

  - `Dependency`: 없음
  - `Quality`: `ON DELETE CASCADE`로 사용자 삭제 시 문서도 삭제

- [ ] **P1-02**: RLS 정책 설정

  - `Target`: `supabase/migrations/033_user_documents.sql` (이어서)
  - `Detail`:

    ```sql
    ALTER TABLE public.user_documents ENABLE ROW LEVEL SECURITY;

    CREATE POLICY "Users can view own documents"
      ON public.user_documents FOR SELECT
      USING (auth.uid() = user_id);

    CREATE POLICY "Users can insert own documents"
      ON public.user_documents FOR INSERT
      WITH CHECK (auth.uid() = user_id);

    CREATE POLICY "Users can update own documents"
      ON public.user_documents FOR UPDATE
      USING (auth.uid() = user_id);

    CREATE POLICY "Users can delete own documents"
      ON public.user_documents FOR DELETE
      USING (auth.uid() = user_id);
    ```

  - `Dependency`: P1-01
  - `Quality`: 각 사용자는 본인 문서만 CRUD 가능

- [ ] **P1-03**: `updated_at` 자동 갱신 트리거

  - `Target`: `supabase/migrations/033_user_documents.sql` (이어서)
  - `Detail`:

    ```sql
    CREATE OR REPLACE FUNCTION update_updated_at()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = now();
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    CREATE TRIGGER user_documents_updated_at
      BEFORE UPDATE ON public.user_documents
      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
    ```

  - `Dependency`: P1-01
  - `Quality`: 문서 수정 시 `updated_at` 자동 업데이트

### **Verification:**

- [ ] Supabase Dashboard에서 테이블 생성 확인
- [ ] RLS 정책 목록 확인 (4개)
- [ ] 인덱스 생성 확인 (2개)
- [ ] 테스트 데이터 INSERT 후 SELECT 확인

---

## [Phase 2: API Endpoints]

### **Before Start:**

- 영향받는 기존 파일/기능: 없음 (신규 API)
- 의존성: Phase 1 완료

### **Implementation Items:**

- [ ] **P2-01**: 문서 저장 API

  - `Target`: `frontend/src/app/api/documents/save/route.ts` (신규)
  - `Detail`:
    - Method: `POST`
    - Body: `{ id?, title, content }`
    - `id` 있으면 UPDATE, 없으면 INSERT (UPSERT)
    - Response: `{ id, title, updated_at }`
    - **[JeDebug 추가] 인증 코드 패턴**:

      ```typescript
      import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
      import { cookies } from "next/headers";

      const supabase = createRouteHandlerClient({ cookies });
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user)
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      ```
  - `Dependency`: P1-01
  - `Quality`: 인증 필수, 에러 시 400/500 응답

- [ ] **P2-02**: 문서 목록 조회 API

  - `Target`: `frontend/src/app/api/documents/list/route.ts` (신규)
  - `Detail`:
    - Method: `GET`
    - Query: `?page=1&limit=20`
    - Response: `{ documents: [...], total, page, limit }`
    - 정렬: `updated_at DESC`
    - **[JeDebug 추가] 대용량 방지**:
      ```sql
      SELECT id, title, LEFT(content, 100) as preview, updated_at
      FROM user_documents WHERE user_id = $1
      ```
  - `Dependency`: P1-01
  - `Quality`: 페이지네이션 지원, 제목+내용 미리보기(100자)

- [ ] **P2-03**: 문서 상세 조회 API

  - `Target`: `frontend/src/app/api/documents/[id]/route.ts` (신규)
  - `Detail`:
    - Method: `GET`
    - Response: `{ id, title, content, created_at, updated_at }`
    - 동일 인증 패턴 적용
  - `Dependency`: P1-01
  - `Quality`: 존재하지 않는 문서 시 404

- [ ] **P2-04**: 문서 삭제 API
  - `Target`: `frontend/src/app/api/documents/[id]/route.ts` (DELETE 추가)
  - `Detail`:
    - Method: `DELETE`
    - Response: `{ success: true }`
    - 동일 인증 패턴 적용
  - `Dependency`: P2-03
  - `Quality`: hard delete

### **Verification:**

- [ ] Postman/curl로 각 API 테스트
- [ ] 인증 없이 호출 시 401 응답 확인
- [ ] 타 사용자 문서 접근 시 404 확인 (RLS 차단)

---

## [Phase 3: Frontend Hooks]

### **Before Start:**

- 영향받는 기존 파일/기능:
  - `frontend/src/hooks/useEditorState.ts` (수정)
  - `frontend/src/app/editor/page.tsx` (`handleSave` 함수)
- 의존성: Phase 2 완료

### **Implementation Items:**

- [ ] **P3-00**: UserDocument 타입 정의 **(JeDebug 추가)**

  - `Target`: `frontend/src/types/document.ts` (신규)
  - `Detail`:

    ```typescript
    export interface UserDocument {
      id: string;
      title: string;
      content: string;
      created_at: string;
      updated_at: string;
    }

    export interface UserDocumentPreview {
      id: string;
      title: string;
      preview: string;
      updated_at: string;
    }
    ```

  - `Dependency`: 없음
  - `Quality`: API 응답과 일치하는 타입

- [ ] **P3-01**: `useDocuments` 훅 생성

  - `Target`: `frontend/src/hooks/useDocuments.ts` (신규)
  - `Detail`:

    ```typescript
    import { useState, useCallback } from "react";
    import type { UserDocument, UserDocumentPreview } from "@/types/document";

    export function useDocuments() {
      const [documents, setDocuments] = useState<UserDocumentPreview[]>([]);
      const [loading, setLoading] = useState(false);
      const [error, setError] = useState<string | null>(null);

      const fetchList = useCallback(async () => {
        setLoading(true);
        try {
          const res = await fetch("/api/documents/list");
          if (!res.ok) throw new Error("Failed to fetch");
          const data = await res.json();
          setDocuments(data.documents);
        } catch (e) {
          setError(e instanceof Error ? e.message : "Unknown error");
        } finally {
          setLoading(false);
        }
      }, []);

      const saveDocument = useCallback(
        async (doc: { id?: string; title: string; content: string }) => {
          const res = await fetch("/api/documents/save", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(doc),
          });
          if (!res.ok) throw new Error("Save failed");
          return res.json();
        },
        []
      );

      const deleteDocument = useCallback(async (id: string) => {
        const res = await fetch(`/api/documents/${id}`, { method: "DELETE" });
        if (!res.ok) throw new Error("Delete failed");
        return res.json();
      }, []);

      const loadDocument = useCallback(
        async (id: string): Promise<UserDocument> => {
          const res = await fetch(`/api/documents/${id}`);
          if (!res.ok) throw new Error("Load failed");
          return res.json();
        },
        []
      );

      return {
        documents,
        loading,
        error,
        fetchList,
        saveDocument,
        deleteDocument,
        loadDocument,
      };
    }
    ```

  - `Dependency`: P2-01, P2-02, P2-03, P2-04, P3-00
  - `Quality`: useCallback으로 메모이제이션

- [ ] **P3-02**: `useEditorState` 확장

  - `Target`: `frontend/src/hooks/useEditorState.ts` (수정)
  - `Detail`:
    - `documentId: string | null` 상태 추가
    - `setDocumentId(id: string | null)` 액션 추가
    - `loadFromServer(doc: { title, content, id })` 액션 추가
  - `Dependency`: P3-00
  - `Quality`: 기존 localStorage 동작 유지 (하위 호환)

- [ ] **P3-03**: `handleSave` 함수 구현 **(JeDebug 수정)**
  - `Target`: `frontend/src/app/editor/page.tsx` (Line 62-64)
  - `Detail`:
    - **[JeDebug 수정]** 컴포넌트 최상위에서 훅 선언:
      ```typescript
      const { saveDocument } = useDocuments();
      const { content, title, documentId, setDocumentId, markAsSaved } =
        useEditorState();
      const { user } = useAuth();
      ```
    - handleSave 구현:
      ```typescript
      const handleSave = async () => {
        if (!user) {
          alert("로그인이 필요합니다.");
          return;
        }
        try {
          const result = await saveDocument({ id: documentId, title, content });
          setDocumentId(result.id); // 새 문서면 ID 세팅
          markAsSaved();
          alert("저장되었습니다!");
        } catch (e) {
          alert("저장에 실패했습니다.");
        }
      };
      ```
  - `Dependency`: P3-01, P3-02
  - `Quality`: 저장 중 버튼 비활성화 + 로그인 체크

### **Verification:**

- [ ] `handleSave` 클릭 시 DB 저장 확인
- [ ] 새 문서 저장 후 `documentId` 세팅 확인
- [ ] 비로그인 시 로그인 안내 메시지

---

## [Phase 4: Documents List Page]

### **Before Start:**

- 영향받는 기존 파일/기능: 없음 (신규 페이지)
- 의존성: Phase 3 완료

### **Implementation Items:**

- [ ] **P4-01**: 문서 목록 페이지

  - `Target`: `frontend/src/app/documents/page.tsx` (신규)
  - `Detail`:
    - 카드 그리드 레이아웃
    - 각 카드: 제목, 미리보기(100자), 수정일
    - 클릭 시 `/editor?id={documentId}`로 이동
    - 빈 상태: "아직 저장된 글이 없습니다" 메시지
  - `Dependency`: P3-01
  - `Quality`: 반응형 그리드 (모바일 1열, 데스크탑 3열)

- [ ] **P4-02**: 문서 카드 컴포넌트

  - `Target`: `frontend/src/components/Documents/DocumentCard.tsx` (신규)
  - `Detail`:
    - Props: `{ id, title, preview, updatedAt, onDelete }`
    - 삭제 버튼 (확인 모달 포함)
    - 호버 효과
  - `Dependency`: P4-01
  - `Quality`: `aria-label` 접근성 확보

- [ ] **P4-03**: 에디터 페이지 문서 로드 **(JeDebug 수정)**

  - `Target`: `frontend/src/app/editor/page.tsx`
  - `Detail`:
    - **[JeDebug 추가] Next.js App Router searchParams 접근**:

      ```typescript
      "use client";
      import { useSearchParams } from "next/navigation";

      export default function EditorPage() {
        const searchParams = useSearchParams();
        const documentId = searchParams.get("id");

        useEffect(() => {
          if (documentId) {
            loadDocument(documentId).then((doc) => {
              loadFromServer(doc);
            });
          }
        }, [documentId]);
      }
      ```
  - `Dependency`: P3-02
  - `Quality`: 로딩 중 스켈레톤 UI

- [ ] **P4-04**: 네비게이션 링크 추가
  - `Target`: `frontend/src/components/auth/AuthHeader.tsx`
  - `Detail`:
    - 로고 옆에 "내 문서" 링크 추가
    - 또는 사용자 드롭다운 메뉴에 추가
  - `Dependency`: P4-01
  - `Quality`: 현재 페이지 활성화 표시

### **Verification:**

- [ ] `/documents` 페이지 접근 확인
- [ ] 문서 목록 정상 표시 확인
- [ ] 카드 클릭 → 에디터 로드 확인
- [ ] 삭제 후 목록 갱신 확인

---

## [Phase 5: UX Polish]

### **Before Start:**

- 영향받는 기존 파일/기능: Phase 4 완료된 모든 파일
- 의존성: Phase 4 완료

### **Implementation Items:**

- [ ] **P5-00**: localStorage → DB 마이그레이션 **(JeDebug 추가)**

  - `Target`: `frontend/src/app/editor/page.tsx` 또는 별도 훅
  - `Detail`:
    - 최초 로그인 시 localStorage에 content가 있으면
    - "기존 작성 중인 글을 저장하시겠습니까?" confirm 표시
    - 확인 시 DB에 저장 후 localStorage 클리어
  - `Dependency`: P3-03
  - `Quality`: 기존 사용자 데이터 보호

- [ ] **P5-01**: 자동 저장 통합

  - `Target`: `frontend/src/hooks/useEditorState.ts`
  - `Detail`:
    - 기존 localStorage 자동 저장과 DB 저장 통합
    - Debounce 적용 (3초 후 자동 저장)
    - "저장됨" / "저장 중..." 상태 표시
    - **[JeDebug 추가]** 첫 저장 후 반환된 id를 documentId에 세팅
  - `Dependency`: P3-03
  - `Quality`: 성능 최적화 (과도한 API 호출 방지)

- [ ] **P5-02**: 새 문서 생성 버튼

  - `Target`: `frontend/src/app/documents/page.tsx`
  - `Detail`:
    - 상단에 "+ 새 글 작성" 버튼
    - 클릭 시 `/editor` (id 없이) 이동
    - `useEditorState.reset()` 호출
  - `Dependency`: P4-01
  - `Quality`: CTA 스타일 (primary color)

- [ ] **P5-03**: 미저장 경고
  - `Target`: `frontend/src/app/editor/page.tsx`
  - `Detail`:
    - 페이지 이탈 시 `beforeunload` 이벤트
    - `isDirty === true`면 경고 표시
  - `Dependency`: P3-02
  - `Quality`: 브라우저 기본 확인 대화상자 사용

### **Verification:**

- [ ] localStorage 마이그레이션 동작 확인
- [ ] 자동 저장 3초 후 동작 확인
- [ ] 새 문서 생성 → 저장 → 목록 표시 플로우 확인
- [ ] 수정 후 페이지 이탈 시 경고 확인

---

## Summary

| Phase     | 주요 산출물                   | 예상 작업 시간 |
| --------- | ----------------------------- | -------------- |
| Phase 1   | DB 테이블 + RLS + 인덱스      | 10분           |
| Phase 2   | API 4개                       | 20분           |
| Phase 3   | 타입 + Hooks 2개 + handleSave | 20분           |
| Phase 4   | 목록 페이지 + 카드 컴포넌트   | 25분           |
| Phase 5   | 마이그레이션 + 자동 저장 + UX | 20분           |
| **Total** | -                             | **~95분**      |
