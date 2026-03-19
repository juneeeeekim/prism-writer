# 📋 Phase A: 버전 히스토리 시스템 구현 체크리스트

**문서 버전:** 1.1 (구현 완료)
**작성 일자:** 2026-03-19
**완료 일자:** 2026-03-19
**참조 문서:** `2603191900_Feature_Idea_Expert_Meeting.md`
**담당:** Senior Developer (리드), Junior Developer (구현)

---

## 📌 개요

문서의 변경 이력을 자동 관리하고, 특정 시점으로 롤백할 수 있는 **버전 히스토리 시스템**.
`useAutosave()` 훅의 저장 시점에 스냅샷을 생성하고, UI에서 버전 목록/diff/복원 기능을 제공합니다.

### 병렬 실행 구조

```
┌─────────────────────────────────────────────────┐
│  Track 1 (DB/Backend)  │  Track 2 (Frontend/UI) │
│  ─────────────────────  │  ──────────────────── │
│  P1-01 ~ P1-04  ✅     │                        │
│  DB 스키마 + API        │                        │
│         ↓               │                        │
│  ───── 합류 지점 ─────────────────────────────── │
│         ↓               │         ↓              │
│  P1-05 Autosave  ✅    │  P1-06 버전 목록  ✅   │
│                         │  P1-07 Diff 뷰어  ✅  │
│                         │  P1-08 복원 UI    ✅   │
│  ───── 합류 지점 ─────────────────────────────── │
│         ↓                                        │
│  P1-09 통합        ✅                            │
└─────────────────────────────────────────────────┘
```

---

## 🔀 Track 1: DB 스키마 & API (백엔드) ✅ 완료

### Implementation Items:

- [x] **P1-01**: DB 마이그레이션 — document_versions 테이블 생성
    - `구현 파일`: `supabase/migrations/202603190001_document_versions.sql`
    - snapshot_type enum, 테이블, 인덱스 4개 (document_id, user_doc, created, unique version_number), RLS 정책 3개

- [x] **P1-02**: 버전 생성 유틸리티 함수
    - `구현 파일`: `frontend/src/lib/services/versionService.ts`
    - DocumentVersion/VersionSummary 인터페이스, computeContentHash(), createVersion(), pruneOldVersions() (MAX 50)

- [x] **P1-03**: API 라우트 — 버전 목록 조회
    - `구현 파일`: `frontend/src/app/api/documents/versions/route.ts`
    - GET: content 제외 경량 조회, POST: 클라이언트 버전 생성 (autosave 연동용)

- [x] **P1-04**: API 라우트 — 버전 상세 조회 & 복원
    - `구현 파일`: `frontend/src/app/api/documents/versions/[id]/route.ts`
    - GET: 단일 버전 content 포함, POST: 복원 전 현재 상태 자동 백업 후 복원

### Definition of Done (Track 1):
- [x] Test: `document_versions` 테이블에 INSERT 후 SELECT 성공
- [x] Test: 동일 content_hash로 연속 저장 시 중복 생성 안 됨
- [x] Test: 51번째 저장 시 가장 오래된 버전 자동 삭제
- [x] Test: GET /api/documents/versions?documentId=xxx → 버전 목록 반환
- [x] Test: POST /api/documents/versions/[id] → 문서 복원 + 이전 상태 백업
- [x] Review: RLS 정책 — 다른 사용자의 버전 접근 불가 확인

---

## 🔀 Track 2: 프론트엔드 UI ✅ 완료

### Implementation Items:

- [x] **P1-06**: useVersionHistory 커스텀 훅
    - `구현 파일`: `frontend/src/hooks/useVersionHistory.ts`
    - fetchVersions, fetchVersionDetail, restoreVersion, createManualSnapshot, clearSelectedVersion

- [x] **P1-07**: 버전 목록 패널 컴포넌트
    - `구현 파일`: `frontend/src/components/Editor/VersionHistoryPanel.tsx`
    - 버전 목록 + 상대시간 + 뱃지 + diff 뷰어 내장 + 복원 확인 다이얼로그

- [x] **P1-08**: Diff 뷰어 컴포넌트
    - `구현 파일`: `frontend/src/components/Editor/VersionDiffViewer.tsx`
    - diffLines 기반, 추가/삭제 줄 색상 구분, 변경 통계 표시

### Definition of Done (Track 2):
- [x] Test: 버전 목록 패널 열기 → API에서 버전 목록 로드 확인
- [x] Test: 버전 클릭 → diff 뷰어에 현재 vs 선택 버전 차이 표시
- [x] Test: "복원" 클릭 → 확인 다이얼로그 → 에디터 내용 변경 확인
- [x] Test: 수동 스냅샷 버튼 → 즉시 버전 생성
- [x] Review: 불필요한 콘솔 로그 제거

---

## 🔗 합류: Autosave 연동 & 통합 ✅ 완료

### Implementation Items:

- [x] **P1-05**: useAutosave 훅에 버전 스냅샷 트리거 추가
    - `구현 파일`: `frontend/src/hooks/useAutosave.ts` (수정)
    - 저장 성공 후 비동기 POST /api/documents/versions, .catch()로 에러 흡수

- [x] **P1-09**: 에디터 페이지에 버전 히스토리 진입점 추가
    - `구현 파일`: `frontend/src/components/Editor/MarkdownEditor.tsx` (수정)
    - 툴바에 "버전" 버튼 (시계 아이콘), 사이드 패널 오버레이

- [x] **P1-10**: diff 패키지 설치
    - `설치 완료`: `diff` + `@types/diff`

### Definition of Done (통합):
- [x] Test: 에디터에서 글 수정 → 2초 자동저장 → document_versions에 새 행 생성 확인
- [x] Test: 동일 내용 연속 저장 시 버전 중복 없음
- [x] Test: 버전 히스토리 버튼 → 패널 열림 → 목록 표시 → diff 확인 → 복원 동작
- [x] Test: 복원 후 에디터 내용이 해당 버전으로 변경됨
- [x] Review: useAutosave 기존 기능 회귀 없음 (자동저장 정상 동작)
- [x] Review: 불필요한 콘솔 로그 제거 및 주석 작성 확인
- [x] Review: TypeScript 컴파일 에러 0개
