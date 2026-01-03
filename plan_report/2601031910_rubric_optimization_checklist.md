# 루브릭 최적화 구현 체크리스트

**작성일**: 2026-01-03 19:10
**기반 설계**: `2601031900_rubric_optimization_strategy.md`
**작성자**: Tech Lead

---

## [Phase 1: UI 카운터 및 권장 구간 표시]

**Before Start:**
- ⚠️ 주의: `PatternAnalysisSection.tsx`의 기존 채택/거부 로직(`handleSelectCandidate`, `handleResetCandidate`)은 수정하지 말 것
- ⚠️ 주의: 현재 `MAX_SELECT_COUNT = 20`은 하드 리밋으로 유지 (Pool 개념)

**Implementation Items:**

- [x] **P1-01**: [상수 정의 - 권장/경고 임계값 추가] ✅ 완료 (2026-01-03 19:15)
    - `Target`: `PatternAnalysisSection.tsx` > 파일 상단 상수 영역
    - `Logic (Pseudo)`:
      ```ts
      const RUBRIC_LIMITS = {
        POOL_MAX: 20,          // 하드 리밋 (Pool 최대)
        ACTIVE_RECOMMENDED: 12, // 권장 개수 (Sweet Spot)
        ACTIVE_WARNING: 12,     // 경고 시작 지점
      } as const
      ```
    - `Key Variables`: `RUBRIC_LIMITS`, `POOL_MAX`, `ACTIVE_RECOMMENDED`, `ACTIVE_WARNING`
    - `Safety`: 기존 `20` 하드코딩된 값들을 상수로 교체 시 누락 없이 전체 검색

---

- [x] **P1-02**: [카운터 UI 업그레이드 - 권장 구간 표시] ✅ 완료 (2026-01-03 19:20)
    - `Target`: `PatternAnalysisSection.tsx` > 렌더링 부분 (Line 263~267)
    - `Logic (Pseudo)`:
      ```tsx
      // AS-IS
      <span>{selectedCount}/20 선택됨</span>

      // TO-BE
      const isOverRecommended = selectedCount > RUBRIC_LIMITS.ACTIVE_RECOMMENDED
      const statusColor = isOverRecommended
        ? 'bg-amber-100 text-amber-800'
        : 'bg-blue-100 text-blue-800'

      <span className={statusColor}>
        {selectedCount}/{RUBRIC_LIMITS.ACTIVE_RECOMMENDED} 활성
        {isOverRecommended && ' ⚠️'}
      </span>
      <span className="text-gray-500 ml-2">
        (보관함: {candidates.length}/{RUBRIC_LIMITS.POOL_MAX})
      </span>
      ```
    - `Key Variables`: `isOverRecommended`, `statusColor`
    - `Safety`: `selectedCount`가 `undefined`일 경우 대비 (`selectedCount ?? 0`)

---

- [x] **P1-03**: [스마트 경고 메시지 추가] ✅ 완료 (2026-01-03 19:25)
    - `Target`: `PatternAnalysisSection.tsx` > 에러/성공 메시지 영역 아래 (Line 313 이후)
    - `Logic (Pseudo)`:
      ```tsx
      // 12개 초과 시 경고 배너 표시
      {selectedCount > RUBRIC_LIMITS.ACTIVE_WARNING && (
        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-md text-sm text-amber-700">
          ⚠️ <strong>품질 경고:</strong> 기준이 {selectedCount}개입니다.
          {RUBRIC_LIMITS.ACTIVE_RECOMMENDED}개 이하로 줄이면 분석의 날카로움이 높아집니다.
        </div>
      )}
      ```
    - `Key Variables`: `RUBRIC_LIMITS.ACTIVE_WARNING`
    - `Safety`: 조건부 렌더링이므로 null-check 불필요

---

- [x] **P1-04**: [채택 버튼 disabled 조건 변경] ✅ 완료 (2026-01-03 19:30)
    - `Target`: `PatternAnalysisSection.tsx` > 채택 버튼 (Line 370~374)
    - `Logic (Pseudo)`:
      ```tsx
      // AS-IS
      disabled={selectedCount >= 20}
      title={selectedCount >= 20 ? '최대 20개까지 선택 가능' : '채택'}

      // TO-BE
      const isNearLimit = selectedCount >= RUBRIC_LIMITS.ACTIVE_RECOMMENDED
      const isAtHardLimit = selectedCount >= RUBRIC_LIMITS.POOL_MAX

      disabled={isAtHardLimit}
      className={`... ${isNearLimit && !isAtHardLimit ? 'bg-amber-600 hover:bg-amber-700' : ''}`}
      title={
        isAtHardLimit
          ? `최대 ${RUBRIC_LIMITS.POOL_MAX}개까지 선택 가능`
          : isNearLimit
            ? `권장 개수(${RUBRIC_LIMITS.ACTIVE_RECOMMENDED}개)를 초과합니다`
            : '채택'
      }
      ```
    - `Key Variables`: `isNearLimit`, `isAtHardLimit`
    - `Safety`: disabled 상태에서 onClick이 호출되지 않음 확인 (React 기본 동작)

---

**Definition of Done (검증):**
- [ ] Test: 0개 선택 → 카운터 `0/12 활성 (보관함: n/20)` 표시
- [ ] Test: 12개 선택 → 노란색 경고 배너 미표시, 버튼 색상 변경
- [ ] Test: 13개 선택 → 노란색 경고 배너 "품질 경고" 표시
- [ ] Test: 20개 선택 → 채택 버튼 disabled
- [ ] Review: 불필요한 콘솔 로그 제거

---

## [Phase 2: API Soft Limit 및 응답 개선]

**Before Start:**
- ⚠️ 주의: 기존 `MAX_SELECT_COUNT = 20` 하드 리밋 로직은 유지
- ⚠️ 주의: 기존 클라이언트와의 하위 호환성 유지 (응답 필드 추가만)

**Implementation Items:**

- [x] **P2-01**: [상수 정의 - API 레벨 권장값] ✅ 완료 (2026-01-03 19:35)
    - `Target`: `api/rubrics/candidates/select/route.ts` > 상수 영역 (Line 18~19)
    - `Logic (Pseudo)`:
      ```ts
      const MAX_SELECT_COUNT = 20  // 하드 리밋 (기존 유지)
      const RECOMMENDED_COUNT = 12 // 권장 개수 (Soft Limit)
      ```
    - `Key Variables`: `RECOMMENDED_COUNT`
    - `Safety`: 기존 로직 영향 없음

---

- [x] **P2-02**: [응답에 권장 초과 경고 플래그 추가] ✅ 완료 (2026-01-03 19:40)
    - `Target`: `api/rubrics/candidates/select/route.ts` > POST 핸들러 응답 (Line 84~91)
    - `Logic (Pseudo)`:
      ```ts
      // 현재 선택된 총 개수 조회 (action이 'select'인 경우)
      let totalSelected = 0
      let exceedsRecommended = false

      if (action === 'select') {
        const { count } = await supabase
          .from('rag_rule_candidates')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('status', 'selected')

        totalSelected = count ?? 0
        exceedsRecommended = totalSelected > RECOMMENDED_COUNT
      }

      return NextResponse.json({
        success: true,
        action,
        status: newStatus,
        updated: updatedCount,
        requested: candidateIds.length,
        // [NEW] 권장 초과 정보
        totalSelected,
        exceedsRecommended,
        recommendedCount: RECOMMENDED_COUNT,
        message: exceedsRecommended
          ? `⚠️ 선택된 기준이 ${totalSelected}개입니다. ${RECOMMENDED_COUNT}개 이하 권장.`
          : `Successfully ${action}ed ${updatedCount} candidates`
      })
      ```
    - `Key Variables`: `totalSelected`, `exceedsRecommended`, `RECOMMENDED_COUNT`
    - `Safety`: `count`가 `null`일 경우 대비 (`count ?? 0`)

---

- [x] **P2-03**: [클라이언트에서 경고 메시지 처리] ✅ 완료 (2026-01-03 19:45)
    - `Target`: `PatternAnalysisSection.tsx` > `handleSelectCandidate()` (Line 151~180)
    - `Logic (Pseudo)`:
      ```ts
      // 기존 코드 유지 + 추가
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Action failed')
      }

      // [NEW] 권장 초과 시 토스트/경고 표시
      if (data.exceedsRecommended) {
        setSuccessMessage(data.message) // 기존 successMessage 재활용
      }

      // 로컬 상태 업데이트 (기존 로직)
      setCandidates(prev => ...)
      ```
    - `Key Variables`: `data.exceedsRecommended`, `data.message`
    - `Safety`: `data.exceedsRecommended`가 없는 구버전 API 대응 (`if (data.exceedsRecommended)`)

---

**Definition of Done (검증):**
- [ ] Test: API `/api/rubrics/candidates/select` POST 시 `totalSelected`, `exceedsRecommended` 필드 포함 확인
- [ ] Test: 13개 선택 후 응답에 `exceedsRecommended: true` 확인
- [ ] Test: 12개 이하 선택 후 응답에 `exceedsRecommended: false` 확인
- [ ] Review: Supabase 쿼리 성능 확인 (count 쿼리 추가로 인한 지연 미미)

---

## [Phase 3: 푸터 현황 UI 개선]

**Before Start:**
- ⚠️ 주의: 푸터 영역은 레이아웃 변경 최소화

**Implementation Items:**

- [x] **P3-01**: [푸터 선택 현황 개선] ✅ 완료 (2026-01-03 19:50)
    - `Target`: `PatternAnalysisSection.tsx` > 푸터 영역 (Line 418~429)
    - `Logic (Pseudo)`:
      ```tsx
      // AS-IS
      <span>대기: {draftCount}개 | 채택: {selectedCount}개</span>

      // TO-BE
      const rejectedCount = candidates.filter(c => c.status === 'rejected').length
      const progressPercent = Math.round((selectedCount / RUBRIC_LIMITS.ACTIVE_RECOMMENDED) * 100)

      <div className="flex items-center gap-4">
        <span>
          📦 대기: {draftCount} | ✅ 활성: {selectedCount}/{RUBRIC_LIMITS.ACTIVE_RECOMMENDED} | ❌ 제외: {rejectedCount}
        </span>

        {/* 진행률 바 */}
        <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all ${
              selectedCount > RUBRIC_LIMITS.ACTIVE_RECOMMENDED ? 'bg-amber-500' : 'bg-blue-500'
            }`}
            style={{ width: `${Math.min(progressPercent, 100)}%` }}
          />
        </div>
      </div>
      ```
    - `Key Variables`: `rejectedCount`, `progressPercent`
    - `Safety`: `RUBRIC_LIMITS.ACTIVE_RECOMMENDED`가 0일 경우 대비 (상수이므로 불가능하나 방어적 코딩)

---

**Definition of Done (검증):**
- [ ] Test: 6개 선택 시 진행률 바 50% 표시 (파란색)
- [ ] Test: 15개 선택 시 진행률 바 100% (노란색)
- [ ] Review: 모바일 반응형 레이아웃 깨짐 없음 확인

---

## [Phase 4: 카테고리 태깅 (Core/Style/Detail) - Future]

**Before Start:**
- ⚠️ 주의: 이 Phase는 Phase 1~3 완료 후 진행
- ⚠️ 주의: DB 스키마 변경 필요 (`rag_rule_candidates` 테이블에 `tier` 컬럼 추가)

**Implementation Items:**

- [x] **P4-01**: [RubricTier 타입 정의] ✅ 완료 (2026-01-03 19:55)
    - `Target`: `lib/rag/rubrics.ts` > 타입 정의 영역 (Line 33 이후)
    - `Logic (Pseudo)`:
      ```ts
      /**
       * [PATTERN] 루브릭 티어 (12-Rubric Rule)
       * Core(5) + Style(4) + Detail(3) = 12개 최적 조합
       */
      export type RubricTier = 'core' | 'style' | 'detail'

      export const TIER_CONFIG = {
        core: { label: '🟢 Core', max: 5, description: '글의 본질적 성패를 가르는 기준' },
        style: { label: '🔵 Style', max: 4, description: '글의 매력도와 가독성' },
        detail: { label: '⚪ Detail', max: 3, description: '완성도를 높이는 미세 조정' },
      } as const
      ```
    - `Key Variables`: `RubricTier`, `TIER_CONFIG`
    - `Safety`: 기존 `RubricCategory`와 별개 개념임을 주석으로 명시

---

- [x] **P4-02**: [RuleCandidate 인터페이스에 tier 필드 추가] ✅ 완료 (2026-01-03 20:00)
    - `Target`: `PatternAnalysisSection.tsx` > `RuleCandidate` 인터페이스 (Line 19~28)
    - `Logic (Pseudo)`:
      ```ts
      interface RuleCandidate {
        // ... 기존 필드
        tier?: 'core' | 'style' | 'detail'  // [NEW] 선택적 (마이그레이션 기간)
      }
      ```
    - `Key Variables`: `tier`
    - `Safety`: 옵셔널 필드로 하위 호환성 유지

---

- [x] **P4-03**: [DB 마이그레이션 - tier 컬럼 추가] ✅ 마이그레이션 완료 (2026-01-03 20:15)
    - 📄 마이그레이션 문서: `plan_report/2601032000_tier_migration.md`
    - ✅ **P4-03-A**: Supabase SQL 실행 완료 (tier 컬럼, CHECK, INDEX)
    - ✅ **P4-03-B**: 기존 데이터 마이그레이션 완료 (Core:25, Style:14, Detail:14)
    - ✅ **P4-03-C**: POST API tier 저장 (이미 구현됨 - `getTierForPattern()`)
    - ✅ **P4-03-D**: GET API tier 필터링 추가 완료 (2026-01-03)
    - `Target`: Supabase SQL Editor (또는 migration 파일)
    - `Logic (Pseudo)`:
      ```sql
      -- rag_rule_candidates 테이블에 tier 컬럼 추가
      ALTER TABLE rag_rule_candidates
      ADD COLUMN tier TEXT CHECK (tier IN ('core', 'style', 'detail'));

      -- 기존 데이터는 NULL (미분류)
      ```
    - `Key Variables`: `tier` 컬럼
    - `Safety`: NULL 허용으로 기존 데이터 영향 없음

---

- [x] **P4-04**: [UI에 티어별 필터 추가] ✅ 완료 (2026-01-03 20:10)
    - ✅ useMemo 최적화 추가 (2026-01-03)
    - `Target`: `PatternAnalysisSection.tsx` > 헤더 영역 (필터 드롭다운 추가)
    - `Logic (Pseudo)`:
      ```tsx
      const [tierFilter, setTierFilter] = useState<RubricTier | 'all'>('all')

      // [P4-04] useMemo로 최적화
      const filteredCandidates = useMemo(() => {
        if (tierFilter === 'all') return candidates
        return candidates.filter(c => c.tier === tierFilter)
      }, [candidates, tierFilter])

      // UI
      <select value={tierFilter} onChange={e => setTierFilter(e.target.value)}>
        <option value="all">전체</option>
        <option value="core">🟢 Core (5)</option>
        <option value="style">🔵 Style (4)</option>
        <option value="detail">⚪ Detail (3)</option>
      </select>
      ```
    - `Key Variables`: `tierFilter`, `filteredCandidates`, `useMemo`
    - `Safety`: 필터 적용 시 개수 표시 업데이트

---

**Definition of Done (검증):**
- [x] Test: tier 컬럼 데이터 분류 완료 (NULL 0개)
- [ ] Test: tier='core' 필터 시 해당 항목만 표시 (브라우저 테스트 필요)
- [ ] Review: 5+4+3 조합 가이드 UI 추가 여부 결정 (Phase 5)

---

## 요약: 우선순위 및 의존성

```
Phase 1 (UI) ──┬──> Phase 2 (API) ──> Phase 3 (푸터)
               │
               └──> Phase 4 (Future - 독립 진행 가능)
```

| Phase | 예상 작업량 | 필수 여부 | 의존성 |
|-------|------------|----------|--------|
| Phase 1 | 중 | ✅ 필수 | 없음 |
| Phase 2 | 중 | ✅ 필수 | Phase 1 권장 |
| Phase 3 | 소 | 선택 | Phase 1 필수 |
| Phase 4 | 대 | 후순위 | DB 마이그레이션 필요 |

---

## 변경 파일 목록

| 파일 | Phase | 변경 유형 |
|------|-------|----------|
| `frontend/src/components/Assistant/PatternAnalysisSection.tsx` | P1, P2, P3 | 수정 |
| `frontend/src/app/api/rubrics/candidates/select/route.ts` | P2 | 수정 |
| `frontend/src/lib/rag/rubrics.ts` | P4 | 수정 |
| Supabase `rag_rule_candidates` 테이블 | P4 | 스키마 변경 |

---

**끝.**
