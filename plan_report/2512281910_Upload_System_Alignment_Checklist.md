# 📤 Upload System Alignment Checklist

> **Date**: 2025-12-28
> **Goal**: Enable "Category-Scoped Uploads" to fully align with the RAFT system.

## 1. Analysis & Design

### 1.1. Problem Statement

- **Current State**:
  - Upload API saves to `rag_documents` (Legacy/Variant table).
  - No `category` selection during upload.
  - Default category is `NULL` or 'Pending'.
- **Target State**:
  - Upload API saves to `user_documents` (Unified Knowledge Base).
  - User selects `category` (e.g., '마케팅') in UI.
  - Metadata saved: `category`, `source: 'upload'`.

### 1.2. Schema Verification

- **Target Table**: `user_documents`
- **Required Columns**: `id`, `user_id`, `title`, `content`, `category`, `source`, `created_at`.
- **Note**: File content must be extracted or stored. Currently `upload/route` saves to Storage + DB. We need to ensure text extraction is triggered or handled.
  - _Decision_: For now, focus on **Saving Metadata Correctly**. Text extraction (OC/Parsing) might be an existing separate process (`documentProcessor`). We will trigger it but ensure it updates `user_documents`.

## 2. Implementation Steps

### Phase 1: Frontend UI Update (DocumentUploader.tsx)

- [ ] **Import Constants**: `RAFT_CATEGORIES` from `@/constants/raft`.
- [ ] **State Management**: Add `selectedCategory` state (default: `RAFT_CATEGORIES[0]`).
- [ ] **UI Component**: Add `CategoryCombobox` (re-use from Admin) or simple `<select>` inside the upload modal/panel.
- [ ] **API Payload**: Append `category` to `FormData` on submit.

> **Target File**: `frontend/src/components/documents/DocumentUploader.tsx`

### Phase 2: Backend API Upgrade (upload/route.ts)

- [ ] **Parse Category**: Extract `category` from `formData`.
- [ ] **Switch Table**: Change `insert` target from `rag_documents` to `user_documents` (or ensure `rag_documents` syncs to `user_documents` if it's a view).
  - _Check_: If `rag_documents` is a separate table, we should migrate to use `user_documents` directly to match RAFT's source.
- [ ] **Save Metadata**: Include `category` in the `insert` query.

> **Target File**: `frontend/src/app/api/documents/upload/route.ts`

### Phase 3: Trigger & Processing Alignment

- [ ] **Processor Input**: Verify if `triggerDocumentProcessing` needs the `category` passed down to chunking logic.
  - _Note_: If chunking happens later, ensure the processor reads the `category` from the DB record.

## 3. Verification Plan

- [ ] **Upload Test**: Upload a file with category '마케팅'.
- [ ] **DB Check**: Verify record in `user_documents` has `category = '마케팅'`.
- [ ] **RAFT Connection**: Go to RAFT Admin -> Select '마케팅' -> Click 'DB Fetch' -> Confirm the uploaded text appears.

---

## 🔍 JeDebug Guidelines

- **Strict Table Usage**: Use `user_documents` as the source of truth.
- **Fail Safe**: unique category handling (trim, default if empty).
