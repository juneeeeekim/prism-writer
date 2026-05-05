# PRISM Writer 코드 리팩토링 기술 개발 문서 정의서

> **문서 버전**: 1.0
> **작성일**: 2026-01-20
> **작성자**: 기술 리더 & Vercel Best Practices 전문가
> **상태**: 승인 대기

---

## 1. 개요

### 1.1 목적
PRISM Writer 프론트엔드 코드베이스의 대규모 파일들을 분리하여 유지보수성, 테스트 용이성, 성능을 개선한다.

### 1.2 배경
- 현재 400줄 이상 파일: **34개**
- 700줄 이상 긴급 파일: **6개**
- 가장 큰 파일: `EvaluationTab.tsx` (937줄)

### 1.3 기대 효과
| 항목 | 현재 | 목표 |
|------|------|------|
| 최대 파일 크기 | 937줄 | 300줄 이하 |
| 평균 컴포넌트 크기 | ~500줄 | ~200줄 |
| 테스트 커버리지 | 낮음 | 중간 이상 |
| 코드 재사용성 | 낮음 | 높음 |

---

## 2. 리팩토링 대상 파일

### 2.1 긴급 (Critical) - 700줄 이상

| 우선순위 | 파일 경로 | 현재 줄 수 | 목표 줄 수 |
|----------|----------|-----------|-----------|
| 1 | `components/Assistant/EvaluationTab.tsx` | 937 | ~200 |
| 2 | `app/dashboard/page.tsx` | 764 | ~100 |
| 3 | `app/api/chat/route.ts` | 601 | ~150 |
| 4 | `components/Assistant/ChatTab.tsx` | 737 | ~150 |
| 5 | `types/rag.ts` | 786 | ~150 (per file) |
| 6 | `components/Assistant/StructureTab.tsx` | 725 | ~200 |

### 2.2 주의 (Warning) - 500-700줄

| 파일 경로 | 현재 줄 수 | 조치 |
|----------|-----------|------|
| `lib/rag/chunking.ts` | 658 | 청킹 전략별 분리 |
| `components/Editor/RichShadowWriter.tsx` | 601 | 에디터/툴바 분리 |
| `lib/monitoring/deploymentMonitor.ts` | 581 | 모니터링 종류별 분리 |
| `config/featureFlags.ts` | 580 | 유지 (설정 파일) |
| `components/Assistant/PatternAnalysisSection.tsx` | 569 | 카드 컴포넌트 분리 |
| `components/Assistant/SmartSearchTab.tsx` | 534 | 검색 결과 분리 |

---

## 3. 상세 리팩토링 계획

### 3.1 EvaluationTab.tsx (우선순위 1)

#### 3.1.1 현재 구조 분석
```
EvaluationTab.tsx (937줄)
├── 타입 정의 (~50줄)
├── Legacy 어댑터 함수 (~30줄)
├── 상태 관리 (~100줄)
├── API 호출 로직 (~200줄)
├── 이벤트 핸들러 (~150줄)
├── 히스토리 관리 (~150줄)
└── JSX 렌더링 (~250줄)
```

#### 3.1.2 목표 구조
```
components/Assistant/
├── EvaluationTab.tsx              # 메인 컨테이너
│   - Provider 래핑
│   - 레이아웃 구성
│   - 탭 전환 로직
│   └── (~200줄)
│
├── evaluation/
│   ├── EvaluationResult.tsx       # 평가 결과 표시
│   │   - 점수 표시
│   │   - 판정 목록
│   │   - 개선 계획
│   │   └── (~300줄)
│   │
│   ├── EvaluationHistory.tsx      # 평가 히스토리
│   │   - 히스토리 목록
│   │   - 선택/삭제
│   │   └── (~200줄)
│   │
│   └── EvaluationActions.tsx      # 액션 버튼들
│       - 평가 실행 버튼
│       - 저장 버튼
│       └── (~100줄)
│
└── hooks/
    └── useEvaluation.ts           # 평가 비즈니스 로직
        - API 호출
        - 상태 관리
        - 에러 처리
        └── (~200줄)
```

#### 3.1.3 구현 단계
1. **Phase 1**: `useEvaluation` 훅 생성 및 로직 이동
2. **Phase 2**: `EvaluationResult` 컴포넌트 분리
3. **Phase 3**: `EvaluationHistory` 컴포넌트 분리
4. **Phase 4**: 메인 컴포넌트 정리 및 통합 테스트

#### 3.1.4 인수 조건
- [ ] 각 파일 300줄 이하
- [ ] 기존 기능 100% 동작
- [ ] TypeScript 타입 오류 없음
- [ ] 빌드 성공

---

### 3.2 dashboard/page.tsx (우선순위 2)

#### 3.2.1 현재 구조 분석
```
page.tsx (764줄)
├── Provider 래핑 (~10줄)
├── 상태 관리 (~80줄)
├── 이벤트 핸들러 (~200줄)
├── 검색/정렬 로직 (~100줄)
├── 배치 삭제 로직 (~100줄)
├── 모달 관리 (~100줄)
└── JSX 렌더링 (~174줄)
```

#### 3.2.2 목표 구조
```
app/dashboard/
├── page.tsx                       # 페이지 엔트리
│   - Provider 래핑
│   - 레이아웃만
│   └── (~50줄)
│
├── components/
│   ├── DashboardContent.tsx       # 메인 컨텐츠
│   │   - 상태 조합
│   │   - 컴포넌트 배치
│   │   └── (~150줄)
│   │
│   ├── ProjectList.tsx            # 프로젝트 그리드
│   │   - 빈 상태 처리
│   │   - 그리드 레이아웃
│   │   └── (~150줄)
│   │
│   ├── ProjectCard.tsx            # 개별 카드
│   │   - 카드 UI
│   │   - 액션 버튼
│   │   └── (~120줄)
│   │
│   ├── CreateProjectModal.tsx     # 생성 모달
│   │   - 폼 UI
│   │   - 유효성 검사
│   │   └── (~150줄)
│   │
│   ├── SearchFilter.tsx           # 검색/정렬 바
│   │   - 검색 입력
│   │   - 정렬 드롭다운
│   │   └── (~80줄)
│   │
│   └── BatchActions.tsx           # 배치 액션
│       - 선택 모드 토글
│       - 배치 삭제
│       └── (~100줄)
│
└── hooks/
    └── useDashboard.ts            # 대시보드 로직
        - 로컬 상태 관리
        - 이벤트 핸들러
        └── (~150줄)
```

#### 3.2.3 구현 단계
1. **Phase 1**: `ProjectCard` 컴포넌트 분리
2. **Phase 2**: `CreateProjectModal` 분리
3. **Phase 3**: `SearchFilter`, `BatchActions` 분리
4. **Phase 4**: `useDashboard` 훅 생성
5. **Phase 5**: 메인 페이지 정리

#### 3.2.4 인수 조건
- [ ] page.tsx 100줄 이하
- [ ] 각 컴포넌트 200줄 이하
- [ ] 기존 기능 100% 동작
- [ ] 라우팅 정상 동작

---

### 3.3 api/chat/route.ts (우선순위 3)

#### 3.3.1 현재 구조 분석
```
route.ts (601줄)
├── 임포트 (~30줄)
├── Helper 함수들 (~100줄)
├── POST 핸들러 (~470줄)
│   ├── 인증 체크 (~30줄)
│   ├── RAG 검색 (~200줄)
│   ├── 프롬프트 생성 (~100줄)
│   └── 스트리밍 응답 (~140줄)
```

#### 3.3.2 목표 구조
```
lib/services/
├── chat/
│   ├── chatService.ts             # 채팅 서비스
│   │   - 메시지 처리
│   │   - 스트리밍 로직
│   │   └── (~200줄)
│   │
│   ├── ragSearchService.ts        # RAG 검색
│   │   - 쿼리 확장
│   │   - 하이브리드 검색
│   │   - Self-RAG
│   │   └── (~200줄)
│   │
│   └── promptBuilder.ts           # 프롬프트 빌더
│       - 시스템 프롬프트 생성
│       - 컨텍스트 조합
│       └── (~100줄)

app/api/chat/
└── route.ts                       # 라우트 핸들러
    - 요청 파싱
    - 인증 체크
    - 서비스 호출
    - 응답 반환
    └── (~150줄)
```

#### 3.3.3 구현 단계
1. **Phase 1**: `promptBuilder` 분리
2. **Phase 2**: `ragSearchService` 분리
3. **Phase 3**: `chatService` 분리 (스트리밍 포함)
4. **Phase 4**: 라우트 핸들러 정리

#### 3.3.4 인수 조건
- [ ] route.ts 200줄 이하
- [ ] 각 서비스 250줄 이하
- [ ] 스트리밍 응답 정상 동작
- [ ] RAG 검색 결과 동일

---

### 3.4 ChatTab.tsx (우선순위 4)

#### 3.4.1 현재 구조 분석
```
ChatTab.tsx (737줄)
├── 임포트 및 타입 (~100줄)
├── MessageItem 컴포넌트 (~140줄) ✅ 이미 분리됨
├── localStorage 유틸리티 (~130줄)
├── ChatTab 컴포넌트 (~367줄)
│   ├── 상태 관리 (~50줄)
│   ├── 이벤트 핸들러 (~200줄)
│   └── JSX 렌더링 (~117줄)
```

#### 3.4.2 목표 구조
```
components/Assistant/
├── ChatTab.tsx                    # 메인 컨테이너
│   - 상태 조합
│   - 레이아웃
│   └── (~150줄)
│
├── chat/
│   ├── MessageList.tsx            # 메시지 목록
│   │   - 스크롤 관리
│   │   - 빈 상태 처리
│   │   └── (~100줄)
│   │
│   ├── MessageItem.tsx            # ✅ 이미 존재
│   │
│   └── ChatInput.tsx              # 입력 영역
│       - 텍스트 입력
│       - 전송 버튼
│       └── (~120줄)
│
├── utils/
│   └── chatBackup.ts              # localStorage 로직
│       - 백업 저장/로드
│       - 캐싱 로직
│       └── (~100줄)
│
└── hooks/
    └── useChat.ts                 # 채팅 로직
        - 메시지 전송
        - 세션 관리
        └── (~200줄)
```

#### 3.4.3 구현 단계
1. **Phase 1**: `chatBackup.ts` 유틸리티 분리
2. **Phase 2**: `ChatInput` 컴포넌트 분리
3. **Phase 3**: `MessageList` 컴포넌트 분리
4. **Phase 4**: `useChat` 훅 생성 (선택적)

#### 3.4.4 인수 조건
- [ ] ChatTab.tsx 200줄 이하
- [ ] localStorage 캐싱 정상 동작
- [ ] 메시지 전송/수신 정상 동작

---

### 3.5 types/rag.ts (우선순위 5)

#### 3.5.1 현재 구조 분석
```
rag.ts (786줄)
├── 검색 관련 타입 (~150줄)
├── 청킹 관련 타입 (~100줄)
├── 평가 관련 타입 (~200줄)
├── 템플릿 관련 타입 (~150줄)
├── 피드백 관련 타입 (~100줄)
└── 기타 유틸리티 타입 (~86줄)
```

#### 3.5.2 목표 구조
```
types/
└── rag/
    ├── index.ts                   # re-export
    │   └── (~30줄)
    │
    ├── search.ts                  # 검색 타입
    │   - SearchResult
    │   - SearchOptions
    │   - HybridSearchParams
    │   └── (~150줄)
    │
    ├── chunk.ts                   # 청킹 타입
    │   - Chunk
    │   - ChunkMetadata
    │   - ChunkingStrategy
    │   └── (~100줄)
    │
    ├── evaluation.ts              # 평가 타입
    │   - EvaluationResult
    │   - Judgment
    │   - UpgradePlan
    │   └── (~200줄)
    │
    ├── template.ts                # 템플릿 타입
    │   - TemplateSchema
    │   - RubricTier
    │   └── (~150줄)
    │
    └── feedback.ts                # 피드백 타입
        - FeedbackType
        - FeedbackRecord
        └── (~100줄)
```

#### 3.5.3 구현 단계
1. **Phase 1**: 디렉토리 구조 생성
2. **Phase 2**: 각 도메인별 타입 파일 분리
3. **Phase 3**: index.ts에서 re-export
4. **Phase 4**: 기존 import 경로 업데이트

#### 3.5.4 인수 조건
- [ ] 기존 import 호환성 유지 (`@/types/rag`)
- [ ] TypeScript 컴파일 오류 없음
- [ ] IDE 자동완성 정상 동작

---

## 4. 기술 가이드라인

### 4.1 파일 크기 기준
| 분류 | 줄 수 | 조치 |
|------|-------|------|
| 적정 | ~200줄 | 유지 |
| 주의 | 200-300줄 | 모니터링 |
| 분리 권장 | 300-500줄 | 리팩토링 검토 |
| 분리 필수 | 500줄 이상 | 즉시 분리 |

### 4.2 컴포넌트 분리 원칙
```typescript
// ❌ 나쁜 예: 모든 것이 한 파일에
function BigComponent() {
  const [state1, setState1] = useState()
  const [state2, setState2] = useState()
  // ... 100줄의 로직

  return (
    <div>
      {/* ... 200줄의 JSX */}
    </div>
  )
}

// ✅ 좋은 예: 관심사 분리
// hooks/useFeature.ts
export function useFeature() {
  const [state, setState] = useState()
  // 비즈니스 로직
  return { state, actions }
}

// components/FeatureContainer.tsx
export function FeatureContainer() {
  const { state, actions } = useFeature()
  return <FeatureView {...state} {...actions} />
}

// components/FeatureView.tsx
export function FeatureView(props) {
  return <div>{/* UI만 */}</div>
}
```

### 4.3 커스텀 훅 작성 규칙
```typescript
// 1. 단일 책임
export function useEvaluation() {
  // 평가 관련 로직만
}

// 2. 반환 타입 명시
interface UseEvaluationReturn {
  result: EvaluationResult | null
  isLoading: boolean
  error: string | null
  evaluate: () => Promise<void>
}

// 3. 에러 처리 포함
export function useEvaluation(): UseEvaluationReturn {
  const [error, setError] = useState<string | null>(null)

  const evaluate = async () => {
    try {
      // ...
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    }
  }

  return { result, isLoading, error, evaluate }
}
```

### 4.4 서비스 레이어 패턴
```typescript
// lib/services/chatService.ts

// 1. 인터페이스 정의
interface ChatServiceOptions {
  model: string
  context?: string
}

// 2. 순수 함수로 작성
export async function* generateChatStream(
  prompt: string,
  options: ChatServiceOptions
): AsyncGenerator<string> {
  // 스트리밍 로직
}

// 3. 에러 타입 정의
export class ChatServiceError extends Error {
  constructor(
    message: string,
    public code: 'AUTH_ERROR' | 'RATE_LIMIT' | 'UNKNOWN'
  ) {
    super(message)
  }
}
```

---

## 5. 테스트 계획

### 5.1 테스트 범위
| 항목 | 현재 | 목표 |
|------|------|------|
| 단위 테스트 | 없음 | 주요 훅/서비스 |
| 통합 테스트 | E2E만 | 컴포넌트 통합 |
| E2E 테스트 | 있음 | 유지 |

### 5.2 테스트 우선순위
1. **useEvaluation 훅** - 평가 로직 핵심
2. **chatService** - API 핵심 로직
3. **chatBackup 유틸리티** - localStorage 로직

### 5.3 테스트 작성 예시
```typescript
// __tests__/hooks/useEvaluation.test.ts
import { renderHook, act } from '@testing-library/react'
import { useEvaluation } from '../hooks/useEvaluation'

describe('useEvaluation', () => {
  it('should return initial state', () => {
    const { result } = renderHook(() => useEvaluation())

    expect(result.current.result).toBeNull()
    expect(result.current.isLoading).toBe(false)
    expect(result.current.error).toBeNull()
  })

  it('should handle evaluation', async () => {
    const { result } = renderHook(() => useEvaluation())

    await act(async () => {
      await result.current.evaluate()
    })

    expect(result.current.result).toBeDefined()
  })
})
```

---

## 6. 롤백 계획

### 6.1 Git 브랜치 전략
```
main
 └── feature/refactoring
      ├── refactor/evaluation-tab
      ├── refactor/dashboard-page
      ├── refactor/chat-api
      ├── refactor/chat-tab
      └── refactor/types-rag
```

### 6.2 롤백 절차
1. 문제 발견 시 해당 브랜치 revert
2. main으로 핫픽스 배포
3. 원인 분석 후 재작업

### 6.3 체크포인트
- [ ] 각 Phase 완료 후 빌드 확인
- [ ] E2E 테스트 통과 확인
- [ ] 스테이징 배포 후 QA

---

## 7. 일정 (예상)

| 단계 | 작업 | 담당 |
|------|------|------|
| Phase 1 | EvaluationTab 리팩토링 | 시니어 FE |
| Phase 2 | Dashboard 리팩토링 | 시니어 FE |
| Phase 3 | Chat API 리팩토링 | 백엔드 |
| Phase 4 | ChatTab 리팩토링 | 시니어 FE |
| Phase 5 | Types 분리 | 공동 |
| Phase 6 | 테스트 & QA | 전체 |

---

## 8. 승인

| 역할 | 이름 | 서명 | 날짜 |
|------|------|------|------|
| 기술 리더 | | | |
| Vercel 전문가 | | | |
| 시니어 FE | | | |
| 백엔드 | | | |

---

## 부록

### A. 참고 문서
- [Vercel React Best Practices](https://vercel.com/docs)
- [Next.js App Router Documentation](https://nextjs.org/docs)
- [React Patterns](https://reactpatterns.com/)

### B. 관련 이슈
- 성능 최적화 보고서: `plan_report/performance-review.html`
- 리팩토링 분석 보고서: `plan_report/refactoring-analysis.html`

### C. 변경 이력
| 버전 | 날짜 | 변경 내용 | 작성자 |
|------|------|----------|--------|
| 1.0 | 2026-01-20 | 최초 작성 | Tech Lead |
