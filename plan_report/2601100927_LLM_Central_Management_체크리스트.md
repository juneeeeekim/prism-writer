# LLM 중앙 관리 시스템 마이그레이션 구현 체크리스트

**문서 번호**: DEV-2026-0110-IMPL
**작성일**: 2026-01-10
**작성자**: Antigravity (Tech Lead)
**원본 설계**: `2601100922_LLM_Central_Management_Migration.md`
**상태**: 🚧 구현 대기

---

## [Phase 1: LLM Usage Map 타입 및 매핑 확장]

**Before Start:**

- ⚠️ 주의: 기존 `LLMUsageContext` 타입에 새 값 추가 시, 기존 코드(`templateGates.ts`, `ruleMiner.ts` 등)에 영향 없음 확인
- ⚠️ 주의: `LLM_USAGE_MAP` 객체에 새 키 추가 시 TypeScript가 누락 체크함 (Record 타입)

---

### P1-01: LLMUsageContext 타입 확장

- [ ] **ID(P1-01-A)**: 새 컨텍스트 타입 추가
  - `Target`: `frontend/src/config/llm-usage-map.ts` > `type LLMUsageContext`
  - `Logic (Pseudo)`:
    ```typescript
    export type LLMUsageContext =
      | "rag.answer" // 기존
      | "rag.reviewer" // 기존
      | "rag.reranker" // 기존
      // ... 기존 컨텍스트 유지 ...
      // ===== 신규 추가 =====
      | "suggest.completion" // Shadow Writer
      | "rag.selfrag" // Self-RAG 검증
      | "rag.chunking" // Agentic Chunking
      | "rag.rerank" // rerank.ts 전용 (기존 reranker와 구분)
      | "research.query" // Deep Scholar 쿼리 생성
      | "research.summarize" // Deep Scholar 요약
      | "pattern.extraction" // 패턴 추출
      | "judge.align" // 개별 평가
      | "judge.holistic" // 종합 평가
      | "outline.generation" // 목차 생성
      | "ocr.vision"; // OCR 비전
    ```
  - `Key Variables`: `LLMUsageContext` (Union Type)
  - `Safety`: 기존 타입 값 절대 수정 금지

---

### P1-02: LLM_USAGE_MAP 매핑 데이터 추가

- [ ] **ID(P1-02-A)**: 신규 컨텍스트 매핑 추가
  - `Target`: `frontend/src/config/llm-usage-map.ts` > `LLM_USAGE_MAP`
  - `Logic (Pseudo)`:
    ```typescript
    export const LLM_USAGE_MAP: Record<LLMUsageContext, UsageConfig> = {
      // ... 기존 매핑 유지 ...

      // ===== 신규 추가 =====
      "suggest.completion": {
        modelId: "gemini-1.5-flash",
        maxTokens: 100,
        description: "Shadow Writer 문장 완성 제안",
      },
      "rag.selfrag": {
        modelId: "gemini-1.5-flash",
        description: "Self-RAG 검색 필요도/관련도/근거 검증",
      },
      "rag.chunking": {
        modelId: "gemini-1.5-flash",
        description: "Agentic Chunking 분할점 분석",
      },
      "rag.rerank": {
        modelId: "gemini-1.5-flash",
        description: "검색 결과 재순위 (rerank.ts 전용)",
      },
      "research.query": {
        modelId: "gemini-1.5-flash",
        maxTokens: 50,
        description: "Deep Scholar 검색 쿼리 생성",
      },
      "research.summarize": {
        modelId: "gemini-1.5-flash",
        maxTokens: 200,
        description: "Deep Scholar 검색 결과 요약",
      },
      "pattern.extraction": {
        modelId: "gemini-3-flash-preview",
        description: "문서 패턴 추출",
      },
      "judge.align": {
        modelId: "gemini-3-flash-preview",
        description: "개별 항목 평가 (Align Judge)",
      },
      "judge.holistic": {
        modelId: "gemini-3-flash-preview",
        description: "종합 평가 (Holistic Advisor)",
      },
      "outline.generation": {
        modelId: "gemini-3-flash-preview",
        description: "목차 생성",
      },
      "ocr.vision": {
        modelId: "gemini-1.5-flash",
        description: "OCR 이미지 텍스트 추출",
      },
    };
    ```
  - `Key Variables`: `LLM_USAGE_MAP`, `UsageConfig`
  - `Safety`: TypeScript가 누락된 컨텍스트 자동 감지 (Record 타입)

---

**Definition of Done (Phase 1):**

- [ ] Test: `npx tsc --noEmit` 성공 (타입 에러 없음)
- [ ] Test: `getModelForUsage('suggest.completion')` 호출 시 `'gemini-1.5-flash'` 반환
- [ ] Test: `getModelForUsage('judge.align')` 호출 시 `'gemini-3-flash-preview'` 반환
- [ ] Review: 모든 신규 컨텍스트에 `description` 작성 완료

---

## [Phase 2: 개별 파일 마이그레이션]

**Before Start:**

- ⚠️ 주의: 각 파일의 기존 동작(LLM 응답 처리 로직)은 수정 금지
- ⚠️ 주의: `import` 경로 오타 주의: `'@/config/llm-usage-map'`
- ⚠️ 주의: 환경 변수 기반 모델 선택 로직이 있다면 제거하지 말고, `getModelForUsage()` 결과를 기본값으로 사용

---

### P2-01: Shadow Writer API 마이그레이션

- [ ] **ID(P2-01-A)**: suggest/route.ts 마이그레이션
  - `Target`: `frontend/src/app/api/suggest/route.ts` > LLM 호출 부분
  - `Logic (Pseudo)`:

    ```typescript
    // Before (Line 228)
    model: 'gemini-1.5-flash',

    // After
    import { getModelForUsage } from '@/config/llm-usage-map';
    // ...
    model: getModelForUsage('suggest.completion'),
    ```

  - `Key Variables`: `getModelForUsage`, `'suggest.completion'`
  - `Safety`:
    - `try-catch` 기존 유지
    - 빈 suggestion 반환 로직 유지

---

### P2-02: Self-RAG 마이그레이션 (3곳)

- [ ] **ID(P2-02-A)**: selfRAG.ts Line 117 마이그레이션

  - `Target`: `frontend/src/lib/rag/selfRAG.ts` > `checkRetrievalNecessity()`
  - `Logic (Pseudo)`:

    ```typescript
    // Before
    const modelId = model === "gemini" ? "gemini-1.5-flash" : "gpt-4o-mini";

    // After
    import { getModelForUsage } from "@/config/llm-usage-map";
    // ...
    const modelId = getModelForUsage("rag.selfrag");
    // Note: OpenAI fallback 제거됨 (중앙 관리에서 통일)
    ```

  - `Key Variables`: `modelId`, `getModelForUsage`
  - `Safety`: `options.model` 파라미터 존재 시 그대로 사용

- [ ] **ID(P2-02-B)**: selfRAG.ts Line 198 마이그레이션

  - `Target`: `frontend/src/lib/rag/selfRAG.ts` > `critiqueRetrievalResults()`
  - `Logic (Pseudo)`: P2-02-A와 동일 패턴 적용
  - `Key Variables`: `modelId`

- [ ] **ID(P2-02-C)**: selfRAG.ts Line 323 마이그레이션
  - `Target`: `frontend/src/lib/rag/selfRAG.ts` > `verifyGroundedness()`
  - `Logic (Pseudo)`: P2-02-A와 동일 패턴 적용
  - `Key Variables`: `modelId`

---

### P2-03: Rerank 마이그레이션

- [ ] **ID(P2-03-A)**: rerank.ts 마이그레이션
  - `Target`: `frontend/src/lib/rag/rerank.ts` > `rerankWithLLM()`
  - `Logic (Pseudo)`:

    ```typescript
    // Before (Line 219-223)
    const modelId = model === "gemini" ? "gemini-1.5-flash" : "gpt-4o-mini";

    // After
    import { getModelForUsage } from "@/config/llm-usage-map";
    // ...
    const modelId = getModelForUsage("rag.rerank");
    ```

  - `Key Variables`: `modelId`, `'rag.rerank'`
  - `Safety`: 기존 `timeout` 로직 유지

---

### P2-04: Agentic Chunking 마이그레이션

- [ ] **ID(P2-04-A)**: agenticChunking.ts 마이그레이션
  - `Target`: `frontend/src/lib/rag/agenticChunking.ts` > `callLLMForChunks()`
  - `Logic (Pseudo)`:

    ```typescript
    // Before (Line 180)
    const modelId = model === "gemini" ? "gemini-1.5-flash" : "gpt-4o-mini";

    // After
    import { getModelForUsage } from "@/config/llm-usage-map";
    // ...
    const modelId = getModelForUsage("rag.chunking");
    ```

  - `Key Variables`: `modelId`, `'rag.chunking'`
  - `Safety`: fallback 로직(`semanticChunk`) 유지

---

### P2-05: Research Query Generator 마이그레이션

- [ ] **ID(P2-05-A)**: queryGenerator.ts 마이그레이션
  - `Target`: `frontend/src/lib/research/queryGenerator.ts` > `generateSearchQuery()`
  - `Logic (Pseudo)`:

    ```typescript
    // Before (Line 125)
    model: 'gemini-1.5-flash',

    // After
    import { getModelForUsage } from '@/config/llm-usage-map';
    // ...
    model: getModelForUsage('research.query'),
    ```

  - `Key Variables`: `'research.query'`
  - `Safety`: `maxOutputTokens: 50` 유지

---

### P2-06: Research Result Summarizer 마이그레이션

- [ ] **ID(P2-06-A)**: resultSummarizer.ts 마이그레이션
  - `Target`: `frontend/src/lib/research/resultSummarizer.ts` > `summarizeResult()`
  - `Logic (Pseudo)`:

    ```typescript
    // Before (Line 191)
    model: 'gemini-1.5-flash',

    // After
    import { getModelForUsage } from '@/config/llm-usage-map';
    // ...
    model: getModelForUsage('research.summarize'),
    ```

  - `Key Variables`: `'research.summarize'`
  - `Safety`: `maxOutputTokens: 200` 유지

---

### P2-07: Pattern Extractor 마이그레이션

- [ ] **ID(P2-07-A)**: patternExtractor.ts 마이그레이션
  - `Target`: `frontend/src/lib/rag/patternExtractor.ts` > LLM 호출 부분
  - `Logic (Pseudo)`:

    ```typescript
    // Before (Line 101)
    model: 'gemini-3-flash-preview',

    // After
    import { getModelForUsage } from '@/config/llm-usage-map';
    // ...
    model: getModelForUsage('pattern.extraction'),
    ```

  - `Key Variables`: `'pattern.extraction'`
  - `Safety`: 패턴 파싱 로직 유지

---

### P2-08: Align Judge 마이그레이션

- [ ] **ID(P2-08-A)**: alignJudge.ts 마이그레이션
  - `Target`: `frontend/src/lib/judge/alignJudge.ts` > `evaluateAlignment()`
  - `Logic (Pseudo)`:

    ```typescript
    // Before (Line 57)
    const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });

    // After
    import { getModelForUsage } from "@/config/llm-usage-map";
    // ...
    const model = genAI.getGenerativeModel({
      model: getModelForUsage("judge.align"),
    });
    ```

  - `Key Variables`: `genAI`, `'judge.align'`
  - `Safety`: `@google/generative-ai` SDK 직접 사용이므로 패턴 주의

---

### P2-09: Holistic Advisor 마이그레이션

- [ ] **ID(P2-09-A)**: holisticAdvisor.ts 마이그레이션
  - `Target`: `frontend/src/lib/judge/holisticAdvisor.ts` > `generateHolisticAdvice()`
  - `Logic (Pseudo)`:

    ```typescript
    // Before (Line 231)
    const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });

    // After
    import { getModelForUsage } from "@/config/llm-usage-map";
    // ...
    const model = genAI.getGenerativeModel({
      model: getModelForUsage("judge.holistic"),
    });
    ```

  - `Key Variables`: `genAI`, `'judge.holistic'`
  - `Safety`: P2-08-A와 동일 패턴

---

### P2-10: Outline API 마이그레이션

- [ ] **ID(P2-10-A)**: outline/route.ts 마이그레이션
  - `Target`: `frontend/src/app/api/outline/route.ts` > 상수 및 호출부
  - `Logic (Pseudo)`:

    ```typescript
    // Before (Line 57)
    const MODEL_NAME = "gemini-3-flash-preview";

    // After
    import { getModelForUsage } from "@/config/llm-usage-map";
    // ...
    const MODEL_NAME = getModelForUsage("outline.generation");
    ```

  - `Key Variables`: `MODEL_NAME`, `'outline.generation'`
  - `Safety`: `genAI.getGenerativeModel` 호출 시 MODEL_NAME 사용 유지

---

### P2-11: OCR Vision 마이그레이션

- [ ] **ID(P2-11-A)**: geminiVision.ts 마이그레이션
  - `Target`: `frontend/src/lib/ocr/geminiVision.ts` > 상수
  - `Logic (Pseudo)`:

    ```typescript
    // Before (Line 53)
    const GEMINI_VISION_MODEL = "gemini-1.5-flash";

    // After
    import { getModelForUsage } from "@/config/llm-usage-map";
    // ...
    const GEMINI_VISION_MODEL = getModelForUsage("ocr.vision");
    ```

  - `Key Variables`: `GEMINI_VISION_MODEL`, `'ocr.vision'`
  - `Safety`: Vision API 멀티모달 지원 모델 확인 필요 (gemini-1.5-flash는 지원함)

---

**Definition of Done (Phase 2):**

- [ ] Test: `npm run build` 성공 (에러 없음)
- [ ] Test: Shadow Writer API 호출 시 정상 응답 (Ghost Text 표시)
- [ ] Test: Deep Scholar 검색 시 정상 요약 표시
- [ ] Test: 평가 탭에서 개별/종합 평가 정상 동작
- [ ] Review: 모든 마이그레이션 파일에 주석 추가
  - 형식: `// [LLM-CENTRAL] 중앙 관리 전환 (2026-01-10)`
- [ ] Review: 불필요한 `console.log` 제거

---

## [Phase 3: 검증 및 배포]

**Before Start:**

- ⚠️ 주의: 프로덕션 배포 전 스테이징 환경에서 전체 기능 테스트
- ⚠️ 주의: 롤백 계획 수립 (git revert 커밋 해시 기록)

---

### P3-01: 통합 검증

- [ ] **ID(P3-01-A)**: 타입 체크

  - `Command`: `npx tsc --noEmit`
  - `Expected`: Exit code 0

- [ ] **ID(P3-01-B)**: 빌드 검증

  - `Command`: `npm run build`
  - `Expected`: Exit code 0, 새 chunk 생성 확인

- [ ] **ID(P3-01-C)**: 중앙 관리 상태 출력
  - `Command`: 브라우저 콘솔에서 `printUsageMap()` 호출
  - `Expected`: 모든 신규 컨텍스트가 표시됨

---

### P3-02: 기능별 회귀 테스트

- [ ] **ID(P3-02-A)**: Shadow Writer 테스트

  - `Action`: 에디터에서 10자 이상 입력 후 대기
  - `Expected`: Ghost Text 표시 / Tab 키 수락 동작

- [ ] **ID(P3-02-B)**: Deep Scholar 테스트

  - `Action`: 근거 찾기 탭에서 검색 실행
  - `Expected`: 검색 결과 및 요약 표시

- [ ] **ID(P3-02-C)**: 평가 테스트

  - `Action`: 평가 탭에서 종합 평가 실행
  - `Expected`: 정상 평가 결과 표시

- [ ] **ID(P3-02-D)**: 목차 생성 테스트
  - `Action`: 구조 탭에서 AI 구조 분석 실행
  - `Expected`: 정상 분석 결과 표시

---

### P3-03: 배포

- [ ] **ID(P3-03-A)**: Git 커밋

  - `Command`:
    ```bash
    git add .
    git commit -m "refactor(llm): Migrate all LLM usages to central management system"
    ```
  - `Commit Hash`: (기록 필요 - 롤백용)

- [ ] **ID(P3-03-B)**: Git 푸시 및 배포
  - `Command`: `git push`
  - `Expected`: Vercel 자동 배포 시작

---

**Definition of Done (Phase 3):**

- [ ] Test: Vercel 배포 성공 (빌드 로그 확인)
- [ ] Test: 프로덕션에서 Shadow Writer 정상 동작
- [ ] Test: 프로덕션에서 평가/목차/Deep Scholar 정상 동작
- [ ] Review: Vercel 로그에 `알 수 없는 모델 ID` 에러 없음

---

## 📌 롤백 계획

```bash
# 문제 발생 시 즉시 롤백
git revert <commit-hash>
git push
```

---

## ✅ 최종 완료 기준

- [ ] 모든 LLM 호출이 `getModelForUsage()` 사용
- [ ] `grep -r "model: 'gemini"` 결과가 `llm-usage-map.ts`와 `models.ts`만 나옴
- [ ] 모델 변경 테스트: `LLM_USAGE_MAP`에서 모델 ID 하나만 바꾸면 전체 반영됨

---

**작성자**: Antigravity (Tech Lead)
**예상 소요 시간**: 3.5시간
**우선순위**: 🔴 높음
