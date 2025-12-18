# PRISM 아이디어 회의록 v2
## 주제: 역할별 LLM 모델 분리 운영(Chunk/Embed vs Search/Answer/Review) 적용
- **회의 목적:** 디렉터 아이디어(문서 업로드 후 **청킹/임베딩 모델**과 **검색·답변·검토(리뷰) 모델**을 역할별로 분리 운영)를 PRISM에 적용하기 위한 **의사결정/설계/실행과제**를 꼼꼼하게 정리
- **진행:** 시니어 개발자(사회) / 주니어 개발자(서기)
- **산출물:** 결정사항(Decisions), 설계안(Design), 리스크/대응(Risks), 실행과제(Action Items), 다음 회의 아젠다(Next)

---

## 1) 참석자(역할 기반)
- **시니어 개발자(사회):** 범위/우선순위/리스크 조율, 결론 도출
- **주니어 개발자(서기):** 논점 정리, 결정/미결/액션아이템 기록
- **System Architect:** Ports&Adapters/DI/Strategy 설계, 경계(UseCase) 정의
- **Backend Engineer:** API/유스케이스/잡(ingestion)/모델 라우팅 구현
- **DB Engineer:** 스키마/인덱스/버전 분리(embedding_model_id)/검색 함수 설계
- **AI/ML Engineer:** 청킹/임베딩/검색 튜닝/리랭킹/검토 프롬프트 설계
- **LLM Ops(모델 운영):** 모델 조합/라우팅 정책/비용·지연·품질 운영 설계
- **DevOps Engineer:** CI/CD/관측/비용 로깅/알림/롤백
- **Frontend Engineer:** 근거 UI/검토 결과 UI/실패 UX
- **Security Engineer:** Auth/RLS/키관리/업로드 검증/감사로그/레이트리밋

---

## 2) 배경 & 전제
### 2.1 전제(팩트)
- 역할(청킹/임베딩/검색/답변/검토)은 **서로 다른 모델/서로 다른 공급자**로 분리 운영 가능.
- 다만 **임베딩 모델 변경**은 벡터 차원/공간이 바뀌어 **혼합 검색 시 품질 저하** 위험이 큼 → 버전 관리가 필수.

### 2.2 목표(왜 분리하는가)
- **비용 최적화:** 임베딩은 저렴/전용 모델, 검토는 필요할 때만 강한 모델
- **품질 안정:** 답변 모델의 환각을 검토 모델로 억제(근거 불일치 경고)
- **운영 유연성:** 특정 단계만 교체(예: 검토 모델만 업그레이드)

---

## 3) 회의 아젠다(진행 순서)
1) 역할별 “모델 슬롯” 정의  
2) 임베딩 모델 변경/버전 관리 정책  
3) 모델 라우팅(Model Router) 정책(MVP vs Phase2+)  
4) UI/UX: 검토 결과 표시 방식(신뢰도/경고)  
5) 운영: 비용/지연/오류 관측 + 상한/레이트리밋  
6) 테스트/품질: 평가셋/회귀/롤백 기준  
7) 결정사항/액션아이템 확정

---

## 4) 모델 슬롯 정의(합의)
> 결론: **슬롯 분리**는 적용하되, MVP 복잡도는 제한한다.

### 4.1 슬롯 목록(고정)
- **Chunker:** 문서 → 청크 생성 (기본 룰, 옵션 LLM 보조)
- **Embedder:** 청크 → 임베딩 벡터 생성(임베딩 전용)
- **Retriever:** 하이브리드 검색(벡터 + 텍스트)로 TopK 구성(로직/인덱스가 핵심)
- **Answer:** TopK 컨텍스트로 답변 생성(LLM)
- **Reviewer(Verifier):** 답변이 근거와 일치하는지 검토(LLM)

### 4.2 MVP 권장 구성
- Chunker: **룰 기반**(길이/문단/헤더)로 시작
- Embedder: **1개 고정**(버전 저장 필수)
- Answer & Reviewer: **서로 다른 모델** 허용(비용/품질 분리 운영의 핵심)

---

## 5) 핵심 정책: 임베딩 모델 변경(버전/혼합 검색)
### 5.1 리스크(예상 문제)
- 임베딩 변경 후 기존 청크와 신규 청크를 섞어 검색하면, 점수 의미가 달라져 **검색 품질이 흔들릴 수 있음**.

### 5.2 결정(정책)
- **DB에 필수 메타 저장**
  - `embedding_model_id` (vendor/model/version)
  - `embedding_dim`
  - `embedded_at`
- **검색 기본 정책(Do Now)**
  1) 기본은 **동일 embedding_model_id만 검색**
  2) 모델 교체 시 **재임베딩(backfill) 잡**으로 버전을 맞춘다(권장)
- **예외(Phase2+)**
  - 혼합이 필요하면: `버전별 TopK → 합치기 → (옵션) 리랭킹` 방식으로 단계 적용

---

## 6) Model Router(모델 선택 정책) 설계
### 6.1 Router 책임
- 요청 유형(ingest/search/answer/review)에 대해 모델을 선택하고,
- 선택 근거를 로그로 남김:
  - `router_decision`, `model_id`, `prompt_version`, `cost_estimate`, `mode`

### 6.2 MVP Router 정책(단순 3모드)
- **mode=cheap:** 컨텍스트 축소 + Answer 저비용 + Reviewer 간소(또는 off)
- **mode=standard:** Answer 기본 + Reviewer 저비용(기본 on 또는 옵션)
- **mode=strict:** Answer 기본/상향 + Reviewer 강한 모델(검증 강화)

### 6.3 Reviewer 실행 정책(미결 → 다음 회의)
- 옵션 A: **항상 실행**(신뢰성↑ / 비용↑)
- 옵션 B: **조건부 실행**(예: 신뢰도 낮음, 특정 고객, 특정 카테고리)  
- 옵션 C: **사용자 토글**(“검토 켜기/끄기”)

---

## 7) 데이터/스키마 변경(최소)
### 7.1 테이블 변경(Chunks)
- `chunks`에 추가(권장):
  - `embedding_model_id TEXT NOT NULL`
  - `embedding_dim INT NOT NULL`
  - `embedded_at TIMESTAMP NOT NULL`
  - (옵션) `chunk_hash TEXT` (중복 제거)

### 7.2 검색 쿼리 기본 조건
- `WHERE chunks.embedding_model_id = :active_embedding_model_id`

### 7.3 인제스트 잡(권장)
- `ingestion_jobs`:
  - doc_id, status, started_at, finished_at, error_code, error_detail, retry_count

---

## 8) 파이프라인(요청 흐름) 합의
### 8.1 Ingest(업로드 후)
1) Upload → 문서 메타 저장
2) Parse → 표준화
3) Chunk → chunk_hash 생성(중복 제거)
4) Embed → embedding_model_id 저장
5) Index → 완료

### 8.2 Answer+Review(질의 시)
1) Retrieve TopK(동일 embedding_model_id)
2) Answer 생성(근거 인용 필수)
3) Reviewer 검토(✅/⚠️/⛔ 판정 + 근거 부족 경고)
4) UI 출력(답변 + 근거 카드 + 검토 배지)

---

## 9) UI/UX 합의(최소)
### 9.1 근거 카드(필수)
- 문서명/페이지/청크 스니펫 + (가능하면) 하이라이트

### 9.2 검토 배지(필수 최소)
- ✅ 근거 일치 가능성 높음
- ⚠️ 근거 부족/추정 포함
- ⛔ 근거와 불일치 가능성

### 9.3 실패 UX(필수)
- 인제스트 실패/권한 없음/비용 초과/타임아웃에 대해:
  - 원인 + 대안(재시도/저비용 모드/문서 축소)을 표준 템플릿으로 제공

---

## 10) 운영/관측/비용 통제(필수 로그)
### 10.1 반드시 로깅(MVP)
- request_id, user_id(tenant)
- 단계별 latency: ingest/search/answer/review
- 토큰/비용: answer/review 각각
- embedding_model_id, answer_model_id, reviewer_model_id, prompt_version, mode

### 10.2 비용 폭주 방지(Phase2 강화)
- 사용자별 비용 상한(soft/hard) + 경보
- 캐시: embedding cache / answer cache
- p95 지연/오류율 알림

---

## 11) 보안 합의(최소)
- Auth(JWT) + RBAC
- DB RLS로 사용자별 문서/청크 접근 강제
- 사용자 키/비밀정보 취급 정책(저장/마스킹/감사로그) 문서화

---

## 12) 테스트/품질 합의
### 12.1 회귀 평가(필수)
- 평가셋 20~50문항
- 지표(최소):
  - 근거 인용률
  - 정답성(샘플링 휴먼 체크)
  - 환각/금지 규칙 위반률

### 12.2 롤백 기준(권장)
- 기준선 대비 지표 하락 or 비용 급증 발생 시 Router 정책/모델 버전 롤백

---

## 13) 결정사항(Decisions)
1) 역할별 분리 운영을 PRISM에 도입(Chunk/Embed vs Answer/Review).  
2) 임베딩 버전 메타(embedding_model_id, embedding_dim, embedded_at)를 필수 저장.  
3) 검색 기본 정책은 “동일 embedding_model_id만 검색”.  
4) Router는 MVP에서 3모드(cheap/standard/strict)로 단순 시작.  
5) UI는 “근거 카드 + 검토 배지(✅/⚠️/⛔)”를 최소로 제공.

---

## 14) 미결사항(Open Decisions)
1) Reviewer 실행 정책: 항상 vs 조건부 vs 사용자 토글  
2) 혼합 검색(임베딩 버전 섞임) 공식 정책(Phase2에서 확정)  
3) 구체 모델 조합(공급자/모델명) 및 비용 상한 수치

---

## 15) Action Items(담당/산출물/완료기준)
- **Architect**
  - A1) 슬롯/포트 인터페이스 명세서 v0.1  
  - DoD: 각 슬롯 입력/출력 DTO + 오류 규격 + 의존성 방향 문서화
- **Backend**
  - B1) Router v0.1 구현 + 로그 필드 고정  
  - DoD: mode/모델 선택이 로그에 남고, answer/review 분리 실행
- **DB**
  - D1) chunks 컬럼 추가(embedding_model_id/dim/embedded_at) + 기본 필터 적용  
  - DoD: 검색이 버전 필터로 동작, 마이그레이션 스크립트 제공
- **AI/ML**
  - M1) 룰 기반 청킹 정책 v0.1 + 실패 케이스 수집  
  - M2) Reviewer 프롬프트 v0.1(✅/⚠️/⛔ 판정 규칙)  
  - DoD: 평가셋 20문항으로 최소 검증 통과
- **LLM Ops**
  - O1) 3모드 정책 문서 + 비용/지연 추정 범위(추정치)  
  - DoD: 모드별 예상 토큰 사용/latency 범위 표 작성
- **DevOps**
  - V1) 비용/latency 대시보드 + 경보 조건 초안  
  - DoD: p95/오류율/비용 알람이 동작
- **Frontend**
  - F1) 근거 카드 + 검토 배지 UI v0.1 + 실패 UX 템플릿  
  - DoD: 답변 화면에서 근거/검토 표시가 일관되게 노출
- **Security**
  - S1) 키/비밀정보 취급 정책 v0.1 + RLS 체크리스트  
  - DoD: 사용자 문서 격리가 테스트로 확인됨

---

## 16) 다음 회의 아젠다(Next)
1) Reviewer 실행 정책 최종 결정(기본값/옵션/요금)  
2) 모델 조합 후보 2~3안 선정(저비용/균형/고품질)  
3) 비용 상한(soft/hard) 및 초과 시 UX 확정  
4) Phase2 혼합 검색/리랭킹/평가 파이프라인 일정 확정

---

## 부록 A) Router 설정 예시(YAML)
```yaml
router:
  mode_default: standard
  embedding:
    model_id: "embedding-vendor/model-v1"
    dim: 1536
  answer:
    standard: "llm-vendor/answer-standard"
    cheap: "llm-vendor/answer-cheap"
    strict: "llm-vendor/answer-standard"
  review:
    standard: "llm-vendor/review-cheap"
    cheap: "llm-vendor/review-off"
    strict: "llm-vendor/review-strong"




alter table chunks
  add column embedding_model_id text not null default 'embedding-vendor/model-v1',
  add column embedding_dim int not null default 1536,
  add column embedded_at timestamptz not null default now();

create index idx_chunks_embedding_model_id on chunks(embedding_model_id);