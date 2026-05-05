# PRISM Writer - Backend-required E2E Gate 결정 문서
> **문서 ID:** 2605051850-BG  
> **작성일:** 2026-05-05  
> **작성자:** Codex Orchestrator  
> **상태:** 사용자 결정 필요  
> **대상:** `backend-required` E2E를 릴리스/CI 필수 gate로 올릴지 결정  

---

## 1. 배경/문제 정의

기존 E2E는 UI 테스트와 `localhost:8000` 백엔드 API 호출이 한 파일에 섞여 있었다. 백엔드가 실행 중이 아니면 `ECONNREFUSED`로 실패했고, 실패 원인이 UI 회귀인지 인프라 준비 실패인지 구분되지 않았다.

이번 자동 실행에서는 mock 기반 테스트를 제거하고, 실제 FastAPI 백엔드를 요구하는 테스트를 `backend-required` 그룹으로 분리했다. 다만 이 그룹을 PR 필수 gate로 올릴지는 백엔드 기동 방식과 CI 비용/속도에 영향을 주므로 사용자 결정이 필요하다.

---

## 2. 옵션 A/B/C

| 옵션 | 내용 | 비용 | 리스크 | 소요 시간 | 롤백 난이도 |
|---|---|---:|---|---:|---|
| A | 로컬/수동 실행만 유지 | 낮음 | CI에서 회귀를 못 잡음 | 0.5일 | 낮음 |
| B | CI에서 FastAPI를 직접 기동 후 `backend-required` 필수 실행 | 중간 | CI 환경 의존성 증가 | 1~2일 | 낮음 |
| C | Docker compose로 frontend/backend/test env를 통합 기동 | 중간~높음 | compose 유지보수 필요 | 2~4일 | 중간 |

---

## 3. 추천안과 근거

추천은 **옵션 B**다.

근거:
- 현재 backend-required 범위는 `/health`, `/v1/outline/generate`처럼 비용 없는 deterministic API로 제한되어 있다.
- `frontend/scripts/e2e-preflight-backend.mjs`가 실행 전에 `/health`와 outline schema를 확인하므로 실패 원인이 명확하다.
- Docker compose 통합은 더 견고하지만, 지금은 릴리스 gate를 빠르게 정상화하는 것이 우선이다.

참조:
- `frontend/e2e/backend-required.backend.spec.ts`
- `frontend/scripts/e2e-preflight-backend.mjs`
- `backend/main.py`
- `backend/src/presentation/api/outline.py`

---

## 4. 결정 시 실행 체크리스트

- [ ] CI 작업에서 `backend` 디렉터리 의존성 설치 방식을 확정한다.
- [ ] CI 작업에서 `python -m uvicorn main:app --host 127.0.0.1 --port 8000`을 백그라운드로 기동한다.
- [ ] backend readiness 대기 후 `cd frontend && npm run test:e2e:backend-required`를 실행한다.
- [ ] 실패 시 릴리스 차단 기준을 `preflight 실패`, `contract 실패`, `test timeout`으로 구분해 기록한다.
- [ ] `E2E_BACKEND_URL`을 CI 환경변수로 명시한다.
- [ ] backend-required 실패 시 unit/build 결과와 분리된 artifact를 저장한다.

---

## 5. 영향 범위

- `frontend/package.json` E2E scripts
- `frontend/playwright.config.ts`
- CI workflow 또는 배포 전 검증 절차
- FastAPI backend 실행 환경

---

## 6. 롤백 계획

- CI에서 `npm run test:e2e:backend-required` 단계를 제거한다.
- 로컬 수동 실행 문서만 유지한다.
- 코드 API는 변경하지 않았으므로 서비스 런타임 롤백은 필요 없다.
