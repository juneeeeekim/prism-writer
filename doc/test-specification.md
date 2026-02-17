# Test Specification

> PRISM Writer 테스트 시나리오, 엣지 케이스, 테스트 설정 명세
> 최종 갱신: 2026-02-14

---

## 목차

1. [테스트 인프라](#1-테스트-인프라)
2. [유닛 테스트 — RAG Pipeline](#2-유닛-테스트--rag-pipeline)
3. [유닛 테스트 — LLM Gateway](#3-유닛-테스트--llm-gateway)
4. [유닛 테스트 — Document Processor](#4-유닛-테스트--document-processor)
5. [E2E 테스트](#5-e2e-테스트)
6. [통합 테스트 (LLM Test API)](#6-통합-테스트)
7. [엣지 케이스 & 경계값](#7-엣지-케이스--경계값)
8. [테스트 실행 방법](#8-테스트-실행-방법)

---

## 1. 테스트 인프라

### 프레임워크

| 종류 | 프레임워크 | 설정 파일 |
|------|------------|-----------|
| 유닛 테스트 | Vitest | `frontend/vitest.config.ts` |
| E2E 테스트 | Playwright | `frontend/playwright.config.ts` |
| 백엔드 테스트 | Pytest | `backend/pytest.ini` |

### 테스트 파일 목록 (총 11개)

**유닛 테스트 (9)**

| 파일 | 대상 모듈 |
|------|-----------|
| `lib/rag/__tests__/chunking.test.ts` | 문서 청킹 & 타입 분류 |
| `lib/rag/__tests__/citationGate.test.ts` | 인용 검증 |
| `lib/rag/__tests__/judgeParser.test.ts` | Judge 응답 파싱 |
| `lib/rag/__tests__/patchPerformance.test.ts` | 패치 성능 부하 테스트 |
| `lib/rag/__tests__/p1_verification.test.ts` | P1 Phase 검증 |
| `lib/rag/__tests__/dod-retrieval-pipeline.test.ts` | DoD 검색 파이프라인 |
| `lib/rag/__tests__/regression-retrieval-pipeline.test.ts` | 회귀 테스트 |
| `lib/rag/documentProcessor.test.ts` | 문서 처리 파이프라인 |
| `lib/llm/__tests__/gateway.test.ts` | LLM 게이트웨이 |

**E2E 테스트 (2)**

| 파일 | 시나리오 |
|------|----------|
| `e2e/writer-flow.spec.ts` | 글쓰기 전체 흐름 |
| `e2e/rag-status.spec.ts` | RAG 처리 상태 시각화 |

---

## 2. 유닛 테스트 — RAG Pipeline

### 2.1 chunking.test.ts

파일: `frontend/src/lib/rag/__tests__/chunking.test.ts`

| 테스트 케이스 | 입력 | 예상 결과 |
|---------------|------|-----------|
| 규칙 텍스트 분류 | `"반드시 ~해야 합니다"` | `chunk_type: 'rule'` |
| 예시 텍스트 분류 | `"예를 들어, ~와 같이"` | `chunk_type: 'example'` |
| 일반 텍스트 분류 | `"일반적인 문장"` | `chunk_type: 'general'` |
| 시맨틱 청킹 | 복수 문단 텍스트 | 문단 단위 분리, 메타데이터 포함 |

**검증 함수**: `classifyChunkType()`, `semanticChunk()`

### 2.2 citationGate.test.ts

파일: `frontend/src/lib/rag/__tests__/citationGate.test.ts`

| 테스트 케이스 | 입력 | 예상 결과 |
|---------------|------|-----------|
| 정확한 인용 검증 | 원문에 존재하는 인용문 | `verified: true` |
| 부정확한 인용 | 원문에 없는 인용문 | `verified: false` |
| 유사도 기반 매칭 | 약간 변형된 인용문 | Jaccard ≥ 0.7 시 `true` |
| 배치 검증 | 복수 인용문 배열 | 각각의 검증 결과 배열 |
| 검증 요약 | 검증 결과 목록 | `{ total, valid, invalid, averageScore }` |
| 인용 마커 탐지 | `"[1] 참고"` | `hasCitationMarkers: true` |

**검증 함수**: `verifyCitation()`, `verifyAllCitations()`, `summarizeCitationVerification()`

### 2.3 judgeParser.test.ts

파일: `frontend/src/lib/rag/__tests__/judgeParser.test.ts`

| 테스트 케이스 | 입력 | 예상 결과 |
|---------------|------|-----------|
| 정상 JSON 파싱 | `{"verdict":"pass","score":85,...}` | 정상 파싱 |
| 코드 블록 내 JSON | ````json { ... }` ``` | 마크다운 제거 후 파싱 |
| 잘못된 verdict | `{"verdict":"unknown"}` | 기본값 fallback |
| 점수 범위 초과 | `{"score": 150}` | 0~100 범위 클램핑 |
| 빈 응답 | `""` | 안전한 기본값 반환 |
| Safe 파싱 | 모든 입력 | 절대 throw하지 않음 |

**검증 함수**: `parseJudgeResponse()`, `parseJudgeResponseSafe()`

### 2.4 patchPerformance.test.ts

파일: `frontend/src/lib/rag/__tests__/patchPerformance.test.ts`

| 테스트 케이스 | 설정 | 합격 기준 |
|---------------|------|-----------|
| 10개 동시 패치 생성 | LLM 500ms, 검색 100ms 시뮬레이션 | 5초 이내 완료 |

### 2.5 p1_verification.test.ts

P1 Phase 완료 검증 테스트.

**Happy Path (HP)**

| ID | 테스트 | 검증 항목 |
|----|--------|-----------|
| HP-1 | Citation Gate Happy Path | 인용 검증 → 올바른 인용은 `valid: true` |
| HP-2 | Patch Staging Happy Path | 패치 → `status: 'pending'`, 적용 → `'applied'` |
| HP-3 | Evidence Quality Happy Path | 증거 품질 → `grade: 'high'` (score ≥ 0.8) |

**Edge Cases (EC)**

| ID | 테스트 | 입력 | 예상 |
|----|--------|------|------|
| EC-1 | 빈 인용문 검증 | `quote: ""` | `valid: false` |
| EC-2 | 빈 청크 배열 | `chunks: []` | `valid: false` |
| EC-3 | 점수 0 증거 | `score: 0` | `grade: 'low'` |
| EC-4 | 패치 거절 | `status: 'rejected'` | 원문 유지 |
| EC-5 | Unicode 텍스트 | 한국어/이모지 포함 | 정상 처리 |

### 2.6 dod-retrieval-pipeline.test.ts

DoD (Definition of Done) 검색 파이프라인 검증.

| ID | 테스트 | 검증 항목 |
|----|--------|-----------|
| R-05 | Query Builder | `buildSearchQueries()` → 3종 쿼리 생성 (rule, example, pattern) |
| R-06 | Sufficiency Gate | `checkSufficiency()` → 결과 충분성 판단 |
| R-07 | CriteriaPack 스키마 | 필수 필드 존재 확인 (queries, evidence, gates, metadata) |
| R-08 | CriteriaPack Builder | 빌더로 완전한 CriteriaPack 생성 |

### 2.7 regression-retrieval-pipeline.test.ts

리팩토링 후 회귀 방지 테스트.

| 테스트 | 검증 항목 |
|--------|-----------|
| verifyCitation 회귀 | 함수 시그니처 및 반환 타입 보존 |
| SearchResult 타입 | 필수 필드 (`id`, `content`, `score`, `metadata`) 존재 |
| SearchOptions 타입 | `userId`, `topK` 필드 존재 |
| HybridSearchOptions 타입 | `vectorWeight`, `keywordWeight` 필드 존재 |

---

## 3. 유닛 테스트 — LLM Gateway

파일: `frontend/src/lib/llm/__tests__/gateway.test.ts`

| 테스트 케이스 | 검증 항목 |
|---------------|-----------|
| `generateText()` 기본 호출 | 텍스트 생성 성공, 토큰 사용량 반환 |
| 모델 선택 | 요청된 모델 ID가 프로바이더에 전달됨 |
| 폴백 모델 | 기본 모델 실패 시 폴백 모델 사용 |
| `generateTextStream()` | AsyncGenerator로 청크 반환, `done: true`로 종료 |
| `isLLMAvailable()` | API 키 존재 시 `true`, 없으면 `false` |
| 프로바이더 모킹 | Gemini/OpenAI/Anthropic 프로바이더 각각 테스트 |

---

## 4. 유닛 테스트 — Document Processor

파일: `frontend/src/lib/rag/documentProcessor.test.ts`

### Mock 의존성

```typescript
vi.mock('@/lib/supabase/client')   // Supabase 클라이언트
vi.mock('./chunking')               // 청킹 모듈
vi.mock('./embedding')              // 임베딩 모듈
vi.mock('./costGuard')              // 비용 관리
```

| 테스트 케이스 | 입력 | 예상 결과 |
|---------------|------|-----------|
| 정상 처리 | 유효한 문서 ID | 상태: PARSING → CHUNKING → EMBEDDING → COMPLETED |
| 다운로드 실패 | Storage 오류 | `success: false`, 상태: FAILED |
| 빈 문서 | 내용 없는 파일 | `error: '문서 내용이 비어있습니다.'` |
| 동시 처리 | 3개 문서 동시 | 12번 상태 업데이트 (4 × 3) |
| 느린 임베딩 | 100ms 지연 | 정상 완료 (타임아웃 없음) |

### 상태 전이 검증

```
PENDING → PARSING → CHUNKING → EMBEDDING → COMPLETED
                                          ↘ FAILED (에러 시)
```

---

## 5. E2E 테스트

### 5.1 writer-flow.spec.ts

파일: `frontend/e2e/writer-flow.spec.ts`

| 시나리오 | 액션 | 검증 |
|----------|------|------|
| 홈페이지 접근 | `goto('/')` | 페이지 로드 성공 |
| 에디터 진입 | `/editor` 이동 | Dual Pane 레이아웃 렌더링 |
| 목차 생성 | Outline 탭 클릭 → 주제 입력 → 생성 | 목차 항목 표시 |
| 탭 전환 | Outline → References → Chat | 각 탭 콘텐츠 렌더링 |
| 키보드 네비게이션 | Tab, Enter 키 | 접근성 동작 확인 |
| API 헬스체크 | `GET /health` | `status: 200` |
| 목차 생성 API | `POST /v1/outline/generate` | 응답 구조 검증 |

### 5.2 rag-status.spec.ts

파일: `frontend/e2e/rag-status.spec.ts`

| 시나리오 | Mock 설정 | 검증 |
|----------|-----------|------|
| 업로드 후 처리 트리거 | Upload → `{ documentId: 'doc-new-123' }` | Process API 호출됨 |
| 올바른 문서 ID 전달 | - | `postData.documentId === 'doc-new-123'` |

---

## 6. 통합 테스트 (LLM Test API)

엔드포인트: `POST /api/llm/test`

내장된 통합 테스트 스위트를 API로 실행합니다.

| 테스트 | 대상 | 검증 |
|--------|------|------|
| LLM 연결 테스트 | Gemini API 키 | API 호출 성공 |
| 텍스트 생성 | 샘플 프롬프트 | 비어있지 않은 응답 |
| JSON 파싱 | Judge 형식 응답 | 유효한 JSON 파싱 |
| 검색 연동 | RAG 검색 + 응답 | 검색 결과 포함 응답 |
| 스트리밍 | 스트림 생성 | 청크 수신 확인 |

**응답 형식**

```typescript
{
  success: boolean
  totalTests: 5
  passed: 5       // 성공 수
  failed: 0       // 실패 수
  skipped: 0      // 건너뛴 수
  results: [
    {
      testName: "LLM Connection",
      status: "pass",
      message: "Connected to gemini-3-flash-preview",
      duration: 1234   // ms
    },
    // ...
  ]
}
```

---

## 7. 엣지 케이스 & 경계값

### 7.1 텍스트 입력 경계

| 케이스 | 값 | 예상 동작 |
|--------|-----|-----------|
| 최소 평가 텍스트 | 50자 미만 | `400 Bad Request` |
| 최대 평가 텍스트 | 50,000자 초과 | `400 Bad Request` |
| 빈 문자열 | `""` | 에러 반환 |
| Unicode 텍스트 | 한국어, 이모지, CJK | 정상 처리 |
| HTML 인젝션 | `<script>alert(1)</script>` | 이스케이프 처리 |

### 7.2 파일 업로드 경계

| 케이스 | 값 | 예상 동작 |
|--------|-----|-----------|
| 최대 파일 크기 | 50 MB 초과 | `400 Bad Request` |
| 미지원 파일 타입 | `.exe`, `.zip` | `400 Bad Request` |
| 빈 파일 | 0 바이트 | `400 Bad Request` |
| 파일명 특수문자 | `파일 이름 (1).pdf` | 정상 처리 |

### 7.3 검색 경계

| 케이스 | 값 | 예상 동작 |
|--------|-----|-----------|
| topK 최대값 | 20 초과 | 20으로 클램핑 |
| threshold 범위 | 0.0~1.0 범위 초과 | 클램핑 |
| 빈 검색 쿼리 | `""` | `400 Bad Request` |
| 문서 없는 프로젝트 | 청크 0개 | 빈 결과 반환 |

### 7.4 인증 경계

| 케이스 | 예상 동작 |
|--------|-----------|
| 만료된 세션 | `401 Unauthorized` |
| pending 역할 + /editor | `/profile`로 리다이렉트 |
| 타인의 문서 접근 | RLS에 의해 빈 결과 |
| admin 전용 경로 + free 역할 | `/profile`로 리다이렉트 |

### 7.5 LLM 응답 경계

| 케이스 | 예상 동작 |
|--------|-----------|
| 빈 LLM 응답 | 기본값 반환 (graceful degradation) |
| 잘못된 JSON | `sanitizeJSON()` 후 재파싱, 실패 시 기본값 |
| API Rate Limit | 에러 로깅 + 사용자에게 재시도 안내 |
| 네트워크 타임아웃 | 에러 상태 반환 |

---

## 8. 테스트 실행 방법

### 유닛 테스트

```bash
cd frontend

# 전체 실행
npm run test

# 특정 파일
npx vitest run src/lib/rag/__tests__/chunking.test.ts

# Watch 모드
npx vitest watch

# 커버리지
npx vitest run --coverage
```

### E2E 테스트

```bash
cd frontend

# 전체 실행 (브라우저 자동 실행)
npm run test:e2e

# 특정 파일
npx playwright test e2e/writer-flow.spec.ts

# UI 모드 (디버깅)
npx playwright test --ui

# 헤드리스 모드
npx playwright test --headed
```

### 백엔드 테스트

```bash
cd backend

# 전체 실행
pytest

# 커버리지
pytest --cov

# 특정 파일
pytest tests/test_outline.py -v
```

### CI 환경

```bash
# CI에서는 재시도 + 단일 워커
CI=true npx playwright test
CI=true npx vitest run
```
