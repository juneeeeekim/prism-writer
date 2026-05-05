# PRISM Writer - Deep Reading 파이프라인 구현 체크리스트

> **문서 ID:** 2603091830-CL
> **작성일:** 2026-03-09
> **기반 설계:** `2603091830_DeepReading_Pipeline_Idea_Meeting.md`
> **작성자:** Tech Lead (15년 차)
> **상태:** Ready for Implementation
> **목표:** 개발자가 설계 재해석 없이 `파일 > 함수 > 변수 > 예외 처리` 순서로 바로 구현 가능하도록 작업 지시를 고정한다.

---

## [Phase 0: 구현 착수 전 계약 고정]
**Before Start:**
- 주의: `frontend/src/lib/services/chat/webSearchService.ts > performWebSearch()`는 **레거시 스니펫 fallback 기준선**이다. 삭제/인라인 병합 금지.
- 주의: `frontend/src/app/api/chat/route.ts`의 Progressive Streaming 구조(`ReadableStream`, `STATUS_PREFIX`)는 유지한다.
- 주의: `frontend/src/lib/research/resultSummarizer.ts > detectTrustBadge()`는 재사용 대상이다. 동일 로직 복제 금지.

**Implementation Items:**
- [ ] **ID(P0-01)**: 런타임 의존성 정리
  - `Target`: `frontend/package.json`
  - `Logic (Pseudo)`:
    > `dependencies['@mozilla/readability'] = '...'`  
    > `dependencies['robots-parser'] = '...'`  
    > `if ('jsdom' is used in server runtime) move jsdom from devDependencies -> dependencies`
  - `Key Variables`: `readability`, `robotsParser`, `JSDOM`
  - `Safety`: Vercel 런타임에서 devDependency 누락이 발생하지 않도록 `server runtime import` 패키지는 반드시 `dependencies`에 둔다.

- [ ] **ID(P0-02)**: Shadow Mode 비교 계약 정의
  - `Target`: `frontend/src/lib/rag/shadowModeLogger.ts` > `logDeepReadingShadowComparison()`
  - `Logic (Pseudo)`:
    > `type DeepReadingShadowPayload = { query, baselineCount, deepCount, baselineLatencyMs, deepLatencyMs, citationPassRateDelta, fallbackRate }`  
    > `if (NODE_ENV === 'development') console.debug(payload)`  
    > `// Supabase insert는 fire-and-forget, 실패해도 main flow 영향 없음`
  - `Key Variables`: `baselineLatencyMs`, `deepLatencyMs`, `fallbackRate`, `citationPassRateDelta`
  - `Safety`: logger 실패 시 `throw` 금지, query는 `substring(0, 100)`으로 잘라 저장.

**Definition of Done (검증):**
- [ ] Test: `frontend/package.json` 변경 후 `frontend` 빌드 시 runtime import 에러가 없어야 한다.
- [ ] Test: Shadow logger 호출 실패가 채팅 응답 실패로 전파되지 않아야 한다.
- [ ] Review: `performWebSearch()`는 그대로 남아 있고, Deep Reading이 꺼진 경우 기존 경로로만 동작하는지 확인.

---

## [Phase 1: 크롤러 기반 구축]
**Before Start:**
- 주의: `braveClient.ts`, `tavilyClient.ts`는 검색 공급자 클라이언트다. 이 Phase에서 수정하지 않는다.
- 주의: Puppeteer/Playwright 기반 렌더링 추가 금지. 설계상 Vercel 서버리스 비적합이다.
- 회귀 테스트 포인트: `performWebSearch(query)`의 URL 정렬/중복 제거 결과는 유지되어야 한다.

**Implementation Items:**
- [ ] **ID(P1-01)**: 크롤러 타입/상수 정의
  - `Target`: `frontend/src/lib/research/webCrawler.ts` > 파일 상단
  - `Logic (Pseudo)`:
    > `type CrawlSource = 'jina' | 'readability' | 'snippet-fallback'`  
    > `interface CrawlOptions { timeoutMs; maxBytes; userAgent; respectRobots }`  
    > `interface CrawlResult { url; finalUrl; markdown; html; source; status; fetchedAt; errorCode? }`  
    > `const DEFAULT_CRAWL_OPTIONS = { timeoutMs: 5000, maxBytes: 2_000_000, respectRobots: true }`
  - `Key Variables`: `DEFAULT_CRAWL_OPTIONS`, `CrawlResult`, `CrawlSource`, `maxBytes`
  - `Safety`: `html`/`markdown` 둘 다 비어 있으면 `status='failed'`로 표준화한다.

- [ ] **ID(P1-02)**: URL 안전성 검사 + robots 검사
  - `Target`: `webCrawler.ts` > `validateCrawlUrl()`, `checkRobotsPermission()`
  - `Logic (Pseudo)`:
    > `const parsed = new URL(url)`  
    > `if (!['http:', 'https:'].includes(parsed.protocol)) return { allowed: false, reason: 'invalid_protocol' }`  
    > `if (isPrivateHost(parsed.hostname)) return { allowed: false, reason: 'private_ip_blocked' }`  
    > `if (respectRobots) robotsAllowed = await checkRobotsPermission(parsed)`  
    > `return { allowed: robotsAllowed, normalizedUrl }`
  - `Key Variables`: `normalizedUrl`, `robotsAllowed`, `redirectCount`, `blockedReason`
  - `Safety`: `new URL(url)`는 `try-catch`로 감싼다. DNS/hostname 파싱 실패도 `allowed=false`로 처리한다.

- [ ] **ID(P1-03)**: 1차 Jina, 2차 Readability 폴백 크롤러 구현
  - `Target`: `webCrawler.ts` > `fetchViaJina()`, `fetchViaReadability()`, `crawlUrl()`
  - `Logic (Pseudo)`:
    > `async function crawlUrl(url, options)`  
    > `  safe = await validateCrawlUrl(url)`  
    > `  if (!safe.allowed) return buildFailedResult(url, safe.reason)`  
    > `  jina = await fetchViaJina(url)`  
    > `  if (jina.status === 'ok') return jina`  
    > `  fallback = await fetchViaReadability(url)`  
    > `  if (fallback.status === 'ok') return fallback`  
    > `  return buildFailedResult(url, 'crawl_failed')`
  - `Key Variables`: `jinaUrl`, `abortController`, `responseBytes`, `finalUrl`
  - `Safety`: `content-type`이 `text/html`, `text/plain`, `text/markdown`이 아니면 즉시 중단한다. redirect는 최대 3회까지만 허용한다.

- [ ] **ID(P1-04)**: 병렬 크롤링 오케스트레이션
  - `Target`: `webCrawler.ts` > `crawlUrls()`
  - `Logic (Pseudo)`:
    > `selected = urls.slice(0, maxPages)`  
    > `results = await Promise.allSettled(selected.map(url => crawlUrl(url, options)))`  
    > `return results.map(settled => settled.status === 'fulfilled' ? settled.value : buildFailedResult(...))`
  - `Key Variables`: `selectedUrls`, `crawlSettledResults`, `fulfilledResults`, `failedCount`
  - `Safety`: `Promise.all()` 금지. 반드시 `Promise.allSettled()`를 사용해 부분 성공을 살린다.

**Definition of Done (검증):**
- [ ] Test: `http://127.0.0.1` / `http://localhost` / 사설 IP URL 입력 시 `private_ip_blocked`로 실패해야 한다.
- [ ] Test: Jina 타임아웃 상황에서 Readability 폴백이 실행되고, 전체 함수는 throw 없이 종료되어야 한다.
- [ ] Test: 3개 URL 중 1개 실패해도 나머지 2개 결과가 반환되어야 한다.
- [ ] Review: `console.log` 대신 `logger` 사용, `crawlUrl()` 내부 모든 외부 I/O는 `try-catch`로 감쌌는지 확인.

---

## [Phase 2: 본문 추출·정규화·보안 필터]
**Before Start:**
- 주의: 원문 전체를 DB/메시지 metadata에 저장하지 않는다.
- 주의: `frontend/src/lib/rag/tokenizer.ts > truncateToTokenLimit()`가 이미 있다. 길이 제한 로직을 새로 복제하지 말고 재사용한다.
- 회귀 테스트 포인트: `detectTrustBadge(url)`와 무관한 정제 로직을 여기에 넣지 않는다.

**Implementation Items:**
- [ ] **ID(P2-01)**: 페이지 유형 분류기 구현
  - `Target`: `frontend/src/lib/research/contentExtractor.ts` > `classifyPageType()`
  - `Logic (Pseudo)`:
    > `if (hostname includes ['arxiv.org', 'pubmed', '.edu']) return 'academic'`  
    > `if (hostname === 'wikipedia.org' || hostname.endsWith('.wikipedia.org')) return 'wiki'`  
    > `if (hostname startsWith 'docs.' || pathname includes '/docs/') return 'docs'`  
    > `if (html includes '<article') return 'article'`  
    > `return 'general'`
  - `Key Variables`: `hostname`, `pathname`, `pageType`, `html`
  - `Safety`: `url` 파싱 실패 시 `pageType='general'`로 폴백.

- [ ] **ID(P2-02)**: 정규화 + boilerplate 제거 구현
  - `Target`: `contentExtractor.ts` > `normalizeContent()`, `removeBoilerplate()`
  - `Logic (Pseudo)`:
    > `text = markdown ?? readabilityText ?? stripHtml(html)`  
    > `text = removeNavigationBlocks(text)`  
    > `text = removeCookieBanner(text)`  
    > `text = text.replace(/\n{3,}/g, '\n\n').trim()`  
    > `return text`
  - `Key Variables`: `rawText`, `cleanText`, `normalizedText`
  - `Safety`: 입력이 `null | ''`면 빈 결과 객체 반환. regex 처리 전에 최대 길이 상한을 둔다.

- [ ] **ID(P2-03)**: 프롬프트 인젝션 / 악성 문구 필터링
  - `Target`: `contentExtractor.ts` > `sanitizePromptInjection()`
  - `Logic (Pseudo)`:
    > `const suspiciousPatterns = ['ignore previous instructions', 'system prompt', 'developer message', 'browse the web', '비밀번호', 'api key']`  
    > `for pattern in suspiciousPatterns => redact or drop line`  
    > `tag removedCount, injectionDetected`
  - `Key Variables`: `suspiciousPatterns`, `injectionDetected`, `removedLineCount`
  - `Safety`: 제거 후 텍스트가 너무 짧아지면 `sanitizationLevel='aggressive'` 메타만 남기고 요약 단계에서 snippet fallback 허용.

- [ ] **ID(P2-04)**: 구조화 + 길이 제한
  - `Target`: `contentExtractor.ts` > `extractStructuredContent()`
  - `Logic (Pseudo)`:
    > `pageType = classifyPageType(url, html, markdown)`  
    > `title = extractTitle(html, markdown)`  
    > `publishedAt = extractPublishedAt(html)`  
    > `body = truncateByPageType(cleanText, pageType, tokenBudget)`  
    > `paragraphs = splitIntoParagraphs(body)`  
    > `return { title, publishedAt, pageType, body, paragraphs, tokenCountEstimate }`
  - `Key Variables`: `tokenBudget`, `pageType`, `publishedAt`, `paragraphs`, `tokenCountEstimate`
  - `Safety`: `publishedAt` 파싱 실패 시 `null`, `paragraphs.length===0`이면 `snippet fallback` 후보로 표시.

**Definition of Done (검증):**
- [ ] Test: 뉴스/학술/위키/문서 URL 4종에 대해 `pageType`이 기대값으로 분류되는지 확인한다.
- [ ] Test: 본문에 `ignore previous instructions` 문구가 있어도 요약 입력에는 포함되지 않아야 한다.
- [ ] Test: 정제 후 본문이 비었을 때 `extractStructuredContent()`가 throw하지 않고 `isUsable=false`를 반환해야 한다.
- [ ] Review: raw HTML 저장 코드가 없는지, `contentExtractor.ts` 주석에 “untrusted web content” 경고를 남겼는지 확인.

---

## [Phase 3: 웹 본문 요약 계층]
**Before Start:**
- 주의: 모델 ID를 서비스 코드에 하드코딩하지 않는다. `llm-usage-map.ts`만 수정한다.
- 주의: 요약 실패 시 전체 채팅 흐름이 실패하면 안 된다. extractive fallback 경로를 반드시 둔다.
- 회귀 테스트 포인트: 기존 `getModelForUsage('rag.answer')` 경로에는 영향이 없어야 한다.

**Implementation Items:**
- [ ] **ID(P3-01)**: LLM usage context 추가
  - `Target`: `frontend/src/config/llm-usage-map.ts`
  - `Logic (Pseudo)`:
    > `LLM_USAGE_MAP['web.crawl.summarize'] = { modelId, description, generationConfig, fallback }`
  - `Key Variables`: `web.crawl.summarize`, `generationConfig`, `fallback`
  - `Safety`: `validateUsageMap()` 통과 가능하도록 `LLMUsageContext` 타입에 컨텍스트를 함께 추가한다.

- [ ] **ID(P3-02)**: 단일 페이지 요약기 구현
  - `Target`: `frontend/src/lib/research/webContentSummarizer.ts` > `summarizeWebContent()`
  - `Logic (Pseudo)`:
    > `config = getUsageConfig('web.crawl.summarize')`  
    > `if (!config) return buildExtractiveSummary(structured.body)`  
    > `prompt = buildWebSummaryPrompt(structured, query)`  
    > `response = await generateText(prompt, { model: config.modelId, context: 'web.crawl.summarize' })`  
    > `return parseSummary(response) ?? buildExtractiveSummary(structured.body)`
  - `Key Variables`: `summaryPrompt`, `summaryText`, `keyFacts`, `extractiveFallback`
  - `Safety`: LLM 응답 파싱 실패 시 첫 3문단 기반 extractive summary로 폴백한다.

- [ ] **ID(P3-03)**: 다중 페이지 요약기 구현
  - `Target`: `webContentSummarizer.ts` > `summarizeWebContents()`
  - `Logic (Pseudo)`:
    > `tasks = contents.map(content => summarizeWebContent(content, query))`  
    > `settled = await Promise.allSettled(tasks)`  
    > `return settled.filter(fulfilled).map(value)`
  - `Key Variables`: `summarySettledResults`, `successfulSummaries`, `failedSummaries`
  - `Safety`: 개별 페이지 요약 실패가 전체 실패로 전파되지 않도록 한다.

**Definition of Done (검증):**
- [ ] Test: `getUsageConfig('web.crawl.summarize')`가 `undefined`가 아니어야 한다.
- [ ] Test: 요약 모델 호출 실패 시 extractive fallback이 반환되어 `summaryText.length > 0`를 만족해야 한다.
- [ ] Test: 3개 페이지 중 1개 요약 실패해도 2개 summary가 반환되어야 한다.
- [ ] Review: `generateText()` 호출 context가 `'web.crawl.summarize'`로 고정되어 있는지 확인.

---

## [Phase 4: Deep Web Search 오케스트레이터]
**Before Start:**
- 주의: `performWebSearch()`는 baseline/fallback 용도로 유지한다.
- 주의: URL 랭킹은 `detectTrustBadge()` 재사용 + 추가 가중치 방식으로 구현한다. 별도 trust map 복제 금지.
- 회귀 테스트 포인트: 검색 결과가 전혀 없을 때 빈 배열이 아니라 “reason이 있는 결과 객체”를 반환하도록 계약을 명확히 한다.

**Implementation Items:**
- [ ] **ID(P4-01)**: Deep Reading 결과 타입 정의
  - `Target`: `frontend/src/lib/services/chat/deepWebSearchService.ts` > 파일 상단
  - `Logic (Pseudo)`:
    > `interface DeepWebSource { title; url; source; trustBadge; summary; keyFacts; reliabilityScore; contentFreshness; snippetFallback }`  
    > `interface DeepWebSearchResult { sources; selectedUrls; crawledCount; fallbackCount; totalLatencyMs }`
  - `Key Variables`: `DeepWebSource`, `DeepWebSearchResult`, `fallbackCount`
  - `Safety`: 타입에 `snippetFallback: boolean`을 반드시 넣어 downstream이 fallback 여부를 알 수 있게 한다.

- [ ] **ID(P4-02)**: URL 선별/랭킹 함수 구현
  - `Target`: `deepWebSearchService.ts` > `rankUrlsForDeepReading()`, `selectTopUrls()`
  - `Logic (Pseudo)`:
    > `score = result.score`  
    > `score += TRUST_BADGE_WEIGHT[result.trustBadge]`  
    > `score += getFreshnessBoost(result.url, query)`  
    > `if (isPrimarySource(result.url)) score += 0.1`  
    > `if (isUGC(result.url)) score -= 0.15`  
    > `if (selectedDomains.has(domain)) score -= 0.2`  
    > `sort by score desc and pick top 3`
  - `Key Variables`: `rankingScore`, `selectedDomains`, `freshnessBoost`, `domainPenalty`
  - `Safety`: `url` 파싱 실패 결과는 랭킹 제외. 동일 `hostname` 연속 선택을 허용하지 않는다.

- [ ] **ID(P4-03)**: 웹 토큰 예산 계산 함수 구현
  - `Target`: `deepWebSearchService.ts` > `calculateWebTokenBudget()`
  - `Logic (Pseudo)`:
    > `if (ragResultCount >= 5) return 1500`  
    > `if (ragResultCount >= 2) return 3000`  
    > `return 4500`
  - `Key Variables`: `ragResultCount`, `webTokenBudget`
  - `Safety`: 음수/NaN 입력 시 `3000` 기본값 반환.

- [ ] **ID(P4-04)**: 메인 오케스트레이터 구현
  - `Target`: `deepWebSearchService.ts` > `performDeepWebSearch()`
  - `Logic (Pseudo)`:
    > `baselineResults = await performWebSearch(sanitizedQuery, { maxResults: 5 })`  
    > `rankedUrls = selectTopUrls(baselineResults)`  
    > `crawled = await crawlUrls(rankedUrls)`  
    > `structured = crawled.filter(ok).map(extractStructuredContent)`  
    > `summaries = await summarizeWebContents(structured, query)`  
    > `verified = summaries.map(verifyWebSource)`  
    > `return buildDeepWebResult({ baselineResults, summaries, verified })`
  - `Key Variables`: `baselineResults`, `rankedUrls`, `crawledResults`, `structuredContents`, `verifiedSources`
  - `Safety`: 어느 단계에서든 배열이 비면 `buildSnippetFallbackResults(baselineResults)`로 폴백한다.

- [ ] **ID(P4-05)**: barrel export 연결
  - `Target`: `frontend/src/lib/services/chat/index.ts`
  - `Logic (Pseudo)`:
    > `export { performDeepWebSearch, calculateWebTokenBudget } from './deepWebSearchService'`
  - `Key Variables`: `performDeepWebSearch`
  - `Safety`: 기존 export 순서 때문에 타입 충돌이 없는지 확인한다.

**Definition of Done (검증):**
- [ ] Test: `performDeepWebSearch()`는 최대 3개 URL만 크롤링해야 한다.
- [ ] Test: baseline 결과는 있는데 크롤링이 모두 실패한 경우 `snippetFallback=true`인 source 배열이 반환되어야 한다.
- [ ] Test: 동일 도메인 기사 5개가 들어와도 `selectedUrls`는 도메인 다양성을 반영해야 한다.
- [ ] Review: `performWebSearch()` 호출은 여전히 단독 사용 가능하며 삭제되지 않았는지 확인.

---

## [Phase 5: Chat API / Prompt / Feature Flag 통합]
**Before Start:**
- 주의: `route.ts`의 `ReadableStream.start()` 외부로 비동기 작업을 다시 빼지 않는다.
- 주의: 기존 `STATUS_PREFIX='[STATUS]'` 계약을 깨지 않는다.
- 회귀 테스트 포인트: `ENABLE_DEEP_READING=false`이면 현재 260306 웹 검색 통합 동작과 동일해야 한다.

**Implementation Items:**
- [ ] **ID(P5-01)**: Feature Flag 추가
  - `Target`: `frontend/src/config/featureFlags.ts`
  - `Logic (Pseudo)`:
    > `FEATURE_FLAGS.ENABLE_DEEP_READING = env('ENABLE_DEEP_READING', false)`  
    > `FEATURE_FLAGS.ENABLE_DEEP_READING_SHADOW_MODE = env('ENABLE_DEEP_READING_SHADOW_MODE', false)`
  - `Key Variables`: `ENABLE_DEEP_READING`, `ENABLE_DEEP_READING_SHADOW_MODE`
  - `Safety`: boolean coercion 실패 시 기본값은 `false`.

- [ ] **ID(P5-02)**: Deep Reading 프롬프트 포맷터 추가
  - `Target`: `frontend/src/lib/services/chat/promptBuilder.ts` > `PromptContext`, `formatDeepWebContext()`, `buildImprovedSystemPrompt()`
  - `Logic (Pseudo)`:
    > `interface PromptContext { ..., webContext?: string, deepWebContext?: string }`  
    > `if (ctx.deepWebContext) append '# 외부 웹 본문 요약' section`  
    > `append rules: user docs > web, use [웹1], stale source => "~년 기준"`
  - `Key Variables`: `deepWebContext`, `webContext`, `sourceLabel`
  - `Safety`: `deepWebContext`가 없으면 기존 프롬프트와 동일 문자열을 유지한다.

- [ ] **ID(P5-03)**: Chat API Deep Reading 분기 통합
  - `Target`: `frontend/src/app/api/chat/route.ts` > `POST()`
  - `Logic (Pseudo)`:
    > `const useWebSearch = FEATURE_FLAGS.ENABLE_WEB_SEARCH_IN_CHAT && shouldPerformWebSearch(query)`  
    > `const useDeepReading = useWebSearch && FEATURE_FLAGS.ENABLE_DEEP_READING`  
    > `const webPromise = useDeepReading ? performDeepWebSearch(query, { userId, projectId, ragResultCount }) : performWebSearch(query)`  
    > `const [prefs, template, ragResult, webPayload] = await Promise.all([...])`
  - `Key Variables`: `useDeepReading`, `webPayload`, `webSources`, `deepWebContext`
  - `Safety`: `performDeepWebSearch()`가 throw하면 `performWebSearch(query)`를 1회 재시도하는 fallback 분기를 둔다.

- [ ] **ID(P5-04)**: Shadow Mode 분기 추가
  - `Target`: `route.ts` > `POST()`
  - `Logic (Pseudo)`:
    > `if (ENABLE_DEEP_READING_SHADOW_MODE)`  
    > `  [baseline, experimental] = await Promise.all([performWebSearch(query), performDeepWebSearch(query)])`  
    > `  activePayload = ENABLE_DEEP_READING ? experimental : baseline`  
    > `  void logDeepReadingShadowComparison(...)`
  - `Key Variables`: `baselinePayload`, `experimentalPayload`, `activePayload`
  - `Safety`: Shadow 로깅은 `void` 호출로 fire-and-forget, 실패해도 main response 영향 없음.

- [ ] **ID(P5-05)**: 상태 메시지/메타데이터 확장
  - `Target`: `route.ts` > `STATUS_MESSAGES`, assistant message metadata 저장 블록
  - `Logic (Pseudo)`:
    > `STATUS_MESSAGES.WEB_READING = '[STATUS]📖 웹 페이지 분석 중...\n'`  
    > `if (deep sources exist) controller.enqueue(WEB_READING)`  
    > `metadata.web_sources = deepSources.map(({ title, url, trustBadge, reliabilityScore, contentFreshness, snippetFallback }) => ...)`
  - `Key Variables`: `STATUS_MESSAGES.WEB_READING`, `metadata.web_sources`, `snippetFallback`
  - `Safety`: metadata 크기가 커지지 않게 `summaryText` 원문 저장 금지, 메타는 카드용 필드만 저장.

**Definition of Done (검증):**
- [ ] Test: `ENABLE_DEEP_READING=false`에서 기존 `performWebSearch()` 결과가 그대로 프롬프트에 들어가야 한다.
- [ ] Test: `ENABLE_DEEP_READING=true`에서 스트림 시작 후 `[STATUS]📖 웹 페이지 분석 중...` 상태가 전송되어야 한다.
- [ ] Test: Deep Reading 실패 시 응답이 500으로 끝나지 않고 스니펫 기반 답변으로 내려와야 한다.
- [ ] Review: `route.ts` 내부 `Promise.all` destructuring 순서와 실제 변수명이 일치하는지 확인한다.

---

## [Phase 6: 신뢰도 검증 + Citation Gate 확장]
**Before Start:**
- 주의: `citationGate.ts`의 `SIMILARITY_THRESHOLD = 0.7`은 기존 RAG 검증에 영향이 크다. 글로벌 하향 조정 금지.
- 주의: `verifyGroundedness()`의 기존 반환 타입(`GroundednessResult`)은 유지한다. 웹 검증은 별도 타입으로 확장한다.
- 회귀 테스트 포인트: 기존 문서 인용 `[1]`, `[참고 자료 1]` 검증은 계속 통과해야 한다.

**Implementation Items:**
- [ ] **ID(P6-01)**: 웹 출처 사전 검증 함수 추가
  - `Target`: `frontend/src/lib/rag/selfRAG.ts` > `WebSourceVerification`, `verifyWebSource()`
  - `Logic (Pseudo)`:
    > `trustScore = TRUST_BADGE_SCORE[trustBadge]`  
    > `freshnessScore = scoreFreshness(publishedAt)`  
    > `crossScore = crossVerified ? 1 : 0.5`  
    > `reliabilityScore = round((trustScore * 0.5) + (freshnessScore * 0.2) + (crossScore * 0.3), 2)`  
    > `return { reliabilityScore, crossVerified, contentFreshness, trustBadge }`
  - `Key Variables`: `trustScore`, `freshnessScore`, `crossVerified`, `reliabilityScore`
  - `Safety`: 날짜가 없으면 `contentFreshness='unknown'`, `freshnessScore=0.5` 기본값 사용.

- [ ] **ID(P6-02)**: Low-reliability 필터링 적용
  - `Target`: `deepWebSearchService.ts` > `filterVerifiedSources()`
  - `Logic (Pseudo)`:
    > `verified = sources.map(verifyWebSource)`  
    > `passed = verified.filter(source => source.reliabilityScore >= 0.55 || source.trustBadge in ['academic', 'government'])`  
    > `if (passed.length === 0) return buildSnippetFallbackResults(...)`
  - `Key Variables`: `verifiedSources`, `passedSources`, `minReliabilityScore`
  - `Safety`: 전부 탈락해도 빈 배열을 그대로 넘기지 말고 fallback sources를 만든다.

- [ ] **ID(P6-03)**: Citation Gate 웹 인용 지원
  - `Target`: `frontend/src/lib/rag/citationGate.ts` > `hasCitationMarkers()`, `countCitationMarkers()`, `verifyCitation()`
  - `Logic (Pseudo)`:
    > `const citationPattern = /\[\d+\]|\[참고\s*자료\s*\d+\]|\[웹\d+\]/g`  
    > `sourceChunks = [...ragChunks, ...webChunks]`  
    > `if (chunk.id startsWith 'web-') apply WEB_CITATION_BONUS = 0.10 else CITATION_MARKER_BONUS = 0.15`
  - `Key Variables`: `WEB_CITATION_BONUS`, `sourceChunks`, `webChunkId`
  - `Safety`: 웹 인용을 추가해도 기존 `[1]` 패턴 정규식이 깨지지 않게 backward compatible regex를 유지한다.

**Definition of Done (검증):**
- [ ] Test: 최신 academic source는 `reliabilityScore >= 0.7` 범위가 나와야 한다.
- [ ] Test: 날짜가 없는 일반 블로그 source도 함수가 throw하지 않고 `contentFreshness='unknown'`을 반환해야 한다.
- [ ] Test: `[웹1]` 마커가 포함된 응답에 대해 `hasCitationMarkers()`가 `true`를 반환해야 한다.
- [ ] Review: 기존 `citationGate.test.ts` 케이스가 깨지지 않도록 회귀 테스트를 추가했는지 확인한다.

---

## [Phase 7: 캐시 / 관측성 / 개인정보 보호]
**Before Start:**
- 주의: raw HTML/본문 전문을 DB에 저장하지 않는다.
- 주의: 로그 저장/캐시 저장 실패는 채팅 실패로 전파되면 안 된다.
- 회귀 테스트 포인트: 현재 `rag_logs` fire-and-forget 패턴과 동일한 실패 내성을 유지한다.

**Implementation Items:**
- [ ] **ID(P7-01)**: 웹 캐시 테이블 마이그레이션 추가
  - `Target`: `supabase/migrations/20260309xxxx_create_web_page_cache.sql`
  - `Logic (Pseudo)`:
    > `create table web_page_cache (url_hash text primary key, url text, summary text, page_type text, trust_badge text, metadata jsonb, expires_at timestamptz, created_at timestamptz default now())`
  - `Key Variables`: `url_hash`, `summary`, `expires_at`, `metadata`
  - `Safety`: `summary` 길이 제한, `raw_html` 컬럼 추가 금지.

- [ ] **ID(P7-02)**: 캐시 헬퍼 구현
  - `Target`: `frontend/src/lib/research/webPageCache.ts` > `getCachedWebPage()`, `setCachedWebPage()`, `hashUrl()`
  - `Logic (Pseudo)`:
    > `urlHash = sha256(normalizeUrl(url))`  
    > `cache = await supabase.from('web_page_cache').select(...).eq('url_hash', urlHash).single()`  
    > `if (cache.expires_at > now) return cache`  
    > `await upsert(summaryOnlyPayload)`
  - `Key Variables`: `urlHash`, `cachePayload`, `expiresAt`
  - `Safety`: DB 오류는 `logger.warn`만 남기고 `null` 반환.

- [ ] **ID(P7-03)**: 동적 TTL 정책 구현
  - `Target`: `webPageCache.ts` > `resolveCacheTTL()`
  - `Logic (Pseudo)`:
    > `if (pageType === 'news') return 6 * HOUR`  
    > `if (trustBadge === 'academic') return 7 * DAY`  
    > `if (contentFreshness === 'stale') return 3 * DAY`  
    > `return 24 * HOUR`
  - `Key Variables`: `HOUR`, `DAY`, `pageType`, `contentFreshness`
  - `Safety`: TTL 계산 실패 시 기본 `24h`.

- [ ] **ID(P7-04)**: 개인정보 마스킹 + Deep Reading 메트릭 로깅
  - `Target`: `frontend/src/lib/rag/search/logger.ts` > `logDeepReadingMetrics()`
  - `Logic (Pseudo)`:
    > `sanitizedQuery = sanitizeQueryForExternalSearch(query)`  
    > `metadata = { crawl_success_rate, fallback_rate, crawled_count, cache_hit, total_latency_ms, cost_estimate }`  
    > `await insert into rag_logs with search_method='deep_web_search'`
  - `Key Variables`: `sanitizedQuery`, `crawlSuccessRate`, `fallbackRate`, `costEstimate`
  - `Safety`: query에서 email/phone/uuid 패턴은 `[REDACTED]`로 치환한다.

**Definition of Done (검증):**
- [ ] Test: `web_page_cache`에는 원문 body/html이 아니라 summary만 저장되어야 한다.
- [ ] Test: Supabase insert 실패 시 채팅 응답은 계속 성공해야 한다.
- [ ] Test: news/article와 academic source의 TTL 값이 다르게 계산되어야 한다.
- [ ] Review: query masking helper가 외부 검색 호출 전과 로그 저장 전에 모두 재사용되는지 확인한다.

---

## [Phase 8: UI 투명성 + 상태 메시지 노출]
**Before Start:**
- 주의: `frontend/src/components/Assistant/chat/MessageItem.tsx`의 기존 `sources` 패널은 사용자 문서용이다. 웹 출처와 시각적으로 섞지 않는다.
- 주의: `useChat.ts`는 `[STATUS]` 접두사 기준으로 이미 필터링 중이다. 불필요한 로직 추가 금지.
- 회귀 테스트 포인트: 세션 재로딩 시 `metadata.web_sources`가 렌더링되어도 hydration 에러가 없어야 한다.

**Implementation Items:**
- [ ] **ID(P8-01)**: 웹 출처 메타데이터 타입 확장
  - `Target`: `frontend/src/components/Assistant/chat/MessageItem.tsx` > `Message['metadata']['web_sources']`
  - `Logic (Pseudo)`:
    > `web_sources?: Array<{ title; url; source; trustBadge; reliabilityScore; contentFreshness; snippetFallback }>`
  - `Key Variables`: `reliabilityScore`, `contentFreshness`, `snippetFallback`
  - `Safety`: 기존 세션 데이터에는 새 필드가 없을 수 있으므로 모두 optional 처리한다.

- [ ] **ID(P8-02)**: WebSourcesPanel 고도화
  - `Target`: `MessageItem.tsx` > `WebSourcesPanel()`
  - `Logic (Pseudo)`:
    > `render badgeIcon(trustBadge)`  
    > `render freshnessLabel(contentFreshness)`  
    > `render reliabilityScore as percent`  
    > `if (snippetFallback) show '스니펫 대체' chip`
  - `Key Variables`: `freshnessLabel`, `reliabilityLabel`, `isSnippetFallback`
  - `Safety`: `reliabilityScore`가 없으면 `N/A` 표기, 링크는 항상 `rel="noopener noreferrer"` 유지.

- [ ] **ID(P8-03)**: 상태 메시지 호환성 확인
  - `Target`: `frontend/src/hooks/useChat.ts` > `STATUS_PREFIX` 처리 루프
  - `Logic (Pseudo)`:
    > `if (line.startsWith('[STATUS]')) setStatusText(...)`  
    > `// WEB_READING 추가는 별도 코드 수정 없이 동작해야 함`  
    > `only patch if line parser drops multi-line chunks`
  - `Key Variables`: `STATUS_PREFIX`, `statusText`, `contentToAdd`
  - `Safety`: 변경이 필요 없다면 “코드 변경 없음”으로 남기고 회귀 테스트만 수행한다.

**Definition of Done (검증):**
- [ ] Test: assistant 메시지 하단에 사용자 문서 `📚` 패널과 웹 출처 `🌐` 패널이 분리되어 렌더링되어야 한다.
- [ ] Test: `snippetFallback=true`인 출처는 UI에 명시적으로 표시되어야 한다.
- [ ] Test: `[STATUS]📖 웹 페이지 분석 중...` 메시지가 본문에 섞이지 않고 상태 텍스트로만 노출되어야 한다.
- [ ] Review: 기존 `SourcesPanel` 스타일을 깨뜨리지 않았는지, 다크모드 클래스 누락이 없는지 확인한다.

---

## [Phase 9: 테스트 / 롤아웃 / 종료 조건]
**Before Start:**
- 주의: 모든 신규 파일 구현 후 검증을 수행한다. 테스트 없이 플래그 on 금지.
- 주의: 프로덕션 롤아웃은 `ENABLE_DEEP_READING_SHADOW_MODE=true` 단계부터 시작한다.
- 회귀 테스트 포인트: `ENABLE_DEEP_READING=false` 상태의 기존 채팅 시나리오가 모두 유지되어야 한다.

**Implementation Items:**
- [ ] **ID(P9-01)**: 단위 테스트 추가
  - `Target`: `frontend/src/lib/research/__tests__/webCrawler.test.ts`, `contentExtractor.test.ts`, `webContentSummarizer.test.ts`, `frontend/src/lib/services/chat/__tests__/deepWebSearchService.test.ts`
  - `Logic (Pseudo)`:
    > `mock fetch/Jina/LLM`  
    > `assert partial failure returns partial success`  
    > `assert private url blocked`  
    > `assert summary fallback works`
  - `Key Variables`: `mockFetch`, `mockGenerateText`, `expectedFallback`
  - `Safety`: 외부 네트워크 없이 테스트 가능해야 한다.

- [ ] **ID(P9-02)**: 통합 검증 시나리오 추가
  - `Target`: `frontend/src/app/api/chat/route.ts` 관련 수동/통합 테스트 문서
  - `Logic (Pseudo)`:
    > `Scenario A = 최신 뉴스 질문 + 웹검색 키워드`  
    > `Scenario B = 학술 질문 + Tavily 포함`  
    > `Scenario C = 사용자 문서 + 웹 정보 충돌`  
    > `Scenario D = 크롤링 전부 실패`  
    > `Scenario E = shadow mode only`
  - `Key Variables`: `scenarioId`, `expectedStatusMessages`, `expectedMetadata`
  - `Safety`: 충돌 시나리오에서 “사용자 문서 우선” 규칙이 깨지지 않아야 한다.

- [ ] **ID(P9-03)**: 빌드/테스트/롤아웃 체크
  - `Target`: `frontend/package.json` scripts 기준 운영 검증
  - `Logic (Pseudo)`:
    > `cd frontend && npm run test`  
    > `cd frontend && npm run build`  
    > `shadow mode on -> 5% traffic -> 25% traffic -> 100% traffic`  
    > `if crawl_success_rate < 70% or p95_latency_ms > 8000 => rollback`
  - `Key Variables`: `crawl_success_rate`, `p95_latency_ms`, `citation_pass_rate`, `cost_per_request`
  - `Safety`: 롤아웃 단계마다 `ENABLE_DEEP_READING=false` 즉시 복귀 절차를 문서화한다.

**Definition of Done (검증):**
- [ ] Test: `cd frontend && npm run test` 통과
- [ ] Test: `cd frontend && npm run build` 통과
- [ ] Test: Scenario A~E 수동 테스트 완료
- [ ] Test: Shadow Mode 1일 운영 후 `crawl_success_rate >= 80%`, `citation_pass_rate >= 85%`, `p95_latency_ms <= 8000`
- [ ] Review: 불필요한 `console.log` 제거, 신규 함수에 최소 주석 추가, `ENABLE_DEEP_READING=false` 롤백 절차 문서화 완료

---

## 예상 변경 파일 총괄

| 구분 | 파일 | 작업 |
| --- | --- | --- |
| 신규 | `frontend/src/lib/research/webCrawler.ts` | Jina + Readability 폴백 크롤러 |
| 신규 | `frontend/src/lib/research/contentExtractor.ts` | 본문 정제 / 구조화 / 인젝션 필터 |
| 신규 | `frontend/src/lib/research/webContentSummarizer.ts` | 웹 본문 요약 |
| 신규 | `frontend/src/lib/research/webPageCache.ts` | 캐시 헬퍼 |
| 신규 | `frontend/src/lib/services/chat/deepWebSearchService.ts` | Deep Reading 오케스트레이터 |
| 신규 | `frontend/src/lib/research/__tests__/webCrawler.test.ts` | 단위 테스트 |
| 신규 | `frontend/src/lib/research/__tests__/contentExtractor.test.ts` | 단위 테스트 |
| 신규 | `frontend/src/lib/research/__tests__/webContentSummarizer.test.ts` | 단위 테스트 |
| 신규 | `frontend/src/lib/services/chat/__tests__/deepWebSearchService.test.ts` | 단위 테스트 |
| 수정 | `frontend/package.json` | 런타임 의존성 정리 |
| 수정 | `frontend/src/config/featureFlags.ts` | Deep Reading 플래그 추가 |
| 수정 | `frontend/src/config/llm-usage-map.ts` | `web.crawl.summarize` 컨텍스트 추가 |
| 수정 | `frontend/src/lib/services/chat/index.ts` | barrel export 추가 |
| 수정 | `frontend/src/lib/services/chat/promptBuilder.ts` | Deep Reading 프롬프트 확장 |
| 수정 | `frontend/src/app/api/chat/route.ts` | Deep Reading 통합 / Shadow Mode / 상태 메시지 |
| 수정 | `frontend/src/lib/rag/selfRAG.ts` | `verifyWebSource()` 추가 |
| 수정 | `frontend/src/lib/rag/citationGate.ts` | `[웹N]` 인용 검증 지원 |
| 수정 | `frontend/src/lib/rag/search/logger.ts` | Deep Reading 메트릭 로깅 |
| 수정 | `frontend/src/lib/rag/shadowModeLogger.ts` | AS-IS vs TO-BE 비교 로깅 |
| 수정 | `frontend/src/components/Assistant/chat/MessageItem.tsx` | 웹 출처 UI 확장 |
| 신규 | `supabase/migrations/20260309xxxx_create_web_page_cache.sql` | 캐시 테이블 생성 |

---

**문서 끝**
