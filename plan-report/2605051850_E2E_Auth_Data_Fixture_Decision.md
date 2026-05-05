# PRISM Writer - Auth/Data Fixture E2E 결정 문서
> **문서 ID:** 2605051850-AD  
> **작성일:** 2026-05-05  
> **작성자:** Codex Orchestrator  
> **상태:** 사용자 결정 필요  
> **대상:** 로그인, 문서 업로드, 문서 처리, 에디터 실제 UI E2E fixture 정책  

---

## 1. 배경/문제 정의

기존 UI E2E는 현재 UI와 맞지 않는 locator를 사용했고, `/editor`는 인증/권한 미충족 시 login으로 redirect된다. 또한 기존 RAG status E2E는 `page.route().fulfill()`로 upload/process를 mock 처리했기 때문에 사용자가 원하는 “실제 작동 검증”과 충돌했다.

이번 자동 실행에서는 mock 테스트를 제거하고, 인증 보호 흐름만 `ui-smoke`에서 실제로 확인하도록 정리했다. 하지만 실제 login/upload/process까지 자동화하려면 test user, role, project, storage cleanup 정책이 필요하다.

---

## 2. 옵션 A/B/C

| 옵션 | 내용 | 비용 | 리스크 | 소요 시간 | 롤백 난이도 |
|---|---|---:|---|---:|---|
| A | unauth smoke만 유지 | 낮음 | 로그인 후 실제 핵심 흐름 미검증 | 0.5일 | 낮음 |
| B | staging test user로 login/dashboard/editor smoke 추가 | 중간 | 계정/세션 fixture 관리 필요 | 1~3일 | 중간 |
| C | upload/process/search/chat 전체 실제 E2E 추가 | 높음 | DB/Storage/usage 오염 가능 | 3~7일 | 높음 |

---

## 3. 추천안과 근거

추천은 **옵션 B 후, C를 external-smoke 문서 결정과 함께 단계 도입**이다.

근거:
- 인증 후 dashboard/editor까지는 기존 기능 보호에 직접 도움이 된다.
- upload/process는 Storage와 DB write가 발생하므로 cleanup 없는 자동 실행은 위험하다.
- chat은 사용량 차감과 LLM 비용이 연결되어 있어 quota/idempotency 결정 전까지 기본 E2E에 넣으면 안 된다.

참조:
- `frontend/e2e/ui-smoke.ui.spec.ts`
- `frontend/src/middleware.ts`
- `frontend/src/components/documents/DocumentUploader.tsx`
- `frontend/src/app/api/documents/upload/route.ts`
- `frontend/src/app/api/documents/process/route.ts`

---

## 4. 결정 시 실행 체크리스트

- [ ] staging 전용 test user email/password를 secret manager에 등록한다.
- [ ] test user role을 `free` 이상, 승인 완료 상태로 고정한다.
- [ ] test project prefix를 `e2e-`로 통일한다.
- [ ] login fixture를 Playwright `storageState`로 생성한다.
- [ ] dashboard 접근, project 생성, editor 접근 smoke를 추가한다.
- [ ] upload/process를 포함할 경우 작은 txt fixture만 사용한다.
- [ ] 테스트 종료 후 `user_documents`, storage object, 관련 chunks를 삭제한다.
- [ ] cleanup 실패 시 release를 보류하고 수동 cleanup 절차를 실행한다.

---

## 5. 영향 범위

- Supabase Auth
- profiles/role approval
- projects/user_documents/chunks
- Supabase Storage bucket
- editor/dashboard UI locator
- Playwright secret handling

---

## 6. 롤백 계획

- login fixture secret을 제거한다.
- `ui-smoke`를 unauth smoke만 남긴다.
- staging test data cleanup script를 실행한다.
- 실패한 upload/process smoke는 release 필수 gate에서 제외한다.
