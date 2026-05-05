# 20251223_FixStuckUploads_Checklist

## 1. 파일 구성 및 근거

**결정**: **단일 파일 구성** (`20251223_FixStuckUploads_Checklist.md`)
**근거**:

1.  **원자성(Atomicity)**: 이번 작업은 "API 응답 방식 변경"이라는 하나의 명확한 목표를 가집니다. 프론트엔드와 백엔드가 긴밀하게 연결되어 있어 한 곳에서 관리하는 것이 효율적입니다.
2.  **협업 효율성**: 시니어(로직), 주니어(검증), UX(피드백) 담당자가 하나의 문서를 보며 흐름을 파악해야 "누락"을 방지할 수 있습니다.
3.  **유지보수**: 파일이 분산되면 추후 히스토리 파악이 어렵습니다.

---

## Phase 1: 백엔드 API 로직 수정 (핵심)

**목표**: Vercel 서버리스 환경에서 백그라운드 작업이 강제 종료되는 문제를 해결하기 위해, 문서 처리를 동기(Synchronous) 방식으로 전환합니다.

### 1-1. `upload/route.ts` 수정 [Senior Dev]

- **파일**: `frontend/src/app/api/documents/upload/route.ts`
- **위치**: `POST` 함수 내부, `triggerDocumentProcessing` 호출부 (약 205라인)
- **영향**: 업로드 API 응답 시간이 기존 0.5초 → 3~5초로 증가함.

- [x] **`triggerDocumentProcessing` 호출 방식 변경**
  - [x] 기존: `triggerDocumentProcessing(...)` (비동기 호출 후 바로 응답)
  - [x] 변경: `await triggerDocumentProcessing(...)` (처리 완료 대기)
  - [x] **품질 체크**:
    - [x] `await` 키워드 누락 없는지 확인
    - [x] 에러 발생 시 `catch` 블록에서 적절한 HTTP 500 응답 반환 확인
    - [x] **성능**: 10초(Vercel Free Plan Timeout)를 넘지 않도록 주의 (대용량 파일 테스트 필요)

### 1-2. `documentProcessor.ts` 반환 타입 확인 [Junior Dev]

- **파일**: `frontend/src/lib/rag/documentProcessor.ts`
- **위치**: `triggerDocumentProcessing` 함수
- **연결**: 1-1에서 `await`를 하려면 이 함수가 `Promise`를 반환해야 함.

- [x] **함수 시그니처 확인**
  - [x] `async function`으로 선언되어 있는지 확인
  - [x] 반환 타입이 `Promise<void>` 또는 `Promise<ProcessingResult>`인지 확인
  - [x] **품질 체크**:
    - [x] 명확한 반환 타입 명시

---

## Phase 2: 프론트엔드 UX 점검 (피드백)

**목표**: API 응답 시간이 길어짐에 따라 사용자 경험(UX)이 저하되지 않도록 확인합니다.

### 2-1. 로딩 상태 표시 확인 [UX/UI Dev]

- **파일**: `frontend/src/components/documents/DocumentUploader.tsx` (추정)
- **위치**: 업로드 버튼 클릭 이벤트 핸들러
- **연결**: Phase 1 적용 후 응답이 늦게 오므로 로딩 인디케이터가 필수적임.

- [x] **로딩 인디케이터 지속성 확인**
  - [x] 업로드 시작 시 `isUploading` 상태가 `true`로 설정되는지 확인
  - [x] API 응답(`await` 완료)이 올 때까지 로딩 스피너가 계속 도는지 확인
  - [x] **접근성**:
    - [x] 로딩 중 `aria-busy="true"` 속성 확인
    - [x] 스크린 리더가 "업로드 및 처리 중..." 상태를 인지할 수 있는지 확인

### 2-2. 타임아웃 에러 핸들링 [Junior Dev]

- **파일**: `frontend/src/components/documents/DocumentUploader.tsx`
- **위치**: `fetch` 호출부

- [x] **클라이언트 타임아웃 설정**
  - [x] 브라우저나 프론트엔드 코드에서 10초 이상의 요청을 강제로 끊지 않는지 확인
  - [x] Vercel 타임아웃(10초/60초) 발생 시 사용자에게 "파일이 너무 크거나 처리가 지연되었습니다" 메시지 표시

---

## Phase 3: 검증 (Verification)

**목표**: 수정 사항이 실제 환경에서 의도대로 동작하는지 확인합니다.

### 3-1. 로컬 검증 [Junior Dev]

- [x] **Syntax 오류 확인**: `npm run build` 실행하여 타입 에러 없는지 확인
- [x] **기능 동작 확인**:
  - [x] 작은 파일(TXT, 1KB) 업로드 → 즉시 "Ready" 상태 확인
  - [x] 중간 파일(PDF, 1MB) 업로드 → 약 2~3초 후 "Ready" 상태 확인

### 3-2. Vercel 배포 후 검증 [All]

- [x] **배포 상태 확인**: Vercel 대시보드에서 배포 성공 확인 (커밋: `3aa964f`)
- [ ] **실제 업로드 테스트**:
  - [ ] PDF 파일 업로드
  - [ ] **핵심**: 업로드 직후 새로고침 했을 때 "대기 중(Waiting)"이 아니라 **"준비됨(Ready)"** 상태여야 함.
  - [ ] Vercel 로그 확인: "Document processed successfully" 로그가 찍혔는지 확인

---

## 📝 작업 완료 서명

- [ ] Senior Developer: **\*\***\_\_\_\_**\*\***
- [ ] Junior Developer: **\*\***\_\_\_\_**\*\***
- [ ] UX/UI Designer: **\*\***\_\_\_\_**\*\***
