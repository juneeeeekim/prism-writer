# 🔵 Phase 4: 검증 및 완료 상세 체크리스트

> **생성일**: 2025-12-29 07:08  
> **상위 문서**: [Architecture_Refactoring_Master_Plan.md](./2512290307_Architecture_Refactoring_Master_Plan.md)  
> **선행 조건**: Phase 3 완료 (기존 기능 Template 연결)  
> **목표**: 전체 시스템 안정성 확인 및 문서화  
> **예상 소요**: 2~3시간

---

## 📌 Phase 4 목표

```
┌─────────────────────────────────────────────────────────────────┐
│                    Phase 4: 검증 및 완료                         │
├─────────────────────────────────────────────────────────────────┤
│  P4-01: E2E 테스트     - 전체 사용자 흐름 검증                    │
│  P4-02: 성능 테스트    - P95 응답 시간 < 3000ms 확인              │
│  P4-03: 보안 테스트    - RLS 정책 및 권한 검사                    │
│  P4-04: 문서화        - README, API 문서 업데이트                 │
│  P4-05: Walkthrough   - 리팩토링 결과 요약 문서                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📋 Phase 4.1: E2E (End-to-End) 테스트

### P4-01: 전체 흐름 E2E 테스트

**목표**: 문서 업로드 → 처리 → 검색 → 평가 → 채팅 전체 흐름 검증

---

#### P4-01-A: 문서 업로드 및 처리 테스트

**테스트 시나리오**:

| #   | 시나리오           | 입력            | 예상 결과                     | 담당 |
| --- | ------------------ | --------------- | ----------------------------- | ---- |
| A1  | PDF 파일 업로드    | 10페이지 PDF    | 업로드 성공, 처리 시작        | QA   |
| A2  | TXT 파일 업로드    | 5KB 텍스트 파일 | 업로드 성공, 즉시 처리 완료   | QA   |
| A3  | 대용량 파일 업로드 | 50페이지 PDF    | 업로드 성공, 처리 시간 < 60초 | QA   |
| A4  | 지원하지 않는 파일 | .exe 파일       | 에러 메시지 표시              | QA   |
| A5  | 빈 파일 업로드     | 0KB 파일        | 에러 메시지 표시              | QA   |

**검증 쿼리**:

```sql
-- 문서 처리 상태 확인
SELECT id, title, status,
       EXTRACT(EPOCH FROM (updated_at - created_at)) as processing_seconds
FROM user_documents
WHERE user_id = :user_id
ORDER BY created_at DESC
LIMIT 5;

-- 청크 생성 확인
SELECT document_id, COUNT(*) as chunk_count
FROM rag_chunks rc
JOIN user_documents ud ON rc.document_id = ud.id
WHERE ud.user_id = :user_id
GROUP BY document_id
ORDER BY COUNT(*) DESC;
```

**담당**: QA 엔지니어  
**상태**: ⬜ 미완료

---

#### P4-01-B: 검색 기능 테스트

**테스트 시나리오**:

| #   | 시나리오            | 입력                        | 예상 결과                     | 담당 |
| --- | ------------------- | --------------------------- | ----------------------------- | ---- |
| B1  | 정확한 키워드 검색  | 업로드한 문서의 핵심 키워드 | 관련 청크 Top-5 반환          | QA   |
| B2  | 유사어 검색         | 동의어로 검색               | 의미적으로 관련된 청크 반환   | QA   |
| B3  | 카테고리 격리 검색  | 특정 카테고리 지정          | 해당 카테고리 문서만 반환     | QA   |
| B4  | 빈 결과 검색        | 관련 없는 키워드            | 빈 배열 또는 임계값 미달 반환 | QA   |
| B5  | 타인 문서 검색 시도 | 다른 사용자의 문서 내용     | 빈 결과 (RLS 검증)            | QA   |

**API 테스트**:

```bash
# cURL로 검색 API 테스트
curl -X POST http://localhost:3000/api/rag/search \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -d '{"query": "테스트 키워드", "topK": 5, "category": "미분류"}'
```

**담당**: QA 엔지니어  
**상태**: ⬜ 미완료

---

#### P4-01-C: 평가 기능 테스트

**테스트 시나리오**:

| #   | 시나리오              | 입력               | 예상 결과           | 담당 |
| --- | --------------------- | ------------------ | ------------------- | ---- |
| C1  | 종합 평가 실행        | 100자 이상 글      | 점수 + 피드백 A/B/C | QA   |
| C2  | 기준별 평가 실행      | 100자 이상 글      | 10개 기준별 판정    | QA   |
| C3  | 개별 재평가           | 특정 기준 선택     | 해당 기준만 재평가  | QA   |
| C4  | 평가 결과 저장        | 평가 완료 후       | DB에 저장, ID 반환  | QA   |
| C5  | 저장된 평가 로드      | 페이지 새로고침    | 이전 평가 결과 복원 | QA   |
| C6  | 템플릿 기반 평가      | 승인된 템플릿 존재 | 템플릿 기준 적용    | QA   |
| C7  | source_citations 확인 | v3 모드 평가       | 인용 필드 포함      | QA   |

**담당**: QA 엔지니어  
**상태**: ⬜ 미완료

---

#### P4-01-D: 채팅 기능 테스트

**테스트 시나리오**:

| #   | 시나리오          | 입력                       | 예상 결과            | 담당 |
| --- | ----------------- | -------------------------- | -------------------- | ---- |
| D1  | 일반 질문         | "글쓰기 팁 알려줘"         | AI 응답 스트리밍     | QA   |
| D2  | RAG 기반 질문     | 업로드한 문서 관련 질문    | 참고자료 기반 응답   | QA   |
| D3  | 카테고리 격리     | 특정 카테고리 문서 질문    | 해당 카테고리만 참조 | QA   |
| D4  | 채팅 히스토리     | 세션 재접속                | 이전 대화 내용 표시  | QA   |
| D5  | Template 컨텍스트 | USE_TEMPLATE_FOR_CHAT=true | 템플릿 예시 활용     | QA   |

**담당**: QA 엔지니어  
**상태**: ⬜ 미완료

---

#### P4-01-E: E2E 통합 시나리오

**전체 흐름 테스트** (시간 측정 포함):

```
[시작] 로그인
   ↓ (측정: 로그인 시간)
[1] 문서 업로드 (PDF 10페이지)
   ↓ (측정: 업로드 시간)
[2] 처리 완료 대기
   ↓ (측정: 처리 시간)
[3] 참고자료 탭에서 문서 확인
   ↓ (측정: 목록 로드 시간)
[4] 에디터에서 글 작성 (500자)
   ↓
[5] "종합 평가하기" 클릭
   ↓ (측정: 평가 응답 시간)
[6] 평가 결과 확인 (점수, 피드백)
   ↓
[7] 채팅 탭으로 이동
   ↓
[8] "이 글을 어떻게 개선하면 좋을까요?" 질문
   ↓ (측정: 채팅 응답 시간)
[9] AI 응답 확인 (참고자료 기반)
   ↓
[종료] 성공
```

**시간 목표**:
| 단계 | 목표 시간 |
|------|----------|
| 로그인 | < 2초 |
| 문서 업로드 | < 5초 |
| 문서 처리 | < 60초 |
| 목록 로드 | < 1초 |
| 평가 응답 | < 10초 |
| 채팅 응답 첫 토큰 | < 2초 |

**담당**: QA 엔지니어  
**상태**: ⬜ 미완료

---

## 📋 Phase 4.2: 성능 테스트

### P4-02: 성능 테스트

**목표**: P95 응답 시간 < 3000ms 확인

---

#### P4-02-A: API 응답 시간 측정

**측정 대상 API**:

| API                          | 메서드 | 목표 P95      | 측정 방법     |
| ---------------------------- | ------ | ------------- | ------------- |
| `/api/rag/evaluate`          | POST   | < 8000ms      | LLM 호출 포함 |
| `/api/rag/evaluate-holistic` | POST   | < 5000ms      | LLM 호출 포함 |
| `/api/rag/evaluate-single`   | POST   | < 3000ms      | 단일 기준     |
| `/api/rag/search`            | POST   | < 500ms       | 벡터 검색     |
| `/api/chat`                  | POST   | TTFT < 2000ms | 첫 토큰 시간  |
| `/api/documents/process`     | POST   | < 30000ms     | 문서 처리     |

**측정 스크립트** (PowerShell):

```powershell
# 간단한 응답 시간 측정
$stopwatch = [System.Diagnostics.Stopwatch]::StartNew()

$response = Invoke-RestMethod -Uri "http://localhost:3000/api/rag/search" `
  -Method Post `
  -ContentType "application/json" `
  -Body '{"query": "test", "topK": 5}'

$stopwatch.Stop()
Write-Host "Response time: $($stopwatch.ElapsedMilliseconds)ms"
```

**담당**: Backend 개발자 + QA  
**상태**: ⬜ 미완료

---

#### P4-02-B: 부하 테스트 시나리오

**테스트 조건**:

- 동시 사용자: 5명 (Hobby Tier 기준)
- 테스트 시간: 5분
- 요청 패턴: 혼합 (검색 60%, 평가 30%, 채팅 10%)

**성능 기준**:
| 지표 | 목표 |
|------|------|
| 평균 응답 시간 | < 2000ms |
| P95 응답 시간 | < 3000ms |
| 에러율 | < 1% |
| 처리량 | > 10 req/min |

**담당**: Backend 개발자  
**상태**: ⬜ 미완료

---

#### P4-02-C: 병목 지점 분석

**분석 항목**:

| 구간          | 측정 방법                  | 예상 병목        |
| ------------- | -------------------------- | ---------------- |
| Supabase 쿼리 | 쿼리 실행 시간 로깅        | RLS JOIN         |
| 벡터 검색     | `vectorSearch` 함수 타이밍 | 임베딩 생성      |
| LLM 호출      | API 응답 시간              | 모델 응답 대기   |
| 네트워크      | TTFB 측정                  | Vercel Edge 지연 |

**로깅 코드 추가 예시**:

```typescript
// 성능 측정 헬퍼
function measureTime(label: string) {
  const start = performance.now();
  return {
    end: () => {
      const duration = performance.now() - start;
      console.log(`[Perf] ${label}: ${duration.toFixed(2)}ms`);
      return duration;
    },
  };
}

// 사용 예
const timer = measureTime("vectorSearch");
const results = await vectorSearch(query, options);
timer.end();
```

**담당**: Backend 개발자  
**상태**: ⬜ 미완료

---

## 📋 Phase 4.3: 보안 테스트

### P4-03: 보안 테스트

**목표**: RLS 정책, 권한 검사, 일반 보안 취약점 검증

---

#### P4-03-A: RLS 정책 테스트

**테스트 시나리오**:

| #   | 테이블            | 시나리오                  | 예상 결과 | 담당 |
| --- | ----------------- | ------------------------- | --------- | ---- |
| S1  | `user_documents`  | User A가 User B 문서 조회 | 빈 결과   | 보안 |
| S2  | `user_documents`  | User A가 User B 문서 수정 | 실패      | 보안 |
| S3  | `user_documents`  | User A가 User B 문서 삭제 | 실패      | 보안 |
| S4  | `rag_chunks`      | User A가 User B 청크 조회 | 빈 결과   | 보안 |
| S5  | `rag_templates`   | 비공개 템플릿 타인 접근   | 빈 결과   | 보안 |
| S6  | `rag_templates`   | 공개 템플릿 조회          | 성공      | 보안 |
| S7  | `evaluation_logs` | User A가 User B 평가 조회 | 빈 결과   | 보안 |

**테스트 SQL**:

```sql
-- 테스트 준비: 두 계정 필요
-- User A: (테스트 계정 1)
-- User B: (테스트 계정 2)

-- S1 테스트: User A로 인증 후 User B 문서 조회
SET request.jwt.claim.sub = '<USER_A_ID>';
SELECT * FROM user_documents WHERE user_id = '<USER_B_ID>' LIMIT 1;
-- 예상: 빈 결과 (0 rows)

-- S4 테스트: User A로 인증 후 User B 청크 조회
SET request.jwt.claim.sub = '<USER_A_ID>';
SELECT rc.* FROM rag_chunks rc
JOIN user_documents ud ON rc.document_id = ud.id
WHERE ud.user_id = '<USER_B_ID>' LIMIT 1;
-- 예상: 빈 결과 (0 rows)
```

**담당**: 보안 엔지니어  
**상태**: ⬜ 미완료

---

#### P4-03-B: API 권한 검사

**테스트 시나리오**:

| #   | API                      | 시나리오            | 예상 결과              | 담당 |
| --- | ------------------------ | ------------------- | ---------------------- | ---- |
| A1  | `/api/rag/evaluate`      | 인증 없이 호출      | 401 Unauthorized       | 보안 |
| A2  | `/api/documents/process` | 타인 문서 ID로 호출 | 403 Forbidden 또는 404 | 보안 |
| A3  | `/api/evaluations`       | 타인 평가 삭제 시도 | 실패                   | 보안 |
| A4  | `/api/chat`              | 인증 없이 호출      | 401 Unauthorized       | 보안 |

**cURL 테스트**:

```bash
# A1: 인증 없이 평가 API 호출
curl -X POST http://localhost:3000/api/rag/evaluate \
  -H "Content-Type: application/json" \
  -d '{"userText": "테스트 글"}'
# 예상: 401 Unauthorized

# A2: 타인 문서 ID로 처리 요청
curl -X POST http://localhost:3000/api/documents/process \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $USER_A_TOKEN" \
  -d '{"documentId": "<USER_B_DOCUMENT_ID>"}'
# 예상: 403 또는 404
```

**담당**: 보안 엔지니어  
**상태**: ⬜ 미완료

---

#### P4-03-C: OWASP Top 10 체크리스트

| #   | 취약점                    | 확인 항목                      | 상태 |
| --- | ------------------------- | ------------------------------ | ---- |
| 1   | Broken Access Control     | RLS 정책, API 권한 검사        | ⬜   |
| 2   | Cryptographic Failures    | HTTPS 사용, 민감 데이터 암호화 | ⬜   |
| 3   | Injection                 | SQL 파라미터화, 입력 검증      | ⬜   |
| 4   | Insecure Design           | 권한 검사 로직                 | ⬜   |
| 5   | Security Misconfiguration | 환경 변수 노출 확인            | ⬜   |
| 6   | Vulnerable Components     | 의존성 취약점 스캔 (npm audit) | ⬜   |
| 7   | Auth Failures             | 세션 관리, 토큰 만료           | ⬜   |
| 8   | Data Integrity            | 입력 검증, CSRF 방지           | ⬜   |
| 9   | Logging & Monitoring      | 보안 이벤트 로깅               | ⬜   |
| 10  | SSRF                      | 외부 URL 호출 제한             | ⬜   |

**취약점 스캔 명령**:

```powershell
cd frontend
npm audit
npx snyk test  # Snyk 설치 필요
```

**담당**: 보안 엔지니어  
**상태**: ⬜ 미완료

---

## 📋 Phase 4.4: 문서화

### P4-04: 문서화 업데이트

**목표**: README, API 문서 최신화

---

#### P4-04-A: README 업데이트

**업데이트 항목**:

| 섹션                | 내용                                 | 상태 |
| ------------------- | ------------------------------------ | ---- |
| 프로젝트 설명       | RAG + Template Builder 아키텍처 반영 | ⬜   |
| 설치 방법           | 환경 변수 목록 업데이트              | ⬜   |
| 기능 목록           | v3 평가 시스템, Template 기능 추가   | ⬜   |
| 아키텍처 다이어그램 | 새 구조 반영                         | ⬜   |
| Feature Flags       | 플래그 목록 및 설명 추가             | ⬜   |

**템플릿**:

```markdown
## 🏛️ 아키텍처

### RAG 기반 계층 구조
```

[사용자] → [Frontend] → [API Layer]
↓
┌─────────────────┐
│ RAG Foundation │
│ ┌───────────┐ │
│ │rag_chunks│ │
│ │user_docs │ │
│ │templates │ │
│ └───────────┘ │
└─────────────────┘
↓
┌─────────────────┼─────────────────┐
▼ ▼ ▼
[글쓰기 기능] [평가 기능] [채팅 기능]

```

### Feature Flags

| 플래그 | 환경 변수 | 기본값 | 설명 |
|--------|----------|--------|------|
| v3 평가 | ENABLE_PIPELINE_V5 | true | v3 평가 시스템 사용 |
| Template 채팅 | USE_TEMPLATE_FOR_CHAT | false | 채팅에 템플릿 컨텍스트 추가 |
| 인용 표시 | ENABLE_SOURCE_CITATIONS | true | 평가 결과에 원문 인용 |
```

**담당**: 문서 담당자  
**상태**: ⬜ 미완료

---

#### P4-04-B: API 문서 업데이트

**문서화 대상 API**:

| API                          | 문서화 상태 | 업데이트 필요        |
| ---------------------------- | ----------- | -------------------- |
| `/api/rag/evaluate`          | ⬜          | v3 파라미터 추가     |
| `/api/rag/evaluate-holistic` | ⬜          | 신규 문서화          |
| `/api/rag/evaluate-single`   | ⬜          | 템플릿 지원 추가     |
| `/api/rag/search`            | ⬜          | 카테고리 격리 추가   |
| `/api/chat`                  | ⬜          | 템플릿 컨텍스트 추가 |
| `/api/documents/process`     | ⬜          | 상태 확인            |

**API 문서 형식** (예시):

````markdown
## POST /api/rag/evaluate

### 설명

사용자 글을 평가하고 피드백을 제공합니다.

### 요청 헤더

| 헤더          | 필수 | 설명             |
| ------------- | ---- | ---------------- |
| Authorization | ✅   | Bearer 토큰      |
| Content-Type  | ✅   | application/json |

### 요청 본문

| 필드       | 타입    | 필수 | 설명                               |
| ---------- | ------- | ---- | ---------------------------------- |
| userText   | string  | ✅   | 평가할 글 (50자 이상)              |
| useV3      | boolean | ❌   | v3 평가 시스템 사용 (기본값: true) |
| templateId | string  | ❌   | 사용할 템플릿 ID                   |
| category   | string  | ❌   | 카테고리 필터                      |

### 응답

```json
{
  "success": true,
  "v3Result": {
    "document_id": "...",
    "template_id": "...",
    "evaluated_at": "2025-12-29T...",
    "overall_score": 75,
    "judgments": [...],
    "upgrade_plans": [...]
  }
}
```
````

````

**담당**: 문서 담당자
**상태**: ⬜ 미완료

---

## 📋 Phase 4.5: Walkthrough 작성

### P4-05: Walkthrough 작성

**목표**: 리팩토링 결과 요약 문서

---

#### P4-05-A: Walkthrough 문서 구조

**파일명**: `plan_report/2512XX_Architecture_Refactoring_Walkthrough.md`

**문서 구조**:
```markdown
# 🎯 Architecture Refactoring Walkthrough

## 📋 프로젝트 개요
- 목표: RAG 기반 계층 재정비, Template Builder 도입
- 기간: 2025-12-29 ~ ?
- 참여자: [담당자 목록]

## 🔄 변경 사항 요약

### Phase 0: Critical 에러 수정
- [x] RLS 정책 적용
- [x] RPC 반환 타입 수정
- 소요 시간: ?

### Phase 1: RAG 기반 계층 재정비
- [x] 스키마 문서화
- [x] 타입 동기화
- 소요 시간: ?

### Phase 2: Template Builder 구조 도입
- [x] rag_rules 테이블
- [x] rag_examples 테이블
- [x] rag_templates 테이블
- 소요 시간: ?

### Phase 3: 기존 기능 연결
- [x] Feature Flag 시스템
- [x] 평가 API Template 연결
- [x] 채팅 API Template 연결
- 소요 시간: ?

### Phase 4: 검증 및 완료
- [x] E2E 테스트 통과
- [x] 성능 목표 달성
- [x] 보안 테스트 통과
- 소요 시간: ?

## 📊 성과 지표 (KPI)

| 지표 | 리팩토링 전 | 리팩토링 후 | 개선율 |
|------|-----------|-----------|--------|
| RPC 함수 변경 빈도 | 주 2~3회 | ? | ? |
| 스키마 관련 에러 | 주 5건 | ? | ? |
| P95 응답 시간 | 측정 필요 | ? | ? |
| 인용 기반 평가 비율 | 0% | ? | ? |

## 🖼️ 스크린샷/화면 캡처
- 평가 결과 화면
- 채팅 응답 화면
- 관리자 템플릿 화면 (미래)

## 📝 교훈 및 후속 과제

### 잘된 점
- ...

### 개선할 점
- ...

### 후속 과제
- [ ] Template Builder UI
- [ ] Gate-Keeper 자동화
- [ ] 성능 최적화
````

**담당**: 문서 담당자 + 전체 팀  
**상태**: ⬜ 미완료

---

## ✅ Phase 4 완료 기준 (마스터 플랜과 동기화)

### 핵심 검증 기준 ⭐

- [ ] **E2E 테스트 전체 통과** - 문서 업로드 → 처리 → 검색 → 평가 → 채팅
- [ ] **성능 목표 달성** - P95 응답 시간 < 3000ms
- [ ] **보안 테스트 통과** - RLS 정책 100% 검증

### 세부 완료 항목

- [ ] E2E 시나리오 테스트 완료 (P4-01)
- [ ] 성능 측정 및 목표 달성 확인 (P4-02)
- [ ] RLS 및 API 권한 테스트 완료 (P4-03)
- [ ] README 및 API 문서 업데이트 (P4-04)
- [ ] Walkthrough 문서 작성 (P4-05)

---

## 📊 성공 기준 (KPI) - 마스터 플랜 참조

| 지표                   | 현재        | 목표        | 측정 결과  |
| ---------------------- | ----------- | ----------- | ---------- |
| RPC 함수 변경 빈도     | 주 2~3회    | 월 1회 미만 | ⬜ 측정 중 |
| 스키마 관련 에러       | 주 5건 이상 | 주 1건 미만 | ⬜ 측정 중 |
| 평가 API P95 응답 시간 | 측정 필요   | < 3000ms    | ⬜ 측정 중 |
| 인용 기반 평가 비율    | 0%          | 80% 이상    | ⬜ 측정 중 |

---

## 📊 진행률

```
Phase 4.1: E2E 테스트
  P4-01-A [⬜] 문서 업로드 및 처리 테스트
  P4-01-B [⬜] 검색 기능 테스트
  P4-01-C [⬜] 평가 기능 테스트
  P4-01-D [⬜] 채팅 기능 테스트
  P4-01-E [⬜] E2E 통합 시나리오

Phase 4.2: 성능 테스트
  P4-02-A [⬜] API 응답 시간 측정
  P4-02-B [⬜] 부하 테스트 시나리오
  P4-02-C [⬜] 병목 지점 분석

Phase 4.3: 보안 테스트
  P4-03-A [⬜] RLS 정책 테스트
  P4-03-B [⬜] API 권한 검사
  P4-03-C [⬜] OWASP Top 10 체크리스트

Phase 4.4: 문서화
  P4-04-A [⬜] README 업데이트
  P4-04-B [⬜] API 문서 업데이트

Phase 4.5: Walkthrough 작성
  P4-05-A [⬜] Walkthrough 문서 작성

완료: 0/14 (0%)
```

---

## 🚀 다음 단계

Phase 4 완료 후:

1. **운영 모니터링** - 배포 후 1주일간 집중 모니터링
2. **피드백 수집** - 사용자 피드백 기반 개선점 도출
3. **후속 개발** - Template Builder UI, Gate-Keeper 자동화

---

## 📚 참조 문서

- [마스터 플랜](./2512290307_Architecture_Refactoring_Master_Plan.md)
- [Phase 0 체크리스트](./2512290313_Phase0_Critical_Fix_Checklist.md)
- [Phase 1 체크리스트](./2512290313_Phase1_RAG_Foundation_Checklist.md)
- [Phase 2 체크리스트](./2512290319_Phase2_Template_Builder_Checklist.md)
- [Phase 3 체크리스트](./2512290651_Phase3_Feature_Integration_Checklist.md)
