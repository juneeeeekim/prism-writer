# 파이프라인 재정의 (v3) - "Example-Driven Template Induction"

본 문서는 기존의 단순 RAG 시스템을 넘어, 지식베이스에서 평가 기준과 예시를 자동으로 추출·생성하여 사용자 글을 정밀하게 교정하는 **v3 파이프라인**의 설계 및 구현 전략을 담고 있습니다.

---

## 🧑‍💼 시니어 개발자 : 아키텍처 총괄 (Phase 분리 및 비동기화)

### [v3 업그레이드 핵심]

- **비동기 템플릿 빌더**: 문서 업로드 시 즉시 평가 기준을 만드는 것이 아니라, 백그라운드 워커(Phase A)가 정밀하게 템플릿을 빌드하고 검증합니다.
- **템플릿 레지스트리**: 생성된 템플릿을 버전별로 관리하여, 강사나 관리자가 최적의 템플릿을 선택/승인할 수 있는 구조를 도입합니다.

---

## 🔎 IR/검색 엔지니어 : "Semantic & Multi-Index Search"

### [v3 업그레이드 아이디어]

- **Semantic Chunking**: 고정 크기 분할이 아닌, 의미 단위(문단, 규칙 설명)로 청킹하여 규칙과 예시의 맥락을 완벽히 보존합니다.
- **Metadata-Driven Retrieval**:
  - `type: rule` (원칙/규칙) 인덱스와 `type: example` (사례) 인덱스를 메타데이터 레벨에서 분리하여 검색 정확도를 높입니다.
- **Example-Specific Re-ranking**: 사례 채굴 시 "따옴표", "대화체", "구체적 수치" 등이 포함된 청크에 가중치를 주는 전용 리랭커를 적용합니다.

---

## 🧠 LLM/RAG 아키텍트 : "Reasoning-Based Induction"

### [v3 업그레이드 아이디어]

- **모델 이원화 전략**:
  - **Template Induction (Phase A)**: Gemini 3 Pro / Claude 3.5 Opus 등 고성능 추론 모델을 사용하여 복잡한 규칙에서 정교한 예시를 합성합니다.
  - **Alignment Judge (Phase B)**: Gemini 3 Flash / GPT-4o-mini 등 경량 모델을 사용하여 실시간 피드백 속도를 확보합니다.
- **Self-Correction Loop**: LLM이 생성한 예시가 원본 규칙과 모순되는지 스스로 검토하는 '자기 비판(Self-Critic)' 단계를 추가합니다.

---

## 🧩 프롬프트/컨텍스트 엔지니어 : "JSON Contract & Few-shot Synthesis"

### [v3 업그레이드 아이디어]

- **Standardized Template Schema**:
  ```json
  {
    "criteria_id": "string",
    "rationale": "왜 이 규칙이 중요한가",
    "positive_examples": ["좋은 사례 1", "2"],
    "negative_examples": ["나쁜 사례 1", "2"],
    "remediation_steps": ["어떻게 고쳐야 하는가"],
    "source_citations": ["원문 인용구 1"]
  }
  ```
- **Few-shot Example Synthesis**: 강의 원문의 문체와 톤을 학습할 수 있도록, 원문에서 추출한 실제 사례를 Few-shot으로 넣어 생성 예시의 이질감을 최소화합니다.

---

## 🧪 QA & Eval 전문가 : "Gate-Keeper & HITL"

### [v3 업그레이드 아이디어]

- **Gate-Keeper 시스템**: 템플릿이 서비스에 반영되기 전 3단계 자동 검증을 통과해야 합니다.
  1. **Citation Gate**: 모든 기준에 근거 원문이 있는가?
  2. **Consistency Gate**: 좋은 예시와 나쁜 예시가 논리적으로 대조되는가?
  3. **Hallucination Gate**: 원문에 없는 내용을 지어내지 않았는가?
- **Human-in-the-loop (HITL)**: 관리자 페이지에서 생성된 템플릿을 '승인/수정/반려'할 수 있는 UI를 제공합니다.

---

## 🧱 데이터 엔지니어 : "Relational Template Storage"

### [v3 업그레이드 아이디어]

- **스키마 고도화**:
  - `rag_rules`: 원문에서 추출된 원자적 규칙 저장
  - `rag_examples`: 원문 추출 사례 + LLM 생성 사례 저장
  - `rag_templates`: 규칙과 사례가 결합된 최종 평가 세트
- **Lineage Tracking**: 특정 평가 결과가 어떤 원문 청크(source_chunk_id)에서 기인했는지 추적 가능하도록 관계를 설정합니다.

---

## 🧑‍🎨 UX/프론트 : "3-Pane Comparison & Transformation UI"

### [v3 업그레이드 아이디어]

- **3단 비교 뷰**: [내 글] - [나쁜 예시] - [좋은 예시]를 한눈에 비교하여 사용자가 즉각적으로 개선 방향을 이해하게 합니다.
- **Interactive Transformation**: "나쁜 예시"를 "좋은 예시"로 바꾸는 과정을 애니메이션이나 단계별 가이드로 보여주어 학습 효과를 극대화합니다.

---

## ⚖️ Final Cross-Check & Feasibility Review (최종 검토)

### 1. 예시 채굴의 한계와 대안 (Feasibility Check)

- **Issue**: 강의 텍스트가 너무 건조하거나(이론 위주), 예시가 전혀 없는 경우 LLM이 억지로 예시를 만들다가 환각(Hallucination)을 일으킬 수 있음.
- **Solution**:
  - **Confidence Score 도입**: 채굴된 예시의 신뢰도가 낮으면 자동으로 **"Generation Mode"**로 전환하되, 프롬프트에 `Strict Constraints`(원문의 용어만 사용 등)를 강제함.
  - **Fallback Template**: 예시 생성이 실패할 경우, "예시 없음"을 명시하고 일반적인 작문 원칙(간결성, 명확성 등)을 적용하는 기본 템플릿으로 자동 회귀.

### 2. 비용 효율성 검토 (Cost Analysis)

- **Issue**: 모든 문서에 대해 Gemini 3 Pro급 모델로 템플릿을 생성하면 비용이 과다할 수 있음.
- **Solution**:
  - **Tiered Processing**: 'Premium' 사용자나 '주요 강의'에만 고성능 모델을 사용하고, 일반 문서는 Flash 모델로 초안을 생성한 뒤 사용자 요청 시 업그레이드(On-Demand) 하는 방식 도입.
  - **Template Caching**: 동일한 주제/카테고리의 문서는 템플릿을 공유하거나 캐싱하여 중복 생성을 방지.

### 3. 모바일 UX 복잡도 (Mobile Usability)

- **Issue**: 3단 비교 뷰([내 글]-[나쁜 예]-[좋은 예])는 모바일 화면에서 가독성이 매우 떨어짐.
- **Solution**:
  - **Tabbed View**: 모바일에서는 탭(Tab)으로 전환하거나, [내 글] vs [좋은 예] 2단 비교를 기본으로 하고 [나쁜 예]는 토글로 숨김 처리.
  - **Focus Mode**: 전체 글 비교가 아닌, '문장 단위'로 포커싱하여 하나씩 넘겨가며 교정하는 카드 UI 제공.

---

## �️ Developer Meeting: Voting Results (개발자 회의 투표 결과)

| 안건                        | 찬성 | 반대 | 결과             |
| --------------------------- | ---- | ---- | ---------------- |
| 🔐 보안/개인정보 섹션 추가  | 7    | 0    | ✅ 만장일치 채택 |
| 📈 Telemetry/운영 섹션 추가 | 7    | 0    | ✅ 만장일치 채택 |
| 🧹 기술 부채 전략 섹션 추가 | 6    | 1    | ✅ 다수결 채택   |

---

## 🔐 보안/개인정보 : "Namespace Isolation & Data Governance"

### [아이디어 제출 및 합의]

| 제안자          | 아이디어                                                | 투표           |
| --------------- | ------------------------------------------------------- | -------------- |
| 시니어 개발자   | 강사/코스별 원문 Namespace 격리 (tenant_id 기반 RLS)    | 👍👍👍👍👍👍👍 |
| 보안 엔지니어   | 템플릿은 2계층: Tenant 전용 + 일반화된 공용 템플릿 분리 | 👍👍👍👍👍👍   |
| 데이터 엔지니어 | 원문 인용은 요약/해시 처리하여 직접 노출 방지           | 👍👍👍👍       |

### [채택된 정책]

1. **Tenant Namespace**: 모든 `rag_documents`, `rag_rules`, `rag_examples`는 `tenant_id` 컬럼으로 격리되며, RLS(Row Level Security) 정책이 적용됩니다.
2. **템플릿 2계층 구조**:
   - **Private Template**: 특정 강사의 콘텐츠에서만 유효한 기준 (원문 인용 포함)
   - **Public Template**: 일반화된 글쓰기 원칙만 포함, 원문 미포함
3. **Citation Hashing**: 원문이 직접 노출되지 않도록 인용문을 해시 또는 요약 처리하여 저장

---

## 📈 Telemetry/운영 : "Template Lifecycle Metrics"

### [아이디어 제출 및 합의]

| 제안자          | 아이디어                                           | 투표           |
| --------------- | -------------------------------------------------- | -------------- |
| MLOps 엔지니어  | 템플릿 생성 성공률 / 실패 사유 추적                | 👍👍👍👍👍👍👍 |
| Eval 전문가     | 사용자가 "도움이 됐어요/별로예요" 피드백 버튼 추가 | 👍👍👍👍👍👍   |
| 데이터 엔지니어 | 템플릿별 적용 횟수 및 평균 수정 시간 추적          | 👍👍👍👍👍     |
| UX 개발자       | A/B 테스트용 템플릿 버전 비교 지표                 | 👍👍👍👍       |

### [채택된 지표]

1. **Template Build Metrics**:
   - `template_build_success_rate`: 생성 성공률 (%)
   - `template_build_failure_reason`: 실패 원인 분류 (Hallucination, Timeout 등)
   - `avg_template_build_time_ms`: 평균 생성 시간
2. **User Feedback Metrics**:
   - `template_helpful_rate`: "도움이 됐어요" 비율
   - `template_applied_count`: 특정 템플릿이 사용자 글에 적용된 횟수
3. **A/B Testing**:
   - `template_version_comparison`: 버전별 사용자 반응 비교

---

## 🧹 기술 부채 : "Rubrics Migration Strategy"

### [아이디어 제출 및 합의]

| 제안자        | 아이디어                                                             | 투표         |
| ------------- | -------------------------------------------------------------------- | ------------ |
| 시니어 개발자 | 기존 `rubrics.ts`를 유지하되, v3 템플릿과 Adapter 패턴으로 연결      | 👍👍👍👍👍   |
| LLM 아키텍트  | v3 템플릿이 안정화되면 `rubrics.ts`를 Deprecated 처리 후 단계적 제거 | 👍👍👍👍     |
| QA 리드       | 마이그레이션 중 두 시스템 결과를 Shadow Mode로 비교 검증             | 👍👍👍👍👍👍 |
| 프론트 개발자 | UI에서는 어떤 시스템(v2/v3)을 사용하는지 Flag로 전환 가능하게        | 👍👍👍       |

### [채택된 전략]

1. **Phase 1 (공존)**: `rubrics.ts`와 v3 템플릿 시스템이 공존. `RubricAdapter`를 통해 v3 템플릿을 기존 `Rubric` 인터페이스로 변환하여 기존 코드 호환.
2. **Phase 2 (Shadow Mode)**: 동일한 입력에 대해 v2 Rubric과 v3 Template 결과를 병렬 실행하고 로깅하여 품질 비교.
3. **Phase 3 (Deprecation)**: v3 품질 검증 완료 시 `rubrics.ts`를 Deprecated 처리, UI에서 v3 전용 모드로 전환.
4. **Phase 4 (Removal)**: 일정 기간(예: 3개월) 후 `rubrics.ts` 완전 제거.

---

## �🚀 구현 로드맵 (Implementation Roadmap)

### 1단계: 데이터 인프라 및 검색 고도화 (Phase A 기반)

- Semantic Chunking 도입 및 메타데이터 필터링 구현
- BM25 가중치 튜닝 (Example Mining 최적화)

### 2단계: Template Builder 파이프라인 구축

- Reasoning 모델 기반의 Rule 추출 및 Example Synthesis 프롬프트 개발
- 3종 검증 게이트(Gate-Keeper) 구현

### 3단계: Alignment Judge 및 UI 통합 (Phase B 기반)

- 템플릿 기반의 실시간 평가 엔진 개발
- 3단 비교 뷰 및 업그레이드 플랜 UI 구현

### 4단계: 보안, 운영, 기술 부채 통합 (추가)

- Namespace Isolation 및 RLS 정책 적용
- Telemetry 지표 수집 및 대시보드 구축
- `rubrics.ts` → v3 Template 마이그레이션

---

## ✅ 최종 결론

v3 파이프라인은 단순한 정보 전달을 넘어 **"사용자의 글을 전문가의 시각으로 교정해주는 지능형 튜터"**로의 진화를 의미합니다. 이는 특히 교육용 글쓰기 서비스에서 독보적인 경쟁력을 제공할 것입니다.
