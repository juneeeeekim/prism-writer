# RAG 파일 처리 상태 시각화 구현 체크리스트

**작성일:** 2025년 12월 23일 (수정: 2025년 12월 23일)
**문서 유형:** 구현 체크리스트
**기반 문서:** `rag_ux_improvement_proposal.md` & `Architecture_QA_Review_Report`

## 📂 파일 구성 전략

**결정:** **단일 파일 구성** (`2512230500_RAG_Processing_Visualization_Checklist.md`)
**근거:** 백엔드/프론트엔드 작업의 긴밀한 연관성 및 검증 효율성 고려.

---

## ⚠️ 영향받을 수 있는 기존 기능 & 리스크 완화

- **[Risk] 좀비 프로세스:** 처리 중단 시 무한 로딩 방지를 위해 Timeout 처리 로직 추가 필요.
- **[Risk] 매직 스트링:** 상태값 하드코딩 방지를 위해 공통 Enum 정의 필요.
- **[Risk] 보안:** 에러 메시지 노출 방지를 위해 Sanitization 필요.

---

## Phase 2: 백엔드 상태 관리 시스템 구축 (Backend)

**목표:** 세분화된 상태 저장, 에러 처리, 그리고 좀비 프로세스 방지 로직을 구현합니다.

### 2.1 데이터베이스 스키마 확장

- [x] **[DB] `rag_documents` 테이블 수정 마이그레이션 생성**
  - **파일:** `backend/migrations/027_add_document_status.sql`
  - **내용:**
    - `status` 컬럼 체크 제약조건 수정 (위 Enum 값 반영)
    - `error_message` 컬럼 추가 (TEXT, NULL 허용)
    - `started_at` 컬럼 추가 (TIMESTAMPTZ, NULL 허용) - **Timeout 처리를 위해 필요**
    - **마이그레이션 전략:** 기존 `processing` 상태인 데이터는 일괄 `failed` 또는 `queued`로 초기화하여 좀비 프로세스 제거.

### 2.2 문서 처리 로직 고도화

- [x] **[Logic] `documentProcessor.ts` 상태 업데이트 및 Timeout 처리**
  - **파일:** `frontend/src/lib/rag/documentProcessor.ts`
  - **위치:** `processDocument` 함수
  - **작업 내용:**
    1.  **Enum 사용:** 모든 상태 업데이트 시 `DocumentStatus` Enum 사용.
    2.  **시작 시간 기록:** 처리 시작 시 `started_at`을 `NOW()`로 업데이트.
    3.  **에러 Sanitization:** `catch` 블록에서 사용자에게 노출할 에러 메시지("파일 처리 중 오류가 발생했습니다")와 내부 로그용 에러를 분리하여 저장.
    4.  **Timeout 체크 (Optional):** 처리 시작 전, `started_at`이 10분 이상 지난 `processing_*` 상태의 문서가 있다면 `failed`로 처리하는 로직 추가 (또는 별도 Cron Job 고려).

### 2.3 상태 조회 API 최적화

- [x] **[API] `api/rag/documents/route.ts` GET 메서드 수정**
  - **내용:** `status`, `error_message` 조회 추가.
  - **보안:** `error_message`는 클라이언트에 그대로 전달하되, 저장 시점에 이미 Sanitization 된 메시지만 저장되도록 2.2에서 처리함.

### ✅ Phase 2 검증

- [x] **Unit Test:** `documentProcessor`가 각 단계별로 올바른 Enum 값을 DB에 저장하는지 테스트.
- [x] **Integration Test:** 강제로 에러를 발생시켰을 때 `status`가 `failed`로 변하고, `error_message`가 적절히 저장되는지 확인.

---

## Phase 3: 프론트엔드 시각화 및 인터랙션 (Frontend)

**목표:** 실시간 상태 변화를 직관적으로 보여주고, 접근성을 고려한 UI를 구현합니다.

### 3.1 상태 관리 Hook 구현

- [x] **[Hook] `useDocumentStatus.ts` 구현**
  - **내용:** `SWR` 폴링 로직 구현.
  - **최적화:** `data` 내에 `processing_*` 상태인 문서가 하나라도 있을 때만 `refreshInterval`을 3000ms로 설정, 아니면 0(비활성).

### 3.2 UI 컴포넌트 업그레이드

- [x] **[UI] `ReferenceItem` 컴포넌트 구현**

  - **파일:** `frontend/src/components/Assistant/ReferenceItem.tsx`
  - **내용:**
    - `DocumentStatus` Enum을 import하여 상태별 분기 처리.
    - **접근성:** `aria-live="polite"` 영역에 현재 상태 텍스트 렌더링.
    - **상태 매핑:**
      - `DocumentStatus.PARSING`: "텍스트 추출 중..."
      - `DocumentStatus.CHUNKING`: "내용 분석 중..."
      - `DocumentStatus.EMBEDDING`: "AI 학습 중..."
    - **에러 표시:** `DocumentStatus.FAILED`일 때 빨간색 아이콘 및 툴팁으로 `error_message` 표시.

- [x] **[UI] `ReferenceTab.tsx` 연동**
  - **내용:** 기존 리스트를 `ReferenceItem`으로 교체하고 Hook 연동.

### ✅ Phase 3 검증

- [ ] **E2E Test:** 파일 업로드 후 "대기 중" -> "완료"까지의 UI 변화를 육안 또는 자동화 테스트로 확인.
- [ ] **UX Test:** 처리 도중 새로고침 해도 상태가 유지되는지(DB 기반) 확인.
- [ ] **Accessibility:** 스크린 리더가 상태 변화를 감지하는지 확인.

---

## Phase 4: 통합 테스트 및 배포

**목표:** 전체 시스템의 안정성을 확인하고 배포합니다.

### 4.1 통합 테스트

- [ ] **[Test] 동시성 테스트:** 여러 파일을 동시에 업로드했을 때 상태가 섞이지 않고 각각 잘 업데이트되는지 확인.
- [ ] **[Test] 타임아웃 시뮬레이션:** (가능하다면) 처리가 오래 걸리는 상황을 연출하여 UI가 멈추지 않는지 확인.

### 4.2 배포 준비

- [ ] **[Deploy] Vercel 배포**
- [ ] **[Migration] 운영 DB 마이그레이션 실행** (`027_add_document_status.sql`)

### ✅ Phase 4 검증

- [ ] 배포 후 라이브 환경에서 파일 업로드 및 RAG 검색 정상 동작 확인.
