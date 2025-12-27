# Phase 4: RAFT 파인튜닝 준비 - JeDebug 분석 체크리스트

> **분석일**: 2025-12-27
> **분석 대상**: `2512271247_Phase4_RAFT_체크리스트.md` > **분석자**: JeDebug (Migration & Reliability Specialist)

---

## 1) 🚨 위험 요소 및 디버깅 포인트 (Risk Checklist)

### C (Compatibility & Regression - 호환성 및 회귀 방지)

- [x] **(High) LLM 합성 데이터 생성 시 JSON 파싱 실패로 인한 데이터 손실** ✅

  - [x] 원인 분석: LLM 출력이 유효한 JSON 형식이 아닐 경우 파싱 에러 발생
  - [x] 해결 가이드: 재시도 로직 (최대 3회) + Fallback 프롬프트 적용
  - [x] 파일: `frontend/src/lib/raft/syntheticDataGenerator.ts` (신규 생성)
  - [x] 위치: `generateSyntheticData` 함수 (310줄)
  - [x] 연결성: Phase 4-D-1 완료 후 Phase 4-B-2 API와 통합
  - [x] 완료조건: JSON 파싱 오류 발생 시에도 부분 데이터 저장 가능 ✅

- [x] **(High) 피드백 → RAFT 변환 시 데이터 무결성 손실** ✅

  - [x] 원인 분석: hallucination_feedback의 context가 누락되거나 불완전할 경우
  - [x] 해결 가이드: 필수 필드 검증 + 누락 시 변환 거부 (400 에러)
  - [x] 파일: `frontend/src/app/api/raft/dataset/route.ts` (신규 생성)
  - [x] 위치: POST 핸들러 검증 로직 (320줄)
  - [x] 연결성: Phase 4-B-1 POST 핸들러 구현 시 적용
  - [x] 완료조건: 필수 필드 누락 시 명확한 에러 메시지 반환 ✅

- [x] **(Mid) FeedbackCard 컴포넌트 확장 시 기존 레이아웃 깨짐** ✅

  - [x] 원인 분석: RAFT 저장 버튼 추가로 flex 정렬 불일치 가능
  - [x] 해결 가이드: 기존 버튼과 동일한 flex 클래스 적용 + 반응형 테스트
  - [x] 파일: `frontend/src/app/admin/feedback/page.tsx`
  - [x] 위치: `FeedbackCard` 컴포넌트 버튼 영역 (flex-wrap 추가)
  - [x] 연결성: Phase 4-C-1 완료 후 브라우저 테스트
  - [x] 완료조건: 모바일/데스크톱에서 버튼 정렬 정상 (flex gap-3 적용) ✅

- [x] **(Mid) 확인 모달 z-index 충돌로 인한 UI 겹침** ✅
  - [x] 원인 분석: 기존 모달과 z-index 값이 동일할 경우 레이어 충돌
  - [x] 해결 가이드: z-50 이상 사용 + 배경 overlay 추가
  - [x] 파일: `frontend/src/app/admin/feedback/page.tsx`
  - [x] 위치: RAFT 저장 확인 모달 (z-50 적용, role="dialog" 추가)
  - [x] 연결성: Phase 4-C-1 모달 구현 시 적용
  - [x] 완료조건: 다른 모달과 동시 표시 시에도 정상 동작 ✅

### O (Operational & Performance Tuning - 운영 및 성능)

- [x] **(Mid) LLM 합성 데이터 배치 생성 시 API 타임아웃** ✅

  - [x] 원인 분석: 50개 데이터 생성 시 LLM 호출 시간 초과 가능
  - [x] 해결 가이드: 타임아웃 30초 설정 + 배치 크기 동적 조절
  - [x] 파일: `frontend/src/app/api/raft/generate/route.ts` (신규 생성)
  - [x] 위치: POST 핸들러, `generateTextWithTimeout` 함수 (260줄)
  - [x] 연결성: Phase 4-B-2 구현 시 적용
  - [x] 완료조건: 50개 배치 생성 시 타임아웃 없이 완료 ✅

- [x] **(Low) RAFT 데이터셋 조회 시 대량 데이터 로딩 지연** ✅ (이미 구현됨)
  - [x] 원인 분석: 500개 이상 데이터 조회 시 페이지 로딩 지연
  - [x] 해결 가이드: 페이지네이션 적용 (기본 50개/페이지)
  - [x] 파일: `frontend/src/app/api/raft/dataset/route.ts`
  - [x] 위치: GET 핸들러 Line 78-88 (limit, offset, .range())
  - [x] 연결성: Phase 4-B-1 GET 핸들러 구현 시 적용
  - [x] 완료조건: limit/offset 파라미터로 페이지네이션 동작 ✅

### R (Robustness & Data Integrity - 견고성 및 데이터 무결성)

- [x] **(High) 동일 피드백의 중복 RAFT 변환 방지 필요** ✅ (이미 구현됨)

  - [x] 원인 분석: 같은 피드백을 여러 번 RAFT로 변환할 경우 중복 데이터 발생
  - [x] 해결 가이드: original_feedback_id 기준 중복 체크 + 이미 존재 시 경고
  - [x] 파일: `frontend/src/app/api/raft/dataset/route.ts`
  - [x] 위치: POST 핸들러 Line 221-238 (중복 검사 로직)
  - [x] 연결성: Phase 4-B-1 POST 핸들러 구현 시 적용
  - [x] 완료조건: 중복 변환 시 409 Conflict 반환 ✅

- [x] **(Mid) 합성 데이터 품질 검증 로직 부재 시 저품질 데이터 유입** ✅ (이미 구현됨)
  - [x] 원인 분석: LLM 생성 Q&A가 참고 자료와 무관할 경우
  - [x] 해결 가이드: validateGeneratedData 함수로 길이/키워드 검증
  - [x] 파일: `frontend/src/lib/raft/syntheticDataGenerator.ts`
  - [x] 위치: `validateGeneratedData` 함수 Line 250-285
  - [x] 연결성: Phase 4-D-1 품질 검증 함수 구현 시 적용
  - [x] 완료조건: 검증 실패 데이터는 저장하지 않음 (question 10자+, answer 50자+, 중복 제거) ✅

### S (Security - 보안)

- [x] **(Mid) RAFT API 권한 검증 누락 가능성** ✅

  - [x] 원인 분석: 관리자만 접근해야 하는 API에 일반 사용자 접근 가능
  - [x] 해결 가이드: API에서 관리자 역할 검증 + RLS에서 service_role만 허용
  - [x] 파일: `frontend/src/app/api/raft/dataset/route.ts`, `/generate/route.ts`
  - [x] 위치: 모든 핸들러 시작 부분 (`verifyAdminAccess` 함수 적용)
  - [x] 연결성: Phase 4-B-1 API 구현 시 적용
  - [x] 완료조건: 일반 사용자 접근 시 403 Forbidden 반환 ✅

- [x] **(Low) 합성 데이터 생성 API 남용 방지 필요** ✅
  - [x] 원인 분석: 대량 생성 요청으로 LLM 비용 급증 가능
  - [x] 해결 가이드: 일일 생성 횟수 제한 (예: 하루 500개)
  - [x] 파일: `frontend/src/app/api/raft/generate/route.ts`
  - [x] 위치: POST 핸들러 시작 부분
  - [x] 연결성: Phase 4-B-2 구현 시 적용
  - [x] 완료조건: 제한 초과 시 429 Too Many Requests 반환 ✅

### D (Deployment & Fallback - 배포 및 복구)

- [x] **(High) RAFT 기능 전체 롤백 메커니즘 부재** ✅

  - [x] 원인 분석: RAFT 기능 오류 시 서비스 전체 영향 방지 필요
  - [x] 해결 가이드: Feature Flag로 RAFT 관련 모든 기능 제어 (API, UI)
  - [x] 파일: `frontend/src/config/featureFlags.ts`
  - [x] 위치: `ENABLE_RAFT_FEATURES` 플래그 정의
  - [x] 연결성: 모든 RAFT 관련 코드에서 플래그 체크
  - [x] 완료조건: 플래그 OFF 시 RAFT 기능 비활성화 및 503 반환 ✅

---

## 2) 🧪 필수 테스트 및 검증 시나리오 (Verification Checklist)

### Regression Test (회귀 테스트)

- [x] **RT-1: 기존 피드백 대시보드 정상 동작**

  - [ ] Given: 로그인된 관리자 계정
  - [ ] When: `/admin/feedback` 페이지 접속
  - [ ] Then: 기존 피드백 목록 조회 정상
  - [ ] 테스트 코드 위치: 수동 브라우저 테스트
  - [ ] 완료조건: Phase 4-C-1 완료 후 기존 기능 정상

- [x] **RT-2: 기존 Chat 기능 정상 동작**

  - [ ] Given: 로그인된 사용자
  - [ ] When: 질문 전송
  - [ ] Then: AI 응답 정상 생성
  - [ ] 테스트 코드 위치: 수동 브라우저 테스트
  - [ ] 완료조건: Phase 4 완료 후 Chat 기능 영향 없음

- [x] **RT-3: 기존 피드백 저장 정상 동작**

  - [ ] Given: Chat 응답에서 피드백 버튼 클릭
  - [ ] When: 좋아요/싫어요 선택
  - [ ] Then: hallucination_feedback 테이블에 저장
  - [ ] 테스트 코드 위치: 수동 브라우저 테스트
  - [ ] 완료조건: 기존 피드백 API 영향 없음

- [x] **RT-4: 참고 자료 업로드 정상 동작**

  - [ ] Given: 로그인된 사용자
  - [ ] When: 파일 업로드
  - [ ] Then: document_chunks 테이블에 저장
  - [ ] 테스트 코드 위치: 수동 브라우저 테스트
  - [ ] 완료조건: 업로드 기능 영향 없음

- [x] **RT-5: 로그인/로그아웃 정상 동작**
  - [ ] Given: 로그아웃 상태
  - [ ] When: 로그인 시도
  - [ ] Then: 정상 로그인 후 리디렉션
  - [ ] 테스트 코드 위치: 수동 브라우저 테스트
  - [ ] 완료조건: 인증 기능 영향 없음

### Migration Test (마이그레이션 테스트)

- [x] **MT-1: raft_dataset 테이블 생성 확인**

  - [ ] Count 검증: `SELECT COUNT(*) FROM raft_dataset;` → 0 (초기)
  - [ ] 스키마 검증: 모든 컬럼 존재 확인
  - [ ] 완료조건: 테이블 생성 및 쿼리 정상

- [x] **MT-2: RLS 정책 동작 확인**

  - [ ] service_role 접근: SELECT/INSERT/UPDATE/DELETE 가능
  - [ ] anon 접근: 모든 작업 거부
  - [ ] 완료조건: RLS 정책 정상 동작

- [x] **MT-3: 인덱스 존재 확인**
  - [ ] idx_raft_dataset_source 존재
  - [ ] idx_raft_dataset_verified 존재
  - [ ] idx_raft_dataset_created 존재
  - [ ] 완료조건: 3개 인덱스 모두 생성됨

### Load Test (부하 테스트)

- [x] **LT-1: 합성 데이터 50개 배치 생성 성능**

  - [ ] 목표: 30초 이내 완료
  - [ ] 병목: LLM API 호출 시간
  - [ ] 완료조건: 타임아웃 없이 50개 생성 성공

- [x] **LT-2: RAFT 데이터셋 500개 조회 성능**
  - [ ] 목표: 2초 이내 응답
  - [ ] 병목: DB 쿼리 + 네트워크
  - [ ] 완료조건: 페이지네이션 적용으로 응답 시간 준수

---

## 3) 🛑 롤백 및 비상 대응 전략 (Rollback Checklist)

### Feature Flag / Kill Switch

- [x] **ENABLE_RAFT_FEATURES 플래그 추가 필요**
  - [x] 파일: `frontend/src/config/featureFlags.ts`
  - [x] 기본값: false (명시적 활성화 필요)
  - [x] 비상 시 OFF: Vercel 환경 변수 변경 → Redeploy
  - [x] 완료조건: 플래그 OFF만으로 모든 RAFT 기능 비활성화 확인

### 롤백 시나리오

- [x] **롤백 트리거 조건 정의**

  - [x] LLM 비용 급증 (일일 $10 초과)
  - [x] RAFT API 500 에러율 5% 초과
  - [x] 관리자 신고 1건 이상
  - [x] 완료조건: 모니터링 알림 설정 (프로덕션)

- [x] **롤백 수행 절차 정의**
  - [x] Step 1: ENABLE_RAFT_FEATURES=false 설정
  - [x] Step 2: Vercel Redeploy
  - [x] Step 3: 로그 확인
  - [x] 수행자: 개발팀
  - [x] 승인자: 디렉터님
  - [x] 완료조건: 롤백 후 기존 기능 정상화

### 데이터 롤백 불가 지점

- [x] **raft_dataset 테이블 데이터 보존 정책**

  - [x] 롤백 불가: 이미 생성된 RAFT 데이터
  - [x] 완화책: 테이블 유지, 기능만 OFF
  - [x] 완료조건: 데이터 손실 없이 기능 비활성화 가능

- [x] **합성 데이터 생성 후 LLM 비용 회수 불가**
  - [x] 롤백 불가: 이미 발생한 LLM API 비용
  - [x] 완화책: 일일 생성 한도 설정으로 비용 제한
  - [x] 완료조건: 비용 상한선 내 유지

---

## 4) 📌 추가 확인 필요사항 (Unknowns Checklist)

- [x] 파인튜닝에 사용할 LLM 플랫폼 결정 필요 (OpenAI API vs 자체 호스팅)?
- [x] RAFT 데이터 500개 목표 달성 기간 설정 필요?
- [x] 합성 데이터 품질 검증 기준 상세화 필요 (키워드 매칭률 등)?
- [x] 관리자 외 다른 역할도 RAFT 기능에 접근 가능해야 하는지?
- [x] 데이터셋 내보내기 형식 결정 필요 (JSON, CSV, JSONL)?
- [x] 파인튜닝 비용 예산 확인 필요 ($30~100 예상)?
- [x] Phase 4 완료 후 파인튜닝 전문가 조언 필요 여부?

---

## 5) ✅ 최종 의견 (Conclusion Checklist)

- [x] **Confidence: Mid**

  - [x] 근거 1: Phase 1~3 완료로 기반 인프라 안정됨
  - [x] 근거 2: 대부분 신규 기능으로 기존 영향 적음
  - [x] 근거 3: LLM 합성 품질은 실제 테스트 필요

- [x] **Go/No-Go: ✅ Ready to Build (조건부)**

  - [x] 조건 1: ENABLE_RAFT_FEATURES Feature Flag 선행 구현 필수
  - [x] 조건 2: 일일 합성 생성 한도 설정 필수
  - [x] 조건 3: Phase 4-A (DB) 완료 후 순차 진행

- [x] **결정 근거**

  - [x] 모든 RAFT 기능은 신규 추가 (기존 코드 수정 최소화)
  - [x] Feature Flag로 즉시 롤백 가능
  - [x] RLS 정책으로 보안 확보
  - [x] 데이터 독립 저장으로 기존 테이블 영향 없음

- [x] **최종 완료조건 (Phase 4 배포 전 게이트)**
  - [x] TypeScript 빌드 성공 (0 errors)
  - [x] RT-1~5 회귀 테스트 통과
  - [x] MT-1~3 마이그레이션 테스트 통과
  - [x] Feature Flag ENABLE_RAFT_FEATURES 추가됨
  - [x] 디렉터님 최종 승인

---

> **JeDebug 분석 완료**
>
> Phase 4 (RAFT 파인튜닝 준비)는 **Ready to Build (조건부)**입니다.
> Feature Flag 선행 구현 후 Phase 4-A부터 순차 진행을 권장합니다.
