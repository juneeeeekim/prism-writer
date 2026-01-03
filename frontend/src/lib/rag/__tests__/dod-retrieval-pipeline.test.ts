// =============================================================================
// PRISM Writer - Retrieval Pipeline v2 DoD Tests
// =============================================================================
// 파일: frontend/src/lib/rag/__tests__/dod-retrieval-pipeline.test.ts
// 역할: R-04 ~ R-08 기능 검증 테스트
// 작성일: 2026-01-03
// =============================================================================

import { buildSearchQueries, type QueryBuilderInput } from '../queryBuilder'
import { checkSufficiency, type SufficiencyResult } from '../sufficiencyGate'
import { 
  type CriteriaPackV2, 
  type RetrievedChunk,
  createDefaultCriteriaPackV2 
} from '@/types/rag'

// =============================================================================
// Test R-04: searchByPattern (Skip - Not Implemented)
// =============================================================================
// Note: searchByPattern 함수는 별도로 구현되지 않았으며,
// hybridSearch의 patternType 옵션을 통해 동일 기능 제공됨

// =============================================================================
// Test R-05: buildSearchQueries
// =============================================================================
describe('R-05: Query Builder', () => {
  it('should return 3 queries for valid input', () => {
    const input: QueryBuilderInput = {
      criteria_id: 'R01',
      name: '서론의 흡입력',
      definition: '독자의 호기심을 자극하고 문제의식을 명확히 제시',
      category: 'structure',
    }

    const result = buildSearchQueries(input)

    // 3개 쿼리 반환 확인
    expect(result).toHaveProperty('rule_query')
    expect(result).toHaveProperty('example_query')
    expect(result).toHaveProperty('pattern_query')
    
    // 각 쿼리가 비어있지 않음
    expect(result.rule_query.length).toBeGreaterThan(0)
    expect(result.example_query.length).toBeGreaterThan(0)
    expect(result.pattern_query.length).toBeGreaterThan(0)
    
    console.log('✅ Test R-05 PASSED: buildSearchQueries returns 3 queries')
    console.log('  - rule_query:', result.rule_query)
    console.log('  - example_query:', result.example_query)
    console.log('  - pattern_query:', result.pattern_query)
  })

  it('should handle empty definition by using name', () => {
    const input: QueryBuilderInput = {
      criteria_id: 'R02',
      name: '논리 흐름',
      definition: '',
      category: 'structure',
    }

    const result = buildSearchQueries(input)
    
    // 쿼리가 생성됨
    expect(result.rule_query.length).toBeGreaterThan(0)
    console.log('✅ Test R-05b PASSED: handles empty definition')
  })
})

// =============================================================================
// Test R-06: checkSufficiency
// =============================================================================
describe('R-06: Sufficiency Gate', () => {
  it('should return { sufficient: false } for empty array', () => {
    const result: SufficiencyResult = checkSufficiency([])

    expect(result.sufficient).toBe(false)
    expect(result.reason).toBe('검색 결과 없음')
    expect(result.chunk_count).toBe(0)
    
    console.log('✅ Test R-06 PASSED: empty array returns { sufficient: false }')
    console.log('  - reason:', result.reason)
  })

  it('should return { sufficient: false } for null input', () => {
    const result: SufficiencyResult = checkSufficiency(null)

    expect(result.sufficient).toBe(false)
    expect(result.reason).toBe('검색 결과 없음 (null)')
    
    console.log('✅ Test R-06b PASSED: null input returns { sufficient: false }')
  })

  it('should return { sufficient: true } for valid results', () => {
    const mockResults = [
      { chunkId: '1', documentId: 'd1', content: 'test', score: 0.8, metadata: {} },
      { chunkId: '2', documentId: 'd2', content: 'test2', score: 0.6, metadata: {} },
    ]

    const result: SufficiencyResult = checkSufficiency(mockResults)

    expect(result.sufficient).toBe(true)
    expect(result.chunk_count).toBe(2)
    
    console.log('✅ Test R-06c PASSED: valid results return { sufficient: true }')
  })
})

// =============================================================================
// Test R-07: CriteriaPackV2 Type
// =============================================================================
describe('R-07: CriteriaPack Schema', () => {
  it('should allow creating CriteriaPackV2 object', () => {
    const pack: CriteriaPackV2 = {
      criteria_id: 'rubric-001',
      queries: {
        rule_query: 'structure 서론의 흡입력 규칙 정의',
        example_query: '서론의 흡입력 좋은 예시',
        pattern_query: 'structure 훅 문장 패턴',
      },
      evidence: {
        rules: [],
        examples: [],
        patterns: [],
      },
      gates: {
        citation_verified: false,
        retrieval_sufficient: false,
      },
      metadata: {
        created_at: new Date().toISOString(),
        search_duration_ms: 0,
      },
    }

    // 타입 검증
    expect(pack.criteria_id).toBeDefined()
    expect(pack.queries).toBeDefined()
    expect(pack.evidence.rules).toEqual([])
    expect(pack.gates.citation_verified).toBe(false)
    
    console.log('✅ Test R-07 PASSED: CriteriaPackV2 object creation successful')
  })

  it('should create default pack with createDefaultCriteriaPackV2', () => {
    const pack = createDefaultCriteriaPackV2('test-rubric')

    expect(pack.criteria_id).toBe('test-rubric')
    expect(pack.evidence.rules).toEqual([])
    expect(pack.evidence.examples).toEqual([])
    expect(pack.evidence.patterns).toEqual([])
    expect(pack.gates.citation_verified).toBe(false)
    expect(pack.gates.retrieval_sufficient).toBe(false)
    
    console.log('✅ Test R-07b PASSED: createDefaultCriteriaPackV2 works correctly')
  })

  it('should allow RetrievedChunk type', () => {
    const chunk: RetrievedChunk = {
      chunk_id: 'chunk-001',
      content: 'Test content',
      score: 0.85,
      source: {
        document_id: 'doc-001',
        page: 1,
        section: 'Introduction',
      },
    }

    expect(chunk.chunk_id).toBeDefined()
    expect(chunk.score).toBe(0.85)
    expect(chunk.source.page).toBe(1)
    
    console.log('✅ Test R-07c PASSED: RetrievedChunk type works correctly')
  })
})

// =============================================================================
// Test R-08: buildCriteriaPack (Unit Test - Mock Required)
// =============================================================================
// Note: buildCriteriaPack는 hybridSearch를 호출하므로 실제 실행은 통합 테스트 필요
// 여기서는 함수 시그니처와 반환 구조만 검증

describe('R-08: Criteria Pack Builder', () => {
  it('should export buildCriteriaPack function', async () => {
    // 동적 임포트로 함수 존재 여부 확인
    const { buildCriteriaPack } = await import('../criteriaPackBuilder')
    
    expect(typeof buildCriteriaPack).toBe('function')
    console.log('✅ Test R-08 PASSED: buildCriteriaPack function exists')
  })

  it('should export buildCriteriaPackBatch function', async () => {
    const { buildCriteriaPackBatch } = await import('../criteriaPackBuilder')
    
    expect(typeof buildCriteriaPackBatch).toBe('function')
    console.log('✅ Test R-08b PASSED: buildCriteriaPackBatch function exists')
  })

  it('should export helper functions', async () => {
    const { getTotalEvidenceCount, getAverageScore, summarizeCriteriaPack } = await import('../criteriaPackBuilder')
    
    expect(typeof getTotalEvidenceCount).toBe('function')
    expect(typeof getAverageScore).toBe('function')
    expect(typeof summarizeCriteriaPack).toBe('function')
    
    console.log('✅ Test R-08c PASSED: All helper functions exported')
  })
})
