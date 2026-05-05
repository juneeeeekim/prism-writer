# 📋 RAFT Q&A 검토/삭제 기능 구현 체크리스트

**작성일**: 2025-12-29
**작성자**: Tech Lead
**원본 문서**: `implementation_plan.md`
**상태**: 🔴 구현 대기

---

## 📁 1. File & Structure Decision

### 파일 구성 전략

- **API 확장**: 기존 `/api/raft/dataset` 엔드포인트에 `PATCH` 메서드를 추가하여 품질 평점 업데이트 지원.
- **UI 개선**: `RAFTDatasetList` 컴포넌트에 평점 UI 및 삭제 모달 로직 강화.

### 저장 위치

```
plan_report/2512290015_RAFT_Review_Feature_체크리스트.md
```

### 파일 개요

| 파일                                                | 상태   | 역할                      | 예상 라인 수 |
| --------------------------------------------------- | ------ | ------------------------- | ------------ |
| `frontend/src/app/api/raft/dataset/route.ts`        | MODIFY | 평점 업데이트 API 핸들러  | +50줄        |
| `frontend/src/lib/api/raft.ts`                      | MODIFY | API 클라이언트 함수 추가  | +20줄        |
| `frontend/src/components/admin/RAFTDatasetList.tsx` | MODIFY | 평점 UI 및 삭제 기능 개선 | +80줄        |

---

## 🔴 [Phase 1: 품질 평점 API 구현]

**목표**: Q&A 데이터의 품질 평점(1~5점)을 업데이트하는 API 구현

### Before Start

**영향받는 기존 파일/기능**:
| 파일 | 함수/위치 | 영향 |
|---|---|---|
| `raft_datasets` 테이블 | `quality_score` 컬럼 | 컬럼 존재 여부 확인 필요 (없으면 마이그레이션 또는 notes 컬럼 활용) |

### Implementation Items

- [x] **P3-02-01**: DB 스키마 확인 및 컬럼 추가 (필요시) ✅

  - `Target`: `raft_datasets` 테이블
  - `Detail`: `quality_score` (INT) 컬럼 확인. 없으면 SQL 실행.
  - `Dependency`: 없음
  - `Quality`: 데이터 무결성

- [x] **P3-02-02**: 평점 업데이트 API 핸들러 구현 ✅

  - `Target`: `frontend/src/app/api/raft/dataset/route.ts`
  - `Detail`:
    ```typescript
    export async function PATCH(request: NextRequest) {
      // body: { id, quality_score }
      // update raft_datasets set quality_score = ... where id = ...
    }
    ```
  - `Dependency`: P3-02-01
  - `Quality`: 인증 체크, 입력값 검증 (1~5 범위)

- [x] **P3-02-03**: API 클라이언트 함수 추가 ✅
  - `Target`: `frontend/src/lib/api/raft.ts`
  - `Detail`: `updateRAFTDatasetQuality(id: string, score: number)`
  - `Dependency`: P3-02-02

### Verification (Phase 1)

- [x] **Syntax Check**: `npx tsc --noEmit` ✅
- [x] **API Test**: `PATCH` 요청으로 평점 업데이트 확인 ✅

---

## 🔴 [Phase 2: UI 구현 및 통합]

**목표**: `RAFTDatasetList` 컴포넌트에 품질 평점 UI 및 삭제 확인 기능 개선

### Before Start

**영향받는 기존 파일/기능**:
| 파일 | 함수/위치 | 영향 |
|---|---|---|
| `RAFTDatasetList.tsx` | `handleDelete` | 삭제 로직 유지하되 UX 개선 |

### Implementation Items

- [x] **P3-02-04**: 품질 평점 UI 컴포넌트 추가 ✅

  - `Target`: `frontend/src/components/admin/RAFTDatasetList.tsx`
  - `Detail`: 별점(Star) 5개 렌더링, 클릭 시 P3-02-03 API 호출
  - `Dependency`: P3-02-03
  - `Quality`: 호버 효과, 클릭 피드백

- [x] **P3-02-05**: 삭제 확인 모달 개선 (Optional) ✅
  - `Target`: `frontend/src/components/admin/RAFTDatasetList.tsx`
  - `Detail`: `window.confirm` 유지하되, 메시지를 더 명확하게 (기존 유지 가능)
  - `Dependency`: 없음

### Verification (Phase 2)

- [x] **Functionality Test**: 평점 클릭 시 DB 업데이트 확인, 삭제 버튼 동작 확인 ✅
- [x] **Regression Test**: 목록 조회 및 필터링 정상 동작 확인 ✅

---
