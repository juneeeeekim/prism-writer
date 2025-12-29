# 🔴 Phase 0: Critical 에러 수정 상세 체크리스트

> **생성일**: 2025-12-29 03:13  
> **상위 문서**: [Architecture_Refactoring_Master_Plan.md](./2512290307_Architecture_Refactoring_Master_Plan.md)  
> **목표**: 리팩토링 검증이 가능한 상태로 만들기  
> **예상 소요**: 1~2시간

---

## 📌 현재 상태 분석

### ✅ 이미 해결된 항목 (Master Plan P0-03, P0-04)

| ID    | 항목                                | 파일                                                  | 상태    | 설명                             |
| ----- | ----------------------------------- | ----------------------------------------------------- | ------- | -------------------------------- |
| P0-03 | `HolisticFeedbackPanel` null safety | `components/Editor/HolisticFeedbackPanel.tsx:175-191` | ✅ 완료 | `!result` 체크 존재              |
| P0-04 | `holistic_result` 타입 정의         | `lib/judge/types.ts:61`                               | ✅ 완료 | `EvaluationResult`에 이미 정의됨 |

### ⚠️ 배포 확인 필요 항목 (Master Plan P0-01, P0-02)

| ID    | 항목               | 파일                                          | 상태         | 설명       |
| ----- | ------------------ | --------------------------------------------- | ------------ | ---------- |
| P0-01 | RPC 반환 타입 수정 | `202512290220_fix_rpc_return.sql`             | ⚠️ 배포 필요 | SQL 작성됨 |
| P0-02 | RLS 정책 추가      | `202512290140_fix_chunks_rls_and_columns.sql` | ⚠️ 배포 필요 | SQL 작성됨 |

---

## 📋 체크리스트

### P0-01: Supabase 마이그레이션 배포 상태 확인

**목표**: 최근 작성된 마이그레이션 SQL이 Supabase에 실제 적용되었는지 확인

**확인 대상 파일**:

- `202512290140_fix_chunks_rls_and_columns.sql`
- `202512290220_fix_rpc_return.sql`

**작업 내용**:

```sql
-- Supabase SQL Editor에서 실행하여 확인
-- 1. rag_chunks RLS 상태 확인
SELECT tablename, policyname
FROM pg_policies
WHERE tablename = 'rag_chunks';

-- 2. match_document_chunks 함수 반환 타입 확인
SELECT proname, pg_get_function_result(oid) as result_type
FROM pg_proc
WHERE proname = 'match_document_chunks';
```

**예상 결과**:

- RLS 정책 3개 존재 (SELECT, INSERT, DELETE)
- `match_document_chunks` 반환 타입에 `document_id uuid` 포함

**담당**: DB 엔지니어  
**상태**: ⬜ 미완료

---

### P0-02: `rag_chunks` RLS 정책 적용 (미적용 시)

**조건**: P0-01에서 RLS 정책이 없을 경우에만 실행

**작업 내용**: Supabase SQL Editor에서 다음 SQL 실행

```sql
-- 1. RLS 활성화
ALTER TABLE rag_chunks ENABLE ROW LEVEL SECURITY;

-- 2. SELECT 정책
CREATE POLICY "Users can select own chunks"
ON rag_chunks FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM user_documents
    WHERE id = rag_chunks.document_id
    AND user_id = auth.uid()
  )
);

-- 3. INSERT 정책
CREATE POLICY "Users can insert own chunks"
ON rag_chunks FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_documents
    WHERE id = rag_chunks.document_id
    AND user_id = auth.uid()
  )
);

-- 4. DELETE 정책
CREATE POLICY "Users can delete own chunks"
ON rag_chunks FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM user_documents
    WHERE id = rag_chunks.document_id
    AND user_id = auth.uid()
  )
);

-- 5. Schema Cache Reload
NOTIFY pgrst, 'reload schema';
```

**담당**: DB 엔지니어  
**상태**: ⬜ 미완료

---

### P0-03: RPC 함수 `match_document_chunks` 반환 타입 수정 (미적용 시)

**조건**: P0-01에서 `document_id` 컬럼이 반환 타입에 없을 경우에만 실행

**작업 내용**: Supabase SQL Editor에서 다음 SQL 실행

```sql
-- 1. 기존 함수 DROP (반환 타입 변경 시 필수)
DROP FUNCTION IF EXISTS match_document_chunks(vector, float, int, uuid, text);

-- 2. 새 함수 생성 (document_id 포함)
CREATE OR REPLACE FUNCTION match_document_chunks (
  query_embedding vector(1536),
  match_threshold float,
  match_count int,
  user_id_param uuid,
  category_param text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  document_id uuid,  -- 추가된 컬럼
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
    rc.document_id,
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

-- 3. Schema Cache Reload
NOTIFY pgrst, 'reload schema';
```

**담당**: DB 엔지니어  
**상태**: ⬜ 미완료

---

### P0-04: 개발 서버 실행 및 기본 동작 확인

**목표**: 로컬 환경에서 기본 기능 동작 확인

**작업 내용**:

```powershell
# 1. Frontend 디렉토리로 이동
cd frontend

# 2. 개발 서버 실행
npm run dev

# 3. 브라우저에서 확인
# http://localhost:3000 접속
```

**테스트 시나리오** (마스터 플랜 완료 기준과 동기화):

| #   | 테스트 항목                   | 수행 방법                                 | 예상 결과                      | 실제 결과 |
| --- | ----------------------------- | ----------------------------------------- | ------------------------------ | --------- |
| 1   | 빌드 성공                     | `npm run dev` 실행                        | 에러 없이 서버 시작            | ⬜        |
| 2   | 페이지 로드                   | 브라우저에서 `http://localhost:3000` 접속 | 로그인 또는 에디터 페이지 표시 | ⬜        |
| 3   | 문서 목록 조회                | 참고자료 탭 클릭                          | 문서 목록 표시 (또는 빈 상태)  | ⬜        |
| 4   | **문서 업로드 → 처리 → 검색** | 파일 업로드 후 처리 완료 대기             | 처리 완료, 검색 가능           | ⬜        |
| 5   | 평가 기능                     | 글 작성 후 "종합 평가하기" 클릭           | 평가 결과 표시                 | ⬜        |
| 6   | **평가 결과 저장/로드**       | 평가 후 페이지 새로고침                   | 저장된 평가 결과 복원          | ⬜        |
| 7   | 콘솔 에러                     | 개발자 도구 Console 탭 확인               | Critical 에러 없음             | ⬜        |

**담당**: QA 엔지니어  
**상태**: ⬜ 미완료

---

## ✅ Phase 0 완료 기준 (마스터 플랜과 동기화)

- [ ] Supabase에 RLS 정책 적용 완료 (P0-02)
- [ ] RPC 함수 반환 타입 `document_id` 포함 확인 (P0-01)
- [ ] `npm run dev` 에러 없이 실행
- [ ] **문서 업로드 → 처리 → 검색 기본 흐름 동작** ⭐
- [ ] **평가 결과 저장/로드 정상 동작** ⭐
- [ ] 콘솔에 Critical 에러 없음

> ⭐ 마스터 플랜에서 강조된 핵심 완료 기준

---

## 📊 진행률

```
P0-01 [✅] Supabase 마이그레이션 배포 상태 확인 (6개 RLS 정책 + RPC document_id 확인됨)
P0-02 [⏭️ SKIP] rag_chunks RLS 정책 적용 (이미 적용됨)
P0-03 [✅] HolisticFeedbackPanel null safety (이미 해결됨)
P0-04 [✅] holistic_result 타입 정의 (이미 해결됨)
P0-05 [⏭️ SKIP] match_document_chunks 반환 타입 수정 (이미 적용됨)
P0-06 [⬜] 개발 서버 실행 및 기본 동작 확인

완료: 4/6 (67%) - DB 마이그레이션 확인 완료
```

---

## 🚀 다음 단계

Phase 0 완료 후 → [Phase 1: RAG 기반 계층 재정비](./2512290313_Phase1_RAG_Foundation_Checklist.md)
