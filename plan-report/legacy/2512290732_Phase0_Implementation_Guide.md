# 🔴 Phase 0: Critical 에러 수정 - 구현 지시서

> **문서 유형**: Tech Lead Implementation Guide  
> **생성일**: 2025-12-29 07:32  
> **원본 설계**: [Phase0 체크리스트](./2512290313_Phase0_Critical_Fix_Checklist.md)  
> **마스터 플랜**: [Architecture Refactoring Master Plan](./2512290307_Architecture_Refactoring_Master_Plan.md)  
> **목표**: 리팩토링 검증 가능 상태 확보 (1~2시간)

---

## ⚠️ Before Start - 주의사항

### 절대 건드리지 말 것 (레거시 보호)

| 파일                                          | 이유                                              |
| --------------------------------------------- | ------------------------------------------------- |
| `lib/rag/search.ts` > `hybridSearch()`        | 현재 정상 동작 중, 이번 Phase에서 수정 불필요     |
| `lib/judge/alignJudge.ts`                     | 평가 로직 안정화됨, Phase 3에서 확장 예정         |
| `components/Editor/HolisticFeedbackPanel.tsx` | **이미 null safety 적용됨 (P0-03 완료)**          |
| `lib/judge/types.ts:61`                       | **이미 `holistic_result` 필드 존재 (P0-04 완료)** |

### 회귀 테스트 필수 포인트

```
[회귀 체크] 평가 API 호출 → vectorSearch() → match_document_chunks RPC
───────────────────────────────────────────────────────────────────────
search.ts:195-201  ───▶  supabase.rpc('match_document_chunks', {...})
                              ↓
                   반환값: { id, document_id, content, metadata, similarity }
                              ↓
search.ts:208-214  ───▶  chunkId: item.chunk_id  ⚠️ 여기서 매핑 확인 필요!
```

---

## 📋 Implementation Items

### P0-01: Supabase 마이그레이션 배포 상태 확인

**담당**: DB 엔지니어  
**우선순위**: 🔴 Critical (다른 작업 선행 조건)

---

- [x] **P0-01-A**: RLS 정책 배포 상태 확인 ✅ **PASS (6개 정책 확인됨)**

  - `Target`: Supabase SQL Editor
  - `Result`: ✅ **6개 RLS 정책 존재** (2025-12-29 20:12 확인)
    - Users can select own chunks (SELECT)
    - Users can insert own chunks (INSERT)
    - Users can delete own chunks (DELETE)
    - Users can view own document chunks (SELECT)
    - Users can insert own document chunks (INSERT)
    - Users can delete own document chunks (DELETE)
  - `Safety`: SELECT 쿼리만 실행, 데이터 변경 없음

---

- [x] **P0-01-B**: RPC 함수 반환 타입 확인 ✅ **PASS (document_id 포함)**

  - `Target`: Supabase SQL Editor
  - `Result`: ✅ **document_id uuid 포함됨** (2025-12-29 20:14 확인)
    - `TABLE(id uuid, document_id uuid, content text, metadata jsonb, similarity double precision)`
  - `Safety`: SELECT 쿼리만 실행, 데이터 변경 없음

---

### P0-02: `rag_chunks` RLS 정책 적용

**조건**: P0-01-A에서 정책이 없을 경우에만 실행  
**담당**: DB 엔지니어  
**우선순위**: 🔴 Critical (보안 필수)

---

- [x] **P0-02-A**: RLS 활성화 및 정책 생성 ⏭️ **SKIPPED (이미 배포됨)**

  - `Result`: P0-01-A에서 6개 RLS 정책 확인됨 → 실행 불필요

  - `Target`: Supabase SQL Editor > `202512290140_fix_chunks_rls_and_columns.sql`
  - `Logic (Pseudo)`:

    ```sql
    -- [TRANSACTION START]

    -- Step 1: RLS 활성화
    ALTER TABLE rag_chunks ENABLE ROW LEVEL SECURITY;
    -- Expected: 에러 없음, 또는 "already enabled" 경고 (무시 가능)

    -- Step 2: 기존 정책 DROP (idempotent)
    DROP POLICY IF EXISTS "Users can select own chunks" ON rag_chunks;
    DROP POLICY IF EXISTS "Users can insert own chunks" ON rag_chunks;
    DROP POLICY IF EXISTS "Users can delete own chunks" ON rag_chunks;
    -- Expected: 정책 있으면 DROP, 없으면 무시

    -- Step 3: SELECT 정책 생성
    CREATE POLICY "Users can select own chunks"
    ON rag_chunks FOR SELECT
    USING (
      EXISTS (
        SELECT 1 FROM user_documents
        WHERE id = rag_chunks.document_id
        AND user_id = auth.uid()
      )
    );
    -- Expected: 성공 메시지

    -- Step 4: INSERT 정책 생성
    CREATE POLICY "Users can insert own chunks"
    ON rag_chunks FOR INSERT
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM user_documents
        WHERE id = rag_chunks.document_id
        AND user_id = auth.uid()
      )
    );
    -- Expected: 성공 메시지

    -- Step 5: DELETE 정책 생성
    CREATE POLICY "Users can delete own chunks"
    ON rag_chunks FOR DELETE
    USING (
      EXISTS (
        SELECT 1 FROM user_documents
        WHERE id = rag_chunks.document_id
        AND user_id = auth.uid()
      )
    );
    -- Expected: 성공 메시지

    -- Step 6: Schema Cache Reload
    NOTIFY pgrst, 'reload schema';
    -- Expected: 에러 없음

    -- [TRANSACTION END]
    ```

  - `Key Variables`:
    - `rag_chunks.document_id` (FK to `user_documents.id`)
    - `auth.uid()` (현재 인증된 사용자 ID)
  - `Safety`:
    - ⚠️ 정책 생성 전 기존 정책 DROP 필수 (중복 방지)
    - ⚠️ `NOTIFY pgrst` 실행 필수 (PostgREST 캐시 갱신)

---

### P0-03: RPC 함수 반환 타입 수정

**조건**: P0-01-B에서 `document_id` 없을 경우에만 실행  
**담당**: DB 엔지니어  
**우선순위**: 🔴 Critical (API 동작 필수)

---

- [x] **P0-03-A**: `match_document_chunks` 함수 재생성 ⏭️ **SKIPPED (이미 배포됨)**

  - `Result`: P0-01-B에서 `document_id uuid` 포함 확인됨 → 실행 불필요

  - `Target`: Supabase SQL Editor > `202512290220_fix_rpc_return.sql`
  - `Logic (Pseudo)`:

    ```sql
    -- [TRANSACTION START]

    -- Step 1: 기존 함수 DROP (반환 타입 변경 시 필수)
    DROP FUNCTION IF EXISTS match_document_chunks(vector, float, int, uuid, text);
    -- Expected: 함수 있으면 DROP, 없으면 무시
    -- ⚠️ WARNING: 이 시점에 API 호출 시 에러 발생 (다운타임 ~1초)

    -- Step 2: 새 함수 생성 (document_id 포함)
    CREATE OR REPLACE FUNCTION match_document_chunks (
      query_embedding vector(1536),
      match_threshold float,
      match_count int,
      user_id_param uuid,
      category_param text DEFAULT NULL
    )
    RETURNS TABLE (
      id uuid,
      document_id uuid,  -- ⭐ 추가된 컬럼
      content text,
      metadata jsonb,
      similarity float
    )
    LANGUAGE plpgsql
    AS $$
    BEGIN
      RETURN QUERY
      SELECT
        rc.id,
        rc.document_id,  -- ⭐ 추가된 컬럼
        rc.content,
        rc.metadata,
        1 - (rc.embedding <=> query_embedding) as similarity
      FROM rag_chunks rc
      JOIN user_documents ud ON rc.document_id = ud.id
      WHERE 1 - (rc.embedding <=> query_embedding) > match_threshold
      AND ud.user_id = user_id_param
      AND (category_param IS NULL OR ud.category = category_param)
      ORDER BY rc.embedding <=> query_embedding
      LIMIT match_count;
    END;
    $$;
    -- Expected: 성공 메시지

    -- Step 3: Schema Cache Reload
    NOTIFY pgrst, 'reload schema';
    -- Expected: 에러 없음

    -- [TRANSACTION END]
    ```

  - `Key Variables`:
    - 입력: `query_embedding` (1536차원 벡터)
    - 입력: `user_id_param` (UUID)
    - 입력: `category_param` (NULL 허용)
    - 출력: `document_id` (UUID) ⭐ **핵심 추가**
  - `Safety`:
    - ⚠️ DROP → CREATE 사이 약 1초 다운타임 발생
    - ⚠️ 프로덕션에서는 저트래픽 시간에 실행 권장
    - ⚠️ `NOTIFY pgrst` 실행 필수 (PostgREST 캐시 갱신)

---

### P0-04: Frontend 코드 검증 (변경 불필요, 확인만)

**담당**: Frontend 개발자  
**우선순위**: 🟡 확인 작업

---

- [x] **P0-04-A**: `search.ts` RPC 호출 매핑 확인 ✅ **FIX APPLIED**

  - `Target`: `frontend/src/lib/rag/search.ts`
  - `Result`: ⚠️ **불일치 발견 및 수정 완료** (2025-12-29)
    - RPC 반환: `id`
    - 기존 코드: `item.chunk_id` (3곳)
    - 수정: `item.id`로 변경 (Line 209, 250, 272)
    - 주석 추가: `[P0-01-D Fix]`
  - `Verification`: ✅ `npm run build` Exit code: 0, Syntax errors: 0

---

### P0-05: 개발 서버 실행 및 기본 동작 확인

**담당**: QA 엔지니어  
**우선순위**: 🔴 Critical (최종 검증)

---

- [x] **P0-05-A**: 빌드 및 서버 시작 ✅ **PASS**

  - `Target`: Terminal > `frontend/`
  - `Result`: ✅ **성공** (2025-12-29 20:20)
    - Next.js 14.0.4
    - Local: http://localhost:3000
    - Ready in 2.5s
  - `Safety`: `ctrl+c`로 언제든 서버 종료 가능

---

- [x] **P0-05-B**: E2E 동작 검증 ✅ **ALL PASS**

  - `Target`: Browser > `http://localhost:3000/editor`
  - `Final Results` (2025-12-29 20:25):

    | Test | 항목              | 결과    | 상세                                                        |
    | ---- | ----------------- | ------- | ----------------------------------------------------------- |
    | 1    | 페이지 로드       | ✅ PASS | PRISM Writer 랜딩 페이지 정상                               |
    | 2    | 로그인            | ✅ PASS | 에디터 접근 성공                                            |
    | 3    | 콘솔 에러         | ✅ PASS | Critical 에러 없음                                          |
    | 4    | 문서 목록 조회 ⭐ | ✅ PASS | 1개 문서 표시 (`2512_bpt_풀링컨텐츠_분석_강의.pdf` ✅ 완료) |
    | 5    | 평가 기능 ⭐      | ✅ PASS | 종합 평가 버튼 정상, 기존 결과 90점 표시                    |
    | 6    | 평가 저장/로드 ⭐ | ✅ PASS | 이전 평가 결과 복원 확인                                    |
    | 7    | 최종 콘솔 확인    | ⚠️ WARN | 406 에러 (llm_usage API만, 핵심 기능 무관)                  |

  - `Key Variables`:
    - ⭐ Test 4, 5, 6 마스터 플랜 핵심 완료 기준 **모두 충족**
  - `Note`: 406 에러는 사용량 통계 API 관련, 핵심 기능에 영향 없음

---

## ✅ Definition of Done (DoD)

### 필수 완료 조건

| #   | 항목                               | 검증 방법                                                               | 상태                  |
| --- | ---------------------------------- | ----------------------------------------------------------------------- | --------------------- |
| 1   | RLS 정책 3개 존재                  | `SELECT * FROM pg_policies WHERE tablename = 'rag_chunks'` → **6 rows** | ✅ (2025-12-29 20:12) |
| 2   | RPC 반환 타입에 `document_id` 포함 | `pg_get_function_result` 확인 → **포함됨**                              | ✅ (2025-12-29 20:14) |
| 3   | `npm run dev` 에러 없이 실행       | Next.js 14.0.4, Ready in 2.5s                                           | ✅ (2025-12-29 20:20) |
| 4   | 문서 업로드 → 처리 → 검색 동작     | 참고자료 탭에 1개 문서 처리 완료 표시                                   | ✅ (2025-12-29 20:25) |
| 5   | 평가 결과 저장/로드 정상           | 새로고침 후 90점 결과 복원 확인                                         | ✅ (2025-12-29 20:25) |
| 6   | 콘솔 Critical 에러 없음            | DevTools Console 확인 → **Critical 없음** (406 usage API만)             | ✅ (2025-12-29 20:25) |

### 코드 품질 체크

- [x] 코드 수정 주석 추가: `[P0-01-D Fix]`
- [x] SQL 파일에 주석 존재 확인 (`202512290140_fix_chunks_rls_and_columns.sql`, `202512290220_fix_rpc_return.sql`)
- [x] 배포 완료: commit `97d5bbb` → origin/main push 완료

---

## 📊 실제 소요 시간 (완료)

| 작업                    | 예상      | 실제      | 상태                |
| ----------------------- | --------- | --------- | ------------------- |
| P0-01: 배포 상태 확인   | 5분       | ~15분     | ✅ 완료 (20:12)     |
| P0-02: RLS 정책 적용    | 10분      | ⏭️ SKIP   | ✅ 이미 배포됨      |
| P0-03: RPC 함수 수정    | 10분      | ⏭️ SKIP   | ✅ 이미 배포됨      |
| P0-04: 코드 검증 + 수정 | 5분       | ~10분     | ✅ 완료 (20:00)     |
| P0-05: E2E 테스트       | 30분      | ~15분     | ✅ 완료 (20:25)     |
| 배포                    | -         | ~3분      | ✅ 완료 (20:23)     |
| **총계**                | **~60분** | **~45분** | ✅ **Phase 0 완료** |

> 📝 **Note**: P0-02, P0-03은 이미 Supabase에 배포되어 있어 SKIP 처리됨

---

## 🚨 Rollback Plan

### RLS 정책 롤백

```sql
-- 긴급 롤백: RLS 정책 제거
DROP POLICY IF EXISTS "Users can select own chunks" ON rag_chunks;
DROP POLICY IF EXISTS "Users can insert own chunks" ON rag_chunks;
DROP POLICY IF EXISTS "Users can delete own chunks" ON rag_chunks;
ALTER TABLE rag_chunks DISABLE ROW LEVEL SECURITY;
NOTIFY pgrst, 'reload schema';
```

### RPC 함수 롤백 (document_id 제거)

```sql
-- 긴급 롤백: 이전 버전 복원
DROP FUNCTION IF EXISTS match_document_chunks(vector, float, int, uuid, text);
CREATE OR REPLACE FUNCTION match_document_chunks (
  query_embedding vector(1536),
  match_threshold float,
  match_count int,
  user_id_param uuid,
  category_param text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  content text,
  metadata jsonb,
  similarity float
)
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT rc.id, rc.content, rc.metadata,
    1 - (rc.embedding <=> query_embedding) as similarity
  FROM rag_chunks rc
  JOIN user_documents ud ON rc.document_id = ud.id
  WHERE 1 - (rc.embedding <=> query_embedding) > match_threshold
  AND ud.user_id = user_id_param
  ORDER BY rc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
NOTIFY pgrst, 'reload schema';
```

---

## 🚀 Next Step

Phase 0 완료 후 → [Phase 1 구현 지시서](./2512290732_Phase1_Implementation_Guide.md) (별도 생성 예정)
