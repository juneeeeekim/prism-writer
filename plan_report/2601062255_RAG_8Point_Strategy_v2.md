# RAG 시스템 8점 도달 전략 v2.1 (Adaptive System 구현 기반)

> **문서 ID**: 2601062255*RAG_8Point_Strategy_v2
> **작성일**: 2026-01-06 23:05
> **이전 문서**: [2601060804_RAG_8Point_Strategy_Meeting](./2601060804_RAG_8Point_Strategy_Meeting.md) > **참고 문서**: [2601062127_Adaptive_Threshold_System*체크리스트](./2601062127*Adaptive_Threshold_System*체크리스트.md)
> **목적**: 구현된 Adaptive Threshold System의 구체적 메커니즘을 기반으로 한 8점 도달 및 9점 도약 전략

---

## 📅 현황 업데이트 (Status Update)

**기존 문제**: 정량적 데이터 부족으로 인한 막연한 튜닝 (RAG 점수 6.8점)
**해결 완료**: **Adaptive Threshold System (Phase 1-6)** 배포 완료. 이제 "추측"이 아닌 "데이터"로 움직입니다.

### ✅ 확보된 핵심 자산 (Implemented Assets)

1.  **Project Context (테이블 `project_rag_preferences`)**:
    - 각 프로젝트별로 `groundedness_threshold` (기본 0.7)가 독립적으로 최적화됩니다.
    - 범위 제한 (0.4 ~ 0.95) 내에서 안전하게 학습합니다.
2.  **Explicit Signal (테이블 `learning_events`)**:
    - `chat_helpful` (+), `chat_not_helpful` (-), `chat_hallucination` (--) 등 7가지 `SIGNAL_CONFIG`가 정의되었습니다.
    - 단순 점수 조정뿐만 아니라, `event_data` JSONB 컬럼에 문맥 데이터(messageId 등)가 저장됩니다.
3.  **Feedback Loop**:
    - 채팅창 하단 버튼(👍/👎/🚨)이 사용자 경험을 방해하지 않으면서 데이터를 수집합니다.

---

## 1. 전략의 구체화: "Automated Data-Flywheel"

우리는 이제 사용자가 서비스를 이용할수록 시스템이 똑똑해지는 **Flywheel** 구조를 갖추었습니다. v2 전략은 이 구조를 가속화하는 데 집중합니다.

### 🔄 Data-Flywheel 로드맵

| 단계       | 전략명           | 기존 계획 (v1)   | **구현 기반 수정 계획 (v2.1)**                                                                                                                                 |
| :--------- | :--------------- | :--------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Step 1** | **Ground Truth** | 수동 구축 (50개) | **`learning_events` 기반 자동 채굴** <br> - `chat_helpful` 시: Query-Chunk 쌍을 Positive Pair로 저장 <br> - `chat_hallucination` 시: Hard Negative Pair로 저장 |
| **Step 2** | **Threshold**    | 고정값 튜닝      | **`SIGNAL_CONFIG` 가중치 최적화** <br> - 현재 `eval_override` 가중치(0.8)가 적절한지 A/B 테스트 <br> - `influence_weight` 분석을 통한 파라미터 미세 조정       |
| **Step 3** | **Re-ranking**   | 외부 API 의존    | **Learning-to-Rank (LTR) 데이터셋 구축** <br> - 수집된 Positive/Negative 쌍으로 내부 Re-ranker 경량화 학습                                                     |

---

## 2. 세부 실행 전략 (Actionable Items based on Schema)

### 🎯 Strategy 1: `learning_events`를 활용한 Golden Set 추출

**Mechanism**:
`learning_events` 테이블의 `event_type`과 `event_data`를 조인하여 고품질 평가셋을 만듭니다.

```sql
-- "도움됨(chat_helpful)" 피드백을 받은 질의-응답-문서 쌍 추출 쿼리 예시
SELECT
    le.created_at,
    le.project_id,
    cm.content as query,     -- chat_messages (needs join)
    cm.response as answer,
    doc.content as chunk     -- used_docs (needs join)
FROM learning_events le
JOIN chat_messages cm ON (le.event_data->>'messageId')::uuid = cm.id
WHERE le.event_type = 'chat_helpful'
AND le.influence_weight > 0.2; -- 신뢰도 높은 이벤트만 추출
```

**Goal**: 주간 단위로 Golden Set 100개씩 자동 확보 → 내부 회귀 테스트(Regression Test)에 사용.

### 🎯 Strategy 2: 프로젝트 카테고리별 초기 임계값 차별화 (Cold Start 해결)

**Mechanism**:
현재는 모든 프로젝트가 0.7에서 시작하지만, `project_rag_preferences`에 쌓인 데이터로 "카테고리별 최적 시작점"을 찾습니다.

- **법률/규정**: 0.85에서 수렴하는 경향 → 초기값 0.8로 상향
- **창작/소설**: 0.55에서 수렴하는 경향 → 초기값 0.6으로 하향

**Action**: `projects` 테이블에 `category` 컬럼 추가 고려 및 초기화 트리거(`create_project_rag_preferences`) 로직 고도화.

### 🎯 Strategy 3: "Hallucination(🚨)" 시그널의 즉각적 활용 (Real-time Healing)

**Mechanism**:
`chat_hallucination` 이벤트 발생 시 `applied_adjustment` (+0.05)가 즉시 반영되어 임계값이 올라갑니다.

**New UX Proposal**:
사용자가 🚨 버튼을 누르면:

1.  시스템은 즉시 높아진 임계값(예: 0.7 → 0.75)을 인식.
2.  **"더 엄격한 기준으로 다시 찾아볼까요?"** 제안.
3.  승인 시, 직전 쿼리를 재실행하되 RAG 검색 범위를 좁히거나(Top-K 축소) 필터를 강화하여 답변 재생성.

---

## 3. 기술적 고도화 과제 (Next Tech Steps)

### 🚀 Analytics Dashboard

단순 로그 적재를 넘어 운영진이 인사이트를 얻을 수 있는 SQL View 생성.

```sql
CREATE VIEW view_daily_rag_health AS
SELECT
  date_trunc('day', created_at) as day,
  project_id,
  count(*) filter (where event_type = 'chat_helpful') as positive_count,
  count(*) filter (where event_type = 'chat_hallucination') as hallucination_count,
  avg(applied_adjustment) as avg_adjustment
FROM learning_events
GROUP BY 1, 2;
```

### �️ Abuse Prevention

악의적인 피드백(무한 클릭 등)으로 임계값이 0.95(Max)나 0.4(Min)로 쏠리는 것을 방지.

- **Rate Limiting**: 동일 유저/프로젝트의 피드백은 1분당 5회로 제한.
- **Decay Factor**: 오래된 피드백의 영향력을 서서히 감소시키는 Time-Decay 로직 도입 검토.

---

## 4. 우선순위 재조정 (Revised Priority)

| 순위 | 작업                                    | 담당            | 기한 | KPI                       |
| :--- | :-------------------------------------- | :-------------- | :--- | :------------------------ |
| 🥇 1 | **자동화된 Golden Set 추출 파이프라인** | 데이터 엔지니어 | 1주  | 주간 100개 평가셋 확보    |
| 🥈 2 | **Real-time Healing UX (재생성 제안)**  | FE/Back         | 1주  | 🚨 이탈률 30% 감소        |
| 🥉 3 | **카테고리별 Cold Start 최적화**        | ML 엔지니어     | 2주  | 신규 프로젝트 안착률 상승 |

---

## 5. 결론

"2601062127 checklist"의 구현은 끝이 아니라 시작입니다.
우리는 이제 **정적인 룰(Rule-based)** 시스템에서 **사용자와 상호작용하며 진화하는(Data-driven)** 시스템으로 완전히 전환했습니다.
v2.1 전략은 이 **"진화하는 엔진"**에 양질의 연료(데이터)를 공급하고, 그 출력을 정밀하게 제어하는 데 모든 초점을 맞춥니다.

**승인자**: Tech Lead (2026-01-06)
