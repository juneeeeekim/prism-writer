// =============================================================================
// PRISM Writer - Regression Tests for Retrieval Pipeline
// =============================================================================
// 파일: frontend/src/lib/rag/__tests__/regression-retrieval-pipeline.test.ts
// 역할: 기존 함수들의 회귀 테스트 (hybridSearch, verifyCitation 등)
// 작성일: 2026-01-03
// =============================================================================

import { verifyCitation, type CitationVerifyResult } from '../citationGate'
import { hybridSearch, vectorSearch, type SearchResult, type SearchOptions, type HybridSearchOptions } from '../search'

// =============================================================================
// Regression 2: verifyCitation 정상 작동
// =============================================================================
describe('Regression: verifyCitation', () => {
  it('should return valid=true for exact match', () => {
    const sourceChunks = [
      { id: 'chunk-1', content: '이것은 테스트 문장입니다.' },
      { id: 'chunk-2', content: '다른 내용이 담긴 청크입니다.' },
    ]

    const result: CitationVerifyResult = verifyCitation(
      '이것은 테스트 문장입니다.',
      sourceChunks
    )

    expect(result.valid).toBe(true)
    expect(result.matchedChunkId).toBe('chunk-1')
    console.log('✅ Regression 2: verifyCitation - exact match works')
  })

  it('should return valid=false for non-matching quote', () => {
    const sourceChunks = [
      { id: 'chunk-1', content: '완전히 다른 내용입니다.' },
    ]

    const result: CitationVerifyResult = verifyCitation(
      '존재하지 않는 문장입니다.',
      sourceChunks
    )

    expect(result.valid).toBe(false)
    console.log('✅ Regression 2: verifyCitation - non-match returns false')
  })

  it('should handle empty source chunks', () => {
    const result: CitationVerifyResult = verifyCitation('테스트', [])

    expect(result.valid).toBe(false)
    expect(result.matchScore).toBe(0)
    console.log('✅ Regression 2: verifyCitation - empty chunks handled')
  })
})

// =============================================================================
// Regression 1: hybridSearch 함수 시그니처 및 타입 검증
// =============================================================================
describe('Regression: hybridSearch function signature', () => {
  it('should export hybridSearch function', () => {
    expect(typeof hybridSearch).toBe('function')
    console.log('✅ Regression 1: hybridSearch function exists')
  })

  it('should export vectorSearch function', () => {
    expect(typeof vectorSearch).toBe('function')
    console.log('✅ Regression 1: vectorSearch function exists')
  })

  it('should have correct type definitions', () => {
    // SearchResult 타입 검증
    const mockResult: SearchResult = {
      chunkId: 'test-id',
      documentId: 'doc-id',
      content: 'test content',
      score: 0.8,
      metadata: {},
    }
    
    expect(mockResult.chunkId).toBeDefined()
    expect(mockResult.score).toBe(0.8)
    console.log('✅ Regression 1: SearchResult type works correctly')
  })

  it('should have correct SearchOptions type', () => {
    const options: SearchOptions = {
      userId: 'test-user',
      topK: 5,
      documentId: 'doc-id',
    }
    
    expect(options.userId).toBeDefined()
    expect(options.topK).toBe(5)
    console.log('✅ Regression 1: SearchOptions type works correctly')
  })

  it('should have correct HybridSearchOptions type', () => {
    const options: HybridSearchOptions = {
      userId: 'test-user',
      topK: 5,
      vectorWeight: 0.7,
      keywordWeight: 0.3,
    }
    
    expect(options.vectorWeight).toBe(0.7)
    expect(options.keywordWeight).toBe(0.3)
    console.log('✅ Regression 1: HybridSearchOptions type works correctly')
  })
})
