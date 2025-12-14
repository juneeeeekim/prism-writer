# PRISM 웹서비스 청사진 (Blueprint)
> 목적: 지금까지 회의/문서 분석 내용을 **한 장의 실행 가능한 청사진**으로 통합한다.  
> 범위: **멀티모달 RAG 기반 웹서비스**(문서 업로드 → 파싱/청킹 → 임베딩/인덱싱 → 하이브리드 검색 → 근거 기반 답변 UI).

---

## 0. 근거 범위
### 팩트(업로드 문서 기반)
- 개발 원칙: **TDD, Clean Architecture, Model Agnostic, Zero Cost(MVP)**.
- 핵심 구조: **Hexagonal(Ports & Adapters), DI, Strategy(모델/파서 스위칭)**.
- 데이터 저장/검색: **Supabase(Postgres + pgvector)**, 벡터 검색 RPC, 단계적 로드맵(Phase 1~4).
- 멀티모달 처리 방향: **이미지 → Vision LM 캡션 → 임베딩 저장**.
- 보안 아이디어(이전 회의): **RLS, 파일 업로드 검증(MIME/size/hash/scan/metadata strip), JWT/RBAC, 파라미터 바인딩, API Key 암호화**.

### 제안(시니어 판단)
- “작동하는 MVP”를 빠르게 만들되, **보안/관측/평가(회귀)**를 초기에 최소 세트로 포함해야 운영 리스크를 줄인다.
- 이벤트/CQRS는 MVP에 과도할 수 있어 **Outbox 1종 수준**으로 제한하고, 확장 단계에서 점진 적용한다.

---

## 1. 제품 목표 (Product Goals)
- 사용자는 자신의 문서(텍스트/PDF/이미지)를 업로드하고, PRISM이 **근거를 인용하며** 질문에 답한다.
- 사용자는 답변의 신뢰를 확인하기 위해 **출처(문서/페이지/청크) + 하이라이트**를 볼 수 있다.
- 운영자는 토큰/비용, 지연시간, 실패율을 보고 **비용 폭주/품질 저하를 빠르게 감지**할 수 있다.

---

## 2. MVP 스코프 (MVP Scope)
### 반드시 포함 (MVP 필수)
1) 업로드: 파일 업로드(텍스트/PDF/이미지), 메타데이터 저장  
2) 인제스트: 파싱 → 청킹 → 임베딩 → 인덱싱  
3) 검색: Hybrid(벡터 + 텍스트) 기반 TopK  
4) 답변: 근거 포함 답변 생성(Streaming 가능)  
5) UI: 채팅 + 근거 카드(출처/청크/하이라이트)  
6) 운영 최소세트: `/health`, request_id 로깅, 비용(토큰) 로깅  
7) 보안 최소세트: Auth + RLS + 업로드 검증

### MVP에서 제외(Phase2+)
- Advanced RAG(복잡한 리랭킹/그래프/툴), 멀티모달 고도화(레이아웃 이해/표 구조화), 완전한 이벤트 기반 확장

---

## 3. 시스템 아키텍처 (Clean + Hexagonal)
### 3.1 레이어/경계
- **Domain**: 엔티티/규칙(비즈니스 의미)  
- **Application**: 유스케이스(업로드/인제스트/검색/답변)  
- **Infrastructure**: DB(Supabase), Vector Store(pgvector), LLM Provider, File Storage  
- **Presentation**: API(FastAPI), UI(Next.js)

### 3.2 핵심 원칙
- 외부 의존성(LLM/DB/스토리지)은 **Port(인터페이스)** 뒤로 숨긴다.
- 모델/파서/임베더는 Strategy로 교체 가능하게 유지한다.
- 기능 추가보다 **단순성/DRY**를 우선하며, 테스트 없이 로직을 추가하지 않는다.

---

## 4. 데이터 모델 (최소 스키마 제안)
> 목표: “운영 가능한 RAG”에 필요한 최소 단위로 분리한다.

### 4.1 테이블(권장 최소)
- **documents**: 파일/문서 메타(소유자, 원본 경로, 상태, 크기, 타입)
- **chunks**: 청크 단위 텍스트/메타(문서ID, chunk_index, page, content, embedding, hash)
- **ingestion_jobs**: 인제스트 상태(queued/running/failed/done), 에러 사유, 재시도 횟수
- **audit_logs**: 접근/업로드/검색/다운로드 등 보안 감사 로그(누가/언제/무엇을)

### 4.2 인덱스/성능 힌트
- chunks: (document_id, chunk_index), embedding 벡터 인덱스, 텍스트 검색용 인덱스(FTS/BM25 고려)

---

## 5. 파이프라인 (Ingestion Flow)
1) **Upload**  
   - 파일 수신 → 기본 검증(size/MIME signature) → 저장 → documents 생성
2) **Parse**  
   - 텍스트 추출(텍스트/PDF/이미지 캡션) → 표준화(normalize)
3) **Chunk**  
   - 길이 기반 + 문단/헤더 경계 고려 → chunk hash 생성(중복 제거)
4) **Embed**  
   - 임베딩 생성 → chunks.embedding 저장
5) **Index**  
   - 벡터/텍스트 인덱스 갱신 → ingestion_jobs 완료

> 실패 시: ingestion_jobs에 실패 원인 기록, 재시도 정책 적용(최대 N회).

---

## 6. 검색/답변 (Retrieval & Generation)
### 6.1 Hybrid Retrieval
- 1차: 벡터 TopK  
- 2차(선택): 텍스트/키워드 조건 결합  
- 3차(선택): 간단 리랭킹(cheap) 후 최종 컨텍스트 구성

### 6.2 근거 기반 답변
- 답변은 반드시 **인용(문서/페이지/청크ID)**을 포함한다.
- UI에는 “근거 카드”로 노출하고, 가능한 경우 해당 청크 하이라이트를 제공한다.

---

## 7. API 설계 (초기 계약)
### 7.1 엔드포인트(예시)
- `POST /v1/files` 업로드(멀티파트)
- `POST /v1/ingestions/{doc_id}/run` 인제스트 시작
- `GET /v1/documents` 문서 목록
- `POST /v1/search` 검색(쿼리, top_k, filters)
- `POST /v1/chat` 채팅/답변(스트리밍 옵션)
- `GET /health` 상태 체크(DB/스토리지/LLM)

### 7.2 공통 규격(필수)
- 모든 응답에 `request_id`
- 표준 에러: `{code, message, request_id, detail}`

---

## 8. 보안 (MVP 최소 방어선)
### 8.1 인증/인가
- Auth(JWT) + Role 기반(RBAC)
- DB는 **RLS**로 사용자별 row 접근을 강제

### 8.2 파일 업로드 보안
- 시그니처 기반 MIME 확인, 파일 크기 제한, 해시 생성
- 필요 시 악성코드 스캔(가능한 무료/경량 옵션부터)
- 이미지/PDF 메타데이터 제거(가능하면)

### 8.3 비밀키/키관리
- `.env`는 커밋 금지, 키는 암호화/마스터키 분리
- 사용자 API Key(pay-per-use) 사용 시: 저장/표시 정책 명확화(노출 방지)

---

## 9. 관측(Observability) & 비용 관리
### 9.1 반드시 측정할 것(최소)
- p95 latency(검색/답변), 오류율(5xx/타임아웃), 인제스트 실패율
- 토큰 사용량/비용(요청 단위), 캐시 적중률(embedding/answer)

### 9.2 비용 폭주 방지
- 사용자별 일/월 비용 상한(soft/hard)
- “요약/저비용 모드” 제공(컨텍스트 축소, 모델 다운그레이드)

---

## 10. 품질(Testing) & 게이트
### 10.1 TDD 범위
- Domain/Application: 단위테스트 중심
- Infrastructure: 통합테스트(예: DB 연결/insert-delete, RPC 호출)

### 10.2 RAG 평가(필수)
- 최소 평가셋(20~50 Q/A)
- 지표: 근거 인용률, 정답성(휴먼 샘플링), 환각률(금지 규칙 위반)

### 10.3 PR 게이트(권장)
- 테스트 통과 + 린트 + 타입체크 + 의존성 취약점 스캔

---

## 11. 단계별 로드맵(실행 계획)
### Phase 1 (MVP Core)
- Supabase 연결/스키마/기본 RPC
- 업로드 + 인제스트(텍스트 우선)
- 벡터 검색 + 단순 답변(근거 포함)
- `/health` + 비용/로그 기본

### Phase 2 (Reliability)
- 인제스트 잡/재시도/큐 경계 명확화
- Hybrid Search 정교화, 캐시 도입
- 평가셋/회귀 테스트 파이프라인

### Phase 3 (Security & Scale)
- 감사로그 고도화, 보안 스캔 루틴
- 멀티테넌시 강화, 아카이빙/백업/복구 리허설

### Phase 4 (Product Polish)
- Next.js UI 완성(근거 하이라이트/실패 UX)
- 멀티모달 고도화(표/레이아웃/추출 품질 개선)

---

## 12. 역할 분담(책임 경계)
- Architect: 경계/규칙/로드맵, 설계 합의 유지
- Backend: API/유스케이스/큐 경계/에러 규격
- DB: 스키마/인덱스/검색 성능/백업
- AI/ML: 청킹/임베딩/검색 튜닝/평가
- DevOps: CI/CD/배포/모니터링/복구
- Frontend: 근거 UI/채팅 UX/실패 UX
- Security: Auth/RLS/업로드 검증/감사로그/스캔 루틴

---

## 13. 즉시 실행 체크리스트 (이번 스프린트)
- [ ] Document/Chunk/Job/AuditLog 최소 스키마 확정
- [ ] 업로드 → 인제스트(텍스트) end-to-end 성공
- [ ] 검색 결과 근거 카드 UI(최소 버전) 노출
- [ ] `/health` + request_id + 토큰/비용 로그
- [ ] Auth + RLS 적용(사용자 문서 보호)
- [ ] 평가셋 초안(20문항) 생성 & 첫 회귀 기준선 저장

---

## 부록: 문서/코드 규칙(팀 합의용)
- 디렉토리/파일 헤더 주석 규칙(경로/파일명/역할)
- PR 템플릿: 변경 요약 / 테스트 결과 / 리스크 / 롤백
- 운영 룰: 월 1회 복구 리허설, 주 1회 취약점 점검

