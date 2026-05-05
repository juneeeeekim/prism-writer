# Phase 2: Template Builder 파이프라인 구축 체크리스트 (Example-Driven Induction)

> **생성일**: 2025-12-22  
> **담당**: LLM 아키텍트, 프롬프트 엔지니어  
> **예상 기간**: 2주  
> **선행 조건**: Phase 1 완료 (`rag_rules`에 `category`, `keywords` 컬럼 존재)

---

## ⚠️ 영향받을 수 있는 기존 기능

| 기능        | 파일                                        | 영향도 | 확인 방법           |
| ----------- | ------------------------------------------- | ------ | ------------------- |
| LLM Gateway | `frontend/src/lib/llm/gateway.ts`           | 중     | 모델 호출 정상 동작 |
| 문서 처리   | `frontend/src/lib/rag/documentProcessor.ts` | 중     | 기존 처리 로직 유지 |
| 검색 API    | `frontend/src/lib/rag/search.ts`            | 고     | BM25 검색 추가 확인 |

---

## 📋 Task 2.1: Template 스키마 및 타입 정의

### 🎯 목표

v3 템플릿의 TypeScript 인터페이스 및 JSON 스키마 정의

### 📁 수정 파일

- **[NEW]** `frontend/src/lib/rag/templateTypes.ts`

### ✅ 체크리스트

- [x] **2.1.1** `TemplateSchema` 인터페이스 정의

  ```typescript
  interface TemplateSchema {
    criteria_id: string;
    category: "tone" | "structure" | "expression" | "prohibition"; // 추가
    rationale: string;
    positive_examples: string[];
    negative_examples: string[];
    remediation_steps: string[];
    source_citations: string[];
    confidence_score?: number;
  }
  ```

  - 품질: JSDoc 주석, 각 필드 설명 포함

- [x] **2.1.2** `Template` 엔티티 인터페이스 정의

  - `id`, `tenant_id`, `name`, `version`, `status`, `criteria`, `created_at`
  - `status`: `'draft' | 'pending' | 'approved' | 'rejected'`

- [x] **2.1.3** `TemplateBuilderResult` 인터페이스 정의

  - 빌드 성공/실패 상태, 생성된 템플릿, 에러 메시지

- [x] **2.1.4** Zod 스키마 정의 (런타임 검증용)
  - `templateSchemaValidator`, `templateValidator`
  - 품질: 에러 메시지 한글화

### 🔍 Phase 2.1 검증

- [x] `npm run build` 성공
- [x] `npx tsc --noEmit` 타입 오류 없음

---

## 📋 Task 2.2: BM25 기반 Rule Retrieval & Extraction

### 🎯 목표

BM25로 '톤/구조/표현/금지' 관련 청크를 대량 검색하고, LLM으로 규칙 확정

### 📁 수정 파일

- **[NEW]** `frontend/src/lib/rag/prompts/ruleExtraction.ts`
- **[NEW]** `frontend/src/lib/rag/ruleMiner.ts`

### ⚡ 이전 Task와의 연결

- Task 2.1의 `TemplateSchema` 타입 사용

### ✅ 체크리스트

- [x] **2.2.1** 카테고리별 BM25 쿼리 정의

  - `TONE_KEYWORDS`: "어조", "말투", "문체", "tone", "style"
  - `STRUCTURE_KEYWORDS`: "구조", "구성", "서론", "본론", "결론", "structure"
  - `EXPRESSION_KEYWORDS`: "표현", "단어", "용어", "expression"
  - `PROHIBITION_KEYWORDS`: "금지", "지양", "피해야", "avoid", "don't"

- [x] **2.2.2** `mineRulesByCategory()` 함수 구현

  - 입력: `documentId`, `category`
  - 로직: `fullTextSearch`로 관련 청크 대량 검색 (Top-20)
  - 출력: `Chunk[]`

- [x] **2.2.3** `extractRulesFromChunks()` 함수 구현 (LLM)

  - 입력: 검색된 청크들 + 카테고리
  - 프롬프트: "다음 텍스트에서 [카테고리]와 관련된 규칙만 추출해라"
  - 출력: `Rule[]` (category 필드 포함)

- [x] **2.2.4** 규칙 저장 함수
  - `saveRulesToDatabase(rules: Rule[], documentId: string)`
  - `rag_rules` 테이블에 INSERT (category, keywords 포함)

### 🔍 Phase 2.2 검증

- [x] 단위 테스트: 각 카테고리별로 적절한 규칙이 추출되는지 확인
- [x] 추출된 규칙이 `rag_rules` 테이블에 `category`와 함께 저장 확인

---

## 📋 Task 2.3: Example Mining & Generation (Hybrid)

### 🎯 목표

확정된 Rule에 대해 예시를 찾거나(Mining), 없으면 생성(Generation)

### 📁 수정 파일

- **[NEW]** `frontend/src/lib/rag/prompts/exampleGeneration.ts`
- **[NEW]** `frontend/src/lib/rag/exampleMiner.ts`

### ⚡ 이전 Task와의 연결

- Task 2.2에서 추출한 `Rule` 객체 사용

### ✅ 체크리스트

- [x] **2.3.1** `mineExamplesForRule()` 함수 구현 (Mining)

  - 입력: `Rule`
  - 로직:
    1. Rule 내용을 쿼리로 `hybridSearch` 실행 (chunkType='example' 필터)
    2. `applyExampleBoost`로 리랭킹
    3. 상위 결과의 유사도가 임계값(0.8) 이상이면 채택

- [x] **2.3.2** `generateExamplesForRule()` 함수 구현 (Generation)

  - 입력: `Rule`, `sourceChunks` (문맥용)
  - 프롬프트: "이 규칙(`Rule`)을 잘 지킨 예시(Positive)와 어긴 예시(Negative)를 문서의 스타일(`sourceChunks`)에 맞춰 생성해라"
  - 출력: `positive_examples`, `negative_examples`

- [x] **2.3.3** 통합 Example 처리 로직

  - Mining 시도 → 성공 시 `is_generated: false` 저장
  - 실패 시 Generation 시도 → `is_generated: true` 저장
  - Confidence Score 기록

- [x] **2.3.4** 예시 저장 함수
  - `saveExamplesToDatabase(examples: Example[], ruleId: string)`
  - `rag_examples` 테이블에 INSERT

### 🔍 Phase 2.3 검증

- [x] 단위 테스트: 예시가 있는 경우 Mining, 없는 경우 Generation 동작 확인
- [x] 생성된 예시의 스타일이 원본 문서와 유사한지 확인

---

## 📋 Task 2.4: 3종 검증 게이트 (Gate-Keeper) 구현

### 🎯 목표

템플릿 품질을 보장하는 자동 검증 시스템

### 📁 수정 파일

- **[NEW]** `frontend/src/lib/rag/templateGates.ts`

### ⚡ 이전 Task와의 연결

- Task 2.3에서 생성된 템플릿에 게이트 적용

### ✅ 체크리스트

- [x] **2.4.1** Citation Gate 구현

  - `validateCitationGate(template: TemplateSchema): GateResult`
  - 검증: `source_citations`가 있거나, `is_generated`인 경우 원본 스타일 유사도 검사

- [x] **2.4.2** Consistency Gate 구현

  - `validateConsistencyGate(template: TemplateSchema): GateResult`
  - 검증: `positive_examples`와 `negative_examples`가 논리적으로 대조되는지

- [x] **2.4.3** Hallucination Gate 구현

  - `validateHallucinationGate(template: TemplateSchema, sourceChunks: Chunk[]): GateResult`
  - 검증: 생성된 예시가 원본의 팩트를 왜곡하지 않는지

- [x] **2.4.4** 통합 게이트 함수
  - `validateAllGates(template): AllGatesResult`
  - 3개 게이트 모두 통과해야 `status: 'pending'`

### 🔍 Phase 2.4 검증

- [x] 단위 테스트: 각 게이트 개별 테스트
- [x] 통합 테스트: 전체 게이트 파이프라인 테스트

---

## 📋 Task 2.5: Template Builder 통합

### 🎯 목표

전체 Template Builder 파이프라인 통합

### 📁 수정 파일

- **[NEW]** `frontend/src/lib/rag/templateBuilder.ts`
- **[NEW]** `frontend/src/lib/rag/templateRegistry.ts`

### ⚡ 이전 Task와의 연결

- Task 2.2~2.4의 모든 함수 통합

### ✅ 체크리스트

- [x] **2.5.1** `TemplateBuilder` 클래스 구현

  ```typescript
  class TemplateBuilder {
    async build(documentId: string): Promise<TemplateBuilderResult>;
  }
  ```

  - 파이프라인:
    1. 카테고리별 BM25 Rule Mining
    2. LLM Rule Extraction
    3. Rule별 Example Mining/Generation
    4. Gate-Keeper 검증
    5. 최종 Template JSON 조립 및 저장

- [x] **2.5.2** `TemplateRegistry` 클래스 구현

  - `getTemplate(id: string)`
  - `listTemplates(tenantId: string)`
  - `updateStatus(id: string, status: TemplateStatus)`

- [x] **2.5.3** 백그라운드 워커 API 엔드포인트
  - **[NEW]** `frontend/src/app/api/templates/generate/route.ts` (Renamed from build to avoid gitignore)
  - POST: 문서 ID 받아 비동기 빌드 시작

### 🔍 Phase 2.5 검증

- [x] `npm run build` 성공
- [x] API 테스트: POST `/api/templates/generate` → 빌드 시작
- [x] 빌드된 템플릿이 `rag_templates` 테이블에 저장 확인

---

## ✅ Phase 2 최종 검증

### 자동화 검증

- [x] `npm run build` (frontend) 성공
- [x] `npx vitest run` 전체 테스트 통과
- [x] `npx tsc --noEmit` 타입 오류 없음

### 통합 테스트

- [x] 문서 업로드 → 카테고리별 규칙 추출 → 예시 생성 → 템플릿 완성 전체 흐름
- [x] BM25 검색이 카테고리별로 적절한 청크를 가져오는지 확인
- [x] LLM이 생성한 예시가 원본 스타일을 잘 반영하는지 확인

### 기존 기능 정상 동작 확인

- [x] 기존 문서 검색 정상
- [x] 기존 글 평가 기능 정상 (rubrics.ts 기반)

### 품질 체크

- [x] 코딩 스타일: ESLint 오류 없음
- [x] 함수명/변수명: 의미 명확
- [x] 에러 처리: 각 단계별 try-catch, 에러 메시지 한글화
- [x] 성능: LLM 호출 최적화 (병렬 처리)

---

## 🔗 다음 Phase로 연결

Phase 2 완료 후 **Phase 3: Alignment Judge 및 UI 통합**으로 진행합니다.

Phase 3에서 사용할 Phase 2 산출물:

- `TemplateSchema` 타입
- `TemplateRegistry` 클래스
- `rag_templates` 테이블의 승인된 템플릿
