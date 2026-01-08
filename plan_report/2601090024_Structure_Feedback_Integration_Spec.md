# AI Structurer: 결과 저장 및 피드백 연동 기술 명세

> **문서 ID**: 2601090024_Structure_Feedback_Integration_Spec  
> **작성일**: 2026-01-09  
> **상태**: Draft - 사용자 리뷰 대기

---

## 1. 개요

### 1.1 배경

현재 AI Structurer의 분석 결과는 프론트엔드 state에만 존재하며, 페이지 이동 또는 새로고침 시 **일회성으로 소멸**됩니다. 이는 서비스의 핵심 방향인 **"사용자 선택이 RAG 시스템 발전에 영향을 주는 Adaptive Learning"**과 맞지 않습니다.

### 1.2 목표

1. AI Structurer 분석 결과를 **DB에 영구 저장**
2. 사용자의 순서 조정 이력을 **기록 및 추적**
3. 기존 **`/api/rag/feedback` 시스템과 연동**하여 RAG 임계값에 반영
4. 유튜브 알고리즘처럼 **선택 → 학습 → 개선**의 피드백 루프 구축

---

## 2. 현재 상태 분석

### 2.1 기존 인프라 (재사용 가능)

| 컴포넌트                  | 설명                                      | 위치                            |
| ------------------------- | ----------------------------------------- | ------------------------------- |
| `project_rag_preferences` | 프로젝트별 RAG 임계값 관리                | DB 테이블                       |
| `applyLearningEvent()`    | 피드백 → 임계값 조정 로직                 | `lib/rag/projectPreferences.ts` |
| `/api/rag/feedback`       | 학습 이벤트 제출 API                      | `app/api/rag/feedback/route.ts` |
| 기존 signalType           | 7가지 (`chat_helpful`, `rubric_adopt` 등) | `lib/rag/projectPreferences.ts` |

### 2.2 현재 gap

- ❌ `structure_suggestions` 테이블 없음
- ❌ `structure_user_adjustments` 테이블 없음
- ❌ Structure 관련 signalType 없음
- ❌ `/api/rag/structure/analyze` → DB 저장 미구현
- ❌ 순서 적용 시 피드백 연동 미구현

---

## 3. DB 스키마 설계

### 3.1 `structure_suggestions` 테이블

AI Structurer의 분석 결과를 저장합니다.

```sql
-- Migration: 077_structure_suggestions.sql
CREATE TABLE IF NOT EXISTS public.structure_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 관계
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- 분석 컨텍스트
  template_id UUID REFERENCES public.rag_templates(id) ON DELETE SET NULL,
  target_doc_ids UUID[] DEFAULT '{}',  -- 선택 분석 시 대상 문서 ID
  is_selective_mode BOOLEAN DEFAULT FALSE,

  -- AI 분석 결과 (JSONB)
  suggested_order JSONB NOT NULL,  -- [{docId, order, assignedTag, reason}, ...]
  gaps JSONB DEFAULT '[]',         -- [{gapType, description, suggestedSolution}, ...]
  overall_summary TEXT,

  -- 메타데이터
  doc_count INTEGER NOT NULL,
  analyzed_at TIMESTAMPTZ DEFAULT NOW(),

  -- 사용자 행동 추적
  is_applied BOOLEAN DEFAULT FALSE,
  applied_at TIMESTAMPTZ,
  is_modified BOOLEAN DEFAULT FALSE,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스
CREATE INDEX idx_structure_suggestions_project ON public.structure_suggestions(project_id);
CREATE INDEX idx_structure_suggestions_user ON public.structure_suggestions(user_id);

-- RLS
ALTER TABLE public.structure_suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own suggestions"
  ON public.structure_suggestions FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own suggestions"
  ON public.structure_suggestions FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own suggestions"
  ON public.structure_suggestions FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());
```

### 3.2 `structure_user_adjustments` 테이블

```sql
-- Migration: 078_structure_user_adjustments.sql
CREATE TABLE IF NOT EXISTS public.structure_user_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  suggestion_id UUID NOT NULL REFERENCES public.structure_suggestions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  original_order JSONB NOT NULL,
  adjusted_order JSONB NOT NULL,
  adjustment_type TEXT NOT NULL,  -- 'drag_reorder' | 'manual_edit'
  adjusted_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_structure_adjustments_suggestion ON public.structure_user_adjustments(suggestion_id);

ALTER TABLE public.structure_user_adjustments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own adjustments"
  ON public.structure_user_adjustments FOR ALL
  TO authenticated
  USING (user_id = auth.uid());
```

---

## 4. 신규 signalType 정의

| signalType         | 설명                   | 임계값 조정 |
| ------------------ | ---------------------- | ----------- |
| `structure_accept` | AI 제안을 그대로 적용  | +0.02       |
| `structure_modify` | AI 제안을 수정 후 적용 | -0.01       |
| `structure_reject` | AI 제안을 무시         | -0.02       |

---

## 5. API 수정 계획

### 5.1 `POST /api/rag/structure/analyze` 수정

분석 결과를 DB에 저장하고 `suggestionId` 반환

### 5.2 `PATCH /api/documents/reorder` 수정

`suggestionId` 파라미터 추가, 피드백 시스템 연동

### 5.3 신규: `GET /api/rag/structure/history`

프로젝트의 과거 분석 이력 조회

---

## 6. 구현 체크리스트

### Phase 1: DB 스키마 (30분)

- [ ] `077_structure_suggestions.sql` 작성
- [ ] `078_structure_user_adjustments.sql` 작성
- [ ] Supabase 마이그레이션 적용

### Phase 2: signalType 추가 (15분)

- [ ] `projectPreferences.ts`에 신규 signalType 추가

### Phase 3: API 수정 (1시간)

- [ ] `/api/rag/structure/analyze` - DB 저장
- [ ] `/api/documents/reorder` - 피드백 연동

### Phase 4: 프론트엔드 수정 (30분)

- [ ] `StructureTab.tsx` - suggestionId 상태 관리

### Phase 5: 테스트 및 배포 (30분)

- [ ] 빌드 검증 및 배포

---

## 7. 다음 단계

이 문서가 승인되면 **Phase 1 (DB 스키마)** 부터 순차적으로 구현을 시작합니다.
