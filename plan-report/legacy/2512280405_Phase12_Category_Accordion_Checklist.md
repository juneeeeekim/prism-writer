# Phase 12: 카테고리 관리 (폴더형 아코디언) - 구현 체크리스트

---

## File & Structure Decision (파일 구성 전략)

### 📁 구성 전략

**단일 체크리스트 파일**로 관리

### 📝 논리적 근거

1. **Phase 11과의 연속성**: 기존 문서 관리 기능에 카테고리 기능을 추가하는 확장 작업
2. **영향 범위 제한적**: DB 1곳, Type 1곳, API 2곳, 컴포넌트 2곳으로 변경 범위가 작음
3. **독립 배포 가능**: 각 Phase가 독립적으로 검증 및 배포 가능
4. **기존 패턴 유지**: Phase 11에서 수립한 코드 패턴 재사용

### 📍 저장 위치

`plan_report/2512280405_Phase12_Category_Accordion_Checklist.md`

---

## 원본 문서 추적 (Traceability)

| 구현 항목          | 원본 문서 출처                          |
| ------------------ | --------------------------------------- |
| DB category 컬럼   | implementation_plan.md > Database       |
| Type 업데이트      | implementation_plan.md > Types          |
| API 수정           | implementation_plan.md > API            |
| Editor UI          | implementation_plan.md > Editor Page    |
| Accordion 컴포넌트 | implementation_plan.md > Documents Page |

---

## [Phase 1: Database & Types]

### Before Start

- **영향받는 기존 파일**:
  - `supabase/migrations/033_user_documents.sql` (기존 테이블 정의)
  - `frontend/src/types/document.ts` (기존 인터페이스)

---

### Implementation Items

- [ ] **P1-01**: user_documents 테이블에 category 컬럼 추가

  - `Target`: `supabase/migrations/034_add_category.sql` (신규 파일)
  - `Detail`:

    ```sql
    ALTER TABLE public.user_documents
    ADD COLUMN category TEXT NOT NULL DEFAULT '미분류';

    CREATE INDEX idx_user_documents_category
    ON public.user_documents(category);
    ```

  - `Dependency`: 없음 (독립 마이그레이션)
  - `Quality`: 기본값 '미분류' 설정으로 기존 데이터 호환성 유지

- [ ] **P1-02**: UserDocument 인터페이스에 category 필드 추가

  - `Target`: `frontend/src/types/document.ts` (Line 1-10, UserDocument 인터페이스)
  - `Detail`:
    ```typescript
    export interface UserDocument {
      id: string;
      title: string;
      content: string;
      category: string; // 추가
      created_at: string;
      updated_at: string;
    }
    ```
  - `Dependency`: P1-01 (DB 스키마 선행)
  - `Quality`: 필수 필드(string), 옵셔널 아님

- [ ] **P1-03**: UserDocumentPreview 인터페이스에 category 필드 추가

  - `Target`: `frontend/src/types/document.ts` (Line 12-17, UserDocumentPreview 인터페이스)
  - `Detail`:
    ```typescript
    export interface UserDocumentPreview {
      id: string;
      title: string;
      preview: string;
      category: string; // 추가
      updated_at: string;
    }
    ```
  - `Dependency`: P1-02
  - `Quality`: 목록 조회 시 카테고리 표시용

- [ ] **P1-04**: SaveDocumentRequest 인터페이스에 category 필드 추가
  - `Target`: `frontend/src/types/document.ts` (Line 19-23, SaveDocumentRequest 인터페이스)
  - `Detail`:
    ```typescript
    export interface SaveDocumentRequest {
      id?: string;
      title: string;
      content: string;
      category?: string; // 추가 (옵셔널, 미입력 시 '미분류')
    }
    ```
  - `Dependency`: P1-02
  - `Quality`: 옵셔널 필드 (기존 저장 로직 호환)

---

### Verification (검증)

- [ ] **Syntax Check**: `npx tsc --noEmit` 실행
- [ ] **Functionality Test**:
  - 시나리오: 타입 파일 import 후 category 필드 접근
  - 기대 결과: TypeScript 컴파일 에러 없음
- [ ] **Regression Test**: 기존 Phase 11 타입 호환성 유지

---

## [Phase 2: API Updates]

### Before Start

- **영향받는 기존 파일**:
  - `frontend/src/app/api/documents/save/route.ts`
  - `frontend/src/app/api/documents/list/route.ts`
  - `frontend/src/app/api/documents/[id]/route.ts`

---

### Implementation Items

- [ ] **P2-01**: Save API에 category 필드 저장 로직 추가

  - `Target`: `frontend/src/app/api/documents/save/route.ts` (INSERT/UPDATE 쿼리)
  - `Detail`:

    ```typescript
    // INSERT 쿼리 수정
    const { data, error } = await supabase.from("user_documents").insert({
      user_id: user.id,
      title: title || "제목 없음",
      content: content || "",
      category: category || "미분류", // 추가
    });

    // UPDATE 쿼리 수정
    const { data, error } = await supabase
      .from("user_documents")
      .update({ title, content, category: category || "미분류" }); // category 추가
    ```

  - `Dependency`: P1-01 (DB 스키마)
  - `Quality`: 미입력 시 기본값 '미분류' 적용

- [ ] **P2-02**: List API 응답에 category 포함

  - `Target`: `frontend/src/app/api/documents/list/route.ts` (select 쿼리, 응답 매핑)
  - `Detail`:

    ```typescript
    // select에 category 추가
    .select('id, title, content, category, updated_at', { count: 'exact' })

    // 응답 매핑에 category 포함
    const documentsWithPreview = (documents || []).map(doc => ({
      id: doc.id,
      title: doc.title,
      preview: doc.content.substring(0, 100) + (doc.content.length > 100 ? '...' : ''),
      category: doc.category,  // 추가
      updated_at: doc.updated_at
    }))
    ```

  - `Dependency`: P1-03 (UserDocumentPreview 타입)
  - `Quality`: 카테고리별 정렬은 프론트엔드에서 처리

- [ ] **P2-03**: Get API 응답에 category 포함
  - `Target`: `frontend/src/app/api/documents/[id]/route.ts` (GET 핸들러)
  - `Detail`:
    ```typescript
    // select에 category 추가
    .select('id, title, content, category, created_at, updated_at')
    ```
  - `Dependency`: P1-02 (UserDocument 타입)
  - `Quality`: 문서 상세 조회 시 카테고리 반환

---

### Verification (검증)

- [ ] **Syntax Check**: `npx tsc --noEmit` 실행
- [ ] **Functionality Test**:
  - 시나리오 1: POST /api/documents/save with category
  - 기대 결과: category 필드가 DB에 저장됨
  - 시나리오 2: GET /api/documents/list
  - 기대 결과: 응답에 category 필드 포함
- [ ] **Regression Test**: category 없이 저장 시 '미분류' 기본값 적용

---

## [Phase 3: Editor Category Input]

### Before Start

- **영향받는 기존 파일**:
  - `frontend/src/hooks/useEditorState.ts`
  - `frontend/src/app/editor/page.tsx`

---

### Implementation Items

- [ ] **P3-01**: useEditorState 훅에 category 상태 추가

  - `Target`: `frontend/src/hooks/useEditorState.ts`
  - `Detail`:

    ```typescript
    // 상태 추가
    category: string
    setCategory: (category: string) => void

    // 초기값
    category: ''

    // loadFromServer 수정
    loadFromServer: (doc) => set({
      documentId: doc.id,
      title: doc.title,
      content: doc.content,
      category: doc.category || '미분류',  // 추가
      isDirty: false
    })

    // reset 수정
    reset: () => set({
      documentId: null,
      title: '',
      content: '',
      category: '',  // 추가
      isDirty: false
    })
    ```

  - `Dependency`: P1-04 (SaveDocumentRequest 타입)
  - `Quality`: 상태 초기화 시 category도 초기화

- [ ] **P3-02**: 에디터 페이지에 카테고리 입력 UI 추가

  - `Target`: `frontend/src/app/editor/page.tsx` (AuthHeader 근처 또는 제목 입력 하단)
  - `Detail`:
    ```tsx
    // 카테고리 입력 컴포넌트 (Combobox 스타일)
    <div className="flex items-center gap-2 mb-4">
      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
        📁 카테고리
      </label>
      <input
        type="text"
        list="category-suggestions"
        value={category}
        onChange={(e) => setCategory(e.target.value)}
        placeholder="미분류"
        className="px-3 py-1.5 border rounded-lg text-sm"
      />
      <datalist id="category-suggestions">
        {/* 기존 카테고리 목록 - useDocuments에서 가져옴 */}
        {existingCategories.map((cat) => (
          <option key={cat} value={cat} />
        ))}
      </datalist>
    </div>
    ```
  - `Dependency`: P3-01 (useEditorState category)
  - `Quality`:
    - 드롭다운 + 직접입력 가능 (datalist 사용)
    - aria-label 접근성 추가.

- [ ] **P3-03**: handleSave에 category 포함

  - `Target`: `frontend/src/app/editor/page.tsx` (handleSave 함수)
  - `Detail`:
    ```typescript
    const result = await saveDocument({
      id: documentId || undefined,
      title,
      content,
      category: category || "미분류", // 추가
    });
    ```
  - `Dependency`: P3-01, P2-01
  - `Quality`: 미입력 시 '미분류' 기본값

- [ ] **P3-04**: useDocuments에 기존 카테고리 목록 조회 추가
  - `Target`: `frontend/src/hooks/useDocuments.ts`
  - `Detail`:

    ```typescript
    // 카테고리 목록 상태 추가
    const [categories, setCategories] = useState<string[]>([])

    // fetchList에서 카테고리 추출
    const fetchList = async () => {
      // ... 기존 로직
      const uniqueCategories = [...new Set(documents.map(d => d.category))]
      setCategories(uniqueCategories)
    }

    // 반환값에 categories 추가
    return { ..., categories }
    ```

  - `Dependency`: P2-02 (List API category 응답)
  - `Quality`: 중복 제거, 정렬은 프론트에서 처리

---

### Verification (검증)

- [ ] **Syntax Check**: `npx tsc --noEmit` 실행
- [ ] **Functionality Test**:
  - 시나리오: 에디터에서 카테고리 선택 후 저장
  - 기대 결과: 저장된 문서에 카테고리 반영
- [ ] **Regression Test**: 카테고리 없이 저장해도 정상 동작

---

## [Phase 4: Documents List Accordion]

### Before Start

- **영향받는 기존 파일**:
  - `frontend/src/app/documents/page.tsx`
  - `frontend/src/components/documents/DocumentCard.tsx`

---

### Implementation Items

- [ ] **P4-01**: CategoryAccordion 컴포넌트 생성

  - `Target`: `frontend/src/components/documents/CategoryAccordion.tsx` (신규 파일)
  - `Detail`:

    ```tsx
    "use client";
    import { useState } from "react";
    import type { UserDocumentPreview } from "@/types/document";
    import DocumentCard from "./DocumentCard";

    interface CategoryAccordionProps {
      category: string;
      documents: UserDocumentPreview[];
      onDelete: (id: string) => Promise<void>;
      defaultOpen?: boolean;
    }

    export default function CategoryAccordion({
      category,
      documents,
      onDelete,
      defaultOpen = true,
    }: CategoryAccordionProps) {
      const [isOpen, setIsOpen] = useState(defaultOpen);

      return (
        <div className="mb-6">
          {/* 카테고리 헤더 */}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="w-full flex items-center gap-2 p-3 bg-gray-100 
                       dark:bg-gray-800 rounded-lg hover:bg-gray-200 
                       dark:hover:bg-gray-700 transition-colors"
            aria-expanded={isOpen}
          >
            <span className="text-lg">{isOpen ? "▼" : "▶"}</span>
            <span className="text-lg">📁</span>
            <span className="font-semibold">{category}</span>
            <span className="text-gray-500">({documents.length})</span>
          </button>

          {/* 문서 카드 그리드 */}
          {isOpen && (
            <div
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 
                            gap-4 mt-3 pl-4 border-l-2 border-gray-200 
                            dark:border-gray-700"
            >
              {documents.map((doc) => (
                <DocumentCard key={doc.id} {...doc} onDelete={onDelete} />
              ))}
            </div>
          )}
        </div>
      );
    }
    ```

  - `Dependency`: P1-03 (UserDocumentPreview with category)
  - `Quality`:
    - aria-expanded 접근성 속성
    - 애니메이션 transition
    - 왼쪽 border로 계층 표시

- [ ] **P4-02**: 문서 목록 페이지에 카테고리별 그룹핑 로직 추가

  - `Target`: `frontend/src/app/documents/page.tsx`
  - `Detail`:

    ```typescript
    // 카테고리별 그룹핑 함수
    const groupByCategory = (docs: UserDocumentPreview[]) => {
      const groups: Record<string, UserDocumentPreview[]> = {};

      docs.forEach((doc) => {
        const cat = doc.category || "미분류";
        if (!groups[cat]) groups[cat] = [];
        groups[cat].push(doc);
      });

      // 카테고리 정렬 (미분류는 마지막)
      return Object.entries(groups).sort((a, b) => {
        if (a[0] === "미분류") return 1;
        if (b[0] === "미분류") return -1;
        return a[0].localeCompare(b[0]);
      });
    };

    // 사용
    const groupedDocuments = groupByCategory(documents);
    ```

  - `Dependency`: P4-01, P2-02
  - `Quality`: '미분류' 카테고리는 항상 마지막

- [ ] **P4-03**: 그리드 뷰를 아코디언 뷰로 변경

  - `Target`: `frontend/src/app/documents/page.tsx` (렌더링 부분)
  - `Detail`:
    ```tsx
    // 기존 그리드 뷰 교체
    {
      !loading && !authLoading && user && documents.length > 0 && (
        <div className="space-y-4">
          {groupedDocuments.map(([category, docs]) => (
            <CategoryAccordion
              key={category}
              category={category}
              documents={docs}
              onDelete={handleDelete}
              defaultOpen={true}
            />
          ))}
        </div>
      );
    }
    ```
  - `Dependency`: P4-01, P4-02
  - `Quality`: 기본적으로 모든 카테고리 펼쳐진 상태

- [ ] **P4-04**: DocumentCard에 카테고리 뱃지 표시 (선택사항)
  - `Target`: `frontend/src/components/documents/DocumentCard.tsx`
  - `Detail`:
    ```tsx
    // 카드 메타 정보에 카테고리 뱃지 추가
    <span
      className="text-xs bg-indigo-100 dark:bg-indigo-900 
                     text-indigo-700 dark:text-indigo-300 
                     px-2 py-0.5 rounded-full"
    >
      📁 {category}
    </span>
    ```
  - `Dependency`: P1-03
  - `Quality`: 뱃지 스타일 일관성

---

### Verification (검증)

- [ ] **Syntax Check**: `npx tsc --noEmit` 실행
- [ ] **Functionality Test**:
  - 시나리오 1: 문서 목록 페이지 접근
  - 기대 결과: 카테고리별로 그룹화된 아코디언 UI 표시
  - 시나리오 2: 카테고리 헤더 클릭
  - 기대 결과: 해당 카테고리 접기/펼치기 동작
- [ ] **Regression Test**:
  - 기존 문서 카드 클릭 → 에디터 이동 정상
  - 문서 삭제 정상 동작

---

## [Final Verification]

- [ ] **TypeScript 전체 체크**: `npx tsc --noEmit`
- [ ] **Supabase 마이그레이션**: `034_add_category.sql` 실행
- [ ] **E2E 테스트**:
  1. 에디터에서 새 문서 + 카테고리 "마케팅" 저장
  2. 에디터에서 새 문서 + 카테고리 없이 저장 (미분류)
  3. 문서 목록 페이지 접근 → 카테고리별 그룹 확인
  4. 카테고리 접기/펼치기 동작 확인
  5. 기존 문서 편집 → 카테고리 변경 → 목록 반영 확인

---

## 예상 작업 시간

| Phase     | 작업         | 예상 시간  |
| --------- | ------------ | ---------- |
| Phase 1   | DB & Types   | 15분       |
| Phase 2   | API Updates  | 20분       |
| Phase 3   | Editor UI    | 30분       |
| Phase 4   | Accordion UI | 45분       |
| Final     | 검증         | 10분       |
| **Total** |              | **~2시간** |

---

## [확인 필요 사항]

1. **[확인 필요]**: 카테고리 삭제 기능 필요 여부

   - 현재 계획에는 카테고리 관리 UI 없음
   - 문서 삭제 시 자동으로 빈 카테고리 처리

2. **[확인 필요]**: 카테고리 순서 커스터마이징 필요 여부
   - 현재: 알파벳 정렬 (미분류는 마지막)
   - 대안: 사용자 정의 순서
