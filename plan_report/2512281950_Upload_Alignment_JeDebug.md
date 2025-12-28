# 🔍 JeDebug Analysis: Upload System Alignment Checklist

**Date**: 2025-12-28 19:50  
**Analyst**: Senior Lead Developer (JeDebug)  
**Target Document**: `2512281910_Upload_System_Alignment_Checklist.md`  
**Framework**: L.I.V.E (Logic, Implementation, Verification, Environment/Risk)

---

## 1) 🔧 로직 및 구현 보완 (Logic Fixes)

### Critical Logic Gaps

- [ ] **(Critical) 누락된 로직: File Content Placeholder**

  - [ ] **원인**: Phase 2에서 `user_documents`에 `content` 컬럼을 채워야 하는데, 파일 업로드 시점에는 텍스트가 추출되지 않음. 현재 체크리스트는 "나중에 처리"라고만 언급하고 구체적 방법 누락.
  - [ ] **수정 제안**: Phase 2 체크리스트에 다음 항목 추가:
    ```markdown
    - [ ] **Temporary Content**: Insert placeholder text in `content` field (e.g., `"(File Uploaded: {filename})"`) until processing completes.
    - [ ] **Processing Trigger**: After DB insert, call `/api/documents/process` with `documentId` to trigger chunking/embedding (or rely on client-side trigger as per existing flow).
    ```
  - [ ] **파일/위치**: `2512281910_Upload_System_Alignment_Checklist.md` Line 42 (after "Save Metadata")

- [ ] **(Critical) 누락된 Import: CategoryCombobox**

  - [ ] **원인**: Phase 1에서 `CategoryCombobox`를 사용하라고 하지만, import 구문이 체크리스트에 명시되지 않음.
  - [ ] **수정 제안**: Phase 1 첫 번째 항목을 다음으로 교체:
    ```markdown
    - [ ] **Import Components**:
      - `import { RAFT_CATEGORIES, DEFAULT_RAFT_CATEGORY } from '@/constants/raft'`
      - `import CategoryCombobox from '@/components/admin/CategoryCombobox'`
    ```
  - [ ] **파일/위치**: Line 30 수정

- [ ] **(Major) 누락된 Fallback Logic**

  - [ ] **원인**: 사용자가 카테고리를 선택하지 않거나 빈 값을 전송할 경우 처리 로직 누락.
  - [ ] **수정 제안**: Phase 2에 다음 항목 추가:
    ```markdown
    - [ ] **Category Validation**:
      - Extract `category` from formData.
      - If empty/null, use `DEFAULT_RAFT_CATEGORY` (e.g., '미분류').
      - Trim whitespace: `category = (formData.get('category') as string)?.trim() || DEFAULT_RAFT_CATEGORY`.
    ```
  - [ ] **파일/위치**: Line 39 (after "Parse Category")

- [ ] **(Major) 모호한 단계: "Trigger & Processing Alignment"**
  - [ ] **원인**: Phase 3 전체가 "Verify if processor needs category"라는 모호한 지시만 있음. 실제 구현 단계가 아님.
  - [ ] **수정 제안**: Phase 3을 다음으로 교체:

    ```markdown
    ### Phase 3: Post-Upload Processing (Optional Enhancement)

    - [ ] **Client-Side Trigger**: After successful upload, call `POST /api/documents/process` with `{ documentId }` to trigger chunking.
      - _Note_: If chunking is automatic (via DB trigger or background job), skip this step.
    - [ ] **Processor Verification**: Ensure `documentProcessor` reads `category` from `user_documents.category` when creating chunks.
      - _File_: `frontend/src/lib/documentProcessor.ts` (or equivalent).
    ```

  - [ ] **파일/위치**: Lines 46-49 전체 교체

---

## 2) 🚨 리스크 및 안전장치 (Risk Guardrails)

### High-Risk: Regression on Existing Upload Flow

- [ ] **(High) 기존 기능 회귀: `rag_documents` 의존성**
  - [ ] **위험 요소**:
    - 기존 코드가 `rag_documents` 테이블을 직접 조회하는 곳이 있을 수 있음 (예: 문서 목록 조회, 검색).
    - `user_documents`로 변경 시 기존 업로드된 문서가 보이지 않을 수 있음.
  - [ ] **방어 코드 추가 제안**:
    ```markdown
    - [ ] **Migration Check**: Before switching to `user_documents`, verify if `rag_documents` has existing records.
      - If yes, consider creating a DB view that UNIONs `rag_documents` and `user_documents`, OR
      - Run a one-time migration script to copy `rag_documents` -> `user_documents`.
    - [ ] **Dual-Write (Temporary)**: For safety, write to BOTH `rag_documents` and `user_documents` during transition period.
      - Remove `rag_documents` write after confirming no regressions (1-2 weeks).
    ```
  - [ ] **파일/위치**: Add as new "Phase 0: Pre-Implementation Safety" before Phase 1.

### Mid-Risk: File Size & Processing Timeout

- [ ] **(Mid) 데이터/성능 이슈: Large File Upload**
  - [ ] **위험 요소**:
    - 대용량 파일 업로드 시 Vercel Function Timeout (10초 기본, 최대 60초).
    - `content` 필드에 너무 큰 텍스트 저장 시 DB 성능 저하.
  - [ ] **방어 로직 제안**:
    ```markdown
    - [ ] **File Size Limit**: Add validation in `upload/route.ts`:
      - `if (file.size > 10 * 1024 * 1024) return NextResponse.json({ error: 'File too large (max 10MB)' }, { status: 413 })`
    - [ ] **Content Length Guard**: When saving to `user_documents.content`, truncate if > 50,000 chars:
      - `content: extractedText.substring(0, 50000)`
    ```
  - [ ] **파일/위치**: Add to Phase 2, after "Save Metadata".

---

## 3) 🧪 검증 기준 구체화 (Test Criteria)

### Happy Path Tests

- [ ] **Happy Path 1: Standard Upload**

  - [ ] Upload a `.txt` file (< 1MB) with category '마케팅'.
  - [ ] Verify DB record: `SELECT * FROM user_documents WHERE category = '마케팅' ORDER BY created_at DESC LIMIT 1`.
  - [ ] Expected: `source = 'upload'`, `content` contains placeholder or extracted text.

- [ ] **Happy Path 2: RAFT Integration**
  - [ ] Navigate to `/admin/raft`.
  - [ ] Select category '마케팅' -> Click "DB에서 불러오기".
  - [ ] Expected: Uploaded file's content appears in context textarea.

### Edge Case Tests

- [ ] **Edge Case 1: Empty Category**

  - [ ] Upload file without selecting category (if UI allows).
  - [ ] Expected: DB record has `category = '미분류'` (DEFAULT_RAFT_CATEGORY).

- [ ] **Edge Case 2: Duplicate File Name**

  - [ ] Upload same file twice.
  - [ ] Expected: Both records saved (no unique constraint error). Verify `id` is different.

- [ ] **Edge Case 3: Large File (>10MB)**

  - [ ] Attempt to upload 15MB file.
  - [ ] Expected: API returns `413 Payload Too Large` error. No DB record created.

- [ ] **Edge Case 4: Non-Text File (Image)**
  - [ ] Upload `.png` file.
  - [ ] Expected:
    - File saved to Storage.
    - DB record created with `content = "(Binary file: image.png)"` or similar placeholder.
    - No crash/error.

---

## 4) 최종 판단 (Decision)

- [ ] **상태 선택**: ⚠️ **체크리스트 수정 후 진행**

- [ ] **가장 치명적인 결함 1줄 요약**:
  > "Phase 2에서 `user_documents.content` 필드를 채우는 로직이 누락되어, 업로드 후 RAFT가 빈 텍스트를 가져올 위험이 있음. Placeholder 삽입 또는 즉시 처리 트리거 필요."

---

## 📋 Revised Checklist (수정된 체크리스트)

### Phase 0: Pre-Implementation Safety (NEW)

- [ ] **Regression Check**: Query `rag_documents` for existing records. If count > 0, plan migration or dual-write strategy.
- [ ] **Backup Plan**: Document rollback procedure (revert to `rag_documents` if critical issues arise).

### Phase 1: Frontend UI Update

- [ ] **Import Components**:
  - `import { RAFT_CATEGORIES, DEFAULT_RAFT_CATEGORY } from '@/constants/raft'`
  - `import CategoryCombobox from '@/components/admin/CategoryCombobox'`
- [ ] **State Management**: `const [selectedCategory, setSelectedCategory] = useState(DEFAULT_RAFT_CATEGORY)`
- [ ] **UI Component**: Add `<CategoryCombobox value={selectedCategory} onChange={setSelectedCategory} />` below drag-drop area.
- [ ] **API Payload**: `formData.append('category', selectedCategory)` before fetch.

### Phase 2: Backend API Upgrade

- [ ] **Parse \u0026 Validate Category**:
  ```typescript
  const category =
    (formData.get("category") as string)?.trim() || DEFAULT_RAFT_CATEGORY;
  ```
- [ ] **File Size Validation**: `if (file.size > 10 * 1024 * 1024) return 413 error`
- [ ] **Switch Table**: Change insert target to `user_documents`.
- [ ] **Save Metadata**:
  ```typescript
  const { data, error } = await supabase.from("user_documents").insert({
    user_id: userId,
    title: file.name,
    content: `(File Uploaded: ${file.name})`, // Placeholder until processing
    category: category,
    source: "upload",
    file_path: uploadedPath,
  });
  ```
- [ ] **Trigger Processing** (Client-Side): Return `documentId` in response. Frontend calls `/api/documents/process` with `{ documentId }`.

### Phase 3: Verification

- [ ] **Happy Path**: Upload `.txt` with '마케팅' -> DB check -> RAFT fetch test.
- [ ] **Edge Cases**: Empty category, large file, duplicate, non-text file (4 tests listed above).

---

## 🎯 Action Items for Developer

1. **Update Checklist**: Apply all fixes from "Revised Checklist" section above.
2. **Implement Phase 0**: Check `rag_documents` table. If non-empty, discuss migration strategy with team.
3. **Code Review Focus**:
   - Verify `content` placeholder is set in `upload/route.ts`.
   - Confirm `DEFAULT_RAFT_CATEGORY` import exists.
4. **Test Execution**: Run all 6 test cases (2 Happy + 4 Edge) before marking complete.

---

**End of JeDebug Analysis**
