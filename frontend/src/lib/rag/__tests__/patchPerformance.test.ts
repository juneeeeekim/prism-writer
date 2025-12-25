import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PatchService, MockLLMService } from '../services/patchService'
import type { ISearchService, ILLMService } from '../services/patchService'

// Mock dependencies
vi.mock('@/lib/supabase/server', () => ({
  createClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          single: () => Promise.resolve({ data: { user_id: 'test-user', content: 'test content' }, error: null })
        })
      })
    })
  })
}))

describe('Patch Service Performance', () => {
  let patchService: PatchService

  beforeEach(() => {
    // 1. Mock LLM Service with simulated latency
    const mockLatencyLLM: ILLMService = new MockLLMService()
    
    // Override generatePatch to add delay
    const originalGenerate = mockLatencyLLM.generatePatch.bind(mockLatencyLLM)
    mockLatencyLLM.generatePatch = async (userText, gap, context) => {
      await new Promise(resolve => setTimeout(resolve, 500)) // 500ms Network/Processing Delay
      return originalGenerate(userText, gap, context)
    }
    
    // 2. Mock Search Service with simulated latency
    const mockSearch: ISearchService = {
      searchRules: async () => {
        await new Promise(resolve => setTimeout(resolve, 100)) // 100ms Search Delay
        return []
      },
      searchExamples: async () => {
        return []
      }
    }

    // 3. Inject mocks
    patchService = new PatchService(mockSearch, mockLatencyLLM)
  })

  it('LT-1: Should handle 10 concurrent requests under 5 seconds (simulated)', async () => {
    const REQUEST_COUNT = 10
    const TIMEOUT_MS = 5000

    const startTime = Date.now()
    
    console.log(`[LoadTest] Starting ${REQUEST_COUNT} concurrent requests...`)

    // 10개 동시 요청 생성
    const requests = Array(REQUEST_COUNT).fill(null).map(() => 
      patchService.generateChangePlan('test input text', 'user-123', 'doc-123')
    )

    const results = await Promise.all(requests)
    const endTime = Date.now()
    const duration = endTime - startTime

    console.log(`[LoadTest] Completed in ${duration}ms`)
    console.log(`[LoadTest] TPS: ${(REQUEST_COUNT / (duration / 1000)).toFixed(2)}`)
    console.log(`[LoadTest] Latency/Req: ${(duration / REQUEST_COUNT).toFixed(2)}ms (Parallel)`)

    // 검증 1: 결과 확인
    expect(results.length).toBe(REQUEST_COUNT)
    
    // 검증 2: 성능 확인
    // 500ms(LLM) + 100ms(Search) + overhead. 
    // 순차 처리 시 6000ms+ 이지만, 병렬 처리 시 1000ms 내외여야 함.
    // 5초 미만이면 통과 (넉넉하게 설정)
    expect(duration).toBeLessThan(TIMEOUT_MS)
  })
})
