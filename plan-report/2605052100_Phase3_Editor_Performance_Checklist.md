# Phase 3 — /editor 성능 다이어트 체크리스트

> **문서 ID:** 2605052100
> **작성일:** 2026-05-05
> **작성자:** 기술 리더 + Frontend Performance Expert
> **현재**: `/editor` 397 kB / Middleware 162 kB
> **목표**: `/editor` ≤ 250 kB / Middleware ≤ 100 kB
> **측정 도구**: `@next/bundle-analyzer`

---

## 측정 기반 진단 (두 에이전트 합의)

| 원인 | 위치 | 예상 절감 |
|---|---|---|
| `@tiptap/*` 4개 static import | `RichShadowWriter.tsx:29-32` | 70~100 kB |
| ShadowWriterEditor 두 에디터 동시 import | `ShadowWriterEditor.tsx:12-14` | 위와 중첩 |
| AssistantPanel 5개 탭 항상 마운트 | `AssistantPanel.tsx:252-335` | 30~50 kB |
| `diff` 패키지 static import | `VersionDiffViewer.tsx:12` | 15~25 kB |
| `CoachManager` static (조건부 렌더지만 import는 항상) | `ChatTab.tsx:36` | 10~15 kB |

---

## P3.1 — 측정 인프라 구축

- [ ] `@next/bundle-analyzer` devDependency 추가
- [ ] `next.config.js`에 `withBundleAnalyzer` 래퍼 적용
- [ ] `ANALYZE=true npm run build`로 baseline 측정 (PowerShell: `$env:ANALYZE="true"; npm run build`)
- [ ] `.next/analyze/client.html` baseline 스냅샷 보관

## P3.2 — Quick Wins (낮은 위험)

- [ ] **Tiptap dynamic** — `ShadowWriterEditor.tsx`에서 `RichShadowWriter`를 `next/dynamic({ ssr:false })`로 전환
- [ ] **VersionHistory dynamic** — `MarkdownEditor.tsx`에서 `VersionHistoryPanel`을 dynamic import (버튼 클릭 후 마운트)
- [ ] **CoachManager dynamic** — `ChatTab.tsx`에서 `showCoachManager` true일 때만 import
- [ ] **OnboardingGuide dynamic** — `editor/page.tsx`에서 `setup_completed=false`일 때만 import

## P3.3 — AssistantPanel 비초기 탭 분리

- [ ] **EvaluationTab dynamic** — 사용자가 evaluation 탭 클릭 후에만 import
- [ ] **SmartSearchTab dynamic** — 동일
- [ ] **StructureTab dynamic** — 동일 (Feature Flag ON 시에만)
- [ ] **ReferenceTab는 default 탭이라 static 유지** — 첫 노출 보장

## P3.4 — next.config.js 최적화

- [ ] `experimental.optimizePackageImports`에 `lucide-react`, `@radix-ui/*`, `date-fns` 추가
- [ ] icon barrel import 패턴 점검 (직접 경로 또는 named import 강제)

## P3.5 — Middleware 슬림화 (조사 결과: 결정 문서 필요)

- [x] middleware import 트리 점검 — `@supabase/ssr` + `next/server`만 사용 (이미 권고 패턴)
- [x] `@supabase/auth-helpers-*` 잔존 여부 확인 — 사용 안 함, `@supabase/ssr`만 사용 ✅
- [x] matcher config — 이미 `/editor /admin /profile /dashboard /trash /documents`로 제한됨 ✅
- [ ] DB 프로필 조회를 Route Handler로 이동 — **별도 결정 문서 필요**
  - 162kB의 대부분은 `@supabase/ssr` 자체 (Vercel 공식 권고 패턴)
  - 100kB 미만으로 내리려면 cookie 기반 JWT 직접 검증으로 전환해야 함 → 보안 정책 변경 동반
  - 본 Phase 범위 밖. 결정은 `docs/decision-middleware-auth-strategy.md`에서 다루기로 보류

## P3.6 — 검증 + 회귀 가드

- [x] `npm run build` 재측정 결과:
  | Route | Before | After | Δ |
  |---|---|---|---|
  | `/editor` First Load JS | 397 kB | **186 kB** | **-211 kB (-53%)** |
  | `/editor` Page chunk | 239 kB | **26.8 kB** | **-212 kB (-89%)** |
  | Middleware | 162 kB | 162 kB | (별도 결정 보류) |
- [x] `npm run test` — 15 files / 121 passed / 1 skipped ✅
- [x] `npm run lint` — No warnings or errors ✅
- [ ] (선택, 후속 작업) bundlewatch CI 가드 추가 — `/editor` 220kB budget

---

## 중단 조건

- 빌드 실패 또는 타입 에러 10건 이상 발생 시 즉시 중단하고 보고
- 기능 회귀 발견 시 즉시 rollback (각 단계는 독립 commit으로 분리)

## Rollback

각 P3.x 단계는 독립 커밋이므로 `git revert <sha>`로 단계 단위 롤백 가능.
