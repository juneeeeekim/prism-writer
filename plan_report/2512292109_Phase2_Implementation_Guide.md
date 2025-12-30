# 🟡 Phase 2: Template Builder 구조 도입 - 구현 지시서

> **문서 유형**: Tech Lead Implementation Guide  
> **생성일**: 2025-12-29 21:09  
> **원본 설계**: [Phase2 체크리스트](./2512290319_Phase2_Template_Builder_Checklist.md)  
> **마스터 플랜**: [Architecture Refactoring Master Plan](./2512290307_Architecture_Refactoring_Master_Plan.md)  
> **선행 조건**: Phase 1 완료 ✅  
> **목표**: 평가 기준을 프롬프트 하드코딩에서 데이터 기반으로 전환  
> **예상 소요**: 6~8시간

---

## ⚠️ Before Start - 주의사항

### 절대 건드리지 말 것 (레거시 보호)

| 파일                       | 이유                                       |
| -------------------------- | ------------------------------------------ |
| `lib/rag/rubrics.ts`       | 기존 DEFAULT_RUBRICS는 Fallback용으로 유지 |
| `lib/rag/templateTypes.ts` | 기존 타입 유지, 확장만 허용                |
| `lib/rag/rubricAdapter.ts` | 이미 완료된 Adapter, 수정 금지             |
| Phase 0/1 수정사항         | search.ts의 P0-01-D Fix 유지               |

### 기존 구현된 항목 (재사용)

| 파일                       | 내용                         | 상태             |
| -------------------------- | ---------------------------- | ---------------- |
| `lib/rag/templateTypes.ts` | `TemplateSchema`, `Template` | ✅ 재사용        |
| `lib/rag/rubricAdapter.ts` | `RubricAdapter`              | ✅ 재사용        |
| `lib/rag/rubrics.ts`       | `DEFAULT_RUBRICS`            | ✅ Fallback 유지 |

### 회귀 테스트 필수 포인트 ✅ **VERIFIED (2025-12-29 21:30)**

```
[회귀 체크] Phase 1 완료 항목 유지 확인 → ALL PASS
───────────────────────────────────────────────────────────────────────
types/rag.ts:410       ───▶  MatchDocumentChunksResult ✅ (P1-03 유지)
types/rag.ts:431       ───▶  RagChunk ✅ (P1-04 유지)
types/rag.ts:462       ───▶  UserDocument ✅ (P1-04 유지)
types/api.ts:17        ───▶  ErrorCodes ✅ (P1-09 유지)
types/api.ts:72        ───▶  ApiResponse ✅ (P1-09 유지)
lib/api/errorHandler.ts:22 ───▶  handleApiError ✅ (P1-10 유지)
```

> 📝 **Note**: 모든 Phase 1 타입 및 유틸리티 정상 유지됨

---

## 📋 Phase 2.1: 스키마 설계 (DB 마이그레이션)

### P2-01: `rag_rules` 테이블 생성

**담당**: DB 엔지니어  
**우선순위**: 🔴 Critical

---

- [x] **P2-01-A**: 마이그레이션 SQL 작성 ✅ **CREATED (2025-12-29 21:36)**

  - `Target`: `supabase/migrations/040_phase2_template_builder.sql`
  - `Logic (Pseudo)`:

    ```sql
    -- rag_rules: 문서에서 추출된 원자적 규칙 저장
    CREATE TABLE public.rag_rules (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      document_id UUID REFERENCES public.user_documents(id) ON DELETE CASCADE,
      chunk_id UUID REFERENCES public.rag_chunks(id) ON DELETE SET NULL,
      user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

      rule_text TEXT NOT NULL,           -- 규칙 텍스트
      category TEXT NOT NULL,            -- structure | expression | tone | prohibition
      confidence FLOAT DEFAULT 1.0,      -- 추출 신뢰도

      source_quote TEXT,                 -- 원문 인용
      extraction_method TEXT DEFAULT 'llm',

      metadata JSONB DEFAULT '{}',
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now()
    );

    -- RLS 정책
    ALTER TABLE public.rag_rules ENABLE ROW LEVEL SECURITY;

    CREATE POLICY "Users can CRUD own rules" ON public.rag_rules
    FOR ALL USING (auth.uid() = user_id);
    ```

  - `Key Variables`: `id`, `document_id`, `chunk_id`, `user_id`, `rule_text`, `category`
  - `Safety`: FK 관계 확인, CASCADE 설정

---

### P2-02: `rag_examples` 테이블 생성

**담당**: DB 엔지니어  
**우선순위**: 🔴 Critical

---

- [x] **P2-02-A**: 마이그레이션 SQL 작성 ✅ **CREATED (2025-12-29 21:36)**

  - `Target`: `supabase/migrations/040_phase2_template_builder.sql` (동일 파일에 추가)
  - `Logic (Pseudo)`:

    ```sql
    -- rag_examples: 좋은/나쁜 예시 저장
    CREATE TABLE public.rag_examples (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      rule_id UUID REFERENCES public.rag_rules(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

      example_type TEXT NOT NULL CHECK (example_type IN ('positive', 'negative')),
      example_text TEXT NOT NULL,
      diff_hint TEXT,                    -- 나쁜 예 → 좋은 예 힌트

      source_type TEXT DEFAULT 'mined',  -- mined | generated | manual
      source_chunk_id UUID REFERENCES public.rag_chunks(id) ON DELETE SET NULL,
      confidence FLOAT DEFAULT 1.0,

      metadata JSONB DEFAULT '{}',
      created_at TIMESTAMPTZ DEFAULT now()
    );

    -- RLS 정책
    ALTER TABLE public.rag_examples ENABLE ROW LEVEL SECURITY;

    CREATE POLICY "Users can CRUD own examples" ON public.rag_examples
    FOR ALL USING (auth.uid() = user_id);
    ```

  - `Key Variables`: `id`, `rule_id`, `example_type`, `example_text`
  - `Safety`: FK CASCADE 설정 (rule 삭제 시 examples도 삭제)

---

### P2-03: `rag_templates` 테이블 생성

**담당**: DB 엔지니어  
**우선순위**: 🔴 Critical

---

- [x] **P2-03-A**: 마이그레이션 SQL 작성 ✅ **CREATED (2025-12-29 21:36)**

  - `Target`: `supabase/migrations/040_phase2_template_builder.sql` (동일 파일에 추가)
  - `Logic (Pseudo)`:

    ```sql
    -- rag_templates: 최종 평가 템플릿
    CREATE TABLE public.rag_templates (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id UUID,
      user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      document_id UUID REFERENCES public.user_documents(id) ON DELETE SET NULL,

      name TEXT NOT NULL,
      description TEXT,
      version INT DEFAULT 1,

      status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'pending', 'approved', 'rejected')),
      is_public BOOLEAN DEFAULT false,

      criteria_json JSONB NOT NULL DEFAULT '[]',  -- TemplateSchema[] 저장

      approved_at TIMESTAMPTZ,
      approved_by UUID REFERENCES auth.users(id),
      rejection_reason TEXT,

      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now()
    );

    -- RLS 정책 (본인 + 공개 템플릿)
    ALTER TABLE public.rag_templates ENABLE ROW LEVEL SECURITY;

    CREATE POLICY "Users can select own or public templates" ON public.rag_templates
    FOR SELECT USING (auth.uid() = user_id OR is_public = true);

    CREATE POLICY "Users can insert own templates" ON public.rag_templates
    FOR INSERT WITH CHECK (auth.uid() = user_id);

    CREATE POLICY "Users can update own templates" ON public.rag_templates
    FOR UPDATE USING (auth.uid() = user_id);

    CREATE POLICY "Users can delete own templates" ON public.rag_templates
    FOR DELETE USING (auth.uid() = user_id);
    ```

  - `Key Variables`: `id`, `name`, `status`, `criteria_json`, `is_public`
  - `Safety`: 공개 템플릿 SELECT 허용, CUD는 본인만

---

## 📋 Phase 2.2: TypeScript 타입 확장

### P2-04: TemplateSchemaV2 타입 추가

**담당**: 백엔드 개발자  
**우선순위**: 🟠 High

---

- [x] **P2-04-A**: 확장 타입 정의 ✅ **ALREADY IMPLEMENTED (2025-12-30 19:56 확인)**

  - `Target`: `frontend/src/lib/rag/templateTypes.ts`
  - `Result`: ✅ **이미 구현됨**
    - `GateKeeperResult` (Line 42-49): citation, consistency, hallucination 검증 결과
    - `TemplateSchemaV2` (Line 56-78): TemplateSchema 확장, Lineage 추적 포함
  - `Key Variables`: `source_rule_id`, `source_chunk_ids`, `gate_results`, `created_by`, `model_used`
  - `Safety`: 기존 `TemplateSchema` 유지, 확장만

---

### P2-05: DB 엔티티 타입 추가

**담당**: 프론트엔드 개발자  
**우선순위**: 🟠 High

---

- [x] **P2-05-A**: DB 엔티티 인터페이스 추가 ✅ **ALREADY IMPLEMENTED (2025-12-30 19:56 확인)**

  - `Target`: `frontend/src/types/rag.ts`
  - `Result`: ✅ **이미 구현됨** (Line 497-611)
    - `RuleCategory`, `ExtractionMethod`, `ExampleType`, `ExampleSourceType`, `RagTemplateStatus` 타입 별칭 (Line 501-514)
    - `RagRule` (Line 520-545): 문서에서 추출된 원자적 규칙
    - `RagExample` (Line 551-574): 좋은/나쁜 예시
    - `RagTemplate` (Line 580-611): 최종 평가 템플릿
  - `Key Variables`: `RagRule`, `RagExample`, `RagTemplate`
  - `Safety`: 기존 타입 유지, Phase 2 DB 스키마와 완전 동기화됨

---

## 📋 Phase 2.3: 마이그레이션 실행

### P2-06: 마이그레이션 파일 통합 생성

**담당**: DB 엔지니어  
**우선순위**: 🔴 Critical

---

- [x] **P2-06-A**: 통합 마이그레이션 파일 생성 ✅ **CREATED**

  - `Target`: `supabase/migrations/040_phase2_template_builder.sql`
  - `Result`: **226줄 생성 완료**

    - 3개 테이블: `rag_rules`, `rag_examples`, `rag_templates`
    - 9개 인덱스
    - 12개 RLS 정책
    - 테이블 코멘트 포함

  - `Target`: `supabase/migrations/040_phase2_template_builder.sql` (신규)
  - `Logic (Pseudo)`:

    ```sql
    -- =============================================================================
    -- Migration: 040_phase2_template_builder.sql
    -- Phase 2: Template Builder Schema
    -- Date: 2025-12-29
    -- =============================================================================

    -- 1. rag_rules (P2-01)
    -- 2. rag_examples (P2-02)
    -- 3. rag_templates (P2-03)
    -- 4. Indexes
    -- 5. RLS Policies
    -- 6. Comments
    -- 7. NOTIFY pgrst
    ```

  - `Safety`: 트랜잭션으로 전체 실행, 실패 시 롤백

---

### P2-07: Supabase 배포

**담당**: DB 엔지니어  
**우선순위**: 🔴 Critical

---

- [x] **P2-07-A**: SQL 실행 ✅ **DEPLOYED (2025-12-29 21:47)**

  - `Target`: Supabase Dashboard > SQL Editor
  - `Result`: **Success. No rows returned** (정상)

    ```pseudo
    1. Supabase Dashboard 접속
    2. SQL Editor 열기
    3. 040_phase2_template_builder.sql 내용 붙여넣기
    4. "Run" 클릭
    5. 결과 확인: "Success. 3 tables created"
    ```

  - `Safety`: 롤백 SQL 준비 (DROP TABLE)

---

### P2-08: 배포 검증

**담당**: QA 엔지니어  
**우선순위**: 🟠 High

---

- [x] **P2-08-A**: 테이블 생성 확인 ✅ **VERIFIED (2025-12-29 21:58)**

  - `Target`: Supabase SQL Editor
  - `Result`: **3개 테이블 확인됨**
    - ✅ `rag_rules`
    - ✅ `rag_examples`
    - ✅ `rag_templates`

---

## ✅ Definition of Done (검증) - **ALL PASS ✅**

### 필수 완료 조건 ✅ **ALL VERIFIED (2025-12-30 20:00)**

| #   | 항목                        | 검증 방법                | 상태 | 비고                             |
| --- | --------------------------- | ------------------------ | ---- | -------------------------------- |
| 1   | `rag_rules` 테이블 생성     | Supabase Table Editor    | ✅   | 12컬럼                           |
| 2   | `rag_examples` 테이블 생성  | Supabase Table Editor    | ✅   | 10컬럼                           |
| 3   | `rag_templates` 테이블 생성 | Supabase Table Editor    | ✅   | 13컬럼                           |
| 4   | RLS 정책 적용               | 마이그레이션 포함 (12개) | ✅   | DROP IF EXISTS 추가됨            |
| 5   | **P2-04** TemplateSchemaV2  | templateTypes.ts L56-78  | ✅   | GateKeeperResult L42-49          |
| 6   | **P2-05** DB 엔티티 타입    | rag.ts L497-611          | ✅   | RagRule, RagExample, RagTemplate |
| 7   | `npm run build` 성공        | Exit code: 0             | ✅   | 2025-12-30 20:00                 |
| 8   | 기존 기능 회귀 없음         | Phase 1 타입 유지됨      | ✅   |

### 코드 품질 체크

- [x] 마이그레이션 SQL에 주석 포함
- [x] TypeScript 타입에 JSDoc 주석
- [x] 롤백 SQL 준비

---

## 📊 예상 소요 시간

| 작업                           | 시간         | 병렬 가능 |
| ------------------------------ | ------------ | --------- |
| P2-01 ~ P2-03: DB 스키마       | 1시간        | Yes       |
| P2-04 ~ P2-05: TypeScript 타입 | 30분         | Yes       |
| P2-06 ~ P2-08: 마이그레이션    | 30분         | No (순차) |
| 검증 및 테스트                 | 30분         | No        |
| **총계**                       | **~2.5시간** |           |

---

## 🚨 Rollback Plan

### 테이블 삭제 (문제 발생 시)

```sql
-- 긴급 롤백: Phase 2 테이블 제거
DROP TABLE IF EXISTS public.rag_examples CASCADE;
DROP TABLE IF EXISTS public.rag_rules CASCADE;
DROP TABLE IF EXISTS public.rag_templates CASCADE;
NOTIFY pgrst, 'reload schema';
```

---

## 🚀 다음 단계

Phase 2 완료 후 → [Phase 3: 기존 기능 연결](./2512290313_Phase3_Feature_Integration_Checklist.md)
