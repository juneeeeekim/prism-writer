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

- [/] **P0-05-B**: E2E 동작 검증 (진행 중 - 로그인 필요)

  - `Target`: Browser > `http://localhost:3000`
  - `Results` (2025-12-29 20:20):

    - ✅ **Test 1**: 페이지 로드 → PASS (PRISM Writer 랜딩 페이지 정상 표시)
    - ⚠️ **Test 2**: 로그인 → 로그인 페이지로 리디렉션 (Google SSO / Email 로그인 옵션)
    - ✅ **Test 3**: 콘솔 에러 → PASS (Critical 에러 없음, hydration warning만 존재)
    - ⏳ **Test 4-7**: 로그인 후 진행 필요

  - `Target`: Browser > `http://localhost:3000`
  - `Logic (Pseudo)`:

    ```
    [Test 1] 페이지 로드
      if (페이지 로드 성공) → PASS
      else → FAIL, 콘솔 에러 확인

    [Test 2] 로그인
      if (로그인 성공) → PASS
      else → FAIL, auth 에러 확인

    [Test 3] 문서 목록 조회
      > 참고자료 탭 클릭
      if (문서 목록 표시 OR 빈 상태) → PASS
      if (에러 메시지) → FAIL, API 응답 확인

    [Test 4] 문서 업로드 → 처리 → 검색 ⭐
      > 참고자료 탭 > 파일 업로드 > 처리 완료 대기
      > 채팅 탭 > 업로드한 문서 관련 질문
      if (관련 응답 생성) → PASS
      if ("Failed to fetch chunks" 에러) → FAIL, RPC 확인

    [Test 5] 평가 기능 ⭐
      > 에디터에 100자 이상 글 작성
      > "종합 평가하기" 클릭
      if (점수 + 피드백 표시) → PASS
      if (에러 메시지) → FAIL, API 응답 확인

    [Test 6] 평가 결과 저장/로드 ⭐
      > Test 5 완료 후 페이지 새로고침 (F5)
      if (이전 평가 결과 복원) → PASS
      if (빈 상태) → FAIL, DB 저장 확인

    [Test 7] 콘솔 에러 확인
      > DevTools > Console 탭
      if (Critical 에러 없음) → PASS
      if (red error 존재) → FAIL, 해당 에러 해결
    ```

  - `Key Variables`:
    - ⭐ Test 4, 5, 6은 마스터 플랜 핵심 완료 기준
  - `Safety`:
    - 테스트 실패 시 해당 에러 로그 캡처
    - 캡처 후 Phase 0 다시 검토

---

## ✅ Definition of Done (DoD)

### 필수 완료 조건

| #   | 항목                               | 검증 방법                                                           | 상태 |
| --- | ---------------------------------- | ------------------------------------------------------------------- | ---- |
| 1   | RLS 정책 3개 존재                  | `SELECT * FROM pg_policies WHERE tablename = 'rag_chunks'` → 3 rows | ⬜   |
| 2   | RPC 반환 타입에 `document_id` 포함 | `pg_get_function_result` 확인                                       | ⬜   |
| 3   | `npm run dev` 에러 없이 실행       | 콘솔에 빨간 에러 없음                                               | ⬜   |
| 4   | 문서 업로드 → 처리 → 검색 동작     | 채팅에서 관련 문서 언급                                             | ⬜   |
| 5   | 평가 결과 저장/로드 정상           | 새로고침 후 결과 복원                                               | ⬜   |
| 6   | 콘솔 Critical 에러 없음            | DevTools Console 확인                                               | ⬜   |

### 코드 품질 체크

- [ ] 불필요한 `console.log` 제거 (디버깅용 로그 정리)
- [ ] SQL 실행 후 `NOTIFY pgrst` 호출 확인
- [ ] 마이그레이션 파일에 주석 존재 확인

---

## 📊 예상 소요 시간

| 작업                      | 시간      | 병렬 가능         |
| ------------------------- | --------- | ----------------- |
| P0-01: 배포 상태 확인     | 5분       | -                 |
| P0-02: RLS 정책 적용      | 10분      | No (P0-01 후)     |
| P0-03: RPC 함수 수정      | 10분      | No (P0-02 후)     |
| P0-04: 코드 검증 (확인만) | 5분       | Yes               |
| P0-05: E2E 테스트         | 30분      | No (모든 작업 후) |
| **총계**                  | **~60분** |                   |

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
