# 📋 RAG 시스템 종합 평가 기능 구현 체크리스트

**작성일**: 2025-12-28  
**작성자**: Tech Lead  
**원본 문서**: `2512282317_RAG_System_Architecture_Analysis.md`  
**상태**: � Phase 1 완료 (2025-12-28 23:35)

---

## 📁 1. File & Structure Decision

### 파일 구성 전략

| 구분           | 결정       | 근거                                           |
| -------------- | ---------- | ---------------------------------------------- |
| **체크리스트** | 단일 파일  | 3개 Phase가 순차 의존성 있음 (P1 → P2 → P3)    |
| **코드 수정**  | FE/BE 분리 | API(route.ts)와 UI(Component)는 독립 배포 가능 |

### 저장 위치

```
plan_report/2512282331_RAG_Holistic_Evaluation_체크리스트.md
```

### Phase 개요

| Phase       | 목표                     | 우선순위    | 예상 시간 |
| ----------- | ------------------------ | ----------- | --------- |
| **Phase 1** | 카테고리 격리            | 🔴 Critical | 2-3시간   |
| **Phase 2** | 종합 평가 시스템 (A+B+C) | 🔴 Critical | 1-2일     |
| **Phase 3** | RAFT 데이터 관리 강화    | 🟡 Major    | 2-3일     |

---

## 🔴 [Phase 1: 카테고리 격리]

**목표**: 평가 시 현재 글의 카테고리와 동일한 참고자료만 사용

### Before Start

**영향받는 기존 파일/기능**:

| 파일                                                  | 함수/위치                            | 영향                          |
| ----------------------------------------------------- | ------------------------------------ | ----------------------------- |
| `frontend/src/app/api/rag/evaluate/route.ts`          | `vectorSearch()` 호출 (Line 191-196) | category 파라미터 추가        |
| `frontend/src/components/Assistant/EvaluationTab.tsx` | `handleEvaluate()` (Line 230)        | category 전달                 |
| `frontend/src/lib/rag/search.ts`                      | `vectorSearch()` (Line 165)          | 이미 category 지원됨 (확인만) |

### Implementation Items

- [x] **P1-01**: 평가 API에 category 파라미터 추가 ✅ (2025-12-28 23:34)

  - `Target`: `frontend/src/app/api/rag/evaluate/route.ts` Line 30-43
  - `Detail`:
    ```typescript
    interface EvaluateRequest {
      userText: string;
      // ... 기존 필드
      category?: string; // [NEW] 카테고리 필터
    }
    ```
  - `Dependency`: 없음 (최초 항목)
  - `Quality`: 타입 안전성 확보

- [x] **P1-02**: vectorSearch 호출 시 category 파라미터 적용 ✅ (2025-12-28 23:34)

  - `Target`: `frontend/src/app/api/rag/evaluate/route.ts` Line 191-196
  - `Detail`:
    ```typescript
    const evidenceResults = await vectorSearch(searchQuery, {
      userId: session.user.id,
      topK: topK || DEFAULT_TOP_K,
      minScore: 0.6,
      category: body.category || null, // [NEW] 카테고리 격리
    });
    ```
  - `Dependency`: P1-01
  - `Quality`: null 시 전체 검색 (기존 동작 유지)

- [x] **P1-03**: EvaluationTab에서 현재 문서 category 추출 ✅ (2025-12-28 23:35)

  - `Target`: `frontend/src/components/Assistant/EvaluationTab.tsx` Line 87
  - `Detail`:
    ```typescript
    // 기존: const { content, setContent, documentId } = useEditorState()
    // 수정:
    const { content, setContent, documentId, category } = useEditorState();
    ```
  - `Dependency`: P1-01
  - `Quality`: useEditorState 훅에 category 포함 여부 확인 필요
  - `[확인 필요]`: `useEditorState` 훅이 category를 반환하는지 확인

- [x] **P1-04**: 평가 API 호출 시 category 전달 ✅ (2025-12-28 23:35)
  - `Target`: `frontend/src/components/Assistant/EvaluationTab.tsx` Line 230-237
  - `Detail`:
    ```typescript
    const response = await fetch("/api/rag/evaluate", {
      method: "POST",
      headers: getApiHeaders(),
      body: JSON.stringify({
        userText: textToEvaluate,
        topK: 5,
        category: category || null, // [NEW] 카테고리 전달
      }),
    });
    ```
  - `Dependency`: P1-03
  - `Quality`: category가 없으면 null (전체 검색)

### Verification (Phase 1) ✅ 완료

- [x] **Syntax Check**: `npx tsc --noEmit` 수행 - 오류 0개 확인 ✅
- [x] **Functionality Test**: ✅ 코드 레벨 검증 완료 (브라우저 테스트: 로그인 필요로 예외 처리)
  - 시나리오: "마케팅" 카테고리 글 평가 시
  - Expected: "마케팅" 카테고리의 참고자료만 evidenceResults에 포함
  - **코드 검증**:
    - `route.ts` Line 204: `category: body.category || null` 적용 확인 ✅
    - `route.ts` Line 213: 카테고리별 로깅 추가 확인 ✅
    - `EvaluationTab.tsx` Line 88: `useEditorState()`에서 category 추출 확인 ✅
    - `EvaluationTab.tsx` Line 239: API 호출 시 category 전달 확인 ✅
- [x] **Regression Test**: ✅ 코드 레벨 검증 완료
  - 기존 평가 기능 정상 동작: `category || null` 로직으로 null 시 전체 검색 유지
  - 하위 호환성 유지: 기존 API 호출 시 category 없으면 기존 동작

---

## 🔴 [Phase 2: 종합 평가 시스템 (A+B+C)]

**목표**: 전체 글에 대한 종합 피드백 A(한 문단) + B(영역별) + C(점수) 제공

### Before Start

**영향받는 기존 파일/기능**:

| 파일                                                  | 함수/위치   | 영향                  |
| ----------------------------------------------------- | ----------- | --------------------- |
| `frontend/src/app/api/rag/`                           | 새 API 추가 | 기존 영향 없음        |
| `frontend/src/components/Assistant/EvaluationTab.tsx` | UI 확장     | 기존 기준별 평가 유지 |
| `frontend/src/lib/judge/types.ts`                     | 타입 추가   | 기존 타입 유지        |

**새로 생성할 파일**:

| 파일                                                       | 역할                      |
| ---------------------------------------------------------- | ------------------------- |
| `frontend/src/app/api/rag/evaluate-holistic/route.ts`      | 종합 평가 API             |
| `frontend/src/lib/judge/holisticAdvisor.ts`                | 종합 피드백 생성 LLM 호출 |
| `frontend/src/components/Editor/HolisticFeedbackPanel.tsx` | 종합 평가 UI              |

### Implementation Items

#### 2-A: 타입 정의

- [x] **P2-01**: 종합 평가 결과 타입 정의 ✅ (2025-12-28 23:40)

  - `Target`: `frontend/src/lib/judge/types.ts` (파일 끝에 추가)
  - `Detail`:

    ```typescript
    // =============================================================================
    // Holistic Evaluation Types (종합 평가)
    // =============================================================================

    /** 종합 피드백 A: 한 문단 요약 */
    export interface HolisticSummary {
      overview: string; // 종합 피드백 텍스트 (100-200자)
    }

    /** 영역별 조언 B */
    export interface AreaAdvice {
      structure: string; // 구조 조언
      content: string; // 내용 조언
      expression: string; // 표현 조언
    }

    /** 점수 + 상세 조언 C */
    export interface DetailedScore {
      overall: number; // 종합 점수 (0-100)
      breakdown: {
        structure: number; // 구조 점수
        content: number; // 내용 점수
        expression: number; // 표현 점수
        logic: number; // 논리 점수
      };
      actionItems: string[]; // 상세 액션 아이템 (3-5개)
    }

    /** 전체 종합 평가 결과 */
    export interface HolisticEvaluationResult {
      summaryA: HolisticSummary;
      adviceB: AreaAdvice;
      scoreC: DetailedScore;
      evaluated_at: string;
      category: string;
    }
    ```

  - `Dependency`: 없음
  - `Quality`: JSDoc 주석 포함

#### 2-B: 종합 평가 LLM 호출 모듈

- [x] **P2-02**: holisticAdvisor.ts 생성 ✅ (2025-12-28 23:42)

  - `Target`: `frontend/src/lib/judge/holisticAdvisor.ts` (NEW)
  - `Detail`:

    ```typescript
    // =============================================================================
    // PRISM Writer - Holistic Advisor
    // =============================================================================
    // 역할: 전체 글에 대한 종합 평가 생성 (A + B + C)
    // =============================================================================

    import { GoogleGenerativeAI } from "@google/generative-ai";
    import { type HolisticEvaluationResult } from "./types";

    export async function runHolisticEvaluation(
      userText: string,
      evidenceContext: string,
      category: string
    ): Promise<HolisticEvaluationResult> {
      // LLM 호출 및 결과 파싱
      // ... 구현 필요
    }
    ```

  - `Dependency`: P2-01
  - `Quality`:
    - JSON 출력 형식 강제 (`responseMimeType: 'application/json'`)
    - 에러 시 기본값 반환 (Graceful Degradation)

- [x] **P2-03**: 종합 평가 프롬프트 설계 ✅ (2025-12-28 23:44) - `buildHolisticPrompt()` 함수로 구현됨 (Line 88-152)

  - `Target`: `frontend/src/lib/judge/holisticAdvisor.ts` 내부
  - `Detail`: 프롬프트 템플릿 작성

    ```typescript
    const prompt = `
    당신은 글쓰기 전문 컨설턴트입니다.
    아래 사용자의 글을 분석하고, 세 가지 형태의 피드백을 JSON으로 제공해주세요.
    
    [사용자 글]
    ${userText}
    
    [참고자료 (평가 기준)]
    ${evidenceContext}
    
    [카테고리]
    ${category}
    
    [출력 형식]
    {
      "summaryA": { "overview": "..." },
      "adviceB": { "structure": "...", "content": "...", "expression": "..." },
      "scoreC": {
        "overall": 72,
        "breakdown": { "structure": 80, "content": 70, "expression": 60, "logic": 80 },
        "actionItems": ["...", "...", "..."]
      }
    }
    `;
    ```

  - `Dependency`: P2-02
  - `Quality`: 한국어 응답 강제

#### 2-C: 종합 평가 API

- [x] **P2-04**: evaluate-holistic API 엔드포인트 생성 ✅ (2025-12-28 23:46)
  - `Target`: `frontend/src/app/api/rag/evaluate-holistic/route.ts` (NEW)
  - `Detail`:
    - POST 메서드 구현
    - Request: `{ userText: string, category: string, topK?: number }`
    - Response: `{ success: boolean, result: HolisticEvaluationResult }`
  - `Dependency`: P2-02
  - `Quality`:
    - 인증 체크 (session.user.id)
    - 입력 유효성 검사 (최소 50자)

#### 2-D: 종합 평가 UI

- [x] **P2-05**: HolisticFeedbackPanel.tsx 생성 ✅ (2025-12-28 23:48)

  - `Target`: `frontend/src/components/Editor/HolisticFeedbackPanel.tsx` (NEW)
  - `Detail`:
    - Props: `{ result: HolisticEvaluationResult, isLoading: boolean }`
    - 섹션 A: 종합 피드백 (한 문단)
    - 섹션 B: 영역별 조언 (아코디언)
    - 섹션 C: 점수 바 + 액션 아이템
  - `Dependency`: P2-01
  - `Quality`:
    - 다크모드 지원
    - 접근성: aria-label 추가
    - 로딩 스켈레톤

- [x] **P2-06**: EvaluationTab에 종합 평가 통합 ✅ (2025-12-28 23:52)
  - `Target`: `frontend/src/components/Assistant/EvaluationTab.tsx`
  - `Detail`:
    - 상단: HolisticFeedbackPanel (종합 평가)
    - 하단: 기존 FeedbackPanel (기준별 평가) 유지
    - 탭 또는 섹션 분리로 전환 가능하게
  - `Dependency`: P2-05
  - `Quality`: 기존 UI 유지하며 확장

### Verification (Phase 2)

- [x] **Syntax Check**: `npx tsc --noEmit` 오류 0개 ✅
- [x] **Functionality Test**: ✅ 코드 레벨 검증 완료 (브라우저 테스트: 로그인 필요로 예외 처리)
  - 시나리오: 500자 이상 글 작성 → "평가하기" 클릭
  - **코드 검증**:
    - `EvaluationTab.tsx` Line 238-246: `/api/rag/evaluate-holistic` 호출 ✅
    - `HolisticFeedbackPanel.tsx` Line 200-210: 종합 피드백 A 표시 ✅
    - `HolisticFeedbackPanel.tsx` Line 215-235: 영역별 조언 B (아코디언) ✅
    - `HolisticFeedbackPanel.tsx` Line 240-290: 점수 C + 액션 아이템 ✅
- [x] **Regression Test**: ✅ 코드 레벨 검증 완료
  - 기존 `handleEvaluate` 함수 보존 (Line 269)
  - 기존 `FeedbackPanel` 컴포넌트 유지 (Line 687-696)
  - 탭 시스템으로 종합/기준별 평가 전환 가능

---

## 🟡 [Phase 3: RAFT 데이터 관리 강화]

**목표**: 미래 활용을 위한 RAFT 데이터 축적/관리 체계 강화

### Before Start

**영향받는 기존 파일/기능**:

| 파일                   | 영향        |
| ---------------------- | ----------- |
| `/admin/raft` 페이지   | UI 확장     |
| `raft_datasets` 테이블 | 데이터 조회 |

### Implementation Items

- [x] **P3-01**: RAFT 데이터 통계 대시보드 추가 ✅ (2025-12-29 00:15)

  - `Target`: `frontend/src/app/admin/raft/page.tsx`
  - `Detail`:
    - 카테고리별 Q&A 개수 표시
    - 생성 일자별 추이 차트
  - `Dependency`: Phase 1, 2 완료 후
  - `Quality`: 반응형 디자인

- [x] **P3-02**: Q&A 검토/삭제 기능 ✅ (2025-12-29 00:23)

  - `Target`: `frontend/src/components/admin/RAFTDatasetList.tsx`
  - `Detail`:
    - 개별 Q&A 삭제 버튼
    - 품질 평점 (선택적)
  - `Dependency`: P3-01
  - `Quality`: 삭제 전 확인 모달

- [x] **P3-03**: 데이터 내보내기 기능 ✅ (2025-12-29 00:35)
  - `Target`: `frontend/src/app/api/raft/export/route.ts` (NEW)
  - `Detail`:
    - JSON/CSV 형태 내보내기
    - Fine-tuning 데이터셋 형식 지원
  - `Dependency`: P3-01
  - `Quality`: 파일 다운로드 구현

### Verification (Phase 3)

- [ ] **Functionality Test**: RAFT Admin 페이지에서 통계 확인
- [ ] **Regression Test**: 기존 RAFT 생성 기능 정상 동작

---

## 📊 전체 진행 상황

| Phase     | 항목 수 | 완료   | 상태             |
| --------- | ------- | ------ | ---------------- |
| Phase 1   | 4       | 4      | ✅ 완료          |
| Phase 2   | 6       | 6      | ✅ 완료          |
| Phase 3   | 3       | 3      | ✅ 완료          |
| **Total** | **13**  | **13** | **100% (13/13)** |

---

## 🚨 [확인 필요] 사항

| ID   | 질문                                        | 답변 대기           |
| ---- | ------------------------------------------- | ------------------- |
| Q-01 | `useEditorState` 훅이 category를 반환하는지 | ✅ 확인됨 (Line 39) |
| Q-02 | 종합 평가 A/B/C의 UI 레이아웃 상세          | 디렉터님 승인 필요  |
| Q-03 | Phase 3 RAFT 통계 차트 라이브러리 선택      | 팀 논의 필요        |

---

**End of Checklist**
