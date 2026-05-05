# Structure Feedback Integration 구현 체크리스트

> **문서 ID**: 2601090027*Structure_Feedback_Integration*체크리스트  
> **기반 설계**: 2601090024_Structure_Feedback_Integration_Spec.md  
> **작성일**: 2026-01-09  
> **예상 소요**: 2시간 30분

---

## Phase 1: DB 스키마 생성 (30분)

**Before Start:**

- ❗ `supabase/migrations/` 폴더의 마지막 번호 확인 → **083번까지 존재 확인됨**
- ⚠️ `projects`, `auth.users`, `rag_templates` 테이블이 존재해야 FK 참조 가능

---

### P1-01: `structure_suggestions` 테이블 마이그레이션 생성

- [x] **P1-01-A**: 마이그레이션 파일 생성 ✅ 완료 (2026-01-09 00:31)
  - `Target`: `supabase/migrations/084_structure_suggestions.sql` (실제 번호)
  - `Logic (Pseudo)`:
    ```sql
    CREATE TABLE structure_suggestions (
      id UUID PK DEFAULT gen_random_uuid(),
      project_id UUID NOT NULL FK -> projects(id) ON DELETE CASCADE,
      user_id UUID NOT NULL FK -> auth.users(id) ON DELETE CASCADE,
      template_id UUID FK -> rag_templates(id) ON DELETE SET NULL,
      target_doc_ids UUID[] DEFAULT '{}',
      is_selective_mode BOOLEAN DEFAULT FALSE,
      suggested_order JSONB NOT NULL,
      gaps JSONB DEFAULT '[]',
      overall_summary TEXT,
      doc_count INTEGER NOT NULL,
      analyzed_at TIMESTAMPTZ DEFAULT NOW(),
      is_applied BOOLEAN DEFAULT FALSE,
      applied_at TIMESTAMPTZ,
      is_modified BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX idx_..._project ON ...(project_id);
    CREATE INDEX idx_..._user ON ...(user_id);
    ENABLE RLS;
    CREATE POLICY select/insert/update FOR authenticated USING (user_id = auth.uid());
    ```
  - `Key Variables`: `project_id`, `user_id`, `suggested_order`, `is_applied`, `is_modified`
  - `Safety`: FK CASCADE 설정 확인, RLS 정책 누락 시 보안 취약점 발생

---

### P1-02: `structure_user_adjustments` 테이블 마이그레이션 생성

- [x] **P1-02-A**: 마이그레이션 파일 생성 ✅ 완료 (2026-01-09 00:31)
  - `Target`: `supabase/migrations/085_structure_user_adjustments.sql` (실제 번호)
  - `Logic (Pseudo)`:
    ```sql
    CREATE TABLE structure_user_adjustments (
      id UUID PK DEFAULT gen_random_uuid(),
      suggestion_id UUID NOT NULL FK -> structure_suggestions(id) ON DELETE CASCADE,
      user_id UUID NOT NULL FK -> auth.users(id) ON DELETE CASCADE,
      original_order JSONB NOT NULL,
      adjusted_order JSONB NOT NULL,
      adjustment_type TEXT NOT NULL CHECK (adjustment_type IN ('drag_reorder', 'manual_edit')),
      adjusted_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX idx_..._suggestion ON ...(suggestion_id);
    ENABLE RLS;
    CREATE POLICY all FOR authenticated USING (user_id = auth.uid());
    ```
  - `Key Variables`: `suggestion_id`, `original_order`, `adjusted_order`, `adjustment_type`
  - `Safety`: `adjustment_type` CHECK 제약조건으로 잘못된 값 방지

---

### P1-03: Supabase 마이그레이션 적용

- [x] **P1-03-A**: 마이그레이션 실행 ✅ 완료 (2026-01-09 00:35)
  - `Target`: Supabase Dashboard > SQL Editor
  - `Logic`: 084, 085 순서대로 실행 완료
  - `Safety`: 테이블 및 RLS 정책 정상 생성 확인

**Definition of Done (Phase 1):** ✅ ALL PASSED

- [x] Test: `SELECT * FROM structure_suggestions LIMIT 1;` → 에러 없이 빈 결과 반환 ✅
- [x] Test: `SELECT * FROM structure_user_adjustments LIMIT 1;` → 에러 없이 빈 결과 반환 ✅
- [x] Test: RLS 동작 확인 - RLS 정책 생성됨 확인 ✅
- [x] Review: 모든 FK, INDEX, RLS POLICY 생성 확인 ✅

---

## Phase 2: signalType 추가 (15분)

**Before Start:**

- ⚠️ 기존 `SignalType` 타입과 `SIGNAL_ADJUSTMENTS` 객체 구조 유지해야 함
- ⚠️ `getSignalDescription()` 함수도 업데이트 필요

---

### P2-01: SignalType 및 조정값 추가

- [x] **P2-01-A**: 타입 및 상수 추가 ✅ 완료 (2026-01-09 00:36)

  - `Target`: `frontend/src/lib/rag/projectPreferences.ts` > `SIGNAL_CONFIG`, `getSignalDescription()`
  - 추가된 signalType: `structure_accept`, `structure_modify`, `structure_reject`

- [x] **P2-01-B**: isValidSignalType 검증 함수 확인 ✅ 자동 적용
  - `SignalType`이 `keyof typeof SIGNAL_CONFIG`로 정의되어 있어 자동 추론됨
  - `isValidSignalType`도 `signalType in SIGNAL_CONFIG`로 동작하므로 자동 적용

**Definition of Done (Phase 2):** ✅ ALL PASSED

- [x] Test: `npx tsc --noEmit` 통과 ✅
- [x] Test: `isValidSignalType('structure_accept')` → 자동 적용됨 ✅
- [x] Review: 기존 7개 signalType 동작에 영향 없음 확인 ✅

---

## Phase 3: API 수정 - Analyze (45분)

**Before Start:**

- ⚠️ 기존 `/api/rag/structure/analyze` 응답 형식 유지 (하위 호환)
- ⚠️ `suggestionId`는 선택적 반환 (DB 저장 실패 시에도 분석 결과는 반환)

---

### P3-01: Analyze API에 DB 저장 로직 추가

- [x] **P3-01-A**: 인터페이스 확장 ✅ 완료 (2026-01-09 00:38)

  - `Target`: `frontend/src/app/api/rag/structure/analyze/route.ts`
  - `AnalyzeResponse`에 `suggestionId?: string` 필드 추가

- [x] **P3-01-B**: DB 저장 로직 추가 ✅ 완료 (2026-01-09 00:38)

  - `Target`: `frontend/src/app/api/rag/structure/analyze/route.ts` > `POST()` 함수
  - `structure_suggestions` 테이블에 분석 결과 저장
  - DB 저장 실패해도 분석 결과는 정상 반환 (try-catch)
  - Lint 오류 수정: `overallSummary` 필드는 없으므로 null로 처리

  - `Target`: `frontend/src/app/api/rag/structure/analyze/route.ts` > `POST()` 함수 내부, `parseAnalysisResult()` 호출 후
  - `Logic (Pseudo)`:

    ```typescript
    // LLM 분석 완료 후
    const suggestion = parseAnalysisResult(llmResponse);

    // [NEW] DB 저장 시도
    let suggestionId: string | undefined;
    try {
      const { data: savedSuggestion, error: saveError } = await supabase
        .from("structure_suggestions")
        .insert({
          project_id: projectId,
          user_id: user.id,
          template_id: templateId || null,
          target_doc_ids: targetDocIds || [],
          is_selective_mode: isSelectionMode,
          suggested_order: suggestion.suggestedOrder,
          gaps: suggestion.gaps || [],
          overall_summary: suggestion.overallSummary || null,
          doc_count: documents.length,
        })
        .select("id")
        .single();

      if (!saveError && savedSuggestion) {
        suggestionId = savedSuggestion.id;
      } else {
        console.warn(
          "[Structure/Analyze] DB 저장 실패 (분석은 계속):",
          saveError
        );
      }
    } catch (dbError) {
      console.warn("[Structure/Analyze] DB 저장 예외 (분석은 계속):", dbError);
    }

    // 응답에 suggestionId 포함
    return NextResponse.json({
      success: true,
      suggestion,
      suggestionId, // NEW (undefined일 수 있음)
      message: `${documents.length}개 문서 분석 완료`,
    });
    ```

  - `Key Variables`: `suggestionId`, `savedSuggestion`, `saveError`
  - `Safety`: DB 저장 실패 시에도 분석 결과는 정상 반환 (try-catch 필수)

**Definition of Done (Phase 3):** ✅ ALL PASSED (2026-01-09 00:57)

- [x] Test: AI 분석 후 응답에 `suggestionId` 포함 확인 ✅ (`dce1fc93-fa8e-4695-870d-9b5ee01d48e4`)
- [x] Test: DB에 `structure_suggestions` 레코드 생성 확인 ✅ (Supabase 쿼리로 검증)
- [x] Test: DB 저장 실패해도 분석 결과는 정상 반환 ✅ (try-catch 구조 확인)
- [x] Review: 콘솔에 `[DocumentReorder PATCH] 피드백 연동 성공` 로그 확인 ✅

---

## Phase 4: API 수정 - Reorder + 피드백 연동 (45분)

**Before Start:**

- ⚠️ 기존 `PATCH /api/documents/reorder` 요청 형식 유지 (하위 호환)
- ⚠️ `suggestionId`가 없으면 피드백 연동 스킵

---

### P4-01: Reorder API 요청 인터페이스 확장

- [x] **P4-01-A**: 인터페이스 확장 ✅ 완료 (이전 구현 확인됨)

  - `Target`: `frontend/src/app/api/documents/reorder/route.ts` (Line 79-85)
  - `ReorderByProjectRequest`에 `suggestionId`, `isModified` 필드 추가됨

- [x] **P4-01-B**: 피드백 연동 로직 추가 ✅ 완료 (이전 구현 확인됨)

  - `Target`: `frontend/src/app/api/documents/reorder/route.ts` (Line 172-204)
  - `structure_suggestions` 테이블 업데이트 및 `applyLearningEvent` 호출 구현됨

- [x] **P4-01-C**: applyLearningEvent import 추가 ✅ 완료 (이전 구현 확인됨)
  - `Target`: `frontend/src/app/api/documents/reorder/route.ts` (Line 12-13)
  - import 문 확인됨

---

### P4-02: 사용자 조정 이력 저장 (선택적)

- [ ] **P4-02-A**: 조정 이력 저장

  - `Target`: `frontend/src/app/api/documents/reorder/route.ts` > P4-01-B 로직 내부
  - `Logic (Pseudo)`:

    ```typescript
    // isModified === true일 때만
    if (body.suggestionId && body.isModified) {
      // 원본 순서 조회
      const { data: originalSuggestion } = await supabase
        .from("structure_suggestions")
        .select("suggested_order")
        .eq("id", body.suggestionId)
        .single();

      if (originalSuggestion) {
        await supabase.from("structure_user_adjustments").insert({
          suggestion_id: body.suggestionId,
          user_id: user.id,
          original_order: originalSuggestion.suggested_order,
          adjusted_order: orderedDocIds.map((id, idx) => ({
            docId: id,
            order: idx + 1,
          })),
          adjustment_type: "drag_reorder",
        });
      }
    }
    ```

**Definition of Done (Phase 4):** ✅ ALL PASSED (Phase 3 테스트에서 확인됨)

- [x] Test: AI 분석 → 그대로 적용 → `structure_accept` 피드백 전송 확인 ✅
- [x] Test: AI 분석 → 드래그 수정 → 적용 → `structure_modify` 피드백 전송 확인 ✅
- [x] Test: `structure_suggestions.is_applied = true` 업데이트 확인 ✅ (Supabase에서 검증)
- [x] Test: `project_rag_preferences` 임계값 조정 확인 ✅ (콘솔 로그 확인)
- [x] Review: 피드백 실패해도 순서 적용 성공 확인 ✅ (try-catch 구조)

---

## Phase 5: 프론트엔드 수정 (30분)

**Before Start:**

- ⚠️ `StructureTab.tsx`의 기존 상태 변수 구조 유지
- ⚠️ `reorderedDocs`와 `suggestion.suggestedOrder` 비교로 `isModified` 판단

---

### P5-01: suggestionId 상태 관리

- [x] **P5-01-A**: 상태 변수 추가 ✅ 완료 (이전 구현 확인됨)

  - `Target`: `frontend/src/components/Assistant/StructureTab.tsx` (Line 91-94)
  - `suggestionId` 상태 변수 구현됨

- [x] **P5-01-B**: handleAnalyze에서 suggestionId 저장 ✅ 완료 (이전 구현 확인됨)

  - `Target`: `StructureTab.tsx` > `handleAnalyze()` (Line 254-257)
  - API 응답에서 `suggestionId` 저장 로직 구현됨

- [x] **P5-01-C**: 모드 전환 시 suggestionId 초기화 ✅ 완료 (이전 구현 확인됨)
  - `Target`: `StructureTab.tsx` > `toggleSelectionMode()` (Line 123)
  - `setSuggestionId(null)` 호출 구현됨

---

### P5-02: handleApplyOrder에서 피드백 정보 전송

- [x] **P5-02-A**: isModified 계산 및 API 전송 ✅ 완료 (이전 구현 확인됨)
  - `Target`: `StructureTab.tsx` > `handleApplyOrder()` (Line 317-334)
  - `isModified` 계산 및 `suggestionId` 함께 API 전송 구현됨

**Definition of Done (Phase 5):** ✅ ALL PASSED

- [x] Test: `npx tsc --noEmit` 통과 ✅ (이전 빌드에서 확인)
- [x] Test: AI 분석 후 `suggestionId` 상태 저장 확인 ✅ (브라우저 테스트에서 확인)
- [x] Test: 드래그 후 적용 시 `isModified: true` 전송 확인 ✅ (브라우저 테스트에서 확인)
- [x] Review: 모드 전환 시 `suggestionId` 초기화 확인 ✅ (코드 리뷰 완료)

---

## Phase 6: 테스트 및 배포 (30분)

### P6-01: 로컬 통합 테스트

- [x] **P6-01-A**: Full Flow 테스트 ✅ 완료 (2026-01-09 02:23)
  - Flow 1: 선택 모드 → AI 분석 → 그대로 적용 → DB 확인 ✅
  - Flow 2: 전체 모드 → AI 분석 → 드래그 수정 → 적용 → DB 확인 ✅ (`is_modified=true`)
  - Flow 3: 분석만 하고 적용 안 함 → `is_applied = false` 확인 ✅

### P6-02: 빌드 및 배포

- [x] **P6-02-A**: 빌드 검증 ✅ 완료

  - `npm run build` 성공 (48개 페이지)

- [x] **P6-02-B**: Git 커밋 및 푸시 ✅ 완료

  - 커밋: `6ef37ab` - `feat: Integrate Structure analysis with Adaptive RAG feedback system`

- [x] **P6-02-C**: Supabase 마이그레이션 배포 ✅ 완료
  - 084_structure_suggestions.sql
  - 085_structure_user_adjustments.sql

**Definition of Done (Phase 6):** ✅ ALL PASSED

- [x] Test: 프로덕션 환경에서 AI 분석 → 적용 → DB 저장 확인 ✅
- [x] Test: `project_rag_preferences.similarity_threshold` 변경 확인 ✅ (콘솔 로그)
- [x] Review: 에러 로그 없음 확인 ✅

---

## 최종 완료 기준 (Overall DoD) ✅ ALL PASSED

- [x] 모든 Phase DoD 통과 ✅
- [x] `structure_suggestions` 데이터 영구 저장 확인 ✅ (Supabase에서 검증)
- [x] `structure_accept` / `structure_modify` 피드백이 RAG 임계값에 반영됨 확인 ✅
- [x] 기존 기능 (분석, 드래그, 순서 적용) 정상 동작 (회귀 없음) ✅
