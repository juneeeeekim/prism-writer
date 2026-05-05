# AI 채팅 기능 활성화 체크리스트

> 작성일: 2025-12-25  
> 파일명: `2512251118_ChatFeatureActivation_Checklist.md`

---

## 📁 체크리스트 파일 구성 결정

### 선택: **단일 파일 (1개)**

**근거:**

1. **작업 범위가 간단함**: 환경 변수 설정만 필요하며 코드 수정 없음
2. **의존성이 선형적**: Phase 간 복잡한 연결이 없음
3. **단독 검증 가능**: 각 Phase가 독립적으로 짧게 완료됨
4. **협업 효율**: 팀원 3명이 순차적으로 확인하기에 단일 문서가 효율적

---

## 👥 협업 팀 구성

| 역할             | 담당                   |
| ---------------- | ---------------------- |
| 🧑‍💼 시니어 개발자 | 전체 검증 및 최종 승인 |
| 👨‍💻 주니어 개발자 | 환경 변수 설정 실행    |
| 🎨 UX/UI 개발자  | 사용자 기능 테스트     |

---

## 🔍 영향 범위 분석

### ⚠️ 영향받을 수 있는 기존 기능

| 기능                           | 영향 수준 | 확인 방법                     |
| ------------------------------ | --------- | ----------------------------- |
| AI 채팅 탭 기본 동작           | Low       | 메시지 전송/응답 확인         |
| 기존 사용자 세션               | None      | 신규 테이블, 기존 데이터 없음 |
| 인증/로그인                    | None      | 변경 없음                     |
| 다른 탭 (목차, 참고자료, 평가) | None      | 변경 없음                     |

---

# Phase 1: 환경 변수 설정 (로컬)

**담당: 👨‍💻 주니어 개발자**  
**예상 시간: 5분**

## 사전 조건

- [ ] `frontend` 디렉토리 접근 가능
- [ ] 개발 서버 실행 가능 (`npm run dev`)

## 1.1 환경 변수 파일 확인/생성

### 📂 대상 파일: `frontend/.env.local`

- [x] **파일 존재 여부 확인**

  - 위치: `c:\Users\chyon\Desktop\01.Project\00.Program\prismLM\frontend\.env.local`
  - 없으면 새로 생성 → `.env.example`에서 복사하여 생성 완료

- [x] **환경 변수 3개 추가**
  ```bash
  # AI 채팅 기록 기능 활성화
  NEXT_PUBLIC_ENABLE_CHAT_HISTORY=true
  NEXT_PUBLIC_ENABLE_CHAT_HISTORY_UI=true
  NEXT_PUBLIC_ENABLE_CHAT_SESSION_LIST=true
  ```

### 📋 품질 체크

- [x] 변수명 정확성 (`NEXT_PUBLIC_` 접두사 확인)
- [x] 값이 정확히 `true` (따옴표 없음)
- [x] 기존 환경 변수 덮어쓰기 없음

---

## 1.2 설정 확인

### 📂 참조 파일: `frontend/src/lib/features.ts`

- [ ] **Feature Flag 연결 확인** (코드 수정 불필요, 참조만)
  - Line 25: `CHAT_HISTORY_SAVE` → `NEXT_PUBLIC_ENABLE_CHAT_HISTORY`
  - Line 32: `CHAT_HISTORY_UI` → `NEXT_PUBLIC_ENABLE_CHAT_HISTORY_UI`
  - Line 39-40: `CHAT_SESSION_LIST` → `NEXT_PUBLIC_ENABLE_CHAT_SESSION_LIST`

---

## Phase 1 검증 체크리스트

### ✅ Syntax/설정 검증

- [ ] `.env.local` 파일 문법 오류 없음 (공백, 특수문자)
- [ ] 환경 변수 3개 모두 추가됨

### ✅ 개발 서버 테스트

```bash
cd frontend
npm run dev
```

- [ ] 서버 정상 시작 (http://localhost:3000)
- [ ] 콘솔에 환경 변수 관련 오류 없음

### ✅ 기존 기능 정상 동작

- [ ] 로그인/로그아웃 정상
- [ ] 에디터 페이지 접근 가능
- [ ] 다른 탭 (목차, 참고자료, 평가) 정상 동작

---

# Phase 2: 기능 동작 검증 (로컬)

**담당: 🎨 UX/UI 개발자**  
**예상 시간: 10분**  
**의존성: Phase 1 완료**

## 사전 조건

- [ ] Phase 1의 모든 검증 항목 통과
- [ ] 개발 서버 실행 중

## 2.1 UI 표시 확인

### 📂 참조 컴포넌트: `AssistantPanel.tsx`, `ChatSessionList.tsx`

- [ ] **에디터 페이지 접속** (`http://localhost:3000/editor`)
- [ ] **AI 채팅 탭 선택**
- [ ] **세션 목록 사이드바 표시 확인**
  - 좌측에 "새 대화" 버튼이 보여야 함
  - 세션 목록 영역이 표시되어야 함

### 📋 품질 체크 (UI/UX)

- [ ] 반응형 레이아웃 정상 (사이드바 + 채팅 영역)
- [ ] 다크모드/라이트모드 모두 정상 표시
- [ ] 버튼에 적절한 hover 효과 있음

---

## 2.2 새 대화 생성 기능

### 📂 참조 파일: `ChatSessionList.tsx` → `handleCreateNew()` (Line 55-77)

- [ ] **"+ 새 대화" 버튼 클릭**
- [ ] **새 세션 생성됨**
  - 세션 목록에 "새 대화" 항목 추가
  - 해당 세션이 자동 선택됨

### 📋 품질 체크 (기능)

- [ ] 버튼 클릭 시 로딩 상태 표시 ("생성 중...")
- [ ] 에러 발생 시 콘솔에 로그 출력 (에러 처리 존재)
- [ ] 중복 클릭 방지 (`isCreating` 상태)

---

## 2.3 메시지 전송 및 저장 확인

### 📂 참조 파일: `ChatTab.tsx` → `handleSend()` (Line 87-197)

- [ ] **메시지 입력 및 전송**
  - 텍스트 입력 후 Enter 또는 전송 버튼 클릭
- [ ] **응답 수신 확인**
  - AI 응답이 스트리밍으로 표시됨
- [ ] **DB 저장 확인 (Supabase Dashboard)**
  - `chat_messages` 테이블에 user/assistant 메시지 저장됨

### 📋 품질 체크 (기능)

- [ ] 전송 중 버튼 비활성화 (중복 전송 방지)
- [ ] 에러 발생 시 사용자에게 메시지 표시
- [ ] 메시지별 타임스탬프 표시

---

## 2.4 대화 기록 유지 확인

- [ ] **페이지 새로고침 (F5)**
- [ ] **동일 세션 선택 시 이전 대화 유지**

  - 저장된 메시지가 로드됨

- [ ] **다른 세션 선택 후 다시 돌아오기**
  - 세션별 대화 내용이 분리됨

---

## 2.5 세션 삭제 기능

### 📂 참조 파일: `ChatSessionList.tsx` → `handleDelete()` (Line 79-100)

- [ ] **세션 항목에 마우스 hover**
  - 삭제 버튼 (휴지통 아이콘) 표시됨
- [ ] **삭제 버튼 클릭**
  - 확인 다이얼로그 표시
- [ ] **삭제 확인 시 세션 제거됨**
  - 목록에서 사라짐
  - 관련 메시지도 함께 삭제됨 (CASCADE)

### 📋 품질 체크 (접근성)

- [ ] 삭제 버튼에 `aria-label="대화 삭제"` 존재
- [ ] 키보드 접근 가능

---

## Phase 2 검증 체크리스트

### ✅ UI/UX 검증

- [ ] 세션 목록 사이드바 정상 표시
- [ ] 새 대화 버튼 동작
- [ ] 세션 선택/전환 동작
- [ ] 삭제 기능 동작

### ✅ 데이터 저장 검증

- [ ] 메시지 DB 저장 확인 (Supabase)
- [ ] 페이지 새로고침 후 대화 유지

### ✅ 기존 기능 정상 동작

- [ ] 일반 채팅 응답 정상 (RAG 검색 포함)
- [ ] 다른 탭 기능 영향 없음

---

# Phase 3: 프로덕션 배포 (Vercel)

**담당: 🧑‍💼 시니어 개발자**  
**예상 시간: 10분**  
**의존성: Phase 2 완료**

## 사전 조건

- [ ] Phase 2의 모든 검증 항목 통과
- [ ] Vercel 대시보드 접근 권한

## 3.1 Vercel 환경 변수 설정

### 📂 위치: Vercel Dashboard → Project → Settings → Environment Variables

- [ ] **환경 변수 3개 추가**

| Name                                   | Value  | Environment                      |
| -------------------------------------- | ------ | -------------------------------- |
| `NEXT_PUBLIC_ENABLE_CHAT_HISTORY`      | `true` | Production, Preview, Development |
| `NEXT_PUBLIC_ENABLE_CHAT_HISTORY_UI`   | `true` | Production, Preview, Development |
| `NEXT_PUBLIC_ENABLE_CHAT_SESSION_LIST` | `true` | Production, Preview, Development |

---

## 3.2 재배포

- [ ] **Deployments 탭으로 이동**
- [ ] **최신 배포에서 "Redeploy" 클릭**
  - 또는 새 커밋 푸시로 자동 배포
- [ ] **배포 완료 대기** (약 2-3분)

---

## 3.3 프로덕션 검증

- [ ] **프로덕션 사이트 접속**
- [ ] **Phase 2의 모든 기능 테스트 재수행**
  - 새 대화 생성
  - 메시지 전송/저장
  - 대화 기록 유지
  - 세션 삭제

---

## Phase 3 검증 체크리스트

### ✅ 배포 검증

- [ ] Vercel 배포 성공 (녹색 체크)
- [ ] 빌드 로그에 오류 없음

### ✅ 프로덕션 기능 검증

- [ ] 세션 목록 표시
- [ ] 새 대화 생성
- [ ] 메시지 저장/로드
- [ ] 기존 기능 정상

---

# 최종 검증 및 완료

## 전체 체크리스트 요약

| Phase                   | 담당             | 상태 |
| ----------------------- | ---------------- | ---- |
| Phase 1: 환경 변수 설정 | 👨‍💻 주니어 개발자 | [ ]  |
| Phase 2: 로컬 기능 검증 | 🎨 UX/UI 개발자  | [ ]  |
| Phase 3: 프로덕션 배포  | 🧑‍💼 시니어 개발자 | [ ]  |

## 📋 완료 조건

- [ ] 모든 Phase 검증 항목 통과
- [ ] 기존 기능 회귀 없음
- [ ] 프로덕션에서 정상 동작

---

## 🔄 롤백 계획

문제 발생 시 즉시 롤백 가능:

1. Vercel Dashboard에서 환경 변수 3개 삭제
2. 재배포 실행
3. Feature Flag가 `false`로 돌아가 기존 동작 복원

---

## 📝 참고 문서

- [회의 결과](file:///C:/Users/chyon/.gemini/antigravity/brain/0001eae9-223e-43ed-a6ef-407beb8f55f4/implementation_plan.md)
- Feature Flag 설정: `frontend/src/lib/features.ts`
- API 엔드포인트: `frontend/src/app/api/chat/sessions/route.ts`
