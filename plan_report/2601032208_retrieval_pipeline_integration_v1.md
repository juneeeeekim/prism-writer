# PRISM Writer 리트리벌 파이프라인 통합 문서 v2.0

**원본**: `2601032208_retrieval_pipeline_integration_v1.md` (지후)  
**수정일**: 2026-01-03 22:15  
**수정자**: Tech Lead, 리트리벌 전문가  
**목적**: 원본 설계를 PRISM Writer **현재 구현**과 매핑하여 실행 가능한 체크리스트로 변환

---

## 1) 현재 시스템 구현 현황 (AS-IS)

### ✅ 이미 구현된 컴포넌트

| 컴포넌트          | 파일                                           | 설명                   |
| ----------------- | ---------------------------------------------- | ---------------------- |
| **DocumentStore** | Supabase `document_chunks` 테이블              | 청크 저장              |
| **Chunker**       | `lib/raft/chunkExtractor.ts`                   | 문서 청킹              |
| **Vector Search** | `lib/rag/search.ts` > `vectorSearch()`         | 임베딩 기반 검색       |
| **Hybrid Search** | `lib/rag/search.ts` > `hybridSearch()`         | 벡터 + BM25 하이브리드 |
| **Citation Gate** | `lib/rag/citationGate.ts` > `verifyCitation()` | 인용 검증 (70% 임계값) |
| **Reranker**      | `lib/rag/reranker.ts`                          | 검색 결과 재순위       |

### 🔴 미구현 (신규 개발 필요)

| 컴포넌트                     | 우선순위 | 설명                                |
| ---------------------------- | -------- | ----------------------------------- |
| **Rule/Example 인덱스 분리** | P1       | 현재 통합 인덱스만 존재             |
| **LLM Query Builder**        | P1       | 루브릭 기반 검색 쿼리 자동 생성     |
| **Criteria Pack**            | P1       | Judge에 전달할 구조화된 근거 패키지 |
| **Pattern Index**            | P2       | 패턴 라벨 기반 검색                 |
| **Pin/Unpin UI**             | P2       | 사용자 근거 고정 기능               |
| **Sufficiency Gate**         | P1       | 근거 충분성 검사                    |

---

## 2) 우리 서비스 특화 설계 (TO-BE)

### 2.1 검색 목표 정의

PRISM Writer는 **패턴/장점(구조·어투·설득 메커니즘)** 을 이식하는 서비스입니다.

| 검색 유형             | 목표                                | 현재 상태                                      |
| --------------------- | ----------------------------------- | ---------------------------------------------- |
| **Rule Retrieval**    | 루브릭 기준의 "원칙/정의/규칙" 회수 | ⚠️ 부분 (일반 검색으로 대체 중)                |
| **Example Retrieval** | "do/don't 예시" 회수                | ⚠️ 부분                                        |
| **Pattern Retrieval** | 패턴 라벨(hook/CTA/반박) 기반 회수  | ✅ `match_document_chunks_by_pattern` RPC 존재 |

### 2.2 현재 데이터 모델

```typescript
// document_chunks 테이블 (Supabase)
interface DocumentChunk {
  id: string;
  document_id: string;
  content: string;
  embedding: number[]; // 768차원 Gemini 임베딩
  chunk_index: number;
  metadata: {
    page?: number;
    section?: string;
    pattern_type?: string; // [P4] 패턴 타입 지원
    tier?: "core" | "style" | "detail"; // [H-01] 티어 정보
  };
  created_at: string;
}
```

---

## 3) 구현 체크리스트 (PRISM Writer 맞춤)

### Phase 0: 현재 시스템 활용 극대화 (즉시 적용)

> 이미 구현된 컴포넌트를 최대한 활용

- [x] **R-01**: `vectorSearch()` 평가 API에서 활용 ✅ (evaluate-holistic, evaluate-single)
- [x] **R-02**: `hybridSearch()` 채팅 API에서 활용 ✅ (chat/route.ts)
- [x] **R-03**: `verifyCitation()` 인용 검증 ✅ (70% 임계값 + 마커 가산점)
- [ ] **R-04**: `match_document_chunks_by_pattern` RPC 활용 확대

---

### Phase 1: 루브릭 연동 강화 (P0)

> 루브릭 기반 검색 품질 향상

- [ ] **R-05**: Query Builder 템플릿 구현

  - `Target`: `lib/rag/queryBuilder.ts` (신규)
  - 루브릭의 `criteria_id`, `definition`, `query_hints` 기반 검색 쿼리 생성
  - 입력: 루브릭 정보 → 출력: `{ rule_query, example_query, pattern_query }`

- [ ] **R-06**: Sufficiency Gate 구현

  - `Target`: `lib/rag/sufficiencyGate.ts` (신규)
  - Top-K 결과 중 의미 있는 근거 최소 1개 이상 확인
  - 없으면 `retrieval_sufficient: false` 반환

- [ ] **R-07**: Criteria Pack 스키마 정의
  - `Target`: `types/rag.ts` 확장
  - Judge에 전달할 구조화된 근거 패키지 타입 정의

---

### Phase 2: 신뢰도 강화 (P1)

- [ ] **R-08**: Rule/Example 인덱스 분리

  - 청크 메타데이터에 `chunk_type: 'rule' | 'example' | 'pattern'` 필드 추가
  - 검색 시 타입별 필터링 지원

- [ ] **R-09**: Pin/Unpin UI

  - `Target`: `components/Assistant/ReferenceTab.tsx` 확장
  - 검색 결과에 [핀] 버튼 추가
  - 핀된 근거는 평가 시 우선 사용

- [ ] **R-10**: Hard Negative 저장
  - 사용자/검수자 피드백 기반 "잘못된 근거" 저장
  - 향후 검색 품질 개선 데이터로 활용

---

## 4) 기존 컴포넌트와의 결합 포인트

### 4.1 루브릭 → 리트리벌 연결

```typescript
// 현재: rubrics.ts의 DEFAULT_RUBRICS
interface Rubric {
  id: string;
  name: string;
  category: "structure" | "trust" | "persuasion" | "style" | "detail";
  description: string;
  // [TO-ADD] query_hints: string[]  // 검색 힌트
}
```

### 4.2 평가 API 흐름 (현재)

```
사용자 글 → vectorSearch() → 청크 목록 → verifyCitation() → Judge
```

### 4.3 평가 API 흐름 (목표)

```
사용자 글 + 루브릭 → Query Builder → hybridSearch()
    → Sufficiency Gate → Criteria Pack → Judge
```

---

## 5) Feature Flags (리트리벌용)

`config/featureFlags.ts`에 추가:

```typescript
// 리트리벌 파이프라인 v2
ENABLE_QUERY_BUILDER: false,        // R-05
ENABLE_SUFFICIENCY_GATE: false,     // R-06
ENABLE_CRITERIA_PACK: false,        // R-07
ENABLE_CHUNK_TYPE_FILTER: false,    // R-08
ENABLE_PIN_UNPIN: false,            // R-09
```

---

## 6) 우선순위 및 예상 공수

| Phase | 항목                   | 공수  | 우선순위 |
| ----- | ---------------------- | ----- | -------- |
| P0    | R-04: 패턴 RPC 활용    | 0.5일 | 즉시     |
| P1    | R-05: Query Builder    | 1일   | 높음     |
| P1    | R-06: Sufficiency Gate | 0.5일 | 높음     |
| P1    | R-07: Criteria Pack    | 0.5일 | 높음     |
| P2    | R-08: 인덱스 분리      | 1일   | 중간     |
| P2    | R-09: Pin/Unpin UI     | 1일   | 중간     |
| P2    | R-10: Hard Negative    | 0.5일 | 낮음     |

**총 예상 공수**: 5일

---

## 7) 결론

### 현재 강점

- **Vector + Hybrid 검색** 이미 구현
- **Citation Gate** 70% 임계값 + 마커 가산점 완료
- **패턴 검색 RPC** 존재 (`match_document_chunks_by_pattern`)

### 개선 포인트

1. **Query Builder**: 루브릭 기반 자동 쿼리 생성
2. **Sufficiency Gate**: 근거 충분성 검사
3. **Criteria Pack**: 구조화된 근거 전달

### 다음 액션

1. **R-04** 패턴 RPC 활용 확대 (즉시)
2. **R-05~R-07** Phase 1 구현 (1주 내)
3. 사용자 피드백 기반 Phase 2 결정

---

**끝.**
