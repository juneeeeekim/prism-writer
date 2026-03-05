# PRISM Writer - AI 채팅 웹 검색 통합 개발 계획서

> **문서 ID:** 2603060100
> **작성일:** 2026-03-06
> **작성자:** Claude Opus 4.6 (기술 리더)
> **상태:** 승인 대기
> **분류:** 기능 업그레이드 (Major Feature)
> **관련 시스템:** Chat API, RAG Pipeline, Deep Scholar, Brave Search

---

## 1. 개요

### 1.1 배경

현재 PrismLM의 AI 채팅은 **사용자가 업로드한 문서(RAG 벡터)만 참조**하여 답변을 생성합니다.
외부 웹 정보가 필요할 때 사용자는 별도의 "근거 찾기(Deep Scholar)" 탭에서 수동 검색 후
결과를 복사/붙여넣기 해야 하는 번거로운 워크플로우가 존재합니다.

이를 해결하기 위해 **Brave Search API(일반 웹)** + **Tavily API(학술/정부)** 를 AI 채팅에
직접 연결하여, 사용자 문서로 답변이 부족할 때 자동으로 외부 웹 검색을 수행하는 시스템을 구축합니다.

### 1.2 목표

- AI 채팅에서 사용자 문서 + 외부 웹 검색 결과를 **통합된 컨텍스트**로 활용
- 검색 우선순위: **사용자 문서 > Brave Search(일반) > Tavily(학술)**
- 출처(사용자 문서 vs 웹)를 명확히 구분하여 답변에 표시
- 기존 Deep Scholar 기능은 그대로 유지 (별도 탭으로 독립 운영)

### 1.3 검색 우선순위 구조

```
사용자 채팅 질문
    │
    ├── 1순위: 사용자 업로드 문서 (RAG 벡터 검색)
    │         └── Supabase 하이브리드 검색 (keyword + vector)
    │
    ├── 2순위: Brave Search (일반 웹 검색)
    │         └── 뉴스, 블로그, 기술 문서, 위키피디아 등
    │
    └── 3순위: Tavily (학술/정부 검색)
              └── arXiv, PubMed, .gov, .edu, RISS, KCI 등
              └── 학술 키워드 감지 시에만 활성화
```

---

## 2. 현재 시스템 분석

### 2.1 현재 Chat API 데이터 흐름

```
POST /api/chat
├── 1. 인증 + 사용량 체크
├── 2. Parallel Fetch (현재)
│   ├── searchUserPreferences()    → 사용자 스타일 메모리
│   ├── searchTemplateContext()    → 평가 루브릭
│   └── performRAGSearch()         → 사용자 문서만 검색 ⚠️
├── 3. 시스템 프롬프트 빌드
├── 4. LLM 스트리밍 응답
├── 5. Self-RAG 검증
└── 6. 메시지 저장 + 인용 메타데이터
```

### 2.2 현재 Deep Scholar (분리 상태)

| 항목 | 상태 |
|------|------|
| 위치 | AssistantPanel 별도 탭 ("근거 찾기") |
| 트리거 | 수동 검색 (사용자가 직접 클릭) |
| API | Tavily Search API (학술/정부 도메인) |
| 채팅 연결 | **없음** — 완전 분리 |
| 결과 활용 | 수동 복사/붙여넣기 |

### 2.3 기존 활용 가능 자산

| 자산 | 파일 위치 | 재활용 가능 |
|------|-----------|------------|
| Tavily API 클라이언트 | `lib/research/tavilyClient.ts` | O (그대로 사용) |
| LLM 쿼리 생성기 | `lib/research/queryGenerator.ts` | O (웹 검색 쿼리에도 활용) |
| 결과 요약기 | `lib/research/resultSummarizer.ts` | O (신뢰도 배지 로직 재활용) |
| RAG 검색 서비스 | `lib/services/chat/ragSearchService.ts` | O (확장 포인트) |
| 프롬프트 빌더 | `lib/services/chat/promptBuilder.ts` | O (웹 컨텍스트 섹션 추가) |
| Feature Flags | `config/featureFlags.ts` | O (새 플래그 추가) |

---

## 3. 기술 설계

### 3.1 아키텍처 (변경 후)

```
POST /api/chat
├── 1. 인증 + 사용량 체크
├── 2. Parallel Fetch (확장)
│   ├── searchUserPreferences()
│   ├── searchTemplateContext()
│   ├── performRAGSearch()           → 1순위: 사용자 문서
│   └── performWebSearch() ★NEW      → 2순위 + 3순위: 웹 검색
│       ├── Brave Search (일반)
│       └── Tavily (학술, 조건부)
├── 3. 시스템 프롬프트 빌드 (웹 컨텍스트 포함)
├── 4. LLM 스트리밍 응답
├── 5. Self-RAG 검증
└── 6. 메시지 저장 + 인용 메타데이터 (출처 구분)
```

### 3.2 Brave Search API 연동 설계

```typescript
// 새 파일: frontend/src/lib/research/braveClient.ts

interface BraveSearchOptions {
  query: string
  count?: number           // 기본 5개
  freshness?: string       // 'pd' (past day), 'pw' (past week), 'pm' (past month)
  country?: string         // 'KR'
  searchLang?: string      // 'ko'
}

interface BraveSearchResult {
  title: string
  url: string
  description: string
  age?: string             // "2 hours ago"
  publishedDate?: string
}

async function searchBrave(options: BraveSearchOptions): Promise<BraveSearchResult[]>
```

**Brave Search API 사양:**
- Endpoint: `https://api.search.brave.com/res/v1/web/search`
- 인증: `X-Subscription-Token` 헤더
- 무료 티어: 2,000 queries/month
- 응답: JSON (title, url, description, age, extra_snippets)

### 3.3 통합 웹 검색 서비스

```typescript
// 새 파일: frontend/src/lib/services/chat/webSearchService.ts

interface WebSearchResult {
  title: string
  url: string
  content: string           // description 또는 요약
  source: 'brave' | 'tavily'
  trustBadge: 'academic' | 'government' | 'news' | 'general'
  score: number             // 관련도 점수 (0-1)
}

interface WebSearchOptions {
  query: string
  enableBrave?: boolean     // 기본 true
  enableTavily?: boolean    // 학술 키워드 감지 시 true
  maxResults?: number       // 기본 5
}

async function performWebSearch(
  query: string,
  options?: WebSearchOptions
): Promise<WebSearchResult[]>
```

### 3.4 학술 키워드 감지 로직

```typescript
// webSearchService.ts 내부

const ACADEMIC_KEYWORDS_KO = [
  '논문', '연구', '학술', '실험', '통계', '분석', '이론',
  '메타분석', '피어리뷰', '학회', '저널', 'RISS', 'KCI',
]

const ACADEMIC_KEYWORDS_EN = [
  'paper', 'research', 'study', 'journal', 'peer-review',
  'arxiv', 'pubmed', 'doi', 'thesis', 'academic',
]

function shouldSearchAcademic(query: string): boolean {
  const lowerQuery = query.toLowerCase()
  return [...ACADEMIC_KEYWORDS_KO, ...ACADEMIC_KEYWORDS_EN]
    .some(keyword => lowerQuery.includes(keyword))
}
```

### 3.5 RAG + 웹 검색 결과 통합

```typescript
// ragSearchService.ts 확장

interface SearchResultWithSource extends SearchResult {
  sourceType: 'user-doc' | 'brave' | 'tavily'
  sourceUrl?: string
}

// 통합 컨텍스트 빌드
function mergeSearchResults(
  ragResults: SearchResult[],
  webResults: WebSearchResult[]
): SearchResultWithSource[] {
  // 1. RAG 결과 (사용자 문서) — 최우선
  const docResults = ragResults.map(r => ({
    ...r,
    sourceType: 'user-doc' as const,
  }))

  // 2. 웹 결과 — RAG 결과가 부족할 때 보충
  const webConverted = webResults.map(w => ({
    chunkId: `web-${hashUrl(w.url)}`,
    content: w.content,
    score: w.score * 0.8,   // 웹 결과는 사용자 문서보다 낮은 가중치
    metadata: { title: w.title, source: w.url },
    sourceType: w.source as 'brave' | 'tavily',
    sourceUrl: w.url,
  }))

  return [...docResults, ...webConverted]
}
```

### 3.6 시스템 프롬프트 변경

```
기존 프롬프트 구조:
[사용자 선호도] + [평가 루브릭] + [RAG 컨텍스트(문서만)]

변경 후 프롬프트 구조:
[사용자 선호도] + [평가 루브릭] + [RAG 컨텍스트(문서)] + [웹 검색 컨텍스트] ★NEW

웹 검색 컨텍스트 형식:
───── 외부 웹 검색 결과 ─────
[1] {제목} ({도메인})
    {내용 요약}
    출처: {URL}
[2] ...
──────────────────────────────
```

### 3.7 Feature Flags

```typescript
// config/featureFlags.ts 추가

ENABLE_WEB_SEARCH_IN_CHAT: boolean    // 채팅 내 웹 검색 통합 (마스터 스위치)
ENABLE_BRAVE_SEARCH: boolean           // Brave Search 활성화
ENABLE_TAVILY_IN_CHAT: boolean         // Tavily 채팅 연동 (기존 탭은 별도 유지)
```

### 3.8 환경 변수

```env
# .env.local 추가
BRAVE_API_KEY=your_brave_api_key_here
# TAVILY_API_KEY는 기존에 설정됨
```

---

## 4. 구현 단계 계획

총 **6개 Phase**, 각 Phase는 독립 커밋 가능합니다.

---

### Phase 1: Brave Search API 클라이언트 구축

**목적:** Brave Search API 연동 기반 코드 작성

| 항목 | 내용 |
|------|------|
| 신규 파일 | `frontend/src/lib/research/braveClient.ts` |
| 수정 파일 | `.env.local` (BRAVE_API_KEY 추가) |
| 작업 내용 | Brave Web Search API 호출, 응답 파싱, 에러 핸들링 |
| 검증 | 단독 API 호출 테스트 (콘솔 로그) |

**구현 항목:**
- [ ] P1-01: `BraveSearchOptions`, `BraveSearchResult` 타입 정의
- [ ] P1-02: `searchBrave()` 함수 구현 (fetch + 인증 헤더)
- [ ] P1-03: 응답 파싱 (`web.results` 배열 추출)
- [ ] P1-04: 에러 핸들링 (API 키 미설정, 429 Rate Limit, 네트워크 오류)
- [ ] P1-05: 환경 변수 `BRAVE_API_KEY` 추가 + `.env.example` 갱신

---

### Phase 2: 통합 웹 검색 서비스 구축

**목적:** Brave + Tavily를 하나의 인터페이스로 통합

| 항목 | 내용 |
|------|------|
| 신규 파일 | `frontend/src/lib/services/chat/webSearchService.ts` |
| 수정 파일 | 없음 |
| 작업 내용 | 학술 키워드 감지, Brave/Tavily 병렬 호출, 결과 통합 |
| 검증 | 일반 쿼리 → Brave만, 학술 쿼리 → Brave + Tavily |

**구현 항목:**
- [ ] P2-01: `WebSearchResult`, `WebSearchOptions` 타입 정의
- [ ] P2-02: `shouldSearchAcademic()` — 학술 키워드 감지 함수
- [ ] P2-03: `performWebSearch()` 메인 함수 구현
  - Brave Search 호출 (항상)
  - Tavily 호출 (학술 키워드 감지 시에만)
  - 결과 통합 + 중복 URL 제거
- [ ] P2-04: 신뢰도 배지 매핑 (`detectTrustBadge()` 재활용)
- [ ] P2-05: 결과 정렬 (score 기준 내림차순)

---

### Phase 3: Feature Flags + 환경 설정

**목적:** 웹 검색 기능을 안전하게 ON/OFF 가능한 스위치 구성

| 항목 | 내용 |
|------|------|
| 수정 파일 | `frontend/src/config/featureFlags.ts` |
| 수정 파일 | `.env.example` |
| 작업 내용 | 3개 Feature Flag 추가, 환경 변수 문서화 |

**구현 항목:**
- [ ] P3-01: `ENABLE_WEB_SEARCH_IN_CHAT` 플래그 추가 (기본값: true)
- [ ] P3-02: `ENABLE_BRAVE_SEARCH` 플래그 추가 (기본값: true)
- [ ] P3-03: `ENABLE_TAVILY_IN_CHAT` 플래그 추가 (기본값: true)
- [ ] P3-04: `.env.example`에 `BRAVE_API_KEY` 항목 추가 + 설명 주석

---

### Phase 4: Chat API 통합 (핵심)

**목적:** Chat API의 Parallel Fetch에 웹 검색을 추가하고, 프롬프트에 웹 컨텍스트 주입

| 항목 | 내용 |
|------|------|
| 수정 파일 | `frontend/src/app/api/chat/route.ts` |
| 수정 파일 | `frontend/src/lib/services/chat/ragSearchService.ts` |
| 수정 파일 | `frontend/src/lib/services/chat/promptBuilder.ts` |
| 수정 파일 | `frontend/src/lib/services/chat/index.ts` (export 추가) |
| 작업 내용 | Parallel Fetch에 웹 검색 추가, 컨텍스트 병합, 프롬프트 확장 |

**구현 항목:**
- [ ] P4-01: `chat/route.ts` — Parallel Fetch에 `performWebSearch()` 추가
  ```typescript
  const [userPreferences, templateContext, ragResult, webResults] = await Promise.all([
    searchUserPreferences(userId, query),
    searchTemplateContext(supabase, userId, query),
    performRAGSearch(query, { userId, projectId }),
    FEATURE_FLAGS.ENABLE_WEB_SEARCH_IN_CHAT
      ? performWebSearch(query)
      : Promise.resolve([]),
  ])
  ```
- [ ] P4-02: `promptBuilder.ts` — `buildSystemPrompt()`에 `webContext` 파라미터 추가
  - 웹 검색 결과를 별도 섹션으로 프롬프트에 주입
  - 출처(URL) 명시 지시문 추가: "웹에서 가져온 정보는 반드시 출처 URL을 표기하세요"
- [ ] P4-03: `ragSearchService.ts` — `SearchResult`에 `sourceType` 필드 추가
- [ ] P4-04: `chat/route.ts` — 인용 메타데이터에 웹 출처 정보 포함
  - `metadata.web_sources: [{ title, url, source }]`
- [ ] P4-05: 스트리밍 상태 메시지 추가
  - `[STATUS]🌐 웹 검색 중...` (기존 검색 메시지 뒤에)

---

### Phase 5: 프론트엔드 웹 출처 표시

**목적:** 채팅 메시지에서 웹 검색 출처를 시각적으로 구분하여 표시

| 항목 | 내용 |
|------|------|
| 수정 파일 | `frontend/src/components/Assistant/chat/MessageItem.tsx` |
| 수정 파일 | `frontend/src/hooks/useChat.ts` |
| 작업 내용 | 메시지 메타데이터의 web_sources 표시, 상태 메시지 "웹 검색 중" 처리 |

**구현 항목:**
- [ ] P5-01: `MessageItem.tsx` — 메시지 하단에 웹 출처 링크 표시
  - `[🌐 출처]` 형태로 웹 소스 목록 렌더링
  - 클릭 시 새 탭에서 원본 URL 열기
  - 신뢰도 배지 (학술/정부/뉴스/일반) 색상 구분
- [ ] P5-02: `useChat.ts` — `[STATUS]🌐` 상태 메시지 필터링 추가
- [ ] P5-03: 웹 출처 카드 스타일링 (기존 ResearchCard.tsx 디자인 참고)

---

### Phase 6: 빌드 검증 및 테스트

**목적:** 전체 시스템 통합 검증

| 항목 | 내용 |
|------|------|
| 검증 | `tsc --noEmit` + `npm run build` |
| 테스트 | 일반 질문 / 학술 질문 / 문서 기반 질문 시나리오 |

**구현 항목:**
- [ ] P6-01: TypeScript 타입 체크 — 에러 0개 확인
- [ ] P6-02: Next.js 빌드 — 성공 확인
- [ ] P6-03: 시나리오 테스트 A — 일반 질문 ("최근 AI 트렌드는?")
  - 예상: Brave Search 결과가 답변에 포함, 출처 URL 표시
- [ ] P6-04: 시나리오 테스트 B — 학술 질문 ("트랜스포머 논문 핵심 내용은?")
  - 예상: Brave + Tavily 모두 호출, 학술 출처 우선 표시
- [ ] P6-05: 시나리오 테스트 C — 문서 기반 질문 (업로드 문서 관련 질문)
  - 예상: 사용자 문서 우선 참조, 웹 검색은 보충 역할
- [ ] P6-06: 시나리오 테스트 D — API 키 미설정 시 graceful degradation
  - 예상: 웹 검색 스킵, 사용자 문서만으로 답변 (에러 없음)
- [ ] P6-07: Vercel 배포 후 프로덕션 테스트

---

## 5. 수정/생성 파일 목록

| # | 파일 | 작업 | Phase |
|---|------|------|-------|
| 1 | `frontend/src/lib/research/braveClient.ts` | **신규** — Brave Search API 클라이언트 | P1 |
| 2 | `frontend/src/lib/services/chat/webSearchService.ts` | **신규** — 통합 웹 검색 서비스 | P2 |
| 3 | `frontend/src/config/featureFlags.ts` | 수정 — 3개 플래그 추가 | P3 |
| 4 | `frontend/src/app/api/chat/route.ts` | 수정 — Parallel Fetch + 웹 컨텍스트 | P4 |
| 5 | `frontend/src/lib/services/chat/ragSearchService.ts` | 수정 — sourceType 필드 추가 | P4 |
| 6 | `frontend/src/lib/services/chat/promptBuilder.ts` | 수정 — 웹 컨텍스트 프롬프트 섹션 | P4 |
| 7 | `frontend/src/lib/services/chat/index.ts` | 수정 — export 추가 | P4 |
| 8 | `frontend/src/components/Assistant/chat/MessageItem.tsx` | 수정 — 웹 출처 표시 UI | P5 |
| 9 | `frontend/src/hooks/useChat.ts` | 수정 — 상태 메시지 처리 | P5 |
| 10 | `.env.local` / `.env.example` | 수정 — BRAVE_API_KEY | P1, P3 |

---

## 6. 리스크 및 대응

| 리스크 | 영향 | 대응 |
|--------|------|------|
| Brave API 키 미설정 | 웹 검색 불가 | Feature Flag OFF + graceful skip |
| Brave API Rate Limit (2,000/월 무료) | 검색 실패 | 429 에러 시 skip, 로그 기록 |
| 웹 검색 지연 (500ms~2s) | 채팅 응답 지연 | Parallel Fetch로 RAG와 동시 실행, 타임아웃 3초 |
| 웹 정보 정확성 | 잘못된 정보 제공 | 프롬프트에 "웹 정보는 반드시 출처 표기" 지시 |
| Tavily + Brave 중복 결과 | 컨텍스트 낭비 | URL 기준 중복 제거 |
| 기존 Deep Scholar 탭 영향 | 사용자 혼란 | 별도 유지 — 채팅 통합은 자동, 탭은 수동 검색 |

---

## 7. 비용 분석

| 항목 | 무료 티어 | 유료 티어 |
|------|----------|----------|
| Brave Search API | 2,000 queries/월 | $5/1,000 queries |
| Tavily Search API | 1,000 queries/월 | $0.01/query |
| LLM (쿼리 생성) | 기존 사용량에 포함 | — |

**예상 월간 비용 (free 30회 기준):**
- 사용자 1명 × 30회 채팅 × 1 웹 검색/채팅 = 30 queries
- 10명 활성 사용자 기준 = 300 queries/월 → 무료 티어 내 충분

---

## 8. 성공 지표

| 지표 | 목표 |
|------|------|
| 채팅 응답에 웹 출처 포함 비율 | 외부 정보 필요 질문의 80% 이상 |
| 추가 지연 시간 (웹 검색) | 1초 이내 (Parallel Fetch) |
| 빌드 성공 | `tsc --noEmit` 0에러 + `next build` 성공 |
| 에러율 (API 실패 등) | 5% 미만 |
| 사용자 만족도 | "근거 찾기" 탭 수동 사용 빈도 감소 |

---

## 9. 향후 확장 가능성

| 기능 | 설명 | 우선순위 |
|------|------|---------|
| URL 직접 가져오기 | 사용자가 URL 입력 → 문서로 변환 | 높음 |
| OCR 활성화 | 스캔 PDF 지원 (tesseract.js 이미 설치됨) | 중 |
| 검색 결과 캐싱 | 동일 쿼리 반복 시 캐시 반환 | 중 |
| 사용자 검색 히스토리 | 채팅 내 웹 검색 로그 저장 | 낮음 |
| MCP 서버 연동 | 외부 도구 플러그인 시스템 | 낮음 |

---

## 10. 협업자 및 역할

| 역할 | 담당 | 작업 |
|------|------|------|
| 기술 리더 | Claude Opus 4.6 | 설계, 코드 리뷰, 통합 테스트 |
| 시니어 개발자 | — | API 클라이언트, 서비스 레이어 구현 |
| 주니어 개발자 | — | Feature Flags, UI 컴포넌트 |
| UX/UI 전문가 | — | 웹 출처 표시 디자인, 신뢰도 배지 |

---

**문서 끝**
