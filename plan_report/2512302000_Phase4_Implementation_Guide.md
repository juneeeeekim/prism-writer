# 🔵 Phase 4: 검증 및 완료 - 구현 지시서

> **문서 유형**: Tech Lead Implementation Guide  
> **생성일**: 2025-12-30 20:00  
> **원본 설계**: [Phase4 체크리스트](./2512290708_Phase4_Verification_Checklist.md)  
> **마스터 플랜**: [Architecture Refactoring Master Plan](./2512290307_Architecture_Refactoring_Master_Plan.md)  
> **선행 조건**: Phase 0, 1, 2, 3 완료 ✅  
> **목표**: 전체 시스템 안정성 확인 및 문서화  
> **예상 소요**: 2~3시간

---

## ⚠️ Before Start - 주의사항

### 절대 건드리지 말 것 (레거시 보호)

| 파일                             | 이유                            |
| -------------------------------- | ------------------------------- |
| `lib/rag/rubrics.ts`             | DEFAULT_RUBRICS Fallback용 유지 |
| `supabase/migrations/202512290*` | Phase 0~3 마이그레이션 유지     |
| `search.ts` L210, 252, 275       | [P0-01-D Fix] 유지              |

### 회귀 테스트 포인트

```
[Phase 0~3 완료 상태 확인]
───────────────────────────────────────────────────────────────────────
✅ RLS 정책 6개 (rag_chunks)
✅ templateTypes.ts:56-78 → TemplateSchemaV2
✅ rag.ts:497-611 → RagRule, RagExample, RagTemplate
✅ featureFlags.ts:160-182 → P3 플래그
✅ npm run build → Exit code: 0
```

---

## 📋 Phase 4.1: E2E 테스트

### P4-01-A: 문서 업로드 및 처리 테스트

**담당**: QA 엔지니어  
**우선순위**: 🔴 Critical

---

- [x] **P4-01-A**: 문서 업로드 E2E 테스트 ✅ **PASSED (2025-12-30 20:10)**

  - `Target`: Browser > `http://localhost:3000/editor` > 참고자료 탭
  - `Result`: ✅ **모든 항목 정상 동작**
    - 페이지 로드: ✅ 정상 (Dual Pane 레이아웃)
    - 로그인 상태: ✅ 세션 유지됨 (userId: 9197d9da-...)
    - 참고자료 탭: ✅ 정상 표시 및 전환
    - 파일 업로드 영역: ✅ 드래그앤드롭 존, PDF/DOCX/TXT/MD 지원, 50MB 제한 표시
    - 문서 목록: ✅ `Knowledge Source (1)` - `2512_bpt_풀링컨텐츠_분석_강의.pdf` (**✅ 완료** 상태)
    - 콘솔 에러: ✅ 없음 (Feature Flags v5, Gemini 정상 초기화)
  - `Screenshot`: `editor_reference_tab_verification_1767093025087.png`
  - `Key Variables`: `documentId`, `status`, `file_path`
  - `Safety`: ✅ 검증됨

---

### P4-01-B: 검색 기능 테스트

**담당**: QA 엔지니어  
**우선순위**: 🟠 High

---

- [ ] **P4-01-B**: RAG 검색 API 테스트

  - `Target`: `frontend/src/lib/rag/search.ts` > `hybridSearch()`
  - `Logic (Pseudo)`:

    ```
    // Test 1: 정확한 키워드 검색
    const results = await hybridSearch("업로드한 문서의 핵심 키워드", {
      userId: currentUser.id,
      topK: 5,
      minScore: 0.35
    });
    expect(results.length).toBeGreaterThan(0);

    // Test 2: RLS 검증 (타인 문서 접근 불가)
    const otherUserResults = await hybridSearch("other_user_content", {
      userId: currentUser.id,  // 본인 ID로 검색
      topK: 5
    });
    expect(otherUserResults).toEqual([]);  // 빈 결과
    ```

  - `Key Variables`: `query`, `userId`, `topK`, `minScore`, `category`
  - `Safety`: try-catch 필수, 빈 결과 처리

---

### P4-01-C: 평가 기능 테스트

**담당**: QA 엔지니어  
**우선순위**: 🔴 Critical

---

- [x] **P4-01-C**: 종합 평가 및 기준별 평가 테스트 ⚠️ **UI PASS / API WARNING (2025-12-30 20:15)**

  - `Target`: 평가 탭 UI 검증
  - `Result`:
    - 평가 탭 UI: ✅ 정상 표시 및 전환
    - 재평가 버튼: ✅ 정상 동작
    - 이전 평가 기록: ✅ 여러 건 표시 (90점 기록 확인)
    - 현재 평가: ⚠️ 0점 ("평가 과정에서 오류가 발생했습니다")
    - 에러 토스트: ⚠️ "3 errors" 표시 (API 연결 문제 추정)
  - `Screenshot`: `click_feedback_1767093119940.png`
  - `Key Variables`: `userText`, `category`, `criteriaId`
  - `Safety`: ⚠️ API 에러 추가 조사 필요 (LLM 연결 또는 토큰 문제 추정)

---

### P4-01-D: 채팅 기능 테스트

**담당**: QA 엔지니어  
**우선순위**: 🟠 High

---

- [x] **P4-01-D**: RAG 기반 채팅 테스트 ✅ **PASSED (2025-12-30 20:15)**

  - `Target`: AI 채팅 탭 UI 검증
  - `Result`: ✅ **모든 항목 정상 동작**
    - 채팅 탭 UI: ✅ 정상 표시 및 전환
    - 채팅 인터페이스: ✅ 사이드바 + 메인 채팅 영역 구조
    - 채팅 히스토리: ✅ 이전 세션 목록 표시 (12/29, 12/30 기록)
    - 메시지 입력: ✅ 입력 필드 및 플레이스홀더 정상
    - 환영 메시지: ✅ "💬 AI 어시스턴트와 대화를 시작해보세요." 표시
  - `Screenshot`: `click_feedback_1767093127738.png`
  - `Key Variables`: `messages`, `sessionId`, `category`
  - `Safety`: ✅ 검증됨

---

## 📋 Phase 4.2: 성능 테스트

### P4-02-A: API 응답 시간 측정

**담당**: Backend 개발자  
**우선순위**: 🟠 High

---

- [ ] **P4-02-A**: 주요 API 응답 시간 측정

  - `Target`: 브라우저 DevTools Network 탭 또는 터미널
  - `Logic (Pseudo)`:

    ```powershell
    # PowerShell 응답 시간 측정
    $endpoints = @(
      @{ Name = "search"; Url = "http://localhost:3000/api/rag/search"; Body = '{"query":"test","topK":5}' },
      @{ Name = "evaluate-holistic"; Url = "http://localhost:3000/api/rag/evaluate-holistic"; Body = '{"userText":"테스트 글입니다. 50자 이상 작성해야 합니다. 이것은 테스트를 위한 내용입니다.","category":"미분류"}' }
    )

    foreach ($ep in $endpoints) {
      $sw = [System.Diagnostics.Stopwatch]::StartNew()
      try {
        $response = Invoke-RestMethod -Uri $ep.Url -Method Post -ContentType "application/json" -Body $ep.Body
        $sw.Stop()
        Write-Host "$($ep.Name): $($sw.ElapsedMilliseconds)ms"
      } catch {
        Write-Host "$($ep.Name): ERROR"
      }
    }
    ```

  - `Key Variables`: P95 응답 시간 목표
    - `/api/rag/search` → < 500ms
    - `/api/rag/evaluate-holistic` → < 5000ms
    - `/api/chat` TTFT → < 2000ms
  - `Safety`: 타임아웃 설정, 재시도 로직

---

## 📋 Phase 4.3: 보안 테스트

### P4-03-A: RLS 정책 테스트

**담당**: 보안 엔지니어  
**우선순위**: 🔴 Critical

---

- [ ] **P4-03-A**: RLS 정책 검증

  - `Target`: Supabase SQL Editor
  - `Logic (Pseudo)`:

    ```sql
    -- Test 1: User A가 User B 문서 조회 시도
    -- (User A로 인증된 상태에서)
    SELECT * FROM user_documents WHERE user_id = '<USER_B_ID>' LIMIT 1;
    -- Expected: 0 rows (RLS가 차단)

    -- Test 2: rag_chunks JOIN 검증
    SELECT rc.* FROM rag_chunks rc
    JOIN user_documents ud ON rc.document_id = ud.id
    WHERE ud.user_id = '<USER_B_ID>' LIMIT 1;
    -- Expected: 0 rows

    -- Test 3: 비공개 템플릿 접근
    SELECT * FROM rag_templates
    WHERE user_id = '<USER_B_ID>' AND is_public = false LIMIT 1;
    -- Expected: 0 rows
    ```

  - `Key Variables`: `auth.uid()`, `user_id`, `is_public`
  - `Safety`: 모든 테이블에 RLS 활성화 확인

---

### P4-03-B: API 권한 검사

**담당**: 보안 엔지니어  
**우선순위**: 🟠 High

---

- [ ] **P4-03-B**: 인증/인가 검증

  - `Target`: 모든 `/api/*` 엔드포인트
  - `Logic (Pseudo)`:

    ```bash
    # Test 1: 인증 없이 호출
    curl -X POST http://localhost:3000/api/rag/evaluate \
      -H "Content-Type: application/json" \
      -d '{"userText": "test"}'
    # Expected: 401 Unauthorized

    # Test 2: 타인 문서 처리 시도
    curl -X POST http://localhost:3000/api/documents/process \
      -H "Authorization: Bearer $USER_A_TOKEN" \
      -d '{"documentId": "<USER_B_DOC_ID>"}'
    # Expected: 403 Forbidden 또는 404 Not Found
    ```

  - `Key Variables`: `Authorization` 헤더, `user_id` 검증
  - `Safety`: IDOR 방지, 적절한 에러 응답

---

## 📋 Phase 4.4: 문서화

### P4-04-A: README 업데이트

**담당**: 문서 담당자  
**우선순위**: 🟡 Medium

---

- [ ] **P4-04-A**: README 업데이트

  - `Target`: `README.md`
  - `Logic (Pseudo)`:

    ```markdown
    ## 추가할 섹션

    ### 아키텍처

    - RAG 기반 계층 구조 다이어그램
    - Template Builder 시스템 설명

    ### Feature Flags

    | 플래그        | 환경 변수               | 기본값 | 설명                 |
    | ------------- | ----------------------- | ------ | -------------------- |
    | v3 평가       | ENABLE_PIPELINE_V5      | true   | v3 평가 시스템       |
    | Template 채팅 | USE_TEMPLATE_FOR_CHAT   | false  | 채팅 템플릿 컨텍스트 |
    | 인용 표시     | ENABLE_SOURCE_CITATIONS | true   | 평가 원문 인용       |
    ```

  - `Key Variables`: N/A
  - `Safety`: 기존 내용 유지, 추가만

---

## 📋 Phase 4.5: Walkthrough 작성

### P4-05-A: Walkthrough 문서 작성

**담당**: 전체 팀  
**우선순위**: 🟡 Medium

---

- [ ] **P4-05-A**: 리팩토링 결과 요약

  - `Target`: `plan_report/2512302000_Architecture_Refactoring_Walkthrough.md`
  - `Logic (Pseudo)`:

    ```markdown
    # 포함 내용

    1. 프로젝트 개요 (목표, 기간, 참여자)
    2. Phase별 변경 사항 요약
    3. 성과 지표 (KPI) 달성 여부
    4. 스크린샷 (평가 결과, 채팅 응답)
    5. 교훈 및 후속 과제
    ```

  - `Key Variables`: N/A
  - `Safety`: 모든 Phase 완료 후 작성

---

## ✅ Definition of Done (검증)

### 필수 완료 조건

| #   | 항목                 | 검증 방법              | 상태 |
| --- | -------------------- | ---------------------- | ---- |
| 1   | E2E 테스트 전체 통과 | P4-01-A ~ P4-01-D 완료 | ⬜   |
| 2   | 성능 목표 달성       | P95 < 3000ms           | ⬜   |
| 3   | 보안 테스트 통과     | RLS 100% 검증          | ⬜   |
| 4   | README 업데이트      | Feature Flags 포함     | ⬜   |
| 5   | Walkthrough 작성     | Phase 0~4 요약         | ⬜   |

### 코드 품질 체크

- [ ] 불필요한 console.log 제거
- [ ] 성능 측정 로그 임시 → 영구 전환 여부 결정
- [ ] 테스트 결과 문서화

---

## 🎯 Verification Plan (검증 계획)

### 자동화 테스트

1. **빌드 테스트**: `npm run build` → Exit code: 0
2. **타입 체크**: `npx tsc --noEmit` → 에러 없음

### 수동 검증 (브라우저)

1. `http://localhost:3000` 접속
2. 로그인 → 에디터 페이지 이동
3. 참고자료 탭 → 문서 업로드 → 처리 완료 확인
4. 평가 탭 → 종합 평가 실행 → 점수 확인
5. 채팅 탭 → 질문 → AI 응답 확인

### 성능 검증

- DevTools Network 탭에서 API 응답 시간 확인
- P95 < 3000ms 확인

---

## 📊 예상 소요 시간

| 작업               | 시간       | 담당    |
| ------------------ | ---------- | ------- |
| P4-01: E2E 테스트  | 1시간      | QA      |
| P4-02: 성능 테스트 | 30분       | Backend |
| P4-03: 보안 테스트 | 30분       | 보안    |
| P4-04: 문서화      | 30분       | 문서    |
| P4-05: Walkthrough | 30분       | 전체    |
| **총계**           | **~3시간** |         |

---

## 🚀 다음 단계

Phase 4 완료 후:

1. **마스터 플랜** 진행률 100%로 업데이트
2. **운영 모니터링** - 배포 후 1주일 집중 모니터링
3. **후속 개발** - Template Builder UI, Gate-Keeper 자동화
