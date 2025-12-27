# RAG Alignment Upgrade - 구현 체크리스트

> **작성일**: 2025-12-27 18:41  
> **작성자**: 시니어 개발자 (Tech Lead, 15년차)  
> **기반 문서**: `2512271820_rag_alignment_upgrade_coach_vfinal.md`  
> **담당자**: 시니어 개발자, 주니어 개발자, UX/UI 디자이너

---

## 📋 파일 구성 전략 및 근거

### 결정: 단일 파일로 통합

| 기준              | 판단    | 근거                                                 |
| ----------------- | ------- | ---------------------------------------------------- |
| **연결성**        | ✅ 통합 | P1 항목들이 Gate ↔ Feature Flag ↔ UI로 강하게 연결됨 |
| **독립 배포**     | ✅ 통합 | P1 전체가 하나의 Sprint로 배포 예정                  |
| **Phase 간 참조** | ✅ 통합 | Citation Gate가 Evidence Quality에 영향              |
| **검증 효율**     | ✅ 통합 | 전체 진행률을 한눈에 파악 가능                       |

### 저장 위치

```
plan_report/2512271841_RAG_Alignment_P1_체크리스트.md
```

---

## 📌 품질 체크 기준 (모든 코드에 적용)

| 기준               | 확인 항목                                                        |
| ------------------ | ---------------------------------------------------------------- |
| **Coding Style**   | ESLint/Prettier 통과, 프로젝트 규칙 준수                         |
| **Naming**         | 함수명: `동사+명사`, 변수: `camelCase`, 상수: `UPPER_SNAKE_CASE` |
| **Error Handling** | try-catch 블록, 사용자 친화적 에러 메시지, 콘솔 로깅             |
| **Performance**    | 과도한 반복 없음, 불필요한 리렌더링 방지, 메모이제이션           |
| **Accessibility**  | aria-label, title 속성, 키보드 네비게이션 지원                   |

---

## Phase P1-A: Citation Gate 구현

> **출처**: 설계 문서 섹션 4) 게이트 시스템 (Line 106)  
> **우선순위**: 🔴 P1 (즉시 구현)

### Before Start: 영향받는 기존 파일/기능

| 파일                                         | 함수/컴포넌트   | 영향 가능성              |
| -------------------------------------------- | --------------- | ------------------------ |
| `frontend/src/app/api/chat/route.ts`         | `POST` 핸들러   | 🟡 중간 (응답 구조 확장) |
| `frontend/src/lib/rag/pipeline.ts`           | 파이프라인 전체 | 🟡 중간 (게이트 추가)    |
| `frontend/src/components/AssistantPanel.tsx` | UI 컴포넌트     | 🟢 낮음 (표시만 추가)    |

---

### Implementation Items

- [x] **P1-A-01**: Citation Gate 타입 정의 ✅ (이미 구현됨)

  - `Target`: `frontend/src/lib/rag/citationGate.ts` (Line 17-32)
  - `현재 상태`: ✅ 이미 구현됨
    ```typescript
    // 이미 존재하는 타입
    export interface CitationVerifyResult {
      valid: boolean;
      matchedChunkId?: string;
      matchScore: number; // 0~1
    }
    export interface VerifiedEvidence extends JudgeEvidence {
      verified: CitationVerifyResult;
    }
    ```
  - `Dependency`: 없음
  - `Quality`: TypeScript strict mode 준수 ✅

- [x] **P1-A-02**: Citation 검증 함수 구현 ✅ (이미 구현됨)

  - `Target`: `frontend/src/lib/rag/citationGate.ts` (Line 149-200)
  - `현재 상태`: ✅ 이미 구현됨
    - `verifyCitation()` - 단일 인용문 검증
    - `verifyAllCitations()` - 여러 인용문 일괄 검증
    - `summarizeCitationVerification()` - 검증 결과 요약
  - `호출 위치`: `frontend/src/app/api/llm/judge/route.ts` (Line 146-151)
  - `Dependency`: 완료됨
  - `Quality`: 에러 처리, Jaccard 유사도, 부분 매칭 적용 ✅

- [ ] **P1-A-03**: Chat API에 Citation Gate 결과 노출 (추가 작업)

  - `Target`: `frontend/src/app/api/chat/route.ts`
  - `Detail`:
    1. 현재 `api/llm/judge/route.ts`에서만 사용 중
    2. Chat API 응답에도 `gates: GateResult[]` 필드 추가 필요
    3. 기존 클라이언트 하위 호환: `gates`는 optional
  - `Dependency`: P1-A-02 완료됨 ✅
  - `Quality`: OpenAPI 스키마 문서화 [확인 필요: Swagger 사용 여부]

- [ ] **P1-A-04**: UI에서 Citation 결과 표시
  - `Target`: 해당 UI 컴포넌트 확인 필요
  - `Detail`:
    1. 인용 검증 성공/실패 배지 표시
    2. 실패 시 경고 아이콘 표시
  - `Dependency`: P1-A-03 완료
  - `Quality`: aria-label, tooltip 적용

---

### Verification (P1-A 검증)

- [ ] **Syntax Check**: `npx tsc --noEmit` → 0 errors
- [ ] **Functionality Test**:
  - Given: LLM 응답에 "참고 자료에 따르면..." 인용 포함
  - When: Chat API 호출
  - Then: `gates[0].gateName === 'citation'`, `gates[0].passed === true`
  - Expected: 인용이 실제 chunk에 존재하면 passed=true
- [ ] **Regression Test**: 기존 Chat 기능 정상 동작 (인용 없는 응답도 처리)

---

## Phase P1-B: Feature Flag `FF_PATCH_STAGING` 구현

> **출처**: 설계 문서 섹션 7) Feature Flags (Line 163)  
> **목적**: 단계형 패치 (1차 핵심 3개 → 2차 표현/톤 → 3차 디테일)

### Before Start: 영향받는 기존 파일/기능

| 파일                                     | 함수/컴포넌트      | 영향 가능성           |
| ---------------------------------------- | ------------------ | --------------------- |
| `frontend/src/config/featureFlags.ts`    | FEATURE_FLAGS 객체 | 🟢 낮음 (플래그 추가) |
| `frontend/src/lib/rag/patchGenerator.ts` | Patch 생성 로직    | 🟡 중간 (단계 분리)   |
| `frontend/src/components/PatchCard.tsx`  | UI 컴포넌트        | 🟡 중간 (단계 표시)   |

---

### Implementation Items

- [ ] **P1-B-01**: Feature Flag 추가

  - `Target`: `frontend/src/config/featureFlags.ts` (약 Line 130 근처)
  - `Detail`:
    ```typescript
    /**
     * 단계형 패치 활성화 (1차 핵심 → 2차 표현 → 3차 디테일)
     * 환경 변수: FF_PATCH_STAGING
     * 기본값: false (점진적 롤아웃)
     */
    FF_PATCH_STAGING: process.env.FF_PATCH_STAGING === 'true',
    ```
  - `Dependency`: 없음
  - `Quality`: 기존 FEATURE_FLAGS 객체 스타일 유지

- [ ] **P1-B-02**: Patch Stage 타입 정의

  - `Target`: `frontend/src/lib/rag/types.ts`
  - `Detail`:
    ```typescript
    type PatchStage = "primary" | "expression" | "detail";
    interface StagedPatch {
      stage: PatchStage;
      patches: Patch[];
      description: string;
    }
    ```
  - `Dependency`: P1-B-01 완료
  - `Quality`: 기존 `Patch` 인터페이스와 연결

- [x] **P1-B-03**: Patch 분류 로직 ✅ (기존 patchGates.ts 활용)

  - `Target`: `frontend/src/lib/rag/patchGates.ts` (기존 파일, 341줄)
  - `현재 상태`: ✅ Gate 시스템 구현됨
    - `validateDiffSafetyGate()` - 수정량 상한 검증
    - `validateUpgradeEffectGate()` - 개선 효과 검증
    - `unifyGateResults()` - 모든 Gate 통합
  - `추가 작업`: 단계형 패치 분류 함수 `stagePatchesForReview()` 추가 필요
    1. 함수명: `stagePatchesForReview(patches: Patch[]): StagedPatch[]`
    2. 분류 기준:
       - `primary`: 논리/구조/핵심 수정 (Top 3)
       - `expression`: 표현/톤/문체 수정
       - `detail`: 맞춤법/띄어쓰기/미세 조정
    3. LLM 기반 분류 또는 규칙 기반 분류 [확인 필요: 분류 방법 결정]
  - `Dependency`: P1-B-02 완료
  - `Quality`: 분류 실패 시 모두 `primary`로 fallback

- [ ] **P1-B-04**: UI에서 단계별 표시
  - `Target`: `frontend/src/components/PatchCard.tsx`
  - `Detail`:
    1. `FF_PATCH_STAGING` 플래그 체크
    2. 활성화 시: 단계별 섹션으로 그룹화 표시
    3. 비활성화 시: 기존 평탄 리스트 유지
    4. 각 단계에 접힌/펼친 토글 추가
  - `Dependency`: P1-B-03 완료
  - `Quality`: aria-expanded, aria-controls 접근성 적용

---

### Verification (P1-B 검증)

- [ ] **Syntax Check**: `npx tsc --noEmit` → 0 errors
- [ ] **Functionality Test**:
  - Given: `FF_PATCH_STAGING=true` 환경 변수 설정
  - When: Patch 제안 UI 확인
  - Then: "핵심 수정(3개)", "표현/톤", "디테일" 섹션으로 분리 표시
  - Expected: 각 섹션 독립 펼침/접기 가능
- [ ] **Regression Test**: `FF_PATCH_STAGING=false`일 때 기존 UI 유지

---

## Phase P1-C: Feature Flag `FF_EVIDENCE_QUALITY` 구현

> **출처**: 설계 문서 섹션 7) Feature Flags (Line 164)  
> **목적**: 근거 강도 표시 (display_only 모드)

### Before Start: 영향받는 기존 파일/기능

| 파일                                           | 함수/컴포넌트       | 영향 가능성         |
| ---------------------------------------------- | ------------------- | ------------------- |
| `frontend/src/config/featureFlags.ts`          | FEATURE_FLAGS 객체  | 🟢 낮음             |
| `frontend/src/lib/rag/search.ts`               | 검색 로직 (443줄)   | 🟡 중간 (점수 계산) |
| `frontend/src/components/rag/EvidenceCard.tsx` | UI 컴포넌트 (5.3KB) | 🟡 중간 (강도 표시) |

---

### Implementation Items

- [ ] **P1-C-01**: Feature Flag 추가

  - `Target`: `frontend/src/config/featureFlags.ts`
  - `Detail`:
    ```typescript
    /**
     * 근거 강도 표시 (display_only)
     * 환경 변수: FF_EVIDENCE_QUALITY
     * 기본값: false
     */
    FF_EVIDENCE_QUALITY: process.env.FF_EVIDENCE_QUALITY === 'true',
    ```
  - `Dependency`: 없음
  - `Quality`: 기존 스타일 유지

- [ ] **P1-C-02**: Evidence Quality 점수 타입 정의

  - `Target`: `frontend/src/lib/rag/types.ts`
  - `Detail`:
    ```typescript
    interface EvidenceQuality {
      chunkId: string;
      score: number; // 0~100
      level: "high" | "medium" | "low";
      factors: {
        relevance: number;
        recency: number;
        specificity: number;
      };
    }
    ```
  - `Dependency`: P1-C-01 완료
  - `Quality`: 기존 `DocumentChunk` 인터페이스와 연결

- [ ] **P1-C-03**: 근거 강도 계산 함수 구현

  - `Target`: `frontend/src/lib/rag/search.ts` (기존 파일 확장, 443줄)
  - `현재 구현된 함수`: `vectorSearch()`, `hybridSearch()`, `fullTextSearch()`, `reciprocalRankFusion()`
  - `Detail`:
    1. 함수명: `calculateEvidenceQuality(chunk: SearchResult, query: string): EvidenceQuality`
    2. 계산 요소:
       - `relevance`: 기존 `score` 필드 활용 (pgvector 결과)
       - `recency`: 문서 업로드 날짜 기반 (최근일수록 높음)
       - `specificity`: 청크 길이 대비 키워드 밀도
    3. 종합 점수: `(relevance * 0.5) + (recency * 0.2) + (specificity * 0.3)`
    4. level 분류: 80+ = high, 50-79 = medium, <50 = low
  - `Dependency`: P1-C-02 완료
  - `Quality`: 성능 고려 (계산 캐싱)

- [ ] **P1-C-04**: UI에서 근거 강도 표시
  - `Target`: `frontend/src/components/rag/EvidenceCard.tsx` (✅ 존재 확인됨, 5.3KB)
  - `Detail`:
    1. `FF_EVIDENCE_QUALITY` 플래그 체크
    2. 활성화 시: 각 근거 옆에 강도 배지 표시
       - `high`: 🟢 (초록)
       - `medium`: 🟡 (노랑)
       - `low`: 🔴 (빨강)
    3. 호버 시 상세 점수 tooltip 표시
  - `Dependency`: P1-C-03 완료
  - `Quality`: title 속성으로 tooltip, aria-label 추가

---

### Verification (P1-C 검증)

- [ ] **Syntax Check**: `npx tsc --noEmit` → 0 errors
- [ ] **Functionality Test**:
  - Given: `FF_EVIDENCE_QUALITY=true` 환경 변수 설정
  - When: 근거/참고자료 패널 확인
  - Then: 각 청크 옆에 🟢/🟡/🔴 배지 표시
  - Expected: 호버 시 "Relevance: 85%, Recency: 70%" 등 상세 표시
- [ ] **Regression Test**: `FF_EVIDENCE_QUALITY=false`일 때 배지 미표시

---

## Phase P1-D: Criteria Pack 스키마 설계

> **출처**: 설계 문서 섹션 2) 핵심 데이터 자산 (Line 53)  
> **목적**: 평가 시 로딩되는 기준팩 표준화

### Before Start: 영향받는 기존 파일/기능

| 파일                                   | 함수/컴포넌트             | 현재 상태             |
| -------------------------------------- | ------------------------- | --------------------- |
| `frontend/src/lib/rag/criteriaPack.ts` | CriteriaPack 빌더 (411줄) | ✅ 이미 구현됨        |
| `supabase/migrations/*.sql`            | DB 마이그레이션           | ❌ 테이블 미존재      |
| `frontend/src/lib/rag/types.ts`        | 타입 정의                 | ✅ 이미 구현됨 (부분) |

---

### 현재 구현 상태 분석

**`criteriaPack.ts` 이미 구현된 함수들:**

- ✅ `buildCriteriaPack()` - CriteriaPack 구축 (Pin 상태 반영)
- ✅ `pinItem()` / `unpinItem()` - 항목 Pin/Unpin (Optimistic UI)
- ✅ `togglePin()` - Pin 상태 토글
- ✅ `isPinned()` - Pin 여부 확인 (로컬 캐시 우선)
- ✅ `fetchPinnedItems()` - 서버에서 Pin된 항목 조회
- ✅ `unpinAll()` - 모든 Pin 해제

---

### Implementation Items

- [ ] **P1-D-01**: Criteria Pack 테이블 마이그레이션 (DB 테이블만 생성)

  - `Target`: `supabase/migrations/029_criteria_pack.sql` (신규 생성)
  - `현재 상태`: ❌ DB 테이블 미존재 (migrations에서 criteria_pack 검색 결과 없음)
  - `Detail`:

    ```sql
    -- =========================================================
    -- Phase P1-D: Criteria Pack 테이블 (criteriaPack.ts 연동용)
    -- =========================================================

    CREATE TABLE IF NOT EXISTS public.criteria_pack (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      version INTEGER DEFAULT 1,

      -- 기준 정의
      criteria_definition JSONB NOT NULL,
      -- 구조: { "rules": [...], "do_examples": [...], "dont_examples": [...] }

      -- 공통 함정
      common_pitfalls TEXT[],

      -- 관련 청크 ID (근거)
      evidence_chunk_ids UUID[],

      -- 메타데이터
      category TEXT CHECK (category IN ('logic', 'grammar', 'expression', 'tone', 'format')),
      difficulty TEXT CHECK (difficulty IN ('high', 'medium', 'low')),

      -- 활성화 상태
      is_active BOOLEAN DEFAULT TRUE,

      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- 인덱스
    CREATE INDEX IF NOT EXISTS idx_criteria_pack_category ON public.criteria_pack(category);
    CREATE INDEX IF NOT EXISTS idx_criteria_pack_active ON public.criteria_pack(is_active);

    -- RLS
    ALTER TABLE public.criteria_pack ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "Service role full access" ON public.criteria_pack
      FOR ALL USING (auth.role() = 'service_role');
    ```

  - `Dependency`: 없음
  - `Quality`: 기존 criteriaPack.ts와 연동 가능한 스키마

- [x] **P1-D-02**: TypeScript 타입 정의 ✅ (이미 구현됨)

  - `Target`: `frontend/src/lib/rag/criteriaPack.ts` (Line 26-44)
  - `현재 상태`: ✅ 관련 타입 이미 존재
    - `PinnedItem`, `PinState`, `PinResult` 인터페이스
    - `BuildCriteriaPackOptions` 인터페이스
  - `추가 작업`: DB 스키마와 완전히 매핑되는 `CriteriaPack` 타입 추가 (선택)

- [ ] **P1-D-03**: Supabase 마이그레이션 실행
  - `Target`: Supabase Dashboard → SQL Editor
  - `Detail`:
    1. `029_criteria_pack.sql` 내용 붙여넣기
    2. Run 실행
    3. 확인: `SELECT * FROM criteria_pack LIMIT 1;`
  - `Dependency`: P1-D-01 완료
  - `Quality`: 실행 전 프로덕션 영향도 확인

---

### Verification (P1-D 검증)

- [ ] **Syntax Check**: SQL 문법 오류 없음
- [ ] **Migration Test**:
  - `SELECT * FROM criteria_pack LIMIT 1;` → Success (빈 배열)
  - `SELECT * FROM pg_policies WHERE tablename = 'criteria_pack';` → RLS 정책 존재
- [ ] **Regression Test**: 기존 테이블 영향 없음

---

## 📊 전체 검증 (Phase P1 통합)

### 통합 테스트 시나리오

- [ ] **IT-01**: 전체 파이프라인 테스트
  - Given: 모든 P1 Feature Flag ON
  - When: 질문 입력 → 응답 생성 → Patch 제안
  - Then:
    1. `gates[].citation` 결과 포함
    2. Patch가 3단계로 분류되어 표시
    3. 근거에 강도 배지 표시
  - Expected: 모든 신규 기능이 기존 흐름에 통합

### 회귀 테스트

- [ ] **RT-01**: 기존 Chat 기능 정상 동작
- [ ] **RT-02**: 기존 Patch 기능 정상 동작
- [ ] **RT-03**: Feature Flags OFF 시 기존 동작 유지
- [ ] **RT-04**: 로그인/로그아웃 정상 동작
- [ ] **RT-05**: 참고 자료 업로드 정상 동작

### 빌드 검증

- [ ] **BV-01**: `npm run build` → Exit code: 0
- [ ] **BV-02**: `npx tsc --noEmit` → 0 errors
- [ ] **BV-03**: ESLint 경고 0개

---

## 📈 진행 상황 추적

| Phase                   | 항목 수 | 완료 | 상태    |
| ----------------------- | ------- | ---- | ------- |
| P1-A (Citation Gate)    | 4       | 0    | ⏳ 대기 |
| P1-B (Patch Staging)    | 4       | 0    | ⏳ 대기 |
| P1-C (Evidence Quality) | 4       | 0    | ⏳ 대기 |
| P1-D (Criteria Pack)    | 3       | 0    | ⏳ 대기 |
| 통합 검증               | 8       | 0    | ⏳ 대기 |

---

## ❓ 확인 필요 사항 (Unknowns)

| ID   | 질문                                               | 담당자   | 상태    |
| ---- | -------------------------------------------------- | -------- | ------- |
| U-01 | Patch 분류를 LLM 기반으로 할지 규칙 기반으로 할지? | 디렉터님 | ⏳ 대기 |
| U-02 | Evidence Quality 계산 시 recency 가중치 조정 필요? | 시니어   | ⏳ 대기 |
| U-03 | Criteria Pack 초기 시드 데이터 필요 여부?          | 시니어   | ⏳ 대기 |

---

> **다음 단계**: 디렉터님 승인 후 Phase P1-A부터 순차 진행  
> **예상 소요 시간**: 1 Sprint (3~5일)
