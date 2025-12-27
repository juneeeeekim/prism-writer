# RAG Alignment Evaluator & Upgrade Coach — PrismLM 맞춤형 설계 문서

> **최종 수정**: 2025-12-27 18:31  
> **검토자**: 시니어 개발자, 주니어 개발자, UX/UI 전문가, JeDebug  
> **기반 문서**: `2512271820_rag_alignment_upgrade_coach_vfinal.md`

---

## 📌 문서 목적

이 문서는 원본 설계를 **PrismLM 현재 아키텍처에 맞게 조정**한 버전입니다.  
이미 구현된 기능을 명시하고, 단계별 적용 우선순위를 재조정했습니다.

---

## 0) 서비스 정의

- **[팩트]** 외부 지식베이스(RAG DB)에 글이 **부합(Alignment)** 하게 작성됐는지 평가하고, **업그레이드(개선) 조언**을 제공하는 웹서비스.
- **[내 생각]** 제품 정체성은 **Cursor식 경험(승인형 적용 + Patch-only + Shadow Workspace)**.
- **[현재 상태]** ✅ 핵심 정체성 구현 완료 (Shadow Workspace, Patch 시스템)

---

## 1) 제품 원칙 (절대 규칙)

| 원칙              | 설명                                    | 현재 상태           |
| ----------------- | --------------------------------------- | ------------------- |
| Human-in-the-loop | AI는 "제안"만, 적용은 **사용자 승인**   | ✅ 구현됨           |
| Patch-only        | 기본 출력은 "완성문"이 아니라 **Patch** | ✅ 구현됨           |
| 근거 기반 판단    | 근거가 없으면 **근거 부족**으로 종료    | ⚠️ 부분 구현        |
| 계약 기반 신뢰    | 스키마 + 게이트 + 회귀테스트            | ⚠️ 게이트 강화 필요 |

---

## 2) 핵심 데이터 자산 (1급 엔티티)

### 현재 구현된 엔티티

| 엔티티          | 테이블명                     | 상태                |
| --------------- | ---------------------------- | ------------------- |
| documents       | `user_documents`             | ✅ 구현됨           |
| document_chunks | `document_chunks` (pgvector) | ✅ 구현됨           |
| raft_dataset    | `raft_dataset`               | ✅ 구현됨 (Phase 4) |
| feedback        | `hallucination_feedback`     | ✅ 구현됨           |

### 추가 필요 엔티티 (Phase 6)

| 엔티티           | 설명                    | 우선순위 |
| ---------------- | ----------------------- | -------- |
| `rules`          | 규칙/원칙/정의          | P2       |
| `examples`       | do/don't 예시           | P2       |
| `templates`      | 판정 템플릿             | P3       |
| `criteria_pack`  | 평가 시 로딩되는 기준팩 | P2       |
| `change_plan`    | patch 계획              | P3       |
| `hard_negatives` | 튜닝/회귀용 오답 근거   | P3       |

---

## 3) 전체 파이프라인 (Phase A/B)

### Phase A: Template Builder (⚠️ 미구현 - Phase 6 로드맵)

> **참고**: Phase A는 현재 미구현 상태이며, Phase 6으로 별도 프로젝트화 권장

| 단계                    | 설명                           | 예상 작업량 | 우선순위 |
| ----------------------- | ------------------------------ | ----------- | -------- |
| A-1. Ingest             | 문서 인입/정제                 | 1주         | P3       |
| A-2. LLM 구조화         | 요약/핵심정리                  | 2주         | P3       |
| A-3. 검색 인프라        | ~~BM25~~ → **하이브리드 검색** | 2주         | P2       |
| A-4. Example Mining     | 예시 채굴                      | 1주         | P3       |
| A-5. Example Synthesis  | 예시 생성                      | 1주         | P3       |
| A-6. Template Induction | 판정 템플릿 생성               | 2주         | P3       |
| A-7. Template Gate      | 승격 조건 검증                 | 1주         | P2       |
| A-8. Tagging            | 메타데이터 자동 태깅           | 1주         | P3       |

#### 🔧 수정 사항: BM25 → 하이브리드 검색

**원본 권장**: BM25 기반  
**PrismLM 맞춤**: **pgvector + 키워드 하이브리드**

```
현재: pgvector (임베딩 기반)
목표: pgvector + ts_vector (하이브리드)
이유: 기존 인프라 활용, 점진적 전환
```

---

### Phase B: Alignment Judge & Upgrade Coach (✅ 대부분 구현됨)

| 단계                  | 설명                   | 현재 상태                |
| --------------------- | ---------------------- | ------------------------ |
| B-1. Criteria Pack    | 표준 근거팩 구성       | ⚠️ 스키마 설계 필요      |
| B-2. Retrieval        | 근거 회수              | ✅ 구현됨 (pgvector)     |
| B-3. Alignment Judge  | 부합도 평가            | ✅ 구현됨                |
| B-4. Upgrade Planner  | 개선 플랜              | ✅ 구현됨 (Patch 시스템) |
| B-5. Shadow Workspace | 미리보기/승인형        | ✅ 구현됨                |
| B-6. Output Modes     | Coach/Strict/Checklist | ❌ 미구현 (P1 권장)      |

---

## 4) 게이트 시스템 (필수 품질/안전)

| 게이트                    | 설명                          | 현재 상태 | 우선순위 |
| ------------------------- | ----------------------------- | --------- | -------- |
| **Citation Gate**         | 인용이 원문에 실제 존재하는지 | ❌ 미구현 | 🔴 P1    |
| **Consistency Gate**      | 회귀/변동 폭 통제 (골드셋)    | ⚠️ 부분   | P2       |
| **Diff Safety Gate**      | 과도 변경/의미 훼손 경고      | ❌ 미구현 | P2       |
| **Retrieval Gate**        | 근거 부족률 임계치            | ⚠️ 부분   | P1       |
| **Evidence Quality Gate** | 근거 강도 낮으면 표시         | ❌ 미구현 | P1       |

---

## 5) 운영/관측/비용

### 현재 구현된 관측 항목

- ✅ `run_id` (telemetry 로그)
- ✅ LLM 비용 추적 (`llm_usage` 테이블)
- ✅ 응답 지연 측정

### 추가 필요 지표

| 지표          | 설명                   | 우선순위 |
| ------------- | ---------------------- | -------- |
| 근거 부족률   | Retrieval 실패율       | P1       |
| 인용 실패율   | Citation Gate 실패율   | P1       |
| 적용률        | Patch 승인 비율        | P2       |
| 재평가 개선량 | Before/After 점수 차이 | P3       |

---

## 6) Hard Negatives 자산화 (RAFT 연계)

> **연결**: Phase 4-5 (RAFT 파인튜닝 준비)와 통합

| 항목                | 현재 상태           |
| ------------------- | ------------------- |
| raft_dataset 테이블 | ✅ 구현됨           |
| 합성 데이터 생성    | ✅ 구현됨           |
| Gemini JSONL 추출   | ✅ 구현됨 (Phase 5) |
| Hard Negatives 수집 | ❌ 미구현 (P2)      |

---

## 7) Feature Flags (PrismLM 맞춤: 16개)

### 현재 구현된 플래그

| 플래그                           | 설명                   | 상태      | 기본값 |
| -------------------------------- | ---------------------- | --------- | ------ |
| `ENABLE_PIPELINE_V5`             | Shadow Workspace       | ✅ 구현됨 | true   |
| `ENABLE_PATCH_SUGGESTIONS`       | Patch 제안             | ✅ 구현됨 | true   |
| `ENABLE_RAFT_FEATURES`           | RAFT 기능 전체         | ✅ 구현됨 | false  |
| `ENABLE_IMPROVED_PROMPT`         | 개선된 시스템 프롬프트 | ✅ 구현됨 | true   |
| `ENABLE_HALLUCINATION_DETECTION` | 환각 탐지              | ✅ 구현됨 | false  |

### 신규 추가 필요 플래그 (원본 문서 기반)

| 플래그                      | 설명                      | 우선순위 |
| --------------------------- | ------------------------- | -------- |
| `FF_CRITERIA_PACK_STANDARD` | Criteria Pack 표준화      | P0       |
| `FF_PATCH_STAGING`          | 단계형 패치 (1차→2차→3차) | P1       |
| `FF_EVIDENCE_QUALITY`       | 근거 강도 표시            | P1       |
| `FF_PIN_EVIDENCE`           | 컨텍스트 고정             | P1       |
| `FF_OUTPUT_MODES`           | Coach/Strict/Checklist    | P2       |
| `FF_CONFLICT_RESOLVER`      | 기준 충돌 해결            | P2       |
| `FF_BEFORE_AFTER_LOOP`      | 전/후 개선 루프           | P2       |
| `FF_HARD_NEGATIVES`         | 하드 네거티브 활용        | P2       |
| `FF_GOAL_CONTEXT`           | 목표/글유형 입력          | P2       |
| `FF_HIER_TEMPLATE`          | 계층형 템플릿             | P3       |
| `FF_USER_TEMPLATES`         | 사용자/팀 템플릿          | P3       |

---

## 8) 단계별 릴리즈 플랜 (PrismLM 맞춤)

### ✅ P0 (뼈대) - 이미 완료

| 항목                    | 상태    |
| ----------------------- | ------- |
| Phase B 기본 파이프라인 | ✅ 완료 |
| Shadow Workspace        | ✅ 완료 |
| Patch-only 시스템       | ✅ 완료 |
| RAFT 데이터셋 관리      | ✅ 완료 |
| Gemini 파인튜닝 준비    | ✅ 완료 |

### 🔄 P1 (다음 Sprint) - 즉시 적용 권장

- [ ] **Citation Gate 구현**: 인용 원문 검증
- [ ] **`FF_PATCH_STAGING`**: 단계형 패치 (Top 3 → 표현/톤 → 디테일)
- [ ] **`FF_EVIDENCE_QUALITY`**: 근거 강도 표시 (display_only)
- [ ] **Criteria Pack 스키마 설계**

### 📅 P2 (2주 후) - 품질 강화

- [ ] **`FF_OUTPUT_MODES`**: Coach/Strict/Checklist 모드
- [ ] **`FF_CONFLICT_RESOLVER`**: 기준 충돌 설명
- [ ] **`FF_HARD_NEGATIVES`**: RAFT와 연계
- [ ] **하이브리드 검색**: pgvector + ts_vector

### 🗓️ P3 (Phase 6) - 장기 로드맵

- [ ] **Phase A 전체 구현**: Template Builder
- [ ] **`FF_HIER_TEMPLATE`**: 계층형 템플릿
- [ ] **`FF_USER_TEMPLATES`**: 사용자 커스텀 템플릿
- [ ] **Template Drift 감지**: 재검증 워크플로

---

## 9) 최종 결론

### 원본 문서 대비 변경 사항

| 항목          | 원본          | PrismLM 맞춤                   |
| ------------- | ------------- | ------------------------------ |
| 검색 기반     | BM25          | 하이브리드 (pgvector + 키워드) |
| Phase A       | 필수          | Phase 6으로 분리 (선택)        |
| Phase B       | 구현 필요     | ✅ 대부분 완료                 |
| Feature Flags | 13개          | 16개 (기존 5개 + 신규 11개)    |
| Gate 시스템   | 5개 전체 구현 | P1에서 2개 우선 구현           |

### 전문가 회의 결론

> **만장일치**: 부분 적용 + 단계적 확장
>
> - ✅ P0 (뼈대): 이미 완료
> - 🔄 P1: Citation Gate + 단계형 패치
> - 📅 P2: Output Modes + Hard Negatives
> - 🗓️ P3: Template Builder (Phase 6)

### 다음 단계

1. **디렉터님 승인** 대기
2. 승인 시 P1 체크리스트 작성
3. Sprint 계획에 반영

---

> **문서 버전**: v2.0 (PrismLM 맞춤형)  
> **작성자**: 시니어 개발자  
> **검토**: 주니어 개발자, UX/UI 전문가, JeDebug
