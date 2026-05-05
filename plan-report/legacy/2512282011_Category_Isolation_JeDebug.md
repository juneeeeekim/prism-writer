# 🔍 JeDebug Analysis: 카테고리 데이터 격리 고도화 체크리스트

**Date**: 2025-12-28 20:11  
**Analyst**: Senior Lead Developer (JeDebug)  
**Target Document**: `2512282008_Category_Isolation_체크리스트.md`  
**Framework**: L.I.V.E (Logic, Implementation, Verification, Environment/Risk)

---

## 1) 🔧 로직 및 구현 보완 (Logic Fixes)

### Critical Logic Gaps

- [ ] **(Critical) 누락된 로직: `document_chunks` 테이블에 `category` 컬럼 부재**

  - [ ] **원인**: B-02에서 `document_chunks.eq('category', category)` 쿼리를 제안하지만, `document_chunks` 테이블에는 `category` 컬럼이 없을 가능성 높음. `category`는 `user_documents` 테이블에 존재.
  - [ ] **수정 제안**: B-02의 Supabase 쿼리를 다음으로 교체:

    ```typescript
    // Option A: user_documents에서 문서 ID 먼저 조회
    const { data: docs } = await supabase
      .from("user_documents")
      .select("id")
      .eq("category", category);

    const docIds = docs?.map((d) => d.id) || [];

    const { data: chunks } = await supabase
      .from("document_chunks")
      .select("content, chunk_content")
      .in("document_id", docIds);
    ```

  - [ ] **파일/위치**: 체크리스트 Line 162-169 교체

- [ ] **(Critical) 누락된 단계: `generateSyntheticDataAPI` 함수 시그니처 수정**

  - [ ] **원인**: A-04에서 함수 호출 시 `useExistingChunks` 파라미터 추가를 언급하지만, 실제 함수 수정 단계가 별도 항목으로 존재하지 않음.
  - [ ] **수정 제안**: Phase A에 **A-05** 항목 추가:
    ````markdown
    - [ ] **A-05**: `generateSyntheticDataAPI` 함수 시그니처 수정
      - `Target`: `frontend/src/lib/api/raft.ts`
      - `Detail`:
        1. 기존 시그니처 확인 및 수정:
           ```typescript
           export async function generateSyntheticDataAPI(
             context: string,
             count: number,
             category: string,
             modelId: string,
             useExistingChunks: boolean = false // NEW
           ): Promise<GenerationResponse>;
           ```
        2. API 호출 body에 `useExistingChunks` 포함
      - `Dependency`: A-04 이전에 완료 필수
    ````
  - [ ] **파일/위치**: 체크리스트 Line 88 앞에 삽입

- [ ] **(Critical) 순서 오류: B-01이 B-02보다 먼저 실행 불가**
  - [ ] **원인**: B-01에서 `extractCategoryChunks` 함수를 호출하지만, 이 함수는 B-02에서 생성됨. 순서 역전.
  - [ ] **수정 제안**: Phase B 순서를 다음으로 변경:
    1. **B-02** → **B-01** → **B-03** → **B-04** (순서 재배치)
    - 또는 B-01 설명에 "B-02 완료 후 import" 명시 추가
  - [ ] **파일/위치**: 체크리스트 Line 126-200 순서 재배치

### Major Issues

- [ ] **(Major) 존재하지 않는 API 가정: `/api/rag/search`**

  - [ ] **원인**: Phase C에서 `api/rag/search/route.ts` 수정을 가정하지만, 현재 프로젝트에 해당 파일이 존재하는지 확인 필요. RAG 검색은 다른 경로일 수 있음.
  - [ ] **수정 제안**: Phase C에 **C-00 (Pre-Check)** 항목 추가:
    ```markdown
    - [ ] **C-00**: RAG 검색 API 위치 확인
      - `Target`: 프로젝트 전체 검색
      - `Detail`:
        1. `grep -r "match_document_chunks" frontend/src/app/api/` 실행
        2. RPC 호출 위치 파악
        3. 해당 파일을 C-01 ~ C-02의 Target으로 업데이트
    ```
  - [ ] **파일/위치**: 체크리스트 Line 223 앞에 삽입

- [ ] **(Major) 기존 `/api/raft/context` 로직 중복 가능성**
  - [ ] **원인**: `/api/raft/context/route.ts`에 이미 카테고리별 청크 조회 로직이 구현되어 있음 (이전 세션에서 확인). B-02에서 신규 유틸리티를 만드는 대신 기존 로직 재사용 권장.
  - [ ] **수정 제안**: B-02를 다음으로 수정:
    ```markdown
    - [ ] **B-02**: 기존 context API 로직 재사용 또는 리팩터링
      - `Detail`:
        1. `/api/raft/context/route.ts`의 청크 조회 로직 확인
        2. 공통 유틸리티로 추출하거나, 해당 API 직접 호출
        3. 중복 코드 방지
    ```
  - [ ] **파일/위치**: 체크리스트 Line 151-175 수정

---

## 2) 🚨 리스크 및 안전장치 (Risk Guardrails)

### High-Risk: 기존 기능 회귀

- [ ] **(High) RPC 함수 시그니처 변경은 Breaking Change**

  - [ ] **위험 요소**:
    - C-04에서 `match_document_chunks` 함수 시그니처 변경 시, 이 함수를 호출하는 모든 코드가 깨짐.
    - 새 파라미터 `filter_category`를 추가하면 기존 호출이 실패할 수 있음.
  - [ ] **방어 코드 추가 제안**:
    1. `DEFAULT NULL` 파라미터 사용 (체크리스트에 이미 포함 ✓)
    2. 기존 함수를 유지하고, 새 함수 `match_document_chunks_v2` 생성 고려
    3. 모든 호출 지점 검색: `grep -r "match_document_chunks" frontend/`
  - [ ] **파일/위치**: C-04 Detail에 호출 지점 검색 단계 추가

- [ ] **(High) `useExistingChunks: true` 시 빈 context 처리**
  - [ ] **위험 요소**:
    - 카테고리에 청크가 없을 경우 `finalContext`가 빈 문자열이 됨.
    - LLM 호출 시 에러 발생 또는 무의미한 생성 결과.
  - [ ] **방어 코드 추가 제안**: B-01에 명시적 검증 추가:
    ```typescript
    if (!finalContext || finalContext.length < 100) {
      return NextResponse.json(
        {
          success: false,
          error:
            "해당 카테고리에 충분한 청크 데이터가 없습니다. (최소 100자 필요)",
        },
        { status: 400 }
      );
    }
    ```
  - [ ] **파일/위치**: B-01 Detail 3번 항목 강화

### Mid-Risk: 성능 이슈

- [ ] **(Mid) 대량 청크 추출 시 메모리/성능 문제**

  - [ ] **위험 요소**:
    - 카테고리에 수백 개의 청크가 있을 경우, 전체 조회 시 메모리 과부하.
    - Vercel Function 메모리 제한 (1GB) 초과 가능.
  - [ ] **방어 로직 제안**:
    1. B-02에 `limit` 추가: `.limit(100)` (최대 100개 청크 조회)
    2. 페이지네이션 또는 스트리밍 고려 (고급 옵션)
    3. 토큰 한도 체크 로직을 쿼리 전 사전 count로 변경
  - [ ] **파일/위치**: B-02 Detail 2번 쿼리에 `.limit(100)` 추가

- [ ] **(Mid) `category` 필수화로 인한 기존 호출 실패**
  - [ ] **위험 요소**:
    - C-01에서 `category` 필수화 시, 기존에 category 없이 호출하던 코드가 모두 깨짐.
  - [ ] **방어 로직 제안**:
    1. 기존 호출 지점 검색: `grep -r "api/rag/search" frontend/`
    2. 호출 지점 업데이트 후 필수화 적용 (순서 중요)
    3. 또는 `category` 없을 시 fallback 동작 정의 (비권장)
  - [ ] **파일/위치**: C-01 앞에 호출 지점 업데이트 단계 추가

---

## 3) 🧪 검증 기준 구체화 (Test Criteria)

### Happy Path 테스트 기준

- [ ] **HP-01**: `useExistingChunks: true`로 생성 성공

  - **입력**: `{ category: "마케팅", useExistingChunks: true, count: 2 }`
  - **기대 결과**:
    - 응답 `success: true`
    - `generated >= 1`
    - 생성된 Q&A 내용이 마케팅 관련

- [ ] **HP-02**: UI 체크박스 토글 시 Textarea 숨김

  - **동작**: 'DB에서 불러오기' → 'Existing Chunks 사용' 체크
  - **기대 결과**: Textarea 숨김 + 안내 문구 표시

- [ ] **HP-03**: RAG 검색 격리 성공
  - **입력**: `{ query: "마케팅 전략", category: "마케팅" }`
  - **기대 결과**: 반환된 청크가 모두 `category = "마케팅"`

### Edge Case 테스트 기준

- [ ] **EC-01**: 청크 없는 카테고리

  - **입력**: `{ category: "존재하지않는카테고리", useExistingChunks: true }`
  - **기대 결과**: 400 에러 + "청크 데이터가 없습니다" 메시지

- [ ] **EC-02**: 대량 청크 카테고리 (>100개)

  - **입력**: 100개 이상 청크가 있는 카테고리로 요청
  - **기대 결과**:
    - 100개까지만 사용 (limit 적용)
    - 응답에 `warning: "일부 청크만 사용됨"` 포함 (선택 사항)

- [ ] **EC-03**: category 없이 RAG 검색 요청

  - **입력**: `{ query: "...", category: "" }` 또는 `category` 필드 없음
  - **기대 결과**: 400 에러

- [ ] **EC-04**: 토큰 한도 초과
  - **입력**: 총 토큰 > 100,000인 카테고리
  - **기대 결과**: 자동 truncate + 경고 또는 에러 (정책에 따라)

---

## 4) 최종 판단 (Decision)

- [x] **상태 선택**: ⚠️ **체크리스트 수정 후 진행**

- [x] **가장 치명적인 결함 1줄 요약**:
  > "B-02에서 `document_chunks.eq('category', category)` 쿼리는 실패할 가능성이 높음. `document_chunks` 테이블에 `category` 컬럼이 없으므로, `user_documents` JOIN 또는 기존 `/api/raft/context` 로직 재사용 필요."

---

## 📋 수정된 체크리스트 (Revised Checklist Patch)

### Phase A 수정

**추가 항목 (Line 88 앞에 삽입):**

```markdown
- [ ] **A-05**: `generateSyntheticDataAPI` 함수 시그니처 수정
  - `Target`: `frontend/src/lib/api/raft.ts`
  - `Detail`:
    1. 시그니처에 `useExistingChunks: boolean = false` 파라미터 추가
    2. API 호출 body에 해당 값 포함
  - `Dependency`: A-04 이전에 완료
```

### Phase B 수정

**B-02 쿼리 교체 (Line 162-169):**

```typescript
// 수정된 쿼리: user_documents와 JOIN
const { data: docs } = await supabase
  .from("user_documents")
  .select("id")
  .eq("category", category);

const docIds = docs?.map((d) => d.id) || [];

if (docIds.length === 0) {
  throw new Error("해당 카테고리에 문서가 없습니다.");
}

const { data: chunks } = await supabase
  .from("document_chunks")
  .select("content, chunk_content")
  .in("document_id", docIds)
  .limit(100); // 성능 보호
```

**순서 변경:**

- B-02 (유틸리티 생성) → B-01 (API 분기 로직) → B-03 → B-04

### Phase C 수정

**추가 항목 (Line 223 앞에 삽입):**

```markdown
- [ ] **C-00**: RAG 검색 API 위치 확인 (Pre-Check)
  - `Target`: 프로젝트 전체 검색
  - `Detail`:
    1. `grep -r "match_document_chunks" frontend/src/` 실행
    2. 실제 파일 경로 확인 후 C-01 ~ C-02 Target 업데이트
```

---

**End of JeDebug Analysis**
