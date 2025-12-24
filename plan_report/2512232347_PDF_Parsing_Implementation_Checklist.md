# 2512232347_PDF_Parsing_Implementation_Checklist

# Context Setting

- **Project Domain**: PrismLM (LLM 기반 글쓰기 도구) - RAG 시스템 문서 처리 파이프라인
- **Tech Stack**: Next.js 14, Supabase (Storage + PostgreSQL), Vercel Serverless, OpenAI Embeddings
- **Review Target**: PDF 파싱 라이브러리 추가 (`pdf-parse`) 및 `documentProcessor.ts` 리팩토링
- **Scope**: Core Logic Upgrade / Technical Debt Payoff
- **Risk Level**: **Mid** - RAG 시스템 핵심 기능, 데이터 처리 파이프라인에 영향

# Input Data

**현재 문제:**

- PDF 파일 업로드 후 상태가 "대기 중"에서 멈춤
- Vercel 로그: `POST 500 /api/documents/process - Error: 문서 처리 중 오류가 발생했습니다.`

**근본 원인:**

```typescript
// documentProcessor.ts (현재 코드)
async function fetchDocumentContent(filePath: string): Promise<string> {
  const { data } = await supabase.storage
    .from("rag-documents")
    .download(filePath);
  const text = await data.text(); // ❌ PDF는 바이너리이므로 실패
  return text;
}
```

**해결 방안:**

- `pdf-parse` 라이브러리 설치
- 파일 타입별 파싱 로직 분기 추가

# Role

**Senior Migration & Reliability Specialist (JeDebug)**

- 목표: 업그레이드된 코드가 기존 시스템 생태계를 파괴하지 않고 안전하게 안착(Soft Landing)하도록 만드는 것
- 회귀 버그(Regression), 사이드 이펙트(Side Effect), 데이터 불일치를 사전에 시뮬레이션하고 차단

---

# Analysis Framework (C.O.R.E + S/D)

## 1. C (Compatibility & Regression - 호환성 및 회귀 방지) ⭐

- **하위 호환성 (Backward Compatibility)**:

  - TXT, MD 파일은 기존 `.text()` 방식 유지 → **영향 없음**
  - PDF 파일만 새로운 `pdf-parse` 로직 적용
  - DOCX 파일은 현재 미지원 → 에러 메시지 반환 (Breaking Change 아님)

- **의존성 추가**:
  - `pdf-parse` 패키지 추가 (번들 크기 약 500KB 증가)
  - Vercel Serverless 환경에서 작동 확인 필요 (Node.js 기반 라이브러리)

## 2. O (Operational & Performance Tuning)

- **Vercel Timeout 위험**:

  - PDF 파싱은 CPU 집약적 작업
  - Hobby Plan: 10초 제한 → 대용량 PDF(50페이지 이상)에서 타임아웃 가능성
  - **완화책**: 에러 핸들링으로 타임아웃 시 사용자에게 안내

- **메모리 사용량**:
  - `pdf-parse`는 전체 PDF를 메모리에 로드
  - 50MB PDF → 약 100MB 메모리 사용 예상
  - Vercel Hobby: 1024MB 제한 → 대부분 OK

## 3. R (Robustness & Data Integrity)

- **데이터 무결성**:

  - PDF 파싱 실패 시 `status = 'failed'`로 업데이트
  - 기존 청크 데이터에 영향 없음 (신규 INSERT만 수행)

- **롤백 불가 트랜잭션**: 없음
  - 파싱 실패 시 DB 상태만 `failed`로 변경
  - Storage 파일은 그대로 유지

## 4. E (Evolution & Maintainability)

- **Clean Architecture**:

  - `parseDocumentContent()` 함수를 별도 모듈로 분리 권장
  - Strategy 패턴으로 파일 타입별 파서 추상화 가능

- **테스트 용이성**:
  - PDF 파싱 로직은 순수 함수로 작성 가능
  - 단위 테스트 가능 (샘플 PDF 파일 포함)

## 5. S (Security)

- **권한 구멍**: 없음

  - 기존 인증/인가 로직 변경 없음
  - Storage 접근은 기존 RLS 정책 유지

- **악성 PDF 위험**:
  - `pdf-parse`는 JavaScript 실행을 하지 않음
  - 악성 스크립트 실행 위험 낮음

## 6. D (Deployment & Fallback)

- **Feature Flag 가능**:

  - 환경 변수 `ENABLE_PDF_PARSING=true/false`로 제어 가능
  - `false` 시 PDF 업로드를 프론트엔드에서 차단

- **Canary 배포**:
  - Vercel Preview Deployment에서 테스트 후 Production 배포

---

# Output Format

## 1) 🚨 위험 요소 및 디버깅 포인트 (Risk Table)

|  중요도  | 예상되는 충돌/회귀 (Risk)                 | 원인 분석 (Root Cause)           | 해결/안정화 가이드 (Stabilization Solution)                              |
| :------: | :---------------------------------------- | :------------------------------- | :----------------------------------------------------------------------- |
| **High** | 스캔된 이미지 PDF에서 텍스트 추출 실패    | `pdf-parse`는 OCR 미지원         | 텍스트가 비어있는 경우 "스캔된 이미지 PDF는 지원되지 않습니다" 에러 반환 |
| **Mid**  | 대용량 PDF(50페이지+)에서 Vercel 타임아웃 | Hobby Plan 10초 제한             | 에러 핸들링 + 파일 크기 경고 UI 추가                                     |
| **Mid**  | 암호화된 PDF에서 파싱 실패                | `pdf-parse`는 암호화 해제 미지원 | 암호화 감지 시 명확한 에러 메시지 반환                                   |
| **Low**  | 한글 PDF에서 인코딩 깨짐                  | PDF 내부 폰트 서브셋팅           | 테스트 필요, 대부분 정상 작동 예상                                       |

## 2) 🧪 필수 테스트 및 검증 시나리오 (Verification Plan)

### Regression Test (기존 기능 보존)

- [ ] TXT 파일 업로드 → 정상 처리 확인
- [ ] MD 파일 업로드 → 정상 처리 확인
- [ ] 기존 "준비됨" 상태 문서로 RAG 검색 → 정상 작동 확인

### Migration Test (신규 기능 검증)

- [ ] 일반 텍스트 PDF 업로드 → 텍스트 추출 성공, 상태 "준비됨"
- [ ] 스캔 이미지 PDF 업로드 → 명확한 에러 메시지 표시
- [ ] 암호화 PDF 업로드 → 명확한 에러 메시지 표시
- [ ] 한글 PDF 업로드 → 한글 텍스트 정상 추출

### Load Test (성능 검증)

- [ ] 5MB PDF 업로드 → 10초 이내 처리 완료
- [ ] 10MB PDF 업로드 → 처리 완료 또는 타임아웃 에러 표시

## 3) 🛑 롤백 및 비상 대응 전략 (Rollback Strategy)

1. **즉시 롤백 (코드 레벨)**:

   ```bash
   git revert <commit-hash>
   ```

2. **Feature Flag 롤백 (설정 레벨)**:

   - Vercel 환경 변수에서 `ENABLE_PDF_PARSING=false` 설정
   - 프론트엔드에서 PDF 업로드 차단

3. **데이터 복구**:
   - 문서 상태가 `failed`로 변경된 경우 → Storage 파일은 유지됨
   - 수동으로 `status = 'pending'`으로 리셋 후 재처리 가능

## 4) 추가 확인 필요사항 (Unknowns)

- [ ] DOCX 파일 파싱은 언제 구현할 예정인가? (현재는 에러 반환)
- [ ] Vercel Pro Plan 업그레이드 예정 여부? (60초 타임아웃으로 개선)
- [ ] OCR 지원 필요 여부? (추후 Tesseract.js 또는 외부 API 연동 고려)

## 5) 최종 의견 (Conclusion)

- **Confidence:** **High**
- **Go / No-Go Decision:**
  - ✅ **Ready to Build:** 리스크가 통제 가능하며 가드레일이 확보됨.
  - 근거:
    1. 기존 TXT/MD 파일 처리 로직은 변경 없음 (회귀 위험 낮음)
    2. `pdf-parse`는 안정적인 라이브러리 (npm weekly downloads: 500K+)
    3. 롤백 전략이 명확함 (Feature Flag, Git Revert)
    4. 스캔 이미지/암호화 PDF 에러 핸들링으로 사용자 혼란 방지

---

# Implementation Checklist

## Phase 1: 라이브러리 설치 및 타입 설정

# 2512232347_PDF_Parsing_Implementation_Checklist

# Context Setting

- **Project Domain**: PrismLM (LLM 기반 글쓰기 도구) - RAG 시스템 문서 처리 파이프라인
- **Tech Stack**: Next.js 14, Supabase (Storage + PostgreSQL), Vercel Serverless, OpenAI Embeddings
- **Review Target**: PDF 파싱 라이브러리 추가 (`pdf-parse`) 및 `documentProcessor.ts` 리팩토링
- **Scope**: Core Logic Upgrade / Technical Debt Payoff
- **Risk Level**: **Mid** - RAG 시스템 핵심 기능, 데이터 처리 파이프라인에 영향

# Input Data

**현재 문제:**

- PDF 파일 업로드 후 상태가 "대기 중"에서 멈춤
- Vercel 로그: `POST 500 /api/documents/process - Error: 문서 처리 중 오류가 발생했습니다.`

**근본 원인:**

```typescript
// documentProcessor.ts (현재 코드)
async function fetchDocumentContent(filePath: string): Promise<string> {
  const { data } = await supabase.storage
    .from("rag-documents")
    .download(filePath);
  const text = await data.text(); // ❌ PDF는 바이너리이므로 실패
  return text;
}
```

**해결 방안:**

- `pdf-parse` 라이브러리 설치
- 파일 타입별 파싱 로직 분기 추가

# Role

**Senior Migration & Reliability Specialist (JeDebug)**

- 목표: 업그레이드된 코드가 기존 시스템 생태계를 파괴하지 않고 안전하게 안착(Soft Landing)하도록 만드는 것
- 회귀 버그(Regression), 사이드 이펙트(Side Effect), 데이터 불일치를 사전에 시뮬레이션하고 차단

---

# Analysis Framework (C.O.R.E + S/D)

## 1. C (Compatibility & Regression - 호환성 및 회귀 방지) ⭐

- **하위 호환성 (Backward Compatibility)**:

  - TXT, MD 파일은 기존 `.text()` 방식 유지 → **영향 없음**
  - PDF 파일만 새로운 `pdf-parse` 로직 적용
  - DOCX 파일은 현재 미지원 → 에러 메시지 반환 (Breaking Change 아님)

- **의존성 추가**:
  - `pdf-parse` 패키지 추가 (번들 크기 약 500KB 증가)
  - Vercel Serverless 환경에서 작동 확인 필요 (Node.js 기반 라이브러리)

## 2. O (Operational & Performance Tuning)

- **Vercel Timeout 위험**:

  - PDF 파싱은 CPU 집약적 작업
  - Hobby Plan: 10초 제한 → 대용량 PDF(50페이지 이상)에서 타임아웃 가능성
  - **완화책**: 에러 핸들링으로 타임아웃 시 사용자에게 안내

- **메모리 사용량**:
  - `pdf-parse`는 전체 PDF를 메모리에 로드
  - 50MB PDF → 약 100MB 메모리 사용 예상
  - Vercel Hobby: 1024MB 제한 → 대부분 OK

## 3. R (Robustness & Data Integrity)

- **데이터 무결성**:

  - PDF 파싱 실패 시 `status = 'failed'`로 업데이트
  - 기존 청크 데이터에 영향 없음 (신규 INSERT만 수행)

- **롤백 불가 트랜잭션**: 없음
  - 파싱 실패 시 DB 상태만 `failed`로 변경
  - Storage 파일은 그대로 유지

## 4. E (Evolution & Maintainability)

- **Clean Architecture**:

  - `parseDocumentContent()` 함수를 별도 모듈로 분리 권장
  - Strategy 패턴으로 파일 타입별 파서 추상화 가능

- **테스트 용이성**:
  - PDF 파싱 로직은 순수 함수로 작성 가능
  - 단위 테스트 가능 (샘플 PDF 파일 포함)

## 5. S (Security)

- **권한 구멍**: 없음

  - 기존 인증/인가 로직 변경 없음
  - Storage 접근은 기존 RLS 정책 유지

- **악성 PDF 위험**:
  - `pdf-parse`는 JavaScript 실행을 하지 않음
  - 악성 스크립트 실행 위험 낮음

## 6. D (Deployment & Fallback)

- **Feature Flag 가능**:

  - 환경 변수 `ENABLE_PDF_PARSING=true/false`로 제어 가능
  - `false` 시 PDF 업로드를 프론트엔드에서 차단

- **Canary 배포**:
  - Vercel Preview Deployment에서 테스트 후 Production 배포

---

# Output Format

## 1) 🚨 위험 요소 및 디버깅 포인트 (Risk Table)

|  중요도  | 예상되는 충돌/회귀 (Risk)                 | 원인 분석 (Root Cause)           | 해결/안정화 가이드 (Stabilization Solution)                              |
| :------: | :---------------------------------------- | :------------------------------- | :----------------------------------------------------------------------- |
| **High** | 스캔된 이미지 PDF에서 텍스트 추출 실패    | `pdf-parse`는 OCR 미지원         | 텍스트가 비어있는 경우 "스캔된 이미지 PDF는 지원되지 않습니다" 에러 반환 |
| **Mid**  | 대용량 PDF(50페이지+)에서 Vercel 타임아웃 | Hobby Plan 10초 제한             | 에러 핸들링 + 파일 크기 경고 UI 추가                                     |
| **Mid**  | 암호화된 PDF에서 파싱 실패                | `pdf-parse`는 암호화 해제 미지원 | 암호화 감지 시 명확한 에러 메시지 반환                                   |
| **Low**  | 한글 PDF에서 인코딩 깨짐                  | PDF 내부 폰트 서브셋팅           | 테스트 필요, 대부분 정상 작동 예상                                       |

## 2) 🧪 필수 테스트 및 검증 시나리오 (Verification Plan)

### Regression Test (기존 기능 보존)

- [ ] TXT 파일 업로드 → 정상 처리 확인
- [ ] MD 파일 업로드 → 정상 처리 확인
- [ ] 기존 "준비됨" 상태 문서로 RAG 검색 → 정상 작동 확인

### Migration Test (신규 기능 검증)

- [ ] 일반 텍스트 PDF 업로드 → 텍스트 추출 성공, 상태 "준비됨"
- [ ] 스캔 이미지 PDF 업로드 → 명확한 에러 메시지 표시
- [ ] 암호화 PDF 업로드 → 명확한 에러 메시지 표시
- [ ] 한글 PDF 업로드 → 한글 텍스트 정상 추출

### Load Test (성능 검증)

- [ ] 5MB PDF 업로드 → 10초 이내 처리 완료
- [ ] 10MB PDF 업로드 → 처리 완료 또는 타임아웃 에러 표시

## 3) 🛑 롤백 및 비상 대응 전략 (Rollback Strategy)

1. **즉시 롤백 (코드 레벨)**:

   ```bash
   git revert <commit-hash>
   ```

2. **Feature Flag 롤백 (설정 레벨)**:

   - Vercel 환경 변수에서 `ENABLE_PDF_PARSING=false` 설정
   - 프론트엔드에서 PDF 업로드 차단

3. **데이터 복구**:
   - 문서 상태가 `failed`로 변경된 경우 → Storage 파일은 유지됨
   - 수동으로 `status = 'pending'`으로 리셋 후 재처리 가능

## 4) 추가 확인 필요사항 (Unknowns)

- [ ] DOCX 파일 파싱은 언제 구현할 예정인가? (현재는 에러 반환)
- [ ] Vercel Pro Plan 업그레이드 예정 여부? (60초 타임아웃으로 개선)
- [ ] OCR 지원 필요 여부? (추후 Tesseract.js 또는 외부 API 연동 고려)

## 5) 최종 의견 (Conclusion)

- **Confidence:** **High**
- **Go / No-Go Decision:**
  - ✅ **Ready to Build:** 리스크가 통제 가능하며 가드레일이 확보됨.
  - 근거:
    1. 기존 TXT/MD 파일 처리 로직은 변경 없음 (회귀 위험 낮음)
    2. `pdf-parse`는 안정적인 라이브러리 (npm weekly downloads: 500K+)
    3. 롤백 전략이 명확함 (Feature Flag, Git Revert)
    4. 스캔 이미지/암호화 PDF 에러 핸들링으로 사용자 혼란 방지

---

# Implementation Checklist

## Phase 1: 라이브러리 설치 및 타입 설정

- [x] `pdf-parse` 패키지 설치 → **완료** (4 packages added)
- [x] TypeScript 타입 확인 → **완료** (`require` 방식 사용)

## Phase 2: 파싱 로직 구현

- [x] `documentProcessor.ts`에 `parsePDF()` 함수 추가 → **완료** (Lines 90-111)
- [x] `parseDocumentContent()` 함수에서 파일 타입별 분기 처리 → **완료** (Lines 120-163)
- [x] 기존 TXT/MD 파일 처리 로직 유지 → **완료**

## Phase 3: 에러 핸들링

- [x] 스캔 이미지 PDF 감지 (텍스트 비어있음) → **완료**
- [x] 암호화 PDF 감지 → **완료**
- [x] 명확한 에러 메시지 반환 → **완료**

## Phase 4: 테스트 및 검증

- [x] Syntax 검사 (`npx tsc --noEmit`) → **Pass** (No errors)
- [x] 빌드 테스트 (`npm run build`) → **Pass** (Exit code 0)
- [ ] Vercel 배포 및 브라우저 테스트
- [ ] Production 배포

## Phase 5: UX 개선 (선택)

- [ ] 처리 상태 메시지 개선 ("PDF 텍스트 추출 중...")
- [ ] 스캔 이미지 PDF 경고 툴팁 추가
