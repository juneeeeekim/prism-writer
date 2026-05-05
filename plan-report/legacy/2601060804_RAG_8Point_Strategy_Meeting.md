# RAG 시스템 8점 도달을 위한 전문가 아이디어 회의록

> **문서 ID**: 2601060804_RAG_8Point_Strategy_Meeting  
> **작성일**: 2026-01-06 08:04  
> **참석자**: 시니어 개발자(Tech Lead), 주니어 개발자, UX/UI 전문가, ML 엔지니어, 데이터 엔지니어  
> **목적**: 현재 6.8점 → 8점 달성을 위한 구체적 개선 아이디어 수집

---

## 회의 배경

PRISM Writer RAG 시스템 평가 결과 **6.8/10점**으로 중급-상급 수준으로 평가됨.
대기업 수준(8점+) 도달을 위해 **Cross-Encoder 도입**과 **정량 평가 체계 구축**이 필요.

---

## 1. 시니어 개발자 (Tech Lead) 의견

### 🎯 Cross-Encoder 도입 전략

**옵션 A: Cohere Rerank API (권장)**

```
장점:
- 즉시 사용 가능 (API 호출만으로 구현)
- 다국어 지원 (한글 포함)
- Rerank 3.5 모델 정확도 업계 최고 수준

단점:
- 비용 발생 ($1/1000 queries 예상)
- 외부 의존성 증가

구현 난이도: ⭐⭐ (2일)
예상 점수 향상: +0.8점
```

**옵션 B: Self-hosted BGE-reranker**

```
장점:
- 비용 없음 (오픈소스)
- 데이터 프라이버시 보장

단점:
- GPU 서버 필요 (월 $50~100)
- 배포/관리 복잡도 증가

구현 난이도: ⭐⭐⭐⭐ (2주)
예상 점수 향상: +0.7점
```

### 🎯 기존 LLM Re-ranking과 병용 전략

```typescript
// 제안: 2단계 Re-ranking
async function twoStageRerank(results: SearchResult[]) {
  // Stage 1: 빠른 Cross-Encoder (상위 50개 → 20개)
  const stage1 = await cohereRerank(results.slice(0, 50), { topK: 20 });

  // Stage 2: LLM 정밀 평가 (상위 20개 → 5개, 선택적)
  if (FEATURE_FLAGS.ENABLE_LLM_RERANK) {
    return await llmRerank(stage1, { topK: 5 });
  }
  return stage1.slice(0, 5);
}
```

---

## 2. 주니어 개발자 의견

### 🎯 MRR/NDCG 측정 자동화

**문제**: 현재 정량 평가 체계 부재로 개선 효과 측정 불가

**제안: 테스트 쿼리셋 구축**

```typescript
// test-queries.json 예시
[
  {
    query: "문장 시작에 사용하는 후킹 기법",
    expected_doc_ids: ["doc-123", "doc-456"],
    expected_chunk_ids: ["chunk-789"],
  },
  {
    query: "독자의 관심을 끄는 방법",
    expected_doc_ids: ["doc-123"],
    expected_chunk_ids: ["chunk-111", "chunk-222"],
  },
  // ... 50개 이상 권장
];
```

**MRR 계산 스크립트**

```typescript
function calculateMRR(results: SearchResult[], expected: string[]): number {
  for (let i = 0; i < results.length; i++) {
    if (expected.includes(results[i].chunkId)) {
      return 1 / (i + 1); // Reciprocal Rank
    }
  }
  return 0;
}

// 전체 쿼리셋 평균
const avgMRR =
  queries.reduce((sum, q) => {
    const results = await hybridSearch(q.query, options);
    return sum + calculateMRR(results, q.expected_chunk_ids);
  }, 0) / queries.length;
```

**예상 구현 시간**: 3일
**예상 점수 향상**: +0.5점 (측정 가능 → 지속 개선 가능)

---

## 3. ML 엔지니어 의견

### 🎯 한글 형태소 분석 도입

**현재 문제**: PostgreSQL `simple` config는 한글을 공백 기준으로만 토큰화

**예시**:

- 쿼리: "문장력 향상"
- 현재 토큰: ["문장력", "향상"]
- 이상적 토큰: ["문장", "력", "향상", "문장력"] (복합어 분해)

**해결 방안**:

**옵션 A: Supabase Edge Function + mecab-ko**

```
- Deno에서 mecab 실행
- 검색 전 쿼리 전처리
- 비용: 무료 (Edge Function 범위 내)
```

**옵션 B: 외부 형태소 분석 API**

```
- Kakao Karlo API 또는 Naver CLOVA
- 안정성 높음
- 비용: 월 $10~30
```

**옵션 C: 클라이언트 사이드 Wasm (koalanlp)**

```
- 서버 의존성 없음
- 브라우저에서 형태소 분석
- 번들 크기 증가 (~2MB)
```

**권장**: 옵션 A (비용 0, 구현 복잡도 중간)

---

## 4. UX/UI 전문가 의견

### 🎯 검색 품질 피드백 UI

**문제**: 현재 사용자가 검색 품질을 평가할 방법 없음

**제안: Implicit Feedback 수집**

```
1. 검색 결과 클릭률 (CTR) 측정
2. "도움이 되었나요?" 👍👎 버튼 추가
3. 결과 재정렬 시 드래그 순서 저장
```

**제안: 검색 결과 품질 표시**

```
현재 검색 점수: 78/100
  ┌─────────────────────────────────────┐
  │ ████████████████░░░░ 78%           │
  └─────────────────────────────────────┘
  - 관련성: 높음 ✓
  - 신선도: 중간
  - 인용 가능: 높음 ✓
```

**예상 효과**: 사용자 만족도 향상 + 개선 데이터 확보

---

## 5. 데이터 엔지니어 의견

### 🎯 Ground Truth 데이터셋 구축

**문제**: MRR/NDCG 측정을 위한 정답 데이터 부재

**제안: 3단계 구축 전략**

```
Phase 1: 수동 레이블링 (1주)
- 핵심 쿼리 50개 선정
- 각 쿼리별 관련 문서/청크 수동 태깅
- 관련성 점수 (0: 무관, 1: 관련, 2: 매우 관련)

Phase 2: LLM 어시스트 (2주)
- GPT-4o로 관련성 자동 평가
- 인간 검토로 품질 보장
- 500개 쿼리셋 확보 목표

Phase 3: 사용자 피드백 통합 (지속)
- 실제 사용 데이터 기반 확장
- A/B 테스트 결과 반영
```

**데이터베이스 스키마 제안**:

```sql
CREATE TABLE search_ground_truth (
  id UUID PRIMARY KEY,
  query TEXT NOT NULL,
  relevant_chunk_ids UUID[] NOT NULL,
  relevance_scores FLOAT[] NOT NULL,  -- 각 청크별 관련성 점수
  created_by UUID REFERENCES auth.users,
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## 6. 우선순위 합의

| 순위 | 작업                   | 담당          | 예상 점수 | 기간 |
| ---- | ---------------------- | ------------- | --------- | ---- |
| 🥇 1 | Cohere Rerank API 도입 | 시니어        | +0.8      | 2일  |
| 🥈 2 | Ground Truth 50개 구축 | 데이터/주니어 | +0.3      | 3일  |
| 🥉 3 | MRR/NDCG 자동 측정     | 주니어        | +0.2      | 2일  |
| 4    | 한글 형태소 분석       | ML            | +0.3      | 1주  |
| 5    | 피드백 UI              | UX            | -         | 1주  |

**예상 최종 점수**: 6.8 + 0.8 + 0.3 + 0.2 = **8.1/10** ✅

---

## 7. 💰 무료 vs 유료 상세 비교

---

## PART A: 무료로 8점 도달하는 방법

### A-1. Cross-Encoder: BGE-reranker (오픈소스)

| 항목          | 내용                                           |
| ------------- | ---------------------------------------------- |
| **구현 방식** | Hugging Face `BAAI/bge-reranker-base` 사용     |
| **비용**      | **무료** (Hugging Face 무료 티어 월 1000 요청) |
| **예상 점수** | +0.7점                                         |
| **구현 기간** | 1주일                                          |

```typescript
// 무료 구현 예시
import { pipeline } from "@xenova/transformers";

const reranker = await pipeline(
  "text-classification",
  "BAAI/bge-reranker-base"
);

async function rerankWithBGE(query: string, docs: SearchResult[]) {
  const pairs = docs.map((d) => ({ text: query, text_pair: d.content }));
  const scores = await reranker(pairs);
  return docs
    .map((d, i) => ({ ...d, score: scores[i].score }))
    .sort((a, b) => b.score - a.score);
}
```

**장점**:

- ✅ 완전 무료
- ✅ 데이터가 외부로 전송되지 않음 (프라이버시)
- ✅ 오프라인 환경에서도 동작
- ✅ 커스터마이징 가능 (fine-tuning)

**단점**:

- ⚠️ 초기 로딩 시간 (모델 다운로드)
- ⚠️ 서버 메모리 사용량 증가 (~500MB)
- ⚠️ Cohere 대비 정확도 약 5-10% 낮음
- ⚠️ 한글 성능이 Cohere보다 떨어질 수 있음

---

### A-2. 한글 형태소: n-gram 방식 (자체 구현)

| 항목          | 내용                     |
| ------------- | ------------------------ |
| **구현 방식** | 2-gram, 3-gram 토큰 생성 |
| **비용**      | **무료**                 |
| **예상 점수** | +0.2점                   |
| **구현 기간** | 3일                      |

```typescript
const tokenize = (text: string): string[] => {
  const words = text.split(/\s+/);
  const ngrams: string[] = [];

  words.forEach((word) => {
    for (let n = 2; n <= Math.min(3, word.length); n++) {
      for (let i = 0; i <= word.length - n; i++) {
        ngrams.push(word.slice(i, i + n));
      }
    }
    ngrams.push(word);
  });

  return [...new Set(ngrams)];
};
```

**장점**:

- ✅ 완전 무료
- ✅ 외부 의존성 없음
- ✅ 빠른 처리 속도

**단점**:

- ⚠️ 정확한 형태소 분석 아님
- ⚠️ 노이즈 토큰 발생 가능
- ⚠️ 전문 형태소 분석기 대비 정확도 30% 낮음

---

### A-3. MRR/NDCG 측정: 직접 스크립트 구현

| 항목          | 내용                           |
| ------------- | ------------------------------ |
| **구현 방식** | 테스트 쿼리셋 + 평가 스크립트  |
| **비용**      | **무료**                       |
| **예상 점수** | +0.2점 (측정 가능 → 지속 개선) |
| **구현 기간** | 2일                            |

**장점**:

- ✅ 완전 무료
- ✅ 우리 데이터에 최적화된 평가 가능
- ✅ CI/CD 파이프라인에 통합 가능

**단점**:

- ⚠️ Ground Truth 수동 구축 필요 (노동 집약적)
- ⚠️ 평가 대시보드 직접 구축 필요

---

### 🆓 무료 로드맵 총합

| 항목              | 점수 기여        | 비용     | 기간         |
| ----------------- | ---------------- | -------- | ------------ |
| BGE-reranker      | +0.7             | 무료     | 1주          |
| n-gram 토큰화     | +0.2             | 무료     | 3일          |
| MRR 측정          | +0.2             | 무료     | 2일          |
| Ground Truth 50개 | +0.1             | 무료     | 3일          |
| **합계**          | **+1.2 → 8.0점** | **무료** | **약 2.5주** |

---

## PART B: 유료로 8점 도달하는 방법

### B-1. Cross-Encoder: Cohere Rerank API

| 항목          | 내용                                |
| ------------- | ----------------------------------- |
| **구현 방식** | Cohere Rerank 3.5 API 호출          |
| **비용**      | **$1 / 1000 요청** (월 예상 $10-50) |
| **예상 점수** | +0.8점                              |
| **구현 기간** | 2일                                 |

```typescript
// 유료 구현 예시
import { CohereClient } from "cohere-ai";

const cohere = new CohereClient({ token: process.env.COHERE_API_KEY });

async function rerankWithCohere(query: string, docs: SearchResult[]) {
  const response = await cohere.rerank({
    query,
    documents: docs.map((d) => d.content),
    topN: 10,
    model: "rerank-multilingual-v3.0",
  });
  return response.results.map((r) => docs[r.index]);
}
```

**장점**:

- ✅ 업계 최고 수준 정확도 (SOTA)
- ✅ 다국어 지원 (한글 최적화)
- ✅ 구현 간단 (API 호출만)
- ✅ 유지보수 부담 없음
- ✅ 지속적인 모델 업그레이드

**단점**:

- ⚠️ 월 비용 발생 ($10-50)
- ⚠️ 외부 서비스 의존성
- ⚠️ 데이터가 외부로 전송됨
- ⚠️ 서비스 장애 시 영향

---

### B-2. 한글 형태소: 외부 API (Kakao/Naver)

| 항목          | 내용                             |
| ------------- | -------------------------------- |
| **구현 방식** | Kakao Karlo API 또는 Naver CLOVA |
| **비용**      | **월 $10-30**                    |
| **예상 점수** | +0.3점                           |
| **구현 기간** | 3일                              |

**장점**:

- ✅ 정확한 한국어 형태소 분석
- ✅ 복합어, 신조어 처리 우수
- ✅ API 호출만으로 간단 구현

**단점**:

- ⚠️ 월 비용 발생
- ⚠️ API 호출 지연 (네트워크)
- ⚠️ 무료 티어 제한 있음

---

### 💵 유료 로드맵 총합

| 항목          | 점수 기여        | 월 비용       | 기간       |
| ------------- | ---------------- | ------------- | ---------- |
| Cohere Rerank | +0.8             | $10-50        | 2일        |
| 형태소 API    | +0.3             | $10-30        | 3일        |
| MRR 측정      | +0.2             | 무료          | 2일        |
| **합계**      | **+1.3 → 8.1점** | **$20-80/월** | **약 1주** |

---

## PART C: 의사결정 가이드

### 🆓 무료를 선택해야 하는 경우

| 상황               | 이유                                 |
| ------------------ | ------------------------------------ |
| **예산 제약**      | 월 서비스 비용 추가 불가             |
| **데이터 민감성**  | 외부로 데이터 전송 불가 (금융, 의료) |
| **장기 운영**      | 누적 비용 부담 회피                  |
| **학습/실험 목적** | 내부 역량 구축 우선                  |
| **오프라인 필요**  | 네트워크 없이 동작해야 함            |

> **결론**: 스타트업 초기, 비용 민감, 데이터 프라이버시 중시 → **무료 선택**

---

### 💵 유료를 선택해야 하는 경우

| 상황                | 이유                         |
| ------------------- | ---------------------------- |
| **시간 부족**       | 2.5주 vs 1주 (개발 속도 2배) |
| **정확도 중시**     | Cohere가 BGE보다 5-10% 높음  |
| **한글 품질**       | 전문 형태소 분석 필수        |
| **유지보수 최소화** | 모델 관리 부담 없음          |
| **SLA 필요**        | 엔터프라이즈 지원 계약       |

> **결론**: B2B 서비스, 빠른 출시, 품질 우선 → **유료 선택**

---

## PART D: 하이브리드 전략 (권장)

**시니어 개발자 최종 제안**:

```
[Phase 1] 무료로 시작 (2주)
├── BGE-reranker 적용 → 7.5점
├── MRR 측정 체계 구축 → 7.7점
└── Ground Truth 50개 → 7.8점

[Phase 2] 필요시 유료 전환 (이후)
├── Cohere로 교체 (성능 검증 후)
└── 형태소 API 추가 (한글 문제 발생 시)
```

**이 전략의 장점**:

1. 초기 비용 0원으로 8점 근접 가능
2. 실제 성능 측정 후 유료 전환 결정
3. 유료 서비스의 ROI를 정량적으로 평가 가능
4. 언제든 무료 ↔ 유료 전환 가능한 구조

---

## 8. 최종 결론

| 방식           | 최종 점수 | 월 비용   | 기간   | 권장 대상           |
| -------------- | --------- | --------- | ------ | ------------------- |
| **무료**       | 8.0점     | $0        | 2.5주  | 스타트업, 비용 민감 |
| **유료**       | 8.1점     | $20-80    | 1주    | B2B, 빠른 출시      |
| **하이브리드** | 8.0→8.1점 | $0→필요시 | 2.5주+ | **권장**            |

> **팀 합의**: 하이브리드 전략으로 무료 구현 먼저 진행,  
> 측정 결과에 따라 유료 전환 여부 결정

---

**회의 종료**: 2026-01-06 08:30  
**다음 회의**: 1주 후 진행 상황 점검
