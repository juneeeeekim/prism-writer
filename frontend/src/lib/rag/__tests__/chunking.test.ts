
import { describe, it, expect } from 'vitest'
import { semanticChunk, classifyChunkType } from '../chunking'

describe('Chunking Utils', () => {
  describe('classifyChunkType', () => {
    it('should classify rules correctly', () => {
      expect(classifyChunkType('사용자는 반드시 로그인을 해야 한다.')).toBe('rule')
      expect(classifyChunkType('비밀번호를 공유하지 마라.')).toBe('rule')
      expect(classifyChunkType('Rule: Keep it simple.')).toBe('rule')
    })

    it('should classify examples correctly', () => {
      expect(classifyChunkType('예를 들어, 사과와 같은 과일이 있다.')).toBe('example')
      expect(classifyChunkType('"이것은 인용문입니다."')).toBe('example')
      expect(classifyChunkType('For example, this is a test.')).toBe('example')
    })

    it('should classify general text correctly', () => {
      expect(classifyChunkType('이것은 일반적인 문장입니다.')).toBe('general')
      expect(classifyChunkType('안녕하세요.')).toBe('general')
    })

    it('should prioritize rules over examples', () => {
      // 규칙 패턴과 예시 패턴이 모두 있는 경우
      expect(classifyChunkType('예를 들어, 비밀번호는 반드시 변경해야 한다.')).toBe('rule')
    })
  })

  describe('semanticChunk', () => {
    it('should chunk text based on paragraphs', () => {
      const text = `
# Section 1
This is the first paragraph.

This is the second paragraph.
      `
      const chunks = semanticChunk(text, { chunkSize: 100 })
      expect(chunks.length).toBeGreaterThan(0)
      expect(chunks[0].content).toContain('Section 1')
    })

    it('should detect chunk types in metadata', () => {
      const text = `
반드시 규칙을 지켜야 한다.

예를 들어, 이런 식으로.
      `
      const chunks = semanticChunk(text, { chunkSize: 5, overlap: 0, autoClassifyType: true })
      
      const ruleChunk = chunks.find(c => c.content.includes('규칙'))
      const exampleChunk = chunks.find(c => c.content.includes('예를 들어'))

      expect(ruleChunk?.metadata.chunkType).toBe('rule')
      expect(exampleChunk?.metadata.chunkType).toBe('example')
    })
  })
})
