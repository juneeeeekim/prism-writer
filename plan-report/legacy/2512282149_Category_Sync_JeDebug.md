# JeDebug 분석: 카테고리 시스템 통합 수정

> **문서 ID**: 2512282149_Category_Sync_JeDebug  
> **분석 대상**: `2512282147_Category_System_Sync_Checklist.md`  
> **원본 문서**: `category_analysis.md`  
> **작성일**: 2025-12-28

---

## 1) 🔧 로직 및 구현 보완 (Logic Fixes)

### ✅ 구현 가능성 확인됨

- [x] (Confirmed) 체크리스트 P1-01 테이블 변경 로직 검증
  - 결과: `route.ts` Line 43 확인, `.from('documents')` 존재
  - 변경 코드 위치 정확함

### ⚠️ 누락된 로직/단계 식별

- [ ] (Major) **P1-01에 API 주석 업데이트 누락**

  - 원인: `route.ts` Line 10의 주석 `"documents 테이블의 유니크 카테고리 목록을 조회"` 가 변경 후 불일치
  - **수정 제안**: P1-01에 다음 항목 추가
    ```
    3. Line 10 주석 변경:
       // Before: "documents 테이블의 유니크 카테고리 목록을 조회"
       // After: "user_documents 테이블의 유니크 카테고리 목록을 조회"
    ```
  - 파일/위치: `route.ts` Line 10

- [ ] (Critical) **PC-01 사전 확인 미완료 시 진행 불가**

  - 원인: `user_documents` 테이블에 `category` 컬럼이 없으면 런타임 에러 발생
  - **수정 제안**: Pre-Check 섹션에 다음 추가
    ```
    - [ ] **PC-01-A**: 컬럼 존재 확인 (SQL)
      - 터미널 실행: Supabase SQL Editor에서
        SELECT column_name FROM information_schema.columns
        WHERE table_name = 'user_documents' AND column_name = 'category';
      - Expected: 1 row 반환
    ```
  - 파일/위치: 체크리스트 Pre-Check 섹션 Line 34-37

- [ ] (Minor) **P1-02 `as const` 타입 주의**
  - 원인: `'미분류'` 추가 시 배열 순서가 타입 정의에 영향
  - **수정 제안**: P1-02 Quality 항목에 추가
    ```
    - TypeScript 타입 체크: RaftCategory 타입이 '미분류' 포함하는지 확인
      type RaftCategory = typeof RAFT_CATEGORIES[number]
      // Expected: '미분류' | '마케팅' | ... 포함
    ```
  - 파일/위치: `constants/raft.ts` Line 23

---

## 2) 🚨 리스크 및 안전장치 (Risk Guardrails)

### High: 기존 기능 회귀(Regression) 포인트

- [ ] (High) `RAFTDatasetList.tsx` 필터 UI 영향

  - 위험 요소: Line 189의 `RAFT_CATEGORIES.map()` 에서 '미분류' 추가로 필터 버튼 UI 1개 증가
  - **방어 코드 추가 제안**: UI 테스트 항목 추가
    ```
    Verification에 추가:
    - [ ] RAFTDatasetList 필터 버튼 개수 확인 (기존 6개 → 7개)
    - [ ] '미분류' 필터 클릭 시 해당 데이터만 표시 확인
    ```

- [ ] (High) `SyntheticDataPanel.tsx` 드롭다운 영향
  - 위험 요소: 체크리스트 Before Start에 언급되었으나 구체적 테스트 없음
  - **방어 코드 추가 제안**: Regression Test에 추가
    ```
    - [ ] SyntheticDataPanel 카테고리 드롭다운에 '미분류' 표시 확인
    ```

### Mid: 데이터/성능 이슈 방지

- [ ] (Mid) `user_documents` 테이블 쿼리 성능
  - 위험 요소: `user_documents`가 `documents`보다 row 수가 많을 경우 성능 저하
  - **방어 로직 제안**: JeDebug 섹션 JD-01에 추가
    ```
    JD-01-A: 쿼리 성능 비교
    - documents 테이블 row 수: ___
    - user_documents 테이블 row 수: ___
    - 10배 이상 차이 시 인덱스 추가 검토
    ```

---

## 3) 🧪 검증 기준 구체화 (Test Criteria)

### Happy Path 테스트 기준 (성공 시나리오)

- [ ] **HP-01**: RAFT 관리 페이지 카테고리 목록 로딩

  - 조건: `user_documents`에 카테고리 'A', 'B' 존재
  - 기대 결과: 드롭다운에 '미분류', 'A', 'B', '마케팅', ... 표시 (가나다 정렬)
  - **구체적 확인 방법**: 브라우저 DevTools Network 탭에서 `/api/categories/unique` 응답 확인

- [ ] **HP-02**: '미분류' 카테고리로 청크 추출
  - 조건: `user_documents`에 `category = '미분류'`인 문서 존재
  - 기대 결과: `chunkExtractor.ts`가 해당 문서의 청크 반환
  - **구체적 확인 방법**: RAFT 생성 시 콘솔 로그 `[chunkExtractor] Extracted X chunks` 확인

### Edge Case 테스트 기준 (실패/예외 시나리오)

- [ ] **EC-01**: `user_documents` 테이블 비어있는 경우

  - 조건: 테이블에 데이터 0건
  - 기대 결과: `RAFT_CATEGORIES` 기본 목록만 반환 (7개)
  - **구체적 확인 방법**: API 응답 배열 길이 7 확인

- [ ] **EC-02**: `user_documents` category 컬럼에 NULL 값 다수 존재
  - 조건: 일부 row의 category가 NULL
  - 기대 결과: NULL 제외하고 유니크 목록 반환
  - **구체적 확인 방법**: 응답에 `null` 또는 빈 문자열 없음 확인

---

## 4) 최종 판단 (Decision)

- [x] 상태 선택: **⚠️ 체크리스트 수정 후 진행**
- [x] 가장 치명적인 결함 1줄 요약:
  > **PC-01 사전 확인 없이 진행 시 `user_documents.category` 컬럼 미존재로 런타임 에러 발생 가능**

---

## 5) 체크리스트 수정 권고사항 요약

| 위치            | 수정 내용                               | 우선순위    |
| --------------- | --------------------------------------- | ----------- |
| Pre-Check PC-01 | 컬럼 존재 확인 SQL 추가                 | 🔴 Critical |
| P1-01 Detail    | Line 10 주석 변경 항목 추가             | 🟡 Major    |
| Verification    | RAFTDatasetList 필터 UI 테스트 추가     | 🟡 Major    |
| Verification    | SyntheticDataPanel 드롭다운 테스트 추가 | 🟡 Major    |
| JeDebug JD-01   | 쿼리 성능 비교 항목 추가                | 🟢 Minor    |

---

**End of JeDebug Analysis**
