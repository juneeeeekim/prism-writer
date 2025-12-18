// =============================================================================
// PRISM Writer - Judge Parser Unit Tests
// =============================================================================
// 파일: frontend/src/lib/rag/__tests__/judgeParser.test.ts
// 역할: judgeParser 함수 단위 테스트
// =============================================================================

import { parseJudgeResponse, parseJudgeResponseSafe } from '../judgeParser'
import type { JudgeResult } from '@/types/rag'

// =============================================================================
// 테스트 데이터
// =============================================================================

const VALID_JUDGE_RESPONSE = `{
  "verdict": "pass",
  "score": 85,
  "evidence": [
    {
      "chunkId": "chunk-001",
      "quote": "RAG는 Retrieval-Augmented Generation의 약자입니다.",
      "relevance": 0.92
    }
  ],
  "reasoning": "질문에 대한 충분한 근거가 있습니다.",
  "missingEvidence": []
}`

const VALID_RESPONSE_WITH_CODEBLOCK = `\`\`\`json
{
  "verdict": "insufficient_evidence",
  "score": 30,
  "evidence": [],
  "reasoning": "컨텍스트에 관련 정보가 없습니다."
}
\`\`\``

const INVALID_JSON = `This is not valid JSON at all`

const MISSING_REQUIRED_FIELDS = `{
  "verdict": "pass",
  "score": 85
}`

const INVALID_VERDICT = `{
  "verdict": "maybe",
  "score": 85,
  "evidence": [],
  "reasoning": "test"
}`

const INVALID_SCORE_RANGE = `{
  "verdict": "pass",
  "score": 150,
  "evidence": [],
  "reasoning": "test"
}`

// =============================================================================
// 테스트 케이스
// =============================================================================

describe('parseJudgeResponse', () => {
  // ---------------------------------------------------------------------------
  // 정상 JSON 파싱 테스트
  // ---------------------------------------------------------------------------
  describe('정상 JSON 파싱', () => {
    it('유효한 JSON 응답을 파싱해야 함', () => {
      const result = parseJudgeResponse(VALID_JUDGE_RESPONSE)
      
      expect(result).not.toBeNull()
      expect(result?.verdict).toBe('pass')
      expect(result?.score).toBe(85)
      expect(result?.evidence).toHaveLength(1)
      expect(result?.evidence[0].chunkId).toBe('chunk-001')
      expect(result?.reasoning).toBe('질문에 대한 충분한 근거가 있습니다.')
    })

    it('코드블록으로 감싼 JSON도 파싱해야 함', () => {
      const result = parseJudgeResponse(VALID_RESPONSE_WITH_CODEBLOCK)
      
      expect(result).not.toBeNull()
      expect(result?.verdict).toBe('insufficient_evidence')
      expect(result?.score).toBe(30)
    })

    it('relevance를 소수점 2자리로 정규화해야 함', () => {
      const result = parseJudgeResponse(VALID_JUDGE_RESPONSE)
      
      expect(result?.evidence[0].relevance).toBe(0.92)
    })
  })

  // ---------------------------------------------------------------------------
  // 잘못된 형식 처리 테스트
  // ---------------------------------------------------------------------------
  describe('잘못된 형식 처리', () => {
    it('유효하지 않은 JSON에 대해 null을 반환해야 함', () => {
      const result = parseJudgeResponse(INVALID_JSON)
      
      expect(result).toBeNull()
    })

    it('빈 문자열에 대해 null을 반환해야 함', () => {
      const result = parseJudgeResponse('')
      
      expect(result).toBeNull()
    })

    it('유효하지 않은 verdict에 대해 null을 반환해야 함', () => {
      const result = parseJudgeResponse(INVALID_VERDICT)
      
      expect(result).toBeNull()
    })

    it('유효하지 않은 score 범위에 대해 null을 반환해야 함', () => {
      const result = parseJudgeResponse(INVALID_SCORE_RANGE)
      
      expect(result).toBeNull()
    })
  })

  // ---------------------------------------------------------------------------
  // 필수 필드 누락 처리 테스트
  // ---------------------------------------------------------------------------
  describe('필수 필드 누락 처리', () => {
    it('필수 필드가 누락된 경우 null을 반환해야 함', () => {
      const result = parseJudgeResponse(MISSING_REQUIRED_FIELDS)
      
      expect(result).toBeNull()
    })
  })
})

// =============================================================================
// parseJudgeResponseSafe 테스트
// =============================================================================

describe('parseJudgeResponseSafe', () => {
  it('유효한 응답에 대해 파싱된 결과를 반환해야 함', () => {
    const result = parseJudgeResponseSafe(VALID_JUDGE_RESPONSE)
    
    expect(result.verdict).toBe('pass')
    expect(result.score).toBe(85)
  })

  it('파싱 실패 시 기본값을 반환해야 함', () => {
    const result = parseJudgeResponseSafe(INVALID_JSON)
    
    expect(result.verdict).toBe('insufficient_evidence')
    expect(result.score).toBe(0)
    expect(result.evidence).toHaveLength(0)
  })
})
