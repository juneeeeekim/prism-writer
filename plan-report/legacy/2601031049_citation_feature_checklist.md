# Citation Feature Implementation Checklist

## PRISM Writer - RAG 인용 표기 시스템 구현 체크리스트

| 항목      | 내용                                               |
| --------- | -------------------------------------------------- |
| 작성일    | 2026-01-03                                         |
| 기반 문서 | 2601031040_citation_feature_implementation_plan.md |
| 상태      | 구현 대기                                          |

---

## [Phase 1: 시스템 프롬프트 및 컨텍스트 형식 수정]

### Before Start:

- ⚠️ **회귀 테스트 포인트**: 기존 채팅 응답이 정상 생성되는지 확인 필요
- ⚠️ **건드리지 말 것**: `citationGate.ts` 내부 검증 로직 (현재 정상 작동 중)
- ⚠️ **건드리지 말 것**: `hybridSearch()` 함수 호출 로직 및 파라미터

---

### Implementation Items:

#### [x] **P1-01**: Feature Flag 추가

- `Target`: `frontend/src/config/featureFlags.ts` > 신규 상수 추가
- `Logic (Pseudo)`:
  ```typescript
  // 기존 FEATURE_FLAGS 객체에 추가
  export const FEATURE_FLAGS = {
    // ... existing flags
    ENABLE_CITATION_MARKERS:
      process.env.NEXT_PUBLIC_ENABLE_CITATION_MARKERS !== "false",
  };
  ```
- `Key Variables`: `ENABLE_CITATION_MARKERS`
- `Safety`: 기본값 `true` (활성화), 환경변수로 비활성화 가능

---

#### [x] **P1-02**: 컨텍스트 형식 변경 (Query Expansion Mode)

- `Target`: `frontend/src/app/api/chat/route.ts` > `ragPromise` 내부 (Line 211-213)
- `Logic (Pseudo)`:

  ```typescript
  // Before:
  .map((result) => `[참고 문서: ${result.metadata?.title || 'Untitled'}]\n${result.content}`)

  // After:
  .map((result, index) => `[참고 자료 ${index + 1}: ${result.metadata?.title || 'Untitled'}]\n${result.content}`)
  ```

- `Key Variables`: `index` (0-based, 표시할 때 +1)
- `Safety`: `result.metadata?.title` null 체크 이미 존재 (Untitled fallback)

---

#### [x] **P1-03**: 컨텍스트 형식 변경 (Legacy Mode)

- `Target`: `frontend/src/app/api/chat/route.ts` > `ragPromise` 내부 (Line 234-236)
- `Logic (Pseudo)`:

  ```typescript
  // Before:
  .map((result) => `[참고 문서: ${result.metadata?.title || 'Untitled'}]\n${result.content}`)

  // After:
  .map((result, index) => `[참고 자료 ${index + 1}: ${result.metadata?.title || 'Untitled'}]\n${result.content}`)
  ```

- `Key Variables`: `index`
- `Safety`: P1-02와 동일 패턴 적용

---

#### [x] **P1-04**: 시스템 프롬프트에 인용 규칙 추가

- `Target`: `frontend/src/app/api/chat/route.ts` > `improvedSystemPrompt` (Line 278-310)
- `Logic (Pseudo)`:

  ```typescript
  const improvedSystemPrompt = `
  # 역할
  당신은 PRISM Writer의 AI 글쓰기 어시스턴트입니다.

  # 핵심 원칙
  ⚠️ 중요: 아래 참고 자료가 제공된 경우, 당신의 사전 지식보다 참고 자료를 우선해야 합니다.
  - 참고 자료의 용어, 구조, 방법론을 그대로 사용하세요
  - 일반적인 글쓰기 상식을 먼저 말하지 마세요

  # 🔖 출처 표기 규칙 (Citation Rules)
  ${
    FEATURE_FLAGS.ENABLE_CITATION_MARKERS
      ? `
  ⚠️ 참고 자료를 인용할 때는 반드시 아래 규칙을 따르세요:
  ```

1. **인용 마커**: 참고 자료 내용을 사용할 때마다 문장 끝에 [1], [2] 형식으로 번호를 붙이세요.
2. **번호 할당**: [참고 자료 1: 문서명]은 [1], [참고 자료 2: 문서명]은 [2]입니다.
3. **참고문헌 목록**: 답변 마지막에 반드시 아래 형식으로 정리하세요:

---

**📚 참고 자료**
[1] {문서 제목 1}
[2] {문서 제목 2}

---

4. **일반 지식 사용 시**: 참고 자료가 없으면 인용 마커 없이 답변하고, "참고 자료 없이 일반 지식을 바탕으로 답변드립니다."라고 명시하세요.
   `
   : ""
   }

# User Preferences (최우선 반영)

// ... 기존 코드 유지
`;

````

- `Key Variables`: `FEATURE_FLAGS.ENABLE_CITATION_MARKERS`
- `Safety`:
- Feature Flag가 `false`면 기존 동작 유지
- Template literal 내 조건부 삽입으로 안전하게 토글

---

#### [x] **P1-05**: Feature Flag import 추가 (이미 존재 확인)

- `Target`: `frontend/src/app/api/chat/route.ts` > import 섹션 (Line 18)
- `Logic (Pseudo)`:

```typescript
// Before (Line 18):
import { FEATURE_FLAGS } from "@/config/featureFlags";

// After: 이미 import 되어 있음. ENABLE_CITATION_MARKERS만 featureFlags.ts에 추가하면 됨
````

- `Key Variables`: N/A (이미 import 존재)
- `Safety`: 기존 import 재사용

---

### Definition of Done (검증):

#### 기능 테스트:

- [ ] **Test 1**: 참고 자료 1개 → 답변에 `[1]` 마커 + 하단에 `**📚 참고 자료**\n[1] 문서명`
- [ ] **Test 2**: 참고 자료 3개 → `[1]`, `[2]`, `[3]` 마커 + 하단에 3개 목록
- [ ] **Test 3**: 참고 자료 없음 → 인용 마커 없이 "일반 지식을 바탕으로..." 문구
- [ ] **Test 4**: Feature Flag `false` → 기존 동작 (인용 마커 없음)

#### 예외 처리:

- [x] **Exception 1**: `result.metadata?.title`이 `null`일 때 `Untitled` 표시 확인 ✅
- [x] **Exception 2**: `uniqueResults` 빈 배열일 때 에러 없이 빈 컨텍스트 반환 ✅

#### 코드 품질:

- [x] **Review 1**: 불필요한 `console.log` 제거 (디버그용 제외) ✅
- [x] **Review 2**: 주석 작성 완료 (`// [CITATION]` 태그 사용) ✅
- [x] **Review 3**: TypeScript 타입 에러 없음 ✅

---

## [Phase 2: 테스트 및 배포]

### Before Start:

- ⚠️ **선행 조건**: Phase 1 모든 항목 완료
- ⚠️ **환경 확인**: Vercel 환경변수 `NEXT_PUBLIC_ENABLE_CITATION_MARKERS` 미설정 (기본 true)

---

### Implementation Items:

#### [ ] **P2-01**: 로컬 테스트

- `Target`: 로컬 개발 서버 (`npm run dev`)
- `Logic (Pseudo)`:

  ```bash
  # 1. 개발 서버 실행
  cd frontend && npm run dev

  # 2. 브라우저에서 테스트
  - 프로젝트 생성 → 문서 업로드 → AI 채팅
  - 답변에 [1] 마커 및 참고문헌 목록 확인
  ```

- `Key Variables`: N/A
- `Safety`: 프로덕션 영향 없음

---

#### [x] **P2-02**: Git Commit 및 Push ✅

- `Target`: Git 저장소
- `Logic (Pseudo)`:
  ```bash
  git add -A
  git commit -m "feat(chat): Add citation markers to RAG responses [CITATION]"
  git push origin main
  ```
- `Key Variables`: N/A
- `Safety`: Vercel 자동 배포 트리거

---

#### [x] **P2-03**: 프로덕션 검증 ✅ (사용자 확인)

- `Target`: prism-writer.vercel.app
- `Logic (Pseudo)`:
  ```
  1. 배포 완료 대기 (약 2분)
  2. 새 프로젝트 생성
  3. 테스트 문서 업로드
  4. AI 채팅에서 인용 마커 확인
  ```
- `Key Variables`: N/A
- `Safety`: 문제 발생 시 환경변수 `NEXT_PUBLIC_ENABLE_CITATION_MARKERS=false` 설정 후 재배포

---

### Definition of Done (검증):

- [x] **Production Test 1**: 참고 자료 기반 답변에 `[1]` 마커 표시 ✅
- [x] **Production Test 2**: 답변 하단에 `📚 참고 자료` 섹션 표시 ✅
- [ ] **Production Test 3**: 참고 자료 없을 때 인용 마커 미표시 (수동 확인 필요)
- [ ] **Rollback Test**: Feature Flag off 시 기존 동작 확인 (선택 사항)

---

## [Phase 3: UI 개선 (선택, 추후)]

> ⏸️ Phase 1~2 완료 후 별도 논의

---

## 구현 순서 요약

```
Step 1: P1-01 (Feature Flag 추가)
    ↓
Step 2: P1-02, P1-03 (컨텍스트 형식 변경)
    ↓
Step 3: P1-04, P1-05 (시스템 프롬프트 수정)
    ↓
Step 4: Phase 1 DoD 검증
    ↓
Step 5: P2-01 (로컬 테스트)
    ↓
Step 6: P2-02, P2-03 (배포 및 검증)
    ↓
✅ 완료
```

---

## Rollback Plan

```typescript
// 문제 발생 시:
// 1. Vercel Dashboard > Settings > Environment Variables
// 2. Add: NEXT_PUBLIC_ENABLE_CITATION_MARKERS = false
// 3. Redeploy
```

---

_문서 끝_
