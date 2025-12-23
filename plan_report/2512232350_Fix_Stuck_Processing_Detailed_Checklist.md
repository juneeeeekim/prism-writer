# 251223_Fix_Stuck_Processing_Detailed_Checklist

## 📋 문서 개요

- **목적**: Vercel Serverless Function 환경에서 발생하는 "문서 처리 중단(Stuck Processing)" 문제를 해결하기 위해, 업로드와 처리 로직을 분리하고 클라이언트 주도(Client-Triggered) 처리 방식을 도입함.
- **참여자**:
  - 👨‍💻 **시니어 개발자**: 백엔드 API 분리 및 프로세스 동기화 로직 설계
  - 👶 **주니어 개발자**: 프론트엔드 연동 및 비동기 요청 구현
  - 🎨 **UX/UI 디자이너**: 처리 상태 시각화 확인 (기존 UI 유지)
- **파일 구성 결정**: **단일 파일 구성**
  - **근거**: 본 작업은 "업로드(Frontend) -> 처리 요청(Backend)"의 강한 결합을 가지는 단일 트랜잭션 수정 작업이므로, 한 파일에서 흐름을 파악하는 것이 검증 및 구현 효율성 측면에서 유리함.

---

## 🚀 Phase 1: Backend API Refactoring (Server-Side)

**영향받을 수 있는 기존 기능:**

- 문서 업로드 기능 (기존에는 업로드 시 자동으로 처리가 시작되었으나, 수정 후에는 처리가 시작되지 않음)

### 1-1. 처리 전용 API 생성 (New Endpoint)

- **담당**: 👨‍💻 시니어 개발자
- **파일**: `frontend/src/app/api/documents/process/route.ts` (신규 생성)
- **내용**:
  - [ ] **[Import]** `processDocument` 함수 및 Supabase 클라이언트 임포트.
  - [ ] **[Function]** `POST` 메서드 핸들러 작성.
  - [ ] **[Validation]** Request Body에서 `documentId` 추출 및 검증.
  - [ ] **[DB Query]** `rag_documents` 테이블에서 `file_path` 조회.
  - [ ] **[Logic]** `await processDocument(...)` 호출하여 처리가 완료될 때까지 대기 (Vercel 프로세스 유지).
  - [ ] **[Response]** 처리 결과(성공/실패) JSON 반환.
  - **품질 체크**:
    - `try-catch` 블록으로 모든 예외 처리.
    - 변수명: `processingResult`, `documentData` 등 명확하게 사용.

### 1-2. 업로드 API 수정 (Refactoring)

- **담당**: 👨‍💻 시니어 개발자
- **파일**: `frontend/src/app/api/documents/upload/route.ts`

- 파일 업로드 UI (업로드 완료 후 처리 상태로 넘어가는 흐름)

### 2-1. 업로드 컴포넌트 로직 수정

- **담당**: 👶 주니어 개발자
- **파일**: `frontend/src/components/documents/DocumentUploader.tsx`
- **위치**: `uploadFile` 함수 내부 (`fetch('/api/documents/upload')` 성공 직후)
- **내용**:
  - [x] **[Fetch]** 업로드 성공 응답(`data.documentId`)을 받은 직후, `/api/documents/process` 엔드포인트 호출 코드 작성.
  - [x] **[Async Pattern]** `fetch` 호출을 `await` 하지 않고 **"Fire and Forget"** 패턴으로 실행하거나, 필요 시 `await`하여 완료를 기다림.
    - _전략_: Vercel 타임아웃 방지를 위해 클라이언트가 요청을 잡고 있는 것이 유리하므로, `await` 없이 요청만 보내고 UI는 폴링으로 상태를 갱신하도록 함.
    - _코드 예시_: `fetch('/api/documents/process', { ... }).catch(err => console.error(...))`
  - [x] **[Callback]** `onUploadSuccess` 콜백은 업로드 성공 직후(처리 요청 전)에 호출하여 UI가 "대기 중" 상태를 즉시 표시하도록 함.
  - **품질 체크**:
    - 네트워크 에러(`catch`)에 대한 콘솔 로그 처리.
    - 불필요한 `re-render` 방지.

### ✅ Phase 2 검증

- [x] **Syntax Check**: `npx tsc --noEmit` 실행.
- [x] **Browser Test**:
  1. 파일 업로드 시도.
  2. 네트워크 탭에서 `upload` 요청 성공 직후 `process` 요청이 발송되는지 확인.
  3. `process` 요청이 (시간이 걸리더라도) 200 OK를 받거나, 백엔드에서 처리가 수행되는지 확인.

---

## 🔍 Phase 3: Integrated Verification (QA)

### 3-1. 전체 흐름 테스트

- **담당**: 👨‍💻 시니어, 👶 주니어, 🎨 UX/UI
- **내용**:
  - [ ] **[Upload]** 대용량 파일(약 5MB 이상) 업로드.
  - [ ] **[UI Feedback]** 업로드 직후 목록에 "⏳ 대기 중" 표시 확인.
  - [ ] **[Transition]** 3~5초 내에 "📄 텍스트 추출 중" -> "🧠 AI 학습 중"으로 상태 변경 확인.
  - [ ] **[Completion]** 최종적으로 "✅ 준비됨" 상태 도달 확인.
  - [ ] **[No Stuck]** 1분 이상 "대기 중"에서 멈추는 현상이 사라졌는지 확인.

### ✅ Phase 3 검증

- [ ] **Console Log**: 브라우저 콘솔에 에러 없음 확인.
- [ ] **DB Check**: Supabase에서 `rag_documents` 테이블의 `status`가 `completed`로 변경되었는지 확인.
