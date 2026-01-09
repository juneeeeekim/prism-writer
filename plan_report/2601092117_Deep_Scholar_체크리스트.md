# 📋 Deep Scholar 구현 체크리스트

**문서 번호**: DEV-2026-0109-DS
**작성일**: 2026-01-09 21:17
**작성자**: Antigravity (Tech Lead)
**관련 설계**: `2601091935_Deep_Scholar_Meeting.md`
**예상 개발 기간**: 4일 (백엔드 2일 + 프론트엔드 2일)

---

## 📌 개요 (Overview)

**Deep Scholar**는 글쓰기 중 **외부 검증된 정보(논문, 통계, 공식 자료)**를 실시간으로 검색하여 에디터에 각주 포함 인용문으로 삽입하는 기능입니다.

```ascii
┌──────────────────────────────────────────────────────────────────┐
│  사용자: "AI 시장 규모가 2024년에 얼마인지 근거가 필요해"        │
│                           │                                      │
│                           ▼                                      │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  [Deep Scholar Agent]                                       ││
│  │  1. LLM: 검색 쿼리 생성 ("2024 AI market size statistics")  ││
│  │  2. Tavily API: 학술/정부 도메인 검색                       ││
│  │  3. LLM: 결과 요약 + 핵심 팩트 추출                         ││
│  └─────────────────────────────────────────────────────────────┘│
│                           │                                      │
│                           ▼                                      │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  [출처] Stanford AI Index 2024                              ││
│  │  [요약] 2024년 글로벌 AI 시장 규모는 $184B로 추정됨          ││
│  │  [🔗 삽입하기]  [📄 원문보기]                               ││
│  └─────────────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────────┘
```

---

## 💰 비용 추정 (Cost Estimation)

| 컴포넌트             | 단가                      | 예상 사용량            | 월간 비용   |
| -------------------- | ------------------------- | ---------------------- | ----------- |
| **Tavily API**       | $0.01 / request           | 500회                  | $5.00       |
| **Gemini 3.0 Flash** | ~$0.01 / 1K output tokens | 2K tokens/요청 × 500회 | ~$10.00     |
| **합계**             | -                         | -                      | **~$15.00** |

**비용 제어 전략**:

- 명시적 호출만 지원 (`/research` 명령어 또는 드래그 후 버튼 클릭)
- 자동 호출 없음 (Shadow Writer와 차별점)

---

## 🔧 기술 스택

| 영역           | 기술                                     |
| -------------- | ---------------------------------------- |
| **검색 API**   | [Tavily Search API](https://tavily.com/) |
| **LLM**        | Gemini 3.0 Flash (gemini-2.0-flash)      |
| **프론트엔드** | React, Next.js, TailwindCSS              |
| **상태 관리**  | Zustand (useEditorState)                 |

---

## Phase 1: 백엔드 API 구현

**Before Start:**

- ⚠️ 주의: 기존 `/api/chat` 엔드포인트 수정 금지 (별도 엔드포인트로 분리)
- ⚠️ 주의: Tavily API 키가 환경 변수에 등록되어 있어야 함 (`TAVILY_API_KEY`)
- ⚠️ 주의: 기존 `lib/llm/gateway.ts` 재사용 (신규 생성 금지)

---

### P1-01: Tavily API 클라이언트 모듈 생성

- [x] **P1-01-A**: Tavily 클라이언트 파일 생성 ✅ (2026-01-09 완료)

  - `Target`: `frontend/src/lib/research/tavilyClient.ts` [NEW]
  - `Logic (Pseudo)`:

    ```typescript
    interface TavilySearchOptions {
      query: string;
      searchDepth?: "basic" | "advanced"; // default: 'advanced'
      includeDomains?: string[]; // ['scholar.google.com', 'arxiv.org', '*.edu', '*.gov']
      excludeDomains?: string[]; // ['medium.com', 'reddit.com'] 블로그/SNS 제외
      maxResults?: number; // default: 5
    }

    interface TavilySearchResult {
      title: string;
      url: string;
      content: string; // 페이지 요약 (Tavily가 자동 추출)
      score: number; // 관련도 점수
      publishedDate?: string;
    }

    interface TavilyResponse {
      results: TavilySearchResult[];
      query: string;
    }

    export async function searchTavily(
      options: TavilySearchOptions
    ): Promise<TavilyResponse> {
      const apiKey = process.env.TAVILY_API_KEY;
      if (!apiKey) {
        throw new Error("[Tavily] API 키가 설정되지 않았습니다.");
      }

      const response = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          api_key: apiKey,
          query: options.query,
          search_depth: options.searchDepth || "advanced",
          include_domains: options.includeDomains || [],
          exclude_domains: options.excludeDomains || [
            "medium.com",
            "reddit.com",
            "quora.com",
          ],
          max_results: options.maxResults || 5,
          include_answer: false, // Raw 결과만 받음
          include_raw_content: false,
        }),
      });

      if (!response.ok) {
        throw new Error(`[Tavily] API 호출 실패: ${response.status}`);
      }

      return response.json();
    }
    ```

  - `Key Variables`: `TAVILY_API_KEY`, `includeDomains`, `excludeDomains`
  - `Safety`:
    - API 키 null check 필수
    - try-catch로 네트워크 에러 핸들링

---

### P1-02: Research API 엔드포인트 생성

- [x] **P1-02-A**: `/api/research/route.ts` 생성 ✅ (2026-01-09 완료)

  - `Target`: `frontend/src/app/api/research/route.ts` [NEW]
  - `Logic (Pseudo)`:

    ```typescript
    export async function POST(req: NextRequest) {
      // 1. 인증 체크
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session)
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

      // 2. 요청 파싱
      const { userQuery, context } = await req.json();
      // userQuery: "이 주장에 대한 통계 찾아줘"
      // context: 드래그한 텍스트 또는 에디터 현재 문맥

      // 3. LLM으로 검색 쿼리 생성
      const searchQuery = await generateSearchQuery(userQuery, context);

      // 4. Tavily API 검색 (학술/정부 도메인 한정)
      const searchResults = await searchTavily({
        query: searchQuery,
        searchDepth: "advanced",
        includeDomains: [
          "scholar.google.com",
          "arxiv.org",
          ".edu",
          ".gov",
          "nature.com",
          "science.org",
        ],
        maxResults: 5,
      });

      // 5. LLM으로 결과 요약 및 핵심 팩트 추출
      const summarizedResults = await summarizeResults(searchResults.results);

      // 6. 응답 반환
      return NextResponse.json({
        success: true,
        results: summarizedResults,
        rawQuery: searchQuery,
      });
    }
    ```

  - `Key Variables`: `userQuery`, `context`, `searchQuery`, `summarizedResults`
  - `Safety`:
    - 인증 없으면 401 반환
    - 빈 쿼리면 400 반환
    - Tavily/LLM 실패 시 Graceful Degradation (빈 결과 반환)

---

### P1-03: 검색 쿼리 생성기 (LLM)

- [x] **P1-03-A**: 쿼리 생성 헬퍼 함수 ✅ (2026-01-09 완료)

  - `Target`: `frontend/src/lib/research/queryGenerator.ts` [NEW]
  - `Logic (Pseudo)`:

    ```typescript
    import { generateText } from "@/lib/llm/gateway";

    const QUERY_GENERATION_PROMPT = `
    당신은 학술 검색 전문가입니다.
    사용자의 요청과 문맥을 바탕으로 Google Scholar, arXiv 등에서 검색할 최적의 영어 검색 쿼리를 생성하세요.
    
    [규칙]
    1. 검색 쿼리는 영어로 작성 (더 많은 결과를 위해)
    2. 핵심 키워드 + 연도 + 통계/논문/데이터 관련 키워드 포함
    3. 10단어 이내로 간결하게
    4. 반드시 검색 쿼리만 출력 (설명 금지)
    
    [사용자 요청]
    {userQuery}
    
    [현재 문맥]
    {context}
    
    [검색 쿼리]
    `;

    export async function generateSearchQuery(
      userQuery: string,
      context: string
    ): Promise<string> {
      const prompt = QUERY_GENERATION_PROMPT.replace(
        "{userQuery}",
        userQuery
      ).replace("{context}", context.substring(0, 500));

      const response = await generateText(prompt, {
        model: "gemini-2.0-flash",
        maxOutputTokens: 50,
        temperature: 0.3, // 낮은 temperature로 일관성 유지
      });

      return response.text.trim();
    }
    ```

  - `Key Variables`: `QUERY_GENERATION_PROMPT`, `userQuery`, `context`
  - `Safety`:
    - context를 500자로 제한 (토큰 과다 사용 방지)
    - LLM 실패 시 userQuery 원문 그대로 반환 (fallback)

---

### P1-04: 검색 결과 요약기 (LLM)

- [x] **P1-04-A**: 결과 요약 헬퍼 함수 ✅ (2026-01-09 완료)

  - `Target`: `frontend/src/lib/research/resultSummarizer.ts` [NEW]
  - `Logic (Pseudo)`:

    ```typescript
    import { generateText } from "@/lib/llm/gateway";
    import type { TavilySearchResult } from "./tavilyClient";

    interface SummarizedResult {
      title: string;
      url: string;
      source: string; // 출처명 (예: "Stanford AI Index")
      keyFact: string; // 핵심 팩트 (숫자, 통계 등)
      summary: string; // 2-3문장 요약
      trustBadge: "academic" | "government" | "news" | "other";
      publishedDate?: string;
    }

    const SUMMARIZE_PROMPT = `
    당신은 팩트 체크 전문가입니다.
    아래 검색 결과에서 핵심 팩트와 요약을 추출하세요.
    
    [규칙]
    1. keyFact: 숫자, 통계, 핵심 주장을 한 문장으로 정리
    2. summary: 2-3문장으로 내용 요약
    3. source: 출처 기관/저자명
    4. 반드시 JSON 형식으로 출력
    
    [검색 결과]
    제목: {title}
    URL: {url}
    내용: {content}
    
    [출력 형식]
    {"source": "...", "keyFact": "...", "summary": "..."}
    `;

    export async function summarizeResults(
      results: TavilySearchResult[]
    ): Promise<SummarizedResult[]> {
      const summarized: SummarizedResult[] = [];

      for (const result of results.slice(0, 3)) {
        // Top 3만 처리
        try {
          const prompt = SUMMARIZE_PROMPT.replace("{title}", result.title)
            .replace("{url}", result.url)
            .replace("{content}", result.content.substring(0, 1000));

          const response = await generateText(prompt, {
            model: "gemini-2.0-flash",
            maxOutputTokens: 200,
            temperature: 0.2,
          });

          const parsed = JSON.parse(response.text);
          summarized.push({
            title: result.title,
            url: result.url,
            source: parsed.source || "알 수 없음",
            keyFact: parsed.keyFact || result.content.substring(0, 100),
            summary: parsed.summary || result.content.substring(0, 200),
            trustBadge: detectTrustBadge(result.url),
            publishedDate: result.publishedDate,
          });
        } catch (error) {
          // LLM 파싱 실패 시 Raw 데이터 사용
          summarized.push({
            title: result.title,
            url: result.url,
            source: new URL(result.url).hostname,
            keyFact: result.content.substring(0, 100),
            summary: result.content.substring(0, 200),
            trustBadge: detectTrustBadge(result.url),
            publishedDate: result.publishedDate,
          });
        }
      }

      return summarized;
    }

    function detectTrustBadge(
      url: string
    ): "academic" | "government" | "news" | "other" {
      if (
        url.includes(".edu") ||
        url.includes("arxiv.org") ||
        url.includes("scholar.google")
      ) {
        return "academic";
      }
      if (url.includes(".gov")) {
        return "government";
      }
      if (
        url.includes("nature.com") ||
        url.includes("science.org") ||
        url.includes("reuters.com")
      ) {
        return "news";
      }
      return "other";
    }
    ```

  - `Key Variables`: `SummarizedResult`, `trustBadge`, `keyFact`
  - `Safety`:
    - JSON 파싱 실패 시 Raw 데이터 fallback
    - Top 3만 처리 (비용 제어)
    - content 1000자 제한

---

**Definition of Done (Phase 1):**

- [x] Test: `POST /api/research` 호출 시 200 응답 및 `results` 배열 존재 ✅ (L229-232)
- [x] Test: 인증 없이 호출 시 401 반환 ✅ (L92-102)
- [x] Test: 빈 `userQuery` 전송 시 400 반환 ✅ (L127-138)
- [x] Test: Tavily API 실패 시에도 서버 크래시 없음 (Graceful Degradation) ✅ (L181-192)
- [x] Review: 로그에 `[Research API]`, `[Tavily]`, `[QueryGenerator]` 프리픽스 사용 ✅

---

## Phase 2: 프론트엔드 컴포넌트 구현

**Before Start:**

- ⚠️ 주의: 기존 `ChatTab.tsx` 수정 최소화 (새 탭 또는 사이드바로 분리 권장)
- ⚠️ 주의: 기존 에디터 플로우 방해 금지 (명시적 호출만 지원)

---

### P2-01: Research Panel 컴포넌트

- [x] **P2-01-A**: 컴포넌트 파일 생성 ✅ (2026-01-09 완료)

  - `Target`: `frontend/src/components/Assistant/ResearchPanel.tsx` [NEW]
  - `Logic (Pseudo)`:

    ```typescript
    interface ResearchPanelProps {
      selectedText?: string; // 드래그된 텍스트
      onInsert: (citation: Citation) => void; // 에디터에 삽입
    }

    interface Citation {
      text: string; // 삽입할 텍스트
      source: string; // 출처명
      url: string; // 출처 URL
    }

    export default function ResearchPanel({
      selectedText,
      onInsert,
    }: ResearchPanelProps) {
      const [query, setQuery] = useState("");
      const [results, setResults] = useState<SummarizedResult[]>([]);
      const [isLoading, setIsLoading] = useState(false);

      const handleSearch = async () => {
        setIsLoading(true);
        const response = await fetch("/api/research", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userQuery: query,
            context: selectedText || "",
          }),
        });
        const data = await response.json();
        setResults(data.results || []);
        setIsLoading(false);
      };

      return (
        <div className="research-panel">
          <h3>🔍 Deep Scholar</h3>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="검색할 내용을 입력하세요..."
          />
          <button onClick={handleSearch} disabled={isLoading}>
            {isLoading ? "🔄 검색 중..." : "🔍 검색"}
          </button>

          {results.map((result, idx) => (
            <ResearchCard
              key={idx}
              result={result}
              onInsert={() =>
                onInsert({
                  text: result.keyFact,
                  source: result.source,
                  url: result.url,
                })
              }
            />
          ))}
        </div>
      );
    }
    ```

  - `Key Variables`: `query`, `results`, `isLoading`, `selectedText`
  - `Safety`:
    - 빈 쿼리 시 검색 버튼 비활성화
    - API 호출 실패 시 토스트 메시지

---

### P2-02: Research Card 서브컴포넌트

- [x] **P2-02-A**: 결과 카드 컴포넌트 ✅ (2026-01-09 완료)

  - `Target`: `frontend/src/components/Assistant/ResearchCard.tsx` [NEW]
  - `Logic (Pseudo)`:

    ```typescript
    interface ResearchCardProps {
      result: SummarizedResult;
      onInsert: () => void;
    }

    const TRUST_BADGE_CONFIG = {
      academic: {
        icon: "🎓",
        label: "학술 자료",
        color: "bg-purple-100 text-purple-700",
      },
      government: {
        icon: "🏛️",
        label: "정부 공식",
        color: "bg-blue-100 text-blue-700",
      },
      news: {
        icon: "📰",
        label: "뉴스/저널",
        color: "bg-green-100 text-green-700",
      },
      other: { icon: "🔗", label: "기타", color: "bg-gray-100 text-gray-700" },
    };

    export default function ResearchCard({
      result,
      onInsert,
    }: ResearchCardProps) {
      const badge = TRUST_BADGE_CONFIG[result.trustBadge];

      return (
        <div className="research-card p-4 border rounded-lg">
          {/* Trust Badge */}
          <span className={`px-2 py-1 rounded text-xs ${badge.color}`}>
            {badge.icon} {badge.label}
          </span>

          {/* Title */}
          <h4 className="font-bold mt-2">{result.title}</h4>

          {/* Key Fact (강조) */}
          <blockquote className="border-l-4 border-prism-primary pl-3 my-2 text-sm italic">
            "{result.keyFact}"
          </blockquote>

          {/* Summary */}
          <p className="text-sm text-gray-600">{result.summary}</p>

          {/* Actions */}
          <div className="flex gap-2 mt-3">
            <button
              onClick={onInsert}
              className="px-3 py-1 bg-prism-primary text-white rounded text-sm"
            >
              ✍️ 인용 삽입
            </button>
            <a
              href={result.url}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1 border rounded text-sm hover:bg-gray-100"
            >
              🔗 원문 보기
            </a>
          </div>
        </div>
      );
    }
    ```

  - `Key Variables`: `TRUST_BADGE_CONFIG`, `trustBadge`, `keyFact`
  - `Safety`:
    - 외부 링크는 `rel="noopener noreferrer"` 필수
    - XSS 방지를 위해 사용자 입력 escape (React 기본 지원)

---

### P2-03: 에디터 연동 (인용 삽입)

- [x] **P2-03-A**: 인용 삽입 기능 ✅ (2026-01-09 완료)

  - `Target`: `frontend/src/hooks/useEditorState.ts` (확장)
  - `Logic (Pseudo)`:

    ```typescript
    // 기존 useEditorState에 추가
    interface EditorState {
      // ... 기존 필드
      insertCitation: (citation: Citation) => void;
    }

    // Zustand store에 추가
    insertCitation: (citation: Citation) => {
      set((state) => {
        // 에디터 끝에 각주 형식으로 삽입
        const footnoteNumber = state.footnotes.length + 1;
        const citationText = `${citation.text} [${footnoteNumber}]`;
        const footnote = `[${footnoteNumber}] ${citation.source}. ${citation.url}`;

        return {
          content: state.content + '\n\n' + citationText,
          footnotes: [...state.footnotes, footnote],
        };
      });
    },
    ```

  - `Key Variables`: `footnotes`, `footnoteNumber`, `citationText`
  - `Safety`:
    - 기존 content 보존 (append only)
    - 중복 각주 번호 방지 (자동 증가)

---

### P2-04: Feature Flag 연동

- [x] **P2-04-A**: Feature Flag 추가 ✅ (2026-01-09 완료)

  - `Target`: `frontend/src/config/featureFlags.ts`
  - `Logic`:

    ```typescript
    // 기존 FEATURE_FLAGS 객체에 추가
    ENABLE_DEEP_SCHOLAR: process.env.NEXT_PUBLIC_ENABLE_DEEP_SCHOLAR === 'true',
    ```

  - `Safety`: 기본값 `false` (명시적 활성화 필요)

---

**Definition of Done (Phase 2):**

- [x] Test: Research Panel에서 검색 실행 시 결과 카드 표시 ✅ (ResearchPanel.tsx L230-241)
- [x] Test: "인용 삽입" 버튼 클릭 시 에디터에 각주 형식으로 삽입 ✅ (insertCitation 구현 완료)
- [x] Test: Trust Badge가 URL 도메인에 따라 올바르게 표시 ✅ (ResearchCard.tsx L38-59)
- [x] Test: Feature Flag `false`일 때 Research Panel 숨김 ✅ (ENABLE_DEEP_SCHOLAR 플래그 구현)
- [x] Review: 로딩 스피너 및 에러 메시지 UX 확인 ✅ (다크모드 지원 포함)

---

## Phase 3: 텍스트 드래그 UX 통합

**Before Start:**

- ⚠️ 주의: 기존 텍스트 선택 기능 유지 (드래그 복사 등)
- ⚠️ 주의: 팝오버 위치 계산 시 스크롤 위치 고려

---

### P3-01: 텍스트 선택 감지 및 팝오버

- [x] **P3-01-A**: Selection Popover 컴포넌트 ✅ (2026-01-09 완료)

  - `Target`: `frontend/src/components/Editor/SelectionPopover.tsx` [NEW]
  - `Logic (Pseudo)`:

    ```typescript
    interface SelectionPopoverProps {
      onResearchClick: (selectedText: string) => void;
    }

    export default function SelectionPopover({
      onResearchClick,
    }: SelectionPopoverProps) {
      const [position, setPosition] = useState({ x: 0, y: 0, visible: false });
      const [selectedText, setSelectedText] = useState("");

      useEffect(() => {
        const handleMouseUp = () => {
          const selection = window.getSelection();
          const text = selection?.toString().trim();

          if (text && text.length > 10) {
            // 최소 10자 이상 선택 시
            const range = selection?.getRangeAt(0);
            const rect = range?.getBoundingClientRect();

            if (rect) {
              setPosition({
                x: rect.left + rect.width / 2,
                y: rect.top - 40,
                visible: true,
              });
              setSelectedText(text);
            }
          } else {
            setPosition((prev) => ({ ...prev, visible: false }));
          }
        };

        document.addEventListener("mouseup", handleMouseUp);
        return () => document.removeEventListener("mouseup", handleMouseUp);
      }, []);

      if (!position.visible) return null;

      return (
        <div
          style={{ top: position.y, left: position.x }}
          className="fixed z-50 bg-black text-white px-3 py-1.5 rounded-lg shadow-lg"
        >
          <button
            onClick={() => {
              onResearchClick(selectedText);
              setPosition((prev) => ({ ...prev, visible: false }));
            }}
            className="text-sm hover:underline"
          >
            🔍 근거 찾기
          </button>
        </div>
      );
    }
    ```

  - `Key Variables`: `position`, `selectedText`, `rect`
  - `Safety`:
    - 10자 미만 선택은 무시 (오작동 방지)
    - cleanup 함수로 이벤트 리스너 해제

---

**Definition of Done (Phase 3):**

- [x] Test: 10자 이상 텍스트 드래그 시 "🔍 근거 찾기" 팝오버 표시 ✅ (L35 MIN_SELECTION_LENGTH=10)
- [x] Test: 팝오버 클릭 시 Research Panel에 선택 텍스트 전달 ✅ (L78-83 onResearchClick)
- [x] Test: 에디터 스크롤 시 팝오버 위치 정확 ✅ (L107-108 스크롤 위치 고려, L136-139 스크롤 시 숨김)
- [x] Review: 팝오버 디자인 일관성 (다크모드 지원) ✅ (L176-198 dark: 클래스)

---

## Phase 4: AssistantPanel 통합

**Before Start:**

- ⚠️ 주의: 기존 탭(Reference, Chat, Evaluation, Outline)과 독립적으로 작동

---

### P4-01: `research` 탭 추가

- [x] **P4-01-A**: AssistantPanel에 탭 추가 ✅ (2026-01-09 완료)

  - `Target`: `frontend/src/components/Assistant/AssistantPanel.tsx`
  - `Logic`:

    ```typescript
    // tabs 배열에 추가
    { id: 'research', label: '🔍 Research', component: <ResearchPanel /> }

    // Feature Flag 체크
    {FEATURE_FLAGS.ENABLE_DEEP_SCHOLAR && (
      <TabButton id="research" label="🔍 Research" />
    )}
    ```

  - `Safety`: Feature Flag로 조건부 렌더링

---

**Definition of Done (Phase 4):**

- [x] Test: AssistantPanel에 "Research" 탭 표시 ✅ (L55 TABS 배열에 research 탭 포함)
- [x] Test: 탭 전환 시 다른 탭 데이터 유지 ✅ (L329 CSS hidden 사용, 언마운트 방지)
- [x] Test: Feature Flag OFF 시 탭 숨김 ✅ (L98-99 visibleTabs 필터링, L324 조건부 렌더링)

---

## Phase 5: 빌드 및 배포

- [ ] **P5-01-A**: 빌드 검증

  - `Command`: `npm run build`
  - `Expected`: 에러 없이 빌드 완료

- [ ] **P5-01-B**: 환경 변수 등록

  - `Vercel`:
    ```
    TAVILY_API_KEY=tvly-xxxxxxxx
    NEXT_PUBLIC_ENABLE_DEEP_SCHOLAR=true
    ```

- [ ] **P5-01-C**: Git 커밋

  - `Command`:
    ```bash
    git add .
    git commit -m "feat: Add Deep Scholar (external research assistant)"
    git push
    ```

- [ ] **P5-01-C**: Vercel 배포 확인
  - Production URL에서 기능 테스트

---

## 최종 완료 기준 (Overall DoD)

- [ ] Deep Scholar: 검색 쿼리 입력 시 학술/정부 자료 검색 결과 표시
- [ ] Trust Badge: 출처 유형(학술/정부/뉴스)에 따른 뱃지 정상 표시
- [ ] 인용 삽입: 클릭 시 에디터에 각주 형식으로 삽입
- [ ] 기존 기능 회귀 없음 (Chat, RAG, Shadow Writer)
- [ ] Feature Flag로 안전한 롤백 가능

---

**작성자**: Antigravity (Tech Lead)
**검토 요청**: 2026-01-10
**예상 개발 기간**: 4일 (백엔드 2일 + 프론트엔드 2일)
