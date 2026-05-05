# Embedding Migration Implementation Checklist (Phase 1)

**Source:** `2601042100_RAG_2_0_Upgrade_Proposal.md`
**Author:** Tech Lead (Antigravity)
**Date:** 2026-01-04

---

## [Phase 1: Embedding Migration (Gemini to OpenAI)]

**Before Start:**

- ⚠️ **Critical Caution:** 이 작업은 `rag_chunks` 테이블의 데이터를 삭제하고 재생성합니다. 반드시 `user_documents`와 Supabase Storage(`rag-documents`)의 원본 파일이 존재하는지 확인해야 합니다.
- ⚠️ **Timeout Risk:** Vercel Pro Plan의 Serverless Function 제한 시간(약 60초)을 고려하여, **단일 문서 단위**로 처리하거나 클라이언트에서 순차 호출(Queueing)하는 방식을 사용해야 합니다.
- **Legacy Preservation:** 기존 `lib/ai/embedding.ts`의 Gemini 관련 코드는 삭제하지 않고 주석 처리하거나 Legacy로 남겨두어 만약의 사태(Rollback)에 대비하십시오.

### **Implementation Items**

#### [x] **ID(M-01)**: 마이그레이션 관리자 API 생성 ✅ (2026-01-05 완료)

- `Target`: `frontend/src/app/api/admin/migrate/route.ts` (New File)
- `Logic (Pseudo)`:

  ```typescript
  // 1. Admin Secret 확인 (간이 보안)
  if (headers.get("x-admin-secret") !== process.env.ADMIN_SECRET) return 401;

  // 2. 대상 문서 조회
  // 'pending' 상태이거나, query param으로 특정 docId가 오면 그것만 처리
  const { data: docs } = await supabase.from("user_documents").select("*");

  // 3. (Loop) 각 문서에 대해 처리 (Batch 처리가 아닌 단건 처리 권장)
  // Vercel Timeout 방지를 위해 API는 "처리할 문서 목록"만 반환하거나,
  // "특정 문서 하나"를 처리하는 모드로 동작하도록 설계.
  // 여기서는 Client-Side Loop를 위해 "List Mode"와 "Process Mode" 분리 제안.

  if (mode === "list") return docs;

  if (mode === "process") {
    const doc = await fetchDocument(docId);

    // Step A: 기존 청크 삭제
    await supabase.from("rag_chunks").delete().eq("document_id", docId);

    // Step B: 재처리 (Processor 호출)
    // documentProcessor 내부는 이미 OpenAI Config를 바라보도록 수정됨 (확인 완료)
    await processDocument(docId, userId);

    return { success: true, docId };
  }
  ```

- `Key Variables`: `ADMIN_SECRET`, `mode` ('list' | 'process'), `documentId`
- `Safety`:
  - `processDocument` 호출 시 `try-catch` 필수. 실패 시 해당 문서 상태를 'migration_failed'로 업데이트.
  - `user_id`가 없는 레거시 문서의 경우 `auth.getUser()`로 현재 관리자 ID를 주입하거나 예외 처리.

#### [x] **ID(M-02)**: 마이그레이션 실행 UI (Admin Page) ✅ (2026-01-05 완료)

- `Target`: `frontend/src/app/admin/migration/page.tsx` (New File - 임시 페이지)
- `Logic (Pseudo)`:

  ```typescript
  // 1. 문서 목록 로드
  const docs = await fetch("/api/admin/migrate?mode=list");

  // 2. 순차 처리 (Client-Side Queue for Timeout Prevention)
  for (const doc of docs) {
    setStatus(`Processing ${doc.name}...`);
    try {
      await fetch("/api/admin/migrate", {
        body: { mode: "process", documentId: doc.id },
      });
      setSuccessCount((prev) => prev + 1);
    } catch (e) {
      setErrorCount((prev) => prev + 1);
      log(e);
    }
  }
  ```

- `Key Variables`: `progress`, `totalDocs`, `currentDocName`
- `Safety`: 브라우저 탭을 닫지 않도록 `window.onbeforeunload` 경고 추가.

#### [x] **ID(M-03)**: 검색 임계값(Threshold) 복구 ✅ (2026-01-05 검증 완료 - 이미 0.5 표준값 적용됨)

- `Target`: `frontend/src/components/Assistant/SmartSearchTab.tsx`
- `Logic (Pseudo)`:
  ```typescript
  // 마이그레이션 완료 후 실행
  const searchResult = await searchDocuments(query, {
    topK: 5,
    threshold: 0.5, // [Revert] 0.1 -> 0.5 (표준값 복구)
    projectId,
  });
  ```

### **Definition of Done (검증)**

- [x] **Test (Migration)**: ✅ (2026-01-05 브라우저 테스트 완료)
  - ✅ 마이그레이션 페이지에서 "Start" 버튼 클릭 시, 진행률 바가 올라가는가? → 페이지 정상 로드, 0% 상태 (DB 비어있음)
  - ⏳ 완료 후 DB `document_chunks` 테이블의 `embedding` 컨럼 데이터가 1536차원(길이)인지 확인. → **데이터 업로드 후 확인 필요**
- [x] **Test (Search Quality)**: ❌ (2026-01-05 브라우저 테스트 - 마이그레이션 필요)
  - ❌ 마이그레이션 된 문서에 대해 검색 수행 시, 유사도가 **0.75 (75%)** 이상으로 나오는지 확인. → **32% 나옴 (임베딩 불일치)**
  - ⚠️ "현상" 검색 시 결과 없음 (50% threshold), 0%로 낮추면 결과 나옴 → **마이그레이션 후 재테스트 필요**
- [x] **Review**:
  - ✅ `processDocument` 함수가 `text-embedding-3-small`을 사용하고 있는지 재확인 (Code Review). → **확인 완료** (embedding.ts L27, L132)
  - ⚠️ 마이그레이션 완료 후 임시 Admin Page 및 API 비활성화 또는 접근 제어 확인. → **사용자 판단 필요**
