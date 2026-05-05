# Phase 15: Document-Scoped Evaluations - Implementation Checklist

**작성일**: 2025-12-28 05:47  
**작성자**: Tech Lead (Antigravity)  
**검토자**: JeDebug (Senior Lead Developer)  
**문서 출처**: `implementation_plan.md` (Phase 15)

---

## 1. File & Structure Decision (파일 구성 전략)

### 전략: **단일 마이그레이션 + 기존 파일 수정**

**논리적 근거**:

1. **DB 스키마**: 기존 `evaluation_logs` 테이블에 컬럼 추가 → 신규 마이그레이션 1개
2. **API**: 기존 `evaluations/route.ts`에 로직 추가 → 파일 분리 불필요
3. **Frontend**: 기존 `EvaluationTab.tsx` 수정 → 파일 분리 불필요

**파일 목록**:
| 유형 | 파일명 | 액션 |
|------|--------|------|
| DB Migration | `supabase/migrations/038_document_evaluations.sql` | **NEW** |
| API | `frontend/src/app/api/evaluations/route.ts` | **MODIFY** |
| Frontend | `frontend/src/components/Assistant/EvaluationTab.tsx` | **MODIFY** |

---

## 2. Phase 1: Database Schema (P15-01)

### Before Start

**영향받는 기존 항목**:

- 테이블: `public.evaluation_logs` (migration 032)
- 컬럼 추가로 기존 데이터에 영향 없음 (NULL 허용)

### Implementation Items

- [ ] **P15-01-01**: `document_id` 컬럼 추가

  - `Target`: `supabase/migrations/038_document_evaluations.sql` (NEW)
  - `Detail`:
    1. `ALTER TABLE public.evaluation_logs ADD COLUMN IF NOT EXISTS document_id UUID`
    2. `REFERENCES public.user_documents(id) ON DELETE CASCADE`
    3. `DEFAULT NULL` (기존 데이터 호환)
  - `Dependency`: None
  - `Quality`: CASCADE 설정으로 문서 삭제 시 평가도 자동 삭제

- [ ] **P15-01-02**: 인덱스 생성
  - `Target`: `038_document_evaluations.sql`
  - `Detail`:
    1. `CREATE INDEX IF NOT EXISTS idx_evaluation_logs_document_id ON public.evaluation_logs(document_id)`
    2. `CREATE INDEX IF NOT EXISTS idx_evaluation_logs_user_document ON public.evaluation_logs(user_id, document_id)`
  - `Dependency`: P15-01-01
  - `Quality`: 복합 인덱스로 문서별 조회 성능 최적화

### Verification (P15-01)

- [ ] **Syntax Check**: SQL 문법 검증 (Supabase SQL Editor에서 실행)
- [ ] **Functionality Test**:
  - 마이그레이션 실행 후 `\d evaluation_logs`로 컬럼 확인
  - Expected: `document_id UUID` 컬럼 존재
- [ ] **Regression Test**: 기존 평가 데이터 조회 정상 동작

---

## 3. Phase 2: API Updates (P15-02)

### Before Start

**영향받는 기존 파일/함수**:

- 파일: `frontend/src/app/api/evaluations/route.ts`
- 함수: `GET()` (line 23-69), `POST()` (line 71-134)
- 기존 기능: 사용자별 평가 조회/저장

### Implementation Items

- [ ] **P15-02-01**: GET API - `documentId` 필터 추가

  - `Target`: `evaluations/route.ts` → `GET()` 함수 (line 37-46)
  - `Detail`:
    1. `searchParams.get('documentId')` 추출
    2. `if (documentId) query = query.eq('document_id', documentId)`
    3. 응답에 `document_id` 필드 포함
  - `Dependency`: P15-01-01 (DB 컬럼 존재 필요)
  - `Quality`: NULL 체크로 빈 문자열 처리

- [ ] **P15-02-02**: POST API - `documentId` 저장 로직 추가

  - `Target`: `evaluations/route.ts` → `POST()` 함수 (line 89-94)
  - `Detail`:
    1. `const { documentText, resultData, overallScore, documentId } = body`
    2. insert 객체에 `document_id: documentId || null` 추가
  - `Dependency`: P15-01-01
  - `Quality`: NULL 허용으로 기존 호출 호환

- [ ] **P15-02-03**: DELETE API - 신규 구현
  - `Target`: `evaluations/route.ts` → 파일 끝에 `DELETE()` 함수 추가
  - `Detail`:
    1. `export async function DELETE(request: NextRequest)`
    2. `searchParams.get('id')` 로 평가 ID 추출
    3. `supabase.from('evaluation_logs').delete().eq('id', id).eq('user_id', user.id)` (본인 것만 삭제)
    4. 성공/실패 응답 반환
  - `Dependency`: None (독립 기능)
  - `Quality`: 인증 확인 + 본인 데이터만 삭제 가능하도록 RLS 보완

### Verification (P15-02)

- [ ] **Syntax Check**: `npx tsc --noEmit`
- [ ] **Functionality Test**:
  - GET: `/api/evaluations?documentId=xxx` 호출 → 해당 문서 평가만 반환
  - POST: `documentId` 포함 저장 → DB 확인
  - DELETE: `/api/evaluations?id=xxx` 호출 → 삭제 확인
- [ ] **Regression Test**: `documentId` 없이 GET 호출 시 기존처럼 전체 반환

---

## 4. Phase 3: Frontend Updates (P15-03)

### Before Start

**영향받는 기존 파일/함수**:

- 파일: `frontend/src/components/Assistant/EvaluationTab.tsx`
- 함수: `loadEvaluations()` (line 91-113), `saveEvaluation()` (line 120-138)
- 상태: `savedEvaluations`, `result`, `isSaved`
- Hook: `useEditorState` (현재 `content`만 사용 중)

### Implementation Items

- [ ] **P15-03-01**: `documentId` 상태 연동

  - `Target`: `EvaluationTab.tsx` → line 85
  - `Detail`:
    1. 현재: `const { content, setContent } = useEditorState()`
    2. 변경: `const { content, documentId } = useEditorState()`
  - `Dependency`: None
  - `Quality`: `documentId`가 없으면 기존 동작 유지

- [ ] **P15-03-02**: `loadEvaluations` 문서별 필터링

  - `Target`: `EvaluationTab.tsx` → `loadEvaluations()` 함수 (line 91-113)
  - `Detail`:
    1. `const url = documentId ? \`/api/evaluations?documentId=${documentId}&limit=10\` : '/api/evaluations?limit=5'`
    2. `useEffect` 의존성 배열에 `documentId` 추가: `}, [documentId])`
  - `Dependency`: P15-02-01, P15-03-01
  - `Quality`: 문서 전환 시 자동 재로드

- [ ] **P15-03-03**: `saveEvaluation` 문서 ID 전달

  - `Target`: `EvaluationTab.tsx` → `saveEvaluation()` 함수 (line 125-129)
  - `Detail`:
    1. `body: JSON.stringify({ documentId, documentText, resultData, overallScore })`
  - `Dependency`: P15-02-02, P15-03-01
  - `Quality`: 문서 없이 평가 시 `documentId: null` 전송

- [ ] **P15-03-04**: 삭제 UI 및 핸들러 추가

  - `Target`: `EvaluationTab.tsx` → 평가 히스토리 목록 영역
  - `Detail`:
    1. `handleDeleteEvaluation(id: string)` 함수 추가
    2. `confirm('이 평가를 삭제하시겠습니까?')` 확인
    3. `fetch(\`/api/evaluations?id=${id}\`, { method: 'DELETE' })`
    4. 성공 시 `setSavedEvaluations(prev => prev.filter(e => e.id !== id))`
    5. 히스토리 아이템에 삭제 버튼 추가 (🗑️ 아이콘)
  - `Dependency`: P15-02-03
  - `Quality`: aria-label="평가 삭제", 삭제 후 목록 즉시 업데이트

- [ ] **P15-03-05**: 빈 상태 UI 개선
  - `Target`: `EvaluationTab.tsx` → 평가 표시 영역
  - `Detail`:
    1. `savedEvaluations.length === 0 && !result` 조건 추가
    2. 메시지: "이 문서의 평가 기록이 없습니다. '평가하기' 버튼을 눌러 평가를 시작하세요."
  - `Dependency`: P15-03-02
  - `Quality`: 사용자 가이드 명확화

### Verification (P15-03)

- [ ] **Syntax Check**: `npx tsc --noEmit`
- [ ] **Functionality Test**:
  1. 문서 A 로드 → 평가 탭 → 문서 A의 평가만 표시
  2. 문서 B 로드 → 평가 탭 → 문서 B의 평가만 표시 (A 평가 안 보임)
  3. 평가 실행 → 저장 → 해당 문서에 연결 확인
  4. 삭제 버튼 클릭 → 확인 다이얼로그 → 삭제 후 목록 갱신
- [ ] **Regression Test**:
  - 새 문서(저장 안 된 문서)에서 평가 시 정상 동작
  - 기존 평가 데이터 조회 정상

---

## 5. Phase 4: Final Verification (P15-04)

### End-to-End Test Scenarios

- [ ] **E2E-01**: 문서별 평가 격리

  1. 문서 "ㄱ" 로드 → 평가 실행 → 저장
  2. 문서 "ㄴ" 로드 → 평가 탭 확인
  3. **Expected**: 문서 "ㄴ"의 평가 탭에 "ㄱ"의 평가가 **표시되지 않음**

- [ ] **E2E-02**: 평가 히스토리 유지

  1. 문서 "ㄱ" 로드 → 평가 3회 실행
  2. 평가 탭에서 히스토리 확인
  3. **Expected**: 3개의 평가 기록 모두 표시

- [ ] **E2E-03**: 평가 삭제

  1. 평가 목록에서 삭제 버튼 클릭
  2. 확인 다이얼로그에서 "확인"
  3. **Expected**: 해당 평가만 삭제, 다른 평가 유지

- [ ] **E2E-04**: 문서 삭제 시 평가 자동 삭제
  1. 문서 A 삭제
  2. DB에서 `evaluation_logs` 확인
  3. **Expected**: `document_id = A`인 평가 기록 **자동 삭제됨 (CASCADE)**

---

## 6. Deployment Checklist

- [ ] TypeScript 빌드 성공
- [ ] Git 커밋 및 푸시
- [ ] Vercel 배포 완료
- [ ] Supabase 마이그레이션 실행 (038_document_evaluations.sql)
- [ ] 프로덕션 E2E 테스트

---

## 7. Rollback Plan

### DB Rollback

```sql
-- 컬럼 삭제
ALTER TABLE public.evaluation_logs DROP COLUMN IF EXISTS document_id;

-- 인덱스 삭제
DROP INDEX IF EXISTS idx_evaluation_logs_document_id;
DROP INDEX IF EXISTS idx_evaluation_logs_user_document;
```

### Code Rollback

```bash
git revert <commit-hash>
git push origin main
```

---

## 8. Notes & Assumptions

### 가정 (Assumptions)

1. `useEditorState` 훅에서 `documentId`는 저장된 문서에 대해 설정됨
2. 새 문서(미저장)의 경우 `documentId`는 `null` 또는 `undefined`
3. `user_documents` 테이블은 이미 존재함

### 확인 필요 사항

- [확인 필요] `useEditorState`에서 `documentId` 필드가 노출되어 있는지 확인 필요
- [확인 필요] 기존 `evaluation_logs`에 데이터가 있다면 `document_id = NULL`로 유지됨 (호환성)
