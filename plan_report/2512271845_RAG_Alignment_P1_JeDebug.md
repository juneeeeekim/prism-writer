# RAG Alignment P1 - JeDebug 분석 리포트

> **분석일**: 2025-12-27 18:45  
> **분석자**: JeDebug (Migration & Reliability Specialist)  
> **분석 대상**: `2512271841_RAG_Alignment_P1_체크리스트.md`  
> **기반 문서**: `2512271820_rag_alignment_upgrade_coach_vfinal.md`

---

## 1) 🔧 로직 및 구현 보완 (Logic Fixes)

### � Critical: 이미 구현된 파일을 신규 생성으로 오인 → ✅ 수정됨

- [x] **(Critical) P1-A-02 수정 필요: Citation Gate 이미 존재** ✅ 수정됨

  - [x] 원인: 체크리스트가 `frontend/src/lib/rag/gates/citationGate.ts` 신규 생성을 지시하나, 실제로 `frontend/src/lib/rag/citationGate.ts` (250 lines)가 이미 존재함
  - [x] **수정 제안**: ✅ 체크리스트 업데이트 완료
    - P1-A-01, P1-A-02 항목 `[x]` 이미 구현됨으로 표시
    - Target을 `frontend/src/lib/rag/citationGate.ts`로 변경
    - 호출 위치 `api/llm/judge/route.ts` 명시
  - [x] 파일/위치: `2512271841_RAG_Alignment_P1_체크리스트.md` Line 56-107

- [x] **(Critical) P1-D 수정 필요: Criteria Pack 이미 존재** ✅ 수정됨

  - [x] 원인: 체크리스트가 `criteria_pack` 테이블 신규 생성을 지시하나, `frontend/src/lib/rag/criteriaPack.ts` (411 lines)가 이미 존재함
  - [x] **수정 제안**: ✅ 체크리스트 업데이트 완료
    - P1-D-02 `[x]` 이미 구현됨으로 표시
    - DB 테이블만 생성으로 범위 축소
    - 이미 구현된 함수들 목록 추가
  - [x] 파일/위치: `2512271841_RAG_Alignment_P1_체크리스트.md` Line 297-395

- [x] **(Critical) P1-B-03 수정 필요: Patch Gate 이미 존재** ✅ 수정됨
  - [x] 원인: 체크리스트가 `patchGenerator.ts`에 분류 함수 추가를 지시하나, `patchGates.ts` (341 lines)에 Gate 시스템이 이미 구현됨
  - [x] **수정 제안**: ✅ 체크리스트 업데이트 완료
    - P1-B-03 `[x]` 기존 patchGates.ts 활용으로 표시
    - Target을 `frontend/src/lib/rag/patchGates.ts`로 변경
  - [x] 파일/위치: `2512271841_RAG_Alignment_P1_체크리스트.md` Line 168-184

---

### � Major: 존재하지 않는 파일 경로 가정 → ✅ 확인 완료

- [x] **(Major) P1-A-03 수정 필요: pipeline.ts 존재 여부 미확인** ✅ 확인됨

  - [x] 원인: 체크리스트가 `frontend/src/lib/rag/pipeline.ts`를 참조하나 실제 존재하지 않음
  - [x] **수정 제안**: ✅ 체크리스트 업데이트 완료
    - P1-A-03: `api/llm/judge/route.ts`에서 이미 Citation Gate 호출 중
    - Chat API 노출을 위해 `api/chat/route.ts` Target으로 변경
  - [x] 파일/위치: `2512271841_RAG_Alignment_P1_체크리스트.md`

- [x] **(Major) P1-B-03 수정 필요: patchGenerator.ts 존재 여부 미확인** ✅ 확인됨

  - [x] 원인: `patchGenerator.ts` 파일이 `lib/rag` 디렉토리에 존재하지 않음
  - [x] **수정 제안**: ✅ 체크리스트 업데이트 완료 (Critical에서 함께 처리)
    - 후보 파일: `shadowWorkspace.ts` (287줄), `patchGates.ts` (341줄)
    - P1-B-03 Target을 `patchGates.ts`로 변경됨
  - [x] 파일/위치: `2512271841_RAG_Alignment_P1_체크리스트.md`

- [x] **(Major) P1-C-03 수정 필요: retrieval.ts 존재 여부 미확인** ✅ 수정됨

  - [x] 원인: `retrieval.ts` 파일이 존재하지 않음
  - [x] **수정 제안**: ✅ 체크리스트 업데이트 완료
    - 검색 관련 파일: `search.ts` (443줄, 15.6KB)
    - 구현된 함수: `vectorSearch()`, `hybridSearch()`, `fullTextSearch()`
  - [x] 파일/위치: `2512271841_RAG_Alignment_P1_체크리스트.md` Line 258

- [x] **(Major) P1-C-04 수정 필요: EvidenceCard.tsx 존재 여부 미확인** ✅ 확인됨
  - [x] 원인: 컴포넌트 경로가 가정에 기반함
  - [x] **수정 제안**: ✅ 체크리스트 업데이트 완료
    - 실제 위치: `components/rag/EvidenceCard.tsx` (5.3KB)
    - 경로 수정됨
  - [x] 파일/위치: `2512271841_RAG_Alignment_P1_체크리스트.md` Line 272

---

### 🟢 Minor: 타입 정의 중복 가능성 → ✅ 확인됨

- [x] **(Minor) P1-A-01 개선 권장: 기존 타입 확인** ✅ 해결됨
  - [x] 원인: `CitationVerifyResult` 인터페이스가 `citationGate.ts`에 이미 정의됨
  - [x] **수정 제안**: ✅ 체크리스트 업데이트 완료
    - P1-A-01 `[x]` 이미 구현됨으로 표시
    - 타입 중복 방지 - 기존 `CitationVerifyResult` 재사용
  - [x] 파일/위치: `citationGate.ts` Line 17-24

---

## 2) 🚨 리스크 및 안전장치 (Risk Guardrails)

### 🔴 High: 기존 기능 회귀

- [x] **(High) 기존 Citation Gate 호출 흐름 파악 필수** ✅ 확인됨

  - [x] 위험 요소: `citationGate.ts`가 이미 다른 곳에서 사용 중일 경우 변경 시 회귀 발생
  - [x] **방어 코드 추가 제안**:
    - `grep_search` 실행: `verifyCitation` 호출 위치 파악 (`api/chat/route.ts`, `api/llm/judge/route.ts`)
    - 기존 호출 코드 목록화 (Judge API는 `verifyAllCitations` 사용, 회귀 없음 확인)
    - 변경 시 모든 호출 위치 테스트

- [x] **(High) Feature Flag 기본값 주의** ✅ 확인됨
  - [x] 위험 요소: 새 Flag 추가 시 기본값 `false`가 아니면 강제 활성화될 수 있음
  - [x] **방어 코드 추가 제안**:
    - 모든 신규 Flag에 `=== 'true'` 패턴 적용 (opt-in)
    - 체크리스트 P1-B-01, P1-C-01에 이미 적용됨 ✅ (`featureFlags.ts` 라인 138, 145 확인)

### 🟡 Mid: 성능/데이터 이슈

- [x] **(Mid) Evidence Quality 계산 N+1 쿼리 위험** ✅ 해결됨

  - [x] 위험 요소: `calculateEvidenceQuality`가 각 청크마다 호출되면 성능 저하
  - [x] **방어 로직 제안**:
    - 배치 처리: `calculateEvidenceQualityBatch` 함수 추가됨 (`search.ts`)
    - 현재 로직은 O(1) 메모리 연산이므로 실제 N+1 문제는 없으나, 미래 확장을 위해 인터페이스 마련함

- [x] **(Mid) Criteria Pack DB 마이그레이션 순서** ✅ 해결됨
  - [x] 위험 요소: 테이블 생성 전 코드 배포 시 런타임 에러
  - [x] **방어 로직 제안**:
    - `criteriaPack.ts`의 `fetchPinnedItems`에 테이블 미존재 에러(42P01) 감지 로직 추가
    - 에러 발생 시 경고 로그만 출력하고 빈 배열 반환 (Graceful Fallback) 적용됨

---

## 3) 🧪 검증 기준 구체화 (Test Criteria)

### Happy Path 테스트

- [x] **HP-1: Citation Gate 정상 동작** ✅ Pass

  - Given: LLM 응답에 인용문 포함 ("참고 자료에 따르면...")
  - When: `verifyCitation(quote, chunks)` 호출
  - Then: `valid === true`, `matchScore >= 0.6`

- [x] **HP-2: Patch Staging 정상 동작** ✅ Pass

  - Given: 10개의 Patch 제안
  - When: `stagePatchesForReview(patches)` 호출
  - Then: `primary` (최대 3개), `expression`, `detail`로 분류

- [x] **HP-3: Evidence Quality 정상 동작** ✅ Pass
  - Given: 근거 청크 5개
  - When: `calculateEvidenceQuality` 호출
  - Then: 각 청크에 `score` (0-100) 및 `level` 배정 (High/Medium/Low 확인됨)

### Edge Case 테스트

- [x] **EC-1: Citation Gate - 빈 인용문** ✅ Pass

  - Given: `quote = ""`
  - Then: `valid === false`, `matchScore === 0`

- [x] **EC-2: Citation Gate - 일치하는 청크 없음** ✅ Pass

  - Given: 인용문과 매칭되는 청크 없음
  - Then: `valid === false`, `matchedChunkId === undefined` (로직 수정됨)

- [x] **EC-3: Patch Staging - 빈 배열** ✅ Pass

  - Given: `patches = []`
  - Then: 빈 `StagedPatch[]` 반환, 에러 없음

- [x] **EC-4: Evidence Quality - 오래된 문서** ✅ Pass

  - Given: 문서 업로드일이 1년 전
  - Then: `recency` 점수 낮음 (예: 20%)

- [x] **EC-5: Feature Flag OFF 상태** ✅ Pass
  - Given: 모든 P1 Flag = false
  - Then: 기존 UI/기능 유지, 신규 기능 비활성화 (조건부 렌더링 확인됨)

---

## 4) 최종 판단 (Decision)

- [x] 상태 선택: **⚠️ 체크리스트 수정 후 진행**

- [x] 가장 치명적인 결함 1줄 요약:
  > **체크리스트가 이미 존재하는 `citationGate.ts`, `criteriaPack.ts`, `patchGates.ts`를 신규 생성으로 오인하여 중복 구현 및 회귀 위험 발생**

---

## 📋 수정 필수 항목 요약

| ID   | 항목      | 수정 내용                                 | 우선순위    |
| ---- | --------- | ----------------------------------------- | ----------- |
| L-01 | P1-A-02   | 신규 → 기존 파일 확장 (`citationGate.ts`) | 🔴 Critical |
| L-02 | P1-D 전체 | 신규 → 기존 파일 확인 후 결정             | 🔴 Critical |
| L-03 | P1-B-03   | Target 변경 (`patchGates.ts`)             | 🔴 Critical |
| L-04 | P1-A-03   | `pipeline.ts` 경로 확인 필요              | 🟡 Major    |
| L-05 | P1-C-03   | `retrieval.ts` → `search.ts` 변경         | 🟡 Major    |
| R-01 | 회귀 방지 | verifyCitation 호출 위치 파악             | 🔴 High     |
| R-02 | 성능      | Evidence Quality 배치 처리                | 🟡 Mid      |

---

## ✅ 권장 다음 단계

1. **[즉시]** 실제 파일 구조 기반으로 체크리스트 P1-A, P1-B, P1-C, P1-D 수정
2. **[즉시]** `criteria_pack` 테이블 존재 여부 Supabase에서 확인
3. **[수정 후]** P1 구현 진행

---

> **JeDebug 분석 완료**  
> 체크리스트 수정 후 진행을 권장합니다.
