// =============================================================================
// PRISM Writer - Citation Gate Unit Tests
// =============================================================================
// 파일: frontend/src/lib/rag/__tests__/citationGate.test.ts
// 역할: verifyCitation 함수 단위 테스트
// =============================================================================

import { verifyCitation, verifyAllCitations, summarizeCitationVerification } from '../citationGate'
import type { JudgeEvidence } from '@/types/rag'

// =============================================================================
// 테스트 데이터
// =============================================================================

const SOURCE_CHUNKS = [
  {
    id: 'chunk-001',
    content: 'RAG는 Retrieval-Augmented Generation의 약자입니다. 검색과 생성을 결합한 기술입니다.',
  },
  {
    id: 'chunk-002',
    content: '자연어 처리(NLP)는 컴퓨터가 인간의 언어를 이해하고 생성하는 인공지능의 한 분야입니다.',
  },
]

// =============================================================================
// 테스트 케이스
// =============================================================================

describe('verifyCitation', () => {
  // ---------------------------------------------------------------------------
  // 정확 일치 검증 테스트
  // ---------------------------------------------------------------------------
  describe('정확 일치 검증', () => {
    it('완전히 일치하는 인용문은 valid: true를 반환해야 함', () => {
      const quote = 'RAG는 Retrieval-Augmented Generation의 약자입니다'
      const result = verifyCitation(quote, SOURCE_CHUNKS)
      
      expect(result.valid).toBe(true)
      expect(result.matchScore).toBe(1.0)
      expect(result.matchedChunkId).toBe('chunk-001')
    })

    it('부분 일치하는 인용문도 검증되어야 함', () => {
      const quote = '검색과 생성을 결합한 기술'
      const result = verifyCitation(quote, SOURCE_CHUNKS)
      
      expect(result.valid).toBe(true)
      expect(result.matchScore).toBe(1.0)
    })
  })

  // ---------------------------------------------------------------------------
  // Fuzzy 매칭 검증 테스트
  // ---------------------------------------------------------------------------
  describe('fuzzy 매칭 검증', () => {
    it('띄어쓰기가 다른 인용문도 매칭되어야 함', () => {
      const quote = 'RAG는  Retrieval-Augmented   Generation의  약자입니다'
      const result = verifyCitation(quote, SOURCE_CHUNKS)
      
      expect(result.valid).toBe(true)
      expect(result.matchScore).toBeGreaterThanOrEqual(0.6)
    })

    it('대소문자가 다른 인용문도 매칭되어야 함', () => {
      const quote = 'rag는 retrieval-augmented generation의 약자입니다'
      const result = verifyCitation(quote, SOURCE_CHUNKS)
      
      expect(result.valid).toBe(true)
    })

    it('핵심 단어가 포함된 긴 인용문도 부분 매칭 점수를 받아야 함', () => {
      const quote = 'RAG는 검색과 생성을 결합한 혁신적인 기술입니다'
      const result = verifyCitation(quote, SOURCE_CHUNKS)
      
      expect(result.matchScore).toBeGreaterThan(0)
    })
  })

  // ---------------------------------------------------------------------------
  // 불일치 검증 테스트
  // ---------------------------------------------------------------------------
  describe('불일치 검증', () => {
    it('완전히 다른 인용문은 valid: false를 반환해야 함', () => {
      const quote = '이것은 완전히 다른 내용으로 원본에 없는 문장입니다'
      const result = verifyCitation(quote, SOURCE_CHUNKS)
      
      expect(result.valid).toBe(false)
      expect(result.matchScore).toBeLessThan(0.6)
    })

    it('빈 인용문은 valid: false를 반환해야 함', () => {
      const result = verifyCitation('', SOURCE_CHUNKS)
      
      expect(result.valid).toBe(false)
      expect(result.matchScore).toBe(0)
    })

    it('빈 청크 배열에서는 valid: false를 반환해야 함', () => {
      const result = verifyCitation('어떤 인용문', [])
      
      expect(result.valid).toBe(false)
    })
  })
})

// =============================================================================
// verifyAllCitations 테스트
// =============================================================================

describe('verifyAllCitations', () => {
  it('모든 인용문을 일괄 검증해야 함', () => {
    const evidence: JudgeEvidence[] = [
      { chunkId: 'chunk-001', quote: 'RAG는 검색과 생성을 결합한 기술', relevance: 0.9 },
      { chunkId: 'chunk-002', quote: '완전히 거짓인 내용', relevance: 0.5 },
    ]
    
    const results = verifyAllCitations(evidence, SOURCE_CHUNKS)
    
    expect(results).toHaveLength(2)
    expect(results[0].verified.valid).toBe(true)
    expect(results[1].verified.valid).toBe(false)
  })
})

// =============================================================================
// summarizeCitationVerification 테스트
// =============================================================================

describe('summarizeCitationVerification', () => {
  it('검증 결과 요약을 올바르게 생성해야 함', () => {
    const verifiedEvidence = [
      { chunkId: 'c1', quote: 'q1', relevance: 0.9, verified: { valid: true, matchScore: 1.0 } },
      { chunkId: 'c2', quote: 'q2', relevance: 0.5, verified: { valid: false, matchScore: 0.3 } },
    ]
    
    const summary = summarizeCitationVerification(verifiedEvidence)
    
    expect(summary.total).toBe(2)
    expect(summary.valid).toBe(1)
    expect(summary.invalid).toBe(1)
    expect(summary.averageScore).toBe(0.65)
  })
})
