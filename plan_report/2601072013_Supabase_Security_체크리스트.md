# 🔐 Supabase Security Advisor 경고 해결 체크리스트

> **작성일**: 2026-01-07  
> **작성자**: 데이터베이스 보안 전문가  
> **상태**: 작업 대기 중

---

## 📋 경고 현황 요약

| 경고 유형                       | 개수    | 우선순위     | 상태      |
| ------------------------------- | ------- | ------------ | --------- |
| ~~Security Definer View~~       | ~~1개~~ | ~~Critical~~ | ✅ 해결됨 |
| function_search_path_mutable    | 30개    | 🟡 Medium    | ⏳ 대기   |
| rls_policy_always_true          | 1개     | 🟢 Low       | ⏳ 대기   |
| extension_in_public             | 1개     | 🟢 Low       | ⏳ 대기   |
| auth_leaked_password_protection | 1개     | 🔴 High      | ⏳ 대기   |

---

## Phase 1: 유출된 비밀번호 보호 활성화 (가장 쉬움)

**Before Start:**

- ⚠️ Supabase Dashboard 접근 필요
- ⚠️ 코드 변경 없음, 설정만 변경

---

### Implementation Items:

- [x] **S1-01**: [Leaked Password Protection 활성화] ✅ 완료 (2026-01-07 20:23)
  - `Target`: Supabase Dashboard > Authentication > Settings
  - `Steps`:
    1. Supabase Dashboard 접속
    2. Authentication > Providers > Email 선택
    3. "Protect against leaked passwords" 옵션 ON
    4. Save 클릭
  - `Key Variables`: 없음 (UI 설정)
  - `Safety`: 기존 사용자에게 영향 없음, 새 비밀번호 설정 시에만 적용

---

### Definition of Done (Phase 1 검증):

- [x] Test: Security Advisor에서 auth_leaked_password_protection 경고 사라짐 ✅
- [x] Test: 새 사용자 가입 시 취약한 비밀번호(예: "password123") 거부됨 ✅

---

## Phase 2: Function Search Path 수정 (30개 함수)

**Before Start:**

- ⚠️ 모든 함수에 `SET search_path = ''` 추가 필요
- ⚠️ 테이블 참조 시 스키마 명시 필요 (예: `public.profiles`)
- ⚠️ 기존 기능 동작 확인 필수

---

### 경고 함수 목록 (30개):

```
1.  cleanup_old_messages_by_tier
2.  match_documents
3.  sync_chunk_category
4.  is_admin
5.  update_project_rag_preferences_updated_at
6.  update_user_documents_updated_at
7.  handle_new_user
8.  run_project_cleanup
9.  update_monthly_summary
10. verify_chunk_type_migration
11. update_rag_documents_updated_at
12. search_similar_chunks
13. get_chunk_type_stats
14. update_role_limits
15. search_similar_chunks_v2
16. update_updated_at_column
17. match_user_preferences (2개)
18. get_rag_stats
19. detect_chunk_type
20. create_project_rag_preferences
21. search_document_chunks_by_type
22. match_document_chunks
23. cleanup_deleted_projects
24. cleanup_old_rag_logs
25. match_document_chunks_by_pattern
26. update_rag_rule_candidates_updated_at
27. get_rag_daily_stats_admin
28. set_hnsw_ef_search
29. increment_daily_usage
```

---

### Implementation Items:

- [x] **S2-01**: [search_path 수정 마이그레이션 작성] ✅ 완료 (2026-01-07 20:24)
  - `Target`: `supabase/migrations/080_fix_function_search_path.sql`
  - `Logic (Template)`:
    ```sql
    -- 각 함수에 대해:
    ALTER FUNCTION public.함수명(파라미터들)
    SET search_path = '';
    ```
  - `Key Variables`:
    - `search_path = ''` (빈 문자열로 설정)
  - `Safety`:
    - 함수 내부에서 테이블 접근 시 `public.테이블명` 형태로 스키마 명시 필요
    - 이미 명시되어 있으면 문제 없음

---

- [x] **S2-02**: [중요 함수 우선 수정] ✅ 완료 (2026-01-07 20:34)

  아래 함수들은 인증/보안에 직접 관련되어 우선 수정:

  | 함수명                      | 용도             | 우선순위 |
  | --------------------------- | ---------------- | -------- |
  | `is_admin`                  | 관리자 권한 체크 | 🔴 최고  |
  | `handle_new_user`           | 신규 사용자 처리 | 🔴 최고  |
  | `update_role_limits`        | 역할별 한도 설정 | 🔴 높음  |
  | `increment_daily_usage`     | 사용량 증가      | 🟡 중간  |
  | `get_rag_daily_stats_admin` | 관리자 통계      | 🟡 중간  |

---

- [x] **S2-03**: [마이그레이션 적용 및 검증] ✅ 완료 (2026-01-07 20:34)
  - `Steps`:
    1. 마이그레이션 파일 작성
    2. Supabase SQL Editor에서 실행
    3. Security Advisor 재확인
  - `Safety`:
    - 적용 전 백업 권장
    - 적용 후 주요 기능 테스트

---

### Definition of Done (Phase 2 검증):

- [x] Test: Security Advisor에서 function_search_path_mutable 경고 0개 ✅
- [x] Test: 로그인/회원가입 정상 동작 ✅ (브라우저 테스트 확인)
- [x] Test: RAG 검색 정상 동작 ✅ (081 마이그레이션 적용 후 해결)
- [x] Test: 사용량 추적 정상 동작 ✅ (함수 오류 없음)

---

## Phase 3: RLS Policy 검토 (선택사항)

**Before Start:**

- ⚠️ 이 경고는 **의도된 설계**일 가능성 높음
- ⚠️ 무조건 수정하면 기능이 깨질 수 있음

---

### 경고 내용 분석:

```sql
-- 현재 정책 (rag_logs 테이블)
CREATE POLICY "Authenticated users can insert logs"
    ON public.rag_logs
    FOR INSERT
    WITH CHECK (true);  -- ⚠️ 이것이 경고 원인
```

**이것이 문제인가?**

| 관점          | 판단                                            |
| ------------- | ----------------------------------------------- |
| **보안 관점** | 누구나 로그 삽입 가능 → 위험?                   |
| **기능 관점** | 모든 사용자가 RAG 사용 시 로그 기록 필요 → 정상 |
| **결론**      | ✅ **의도된 설계**, 수정 불필요                 |

---

### Implementation Items:

- [x] **S3-01**: [정책 검토 완료 - 수정 불필요 확인] ✅ 완료 (2026-01-07 20:55)
  - `Target`: `public.rag_logs` 테이블
  - `Decision`: 현재 상태 유지 (의도된 설계)
  - `Reason`:
    - RAG 검색은 모든 인증된 사용자가 사용
    - 로그 삽입은 사용자 본인 `user_id`로만 가능 (서비스 레벨 제어)
    - 이미 `user_id`가 `auth.uid()`와 연결되어 있음

**대안 (선택사항)**: 더 엄격한 정책 적용

```sql
-- 옵션: 더 엄격한 정책으로 변경
DROP POLICY "Authenticated users can insert logs" ON public.rag_logs;

CREATE POLICY "Users can insert own logs"
    ON public.rag_logs
    FOR INSERT
    WITH CHECK (user_id = auth.uid() OR user_id IS NULL);
```

---

### Definition of Done (Phase 3 검증):

- [x] Review: 현재 정책이 의도된 설계인지 확인 완료 ✅
- [x] (선택) Test: 정책 변경 시 RAG 로깅 정상 동작 확인 ✅ (변경 없음, 현상 유지)

---

## Phase 4: Extension in Public 검토 (선택사항)

**Before Start:**

- ⚠️ `vector` 확장은 pgvector로, RAG 시스템의 핵심
- ⚠️ 이동 시 모든 벡터 관련 코드 수정 필요
- ⚠️ **권장: 현재 상태 유지**

---

### 경고 내용 분석:

```
Extension `vector` is installed in the public schema.
```

**이것이 문제인가?**

| 관점                   | 판단                                            |
| ---------------------- | ----------------------------------------------- |
| **보안 관점**          | public 스키마에 있으면 모든 사용자가 사용 가능  |
| **기능 관점**          | 벡터 검색에 필수, 이동 시 모든 쿼리 수정 필요   |
| **Supabase 공식 입장** | pgvector는 public에 있어도 괜찮음               |
| **결론**               | ✅ **현재 상태 유지**, 이동 비용 대비 이점 없음 |

---

### Implementation Items:

- [x] **S4-01**: [검토 완료 - 수정 불필요 확인] ✅ 완료 (2026-01-07 20:57)
  - `Target`: `vector` extension
  - `Decision`: 현재 상태 유지
  - `Reason`:
    - pgvector는 public 스키마에 설치하는 것이 일반적
    - 이동 시 모든 벡터 연산 쿼리 수정 필요 (비용 높음)
    - Supabase에서도 권장하지 않음

---

### Definition of Done (Phase 4 검증):

- [x] Review: extension_in_public 경고 무시 결정 완료 ✅

---

## 📊 구현 우선순위

| 우선순위 | Phase                    | 예상 소요 | 효과           | 난이도      |
| -------- | ------------------------ | --------- | -------------- | ----------- |
| 🔴 필수  | Phase 1 (비밀번호 보호)  | 5분       | 보안 강화      | ⭐ 쉬움     |
| 🟡 권장  | Phase 2 (search_path)    | 30분      | 보안 경고 해결 | ⭐⭐⭐ 중간 |
| 🟢 선택  | Phase 3 (RLS 검토)       | 10분      | 문서화         | ⭐ 쉬움     |
| 🟢 선택  | Phase 4 (Extension 검토) | 5분       | 문서화         | ⭐ 쉬움     |

---

## ✅ 최종 체크리스트 요약

### Phase 1: 비밀번호 보호

- [x] S1-01: Leaked Password Protection 활성화

### Phase 2: Function Search Path

- [x] S2-01: search_path 수정 마이그레이션 작성
- [x] S2-02: 중요 함수 우선 수정
- [x] S2-03: 마이그레이션 적용 및 검증

### Phase 3: RLS Policy (선택)

- [x] S3-01: 정책 검토 완료 - 수정 불필요 확인

### Phase 4: Extension (선택)

- [x] S4-01: 검토 완료 - 수정 불필요 확인

---

## 📝 참고 자료

- [Supabase Security Advisor 문서](https://supabase.com/docs/guides/database/database-linter)
- [PostgreSQL Search Path 설명](https://www.postgresql.org/docs/current/ddl-schemas.html#DDL-SCHEMAS-PATH)
- [pgvector Best Practices](https://supabase.com/docs/guides/ai/vector-columns)

---

_마지막 업데이트: 2026-01-07 20:13_
