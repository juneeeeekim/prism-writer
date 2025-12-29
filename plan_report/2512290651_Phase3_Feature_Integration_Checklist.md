# 🟢 Phase 3: 기존 기능 연결 상세 체크리스트

> **생성일**: 2025-12-29 06:51  
> **상위 문서**: [Architecture_Refactoring_Master_Plan.md](./2512290307_Architecture_Refactoring_Master_Plan.md)  
> **선행 조건**: Phase 2 완료 (`rag_templates` 테이블 생성 완료)  
> **목표**: 평가, 채팅 기능을 Template 기반으로 연결  
> **예상 소요**: 4~6시간

---

## 📌 현재 상태 분석

### ✅ 이미 구현된 항목 (재사용 가능)

| 파일                        | 내용                                                         | 상태    |
| --------------------------- | ------------------------------------------------------------ | ------- |
| `lib/rag/rubricAdapter.ts`  | `RubricAdapter` 클래스 (v2 Rubric ↔ v3 Template 변환)        | ✅ 완료 |
| `api/rag/evaluate/route.ts` | v3 평가 로직 (`useV3` 파라미터, `ENABLE_PIPELINE_V5` 플래그) | ✅ 완료 |
| `api/rag/evaluate/route.ts` | `RubricAdapter.toTemplate()` Fallback 로직                   | ✅ 완료 |
| `lib/rag/templateTypes.ts`  | `TemplateSchema`, `Template` 타입 정의                       | ✅ 완료 |

### 🟡 부분 구현 (확장 필요)

| 파일                                 | 내용                   | 상태         |
| ------------------------------------ | ---------------------- | ------------ |
| `api/rag/evaluate-single/route.ts`   | Template 지원 없음     | 🟡 확장 필요 |
| `api/rag/evaluate-holistic/route.ts` | Template 지원 없음     | 🟡 확장 필요 |
| `api/chat/route.ts`                  | Template 컨텍스트 없음 | 🟡 확장 필요 |

### ❌ 미구현 (이번 Phase에서 구현)

| 항목                                   | 설명                               |
| -------------------------------------- | ---------------------------------- |
| Feature Flag 시스템                    | v2/v3 전환을 위한 통합 플래그 관리 |
| 평가 결과에 `source_citations` 포함    | 근거 원문 인용 표시                |
| 채팅 RAG 검색에 Template 컨텍스트 추가 | 템플릿 기반 응답 품질 향상         |

---

## 🏛️ 아키텍처 설계

### 현재 평가 API 흐름 (v3 모드)

```
[사용자 글] → [evaluate API]
                   │
                   ├─ 1. 템플릿 조회 (rag_templates)
                   │      └─ 없으면 DEFAULT_RUBRICS → RubricAdapter.toTemplate()
                   │
                   ├─ 2. 참고자료 검색 (vectorSearch)
                   │      └─ 카테고리 격리 적용
                   │
                   ├─ 3. Align Judge 실행
                   │      └─ templateSchema.map(criteria => runAlignJudge)
                   │
                   ├─ 4. Upgrade Planner 실행
                   │      └─ 실패 항목 → runUpgradePlanner
                   │
                   └─ 5. 결과 반환 (v3Result + legacyResult)
```

### 목표 아키텍처 (Phase 3 완료 후)

```
┌─────────────────────────────────────────────────────────────┐
│                   Feature Flag System                        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │ENABLE_V3_   │  │USE_TEMPLATE │  │ENABLE_SOURCE_       │  │
│  │EVALUATION   │  │_FOR_CHAT    │  │CITATIONS            │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
           ┌──────────────────┼──────────────────┐
           ▼                  ▼                  ▼
   [/api/rag/evaluate]  [/api/chat]    [/api/rag/evaluate-*]
           │                  │                  │
           └───────── rag_templates ─────────────┘
                             │
                    [Alignment Judge]
                             │
                    [User Response]
```

---

## 📋 Phase 3.1: Feature Flag 시스템 구현

### P3-01: Feature Flag 상수 파일 생성

**목표**: 환경 변수 기반 Feature Flag 중앙 관리

**신규 파일**: `frontend/src/config/featureFlags.ts`

```typescript
// =============================================================================
// PRISM Writer - Feature Flags
// =============================================================================
// 파일: frontend/src/config/featureFlags.ts
// 역할: v2/v3 전환 및 신규 기능 Feature Flag 관리
// =============================================================================

/**
 * Feature Flag: v3 평가 시스템 사용 여부
 * 환경 변수: ENABLE_PIPELINE_V5
 * 기본값: true (v3 평가 활성화)
 */
export const ENABLE_V3_EVALUATION = process.env.ENABLE_PIPELINE_V5 !== "false";

/**
 * Feature Flag: 채팅에 Template 컨텍스트 사용 여부
 * 환경 변수: USE_TEMPLATE_FOR_CHAT
 * 기본값: false (점진적 롤아웃)
 */
export const USE_TEMPLATE_FOR_CHAT =
  process.env.USE_TEMPLATE_FOR_CHAT === "true";

/**
 * Feature Flag: 평가 결과에 source_citations 포함 여부
 * 환경 변수: ENABLE_SOURCE_CITATIONS
 * 기본값: true (투명성 강화)
 */
export const ENABLE_SOURCE_CITATIONS =
  process.env.ENABLE_SOURCE_CITATIONS !== "false";

/**
 * Feature Flag: Shadow Mode (v2/v3 병렬 실행 및 비교 로깅)
 * 환경 변수: ENABLE_SHADOW_MODE
 * 기본값: false (성능 비용)
 */
export const ENABLE_SHADOW_MODE = process.env.ENABLE_SHADOW_MODE === "true";

/**
 * 모든 Feature Flags 객체
 */
export const FEATURE_FLAGS = {
  ENABLE_V3_EVALUATION,
  USE_TEMPLATE_FOR_CHAT,
  ENABLE_SOURCE_CITATIONS,
  ENABLE_SHADOW_MODE,
} as const;

/**
 * Feature Flag 상태 로깅 (서버 시작 시 호출)
 */
export function logFeatureFlags(): void {
  console.log("[Feature Flags]", JSON.stringify(FEATURE_FLAGS, null, 2));
}
```

**담당**: 백엔드 개발자  
**상태**: ⬜ 미완료

---

### P3-02: 기존 API에 Feature Flag 적용

**목표**: 기존 `evaluate` API 하드코딩된 플래그를 `featureFlags.ts`로 통합

**수정 파일**: `frontend/src/app/api/rag/evaluate/route.ts`

**현재 코드** (Line 122-124):

```typescript
// [FIX] ENABLE_PIPELINE_V5 플래그 사용 (3Panel UI와 분리)
const USE_V3_FLAG = process.env.ENABLE_PIPELINE_V5 !== "false";
const effectiveUseV3 = useV3 !== undefined ? useV3 : USE_V3_FLAG;
```

**변경 후**:

```typescript
import { ENABLE_V3_EVALUATION } from "@/config/featureFlags";

// Feature Flag 적용
const effectiveUseV3 = useV3 !== undefined ? useV3 : ENABLE_V3_EVALUATION;
```

**담당**: 백엔드 개발자  
**상태**: ⬜ 미완료

---

## 📋 Phase 3.2: RubricAdapter 확장

### P3-03: `RubricAdapter` 인터페이스 개선

**목표**: Batch 변환 메서드 및 역방향 매핑 개선

**수정 파일**: `frontend/src/lib/rag/rubricAdapter.ts`

**추가 메서드**:

```typescript
export class RubricAdapter {
  // ... 기존 메서드 ...

  /**
   * Rubric 배열을 TemplateSchema 배열로 일괄 변환
   */
  static toTemplateArray(rubrics: Rubric[]): TemplateSchema[] {
    return rubrics.filter((r) => r.enabled).map((r) => this.toTemplate(r));
  }

  /**
   * TemplateSchema 배열을 Rubric 배열로 일괄 변환
   */
  static toRubricArray(templates: TemplateSchema[]): Rubric[] {
    return templates.map((t) => this.toRubric(t));
  }

  /**
   * 기본 Rubrics를 TemplateSchema로 가져오기 (캐싱)
   */
  private static _defaultTemplates: TemplateSchema[] | null = null;

  static getDefaultTemplates(): TemplateSchema[] {
    if (!this._defaultTemplates) {
      this._defaultTemplates = this.toTemplateArray(DEFAULT_RUBRICS);
    }
    return this._defaultTemplates;
  }
}
```

**담당**: 백엔드 개발자  
**상태**: ⬜ 미완료

---

## 📋 Phase 3.3: 평가 기능 연결

### P3-04: `evaluate-single` API에 Template 지원 추가

**목표**: 단일 Criteria 재평가 시 Template 기반 평가 지원

**수정 파일**: `frontend/src/app/api/rag/evaluate-single/route.ts`

**현재 상태**: Template/TemplateSchema 사용 없음

**추가 사항**:

1. `templateId` 파라미터 추가
2. Template 조회 로직 추가
3. Feature Flag 적용 (`ENABLE_V3_EVALUATION`)

**코드 변경**:

```typescript
// 추가할 import
import {
  ENABLE_V3_EVALUATION,
  ENABLE_SOURCE_CITATIONS,
} from "@/config/featureFlags";
import { RubricAdapter } from "@/lib/rag/rubricAdapter";
import { type TemplateSchema } from "@/lib/rag/templateTypes";

// 요청 인터페이스 확장
interface EvaluateSingleRequest {
  userText: string;
  criteriaId: string;
  topK?: number;
  templateId?: string; // [NEW]
}

// POST 핸들러 내에서
// 1. Template 조회 (있으면 사용, 없으면 Rubric에서 변환)
let targetCriteria: TemplateSchema;

if (templateId && ENABLE_V3_EVALUATION) {
  const { data } = await supabase
    .from("rag_templates")
    .select("criteria_json")
    .eq("id", templateId)
    .single();

  if (data?.criteria_json) {
    const templates = data.criteria_json as TemplateSchema[];
    const found = templates.find((t) => t.criteria_id === criteriaId);
    if (found) {
      targetCriteria = found;
    }
  }
}

// Fallback: Rubric에서 변환
if (!targetCriteria) {
  const rubric = DEFAULT_RUBRICS.find((r) => r.id === criteriaId);
  if (rubric) {
    targetCriteria = RubricAdapter.toTemplate(rubric);
  }
}
```

**담당**: 백엔드 개발자  
**상태**: ⬜ 미완료

---

### P3-05: `evaluate-holistic` API에 Template 지원 추가

**목표**: 종합 평가 시 Template의 예시를 활용한 컨텍스트 강화

**수정 파일**: `frontend/src/app/api/rag/evaluate-holistic/route.ts`

**추가 사항**:

1. Template의 `positive_examples`/`negative_examples` 활용
2. `source_citations` 결과에 포함

**코드 변경**:

```typescript
// 1. Template 조회 (최신 approved)
const { data: templateData } = await supabase
  .from("rag_templates")
  .select("criteria_json")
  .eq("user_id", userId)
  .eq("status", "approved")
  .order("created_at", { ascending: false })
  .limit(1)
  .single();

// 2. Template 예시 컨텍스트 생성
let templateExamplesContext = "";
if (templateData?.criteria_json) {
  const templates = templateData.criteria_json as TemplateSchema[];
  templateExamplesContext = templates
    .filter((t) => t.positive_examples.length > 0)
    .map(
      (t) =>
        `[${t.rationale}]\n좋은 예: ${t.positive_examples[0]}\n나쁜 예: ${
          t.negative_examples[0] || "없음"
        }`
    )
    .join("\n\n");
}

// 3. runHolisticEvaluation에 전달
const result = await runHolisticEvaluation(
  userText,
  evidenceContext,
  category,
  templateExamplesContext // [NEW] 템플릿 예시 컨텍스트
);
```

**담당**: 백엔드 개발자  
**상태**: ⬜ 미완료

---

### P3-06: 평가 결과에 `source_citations` 포함

**목표**: 평가 근거의 원문 인용을 결과에 포함

**관련 타입** (`lib/judge/types.ts`):

- `JudgeResult.citation?: string` - 이미 존재

**구현 위치**: `lib/judge/alignJudge.ts`

**변경 사항**:

1. LLM 프롬프트에 "근거 원문 인용" 요청 추가
2. 응답 파싱 시 `citation` 필드 추출
3. Feature Flag 적용 (`ENABLE_SOURCE_CITATIONS`)

```typescript
// alignJudge.ts 프롬프트 수정
const prompt = `
...
${
  ENABLE_SOURCE_CITATIONS
    ? `
## 출력 형식
반드시 아래 JSON 형식으로만 응답하세요:
{
  "status": "pass" | "fail" | "partial",
  "reasoning": "판정 이유",
  "citation": "원문에서 근거가 된 부분 인용 (없으면 빈 문자열)"
}
`
    : "..."
}
`;
```

**담당**: 백엔드 개발자 + 프롬프트 엔지니어  
**상태**: ⬜ 미완료

---

## 📋 Phase 3.4: 채팅 기능 연결

### P3-07: 채팅 RAG 검색에 Template 컨텍스트 추가

**목표**: 채팅 응답 시 사용자 템플릿의 규칙/예시를 참고자료로 활용

**수정 파일**: `frontend/src/app/api/chat/route.ts`

**현재 상태** (Line 94-175):

- `hybridSearch`로 참고자료 검색
- `MemoryService`로 사용자 선호 검색
- Template 컨텍스트 없음

**추가 사항**:

```typescript
import { USE_TEMPLATE_FOR_CHAT } from "@/config/featureFlags";

// 2.7. Template Context Search (Phase 3)
let templateContext = "";
if (USE_TEMPLATE_FOR_CHAT && userId) {
  try {
    const { data: templateData } = await supabase
      .from("rag_templates")
      .select("criteria_json, name")
      .eq("user_id", userId)
      .eq("status", "approved")
      .limit(1)
      .single();

    if (templateData?.criteria_json) {
      const templates = templateData.criteria_json as TemplateSchema[];
      // 질문과 관련된 기준 찾기 (간단한 키워드 매칭)
      const relevantTemplates = templates
        .filter(
          (t) =>
            query.includes(t.category) ||
            t.rationale
              .toLowerCase()
              .includes(query.toLowerCase().split(" ")[0])
        )
        .slice(0, 2);

      if (relevantTemplates.length > 0) {
        templateContext = relevantTemplates
          .map((t) => {
            let ctx = `[평가 기준: ${t.rationale}]`;
            if (t.positive_examples.length > 0) {
              ctx += `\n좋은 예: ${t.positive_examples[0]}`;
            }
            if (t.negative_examples.length > 0) {
              ctx += `\n나쁜 예: ${t.negative_examples[0]}`;
            }
            return ctx;
          })
          .join("\n\n");
        console.log(
          `[Chat API] Applied template context for ${relevantTemplates.length} criteria`
        );
      }
    }
  } catch (err) {
    console.warn("[Chat API] Template fetch failed:", err);
  }
}
```

**시스템 프롬프트 수정** (Line 195-224):

```typescript
const improvedSystemPrompt = `
# 역할
당신은 PRISM Writer의 AI 글쓰기 어시스턴트입니다.

# 핵심 원칙
⚠️ 중요: 아래 참고 자료가 제공된 경우, 당신의 사전 지식보다 참고 자료를 우선해야 합니다.

# User Preferences (최우선 반영)
${userPreferencesContext || "(없음)"}

# 평가 기준 및 예시 (Template)
${templateContext || "(없음)"}

# 참고 자료
${context || "(참고 자료 없음)"}

...
`;
```

**담당**: 백엔드 개발자  
**상태**: ⬜ 미완료

---

### P3-08: 채팅 응답에 예시 기반 설명 포함

**목표**: 채팅 응답에서 Template의 좋은/나쁜 예시를 활용하여 구체적 조언 제공

**구현 방안**:

1. 시스템 프롬프트에 "예시 활용" 지침 추가
2. 응답 형식에 Before/After 예시 포함 유도

**프롬프트 수정**:

```typescript
# 응답 가이드라인
- 추상적 조언보다 구체적인 예시를 우선하세요
- 위의 "평가 기준 및 예시"가 있다면 다음과 같이 답변하세요:
  - "예를 들어, '나쁜 예'처럼 쓰면 ~~한 문제가 있고, '좋은 예'처럼 쓰면 ~~하게 개선됩니다."
- 예시가 없다면 일반적인 글쓰기 원칙을 적용하세요
```

**담당**: 프롬프트 엔지니어  
**상태**: ⬜ 미완료

---

## 📋 Phase 3.5: 회귀 테스트 및 검증

### P3-09: v2/v3 전환 테스트

**테스트 시나리오**:

| #   | Feature Flag 설정              | 테스트 항목 | 예상 결과            |
| --- | ------------------------------ | ----------- | -------------------- |
| 1   | `ENABLE_PIPELINE_V5=true`      | 평가 실행   | v3 결과 반환         |
| 2   | `ENABLE_PIPELINE_V5=false`     | 평가 실행   | v2 결과 반환         |
| 3   | `USE_TEMPLATE_FOR_CHAT=true`   | 채팅 질문   | 템플릿 컨텍스트 로그 |
| 4   | `USE_TEMPLATE_FOR_CHAT=false`  | 채팅 질문   | 템플릿 없이 응답     |
| 5   | `ENABLE_SOURCE_CITATIONS=true` | 평가 결과   | `citation` 필드 포함 |

**테스트 방법**:

```powershell
# 환경 변수 설정 후 테스트
$env:ENABLE_PIPELINE_V5="false"
npm run dev

# 브라우저에서 평가 실행 후 결과 확인
```

**담당**: QA 엔지니어  
**상태**: ⬜ 미완료

---

### P3-10: 회귀 테스트 체크리스트

**기존 기능 정상 동작 확인**:

| #   | 기능        | 테스트 방법                 | 예상 결과           | 실제 결과 |
| --- | ----------- | --------------------------- | ------------------- | --------- |
| 1   | 문서 업로드 | 참고자료 탭에서 파일 업로드 | 업로드 성공         | ⬜        |
| 2   | 문서 처리   | 업로드 후 처리 완료 대기    | 처리 완료           | ⬜        |
| 3   | 종합 평가   | "종합 평가하기" 클릭        | 점수 및 피드백 표시 | ⬜        |
| 4   | 기준별 평가 | "기준별 상세 평가" 클릭     | 10개 기준 평가 결과 | ⬜        |
| 5   | 개별 재평가 | 평가 항목 "재평가" 클릭     | 해당 항목만 재평가  | ⬜        |
| 6   | 채팅 기본   | 채팅 탭에서 질문            | AI 응답             | ⬜        |
| 7   | 채팅 RAG    | 참고자료 관련 질문          | 참고자료 기반 응답  | ⬜        |
| 8   | 평가 저장   | 평가 후 페이지 새로고침     | 결과 복원           | ⬜        |

**담당**: QA 엔지니어  
**상태**: ⬜ 미완료

---

## ✅ Phase 3 완료 기준 (마스터 플랜과 동기화)

### 핵심 검증 기준 ⭐

- [ ] **Feature Flag로 v2/v3 전환 가능** (`ENABLE_PIPELINE_V5`)
- [ ] **v3 모드에서 평가 결과에 인용 포함** (`source_citations`)
- [ ] **기존 v2 모드 정상 동작** (회귀 테스트 통과)

### 세부 완료 항목

- [ ] Feature Flag 시스템 구현 (`featureFlags.ts`) (P3-01, P3-02)
- [ ] `RubricAdapter` 확장 - Batch 변환 메서드 (P3-03)
- [ ] `evaluate-single` API Template 지원 (P3-04)
- [ ] `evaluate-holistic` API Template 지원 (P3-05)
- [ ] 평가 결과에 `source_citations` 포함 (P3-06)
- [ ] 채팅 API에 Template 컨텍스트 추가 (P3-07, P3-08)
- [ ] v2/v3 전환 테스트 완료 (P3-09)
- [ ] 회귀 테스트 완료 (P3-10)

---

## 📊 Phase 3 검증 계획

### 자동화 테스트

```powershell
# TypeScript 빌드 테스트
cd frontend
npx tsc --noEmit

# 환경 변수별 테스트
$env:ENABLE_PIPELINE_V5="false"
npm run dev
# 브라우저에서 v2 모드 확인

$env:ENABLE_PIPELINE_V5="true"
npm run dev
# 브라우저에서 v3 모드 확인
```

### 수동 검증

| #   | 테스트 항목        | 수행 방법                 | 예상 결과        |
| --- | ------------------ | ------------------------- | ---------------- |
| 1   | Feature Flag 전환  | 환경 변수 변경 후 재시작  | 해당 모드로 동작 |
| 2   | Template 평가      | 템플릿 생성 후 평가       | 템플릿 기반 결과 |
| 3   | 채팅 Template 반영 | 채팅에서 글쓰기 관련 질문 | 예시 기반 답변   |
| 4   | 회귀 테스트        | 모든 기존 기능 테스트     | 정상 동작        |

---

## 📊 진행률

```
Phase 3.1: Feature Flag 시스템
  P3-01 [⬜] Feature Flag 상수 파일 생성
  P3-02 [⬜] 기존 API에 Feature Flag 적용

Phase 3.2: RubricAdapter 확장
  P3-03 [⬜] RubricAdapter 인터페이스 개선

Phase 3.3: 평가 기능 연결
  P3-04 [⬜] evaluate-single API에 Template 지원
  P3-05 [⬜] evaluate-holistic API에 Template 지원
  P3-06 [⬜] 평가 결과에 source_citations 포함

Phase 3.4: 채팅 기능 연결
  P3-07 [⬜] 채팅 RAG 검색에 Template 컨텍스트 추가
  P3-08 [⬜] 채팅 응답에 예시 기반 설명 포함

Phase 3.5: 회귀 테스트 및 검증
  P3-09 [⬜] v2/v3 전환 테스트
  P3-10 [⬜] 회귀 테스트 체크리스트

완료: 0/10 (0%)
```

---

## 🚀 다음 단계

Phase 3 완료 후 → Phase 4: 검증 및 마이그레이션 완료

---

## 📚 참조 문서

- [마스터 플랜](./2512290307_Architecture_Refactoring_Master_Plan.md)
- [Phase 0 체크리스트](./2512290313_Phase0_Critical_Fix_Checklist.md)
- [Phase 1 체크리스트](./2512290313_Phase1_RAG_Foundation_Checklist.md)
- [Phase 2 체크리스트](./2512290319_Phase2_Template_Builder_Checklist.md)
