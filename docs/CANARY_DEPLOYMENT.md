# Pipeline v5 Canary 배포 전략

> 파일: docs/CANARY_DEPLOYMENT.md
> 생성일: 2025-12-25
> 목적: Pipeline v5 안전한 배포를 위한 Canary 전략 가이드

---

## 1. 개요

Pipeline v5는 핵심 평가 시스템을 변경하므로, 점진적 배포(Canary)를 통해 위험을 최소화합니다.

### 배포 순서

```
1단계: Preview (개발팀 테스트)
   ↓
2단계: Staging (내부 QA)
   ↓
3단계: Canary (5% 사용자)
   ↓
4단계: Production (전체)
```

---

## 2. Vercel Preview Deployment 활용

### 2.1 Preview 환경 생성

모든 PR은 자동으로 Preview URL이 생성됩니다:

- URL 형식: `prism-writer-<branch>-<org>.vercel.app`
- Feature Flag: `ENABLE_PIPELINE_V5=true` 설정

### 2.2 Preview 환경에서 테스트 항목

| 항목      | 테스트 내용          | 담당   |
| --------- | -------------------- | ------ |
| 목차 제안 | 참고자료 기반 생성   | QA     |
| AI 채팅   | vectorSearch 연동    | QA     |
| 평가      | v3 템플릿 + 참고자료 | QA     |
| 패치 제안 | Gap 분석 + 패치      | 개발팀 |

---

## 3. Feature Flag 기반 Canary

### 3.1 환경 변수 설정

```bash
# Preview 환경 (테스트용)
ENABLE_PIPELINE_V5=true
ENABLE_SHADOW_WORKSPACE=true
ENABLE_PATCH_SUGGESTIONS=true

# Production 환경 (안전 모드)
ENABLE_PIPELINE_V5=false
ENABLE_SHADOW_WORKSPACE=false
ENABLE_PATCH_SUGGESTIONS=false
```

### 3.2 점진적 활성화

| 단계  | 기간 | 대상      | Flag 설정                  |
| ----- | ---- | --------- | -------------------------- |
| 1단계 | 1일  | 개발팀만  | Preview + V5=true          |
| 2단계 | 3일  | 내부 QA   | Staging + V5=true          |
| 3단계 | 7일  | 5% 사용자 | Production + 사용자별 분기 |
| 4단계 | 이후 | 전체      | V5=true 기본값 변경        |

---

## 4. 롤백 절차

### 4.1 즉시 롤백 (30초 이내)

```bash
# Vercel Dashboard에서 환경 변수 변경
ENABLE_PIPELINE_V5=false

# Redeploy 트리거
vercel --prod
```

### 4.2 롤백 트리거 조건

| 조건        | 임계값       | 액션         |
| ----------- | ------------ | ------------ |
| 에러율      | > 5%         | 즉시 롤백    |
| 응답 시간   | > 10초 (P95) | 즉시 롤백    |
| 사용자 불만 | > 5건/시간   | 검토 후 롤백 |

---

## 5. 모니터링 체크리스트

> ✅ **코드로 구현됨**: `frontend/src/lib/monitoring/deploymentMonitor.ts`

### 5.1 배포 직후 (1시간)

- [x] Vercel Analytics 확인 → `measureApiCall()` 함수로 API 응답 시간 추적
- [x] Supabase 쿼리 성능 확인 → `logMetric()` 함수로 성능 로깅
- [x] 에러 로그 모니터링 → `logError()`, `logWarning()` 함수
- [x] LLM 비용 추적 → `trackLLMCall()` 함수로 예상 비용 계산

### 5.2 사용 방법

```typescript
import { startPostDeploymentMonitoring } from "@/lib/monitoring/deploymentMonitor";

// 배포 후 1시간 동안 자동 모니터링
startPostDeploymentMonitoring();
```

### 5.3 일일 점검 (7일간)

- [x] 평균 응답 시간 < 5초 확인 → `checkResponseTimeTarget()` 함수
- [x] 캐시 히트율 > 80% 확인 → `checkCacheHitTarget()` 함수
- [x] 사용자 피드백 수집 → `collectUserFeedback()` 함수
- [x] 패치 적용률 추적 → `trackPatchApplication()` 함수

### 5.4 일일 점검 사용 방법

```typescript
import {
  printDailyCheckReport,
  getDailyCheckReport,
  collectUserFeedback,
  trackPatchApplication,
} from "@/lib/monitoring/deploymentMonitor";

// 일일 리포트 콘솔 출력
printDailyCheckReport();

// 일일 리포트 객체 반환 (API용)
const report = getDailyCheckReport();

// 사용자 피드백 수집
collectUserFeedback(5, "매우 좋습니다!");

// 패치 적용 추적
trackPatchApplication("applied");
```

---

## 6. 커뮤니케이션 계획

### 6.1 사용자 공지

```markdown
## 새로운 기능: 글쓰기 개선 제안 (Beta)

PRISM Writer가 더 똑똑해졌습니다!

- 업로드한 참고자료 기반 목차 제안
- AI가 구체적인 수정 방법 제안
- 수정 전/후 미리보기 기능

피드백을 보내주시면 서비스 개선에 반영하겠습니다.
```

### 6.2 문제 발생 시 공지

```markdown
## 서비스 안정화 작업 안내

일부 사용자분께서 불편을 겪고 계신 점 사과드립니다.
현재 기존 버전으로 자동 전환되었으며, 안정적인 서비스를 제공하고 있습니다.
빠른 시일 내에 개선된 기능을 다시 선보이겠습니다.
```

---

## 7. 완료 기준

### 7.1 Canary 성공 조건

- [ ] Preview 환경 7일 테스트 완료
- [ ] 에러율 < 1%
- [ ] P95 응답 시간 < 5초
- [ ] 사용자 만족도 조사 긍정 > 70%
- [ ] LLM 월간 비용 < $50 (1,000 문서 기준)

### 7.2 Production 배포 승인

- [ ] QA 팀 승인
- [ ] 개발팀 승인
- [ ] 디렉터 승인

---

## 8. 참고 자료

- [Feature Flags 설정](../frontend/src/config/featureFlags.ts)
- [JeDebug 분석 문서](../plan_report/2512251732_Pipeline_v5_JeDebug_Analysis.md)
- [Vercel 배포 가이드](https://vercel.com/docs)
