# JeDebug Analysis: 목차 제안 RAG 통합 개선

## Context Setting

- **Project Domain**: PRISM Writer - 목차 제안 UX 개선
- **Tech Stack**: Next.js 14, React 18, TypeScript, Zustand
- **Review Target**: 2512260040_Outline_RAG_Enhancement_Checklist.md
- **Scope**: Frontend UI Enhancement (Low Risk)
- **Risk Level**: Low - 단순 UI 추가

---

# 1) 🚨 위험 요소 및 디버깅 포인트 (Risk Checklist)

- [ ] (Low) 상태 초기화 누락으로 인한 잔여 데이터 표시 위험

  - [ ] 원인 분석: `sourcesUsed` 상태가 새 목차 생성 시 초기화되지 않으면 이전 값이 잔존
  - [ ] 해결 가이드: `handleGenerate` 함수 시작 시 `setSourcesUsed(0)` 호출 추가
  - [ ] 파일: `frontend/src/components/Assistant/OutlineTab.tsx`
  - [ ] 위치: `handleGenerate` 함수, Line 33 근처
  - [ ] 연결성: Phase 1.5 (초기화 로직 추가) 작업과 연결
  - [ ] 완료조건: 목차 재생성 시 이전 배지가 초기화된 후 새 값으로 업데이트됨 확인

- [ ] (Low) 다크모드 스타일 누락으로 인한 가독성 저하

  - [ ] 원인 분석: 새 UI 요소에 `dark:` 접두사 누락 시 다크모드에서 텍스트/배경 대비 불량
  - [ ] 해결 가이드: 모든 새 요소에 `dark:bg-*`, `dark:text-*` 클래스 명시
  - [ ] 파일: `frontend/src/components/Assistant/OutlineTab.tsx`
  - [ ] 위치: Phase 1.3, 1.4에서 추가하는 JSX 요소
  - [ ] 연결성: 브라우저 테스트 단계에서 검증
  - [ ] 완료조건: 다크모드 전환 시 모든 새 요소가 정상 색상으로 표시됨

- [x] (Low) 기존 레이아웃 깨짐 위험
  - [x] 원인 분석: 새 배지/경고 UI 추가로 기존 목차 리스트 영역 레이아웃 간섭 가능
  - [x] 해결 가이드: `flex`, `gap` 클래스로 간격 조정, 기존 `space-y-*` 패턴 유지
  - [x] 파일: `frontend/src/components/Assistant/OutlineTab.tsx`
  - [x] 위치: Line 130-178 (생성된 목차 영역) 구현 완료
  - [x] 연결성: Phase 1 검증 단계의 레이아웃 테스트
  - [x] 완료조건: 기존 목차 리스트 및 삽입 버튼 위치 변화 없음

---

# 2) 🧪 필수 테스트 및 검증 시나리오 (Verification Checklist)

- [ ] Regression Test 케이스

  - [ ] [RT-1] 주제 입력 후 목차 생성 버튼 클릭 → 로딩 스피너 표시
    - [ ] Given: 주제 "AI 글쓰기" 입력
    - [ ] When: "목차 생성" 버튼 클릭
    - [ ] Then: 스피너와 "생성 중..." 텍스트 표시
    - [ ] 완료조건: 기존 로딩 UI 정상 동작
  - [ ] [RT-2] 목차 생성 완료 → 목차 리스트 정상 렌더링
    - [ ] Given: 목차 생성 요청 완료
    - [ ] When: API 응답 수신
    - [ ] Then: `outline` 배열의 각 항목이 depth에 맞게 들여쓰기되어 표시
    - [ ] 완료조건: 기존 목차 표시 로직 정상
  - [ ] [RT-3] "에디터에 삽입" 버튼 클릭 → 에디터 content에 목차 삽입
    - [ ] Given: 생성된 목차 존재
    - [ ] When: "에디터에 삽입" 버튼 클릭
    - [ ] Then: `useEditorState.insertOutline()` 호출되어 에디터에 마크다운 목차 삽입
    - [ ] 완료조건: 에디터 내용에 `# 제목` 형식 목차 추가됨
  - [ ] [RT-4] 빈 주제 입력 시 에러 메시지 표시
    - [ ] Given: 주제 입력란 비어있음
    - [ ] When: "목차 생성" 버튼 클릭
    - [ ] Then: "주제를 입력해주세요." 에러 메시지 표시
    - [ ] 완료조건: 클라이언트 검증 정상
  - [ ] [RT-5] API 에러 시 에러 메시지 표시
    - [ ] Given: API 500 응답
    - [ ] When: 응답 수신
    - [ ] Then: 빨간색 에러 배너 표시
    - [ ] 완료조건: 에러 핸들링 정상
  - [ ] 테스트 코드 위치: (수동 브라우저 테스트)
  - [ ] 완료조건: 위 5개 케이스 모두 통과

- [ ] Migration Test 시나리오

  - [ ] [MT-1] API 응답의 `sourcesUsed` 값이 UI 배지에 정확히 반영
    - [ ] 검증 방법: 콘솔에서 API 응답 확인 → UI 배지 숫자 일치 확인
    - [ ] 완료조건: `data.sourcesUsed === 배지에 표시된 숫자`
  - [ ] [MT-2] `sourcesUsed === 0`일 때 경고 메시지 표시
    - [ ] 검증 방법: 참고자료 없이 목차 생성 → 경고 UI 표시 확인
    - [ ] 완료조건: 경고 메시지 렌더링됨
  - [ ] [MT-3] `sourcesUsed > 0`일 때 배지만 표시 (경고 없음)
    - [ ] 검증 방법: 참고자료 업로드 후 목차 생성 → 배지만 표시 확인
    - [ ] 완료조건: 배지 표시 + 경고 미표시

- [ ] Load Test 기준 (Client-side)
  - [ ] 목표: 목차 생성 버튼 클릭 → 응답까지 P95 < 5초
  - [ ] 병목 후보: Gemini API 응답 시간 (서버 측, 변경 대상 아님)
  - [ ] 완료조건: 기존 성능 저하 없음 (UI 추가만으로 성능 영향 미미)

---

# 3) 🛑 롤백 및 비상 대응 전략 (Rollback Checklist)

- [ ] Feature Flag / Kill Switch 존재 여부 확인

  - [ ] 플래그 이름: `ENABLE_PIPELINE_V5` (백엔드 API에 적용됨)
  - [ ] 프론트엔드 UI에는 별도 플래그 없음 (확인 필요 - 추가 여부 결정)
  - [ ] 비상 시 OFF 절차: Vercel 환경변수 수정 또는 `git revert`
  - [ ] 완료조건: 롤백 시 이전 UI로 복원됨

- [ ] 롤백 시나리오 정의

  - [ ] 롤백 트리거 조건: UI 렌더링 에러 또는 레이아웃 깨짐 발생
  - [ ] 롤백 수행자: 시니어 개발자
  - [ ] 롤백 방법: `git revert HEAD` → `git push`
  - [ ] 완료조건: 롤백 후 기존 OutlineTab UI 정상 표시

- [ ] 데이터 롤백 불가 지점 식별
  - [ ] 해당 없음: 프론트엔드 UI 변경만 포함 (Read-only, 데이터 변경 없음)
  - [ ] 완료조건: N/A

---

# 4) 추가 확인 필요사항 (Unknowns Checklist)

- [ ] (문서에 명시 없음) Phase 2 (문서 선택 기능) 구현 여부 결정 필요
- [ ] (문서에 명시 없음) `sourcesUsed === 0`일 때 목차 생성 자체를 차단할지 여부
- [ ] (문서에 명시 없음) 배지 클릭 시 사용된 참고자료 목록 표시 기능 추가 여부
- [ ] (문서에 명시 없음) 경고 메시지에서 "참고자료 업로드" 페이지로 이동 링크 추가 여부
- [ ] (문서에 명시 없음) 참고자료 0개일 때 "일반 목차 생성" vs "차단" 정책 결정

---

# 5) 최종 의견 (Conclusion Checklist)

- [x] Confidence 선택: **High**
- [x] Go/No-Go 선택: **Ready to Build** ✅
- [x] 결정 근거 1: 변경 범위가 `OutlineTab.tsx` 단일 파일, UI 요소 추가에 국한됨
- [x] 결정 근거 2: 백엔드 API 변경 없음 (이미 `sourcesUsed` 응답 제공 중)
- [x] 결정 근거 3: 기존 기능 회귀 위험 Low (조건부 렌더링 추가만)
- [x] 결정 근거 4: 롤백이 `git revert` 한 줄로 즉시 가능
- [ ] 최종 완료조건: Phase 1 검증 체크리스트 전체 통과 + Vercel 배포 성공
