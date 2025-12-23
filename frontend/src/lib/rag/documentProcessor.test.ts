import { describe, it, expect, vi, beforeEach } from 'vitest'
import { processDocument } from './documentProcessor'
import { DocumentStatus } from '@/types/rag'

// Mock dependencies
vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn()
}))

vi.mock('./chunking', () => ({
  chunkDocument: vi.fn(),
}))

vi.mock('./embedding', () => ({
  embedBatch: vi.fn(),
  estimateTokenCount: vi.fn(() => 10),
  EMBEDDING_CONFIG: { modelId: 'test-model', dimensions: 1536 }
}))

vi.mock('./costGuard', () => ({
  validateDocumentSize: vi.fn(),
  validateUsage: vi.fn(),
  trackUsage: vi.fn()
}))

import { createClient } from '@/lib/supabase/client'
import { chunkDocument } from './chunking'
import { embedBatch } from './embedding'

describe('documentProcessor', () => {
  let mockSupabase: any

  beforeEach(() => {
    vi.clearAllMocks()

    // Setup Supabase mock chain
    mockSupabase = {
      from: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ error: null }),
      insert: vi.fn().mockResolvedValue({ error: null }),
      storage: {
        from: vi.fn().mockReturnThis(),
        download: vi.fn().mockResolvedValue({
          data: { text: () => Promise.resolve('Mock content') },
          error: null
        })
      }
    }
    
    ;(createClient as any).mockReturnValue(mockSupabase)
    ;(chunkDocument as any).mockReturnValue([{ content: 'chunk1', index: 0, metadata: {} }])
    ;(embedBatch as any).mockResolvedValue([[0.1, 0.2]])
  })

  it('should process document successfully and update status correctly', async () => {
    const result = await processDocument('doc-123', 'path/to/file', 'user-123')

    expect(result.success).toBe(true)
    expect(result.documentId).toBe('doc-123')

    // Verify status updates
    const updateCalls = mockSupabase.update.mock.calls
    
    // 1. PARSING
    expect(updateCalls[0][0]).toMatchObject({ status: DocumentStatus.PARSING })
    expect(updateCalls[0][0]).toHaveProperty('started_at')
    
    // 2. CHUNKING
    expect(updateCalls[1][0]).toMatchObject({ status: DocumentStatus.CHUNKING })
    
    // 3. EMBEDDING
    expect(updateCalls[2][0]).toMatchObject({ status: DocumentStatus.EMBEDDING })
    
    // 4. COMPLETED
    expect(updateCalls[3][0]).toMatchObject({ status: DocumentStatus.COMPLETED })
  })

  it('should handle errors and update status to FAILED', async () => {
    // Mock download failure
    mockSupabase.storage.download.mockResolvedValue({ data: null, error: { message: 'Download failed' } })

    const result = await processDocument('doc-123', 'path/to/file', 'user-123')

    expect(result.success).toBe(false)
    expect(result.error).toBe('문서 처리 중 오류가 발생했습니다.') // Sanitized message

    // Verify FAILED status update
    const updateCalls = mockSupabase.update.mock.calls
    const lastCall = updateCalls[updateCalls.length - 1][0]
    
    expect(lastCall).toMatchObject({ 
      status: DocumentStatus.FAILED,
      error_message: '문서 처리 중 오류가 발생했습니다.'
    })
  })

  it('should sanitize specific error messages', async () => {
    // Mock empty content error
    mockSupabase.storage.download.mockResolvedValue({
      data: { text: () => Promise.resolve('') }, // Empty text
      error: null
    })

    const result = await processDocument('doc-123', 'path/to/file', 'user-123')

    expect(result.success).toBe(false)
    expect(result.error).toBe('문서 내용이 비어있습니다.')

    const updateCalls = mockSupabase.update.mock.calls
    const lastCall = updateCalls[updateCalls.length - 1][0]
    
    expect(lastCall).toMatchObject({ 
      status: DocumentStatus.FAILED,
      error_message: '문서 내용이 비어있습니다.'
    })
  })
})
