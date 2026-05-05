# 구조 분석 RAG 적응형 검색 시스템 기술 명세서

**문서 ID:** SPEC-2026-0108-001
**작성일:** 2026-01-08
**버전:** 1.0
**상태:** 승인 대기

---

## 1. 개요

### 1.1 배경
현재 구조 분석 API(`/api/rag/structure/analyze`)에서 참고자료 검색 시 `"글쓰기 구조"`라는 하드코딩된 키워드를 사용하고 있어, 참고자료의 실제 내용과 무관하게 고정된 검색이 수행됨.

### 1.2 목표
- 하드코딩 완전 제거
- 참고자료 내용에 따라 자동 적응하는 유동적 검색 시스템 구축
- 토큰 효율성과 검색 정확도의 균형

### 1.3 영향 범위
| 구분 | 파일 |
|------|------|
| 핵심 수정 | `frontend/src/app/api/rag/structure/analyze/route.ts` |
| 참조 | `frontend/src/lib/rag/search.ts` |
| 참조 | `frontend/src/lib/rag/structureHelpers.ts` |

---

## 2. 현재 상태 분석

### 2.1 문제점

```typescript
// route.ts:280 - 현재 코드 (문제)
const searchQuery = `글쓰기 구조 ${docContents}`.substring(0, 300)
//                   ^^^^^^^^^ 하드코딩
```

**문제:**
1. "글쓰기 구조"가 참고자료에 없으면 매칭률 저하
2. 참고자료가 "주장, 근거, 예시" 등의 용어를 사용해도 검색 불가
3. 참고자료 종류에 무관하게 동일한 검색 전략

### 2.2 원하는 동작
- 참고자료에 어떤 구조 용어가 있든 자동으로 적응
- 사용자가 업로드한 참고자료 기반으로 분석
- 하드코딩 없는 완전 유동적 시스템

---

## 3. 솔루션 설계

### 3.1 적응형 하이브리드 전략

```
┌─────────────────────────────────────────────────────────────┐
│                    적응형 검색 전략                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  [입력] 프로젝트 참고자료                                    │
│           │                                                 │
│           ▼                                                 │
│  ┌─────────────────┐                                        │
│  │ 전체 청크 조회   │                                        │
│  └────────┬────────┘                                        │
│           │                                                 │
│           ▼                                                 │
│  ┌─────────────────────────────────┐                        │
│  │ 토큰 한도 이내?                  │                        │
│  │ (30,000자 ≈ 7,500 토큰)         │                        │
│  └────────┬───────────────┬────────┘                        │
│           │               │                                 │
│      [예] │               │ [아니오]                         │
│           ▼               ▼                                 │
│  ┌────────────────┐ ┌──────────────────┐                    │
│  │ 전체 청크 사용  │ │ 하이브리드 검색   │                    │
│  │ (검색 불필요)   │ │ (벡터 + 키워드)  │                    │
│  └────────┬───────┘ └────────┬─────────┘                    │
│           │                  │                              │
│           └──────┬───────────┘                              │
│                  ▼                                          │
│         [출력] evidenceContext                              │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 Phase 구조

| Phase | 목표 | 복잡도 | 의존성 |
|-------|------|:------:|--------|
| Phase 1 | 하드코딩 제거 | 낮음 | 없음 |
| Phase 2 | 프로젝트 전체 청크 조회 | 중간 | Phase 1 |
| Phase 3 | 적응형 분기 로직 | 중간 | Phase 2 |

---

## 4. Phase 1: 하드코딩 제거

### 4.1 목표
- `"글쓰기 구조"` 하드코딩 제거
- 문서 내용 기반 검색으로 변경
- 검색 파라미터 최적화

### 4.2 변경 사항

**파일:** `frontend/src/app/api/rag/structure/analyze/route.ts`

```typescript
// ============================================================
// [수정 전] - 하드코딩 있음
// ============================================================
const docContents = targetDocs
  .map(d => (d.content || '').substring(0, 100))
  .join(' ')
const searchQuery = `글쓰기 구조 ${docContents}`.substring(0, 300)

const evidenceResults = await vectorSearch(searchQuery, {
  userId: session.user.id,
  topK: 10,
  minScore: 0.3,
  projectId: projectId,
})

// ============================================================
// [수정 후] - 하드코딩 제거
// ============================================================
const docContents = targetDocs
  .map(d => (d.content || '').substring(0, 200))
  .join(' ')

// 문서 내용만으로 검색 (하드코딩 키워드 없음)
const evidenceResults = await vectorSearch(docContents.substring(0, 300), {
  userId: session.user.id,
  topK: 15,        // 더 많은 결과 검색
  minScore: 0.25,  // 임계값 낮춤 - 넓게 검색
  projectId: projectId,
})
```

### 4.3 변경 파라미터 설명

| 파라미터 | 수정 전 | 수정 후 | 이유 |
|----------|---------|---------|------|
| 검색 쿼리 | `글쓰기 구조 + 내용` | `내용만` | 하드코딩 제거 |
| 내용 추출 길이 | 100자/문서 | 200자/문서 | 더 많은 컨텍스트 |
| topK | 10 | 15 | 더 많은 후보 |
| minScore | 0.3 | 0.25 | 넓은 검색 범위 |

### 4.4 테스트 케이스

```typescript
// TC-P1-01: 하드코딩 제거 확인
describe('Phase 1: 하드코딩 제거', () => {
  it('검색 쿼리에 "글쓰기 구조" 키워드가 없어야 함', () => {
    const searchQuery = buildSearchQuery(targetDocs)
    expect(searchQuery).not.toContain('글쓰기 구조')
  })

  it('문서 내용 기반으로 검색되어야 함', () => {
    const searchQuery = buildSearchQuery(targetDocs)
    expect(searchQuery).toContain(targetDocs[0].content.substring(0, 50))
  })
})
```

### 4.5 예상 결과
- 참고자료의 실제 내용과 유사한 청크 검색
- "주장, 근거, 예시" 등 참고자료 고유 용어 검색 가능

---

## 5. Phase 2: 프로젝트 전체 청크 조회

### 5.1 목표
- 프로젝트에 업로드된 모든 참고자료 청크 조회
- 토큰 한도 내에서 최대한 활용
- 검색 누락 위험 제거

### 5.2 변경 사항

**파일:** `frontend/src/app/api/rag/structure/analyze/route.ts`

```typescript
// ============================================================
// [Phase 2] 프로젝트 전체 청크 조회
// ============================================================

const MAX_TOTAL_CHARS = 30000 // ~7,500 토큰

// 프로젝트의 모든 참고자료 청크 조회
const { data: allChunks, error: chunksError } = await supabase
  .from('document_chunks')
  .select(`
    id,
    content,
    document_id,
    chunk_index,
    metadata,
    user_documents!inner(
      id,
      title,
      project_id
    )
  `)
  .eq('user_documents.project_id', projectId)
  .order('chunk_index', { ascending: true })
  .limit(100)

if (chunksError) {
  console.warn('[StructureAnalyze] 청크 조회 실패:', chunksError.message)
}

// 토큰 제한 내에서 청크 선택
let charCount = 0
const selectedChunks = (allChunks || []).filter(chunk => {
  if (charCount + chunk.content.length > MAX_TOTAL_CHARS) return false
  charCount += chunk.content.length
  return true
})

console.log(`[StructureAnalyze] 전체 청크: ${allChunks?.length || 0}개, 선택: ${selectedChunks.length}개, ${charCount}자`)
```

### 5.3 토큰 제한 설계

```
┌─────────────────────────────────────────────────────────────┐
│                    토큰 제한 계산                            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  LLM 컨텍스트 한도:           ~128,000 토큰 (GPT-4)         │
│                                                             │
│  프롬프트 구성:                                              │
│  ├─ 시스템 지시사항:          ~500 토큰                     │
│  ├─ 분석 대상 문서:           ~5,000 토큰 (10문서 x 500자)  │
│  ├─ 참고자료 (evidenceContext): ~7,500 토큰 (30,000자)      │
│  ├─ JSON 출력 형식:           ~200 토큰                     │
│  └─ 응답 예약:                ~2,000 토큰                   │
│                                                             │
│  총 사용:                     ~15,200 토큰                  │
│  여유분:                      ~112,800 토큰                 │
│                                                             │
│  ∴ MAX_TOTAL_CHARS = 30,000자 (안전 마진 포함)              │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 5.4 테스트 케이스

```typescript
// TC-P2-01: 프로젝트 청크 조회
describe('Phase 2: 프로젝트 전체 청크', () => {
  it('프로젝트의 모든 청크를 조회해야 함', async () => {
    const chunks = await getProjectChunks(projectId)
    expect(chunks.length).toBeGreaterThan(0)
  })

  it('토큰 한도를 초과하지 않아야 함', async () => {
    const chunks = await getProjectChunks(projectId)
    const totalChars = chunks.reduce((sum, c) => sum + c.content.length, 0)
    expect(totalChars).toBeLessThanOrEqual(30000)
  })

  it('chunk_index 순서로 정렬되어야 함', async () => {
    const chunks = await getProjectChunks(projectId)
    for (let i = 1; i < chunks.length; i++) {
      expect(chunks[i].chunk_index).toBeGreaterThanOrEqual(chunks[i-1].chunk_index)
    }
  })
})
```

---

## 6. Phase 3: 적응형 분기 로직

### 6.1 목표
- 참고자료 크기에 따라 최적 전략 자동 선택
- 작은 프로젝트: 전체 청크 사용 (검색 불필요)
- 큰 프로젝트: 하이브리드 검색으로 선별

### 6.2 전체 구현

**파일:** `frontend/src/app/api/rag/structure/analyze/route.ts`

```typescript
// =============================================================================
// [RAG-STRUCTURE] 적응형 참고자료 검색 (Phase 3 최종)
// =============================================================================

let evidenceContext = ''
try {
  const MAX_TOTAL_CHARS = 30000 // ~7,500 토큰

  // -------------------------------------------------------------------------
  // [Step 1] 프로젝트의 모든 참고자료 청크 조회
  // -------------------------------------------------------------------------
  const { data: allChunks, error: chunksError } = await supabase
    .from('document_chunks')
    .select(`
      id,
      content,
      document_id,
      chunk_index,
      metadata,
      user_documents!inner(
        id,
        title,
        project_id
      )
    `)
    .eq('user_documents.project_id', projectId)
    .order('chunk_index', { ascending: true })
    .limit(100)

  if (chunksError) {
    throw new Error(`청크 조회 실패: ${chunksError.message}`)
  }

  const totalChars = (allChunks || []).reduce((sum, c) => sum + c.content.length, 0)
  let selectedChunks: Array<{ content: string; metadata?: any }> = []

  // -------------------------------------------------------------------------
  // [Step 2] 적응형 분기
  // -------------------------------------------------------------------------
  if (totalChars <= MAX_TOTAL_CHARS) {
    // -----------------------------------------------------------------------
    // [Case A] 전체 사용 가능 - 검색 불필요
    // -----------------------------------------------------------------------
    selectedChunks = (allChunks || []).map(c => ({
      content: c.content,
      metadata: c.metadata
    }))
    console.log(`[StructureAnalyze] 전체 참고자료 사용 (${selectedChunks.length}개, ${totalChars}자)`)

  } else {
    // -----------------------------------------------------------------------
    // [Case B] 하이브리드 검색으로 관련 청크 선별
    // -----------------------------------------------------------------------
    const docContents = targetDocs
      .map(d => (d.content || '').substring(0, 200))
      .join(' ')

    const evidenceResults = await hybridSearch(docContents.substring(0, 300), {
      userId: session.user.id,
      topK: 20,
      minScore: 0.25,
      projectId: projectId,
    })

    // 토큰 제한 내에서 청크 선택
    let charCount = 0
    selectedChunks = evidenceResults
      .filter(r => {
        if (charCount + r.content.length > MAX_TOTAL_CHARS) return false
        charCount += r.content.length
        return true
      })
      .map(r => ({
        content: r.content,
        metadata: r.metadata
      }))

    console.log(`[StructureAnalyze] 하이브리드 검색 (${selectedChunks.length}개, ${charCount}자)`)
  }

  // -------------------------------------------------------------------------
  // [Step 3] 컨텍스트 생성
  // -------------------------------------------------------------------------
  if (selectedChunks.length > 0) {
    evidenceContext = selectedChunks
      .map((c, i) => `[참고자료 ${i + 1}] ${c.content}`)
      .join('\n\n')
  } else {
    console.log('[StructureAnalyze] 참고자료 없음')
  }

} catch (searchError) {
  // Graceful Degradation - 실패해도 기본 분석 계속
  console.warn('[StructureAnalyze] 참고자료 검색 실패 (계속 진행):', searchError)
}
```

### 6.3 분기 조건 상세

```
┌─────────────────────────────────────────────────────────────┐
│                    적응형 분기 조건                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  [조건] 전체 청크 문자 수 ≤ 30,000자                         │
│                                                             │
│  [Case A] 전체 사용                                         │
│  ├─ 언제: 소규모 프로젝트 (참고자료 1~3개 문서)              │
│  ├─ 장점: 검색 누락 0%, API 호출 감소                        │
│  └─ 예상: 대부분의 사용자 시나리오                           │
│                                                             │
│  [Case B] 하이브리드 검색                                   │
│  ├─ 언제: 대규모 프로젝트 (참고자료 10개+ 문서)              │
│  ├─ 장점: 토큰 효율성, 관련성 높은 청크 우선                 │
│  └─ 예상: 파워 유저, 기업 사용자                             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 6.4 테스트 케이스

```typescript
// TC-P3-01: 적응형 분기
describe('Phase 3: 적응형 분기', () => {
  it('작은 프로젝트는 전체 청크를 사용해야 함', async () => {
    // 10,000자 이하 프로젝트
    const result = await analyzeStructure(smallProjectId)
    expect(result.searchMethod).toBe('full')
  })

  it('큰 프로젝트는 하이브리드 검색을 사용해야 함', async () => {
    // 50,000자 이상 프로젝트
    const result = await analyzeStructure(largeProjectId)
    expect(result.searchMethod).toBe('hybrid')
  })

  it('토큰 한도를 초과하지 않아야 함', async () => {
    const result = await analyzeStructure(anyProjectId)
    expect(result.evidenceChars).toBeLessThanOrEqual(30000)
  })
})
```

---

## 7. 의존성 및 임포트

### 7.1 Phase 3 필요 임포트

```typescript
// route.ts 상단에 추가
import { hybridSearch } from '@/lib/rag/search'
```

### 7.2 기존 임포트 (변경 없음)

```typescript
import { vectorSearch } from '@/lib/rag/search'
import { createClient } from '@/lib/supabase/server'
```

---

## 8. 롤백 계획

### 8.1 Phase별 롤백

| Phase | 롤백 방법 | 영향 |
|-------|----------|------|
| Phase 1 | 검색 쿼리에 `"글쓰기 구조"` 복원 | 원래 동작 복원 |
| Phase 2 | 전체 청크 조회 코드 제거 | Phase 1으로 복귀 |
| Phase 3 | 적응형 분기 제거 | Phase 2로 복귀 |

### 8.2 Feature Flag (권장)

```typescript
// config/featureFlags.ts
export const FEATURE_FLAGS = {
  // ...
  ENABLE_ADAPTIVE_RAG_SEARCH: true,  // Phase 3 활성화
  ENABLE_FULL_CHUNK_RETRIEVAL: true, // Phase 2 활성화
}
```

---

## 9. 모니터링

### 9.1 로그 포맷

```typescript
// 성공 로그
console.log(`[StructureAnalyze] 전체 참고자료 사용 (${count}개, ${chars}자)`)
console.log(`[StructureAnalyze] 하이브리드 검색 (${count}개, ${chars}자)`)

// 실패 로그
console.warn('[StructureAnalyze] 참고자료 검색 실패 (계속 진행):', error)
```

### 9.2 메트릭

| 메트릭 | 설명 | 목표값 |
|--------|------|--------|
| `structure_analyze_evidence_count` | 사용된 참고자료 청크 수 | > 0 |
| `structure_analyze_evidence_chars` | 참고자료 총 문자 수 | ≤ 30,000 |
| `structure_analyze_search_method` | 사용된 검색 방법 | full/hybrid |
| `structure_analyze_latency_ms` | 분석 소요 시간 | < 10,000 |

---

## 10. 일정

| Phase | 예상 작업 | 상태 |
|-------|----------|:----:|
| Phase 1 | 하드코딩 제거 | 대기 |
| Phase 2 | 전체 청크 조회 | 대기 |
| Phase 3 | 적응형 분기 | 대기 |
| 테스트 | 통합 테스트 | 대기 |

---

## 11. 승인

| 역할 | 이름 | 서명 | 날짜 |
|------|------|------|------|
| 기술 리더 | | | |
| RAG 전문가 | | | |
| QA 담당 | | | |

---

**문서 끝**
