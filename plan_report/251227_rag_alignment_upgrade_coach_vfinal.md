# RAG Alignment Evaluator & Upgrade Coach — 완전판 설계 문서(vFinal)

## 0) 서비스 정의
- **[팩트]** 외부 지식베이스(RAG DB: 강의/문서/규칙/방법론)에 글이 **부합(Alignment)** 하게 작성됐는지 평가하고, 부족한 부분을 **업그레이드(개선) 조언**으로 제공하는 웹서비스.
- **[내 생각]** 제품 정체성은 **Cursor식 경험(승인형 적용 + Patch-only + Shadow Workspace)** 입니다.

---

## 1) 제품 원칙(절대 규칙)
- **[팩트]** AI는 “제안”만, 적용은 **사용자 승인**(Human-in-the-loop)
- **[팩트]** 기본 출력은 “완성문”이 아니라 **Patch**(Insert/Replace/Move/Delete)
- **[팩트]** 근거가 없으면 판단하지 않고 **근거 부족**으로 종료
- **[내 생각]** 신뢰는 “말”이 아니라 **계약(스키마) + 게이트 + 회귀테스트**로 만든다

---

## 2) 핵심 데이터 자산(1급 엔티티)
- `documents` (원문/권한/버전)
- `rules` (규칙/원칙/정의)
- `examples` (do/don’t 예시, 출처 연결)
- `templates` (criteria_id 단위 판정 템플릿, 버전)
- `criteria_pack` (평가 시 로딩되는 기준+예시+근거팩)
- `change_plan` (patch 목록 + 이유 + 근거 + 예상효과)
- **Hard Negatives** (헷갈리지만 틀린 근거: 튜닝/회귀용)

---

## 3) 전체 파이프라인(Phase A/B)

## Phase A) Template Builder (기준/예시/템플릿 생성)
### A-1. Ingest(문서 인입/정제)
- 업로드 → 정제/중복 제거/버전 관리
- ACL/Namespace(강사/테넌트/사용자) 지정

### A-2. LLM 요약/핵심정리(내부 구조화)
- **[팩트]** 사용자 노출용이 아니라, 검색/템플릿 생성을 위한 내부 산출물
- 산출물:
  - `doc_summary`, `key_points`, `rules_candidates`, `terminology`, `structure_map`

### A-3. BM25 기반 검색 인프라(검색이 “잘 되게”)
- 인덱스 분리:
  - **Rule Index**(규칙/원칙/정의)
  - **Example Index**(예시/사례/샘플)
- 예시 신호(따옴표/예를 들어/before-after)를 반영한 BM25 필드 가중치 적용

### A-4. Example Mining(예시 채굴)
- LLM이 BM25 결과를 분석해 “좋은/나쁜 예시”를 강의에서 추출

### A-5. Example Synthesis(없으면 생성)
- **[팩트]** 강의 규칙(근거)을 인용하여 예시 생성
- **[내 생각]** 규칙 인용이 없는 예시는 채택 금지(환각 방지)

### A-6. Template Induction(판정 템플릿 생성)
- `criteria_id`별:
  - rule(정의), pass_conditions, fail_patterns
  - do_example, dont_example
  - common_pitfalls, notes

### A-7. Template Builder Gate(승격 조건)
- **Rule Citation Gate**: 규칙 인용 존재
- **Example Consistency Gate**: 예시-규칙 모순 없음
- **Template Regression Gate**: 샘플셋에서 결과 튐 방지  
→ 통과한 템플릿만 Production 승격(버전 증가)

### A-8. Tagging(메타데이터 자동 태깅) ✅
- Category(논리/문법/표현/톤/형식 등), Difficulty(상/중/하)
- 검수 루프(자동→표본검수→수정) 포함

---

## Phase B) Alignment Judge & Upgrade Coach (평가/개선)
### B-1. Criteria Pack 구성(표준 근거팩) ✅
- **[팩트]** Judge 입력을 안정화하기 위해 “팩 규격”을 고정
- 포함:
  - criteria_definition(규칙/원칙)
  - do/don’t examples
  - common pitfalls
  - retrieved_chunks(근거 청크: chunk_id/섹션/버전/권한)
  - evidence_strength(근거 강도)

### B-2. Retrieval(근거 회수)
- 기본: BM25
- 필요 시: 하이브리드/리랭커(Top-K 제한)
- 사용자가 후보를 **Pin/Unpin**하여 컨텍스트를 확정할 수 있음 ✅

### B-3. Alignment Judge(부합도 평가)
- 출력: 점수 1개가 아니라 **부합도 프로필(Fit/Gap)** + 근거 인용
- 근거 부족 시 “근거 부족 + 필요한 자료 안내”

### B-4. Upgrade Planner(개선 플랜)
- Patch-only 기본
- 단계형 개선(1차 핵심 3개 → 2차 표현/톤 → 3차 디테일)

### B-5. Shadow Workspace(미리보기/승인형 적용)
- 적용 전/후 시뮬레이션
- Tab처럼 Apply/Undo

### B-6. Output Modes(모드 프롬프트) ✅
- Coach(코칭형), Strict(엄격 판정형), Checklist(체크리스트형) 등
- 동일 파이프라인 + 출력 포맷만 교체(모듈화)

---

## 4) 게이트(필수 품질/안전)
- **Citation Gate:** 인용이 원문에 실제 존재하는지
- **Consistency Gate:** 회귀/변동 폭 통제(골드셋)
- **Diff Safety Gate:** 과도 변경/의미 훼손 위험 경고·차단
- **Retrieval Gate:** 근거 부족률 임계치 초과 시 판정 보류
- **Evidence Quality Gate(옵션):** 근거 강도가 낮으면 “표시”→(추후) “차단”

---

## 5) 운영/관측/비용
- run_id 2종:
  - `build_run_id`(템플릿 생성/업데이트)
  - `judge_run_id`(평가/코칭)
- 지표:
  - 근거 부족률, 인용 실패율, 적용률, 재평가 개선량, P95 지연, 호출비용
- 비용 통제:
  - 캐시/쿼터/레이트리밋
  - 리랭커 Top-K 제한
  - 템플릿 생성은 배치(오프라인) 권장

---

## 6) Hard Negative 자산화(튜닝/회귀 핵심) ✅
- “자주 뜨지만 틀린 근거”를 자동 수집
- 사용:
  - 리랭커/쿼리 튜닝
  - 회귀 테스트(Consistency Gate) 강화
- 주기:
  - 운영 로그 기반 주간/월간 업데이트(검수 포함)

---

# 7) Feature Flags(완전판: 13개) ✅
기능은 “자리(스키마/로그/게이트)”를 먼저 만들고, 테넌트 단위로 점진 ON.

1. `FF_GOAL_CONTEXT` 목표/글유형 입력  
2. `FF_HIER_TEMPLATE` 계층형 템플릿  
3. `FF_CONFLICT_RESOLVER` 기준 충돌 해결  
4. `FF_PATCH_STAGING` 단계형 패치  
5. `FF_USER_TEMPLATES` 사용자/팀 템플릿  
6. `FF_EVIDENCE_QUALITY` 근거 강도 점수(표시/차단 모드)  
7. `FF_TEMPLATE_DRIFT` 템플릿 드리프트 감지(알림→재검증)  
8. `FF_BEFORE_AFTER_LOOP` 전/후 개선 루프  
9. `FF_HARD_NEGATIVES` 하드 네거티브 수집/활용  
10. `FF_CRITERIA_PACK_STANDARD` Criteria Pack 표준화 강제  
11. `FF_PIN_EVIDENCE` Pin/Unpin 컨텍스트 확정  
12. `FF_OUTPUT_MODES` Coach/Strict/Checklist 모드  
13. `FF_CRITERIA_TAGGING` Category/Difficulty 태깅  

---

# 8) 단계별 릴리즈 플랜(안전하게 “다 포함”) ✅
## P0(뼈대)
- Phase A/B + 기본 Gate + Shadow Workspace + Patch-only
- `FF_CRITERIA_PACK_STANDARD`(ON 권장: 표준화는 초반부터)

## P1(효과 대비 리스크 낮음)
- ON: `FF_GOAL_CONTEXT`(간단 1~2개 선택)  
- ON: `FF_PATCH_STAGING`(1차 Top3)  
- ON: `FF_EVIDENCE_QUALITY`(display_only)  
- ON: `FF_PIN_EVIDENCE`(후보 추천 + 사용자 고정)  

## P2(설명/품질 강화)
- ON: `FF_CONFLICT_RESOLVER`(설명 중심)  
- ON: `FF_OUTPUT_MODES`  
- ON: `FF_BEFORE_AFTER_LOOP`(권한/익명 정책 포함)  
- ON: `FF_HARD_NEGATIVES`(검수 포함)  

## P3(운영 난이도 높은 확장)
- ON: `FF_HIER_TEMPLATE`  
- ON: `FF_USER_TEMPLATES`(승인 워크플로 포함)  
- ON: `FF_TEMPLATE_DRIFT`(알림→재검증→승격)  
- ON: `FF_CRITERIA_TAGGING`(검수 루프 포함)  

---

## 9) 최종 결론
- **[팩트]** BM25로 규칙/예시 회수를 안정화하고, LLM은 요약→예시/템플릿 생성→부합 평가→Patch 제안까지 수행한다.
- **[내 생각]** 성공의 핵심은 임베딩이 아니라 **Template Builder(기준 자산화) + Criteria Pack 표준화 + Gate/회귀 + 승인형 UX + Feature Flag 롤아웃**입니다.
