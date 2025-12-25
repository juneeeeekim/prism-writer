# <!--

# Pipeline v5 JeDebug 분석 - 마이그레이션 및 신뢰성 검토

파일명: 2512251732_Pipeline_v5_JeDebug_Analysis.md
버전: v1.0.0
생성일: 2025-12-25
분석 대상: 2512251728_Pipeline_v5_Implementation_Checklist.md

Project Domain: RAG 시스템 업그레이드 (Cursor식 Human-in-the-loop)
Tech Stack: Next.js, TypeScript, Supabase (PostgreSQL), Gemini 3 Flash
Scope: Core Logic Upgrade (평가 → 패치 제안 → Shadow Workspace)
Risk Level: High (핵심 평가 시스템 변경)
=============================================================================
-->

# Pipeline v5 JeDebug 분석

## 1) 🚨 위험 요소 및 디버깅 포인트 (Risk Checklist)

### C (Compatibility & Regression - 호환성 및 회귀 방지)

- [x] **(High) 기존 평가 시스템과 새 패치 시스템 간 Breaking Change** ✅ **COMPLETED**

  - [x] 원인: 현재 `EvaluationResult` 타입에 `patches[]` 필드 추가 시 기존 코드 파손
  - [x] 해결: Adapter 패턴 적용 - `PatchEnabledEvaluationResult` extends `V3EvaluationResult`
  - [x] 파일: `frontend/src/lib/rag/types/patch.ts` (신규 생성)
  - [x] 위치: PatchEnabledEvaluationResult 인터페이스, adaptToV5Result(), extractLegacyResult(), isV5Result()
  - [x] 연결성: Phase 1 완료 → Phase 4 UI 연결 가능
  - [x] 완료조건: TypeScript 컴파일 0 errors ✅

- [x] **(High) 3패널 UI가 기존 2패널 레이아웃 파손** ✅ **COMPLETED**

  - [x] 원인: `EditorPage.tsx` 레이아웃 전면 변경 시 기존 사용자 경험 파손
  - [x] 해결: Feature Flag `ENABLE_THREE_PANEL_UI`로 신/구 레이아웃 전환 가능
  - [x] 파일: `frontend/src/config/featureFlags.ts` (신규 생성)
  - [x] 위치: FEATURE_FLAGS.ENABLE_THREE_PANEL_UI, isFeatureEnabled(), getUILayoutType()
  - [x] 연결성: EditorPage.tsx가 isThreePanelMode로 Feature Flag 사용
  - [x] 완료조건: 플래그 OFF 시 기존 2패널 UI 정상 동작 ✅

- [x] **(Mid) Patch 타입과 기존 Gate 결과 타입 간 충돌** ✅ **COMPLETED**

  - [x] 원인: 기존 `GateResult`와 새 `PatchGateResult` 타입 혼용
  - [x] 해결: Wrapper 패턴 - `unifyGateResults()` 통합 함수 구현
  - [x] 파일: `frontend/src/lib/rag/patchGates.ts` (신규 생성)
  - [x] 위치: PatchGateResult, AllPatchGatesResult, validateAllPatchGates()
  - [x] 연결성: 기존 3종 Gate + 신규 2종 Gate 통합 완료
  - [x] 완료조건: TypeScript 컴파일 0 errors ✅

- [x] **(Mid) BM25 듀얼 인덱스와 기존 단일 검색 간 데이터 정합성** ✅ **COMPLETED**
  - [x] 원인: Rule Index와 Example Index 분리 시 chunk_type 미분류 데이터 누락
  - [x] 해결: 마이그레이션 스크립트로 기존 청크에 chunk_type 기본값('general') 할당
  - [x] 파일: `backend/migrations/035_classify_chunk_types_default.sql` (신규)
  - [x] 위치: rag_chunks 테이블, verify_chunk_type_migration() 검증 함수
  - [x] 연결성: Phase 2 시작 전 Supabase에서 마이그레이션 실행 필요
  - [x] 완료조건: `SELECT * FROM verify_chunk_type_migration()` → migration_status = 'SUCCESS'

### O (Operational & Performance Tuning - 운영 및 성능 튜닝)

- [x] **(High) Shadow Workspace 시뮬레이션으로 LLM 호출 3-5배 증가** ✅ **COMPLETED**

  - [x] 원인: 패치당 1회 시뮬레이션 → Gap Top3 패치 3개 × 시뮬레이션 = 최소 4회 LLM 호출
  - [x] 해결: 배치 처리 + 캐싱 - `criteriaPackCache.ts` 구현
  - [x] 파일: `frontend/src/lib/rag/cache/criteriaPackCache.ts` (신규 생성)
  - [x] 위치: CriteriaPackCache 클래스, getCachedCriteriaPack(), setCachedCriteriaPack()
  - [x] 연결성: change-plan API에서 캐시 사용 중
  - [x] 완료조건: TTL 기반 캐시 + LRU eviction + 통계 추적 구현 ✅

- [x] **(Mid) 패치 생성 API 응답 시간 증가로 UX 저하** ✅ **COMPLETED**
  - [x] 원인: `/api/rag/change-plan` 에서 검색 + 평가 + 패치 생성 + 시뮬레이션 순차 실행
  - [x] 해결: 병렬 처리 - `Promise.all([searchRules, searchExamples])` 적용
  - [x] 파일: `frontend/src/app/api/rag/change-plan/route.ts` (신규 생성)
  - [x] 위치: POST 핸들러, searchRulesParallel(), searchExamplesParallel()
  - [x] 연결성: 캐시 통합 완료, Feature Flag 체크 포함
  - [x] 완료조건: TypeScript 컴파일 0 errors ✅

### R (Robustness & Data Integrity - 견고성 및 데이터 무결성)

- [ ] **(High) 패치 적용 중 브라우저 크래시 시 데이터 불일치**

  - [ ] 원인: 사용자 글 수정 중 Apply 클릭 후 저장 전 크래시
  - [ ] 해결: 로컬 IndexedDB 백업 + 복구 메커니즘 구현
  - [ ] 파일: `frontend/src/lib/storage/patchBackup.ts` (신규 필요)
  - [ ] 위치: usePatchActions 훅
  - [ ] 연결성: Phase 4 UI 구현 시 함께 구현
  - [ ] 완료조건: 크래시 후 재접속 시 마지막 상태 복원 확인

- [ ] **(Mid) CriteriaPack Pin/Unpin 상태 동기화 실패**
  - [ ] 원인: 사용자별 Pin 상태가 서버와 클라이언트 간 불일치
  - [ ] 해결: Optimistic UI + 서버 확인 패턴 적용
  - [ ] 파일: `frontend/src/lib/rag/criteriaPack.ts` (신규)
  - [ ] 위치: buildCriteriaPack 함수
  - [ ] 연결성: Phase 2 완료 후 Phase 4 UI 연결 시
  - [ ] 완료조건: Pin 상태 변경 후 새로고침해도 유지 확인

### E (Evolution & Maintainability - 유지보수성 및 구조)

- [ ] **(Mid) Patch 생성 로직이 프레임워크에 강결합**

  - [ ] 원인: Next.js API Route에 비즈니스 로직 직접 구현
  - [ ] 해결: Clean Architecture - `PatchService` 클래스로 분리
  - [ ] 파일: `frontend/src/lib/rag/services/patchService.ts` (신규 권장)
  - [ ] 위치: change-plan route에서 호출
  - [ ] 연결성: Phase 3 구현 시 구조 적용
  - [ ] 완료조건: 비즈니스 로직 단독 단위 테스트 가능

- [ ] **(Low) 신규 타입 파일 난립으로 import 복잡도 증가**
  - [ ] 원인: patch.ts, changePlan.ts, simulation.ts 등 개별 파일 생성
  - [ ] 해결: `types/index.ts` 배럴 파일로 통합 export
  - [ ] 파일: `frontend/src/lib/rag/types/index.ts` (신규)
  - [ ] 위치: types 폴더
  - [ ] 연결성: Phase 1 타입 정의 완료 후
  - [ ] 완료조건: 외부에서 `import { Patch, ChangePlan } from '@/lib/rag/types'` 가능

### S (Security - 보안)

- [ ] **(High) 패치 적용 API에 RLS 우회 가능성**

  - [ ] 원인: 새 API 엔드포인트에 사용자 인증/인가 검증 누락 가능
  - [ ] 해결: Supabase RLS + API 레벨 userId 검증 이중 적용
  - [ ] 파일: `frontend/src/app/api/rag/change-plan/route.ts` (신규)
  - [ ] 위치: API 핸들러 시작 부분
  - [ ] 연결성: Phase 3 API 구현 시 필수 적용
  - [ ] 완료조건: 타 사용자 문서에 패치 적용 시도 시 403 반환

- [ ] **(Mid) Shadow Workspace 로그에 사용자 원문 노출**
  - [ ] 원인: 시뮬레이션 결과 로깅 시 before/after 텍스트 전체 저장
  - [ ] 해결: 로그 마스킹 - 첫 50자 + "..." 형태로 truncate
  - [ ] 파일: `frontend/src/lib/rag/shadowWorkspace.ts` (신규)
  - [ ] 위치: 로깅 구간
  - [ ] 연결성: Phase 1 Shadow Workspace 구현 시
  - [ ] 완료조건: 로그에서 전체 원문 노출 안됨 확인

### D (Deployment & Fallback - 배포 및 복구 전략)

- [ ] **(High) Feature Flag 부재로 롤백 불가**

  - [ ] 원인: 문서에 Feature Flag 구현 명시 없음
  - [ ] 해결: `ENABLE_PIPELINE_V5` 환경 변수 + 런타임 체크 구현
  - [ ] 파일: `frontend/src/config/featureFlags.ts` (신규)
  - [ ] 위치: 전역 설정
  - [ ] 연결성: Phase 1 시작 전 필수 구현
  - [ ] 완료조건: 플래그 OFF 시 기존 v4 평가 시스템만 동작

- [ ] **(Mid) Canary 배포 전략 부재**
  - [ ] 원인: 전체 사용자 대상 Big Bang 배포 위험
  - [ ] 해결: Vercel Preview Deployment를 Canary로 활용
  - [ ] 파일: (문서에 명시 없음)
  - [ ] 위치: Vercel 설정
  - [ ] 연결성: 최종 배포 전
  - [ ] 완료조건: Preview 환경에서 1주일 테스트 후 Production 배포

---

## 2) 🧪 필수 테스트 및 검증 시나리오 (Verification Checklist)

### Regression Test (기존 기능 보호)

- [ ] **RT-1: 기존 평가 요청 정상 동작**

  - [ ] Given: v4 평가 API 호출
  - [ ] When: 사용자 글 + 템플릿 전송
  - [ ] Then: 기존 형태의 EvaluationResult 반환
  - [ ] 파일: `frontend/src/lib/rag/templateGates.ts`
  - [ ] 완료조건: 기존 26개 테스트 100% 통과

- [ ] **RT-2: 기존 검색 결과 일치**

  - [ ] Given: hybridSearch 호출
  - [ ] When: 동일 쿼리 전송
  - [ ] Then: v4와 동일한 결과 반환
  - [ ] 파일: `frontend/src/lib/rag/search.ts`
  - [ ] 완료조건: 결과 개수/순서 일치

- [ ] **RT-3: 기존 UI 레이아웃 보존 (플래그 OFF 시)**

  - [ ] Given: ENABLE_THREE_PANEL_UI=false
  - [ ] When: 에디터 페이지 접속
  - [ ] Then: 기존 2패널 UI 표시
  - [ ] 파일: `frontend/src/components/Editor/EditorPage.tsx`
  - [ ] 완료조건: 스크린샷 비교 일치

- [ ] **RT-4: 기존 Gate 3종 정상 동작**

  - [ ] Given: validateAllGates 호출
  - [ ] When: 샘플 입력 전송
  - [ ] Then: Consistency, Hallucination, Regression Gate 모두 결과 반환
  - [ ] 파일: `frontend/src/lib/rag/templateGates.ts`
  - [ ] 완료조건: 각 Gate 결과 정상

- [ ] **RT-5: 기존 Telemetry 로깅 유지**
  - [ ] Given: 평가 요청 실행
  - [ ] When: telemetry_logs 테이블 조회
  - [ ] Then: 기존 필드 모두 정상 기록
  - [ ] 파일: `backend/telemetry`
  - [ ] 완료조건: run_type 필드 정상 기록

### Migration Test (데이터 정합성)

- [ ] **MT-1: chunk_type 마이그레이션 정합성**

  - [ ] 검증: 마이그레이션 전후 rag_chunks 레코드 수 일치
  - [ ] 쿼리: `SELECT COUNT(*) FROM rag_chunks`
  - [ ] 완료조건: 전후 COUNT 동일

- [ ] **MT-2: CriteriaPack 캐시 무결성**

  - [ ] 검증: 캐시 히트/미스 로그 정상 기록
  - [ ] 쿼리: 캐시 통계 API 호출
  - [ ] 완료조건: 캐시 손상 없음

- [ ] **MT-3: 신규 테이블 RLS 정책 적용**
  - [ ] 검증: criteria_packs 테이블 (신규 시) RLS 정책 존재
  - [ ] 쿼리: `SELECT * FROM pg_policies WHERE tablename = 'criteria_packs'`
  - [ ] 완료조건: 4개 정책(SELECT, INSERT, UPDATE, DELETE) 존재

### Load Test (성능 검증)

- [ ] **LT-1: 패치 생성 응답 시간 < 5초**

  - [ ] 목표 TPS: 10 req/s
  - [ ] 목표 Latency: P95 < 5초
  - [ ] 병목 후보: LLM API 호출, Shadow Workspace 시뮬레이션
  - [ ] 완료조건: 부하 테스트 통과

- [ ] **LT-2: 3패널 UI 렌더링 < 2초**

  - [ ] 목표: FCP < 2초, LCP < 3초
  - [ ] 병목 후보: 패치 카드 대량 렌더링
  - [ ] 완료조건: Lighthouse Performance > 80

- [ ] **LT-3: LLM 비용 폭발 방지**
  - [ ] 목표: 월 비용 < $50 (1,000 문서 기준)
  - [ ] 병목 후보: Shadow Workspace 반복 호출
  - [ ] 완료조건: 캐싱으로 호출 50% 절감

---

## 3) 🛑 롤백 및 비상 대응 전략 (Rollback Checklist)

### Feature Flag / Kill Switch

- [ ] **Feature Flag 존재 여부 확인: (문서에 명시 없음 - 신규 구현 필요)**
  - [ ] 플래그 이름 제안: `ENABLE_PIPELINE_V5` 또는 `ENABLE_SHADOW_WORKSPACE`
  - [ ] 환경 변수 위치: `.env.local`, Vercel Environment Variables
  - [ ] 비상 시 OFF 절차:
    - [ ] Vercel Dashboard → Settings → Environment Variables
    - [ ] `ENABLE_PIPELINE_V5=false` 설정
    - [ ] Redeploy 트리거
  - [ ] 완료조건: 플래그 OFF만으로 v4 동작 확인

### 롤백 시나리오

- [ ] **롤백 트리거 조건 정의**
  - [ ] 에러율 > 5% (기존 대비 2배 이상)
  - [ ] 평균 응답 시간 > 10초 (기존 대비 2배 이상)
  - [ ] 패치 적용 성공률 < 80%
- [ ] **롤백 수행자/승인자 정의**
  - [ ] 수행자: 시니어 개발자
  - [ ] 승인자: 디렉터
- [ ] **롤백 절차**
  - [ ] Step 1: Feature Flag OFF
  - [ ] Step 2: Vercel 이전 배포로 Rollback
  - [ ] Step 3: 캐시 무효화 (Redis/IndexedDB)
  - [ ] Step 4: 원인 분석 후 핫픽스
- [ ] 완료조건: 롤백 후 v4 정상 동작

### 데이터 롤백 불가 지점

- [ ] **롤백 불가 트랜잭션 목록**
  - [ ] CriteriaPack Pin 상태: 롤백 시 초기화 필요
  - [ ] 패치 적용 이력: 삭제 가능 (DROP 허용)
  - [ ] chunk_type 분류: 롤백 시 'general'로 원복 스크립트 필요
- [ ] **완화책**
  - [ ] 모든 신규 테이블에 soft delete 적용
  - [ ] 마이그레이션 롤백 스크립트 사전 작성
  - [ ] 데이터 변경 전 백업 스냅샷 생성
- [ ] 완료조건: 실패 시에도 데이터 오염 방지 확인

---

## 4) 추가 확인 필요사항 (Unknowns Checklist)

- [ ] **Q1: 3패널 UI 전환 시 기존 사용자 알림 방법**

  - [ ] 온보딩 모달 필요 여부
  - [ ] 변경 로그/공지 위치

- [ ] **Q2: 패치 제안 개수 상한 (Top3 외 추가 제안 허용?)**

  - [ ] "더 보기" 클릭 시 몇 개까지?
  - [ ] 성능 영향 분석 필요

- [ ] **Q3: CriteriaPack Pin 상태 저장 위치**

  - [ ] Supabase DB vs LocalStorage
  - [ ] 멀티 디바이스 동기화 필요 여부

- [ ] **Q4: Shadow Workspace 시뮬레이션 정확도 기준**

  - [ ] 예상 점수 vs 실제 적용 후 점수 오차 허용 범위
  - [ ] 오차 큰 경우 사용자 알림 여부

- [ ] **Q5: 기존 v4 사용자 마이그레이션 일정**

  - [ ] 점진적 롤아웃 vs Big Bang
  - [ ] Beta 테스터 모집 여부

- [ ] **Q6: A/B 테스트 계획**

  - [ ] v4 vs v5 성과 비교 지표
  - [ ] 테스트 기간

- [ ] **Q7: 모바일 반응형 3패널 레이아웃 처리**
  - [ ] 모바일에서 패널 축소/탭 전환 방식
  - [ ] 접근성 고려

---

## 5) 최종 의견 (Conclusion Checklist)

### Confidence 선택

- [ ] High
- [x] **Mid**
- [ ] Low

### Go/No-Go 선택

- [ ] Ready to Build
- [x] **Review Required**

### 결정 근거

- [ ] 기존 Pipeline v4 시스템이 방금 배포되어 안정화 기간 필요 (2025-12-25)
- [x] **Feature Flag / Kill Switch 미구현** - 롤백 불가 위험
- [x] **3패널 UI 전환이 기존 UX 파손 가능** - 사용자 혼란 우려
- [x] **Shadow Workspace LLM 비용 3-5배 증가 예상** - 비용 모니터링 필요
- [ ] Regression Test 케이스 사전 작성 필요
- [ ] Canary 배포 전략 수립 필요

### 최종 완료조건 (배포 전 필수 통과 게이트)

- [ ] Feature Flag `ENABLE_PIPELINE_V5` 구현 완료
- [ ] Regression Test 5개 케이스 100% 통과
- [ ] Load Test P95 < 5초 통과
- [ ] Preview 환경 1주일 테스트 완료
- [ ] 기존 v4 테스트 26개 100% 통과 유지
- [ ] 월간 LLM 비용 예측치 < $50 확인
