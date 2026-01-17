# 에디터 저장/내보내기 기능 구현 기술 정의서

## 1. 개요 (Overview)

사용자가 리포트한 "저장 버튼 무반응" 문제를 해결하고, 미구현 상태인 "내보내기" 기능을 구현하기 위한 기술 계획서입니다.
투표 결과, 안정적이고 명확한 기능 구현을 위해 **선(先) 정의, 후(後) 개발** 방식을 채택했습니다.

## 2. 문제 분석 (Problem Analysis)

### 2.1 저장 버튼 (Save)

- **현상**: 클릭 시 반응이 없음.
- **원인 추정**:
  - `alert()` 함수가 브라우저 설정이나 확장 프로그램에 의해 차단되었을 가능성.
  - 비동기 로직(`saveDocument`) 실행 중 UI 피드백(로딩 등) 부족.
  - 에러 발생 시 콘솔(`console.error`)에만 찍히고 사용자에게 전달되지 않음.
- **해결 방안**:
  - `alert()` 제거하고 시스템 표준 `useToast` 사용.
  - 버튼에 `Loading Spinner` 추가하여 작업 진행 상태 표시.
  - 저장 실패 시 명확한 에러 메시지(로그인 필요, 제목 없음 등) 표시.

### 2.2 내보내기 버튼 (Export)

- **현상**: 기능 미구현 (Console Log만 출력).
- **해결 방안**:
  - 다양한 포맷(Markdown, HTML, PDF) 지원.
  - 클라이언트 사이드 라이브러리 활용하여 문서 내보내기 구현.

## 3. 구현 상세 (Implementation Details)

### Phase 1: 저장 기능 UX 개선

- **Target File**: `frontend/src/app/editor/page.tsx`, `frontend/src/components/auth/AuthHeader.tsx`
- **변경 사항**:
  - `AuthHeader`에 `isSaving` prop 추가하여 로딩 상태 전달.
  - `handleSave` 함수에서 `alert` -> `toast.success/error` 교체.
  - 유효성 검사 실패 시 (제목 없음 등) `toast.warning` 표시.

### Phase 2: 내보내기 기능 구현

- **Target File**: `frontend/src/app/editor/page.tsx`, `frontend/src/utils/exportUtils.ts` (신규)
- **기능 명세**:
  - 사용자 클릭 시 **내보내기 옵션 모달** 또는 **드롭다운** 표시.
  - **지원 포맷**:
    1. **Markdown (.md)**: 에디터의 원본 텍스트 다운로드. (가장 정확)
    2. **HTML (.html)**: 렌더링된 HTML 다운로드.
    3. **PDF (.pdf)**: 브라우저 인쇄 기능(`window.print`) 활용 또는 `html2pdf.js` 라이브러리 도입.
       - _권장_: 우선 `window.print()` 스타일을 최적화하여 "PDF로 저장"을 유도하고, 추후 라이브러리 도입 고려. (구현 복잡도 최소화)

## 4. 작업 체크리스트 (Checklist)

### Phase 1: 저장 UX (Priority: High)

- [ ] `AuthHeader` Props 인터페이스 수정 (`isSaving?: boolean`)
- [ ] `EditorPage`의 `handleSave` 로직 개선 (Toast 적용)
- [ ] 저장 중 버튼 비활성화 및 로딩 아이콘 표시

### Phase 2: 내보내기 (Priority: Medium)

- [ ] `handleExport` 핸들러 구현
- [ ] 파일 다운로드 유틸리티 함수 구현 (`downloadFile(filename, content, mimeType)`)
- [ ] Markdown 내보내기 연결
- [ ] (선택) PDF 내보내기 (Print Style 적용)

## 5. 투표 결과 반영

- **결정**: 기술 정의서 작성 후 진행 (B안)
- **이유**: 사용자가 "작동 안 함"을 리포트했으므로, 단순 구현보다는 UX 결함을 수정하는 것이 우선이며, 내보내기 기능의 범위를 명확히 해야 함.
