# 🟡 Phase 2: Template Builder 구조 도입 상세 체크리스트

> **생성일**: 2025-12-29 03:19  
> **상위 문서**: [Architecture_Refactoring_Master_Plan.md](./2512290307_Architecture_Refactoring_Master_Plan.md)  
> **선행 조건**: Phase 1 완료  
> **목표**: 평가 기준을 프롬프트 하드코딩에서 데이터 기반으로 전환  
> **예상 소요**: 6~8시간

---

## 📌 현재 상태 분석

### ✅ 이미 구현된 항목 (재사용 가능)

| 파일                       | 내용                                                     | 상태                        |
| -------------------------- | -------------------------------------------------------- | --------------------------- |
| `lib/rag/templateTypes.ts` | `TemplateSchema`, `Template`, `TemplateStatus` 타입 정의 | ✅ 완료                     |
| `lib/rag/templateTypes.ts` | `templateSchemaValidator`, `templateValidator` (Zod)     | ✅ 완료                     |
| `lib/rag/rubricAdapter.ts` | `RubricAdapter` (v2 Rubric ↔ v3 Template 변환)           | ✅ 완료                     |
| `lib/rag/rubrics.ts`       | `DEFAULT_RUBRICS` (10개 기본 루브릭)                     | ✅ 완료 (마이그레이션 대상) |

### ❌ 미구현 항목 (이번 Phase에서 구현)

| 항목                      | 설명                                                |
| ------------------------- | --------------------------------------------------- |
| `rag_rules` DB 테이블     | 문서에서 추출된 원자적 규칙 저장                    |
| `rag_examples` DB 테이블  | 좋은 예시/나쁜 예시 저장                            |
| `rag_templates` DB 테이블 | 규칙 + 예시가 결합된 최종 평가 세트                 |
| Template Builder API      | 문서 → 규칙 추출 → 예시 생성 → 템플릿 생성          |
| Gate-Keeper 로직          | Citation Gate, Consistency Gate, Hallucination Gate |

---

## 🏛️ 아키텍처 설계

### 전체 흐름

```
[문서 업로드]
     ↓
[Phase A: Template Builder] (비동기/배치)
     │
     ├─ 1. Rule Extraction (규칙 추출)
     │      └─ BM25로 규칙 후보 검색 → LLM으로 정제
     │
     ├─ 2. Example Mining/Generation (예시 채굴/생성)
     │      └─ 원문에서 예시 추출 → 없으면 LLM 생성
     │
     ├─ 3. Template Induction (템플릿 생성)
     │      └─ 규칙 + 예시 결합 → JSON 템플릿 생성
     │
     └─ 4. Gate-Keeper (검증)
            └─ Citation Gate → Consistency Gate → Hallucination Gate
                    ↓
            [승인] → rag_templates 저장
            [거절] → 재시도 또는 Fallback

[Phase B: Alignment Judge] (실시간)
     │
     └─ 사용자 글 → 템플릿 로드 → 평가 → 피드백
```

---

## 📋 Phase 2.1: 스키마 설계

### P2-01: `rag_rules` 테이블 설계

**목표**: 문서에서 추출된 원자적 규칙(원칙/지침) 저장

**스키마 설계**:

```sql
CREATE TABLE public.rag_rules (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Foreign Keys
  document_id UUID REFERENCES public.user_documents(id) ON DELETE CASCADE,
  chunk_id UUID REFERENCES public.rag_chunks(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Rule Content
  rule_text TEXT NOT NULL,           -- 규칙 텍스트 (예: "~해야 한다")
  category TEXT NOT NULL,            -- 카테고리 (structure, expression, tone, prohibition)
  confidence FLOAT DEFAULT 1.0,      -- 추출 신뢰도 (0.0 ~ 1.0)

  -- Source/Lineage
  source_quote TEXT,                 -- 원문 인용
  extraction_method TEXT DEFAULT 'llm', -- 추출 방법 (llm, manual, rule-based)

  -- Metadata
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_rag_rules_user_id ON public.rag_rules(user_id);
CREATE INDEX idx_rag_rules_document_id ON public.rag_rules(document_id);
CREATE INDEX idx_rag_rules_category ON public.rag_rules(category);

-- RLS
ALTER TABLE public.rag_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own rules"
ON public.rag_rules FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own rules"
ON public.rag_rules FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own rules"
ON public.rag_rules FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own rules"
ON public.rag_rules FOR DELETE
USING (auth.uid() = user_id);
```

**담당**: DB 엔지니어  
**상태**: ⬜ 미완료

---

### P2-02: `rag_examples` 테이블 설계

**목표**: 좋은 예시/나쁜 예시 저장

**스키마 설계**:

```sql
CREATE TABLE public.rag_examples (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Foreign Keys
  rule_id UUID REFERENCES public.rag_rules(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Example Content
  example_type TEXT NOT NULL CHECK (example_type IN ('positive', 'negative')),
  example_text TEXT NOT NULL,        -- 예시 텍스트 (3~6문장)
  diff_hint TEXT,                    -- 나쁜 예 → 좋은 예 변환 힌트

  -- Source
  source_type TEXT DEFAULT 'mined' CHECK (source_type IN ('mined', 'generated', 'manual')),
  source_chunk_id UUID REFERENCES public.rag_chunks(id) ON DELETE SET NULL,
  confidence FLOAT DEFAULT 1.0,

  -- Metadata
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_rag_examples_rule_id ON public.rag_examples(rule_id);
CREATE INDEX idx_rag_examples_user_id ON public.rag_examples(user_id);
CREATE INDEX idx_rag_examples_type ON public.rag_examples(example_type);

-- RLS
ALTER TABLE public.rag_examples ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own examples"
ON public.rag_examples FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own examples"
ON public.rag_examples FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own examples"
ON public.rag_examples FOR DELETE
USING (auth.uid() = user_id);
```

**담당**: DB 엔지니어  
**상태**: ⬜ 미완료

---

### P2-03: `rag_templates` 테이블 설계

**목표**: 규칙 + 예시가 결합된 최종 평가 템플릿 저장

**스키마 설계**:

```sql
CREATE TABLE public.rag_templates (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Ownership
  tenant_id UUID,                     -- 테넌트 ID (멀티테넌시)
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  document_id UUID REFERENCES public.user_documents(id) ON DELETE SET NULL,

  -- Template Info
  name TEXT NOT NULL,
  description TEXT,
  version INT DEFAULT 1,

  -- Status & Workflow
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'pending', 'approved', 'rejected')),
  is_public BOOLEAN DEFAULT false,

  -- Template Content (JSONB로 TemplateSchema[] 저장)
  criteria_json JSONB NOT NULL DEFAULT '[]',

  -- Approval Workflow
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES auth.users(id),
  rejection_reason TEXT,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_rag_templates_user_id ON public.rag_templates(user_id);
CREATE INDEX idx_rag_templates_status ON public.rag_templates(status);
CREATE INDEX idx_rag_templates_document_id ON public.rag_templates(document_id);

-- RLS
ALTER TABLE public.rag_templates ENABLE ROW LEVEL SECURITY;

-- 본인 템플릿 또는 공개 템플릿 조회 가능
CREATE POLICY "Users can select own or public templates"
ON public.rag_templates FOR SELECT
USING (auth.uid() = user_id OR is_public = true);

CREATE POLICY "Users can insert own templates"
ON public.rag_templates FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own templates"
ON public.rag_templates FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own templates"
ON public.rag_templates FOR DELETE
USING (auth.uid() = user_id);
```

**담당**: DB 엔지니어  
**상태**: ⬜ 미완료

---

### P2-04: 테이블 간 관계 정의 (Lineage)

**ERD (Entity Relationship Diagram)**:

```
┌──────────────────┐     ┌──────────────────┐
│  user_documents  │────▶│    rag_chunks    │
└──────────────────┘     └──────────────────┘
         │                        │
         │                        │
         ▼                        ▼
┌──────────────────┐     ┌──────────────────┐
│    rag_rules     │◀────│                  │
└──────────────────┘     │                  │
         │               │                  │
         │ 1:N           │                  │
         ▼               │                  │
┌──────────────────┐     │                  │
│   rag_examples   │◀────┤   source_chunk   │
└──────────────────┘     │                  │
         │               │                  │
         └───────────┐   │                  │
                     │   │                  │
                     ▼   ▼                  │
              ┌──────────────────┐          │
              │  rag_templates   │◀─────────┘
              │ (criteria_json)  │
              └──────────────────┘
```

**Lineage 추적 쿼리 예시**:

```sql
-- 특정 템플릿의 원본 청크 추적
SELECT
  t.name as template_name,
  r.rule_text,
  e.example_text,
  c.content as source_chunk
FROM rag_templates t
JOIN LATERAL jsonb_array_elements(t.criteria_json) as criteria ON true
LEFT JOIN rag_rules r ON r.id::text = criteria->>'source_rule_id'
LEFT JOIN rag_examples e ON e.rule_id = r.id
LEFT JOIN rag_chunks c ON c.id = r.chunk_id
WHERE t.id = :template_id;
```

**담당**: DB 엔지니어  
**상태**: ⬜ 미완료

---

## 📋 Phase 2.2: Template JSON 스키마 정의

### P2-05: Template JSON 스키마 확정

**현재 정의** (`lib/rag/templateTypes.ts`):

```typescript
interface TemplateSchema {
  criteria_id: string;
  category: "tone" | "structure" | "expression" | "prohibition";
  rationale: string;
  positive_examples: string[];
  negative_examples: string[];
  remediation_steps: string[];
  source_citations: string[];
  confidence_score?: number;
}
```

**확장 제안**:

```typescript
interface TemplateSchemaV2 extends TemplateSchema {
  // Lineage (원본 추적)
  source_rule_id?: string; // rag_rules.id
  source_chunk_ids?: string[]; // rag_chunks.id[]

  // 검증 결과
  gate_results?: {
    citation_passed: boolean;
    consistency_passed: boolean;
    hallucination_passed: boolean;
  };

  // 메타데이터
  created_by?: "llm" | "manual" | "migration";
  model_used?: string; // 생성에 사용된 LLM 모델
}
```

**작업 내용**: `templateTypes.ts`에 V2 스키마 추가

**담당**: 백엔드 개발자  
**상태**: ⬜ 미완료

---

## 📋 Phase 2.3: 마이그레이션 스크립트

### P2-06: 마이그레이션 SQL 작성

**파일명**: `supabase/migrations/040_rag_templates.sql`

**작업 내용**: P2-01 ~ P2-03의 SQL을 통합하여 단일 마이그레이션 파일 생성

```sql
-- =============================================================================
-- Migration: 040_rag_templates.sql
-- Description: Phase 2 - Template Builder Schema
-- Date: 2025-12-29
-- =============================================================================

-- 1. rag_rules 테이블 (P2-01)
-- [SQL from P2-01]

-- 2. rag_examples 테이블 (P2-02)
-- [SQL from P2-02]

-- 3. rag_templates 테이블 (P2-03)
-- [SQL from P2-03]

-- 4. Schema Cache Reload
NOTIFY pgrst, 'reload schema';

-- 5. Comment
COMMENT ON TABLE public.rag_rules IS 'Phase 2: 문서에서 추출된 원자적 규칙';
COMMENT ON TABLE public.rag_examples IS 'Phase 2: 좋은/나쁜 예시';
COMMENT ON TABLE public.rag_templates IS 'Phase 2: 최종 평가 템플릿';
```

**담당**: DB 엔지니어  
**상태**: ⬜ 미완료

---

### P2-07: 로컬 테스트

**테스트 방법**:

```powershell
# Supabase CLI로 로컬 DB 시작 (설치되어 있다면)
supabase start

# 마이그레이션 적용
supabase db push

# 또는 Supabase Dashboard에서 SQL 직접 실행
```

**검증 항목**:

- [ ] 테이블 3개 생성 확인 (`rag_rules`, `rag_examples`, `rag_templates`)
- [ ] RLS 정책 적용 확인
- [ ] FK 관계 정상 동작 확인

**담당**: DB 엔지니어  
**상태**: ⬜ 미완료

---

### P2-08: Supabase 배포

**배포 방법**:

1. Supabase Dashboard → SQL Editor 접속
2. `040_rag_templates.sql` 내용 붙여넣기
3. "Run" 클릭
4. 결과 확인

**롤백 SQL** (문제 발생 시):

```sql
DROP TABLE IF EXISTS public.rag_examples CASCADE;
DROP TABLE IF EXISTS public.rag_rules CASCADE;
DROP TABLE IF EXISTS public.rag_templates CASCADE;
```

**담당**: DB 엔지니어  
**상태**: ⬜ 미완료

---

## 📋 Phase 2.4: 기존 Rubrics 마이그레이션 (선택)

### P2-09: DEFAULT_RUBRICS → rag_templates 마이그레이션

**목표**: 기존 `rubrics.ts`의 10개 기본 루브릭을 `rag_templates`로 이전

**현재 Rubrics** (`lib/rag/rubrics.ts`):
| ID | 이름 | 카테고리 | 가중치 |
|----|------|----------|--------|
| structure_intro | 서론 구성 | structure | 10 |
| structure_body | 본론 전개 | structure | 15 |
| structure_conclusion | 결론 정리 | structure | 10 |
| content_accuracy | 내용 정확성 | content | 15 |
| content_depth | 내용 깊이 | content | 10 |
| logic_coherence | 논리적 일관성 | logic | 10 |
| logic_reasoning | 논증 타당성 | logic | 10 |
| evidence_quality | 근거 품질 | evidence | 10 |
| evidence_relevance | 근거 관련성 | evidence | 5 |
| expression_clarity | 표현 명확성 | expression | 5 |

**마이그레이션 전략**:

1. `RubricAdapter.toTemplate()`로 각 Rubric → TemplateSchema 변환
2. 변환된 템플릿을 `rag_templates`에 INSERT
3. 기존 `DEFAULT_RUBRIC_SET`은 유지 (Fallback용)

**담당**: 백엔드 개발자  
**상태**: ⬜ 선택사항

---

## ✅ Phase 2 완료 기준

- [ ] `rag_rules`, `rag_examples`, `rag_templates` 테이블 생성 완료
- [ ] RLS 정책 적용 완료
- [ ] TypeScript 타입과 DB 스키마 동기화
- [ ] 마이그레이션 SQL Supabase 배포 완료
- [ ] (선택) 기존 Rubrics 데이터 마이그레이션 완료

---

## 📊 Phase 2 검증 계획

### 자동화 테스트

```powershell
# TypeScript 빌드 테스트
cd frontend
npx tsc --noEmit
```

### 수동 검증

| #   | 테스트 항목      | 수행 방법                  | 예상 결과       |
| --- | ---------------- | -------------------------- | --------------- |
| 1   | 테이블 생성 확인 | Supabase Table Editor 확인 | 3개 테이블 존재 |
| 2   | INSERT 테스트    | SQL Editor에서 INSERT 실행 | 성공            |
| 3   | RLS 검증         | 다른 사용자로 SELECT 시도  | 빈 결과         |
| 4   | 기존 기능 회귀   | 평가 기능 테스트           | 정상 동작       |

---

## 📊 진행률

```
Phase 2.1: 스키마 설계
  P2-01 [⬜] rag_rules 테이블 설계
  P2-02 [⬜] rag_examples 테이블 설계
  P2-03 [⬜] rag_templates 테이블 설계
  P2-04 [⬜] 테이블 간 관계 정의

Phase 2.2: Template JSON 스키마 정의
  P2-05 [⬜] Template JSON 스키마 확정

Phase 2.3: 마이그레이션 스크립트
  P2-06 [⬜] 마이그레이션 SQL 작성
  P2-07 [⬜] 로컬 테스트
  P2-08 [⬜] Supabase 배포

Phase 2.4: 기존 Rubrics 마이그레이션 (선택)
  P2-09 [⬜] DEFAULT_RUBRICS → rag_templates

완료: 0/9 (0%)
```

---

## 🚀 다음 단계

Phase 2 완료 후 → [Phase 3: 기존 기능 연결](./2512290313_Phase3_Feature_Integration_Checklist.md)
