# Error Handling Reference

> PRISM Writer 전체 에러 처리 체계 레퍼런스
> 에러 코드, 발생 조건, 사용자 메시지, 복구 전략을 포함합니다.

---

## 1. API 에러 코드 체계

### 1.1 에러 코드 상수 (`types/api.ts`)

| 코드 | HTTP Status | 사용자 메시지 (기본값) | 발생 조건 |
|------|-------------|----------------------|----------|
| `UNAUTHORIZED` | 401 | `로그인이 필요합니다.` | 인증 토큰 없음/만료 |
| `FORBIDDEN` | 403 | `접근 권한이 없습니다.` | 인증됨이나 권한 부족 (role 불일치) |
| `NOT_FOUND` | 404 | `요청한 리소스를 찾을 수 없습니다.` | 프로젝트/문서/세션 미존재 |
| `BAD_REQUEST` | 400 | (컨텍스트별 상이) | 요청 데이터 누락/형식 오류 |
| `VALIDATION_ERROR` | 422 | (컨텍스트별 상이) | Pydantic/Zod 유효성 검증 실패 |
| `RATE_LIMITED` | 429 | `요청 횟수를 초과했습니다. 잠시 후 다시 시도해주세요.` | LLM API 레이트 리밋 |
| `INTERNAL_ERROR` | 500 | `서버 오류가 발생했습니다.` / `알 수 없는 오류가 발생했습니다.` | 미분류 예외 |

### 1.2 표준 에러 응답 형식

```typescript
// ApiErrorResponse
{
  success: false,
  error: {
    code: ErrorCode,        // 'UNAUTHORIZED' | 'NOT_FOUND' | ...
    message: string,        // 사용자 친화적 메시지 (한국어)
    details?: unknown,      // 개발자용 상세 정보 (선택)
  }
}

// ApiSuccessResponse<T>
{
  success: true,
  data?: T,
  message?: string,
}
```

### 1.3 에러 핸들러 유틸리티 (`lib/api/errorHandler.ts`)

| 함수 | 시그니처 | 용도 |
|------|---------|------|
| `handleApiError` | `(error: unknown, context?: string) → NextResponse<ApiErrorResponse>` | 범용 에러 → 표준 응답 변환. error.message 키워드로 에러 유형 자동 분류 |
| `createErrorResponse` | `(code: ErrorCode, message: string, details?: unknown) → NextResponse` | 에러 코드 + 메시지 → JSON 응답 생성 |
| `createSuccessResponse` | `<T>(data?: T, message?: string) → NextResponse` | 성공 응답 생성 |
| `unauthorizedResponse` | `(message?) → NextResponse` | 401 숏컷 |
| `forbiddenResponse` | `(message?) → NextResponse` | 403 숏컷 |
| `notFoundResponse` | `(message?) → NextResponse` | 404 숏컷 |
| `badRequestResponse` | `(message, details?) → NextResponse` | 400 숏컷 |

**자동 분류 로직** (`handleApiError` 내부):

```
error.message 포함                → 에러 코드
─────────────────────────────────────────────
'unauthorized' | 'authentication' → UNAUTHORIZED
'not found'                       → NOT_FOUND
'rate limit'                      → RATE_LIMITED
기타 Error 인스턴스                → INTERNAL_ERROR (error.message를 details에 포함)
non-Error 객체                     → INTERNAL_ERROR ('알 수 없는 오류')
```

---

## 2. 문서 처리 에러 (`lib/rag/documentProcessor.ts`)

### 2.1 문서 처리 상태 머신 (DocumentStatus)

```
PENDING → PARSING → CHUNKING → EMBEDDING → COMPLETED
                                              ↓ (실패 시)
                                           FAILED
```

### 2.2 에러 유형 및 사용자 메시지 매핑

| 내부 에러 메시지 패턴 | 사용자 표시 메시지 | 발생 조건 |
|----------------------|-------------------|----------|
| `'비어있습니다'` 포함 | `문서 내용이 비어있습니다.` | 다운로드 성공하나 텍스트 추출 결과 빈 문자열 |
| `'청크가 생성되지'` 포함 | `텍스트를 추출할 수 없습니다.` | chunkDocument 결과 빈 배열 |
| `'Token limit'` 포함 | `일일 사용량을 초과했습니다.` | costGuard 일일 한도 초과 |
| `'스캔된 이미지'` 포함 | `스캔된 이미지 PDF는 지원되지 않습니다.` | PDF 텍스트 추출 결과 빈 문자열 (이미지 PDF) |
| `'암호화된'` 포함 | `암호화된 PDF는 지원되지 않습니다.` | pdf2json 비밀번호 에러 감지 |
| 기타 | `문서 처리 중 오류가 발생했습니다.` | 위 패턴에 해당하지 않는 모든 예외 |

### 2.3 PDF 파싱 에러 (`parsePDF`)

| 에러 조건 | 에러 메시지 | 복구 방법 |
|----------|-----------|----------|
| `pdfParser_dataError` + password | `암호화된 PDF는 지원되지 않습니다.` | 비밀번호 해제 후 재업로드 |
| `pdfParser_dataError` + 기타 | `PDF 파싱 실패: {parserError}` | 다른 PDF 뷰어로 열어 TXT 내보내기 |
| 텍스트 추출 결과 빈 문자열 | `SCANNED_PDF:PDF에서 텍스트를 추출할 수 없습니다...` | OCR/Vision 추출 기능 사용 안내 |
| `pdfParser_dataReady` 내 예외 | `PDF 텍스트 추출 중 오류가 발생했습니다.` | TXT/MD 형식으로 변환 후 업로드 |

### 2.4 파일 타입별 에러

| 파일 타입 | 처리 방법 | 에러 조건 |
|----------|----------|----------|
| `application/pdf` / `.pdf` | `parsePDF(buffer)` | 위 2.3 참조 |
| `text/plain` / `.txt` | `data.text()` | 다운로드 실패, 빈 내용 |
| `text/markdown` / `.md` | `data.text()` | 다운로드 실패, 빈 내용 |
| `.docx` | 미지원 | `DOCX 파일은 현재 지원되지 않습니다.` throw |
| 기타 | `data.text()` (fallback) | 경고 로그 후 텍스트 시도 |

### 2.5 에러 시 상태 업데이트 정책

- `updateDocumentStatus` 실패: **치명적이지 않음** → 로그만 남기고 throw하지 않음
- 문서 처리 실패 후 `FAILED` 상태 업데이트도 실패: 이중 catch로 보호

```typescript
try {
  await updateDocumentStatus(documentId, DocumentStatus.FAILED, userErrorMessage)
} catch (updateError) {
  console.error('Failed to update error status:', updateError)
}
```

---

## 3. 비용 관리 에러 (Cost Guard: `lib/rag/costGuard.ts`)

### 3.1 등급별 한도

| 등급 | 일일 토큰 한도 | 최대 문서 크기 | 매핑되는 role |
|------|--------------|---------------|-------------|
| `free` | 50,000 (~100쪽) | 100,000 (~200쪽) | `pending`, `free` (기본값) |
| `premium` | 500,000 (~1,000쪽) | 1,000,000 (~2,000쪽) | `premium` |
| `enterprise` | 5,000,000 (~10,000쪽) | 10,000,000 (~20,000쪽) | `special`, `admin` |

### 3.2 에러 유형

| 함수 | 에러 조건 | 에러 메시지 | 심각도 |
|------|----------|-----------|--------|
| `validateUsage` | 일일 한도 초과 | `일일 임베딩 한도를 초과했습니다. 오늘 사용량: {n} 토큰` | throw Error |
| `validateUsage` | 남은 한도 부족 | `요청한 작업이 일일 한도를 초과합니다. 남은 토큰: {n}, 필요 토큰: {m}` | throw Error |
| `validateDocumentSize` | 문서 크기 초과 | `문서 크기가 너무 큽니다. 최대 크기: {n} 토큰, 현재 크기: {m} 토큰` | throw Error |
| `checkUsage` | DB 조회 실패 | (throw 없음) | warn 로그, 사용량 0 반환 |
| `trackUsage` | 기록 실패 | (throw 없음) | error 로그만 (치명적이지 않음) |
| `getUserTier` | 프로필 조회 실패 | (throw 없음) | warn 로그, `'free'`로 기본값 처리 |

### 3.3 타입 정의

```typescript
interface UsageLimits {
  dailyTokenLimit: number
  maxDocumentSize: number
}

interface UsageStats {
  tokensUsedToday: number
  remainingTokens: number
  limitExceeded: boolean
}

type UserTier = 'free' | 'premium' | 'enterprise'
```

---

## 4. ACL 게이트 에러 (`lib/rag/aclGate.ts`)

### 4.1 에러 메시지 상수

```typescript
const ACL_ERROR_MESSAGES = {
  NO_USER: '사용자 ID가 필요합니다.',
  NO_DOCUMENTS: '접근 가능한 문서가 없습니다.',
  FETCH_ERROR: '문서 목록 조회 중 오류가 발생했습니다.',
}
```

### 4.2 검증 결과 흐름

| 조건 | `valid` | `allowedDocumentIds` | `error` |
|------|---------|---------------------|---------|
| userId 없음 | `false` | `[]` | `NO_USER` |
| isAdmin === true | `true` | `[]` (필터 없음 의미) | - |
| DB 조회 성공 + 문서 있음 | `true` | `[doc-id-1, ...]` | - |
| DB 조회 성공 + 문서 없음 | `true` | `[]` | - (빈 결과, 에러 아님) |
| DB 조회 실패 | `false` | `[]` | `FETCH_ERROR: {message}` |
| 예외 발생 | `false` | `[]` | `FETCH_ERROR: {message}` |

---

## 5. Sufficiency Gate 에러 (`lib/rag/sufficiencyGate.ts`)

### 5.1 상수

| 상수 | 값 | 설명 |
|------|---|------|
| `MIN_SCORE_THRESHOLD` | 0.5 | 유의미한 근거 최소 유사도 |
| `MIN_CHUNK_COUNT` | 1 | 최소 유의미 근거 수 |
| `HIGH_CONFIDENCE_THRESHOLD` | 0.75 | 강한 근거 판정 기준 |

### 5.2 충분성 판정 결과 (`SufficiencyResult`)

```typescript
interface SufficiencyResult {
  sufficient: boolean              // 근거 충분 여부
  reason: string                   // 판정 사유
  best_score: number              // 최고 유사도 점수
  chunk_count: number             // 유의미 청크 수
  confidence_level: 'high' | 'medium' | 'low' | 'none'
}
```

### 5.3 판정 흐름

| 입력 조건 | `sufficient` | `confidence_level` | `reason` |
|----------|-------------|-------------------|---------|
| `searchResults === null` | `allowEmpty` | `'none'` | `검색 결과 없음 (null)` |
| `searchResults.length === 0` | `allowEmpty` | `'none'` | `검색 결과 없음` |
| 유의미 결과 < minChunkCount | `false` | 계산값 | `유의미한 근거 부족 ({n}/{m}개)` |
| 유의미 결과 >= minChunkCount | `true` | 계산값 | `근거 충분` |

### 5.4 신뢰도 등급 계산

```
bestScore >= 0.75 && chunkCount >= 2  → 'high'
bestScore >= 0.50 && chunkCount >= 2  → 'medium'
bestScore >= 0.50 && chunkCount < 2   → 'low'
bestScore < 0.50                      → 'low'
chunkCount === 0 || bestScore === 0   → 'none'
```

---

## 6. Citation Gate 에러 (`lib/rag/citationGate.ts`)

### 6.1 상수

| 상수 | 값 | 설명 |
|------|---|------|
| `SIMILARITY_THRESHOLD` | 0.7 (70%) | 매칭 판정 임계값 (2026-01-03 60%→70% 상향) |
| `MIN_PARTIAL_MATCH_LENGTH` | 10 | 부분 매칭 허용 최소 문자열 길이 |
| `CITATION_MARKER_BONUS` | 0.15 | 인용 마커 가산점 (+15%) |

### 6.2 검증 결과 (`CitationVerifyResult`)

```typescript
interface CitationVerifyResult {
  valid: boolean           // 검증 성공 여부
  matchedChunkId?: string  // 매칭된 청크 ID
  matchScore: number       // 매칭 점수 (0~1)
}
```

### 6.3 매칭 로직

```
1. 정확한 부분 문자열 매칭      → matchScore: 1.0 (즉시 반환)
2. 부분 매칭 점수 × 0.7 + Jaccard 유사도 × 0.3 → combinedScore
3. combinedScore >= 0.7       → valid: true
4. combinedScore < 0.7        → valid: false
```

### 6.4 인용 마커 패턴

```typescript
// [1], [2], ... [9] 또는 [참고 자료 1] 패턴 감지
const citationPattern = /\[\d+\]|\[참고\s*자료\s*\d+\]/g
```

---

## 7. Template Gates 에러 (`lib/rag/templateGates.ts`)

### 7.1 Gate 공통 결과 타입

```typescript
interface GateResult {
  passed: boolean
  reason: string
  score: number  // 0.0 ~ 1.0
}

interface AllGatesResult {
  passed: boolean
  citationResult: GateResult
  consistencyResult: GateResult
  hallucinationResult: GateResult
  regressionResult?: GateResult  // Pipeline v4+
  finalScore: number
}
```

### 7.2 Gate별 에러 처리 전략

| Gate | 정상 실패 | LLM 에러 시 | API Key 없음 시 |
|------|----------|------------|----------------|
| **Citation Gate** | `passed: false, score: 0.0` (인용문/예시 없음) | N/A (LLM 미사용) | N/A |
| **Consistency Gate** | `passed: false` (LLM 판정) | `passed: true, score: 0.5` (보수적 통과) | `passed: true, score: 0.5` (건너뜀) |
| **Hallucination Gate** | `passed: false` (LLM 판정) | `passed: true, score: 0.5` (보수적 통과) | `passed: true, score: 0.5` (건너뜀) |
| **Regression Gate** | `passed: false` (편차 초과) | `passed: true, score: 0.5` (보수적 통과) | `passed: true, score: 0.5` (건너뜀) |

**핵심 원칙**: LLM 호출 실패 시 **보수적으로 통과 처리** (시스템 장애로 인한 블락 방지)

### 7.3 Regression Gate 상세 에러

| 조건 | `passed` | `score` | `reason` |
|------|---------|---------|---------|
| 이전 버전 없음 (신규 템플릿) | `true` | 1.0 | `New template (no previous version)` |
| 검증 샘플 없음 | `true` | 0.8 | `No validation samples available` |
| 편차 허용 범위 내 (±10%) | `true` | `max(0.5, 1-avgDeviation)` | `All {n} samples within ±10% tolerance` |
| 편차 초과 | `false` | `max(0, 1-avgDeviation)` | `{n} samples exceeded ±10% tolerance` |

---

## 8. Patch Gates 에러 (Pipeline v5: `lib/rag/patchGates.ts`)

### 8.1 Diff Safety Gate

| 조건 | `passed` | `score` | 메시지 |
|------|---------|---------|--------|
| 변경량 > maxChangeRatio (20%) | `false` | `max(0, 1 - changeRatio)` | `변경량이 {n}%로 상한(20%)을 초과했습니다.` |
| warningThreshold (15%) < 변경량 ≤ 20% | `true` | 감점 적용 | `변경량 {n}% (경고 수준이지만 허용됨)` |
| 변경량 ≤ 15% | `true` | 1.0 | `변경량 {n}% (안전 범위)` |

**설정값** (`DiffSafetyConfig`):

```typescript
{
  maxChangeRatio: 0.2,    // 최대 변경 비율 20%
  warningThreshold: 0.15, // 경고 임계값 15%
}
```

### 8.2 Upgrade Effect Gate

| 조건 | `passed` | `score` | 메시지 |
|------|---------|---------|--------|
| `overallScoreDelta ≤ 0` | `false` | 0 | `패치 적용 시 {delta}점 (개선 효과 없음)` |
| `0 < delta < 1` | `true` | `0.5 + (delta * 0.5)` | `패치 적용 시 +{delta}점 개선 (미미함)` |
| `delta ≥ 1` | `true` | `min(1.0, 0.7 + delta * 0.1)` | `패치 적용 시 +{delta}점 개선` |

### 8.3 통합 Gate 가중 평균 (`unifyGateResults`)

| Gate | 가중치 | 설명 |
|------|--------|------|
| Citation | 1.0 | 기본 |
| Consistency | 1.0 | 기본 |
| Hallucination | **1.2** | 환각은 더 중요 |
| Regression | 0.8 | |
| Diff Safety | 1.0 | 기본 |
| Upgrade Effect | 0.8 | |

**Pipeline 버전별 Gate 포함 범위**:

```
v3: Citation + Consistency + Hallucination
v4: v3 + Regression
v5: v4 + Diff Safety + Upgrade Effect
```

---

## 9. Hallucination Detector 에러 (`lib/rag/hallucinationDetector.ts`)

### 9.1 환각 유형

```typescript
type HallucinationType = 'evasion' | 'fabrication' | 'none'
```

### 9.2 회피형 환각 패턴 (Evasion Patterns)

| 패턴 | 신뢰도 | 설명 |
|------|--------|------|
| `참고 자료에 (관련) 내용이 없` | 0.90 | 명시적 회피 |
| `제공된 자료에는? (관련) 내용이? 없` | 0.90 | 명시적 회피 |
| `자료를? 찾을 수 없` | 0.85 | 명시적 회피 |
| `관련 문서가? 없` | 0.80 | 간접적 회피 |
| `참고할 (만한) 내용이? 없` | 0.75 | 간접적 회피 |
| `자료에서? (관련) 정보를? 찾지 못` | 0.75 | 간접적 회피 |
| `일반적인 (글쓰기) 방법(으로\|을)` | 0.60 | 참고 자료 무시 가능성 |
| `기본적으로 글(을)? 쓸 때` | 0.55 | 참고 자료 무시 가능성 |

### 9.3 판정 로직

```
1. hasRetrievedDocs === false → isHallucination: false (정상 - 문서 없어서 당연)
2. 패턴 순회 → confidence >= threshold(기본 0.7) → isHallucination: true, type: 'evasion'
3. 패턴 미매칭 → isHallucination: false, type: 'none'
```

### 9.4 신뢰도 분류

```
>= 0.85: 높은 확률 (high) - 거의 확실한 환각
0.70~0.84: 중간 확률 (medium) - 높은 확률의 환각
< 0.70: 낮은 확률 (low) - 수동 검증 필요
```

---

## 10. LLM Gateway 에러 (`lib/llm/gateway.ts`)

### 10.1 Fallback 전략

```
1. Primary Model 호출 시도
   ├── 성공 → 응답 반환
   └── 실패 (primaryError)
        ├── fallbackModelId 존재 (context에 매핑된 fallback)
        │    └── Fallback Model 호출 시도
        │         ├── 성공 → 응답 반환
        │         └── 실패 → throw (fallback 에러)
        └── fallbackModelId 없음
             └── throw primaryError (원래 에러 그대로)
```

### 10.2 Fallback 트리거 조건

- `options.context`가 지정된 경우에만 fallback 시도
- `llm-usage-map.ts`의 `getFallbackModel(context)` 결과가 있을 때
- Streaming (`generateTextStream`)과 일반 (`generateText`) 모두 동일 전략

### 10.3 가용성 확인 (`isLLMAvailable`)

```typescript
// 모델 설정이 없거나 Provider가 사용 불가 → false
// Provider.isAvailable() 호출 시 예외 → false
```

---

## 11. Dynamic Threshold 에러 (`lib/rag/dynamicThreshold.ts`)

### 11.1 임계값 범위

| 상수 | 값 | 설명 |
|------|---|------|
| `BASE_THRESHOLD` | 0.35 | 기본 임계값 |
| `MIN_THRESHOLD` | 0.25 | 하한 (너무 많은 노이즈 방지) |
| `MAX_THRESHOLD` | 0.45 | 상한 (관련 문서 놓침 방지) |

### 11.2 쿼리 유형별 조정

| 쿼리 유형 | 조정 | 결과 임계값 | 패턴 예시 |
|----------|------|-----------|----------|
| 추상적 질문 | `base × 0.7` | ~0.245 (min 0.25로 클램프) | `어떻게.*해야`, `방법`, `무엇`, `설명`, `알려` |
| 구체적 질문 | `base × 1.2` | ~0.42 (max 0.45로 클램프) | `공감.*정보`, `PRISM`, `기승전결`, `Hook`, `CTA` |
| 일반 질문 | 그대로 | 0.35 | 패턴 미매칭 |

### 11.3 입력 검증

```
query가 null/undefined/빈 문자열 → BASE_THRESHOLD(0.35) 반환 (에러 없음)
```

---

## 12. Model Router 에러 (`lib/rag/modelRouter.ts`)

### 12.1 Router 모드

| 모드 | answerModel | reviewerModel | 예상 시간 |
|------|-----------|--------------|----------|
| `cheap` | 저비용 모델 | `null` (비활성) | 3초 |
| `standard` | 표준 모델 | 표준 리뷰어 | 5초 |
| `strict` | 고품질 모델 | 고품질 리뷰어 | 10초 |

### 12.2 모드 검증

```typescript
// validateMode(mode: unknown): RouterMode
// 유효하지 않은 값 → 기본값 'standard' 반환 (에러 없음)
```

---

## 13. Feature Flag 에러 방지 체계 (`config/featureFlags.ts`)

### 13.1 롤백 전략

모든 Feature Flag는 환경 변수로 제어됩니다. 장애 발생 시 환경 변수만 변경하면 즉시 롤백 가능합니다.

| Flag 기본값 패턴 | 의미 | 롤백 방법 |
|----------------|------|----------|
| `process.env.X !== 'false'` | 기본 활성화 | 환경 변수를 `'false'`로 설정 |
| `process.env.X === 'true'` | 기본 비활성화 | 환경 변수를 `'true'`로 설정 시만 활성화 |

### 13.2 주요 안전 장치 Flag

| Flag | 기본값 | 위험 시 설정 | 영향 |
|------|--------|------------|------|
| `ENABLE_PIPELINE_V5` | `true` | `false` → v4로 폴백 | Diff Safety, Upgrade Effect Gate 비활성 |
| `ENABLE_PIPELINE_V4` | `true` | `false` → v3로 폴백 | Regression Gate 비활성 |
| `ENABLE_SELF_RAG` | `false` | `true`로 활성화 필요 | 4단계 자기 검증 활성 |
| `ENABLE_HALLUCINATION_DETECTION` | `true` | `false`로 비활성화 | 환각 탐지 로직 완전 OFF |
| `ENABLE_AGENTIC_CHUNKING` | `true` | `false`로 비활성화 | 기존 semanticChunk로 폴백 |
| `LAZY_SELF_RAG_MODE` | `true` | `false`로 비활성화 | 모든 응답에 Self-RAG 적용 (비용 증가) |

### 13.3 Pipeline v4 세부 토글 (`lib/rag/featureFlags.ts`)

```typescript
PIPELINE_V4_FLAGS = {
  useChunkTypeFilter: ENABLE_PIPELINE_V4,           // chunk_type 필터링
  enableRegressionGate: ENABLE_PIPELINE_V4,         // Regression Gate
  autoGenerateValidationSamples: ENABLE_PIPELINE_V4, // 검증 샘플 자동 생성
  enableClassificationLogging: NODE_ENV === 'development', // 개발 환경만
  enablePromptLengthLimit: ENABLE_PIPELINE_V4,      // 프롬프트 길이 제한
}
```

---

## 14. 에러 로깅 전략

### 14.1 로그 레벨 사용 규칙

| 레벨 | 사용 기준 | 예시 |
|------|---------|------|
| `console.error` | 시스템 장애, 데이터 손실 위험 | DB 저장 실패, LLM 호출 실패 |
| `console.warn` | 성능 저하 가능, 기본값 폴백 | 사용자 등급 조회 실패 → free 폴백 |
| `console.log` | 정상 흐름 정보, 디버깅 | ACL 검증 성공, 라우팅 결정 |
| `debugLog(tag, ...)` | Feature Flag `ENABLE_DEBUG_LOGS` 제어 | Production 자동 비활성화 |

### 14.2 에러 로깅 패턴

```typescript
// 문서 처리 실패 시 구조화 로깅
console.error('=== DOCUMENT PROCESSING ERROR ===')
console.error('Document ID:', documentId)
console.error('File Path:', filePath)
console.error('Error Name:', error.name)
console.error('Error Message:', error.message)
console.error('Error Stack:', error.stack)
console.error('=================================')
```

### 14.3 비치명적 에러 처리 원칙

다음 상황에서는 에러를 **throw하지 않고** 로그만 남깁니다:

1. **사용량 기록 실패** (`trackUsage`): 임베딩은 이미 생성됨
2. **상태 업데이트 실패** (`updateDocumentStatus`): 이미 에러 처리 중일 수 있음
3. **사용자 등급 조회 실패** (`getUserTier`): `'free'`로 안전하게 폴백
4. **LLM Gate 호출 실패**: `passed: true, score: 0.5`로 보수적 통과

---

## 15. 프론트엔드 에러 처리 패턴

### 15.1 API 호출 실패 처리

```typescript
// 일반적인 API 호출 패턴
const response = await fetch('/api/endpoint', { ... })
const data = await response.json()

if (!data.success) {
  // data.error.code로 에러 유형 확인
  // data.error.message로 사용자 메시지 표시
  toast.error(data.error.message)
}
```

### 15.2 Supabase 에러 패턴

```typescript
const { data, error } = await supabase.from('table').select('*')

if (error) {
  // error.message: Supabase 에러 메시지
  // error.code: PostgreSQL 에러 코드
  console.error('Supabase error:', error.message)
}
```

---

## 변경 이력

| 날짜 | 변경 내용 |
|------|----------|
| 2025-12-25 | Pipeline v4 Gate 시스템 추가 (Regression Gate) |
| 2025-12-27 | 환각 탐지 시스템, Dynamic Threshold 추가 |
| 2026-01-03 | Citation Gate 임계값 60%→70% 상향, Sufficiency Gate 추가 |
| 2026-01-17 | LLM Gateway Fallback 전략 추가 |
| 2026-02-14 | 문서 작성 |

---

## 16. 트러블슈팅 가이드

> 출처: RAG System Technical Manual v5.0 (2026-01-04)

### 16.1 임베딩 생성 실패

**증상**: `OPENAI_API_KEY 환경 변수가 설정되지 않았습니다.`

**해결**: `.env.local` 파일에서 `OPENAI_API_KEY=sk-...` 확인

### 16.2 PDF 파싱 실패

**증상**: `스캔된 이미지 PDF는 지원되지 않습니다.`

**해결**: OCR 또는 Vision API 사용 필요. 텍스트 기반 PDF만 지원.

### 16.3 벡터 검색 결과 없음

**증상**: `hybridSearch` 결과가 빈 배열

**해결 순서**:
1. 문서 처리 상태 확인 → `status = 'completed'` 여야 함
2. 임베딩 정상 생성 확인 → `rag_chunks` 테이블에서 `embedding IS NOT NULL`
3. ACL 권한 확인 → `user_id` 일치 여부

### 16.4 토큰 한도 초과

**증상**: `일일 임베딩 한도를 초과했습니다.`

**해결**: 다음날 재시도 또는 프리미엄 등급 업그레이드 (free: 50K/일, premium: 500K/일)

---

## 17. 모니터링 및 디버깅 패턴

> 출처: RAG System Technical Manual v5.0 (2026-01-04)

### 17.1 검색 로그

```typescript
console.log('[vectorSearch] CALLED with query:', query)
console.log('[vectorSearch] ACL PASSED, docs:', aclResult.allowedDocumentIds.length)
```

### 17.2 청크 분류 로그 (개발 환경)

```typescript
console.log(`[classifyChunkType] "${preview}..." -> ${result}`)
```

### 17.3 환각 탐지 로그

```typescript
console.log(`[HallucinationDetector] Pattern matched: ${description}`)
console.log(`[HallucinationDetector] Confidence: ${confidence}, Threshold: ${threshold}`)
```

### 17.4 Feature Flag 상태 확인

```typescript
import { logFeatureFlagStatus } from './lib/rag/featureFlags'
logFeatureFlagStatus()
// [FeatureFlags] Pipeline Version: v4
// [FeatureFlags] Flags: { useChunkTypeFilter: true, ... }
```

### 17.5 검색 캐시 모니터링

```typescript
searchCache.getStats()
// { size: 150, hitRate: 0.75, ... }
```
