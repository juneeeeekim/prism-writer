# 📋 Phase C: AI 글쓰기 코치 페르소나 구현 체크리스트

**문서 버전:** 1.1 (구현 완료)
**작성 일자:** 2026-03-19
**완료 일자:** 2026-03-19
**참조 문서:** `2603191900_Feature_Idea_Expert_Meeting.md`
**담당:** Senior Developer (리드), Junior Developer (구현)

---

## 📌 개요

업로드된 문서에서 **저자의 문체/어투/표현 패턴을 추출**하여 "나만의 글쓰기 코치"를 생성하고,
이 코치가 사용자의 글에 대해 **스타일 기반 맞춤 피드백**을 제공하는 시스템.

### 병렬 실행 구조

```
┌────────────────────────────────────────────────────────────┐
│  Track 1 (DB/Backend) ✅  │  Track 2 (프롬프트/LLM) ✅     │
│  ───────────────────────   │  ──────────────────────────── │
│  P3-01 DB 스키마            │  P3-04 스타일 분석 서비스      │
│  P3-02 코치 CRUD API        │  P3-05 코치 피드백 프롬프트    │
│  P3-03 스타일 추출 API      │  P3-06 LLM 사용맵 컨텍스트    │
│  ────── 합류 지점 ──────────────────────────────────────── │
│         ↓                  │         ↓                     │
│  Track 3 (UI + 통합)  ✅                                   │
│  P3-07 코치 훅                                              │
│  P3-08 코치 관리 UI                                         │
│  P3-09 채팅 API 연동                                        │
│  P3-10 채팅 UI 연동                                         │
└────────────────────────────────────────────────────────────┘
```

---

## 🔀 Track 1: DB 스키마 & API ✅ 완료

### Implementation Items:

- [x] **P3-01**: DB 마이그레이션 — writing_coaches 테이블 생성
    - `구현 파일`: `supabase/migrations/202603190002_writing_coaches.sql`
    - writing_coaches 테이블 + 인덱스 2개 + RLS 4개 정책 + updated_at 트리거

- [x] **P3-02**: 코치 CRUD API
    - `구현 파일`: `frontend/src/app/api/coaches/route.ts`
    - GET (목록, style_profile 제외), POST (생성 + 문서 소유권 검증), PUT (부분 수정), DELETE

- [x] **P3-03**: 스타일 프로파일 추출 API
    - `구현 파일`: `frontend/src/app/api/coaches/analyze/route.ts`
    - POST: 청크 30개 수집 → 8000자 제한 → LLM 스타일 분석 → JSON 파싱 → DB 저장
    - 코치/문서 소유권 이중 검증, 응답 필드 7개 유효성 검증

### Definition of Done (Track 1):
- [x] Test: POST /api/coaches → 코치 생성 → GET으로 조회 확인
- [x] Test: POST /api/coaches/analyze → style_profile JSONB 정상 저장
- [x] Test: 다른 사용자의 코치 접근 → 빈 결과
- [x] Test: 존재하지 않는 문서 ID → 적절한 에러 메시지
- [x] Review: RLS 정책 동작 확인

---

## 🔀 Track 2: 프롬프트 엔지니어링 & LLM 설정 ✅ 완료

### Implementation Items:

- [x] **P3-04**: 스타일 분석 서비스 함수
    - `구현 파일`: `frontend/src/lib/services/coachService.ts`
    - StyleProfile 인터페이스 + analyzeWritingStyle() + normalizeStyleProfile()
    - 8000자 truncate, """ 구분자, JSON 파싱 (raw/코드블록 대응)

- [x] **P3-05**: 코치 기반 피드백 프롬프트 생성 함수
    - `구현 파일`: `frontend/src/lib/services/coachService.ts` (동일 파일)
    - buildCoachSystemPrompt(): 코치 소개 + 스타일 특성 + 피드백 규칙 5개

- [x] **P3-06**: LLM 사용맵에 코치 컨텍스트 추가
    - `구현 파일`: `frontend/src/config/llm-usage-map.ts` (수정)
    - 'coach.style.analysis' (temp 0.3) + 'coach.persona.feedback' (temp 0.7) 추가
    - 기존 매핑 변경 없음

### Definition of Done (Track 2):
- [x] Test: analyzeWritingStyle()에 샘플 텍스트 → StyleProfile JSON 반환
- [x] Test: buildCoachSystemPrompt()로 생성된 프롬프트가 올바른 형식
- [x] Test: LLM 사용맵 validateUsageMap() 통과
- [x] Review: 프롬프트에 프롬프트 인젝션 방어 (사용자 텍스트 구분자 `"""`)

---

## 🔗 합류: UI & 채팅 연동 ✅ 완료

### Implementation Items:

- [x] **P3-07**: useCoach 커스텀 훅
    - `구현 파일`: `frontend/src/hooks/useCoach.ts`
    - coaches[], activeCoach, isAnalyzing 상태 관리
    - fetchCoaches, createCoach (생성→분석), activateCoach, deleteCoach, updateCoach
    - localStorage 영속화 (prism_active_coach_id)

- [x] **P3-08**: 코치 관리 UI 컴포넌트
    - `구현 파일`: `frontend/src/components/Coach/CoachManager.tsx`
    - 코치 목록 카드 + 활성 코치 배너 + 생성 다이얼로그 (이름/설명/아이콘/문서 선택)
    - 수정 다이얼로그 + 삭제 확인 다이얼로그

- [x] **P3-09**: 채팅 API에 코치 페르소나 주입
    - `구현 파일`: `frontend/src/app/api/chat/route.ts` (수정)
    - coachId 파라미터 추가 → writing_coaches 조회 → buildCoachSystemPrompt() → 기존 시스템 프롬프트에 APPEND
    - 코치 미선택 시 기존 동작 100% 동일

- [x] **P3-10**: 채팅 UI에 코치 선택기 추가
    - `구현 파일`: `frontend/src/components/Assistant/ChatTab.tsx` (수정) + `frontend/src/hooks/useChat.ts` (수정)
    - 활성 코치 뱃지 (클릭으로 비활성화) + "코치 선택" 버튼 → CoachManager 오버레이
    - useChat에 coachId 전달 → /api/chat fetch body에 포함

### Definition of Done (통합):
- [x] Test: 코치 생성 → 문서 선택 → 스타일 분석 → 프로파일 저장 전체 플로우
- [x] Test: 코치 활성화 후 채팅 → 코치 스타일 반영된 응답 확인
- [x] Test: 코치 비활성화 후 채팅 → 기존과 동일한 응답
- [x] Test: 코치 삭제 후 채팅 → 에러 없이 기본 동작
- [x] Review: `/api/chat/route.ts` 회귀 — 코치 없이 기존 채팅 정상 동작
- [x] Review: 불필요한 콘솔 로그 제거 및 주석 작성 확인
- [x] Review: TypeScript 컴파일 에러 0개
