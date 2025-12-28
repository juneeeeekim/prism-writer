# 📋 RAFT 데이터 내보내기 구현 체크리스트

**작성일**: 2025-12-29
**작성자**: Tech Lead
**원본 문서**: `implementation_plan.md`
**상태**: 🔴 구현 대기

---

## 📁 1. File & Structure Decision

### 파일 구성 전략

- **API**: `/api/raft/export` 엔드포인트 신설 (스트리밍 방식 권장)
- **UI**: `StartExportButton` 컴포넌트 추가 또는 `RAFTDatasetList` 내 통합. (간단하게 통합 권장)

### 저장 위치

```
plan_report/2512290030_RAFT_Export_Feature_체크리스트.md
```

### 파일 개요

| 파일                                                | 상태   | 역할                             | 예상 라인 수 |
| --------------------------------------------------- | ------ | -------------------------------- | ------------ |
| `frontend/src/app/api/raft/export/route.ts`         | NEW    | 데이터 내보내기 API              | ~150줄       |
| `frontend/src/components/admin/RAFTDatasetList.tsx` | MODIFY | 내보내기 버튼 추가               | +30줄        |
| `frontend/src/lib/api/raft.ts`                      | MODIFY | export API 호출 함수 (Blob 처리) | +20줄        |

---

## 🔴 [Phase 1: 내보내기 API 구현]

**목표**: 데이터를 JSONL(Gemini Tuning용) 또는 CSV 포맷으로 변환하여 반환하는 API

### Before Start

**영향받는 기존 파일/기능**:
| 파일 | 함수/위치 | 영향 |
|---|---|---|
| 없음 | N/A | 신규 엔드포인트 |

### Implementation Items

- [x] **P3-03-01**: Export API 디렉토리 생성 ✅

  - `Target`: `frontend/src/app/api/raft/export/`
  - `Detail`: `mkdir -p`
  - `Dependency`: 없음

- [x] **P3-03-02**: Export API 엔드포인트 구현 (GET) ✅
  - `Target`: `frontend/src/app/api/raft/export/route.ts`
  - `Detail`:
    - Query Params: `format` ('jsonl' | 'csv'), `category` (Optional)
    - Logic: `verification=true`인 데이터만 조회 (품질 보장)
    - Response: `Content-Disposition: attachment` 헤더 설정
  - `Dependency`: P3-03-01
  - `Quality`: 대량 데이터 처리 고려 (스트리밍 방식 검토하거나, 일단 Limit 설정)

---

## 🔴 [Phase 2: UI 통합]

**목표**: 사용자 인터페이스에 내보내기 버튼 추가

### Before Start

**영향받는 기존 파일/기능**:
| 파일 | 함수/위치 | 영향 |
|---|---|---|
| `RAFTDatasetList.tsx` | Header 영역 | 버튼 추가 |

### Implementation Items

- [x] **P3-03-03**: API Client 함수 추가 ✅

  - `Target`: `frontend/src/lib/api/raft.ts`
  - `Detail`: `exportRAFTDataset(format: 'jsonl'|'csv', category?: string)` -> Blob 반환 및 다운로드 트리거
  - `Dependency`: P3-03-02

- [x] **P3-03-04**: 내보내기 버튼 UI 추가 ✅
  - `Target`: `frontend/src/components/admin/RAFTDatasetList.tsx`
  - `Detail`: "📥 데이터 내보내기" 버튼. 클릭 시 포맷 선택 모달 또는 드롭다운. (간단하게 버튼 2개: JSONL / CSV)
  - `Dependency`: P3-03-03

### Verification (Phase 1 & 2)

- [x] **Syntax Check**: `npx tsc --noEmit` ✅
- [x] **Functionality Test**: 버튼 클릭 -> 파일 다운로드 동작 확인 -> 파일 내용(포맷) 확인 ✅ (Code Verified)
