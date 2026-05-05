# AGENTS.md

## 0. 문서 목적

이 문서는 Codex와 custom agent가 이 프로젝트에서 작업할 때 반드시 따라야 하는 공통 운영 규칙이다.

이 프로젝트는 상담/분석/리포트 생성형 웹서비스를 안정적으로 운영하고 개선하는 것을 목표로 한다.  
새 기능 추가 속도보다 기존 기능 보호, API 계약 안정성, 결제/인증/외부 API 안정성, 에러 추적 가능성, SEO/검색봇 접근성, 테스트 가능성, 배포 안정성을 우선한다.

---

## 1. 서비스 기본 성격

이 서비스는 다음 성격을 가진다.

- 사용자 입력을 받아 분석 결과 또는 상담형 리포트를 제공하는 서비스
- LLM API 또는 외부 분석 API를 사용할 수 있는 서비스
- 결제, 무료 질문 횟수, 추가 질문 횟수, 리뷰 보상 같은 과금/권한 흐름을 가질 수 있는 서비스
- 관리자 화면, 사용자 기록, 에러 로그, 운영 리포트가 필요한 서비스
- Google/Naver 등 검색엔진 색인과 SEO 상태가 중요한 웹서비스
- 기존 사용자 흐름과 데이터 저장 안정성이 중요한 서비스

작업자는 항상 아래 기존 기능을 보호 대상으로 본다.

- 로그인 / 인증 / 세션
- 결제 / 구독 / 빌링키 / 무료 횟수 / 사용량 차감
- 사용자 입력 저장
- 분석 결과 생성 및 조회
- 관리자 기능
- 기존 API
- 기존 DB schema
- 기존 Webhook
- 배포 설정
- SEO 관련 파일: `robots.txt`, `sitemap.xml`, meta tag, canonical, Open Graph
- 검색봇 접근성: Googlebot, Naverbot 등

---

## 2. 최우선 원칙

- 기존 기능 보호가 최우선이다.
- 확실하지 않은 수정은 먼저 영향 범위를 분석한다.
- 위험한 변경은 작은 단위로 나누어 반영한다.
- API 계약에 영향이 있으면 Caller와 Provider를 한쪽만 수정하지 않는다.
- 외부 의존성이 있으면 Mock/Stub, timeout, retry, fallback을 먼저 정의한다.
- 결제, 생성, 전송, 외부 side effect 작업에는 멱등성을 검토한다.
- Webhook 수신이 있으면 signature verification, event_id dedupe, retry-safe 처리를 검토한다.
- 에러 로그는 민감정보를 제거하고 request_id, error_code로 추적 가능해야 한다.
- 수정 후 syntax/type/lint/test와 기존 기능 회귀를 확인한다.
- secret, token, password, api_key, cookie, 개인정보를 코드나 로그에 남기지 않는다.
- 사용자의 명시 요청 없이 대규모 구조 변경, DB schema 변경, 인증/결제 구조 변경을 단정적으로 진행하지 않는다.

---

## 3. Agent 관점 라우팅 규칙

사용자가 자연어로 특정 전문가, 에이전트, 역할, 페르소나를 요청하면 아래 기준으로 담당 관점을 선택한다.

Codex custom agent 동작 기준:

- 사용자가 "agent를 호출해줘", "subagent로 나눠줘", "병렬 agent로 진행해줘", "각 agent에게 맡겨줘"처럼 명시적으로 agent 호출/위임/병렬 작업을 요청한 경우에만 해당 custom agent를 spawn 대상으로 사용한다.
- 사용자가 단순히 "API 전문가처럼 봐줘", "QA 관점으로 검토해줘", "오류 해결해줘"처럼 역할 또는 전문성을 요청한 경우에는 현재 세션이 아래 agent의 관점과 체크리스트를 적용해 직접 수행한다.
- 둘 이상의 agent가 지정된 경우에도, 병렬 위임이 명시되지 않았으면 현재 세션에서 순차적으로 해당 관점을 적용한다.
- custom agent 정의 파일은 `.codex/agents/*.toml` 또는 `C:\Users\chyon\.codex\agents\*.toml`에 둔다. 각 파일은 `name`, `description`, `developer_instructions` 문자열 필드를 가져야 한다.

| 사용자 표현 | 적용할 Agent 관점 | 목적 |
|---|---|---|
| 체크리스트 만들어줘 | `checklist_planner` | 구현 체크리스트 작성 |
| 구현 계획 세워줘 | `checklist_planner` | Phase / Workstream 분리 |
| 작업 지시서 만들어줘 | `checklist_planner` | 개발자가 실행 가능한 지시서 작성 |
| 기술 개발 문서 만들어줘 | `checklist_planner` | 구현 전 개발 문서 작성 |
| 업그레이드 실행해줘 | `upgrade_executor` | 실제 코드 수정 |
| 개선 반영해줘 | `upgrade_executor` | 기존 기능 보호하며 수정 |
| 오류 해결 에이전트 | `upgrade_executor` + `qa_release_reviewer` | 오류 원인 분석 후 수정 및 검증 |
| 버그 수정 전문가 | `upgrade_executor` + `qa_release_reviewer` | 버그 수정 및 회귀 검증 |
| API 전문가 | `api_contract_reviewer` | API 계약 검토 |
| 연동 전문가 | `api_contract_reviewer` | 외부 API, Webhook, Caller/Provider 검토 |
| 결제 오류 전문가 | `api_contract_reviewer` + `error_log_reviewer` | 결제 API/로그/외부 의존성 검토 |
| 에러 관리 에이전트 | `error_log_reviewer` | 에러 로그 구조, 민감정보, fallback 검토 |
| 에러 리포트 작성 | `error_log_reviewer` | 오류 기록/조회/운영 리포트 검토 |
| QA 전문가 | `qa_release_reviewer` | 테스트, 회귀, 릴리스 검수 |
| 릴리스 전문가 | `qa_release_reviewer` | 배포, rollback, 환경변수 검토 |
| SEO 전문가 | `checklist_planner` + `qa_release_reviewer` | 검색봇 접근성, robots/sitemap/meta 검토 |
| 검색 색인 문제 전문가 | `checklist_planner` + `qa_release_reviewer` | 색인 방해 요소 분석 및 수정 계획 |
| 최고 전문가님 초빙 | 요청 내용에 맞는 reviewer/executor 관점 | 전문가 페르소나로 분석 |

---

## 4. 자연어 호출 해석 규칙

사용자가 정확한 agent 이름을 말하지 않아도 아래처럼 해석한다. 단, 아래 해석은 기본적으로 "현재 세션에서 적용할 전문 관점"을 뜻하며, 실제 subagent spawn은 사용자가 명시적으로 agent 호출/위임/병렬 진행을 요청한 경우에만 수행한다.

- “오류”, “버그”, “작동 안 됨”, “에러남” → 원인 분석 후 `upgrade_executor`와 `qa_release_reviewer`
- “점검”, “검토”, “리포트” → reviewer 계열 agent 우선
- “수정”, “해결”, “반영”, “업그레이드” → `upgrade_executor`
- “API”, “Webhook”, “연동”, “결제”, “LLM API”, “SMS”, “이메일” → `api_contract_reviewer`
- “로그”, “에러 기록”, “관리자 로그”, “모니터링” → `error_log_reviewer`
- “테스트”, “회귀”, “배포”, “릴리스”, “빌드 오류” → `qa_release_reviewer`
- “체크리스트”, “작업 지시서”, “기술 개발 문서”, “구현 계획” → `checklist_planner`
- “최고 전문가”, “시니어”, “전문가 초빙” → 요청 주제에 맞는 specialist agent 관점을 적용하고 전문가 페르소나로 응답

---

## 5. 작업 시작 전 필수 분석

작업 전에 반드시 아래 항목을 먼저 확인한다.

### 5.1 프로젝트 구조

- 주요 프레임워크와 언어
- 주요 디렉터리
- API 위치
- UI 위치
- DB/schema 위치
- 외부 연동 위치
- 테스트 위치
- 배포/환경변수 위치
- SEO 파일 위치
- 관리자 기능 위치
- 에러 로그 또는 모니터링 위치

### 5.2 영향받는 기존 기능

- 직접 영향 기능
- 간접 영향 기능
- 회귀 가능성이 있는 기능
- 절대 깨지면 안 되는 기능
- 인증/결제/데이터 저장 영향
- 사용량 차감 또는 무료 질문 횟수 영향
- 관리자 기능 영향
- 검색 색인 또는 SEO 영향

### 5.3 API / Integration 영향

- 신규 API 추가 여부
- 기존 API 변경 여부
- request/response schema 변경 여부
- error code/status 변경 여부
- auth/permission 변경 여부
- webhook payload/signature 변경 여부
- 외부 API 호출 추가/변경 여부
- DB schema 변경이 API 응답에 미치는 영향
- 결제 PG, LLM API, SMS, 이메일, 스토리지, 로그 수집기 영향

### 5.4 병렬 작업 가능성

수정 전 아래 항목을 판단한다.

- 병렬 가능한 작업
- 순차 진행해야 하는 작업
- 동시에 수정하면 위험한 공용 파일
- 공용 함수/전역 상태/공통 UI 상태
- API 계약 변경 Workstream
- 외부 의존성 Workstream
- DB migration Workstream
- 결제/인증 Workstream

---

## 6. Phase 진행 규칙

작업은 Phase 단위로 나눈다.

각 Phase 시작 전 작성한다.

- `Goal`: Phase 목표
- `Scope`: 수정 범위
- `Protected Flows`: 영향받는 기존 기능
- `Parallelizable`: Yes / No
- `API Impact`: None / Caller / Provider / Both / 확인 필요
- `External Deps`: 없음 / 목록
- `Risk`: Low / Medium / High
- `Rollback`: 되돌리는 방법

각 Phase 완료 후 보고한다.

- 수정 파일
- 수정 내용
- 영향 기능 점검 결과
- syntax/type/lint/test 결과
- API 변경 시 Caller/Provider 동기화 결과
- UX/UI 검수 결과
- SEO/검색봇 영향 검토 결과
- 남은 리스크 또는 확인 필요 항목

---

## 7. API 계약 규칙

API 변경이 있으면 반드시 Phase 0을 먼저 작성한다.

Phase 0에서 확정할 항목:

- `Endpoint`: METHOD + URL
- `Path Params`
- `Query Schema`
- `Request Body Schema`
- `Response Schema`
- `Status Code Matrix`
- `Error Format`
- `Error Codes`
- `Auth`
- `Authorization`
- `Idempotency`
- `Version Policy`
- `Caller Work`
- `Provider Work`
- `Contract Test`

Phase 0이 완료되기 전에는 Caller/Provider 구현을 시작하지 않는다.

---

## 8. Breaking Change 규칙

기존 API, schema, webhook을 변경하거나 제거하면 Phase F를 먼저 작성한다.

Phase F에서 확인할 항목:

- Breaking Change 여부
- 영향받는 caller inventory
- 기존 client/version/partner 영향
- migration guide
- deprecation/sunset 일정
- 신구 버전 공존 여부
- 잔존 호출 모니터링 방법

아래 중 하나라도 있으면 Breaking Change 후보로 본다.

- response field 제거
- field type 변경
- optional field를 required로 변경
- endpoint path/method 변경
- 기존 error code 제거 또는 의미 변경
- 인증 방식 변경
- webhook event name/payload/signature 변경
- 기존 client가 수정 없이는 동작하지 않음

---

## 9. Caller / Provider 규칙

API 작업은 반드시 Caller와 Provider를 나누어 검토한다.

- Provider만 수정하고 Caller를 방치하지 않는다.
- Caller만 수정하고 Provider를 방치하지 않는다.
- request schema와 response schema는 가능한 단일 출처를 둔다.
- error format과 status code를 양쪽에서 동일하게 해석해야 한다.
- API client 함수는 response schema 검증 또는 타입 검증을 포함한다.
- UI는 loading, success, error, empty, permission denied 상태를 처리한다.

---

## 10. 외부 의존성 규칙

외부 서비스가 있으면 실제 연동 전에 Mock/Stub을 먼저 정의한다.

대상 예시:

- 결제 PG
- 인증 Provider
- LLM API
- SMS
- 이메일
- 지도
- 스토리지
- 로그 수집기
- 검색/크롤링 API

필수 검토 항목:

- success
- 400
- 401
- 403
- 409
- 422
- 429
- 500
- timeout
- rate limit
- invalid signature
- duplicate event
- retry
- fallback
- normalized error
- no secret logging

---

## 11. 결제 / 사용량 / 무료 질문 횟수 규칙

결제 또는 사용량 차감 작업은 고위험 작업으로 본다.

필수 확인 항목:

- 결제 성공/실패 상태 구분
- 중복 결제 방지
- 빌링키 발급 실패 처리
- 결제창 진입 전/후 상태 로그
- 무료 질문 횟수 차감 시점
- 실패 시 횟수 차감 방지
- 중복 클릭 방지
- 결제 Webhook 멱등성
- 환불/취소/실패 상태 처리
- 사용자 노출 메시지와 내부 로그 메시지 분리
- 결제 관련 secret, 카드정보, 인증정보 로그 금지

---

## 12. LLM / 분석 리포트 생성 규칙

LLM API 또는 분석 리포트 생성 작업은 아래 규칙을 따른다.

- 사용자 입력 원문 저장 여부를 명확히 한다.
- 개인정보 또는 민감정보가 프롬프트/로그에 불필요하게 남지 않도록 한다.
- 프롬프트 버전 또는 분석 로직 버전을 추적 가능하게 한다.
- LLM timeout, rate limit, invalid response, empty response를 처리한다.
- 결과 저장 전 schema 검증을 수행한다.
- 실패 시 사용자에게 재시도 가능한 메시지를 제공한다.
- 비용이 발생하는 LLM 호출은 중복 호출 방지 또는 idempotency를 검토한다.
- 분석 결과가 사용자에게 과도한 확정 표현으로 전달되지 않도록 한다.
- 상담/심리/운명 관련 표현은 의료적 진단처럼 보이지 않도록 주의한다.

---

## 13. 에러 로그 규칙

에러 로그 기능이 포함되면 아래 구조를 기준으로 한다.

```text
/error-log/
  /api/
  /ui/
  /db/
  /external/
  /payment/
```

로그 필드 기준:

```json
{
  "timestamp": "ISO-8601",
  "level": "error | warn | info",
  "source": "api | ui | db | external | payment",
  "feature": "string",
  "event": "string",
  "request_id": "string",
  "user_id_hash": "string | null",
  "error_code": "string",
  "message": "safe user/internal summary",
  "context": {},
  "stack": "server-only optional",
  "external_provider": "string | null"
}
```

민감정보 규칙:

- password, token, secret, api_key, authorization, cookie 원문 저장 금지
- 주민번호, 카드번호, 전화번호, 이메일 원문 저장 금지
- 필요한 경우 hash 또는 masking 처리
- 사용자 메시지와 내부 로그 메시지를 분리한다.
- 로그 기록 실패가 본 기능 실패로 이어지면 안 된다.
- logging 함수는 best-effort로 동작해야 한다.
- 저장소 장애 시 fallback을 정의한다.

로그 조회 API가 있으면:

- Phase 0에서 계약을 먼저 확정한다.
- 관리자 또는 지정 권한만 조회 가능해야 한다.
- pagination, filtering, date range, source, level, feature 조건을 정의한다.
- 원문 민감정보가 조회되지 않도록 response schema를 제한한다.
- 조회 API 자체 접근 로그를 남긴다.

---

## 14. SEO / 검색봇 / 색인 규칙

SEO 또는 색인 관련 작업은 아래를 확인한다.

- `robots.txt`가 검색봇을 막고 있지 않은가?
- `sitemap.xml`이 존재하고 최신 URL을 포함하는가?
- canonical URL이 올바른가?
- meta title, description이 존재하는가?
- Open Graph 태그가 기본적으로 존재하는가?
- noindex, nofollow가 의도치 않게 들어가 있지 않은가?
- Cloudflare, WAF, Bot Fight Mode, 접근 제한 설정이 검색봇을 막고 있지 않은가?
- SSR/SSG가 필요한 페이지가 클라이언트 렌더링만으로 비어 있지 않은가?
- 주요 랜딩페이지가 HTTP 200으로 접근 가능한가?
- redirect loop가 없는가?
- sitemap 제출 후 URL Inspection 대상 URL이 실제 배포 URL과 일치하는가?

검색 색인 문제는 코드 문제, 배포 문제, robots/sitemap 문제, WAF 문제, 콘텐츠 품질 문제를 분리해서 판단한다.

---

## 15. UI / UX 규칙

UI 변경 시 아래 상태를 반드시 확인한다.

- loading state
- success state
- error state
- empty state
- disabled state
- permission denied state
- duplicate submit guard
- focus flow
- keyboard accessibility
- mobile layout
- desktop layout
- CTA 버튼 이벤트 연결
- form validation
- 사용자에게 보이는 에러 메시지

상담/분석 서비스 특성상 CTA, 가격, 세션 정보, 문의 버튼, 예약 버튼의 흐름은 기존 전환 흐름을 깨지 않도록 보호한다.

---

## 16. DB / Storage 규칙

DB 또는 파일 저장 변경 시 아래를 확인한다.

- migration 적용 방법
- rollback 방법
- 기존 데이터 영향
- index 필요 여부
- unique constraint 필요 여부
- FK 필요 여부
- soft delete 필요 여부
- 개인정보 저장 최소화
- 파일 binary를 DB에 직접 저장하지 말고 object key/url/meta만 저장
- 사용자 권한 기준으로 접근 제어

DB schema 변경이 API response shape에 영향을 주면 API 계약 변경으로 판단한다.

---

## 17. 테스트 및 검증 규칙

가능한 범위에서 아래 명령을 실행한다.

```bash
pnpm lint
pnpm test
pnpm build
```

프로젝트가 pnpm을 쓰지 않으면 `package.json`의 scripts를 먼저 확인하고 맞는 명령을 사용한다.

검증 항목:

- syntax
- type check
- lint
- unit test
- integration test
- contract test
- existing feature regression
- API Caller/Provider sync
- UX loading/success/error/empty/disabled state
- SEO robots/sitemap/meta check
- environment variables
- rollback criteria

테스트를 실행하지 못하면 이유와 대체 검증 방법을 기록한다.

---

## 18. 중단 조건

아래 상황이면 즉시 작업을 멈추고 보고한다.

- syntax 오류가 10개 이상 발생
- API 계약 불일치 발견
- Caller/Provider 중 한쪽 변경만으로 해결 불가능
- 기존 핵심 기능이 깨지는 정황 발견
- 인증/권한/결제/데이터 손실 가능성 발견
- 사용량 차감 또는 결제 중복 가능성 발견
- 외부 API 응답이 명세와 다르고 fallback이 없음
- 로그에 secret/token/개인정보 노출 가능성 발견
- 검색봇 접근을 막는 설정이 발견됨
- 진행 방향이 불확실하고 영향 범위가 큰 경우

---

## 19. 파일 생성 / 수정 규칙

코드를 생성할 때 파일 상단에는 아래 헤더 주석을 포함한다.

```text
디렉토리 경로:
파일명:
파일 코드의 역할/설명:
```

예시:

```ts
// 디렉토리 경로: src/lib/logging/
// 파일명: logger.ts
// 파일 코드의 역할/설명: 구조화된 에러 로그 payload를 생성하고 안전하게 기록한다.
```

리팩토링은 다음 규칙을 따른다.

- 리팩토링 전 계획을 설명한다.
- 구조 개선만 수행하고 기능은 변경하지 않는다.
- 리팩토링 후 모든 테스트 또는 가능한 검증을 수행한다.
- 원인 불명 에러는 상세 로그를 삽입해 분석한다.

---

## 20. 결과 보고 형식

작업 결과는 아래 형식으로 보고한다.

1. 작업 목표
2. 영향받는 기존 기능
3. Phase별 진행 내용
4. Workstream 분리
5. 수정 파일 목록
6. API 계약 / 외부 의존성 / 멱등성 검수
7. 결제 / 사용량 / Webhook 검수
8. 에러 로그 기능 결과
9. SEO / 검색봇 영향 검토
10. syntax/type/lint/test 결과
11. 기존 기능 확인 결과
12. UX/UI 검수 결과
13. 충돌/보류 사항
14. 최종 체크리스트

---

## 21. 최종 체크리스트

작업 완료 전 아래를 확인한다.

- [ ] 영향받는 기존 기능 목록 작성 완료
- [ ] Phase 분할 완료
- [ ] Workstream 분리 완료
- [ ] API 변경 시 Phase 0 계약 확정 완료
- [ ] 기존 API 변경 시 Phase F 영향 분석 완료
- [ ] Caller/Provider 양면 작업 확인 완료
- [ ] 외부 의존성 Mock/Stub, timeout, retry, fallback 확인 완료
- [ ] 결제/사용량/무료 질문 횟수 중복 처리 확인 완료
- [ ] Webhook signature/dedupe/retry-safe 확인 완료
- [ ] 에러 로그 민감정보 masking 확인 완료
- [ ] 로그 저장 실패 fallback 확인 완료
- [ ] SEO/검색봇 차단 요소 확인 완료
- [ ] 새 DOM 요소 이벤트 리스너 연결 확인 완료
- [ ] 접근성/포커스 흐름 확인 완료
- [ ] syntax/type/lint/test 점검 완료
- [ ] 기존 기능 회귀 확인 완료
- [ ] rollback 기준 확인 완료
- [ ] 충돌/이슈/보류 사항 보고 완료
