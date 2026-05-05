// 디렉토리 경로: frontend/src/app/api/documents/process/
// 파일명: route.test.ts
// 파일 코드의 역할/설명: 문서 처리 API의 인증, 입력 검증, 중복 처리, 안전한 에러 응답을 검증한다.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DocumentStatus } from '@/types/rag'
import { handleProcessDocument } from './handler'

const getUserMock = vi.fn()
const processDocumentMock = vi.fn()

let lookupResult: { data: unknown; error: unknown }
let claimResult: { data: unknown; error: unknown }
let updatePayload: unknown

function createQueryBuilder() {
  let mode: 'select' | 'update' = 'select'

  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    in: vi.fn(() => builder),
    update: vi.fn((payload: unknown) => {
      mode = 'update'
      updatePayload = payload
      return builder
    }),
    maybeSingle: vi.fn(async () => (mode === 'update' ? claimResult : lookupResult)),
  }

  return builder
}

async function callPost(body: unknown, headers?: HeadersInit) {
  const request = new Request('http://localhost/api/documents/process', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...headers,
    },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })

  return handleProcessDocument(request as never, {
    createClient: async () =>
      ({
        auth: {
          getUser: getUserMock,
        },
        from: () => createQueryBuilder(),
      }) as never,
    processDocument: processDocumentMock as never,
  })
}

describe('documents/process route', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    getUserMock.mockResolvedValue({
      data: { user: { id: 'user-123' } },
      error: null,
    })
    processDocumentMock.mockResolvedValue({ success: true })

    lookupResult = {
      data: {
        id: 'doc-123',
        file_path: 'user-123/doc.txt',
        file_type: 'text/plain',
        status: DocumentStatus.PENDING,
        user_id: 'user-123',
      },
      error: null,
    }
    claimResult = {
      data: {
        id: 'doc-123',
        file_path: 'user-123/doc.txt',
        file_type: 'text/plain',
        status: DocumentStatus.PARSING,
        user_id: 'user-123',
      },
      error: null,
    }
    updatePayload = null
  })

  it('rejects invalid JSON without calling processDocument', async () => {
    const response = await callPost('{bad-json')
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data).toMatchObject({
      success: false,
      error: 'BAD_REQUEST',
    })
    expect(processDocumentMock).not.toHaveBeenCalled()
  })

  it('returns idempotent success when the document is already active', async () => {
    lookupResult = {
      data: {
        id: 'doc-123',
        file_path: 'user-123/doc.txt',
        file_type: 'text/plain',
        status: DocumentStatus.CHUNKING,
        user_id: 'user-123',
      },
      error: null,
    }

    const response = await callPost({ documentId: 'doc-123' })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toMatchObject({
      success: true,
      status: DocumentStatus.CHUNKING,
    })
    expect(processDocumentMock).not.toHaveBeenCalled()
  })

  it('claims a pending document before processing it', async () => {
    const response = await callPost({ documentId: 'doc-123' }, { 'x-request-id': 'req-test' })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(response.headers.get('x-request-id')).toBe('req-test')
    expect(updatePayload).toMatchObject({
      status: DocumentStatus.PARSING,
      error_message: null,
    })
    expect(processDocumentMock).toHaveBeenCalledWith(
      'doc-123',
      'user-123/doc.txt',
      'user-123',
      'text/plain'
    )
    expect(data).toMatchObject({
      success: true,
      requestId: 'req-test',
    })
  })

  it('does not expose internal processing errors to the response body', async () => {
    processDocumentMock.mockResolvedValue({
      success: false,
      error: 'raw provider stack trace with internal details',
    })

    const response = await callPost({ documentId: 'doc-123' })
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data).toMatchObject({
      success: false,
      error: 'PROCESSING_FAILED',
      message: '문서 처리 중 오류가 발생했습니다.',
    })
    expect(JSON.stringify(data)).not.toContain('raw provider stack trace')
  })
})
